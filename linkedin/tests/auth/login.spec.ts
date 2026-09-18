import { test, expect } from '../../src/fixtures/testFixtures.js';

/**
 * Auth Test Suite
 *
 * Some tests require a running staging server (baseURL from .env).
 * Tests are annotated with @requires-server when that is the case.
 *
 * Mock-adapter tests run without any server.
 */
test.describe('Authentication — Mock Adapter', () => {
  test('mock adapter authenticates without errors', async ({ networkingAdapter }) => {
    // adapter.authenticate() is already called in the fixture; if it throws,
    // this test would fail at fixture setup. An explicit call confirms re-auth is safe.
    await expect(networkingAdapter.authenticate()).resolves.toBeUndefined();
  });

  test('authenticated adapter can fetch a profile', async ({ networkingAdapter }) => {
    const profile = await networkingAdapter.getProfile('test-profile-001');
    expect(profile).toBeDefined();
    expect(profile.id).toBe('test-profile-001');
  });
});

/**
 * These tests interact with a real browser and require a running server at APP_BASE_URL.
 * Skip them in CI unless a server is available, or point APP_BASE_URL at a staging env.
 */
test.describe('Authentication — UI (requires running server)', () => {
  // Skip when the base URL is localhost — these tests need a real staging server.
  // Point APP_BASE_URL to a running staging environment to run these tests.
  test.skip(
    () => (process.env['APP_BASE_URL'] ?? 'http://localhost:3000').includes('localhost'),
    'Skipped: APP_BASE_URL points to localhost. Set APP_BASE_URL to a staging server to run these tests.',
  );

  test('login page loads without navigation error', async ({ loginPage }) => {
    await loginPage.open();
    expect(await loginPage.hasLoginError()).toBe(false);
  });

  test('full login flow completes and isAuthenticated returns true', async ({
    authenticationService,
  }) => {
    await authenticationService.ensureAuthenticated();
    expect(await authenticationService.isAuthenticated()).toBe(true);
  });

  test('auth state can be saved after login', async ({ authenticationService }) => {
    await authenticationService.ensureAuthenticated();
    await authenticationService.saveState();
    expect(await authenticationService.isAuthenticated()).toBe(true);
  });
});
