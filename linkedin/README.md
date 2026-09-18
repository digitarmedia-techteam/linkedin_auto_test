# Network Automation — Playwright TypeScript Framework

A production-quality, modular test automation framework for professional networking workflows, built with **Playwright + TypeScript**.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install

# 3. Copy environment template and configure
cp .env.example .env
# Edit .env — set TEST_USERNAME, TEST_PASSWORD, APP_BASE_URL

# 4. Run all tests
npm test
```

---

## Installation

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
npm install
npx playwright install
```

---

## Configuration

All configuration is loaded from environment variables. **Never hard-code credentials.**

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `APP_BASE_URL` | Base URL of the application under test | `http://localhost:3000` |
| `TEST_USERNAME` | Test account username (staging only) | *(required)* |
| `TEST_PASSWORD` | Test account password (staging only) | *(required)* |
| `HEADLESS` | Run browser headless (`true`/`false`) | `false` |
| `DEFAULT_TIMEOUT` | Action/navigation timeout in ms | `30000` |
| `NETWORKING_ADAPTER` | `mock` (default) or `official` | `mock` |

> **IMPORTANT**: `.env` is listed in `.gitignore`. Never commit it.

---

## Running Tests

```bash
# All tests (mock adapter, chromium + firefox + webkit)
npm test

# Headed mode (visible browser)
npm run test:headed

# Interactive debug mode
npm run test:debug

# Playwright UI mode
npm run test:ui

# Chromium only
npm run test:chromium

# View last HTML report
npm run report
```

### Skipping the Auth Setup Step

```bash
SKIP_AUTH=true npm test
```

---

## Test Categories

### Mock-only tests (no server required)
These tests run with `NETWORKING_ADAPTER=mock` and require no running server:

- `tests/auth/login.spec.ts` — *Authentication — Mock Adapter* suite
- `tests/profile/profile.spec.ts` — all tests
- `tests/connections/connection-request.spec.ts` — all tests

### UI tests (require a running server at `APP_BASE_URL`)
These tests navigate a real browser and require a staging/local server:

- `tests/auth/login.spec.ts` — *Authentication — UI* suite

> Set `APP_BASE_URL` to your staging server URL to run these tests.

---

## Reports

```bash
# Generate and view HTML report
npm run report
```

Reports are saved in:

```text
playwright-report/   — HTML report
reports/             — JSON report
test-results/        — Screenshots, videos, traces on failure
```

---

## Architecture

```text
Tests
  │   (clean, data-driven, fixture-injected)
  ▼
Fixtures (testFixtures.ts)
  │   (wires pages, services, and adapters together)
  ▼
Services (AuthenticationService, ProfileService, ConnectionService)
  │   (business logic — orchestrates pages and adapters)
  ▼
Pages (LoginPage, FeedPage, ProfilePage, ConnectionsPage)
  │   (UI interaction, locators, assertions — no business logic)
  │
  ├── Adapters (NetworkingAdapter interface)
  │     ├── MockNetworkingAdapter    — in-memory, no HTTP calls
  │     └── OfficialApiNetworkingAdapter — authorized API stub
  │
  └── Application (staging / official API / mock server)
```

### Key Design Patterns

| Pattern | Where Used |
|---|---|
| Page Object Model (POM) | `src/pages/` |
| Service Layer | `src/services/` |
| Adapter Pattern | `src/adapters/` |
| Dependency Injection | Playwright fixtures in `src/fixtures/` |
| Data-driven tests | `test-data/profiles.json`, `test-data/users.json` |
| Fail-fast config | `src/config/env.ts` |
| Structured logging | `src/utils/logger.ts` |
| Exponential retry | `src/utils/retry.ts` |

---

## Security

### Credential Handling

- Credentials are loaded **exclusively from `.env`** (via `dotenv`).
- The `src/config/env.ts` loader **validates** all required variables at startup and **fails fast** if any are missing.
- Passwords are **never logged** — the logger redacts any key matching `password`, `token`, `secret`, `cookie`, or `authorization`.

### Authentication State

