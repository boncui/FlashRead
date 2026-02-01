/**
 * Environment variable validation.
 * Call this at application startup to fail fast on missing config.
 */

export function validateEnv(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Validate R2 configuration (optional for dev, required for document features)
 */
export function validateR2Env(): boolean {
  const r2Vars = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ];

  const missing = r2Vars.filter((v) => !process.env[v]);
  return missing.length === 0;
}

/**
 * Validate service-level config (for backend workers)
 */
export function validateServiceEnv(): void {
  validateEnv();
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
}
