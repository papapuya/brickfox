#!/bin/sh
set -e

echo "🔍 Checking environment variables..."

# Render.com makes environment variables available, but we need to ensure they're set
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ ERROR: VITE_SUPABASE_URL is not set!"
  exit 1
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ ERROR: VITE_SUPABASE_ANON_KEY is not set!"
  exit 1
fi

echo "✅ VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:0:30}..."
echo "✅ VITE_SUPABASE_ANON_KEY: SET"

echo "🚀 Starting build with environment variables..."
npm run build

