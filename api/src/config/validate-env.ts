const REQUIRED = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'API_PORT',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((name) => !config[name]);
  if (missing.length > 0) {
    throw new Error('Missing environment variables: ' + missing.join(', '));
  }
  return config;
}
