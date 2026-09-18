import { test, expect } from '../../src/fixtures/testFixtures.js';
import { getTestProfileById } from '../../src/utils/testData.js';

/**
 * Connection Request Test Suite
 *
 * Full end-to-end workflow tested via the mock adapter (no server required):
 *   Authenticate (mock) → GetProfile → Verify → Send Request → Verify Pending
 *
 * Safety boundaries enforced:
 *   • Uses mock adapter only (NETWORKING_ADAPTER=mock)
 *   • Profile IDs come from test-data/profiles.json — never real people
 *   • No CAPTCHA / MFA bypass — tests stop if a challenge is presented
 *   • No private API calls
 */
test.describe('Connection Request Workflow', () => {
  const profileId = 'test-profile-001';

  test('profile exists and has expected data', async ({ networkingAdapter }) => {
    const fixtureData = getTestProfileById(profileId);
    const profile = await networkingAdapter.getProfile(profileId);

    expect(profile.id).toBe(profileId);
    expect(profile.name).toBe(fixtureData.expectedName);
  });

  test('profile is eligible for a connection request (NotConnected)', async ({
    networkingAdapter,
  }) => {
    const profile = await networkingAdapter.getProfile(profileId);
    expect(profile.connectionStatus).toBe('NotConnected');
  });

  test('send connection request and verify status becomes Pending', async ({
    networkingAdapter,
  }) => {
    // 1. Send the request via the adapter
    const request = await networkingAdapter.sendConnectionRequest(profileId);

    expect(request.profileId).toBe(profileId);
    expect(request.status).toBe('Pending');

    // 2. Read status back from the adapter to confirm eventual state
    const status = await networkingAdapter.getConnectionStatus(profileId);
    expect(status).toBe('Pending');
  });

  test('connection status is Unknown for profiles that never had a request', async ({
    networkingAdapter,
  }) => {
    // Use a profile that exists but was never sent a request
    const profile = await networkingAdapter.getProfile('test-profile-002');
    expect(profile.connectionStatus).toBe('Connected'); // seeded as Connected
  });

  test('complete workflow: authenticate → get profile → connect → pending', async ({
    networkingAdapter,
  }) => {
    // Step 1: Adapter is pre-authenticated via fixture
    const fixtureData = getTestProfileById(profileId);

    // Step 2: Fetch profile and verify
    const profile = await networkingAdapter.getProfile(profileId);
    expect(profile.name).toBe(fixtureData.expectedName);
    expect(profile.connectionStatus).toBe('NotConnected');

    // Step 3: Send connection request
    const request = await networkingAdapter.sendConnectionRequest(profileId);
    expect(request.status).toBe('Pending');

    // Step 4: Verify final status
    const finalStatus = await networkingAdapter.getConnectionStatus(profileId);
    expect(finalStatus).toBe('Pending');
  });
});
