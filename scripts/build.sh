#!/bin/sh
set -e

echo "🔍 Checking VITE environment variables..."
echo "VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:+SET}"
echo "VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:+SET}"

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "⚠️  WARNING: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set!"
  echo "⚠️  The build will continue, but the frontend may not work correctly."
fi

echo "🚀 Starting build..."
npm run build

