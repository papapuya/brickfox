import { supabase, supabaseAdmin } from './supabase';
import type { Request, Response, NextFunction } from 'express';
import type { User } from '@shared/schema';

export async function getSupabaseUser(accessToken: string): Promise<User | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) return null;

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userData) return null;

  return {
    id: userData.id,
    email: userData.email,
    username: userData.username || undefined,
    isAdmin: userData.is_admin || false,
    stripeCustomerId: userData.stripe_customer_id || undefined,
    subscriptionStatus: userData.subscription_status || undefined,
    subscriptionId: userData.subscription_id || undefined,
    planId: userData.plan_id || undefined,
    currentPeriodEnd: userData.current_period_end || undefined,
    apiCallsUsed: userData.api_calls_used || 0,
    apiCallsLimit: userData.api_calls_limit || 3000, // 30× more for GPT-4o-mini
    createdAt: userData.created_at,
    updatedAt: userData.updated_at,
  };
}

export async function createAdminUser(email: string, password: string): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;

  const { error: insertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: data.user.id,
      email: email,
      username: 'Admin',
      is_admin: true,
      subscription_status: 'trial',
      plan_id: 'trial',
      api_calls_limit: 3000, // 3000 GPT-4o-mini = same cost as 100 GPT-4o
      api_calls_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    });

  if (insertError) {
    throw new Error(`Failed to create user record: ${insertError.message}`);
  }

  console.log(`✅ Admin user created: ${email}`);
}

export function supabaseAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    (req as any).user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  getSupabaseUser(token)
    .then(user => {
      (req as any).user = user;
      next();
    })
    .catch(() => {
      (req as any).user = null;
      next();
    });
}
