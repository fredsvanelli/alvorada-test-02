import { validateEnv } from './validate-env.js';

const complete = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'bookings',
  POSTGRES_PASSWORD: 'bookings',
  POSTGRES_DB: 'bookings',
  API_PORT: '3001',
};

describe('validateEnv', () => {
  it('returns the config when every required variable is set', () => {
    expect(validateEnv(complete)).toBe(complete);
  });

  it('names every empty or absent variable in one error', () => {
    const { API_PORT: _omitted, ...withoutApiPort } = complete;
    expect(() => validateEnv({ ...withoutApiPort, POSTGRES_DB: '' })).toThrow(
      'Missing environment variables: POSTGRES_DB, API_PORT',
    );
  });
});