- Playwright auth state (`storage/auth.json`) is **excluded from Git** via `.gitignore`.
- Auth state contains session cookies — treat it like a password.
- Never upload `storage/auth.json` to GitHub, CI artifacts, or shared storage.

### Safety Boundaries

This framework intentionally does NOT implement:

| Prohibited | Reason |
|---|---|
| CAPTCHA solving / bypass | Violates terms of service |
| MFA bypass | Violates terms of service |
| Anti-bot evasion / stealth plugins | Violates terms of service |
| Browser fingerprint spoofing | Violates terms of service |
| Proxy rotation for evasion | Violates terms of service |
| Private / undocumented API calls | Not authorized |
| Scraping behind auth without authorization | Not authorized |
| Bulk unsolicited connection requests | Violates terms of service |
| Rate-limit bypassing | Violates terms of service |

If the application presents a CAPTCHA, MFA challenge, or security checkpoint, **the automated test stops** and requires the authorized tester to complete the challenge manually.

---

## Quality Standards

- **Strict TypeScript** — `strict: true`, no `any`.
- **No duplicated selectors** — locators defined once per page object.
- **No arbitrary `waitForTimeout()`** — locator assertions used for synchronization.
- **Stable selectors** — `data-testid` attributes on staging/test app elements.
- **Independent tests** — each test sets up its own state.
- **Secrets in env only** — zero hard-coded credentials anywhere.

---

## Code Quality

```bash
# TypeScript type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

---

## Adding New Workflows

1. **Add page objects** in `src/pages/` for new UI areas.
2. **Add a service** in `src/services/` for the business logic.
3. **Add adapter methods** to `NetworkingAdapter` interface and both adapter implementations.
4. **Add fixtures** to `src/fixtures/testFixtures.ts`.
5. **Add test data** to `test-data/` as JSON.
6. **Add specs** in `tests/` under a descriptive subdirectory.

---

## Project Structure

```text
network-automation/
├── src/
│   ├── config/
│   │   ├── env.ts              ← typed config from env vars
│   │   └── constants.ts        ← app-wide selectors & limits
│   ├── pages/
│   │   ├── LoginPage.ts
│   │   ├── FeedPage.ts
│   │   ├── ProfilePage.ts
│   │   └── ConnectionsPage.ts
│   ├── services/
│   │   ├── AuthenticationService.ts
│   │   ├── ProfileService.ts
│   │   └── ConnectionService.ts
│   ├── adapters/
│   │   ├── NetworkingAdapter.ts          ← interface
│   │   ├── MockNetworkingAdapter.ts      ← in-memory (default)
│   │   └── OfficialApiNetworkingAdapter.ts ← stub for authorized API
│   ├── fixtures/
│   │   └── testFixtures.ts
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── profile.types.ts
│   │   └── connection.types.ts
│   └── utils/
│       ├── errors.ts           ← typed error hierarchy
│       ├── logger.ts           ← structured, secret-safe logger
│       ├── retry.ts            ← generic exponential retry
│       └── testData.ts         ← JSON fixture loader
├── tests/
│   ├── auth/
│   │   ├── auth.setup.ts       ← global auth state setup
│   │   └── login.spec.ts
│   ├── profile/
│   │   └── profile.spec.ts
│   └── connections/
│       └── connection-request.spec.ts
├── test-data/
│   ├── profiles.json
│   └── users.json
├── storage/                    ← auth.json saved here (git-ignored)
├── reports/                    ← JSON reports
├── screenshots/                ← failure screenshots
├── .env.example
├── .gitignore
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── package.json
```

---

## TODOs

- [ ] Implement `OfficialApiNetworkingAdapter` once an authorized API integration is approved.
- [ ] Point `APP_BASE_URL` at a staging environment and run the UI test suite.
- [ ] Add `data-testid` attributes to the staging application matching `src/config/constants.ts`.
- [ ] Enable `auth.setup.ts` by removing `SKIP_AUTH=true` once the staging server is running.
- [ ] Add CI pipeline (GitHub Actions) configuration.
