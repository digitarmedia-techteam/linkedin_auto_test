import { test, expect } from '../../src/fixtures/testFixtures.js';
import { getTestProfileById } from '../../src/utils/testData.js';

/**
 * Profile Test Suite
 *
 * Tests reading profile information via the mock adapter (no server required).
 * Test profile IDs are loaded from test-data/profiles.json.
 */
test.describe('Profile', () => {
  const profileId = 'test-profile-001';

  test('can retrieve profile data via adapter', async ({ networkingAdapter }) => {
    const profile = await networkingAdapter.getProfile(profileId);
    const fixtureData = getTestProfileById(profileId);

    expect(profile.id).toBe(profileId);
    expect(profile.name).toBe(fixtureData.expectedName);
  });

  test('connection status is a valid typed value', async ({ networkingAdapter }) => {
    const profile = await networkingAdapter.getProfile(profileId);

    expect(['Connected', 'NotConnected', 'Pending', 'Unknown']).toContain(
      profile.connectionStatus,
    );
  });

  test('profile is not connected by default (fresh mock)', async ({ networkingAdapter }) => {
    const profile = await networkingAdapter.getProfile(profileId);

    expect(profile.connectionStatus).toBe('NotConnected');
  });

  test('second profile has Connected status in seed data', async ({ networkingAdapter }) => {
    const profile = await networkingAdapter.getProfile('test-profile-002');

    expect(profile.connectionStatus).toBe('Connected');
  });

  test('ProfileNotFoundError thrown for unknown profile ID', async ({ networkingAdapter }) => {
    await expect(networkingAdapter.getProfile('does-not-exist')).rejects.toThrow(
      'Profile not found: "does-not-exist"',
    );
  });
});
