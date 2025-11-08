-- Add missing columns to suppliers table
-- This migration adds columns that are missing from the suppliers table

-- Add suppl_nr column
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS suppl_nr TEXT;

-- Add tenant_id column
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add login-related columns
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS login_url TEXT;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS login_username_field TEXT;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS login_password_field TEXT;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS login_username TEXT;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS login_password TEXT;

-- Add verification columns
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS verified_fields JSONB;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Create index on tenant_id for better performance
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON public.suppliers(tenant_id);

-- Update RLS policies to support tenant-based access
-- Note: The existing policies should still work, but we can add tenant-based policies if needed

COMMENT ON COLUMN public.suppliers.suppl_nr IS 'Supplier number/identifier';
COMMENT ON COLUMN public.suppliers.tenant_id IS 'Tenant ID for multi-tenant support';
COMMENT ON COLUMN public.suppliers.login_url IS 'URL for supplier login page';
COMMENT ON COLUMN public.suppliers.login_username_field IS 'Form field name for username';
COMMENT ON COLUMN public.suppliers.login_password_field IS 'Form field name for password';
COMMENT ON COLUMN public.suppliers.login_username IS 'Stored username for login';
COMMENT ON COLUMN public.suppliers.login_password IS 'Encrypted password for login';
COMMENT ON COLUMN public.suppliers.verified_fields IS 'Array of verified field names';
COMMENT ON COLUMN public.suppliers.last_verified_at IS 'Timestamp of last field verification';
