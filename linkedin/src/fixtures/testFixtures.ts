import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { FeedPage } from '../pages/FeedPage.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { ConnectionsPage } from '../pages/ConnectionsPage.js';
import { AuthenticationService } from '../services/AuthenticationService.js';
import { ProfileService } from '../services/ProfileService.js';
import { ConnectionService } from '../services/ConnectionService.js';
import { MockNetworkingAdapter } from '../adapters/MockNetworkingAdapter.js';
import { OfficialApiNetworkingAdapter } from '../adapters/OfficialApiNetworkingAdapter.js';
import type { NetworkingAdapter } from '../adapters/NetworkingAdapter.js';
import { config } from '../config/env.js';

// ── Fixture types ─────────────────────────────────────────────────────────────

interface PageFixtures {
  loginPage: LoginPage;
  feedPage: FeedPage;
  profilePage: ProfilePage;
  connectionsPage: ConnectionsPage;
}

interface ServiceFixtures {
  networkingAdapter: NetworkingAdapter;
  authenticationService: AuthenticationService;
  profileService: ProfileService;
  connectionService: ConnectionService;
}

type AllFixtures = PageFixtures & ServiceFixtures;

// ── Extended test ─────────────────────────────────────────────────────────────

export const test = base.extend<AllFixtures>({
  // ── Page object fixtures ────────────────────────────────────────────────

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  feedPage: async ({ page }, use) => {
    await use(new FeedPage(page));
  },

  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },

  connectionsPage: async ({ page }, use) => {
    await use(new ConnectionsPage(page));
  },

  // ── Adapter fixture (selected by environment variable) ──────────────────

  networkingAdapter: async ({}, use) => {
    let adapter: NetworkingAdapter;

    if (config.networkingAdapter === 'official') {
      const apiKey = process.env['OFFICIAL_API_KEY'] ?? '';
      adapter = new OfficialApiNetworkingAdapter(config.baseUrl, apiKey);
    } else {
      adapter = new MockNetworkingAdapter();
    }

    await adapter.authenticate();
    await use(adapter);
  },

  // ── Service fixtures ────────────────────────────────────────────────────

  authenticationService: async ({ context }, use) => {
    await use(new AuthenticationService(context));
  },

  profileService: async ({ page, networkingAdapter }, use) => {
    await use(new ProfileService(page, networkingAdapter));
  },

  connectionService: async ({ page, networkingAdapter }, use) => {
    await use(new ConnectionService(page, networkingAdapter));
  },
});

export { expect } from '@playwright/test';
