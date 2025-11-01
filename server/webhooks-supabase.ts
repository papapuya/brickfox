import { Router } from 'express';
import { db } from './db';
import { users, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

interface SupabaseAuthEvent {
  type: 'user_created' | 'user_updated' | 'user_deleted';
  data: {
    id: string;
    email: string;
    created_at: string;
    updated_at?: string;
    user_metadata?: {
      username?: string;
      [key: string]: any;
    };
  };
}

/**
 * Webhook Signature Verification
 * Supabase sends a signature in the X-Webhook-Signature header
 */
function verifyWebhookSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) {
    console.warn('[Webhook] No signature provided');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get or create AkkuShop tenant
 */
async function getOrCreateAkkuShopTenant(): Promise<string> {
  // Try to find existing tenant
  const existingTenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, 'akkushop'))
    .limit(1);

  if (existingTenant.length > 0) {
    return existingTenant[0].id;
  }

  // Create new tenant
  console.log('[Webhook] Creating AkkuShop tenant');
  const newTenant = await db
    .insert(tenants)
    .values({
      name: 'AkkuShop',
      slug: 'akkushop',
      settings: {
        default_categories: ['battery', 'charger', 'tool', 'gps', 'drone', 'camera'],
        mediamarkt_title_format: 'Kategorie + Artikelnummer'
      }
    })
    .returning();

  return newTenant[0].id;
}

/**
 * Handle user_created event
 */
async function handleUserCreated(event: SupabaseAuthEvent) {
  const { id, email, created_at, user_metadata } = event.data;
  
  console.log(`[Webhook] Creating user in Helium DB: ${email}`);

  // Get tenant ID
  const tenantId = await getOrCreateAkkuShopTenant();

  // Check if user already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (existingUser.length > 0) {
    console.log(`[Webhook] User ${email} already exists, skipping creation`);
    return {
      status: 'skipped',
      reason: 'User already exists',
      user_id: id
    };
  }

  // Create user in Helium DB
  await db.insert(users).values({
    id,
    email,
    username: user_metadata?.username || email.split('@')[0],
    tenantId,
    isAdmin: false,
    role: 'member',
    subscriptionStatus: 'trial',
    planId: 'trial',
    apiCallsLimit: 3000,
    apiCallsUsed: 0,
    createdAt: new Date(created_at),
    updatedAt: new Date(created_at),
  });

  console.log(`✅ [Webhook] User ${email} created successfully in Helium DB`);

  return {
    status: 'success',
    action: 'user_created',
    user_id: id,
    email,
    tenant_id: tenantId
  };
}

/**
 * Handle user_updated event
 */
async function handleUserUpdated(event: SupabaseAuthEvent) {
  const { id, email, user_metadata } = event.data;
  
  console.log(`[Webhook] Updating user in Helium DB: ${email}`);

  // Update user in Helium DB
  await db
    .update(users)
    .set({
      email,
      username: user_metadata?.username,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  console.log(`✅ [Webhook] User ${email} updated successfully`);

  return {
    status: 'success',
    action: 'user_updated',
    user_id: id,
    email
  };
}

/**
 * Handle user_deleted event
 */
async function handleUserDeleted(event: SupabaseAuthEvent) {
  const { id, email } = event.data;
  
  console.log(`[Webhook] Soft-deleting user in Helium DB: ${email}`);

  // Soft delete: Update status instead of hard delete
  // Note: We don't have a 'status' field yet, so we could add it or just log
  // For now, we'll just log the deletion
  console.log(`⚠️ [Webhook] User deletion logged but not implemented: ${email}`);

  return {
    status: 'success',
    action: 'user_deleted',
    user_id: id,
    email,
    note: 'Logged but not deleted from Helium DB'
  };
}

/**
 * Webhook endpoint for Supabase Auth Events
 * POST /api/webhooks/supabase-auth
 */
router.post('/supabase-auth', async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('[Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    } else {
      console.warn('[Webhook] No SUPABASE_WEBHOOK_SECRET configured - skipping signature verification');
    }

    const event = req.body as SupabaseAuthEvent;
    console.log(`[Webhook] Received event: ${event.type} for user ${event.data.email}`);

    let result;
    switch (event.type) {
      case 'user_created':
        result = await handleUserCreated(event);
        break;
      case 'user_updated':
        result = await handleUserUpdated(event);
        break;
      case 'user_deleted':
        result = await handleUserDeleted(event);
        break;
      default:
        console.warn(`[Webhook] Unknown event type: ${event.type}`);
        return res.status(400).json({ error: `Unknown event type: ${event.type}` });
    }

    return res.json({
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Webhook] Error processing event:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * TEST endpoint - Simulate Supabase Auth webhook locally
 * POST /api/webhooks/supabase-auth-test
 */
router.post('/supabase-auth-test', async (req, res) => {
  try {
    const { email, userId } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`[Webhook Test] Simulating user_created event for ${email}`);

    const event: SupabaseAuthEvent = {
      type: 'user_created',
      data: {
        id: userId || crypto.randomUUID(),
        email,
        created_at: new Date().toISOString(),
        user_metadata: {
          username: email.split('@')[0]
        }
      }
    };

    const result = await handleUserCreated(event);

    return res.json({
      ...result,
      timestamp: new Date().toISOString(),
      note: 'This was a test webhook call'
    });

  } catch (error) {
    console.error('[Webhook Test] Error:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
