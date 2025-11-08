import { supabase, supabaseAdmin } from './supabase';
import { supabaseStorage } from './supabase-storage';
import type { Request, Response, NextFunction } from 'express';
import type { User } from '@shared/schema';

export async function getSupabaseUser(accessToken: string): Promise<User | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  // Try to get user with the token
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  // If token is invalid or expired, log the error but don't try to refresh on server
  // Token refresh should happen on the client side
  if (error || !user) {
    console.log(`[getSupabaseUser] Token validation failed: ${error?.message || 'No user'}`);
    console.log(`[getSupabaseUser] Token (first 20 chars): ${accessToken.substring(0, 20)}...`);
    return null;
  }

  // PRIORITY: Try Supabase users table first (works even if Helium DB is down)
  let userData: User | null = null;
  
  if (supabaseAdmin) {
    try {
      const { data: userFromSupabase, error: supabaseError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!supabaseError && userFromSupabase) {
        userData = {
          id: userFromSupabase.id,
          email: userFromSupabase.email,
          username: userFromSupabase.username || undefined,
          isAdmin: userFromSupabase.is_admin || false,
          tenantId: userFromSupabase.tenant_id || undefined,
          role: userFromSupabase.role || 'member',
          subscriptionStatus: userFromSupabase.subscription_status || undefined,
          planId: userFromSupabase.plan_id || undefined,
          apiCallsUsed: userFromSupabase.api_calls_used || 0,
          apiCallsLimit: userFromSupabase.api_calls_limit || 50,
          createdAt: userFromSupabase.created_at,
          updatedAt: userFromSupabase.updated_at,
        };
        console.log(`[getSupabaseUser] User found in Supabase users table`);
      }
    } catch (supabaseError: any) {
      console.error(`[getSupabaseUser] Error getting user from Supabase:`, supabaseError.message);
    }
  }
  
  // FALLBACK: Try Helium DB if Supabase lookup failed
  if (!userData) {
    try {
      userData = await supabaseStorage.getUserById(user.id);
      if (userData) {
        console.log(`[getSupabaseUser] User found in Helium DB`);
      }
    } catch (dbError: any) {
      console.error(`[getSupabaseUser] Error getting user from Helium DB:`, dbError.message);
    }
  }

  if (!userData) {
    console.error(`[getSupabaseUser] No user data found for id: ${user.id}`);
    return null;
  }

  console.log(`[getSupabaseUser] User data:`, {
    id: userData.id,
    email: userData.email,
    tenant_id: userData.tenantId,
    role: userData.role,
    is_admin: userData.isAdmin
  });

  return userData;
}

export async function createAdminUser(email: string, password: string, username?: string): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;

  const { data: akkushopTenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', 'akkushop')
    .single();

  if (!akkushopTenant) {
    console.error('AkkuShop tenant not found for admin user');
  }

  const { error: insertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: data.user.id,
      email: email,
      username: username || 'Admin',
      is_admin: true,
      role: 'admin',
      tenant_id: akkushopTenant?.id,
      subscription_status: 'trial',
      plan_id: 'trial',
      api_calls_limit: 50, // Trial limit: 50 calls per tool
      api_calls_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    });

  if (insertError) {
    throw new Error(`Failed to create user record: ${insertError.message}`);
  }

  console.log(`✅ Admin user created: ${email}${username ? ` (Username: ${username})` : ''}`);
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
