# LinkedIn Automation & Session Sync Service
## Developer Setup & Technical Handover Guide

> **Target Codebase**: `digitarmedia-techteam/linkedin_auto_test` (`test-auto`)  
> **Core Stack**: Node.js (ES Modules) • Express.js 5 • Playwright • MySQL • TypeScript (`tsx`) • HTML5/CSS3/Vanilla JS  
> **Default Port**: `3011`  
> **Interactive Dashboard**: `http://localhost:3011/addnewuser`

---

## 1. Project Overview & Architecture

This service is a specialized automation and session synchronization platform for LinkedIn accounts. It handles headless/headed authentication, automated session capture (cookies, security tokens, and localStorage), interactive 2FA/SMS challenge forwarding, direct connection request dispatching, sent invitation inspection, and scheduled multi-account cron synchronization.

### System Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients["Clients & External Triggers"]
        UI["Web Dashboard\n(/addnewuser)"]
        CronTrigger["External Cron Scheduler\n(/cron/login)"]
        ThirdParty["External REST Client / cURL"]
    end

    subgraph Backend["Express 5 API Gateway (server.js :3011)"]
        Router["Route Handlers & Middleware"]
        SSE["Server-Sent Events Emitter\n(/api/login/stream)"]
        OTPManager["OtpChallengeService\n(In-Memory Promise Bridge)"]
    end

    subgraph Automation["Playwright Automation Engine (linkedin/src/)"]
        MultiCron["MultiUserLoginCronService"]
        DirectConn["DirectConnectionService"]
        SentInvites["SentInvitationsService"]
        POM["Page Object Models\n(LoginPage, FeedPage)"]
    end

    subgraph LinkedIn["Target Service"]
        LI["LinkedIn Platform\n(www.linkedin.com)"]
    end

    subgraph Database["MySQL Persistence (linkedin_db)"]
        UsersTable[("linkedin_test_users\n(Accounts, Flags, Session JSON)")]
        DetailsTable[("loggedin_details\n(Granular Cookies, Keys, Secrets)")]
    end

    UI -->|REST & SSE| Router
    CronTrigger -->|GET/POST /cron/login| Router
    ThirdParty -->|REST API| Router

    Router --> SSE
    Router --> OTPManager
    Router --> MultiCron
    Router --> DirectConn
    Router --> SentInvites

    MultiCron --> POM
    DirectConn --> POM
    SentInvites --> POM
    POM -->|Playwright Chromium| LI

    OTPManager <-->|SMS Challenge Event & OTP Input| MultiCron
    MultiCron -->|Persist Credentials & State| UsersTable
    MultiCron -->|Persist Cookies & Tokens| DetailsTable
    Router <-->|Query & Update| UsersTable
    Router <-->|Query Session Data| DetailsTable
```

### Key Capabilities

1. **Automated Multi-Account Login**: Iterates through accounts marked with `login_try = 1` in separate, isolated browser contexts.
2. **Deep Session Capture**: Extracts `storageState` (all cookies + origins localStorage), serializes it, and saves individual tokens (`li_at`, `JSESSIONID`, `bcookie`, `bscookie`, `liap`, etc.) into `loggedin_details`.
3. **Interactive 2FA/SMS Interception**: When LinkedIn prompts for a verification code, Playwright holds the browser session open (3-minute window), fires an event through `OtpChallengeService`, pushes an SSE notification to the web dashboard, and resumes authentication instantly when the user submits the code.
4. **Direct Connection Requests**: Generates and navigates to preload connection URLs (`/preload/custom-invite/?vanityName=...`) to dispatch connection invites with optional personalized notes.
5. **Sent Invitations Tracking**: Inspects LinkedIn's invitation manager (`/mynetwork/invitation-manager/sent/`) to count and list pending connection invites sent today.
6. **Public Cron Hook**: Exposes `/cron/login` callable by Google Cloud Scheduler, cron-job.org, or standard Linux `crontab`.

---

## 2. Directory Structure

```text
test-auto/
├── .env                              # Root runtime environment variables
├── .gitignore                        # Git exclusion rules
├── README.md                         # Repository summary & entry point
├── PROJECT_SETUP_AND_HANDOVER_GUIDE.md # This guide
├── package.json                      # Root project scripts & server dependencies
├── package-lock.json
├── server.js                         # Express 5 application entry point & API routes
│
├── db/
│   └── schema.sql                    # Standalone MySQL schema initialization script
│
├── public/
│   └── addnewuser.html               # Single-page management dashboard & visual runner
│
└── linkedin/                         # Core automation engine & Playwright test suite
    ├── .env                          # Automation environment config
    ├── .env.example                  # Environment configuration template
    ├── package.json                  # Automation dependencies & scripts
    ├── playwright.config.ts          # Playwright test runner configuration
    ├── tsconfig.json                 # TypeScript compiler options
    ├── scripts/
    │   └── init-db.ts                # Database migration and account seeding script
    └── src/
        ├── config/
        │   ├── constants.ts          # Storage paths and default values
        │   └── env.ts                # Fail-fast environment variable validation
        ├── db/
        │   ├── connection.ts         # MySQL pool manager (mysql2/promise)
        │   ├── models/
        │   │   ├── LoggedInDetail.ts # Data models for granular session items
        │   │   └── TestUser.ts       # Data models for LinkedIn test accounts
        │   └── repositories/
        │       ├── LoggedInDetailsRepository.ts # CRUD for loggedin_details
        │       └── TestUserRepository.ts        # CRUD for linkedin_test_users
        ├── pages/
        │   ├── BasePage.ts           # Shared page utilities and waits
        │   ├── FeedPage.ts           # LinkedIn Feed interactions & verification
        │   └── LoginPage.ts          # LinkedIn Login form, error & challenge checks
        ├── services/
        │   ├── AuthenticationService.ts    # Single-user Playwright auth service
        │   ├── DirectConnectionService.ts  # Preload invite sender & handle parser
        │   ├── MultiUserLoginCronService.ts# Multi-account batch runner & capture
        │   ├── OtpChallengeService.ts      # 2FA/SMS challenge event bridge
        │   └── SentInvitationsService.ts   # Sent connection requests inspector
        └── utils/
            ├── errors.ts             # Custom error definitions
            ├── logger.ts             # Structured logger with credential redaction
            └── retry.ts              # Exponential backoff helpers
```

---

## 3. Prerequisites

Ensure the following runtimes and packages are installed on your workstation or production server:

| Tool | Minimum Version | Recommended Version | Description |
|---|---|---|---|
| **Node.js** | `v18.0.0` | `v20.x LTS` | JavaScript / TypeScript runtime |
| **npm** | `v9.0.0` | `v10.x` | Package manager |
| **MySQL Server** | `v8.0` | `v8.0` or `v8.4` | Relational database engine |
| **Playwright Browsers**| `v1.48+` | `v1.63+` | Headless Chromium engine |

### System Packages for Playwright (Linux / Ubuntu only)

If deploying on Ubuntu/Debian, install the required graphics, audio, and font libraries:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  xvfb
```

Alternatively, you can run:

```bash
npx playwright install-deps chromium
```

---

## 4. MySQL Database Setup

### Step 1: Create the Database and User

Connect to your MySQL server as `root` or an administrative user:

```bash
mysql -u root -p
```

Execute the following commands to provision the database and user:

```sql
-- 1. Create the database
CREATE DATABASE IF NOT EXISTS `linkedin_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Create a dedicated application user (replace 'your_secure_password' with your password)
CREATE USER IF NOT EXISTS 'linkedin_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- 3. Grant privileges
GRANT ALL PRIVILEGES ON `linkedin_db`.* TO 'linkedin_user'@'localhost';
FLUSH PRIVILEGES;

-- 4. Verify
SHOW DATABASES LIKE 'linkedin_db';
```

### Step 2: Initialize Database Schema

You have two options to initialize the required tables:

#### Option A: Run the Automated TypeScript Setup Script (Recommended)

From the project root:

```bash
cd linkedin
npm run db:init
cd ..
```

This connects to MySQL, runs `CREATE TABLE IF NOT EXISTS` for both tables, and seeds the primary account specified in your `.env`.

#### Option B: Direct SQL Import

Import the schema file located at [db/schema.sql](file:///Users/abhinav/test-auto/db/schema.sql):

```bash
mysql -u linkedin_user -p linkedin_db < db/schema.sql
```

### Step 3: Database Schema Reference

#### Table: `linkedin_test_users`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `INT` | No | Primary Key (Auto-Increment) |
| `username` | `VARCHAR(255)` | No | LinkedIn email address (Unique) |
| `password` | `VARCHAR(255)` | No | Plaintext login password |
| `login_try` | `TINYINT(1)` | No | `1` = Target for cron login; `0` = Skip in cron |
| `status` | `ENUM` | No | `'active'`, `'inactive'`, `'locked'`, `'checkpoint'`, `'failed'` |
| `storage_state_json` | `LONGTEXT` | Yes | Serialized Playwright `storageState` (cookies + localStorage) |
| `session_cookies_json` | `LONGTEXT` | Yes | Extracted array of session cookies |
| `li_at_token` | `VARCHAR(512)` | Yes | Primary LinkedIn session token (`li_at`) |
| `user_agent` | `TEXT` | Yes | Browser user agent string used during session capture |
| `two_factor_secret` | `VARCHAR(255)` | Yes | TOTP secret key (if applicable) |
| `proxy` | `VARCHAR(255)` | Yes | Optional proxy URI (`http://user:pass@host:port`) |
| `last_login_at` | `DATETIME` | Yes | Timestamp of most recent login |
| `last_login_status` | `ENUM` | No | `'never_attempted'`, `'success'`, `'failed'`, `'checkpoint'`, `'expired'` |
| `last_error` | `TEXT` | Yes | Failure error description |
| `login_count` | `INT UNSIGNED`| No | Counter of successful logins |
| `meta_data` | `JSON` | Yes | Arbitrary account metadata (profile URL, vanity, notes) |
| `created_at` | `TIMESTAMP` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | No | Last record update timestamp |

#### Table: `loggedin_details`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | No | Primary Key (Auto-Increment) |
| `user_id` | `INT` | No | Foreign Key $\to$ `linkedin_test_users.id` (ON DELETE CASCADE) |
| `data_category` | `ENUM` | No | `'cookie'`, `'local_storage'`, `'session_storage'`, `'secret_key'`, `'session_meta'`, `'full_state'` |
| `data_key` | `VARCHAR(255)` | No | Cookie name, localStorage key, or token identifier |
| `data_value` | `LONGTEXT` | Yes | Stored value |
| `is_secret` | `TINYINT(1)` | No | `1` for critical tokens (`li_at`, `JSESSIONID`, `bcookie`); `0` otherwise |
| `extra_metadata` | `JSON` | Yes | Cookie domain, expiration timestamp, path, httpOnly, secure flags |
| `created_at` | `TIMESTAMP` | No | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | No | Last record update timestamp |

### Database Backup & Restore

**Backup:**
```bash
mysqldump -u linkedin_user -p linkedin_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore:**
```bash
mysql -u linkedin_user -p linkedin_db < backup_20260921_100000.sql
```

---

## 5. Environment Variables Configuration

Copy `.env.example` to `.env` in the root folder:

```bash
cp linkedin/.env.example .env
```

### Complete Configuration Table

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `3011` | HTTP port for the Express server |
| `APP_BASE_URL` | Yes | `https://www.linkedin.com` | Base URL for navigation and authentication |
| `TEST_USERNAME` | Yes | — | Default LinkedIn account email address |
| `TEST_PASSWORD` | Yes | — | Default LinkedIn account password |
| `HEADLESS` | Optional | `false` (dev) / `true` (prod) | Run browser without visible window |
| `DEFAULT_TIMEOUT` | Optional | `30000` | Browser action timeout in milliseconds |
| `NETWORKING_ADAPTER`| Optional | `mock` | `mock` (unit tests) or `official` |
| `DB_HOST` | Yes | `127.0.0.1` | MySQL server hostname or IP |
| `DB_PORT` | Optional | `3306` | MySQL server port |
| `DB_NAME` | Yes | `linkedin_db` | MySQL database name |
| `DB_USER` | Yes | `root` or `linkedin_user` | MySQL user |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DATABASE_URL` | Optional | — | Combined connection string format |

### Production vs Development `.env` Recommendations

```ini
# --- Development (.env) ---
PORT=3011
APP_BASE_URL=https://www.linkedin.com
TEST_USERNAME=developer@example.com
TEST_PASSWORD=Password123!
HEADLESS=false
DEFAULT_TIMEOUT=30000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=linkedin_db
DB_USER=root
DB_PASSWORD=local_root_password

# --- Production (.env) ---
PORT=3011
APP_BASE_URL=https://www.linkedin.com
TEST_USERNAME=bot_primary@company.com
TEST_PASSWORD=VerySecurePassword#987!
HEADLESS=true
DEFAULT_TIMEOUT=45000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=linkedin_db
DB_USER=linkedin_user
DB_PASSWORD=prod_db_strong_password
```

> [!CAUTION]
> Never commit `.env` or Playwright `storage/auth.json` files to Git. Both are listed in `.gitignore`. Passwords and tokens are automatically redacted by `src/utils/logger.ts`.

---

## 6. Step-by-Step Local Development Setup

Follow these exact steps to run the application from a clean state:

```bash
# 1. Clone the repository
git clone <repository_url> test-auto
cd test-auto

# 2. Install root server dependencies
npm install

# 3. Install Playwright package dependencies & browser binaries
cd linkedin
npm install
npx playwright install chromium
cd ..

# 4. Create and edit your .env file
cp linkedin/.env.example .env
nano .env  # or code .env

# 5. Initialize the MySQL database tables
cd linkedin
npm run db:init
cd ..

# 6. Start the development server (with live reload)
npm run dev
```

The server will output:
```text
🚀 LinkedIn Automation Server running on http://localhost:3011
⏰ Public Cron Route: http://localhost:3011/cron/login
💻 Add User & Session Capture UI: http://localhost:3011/addnewuser
```

Open **`http://localhost:3011/addnewuser`** in your browser.

---

## 7. Interactive Admin Panel & Session Capture Flow

The dashboard at `/addnewuser` provides an intuitive graphical interface for all features:

```text
┌────────────────────────────────────────────────────────────────────────┐
│               LinkedIn Session Sync & Automation Console              │
├────────────────────────────────────────────────────────────────────────┤
│  [Tab: Accounts]  [Tab: Direct Connect]  [Tab: Sent Invites]  [Tab: Logs]│
├────────────────────────────────────────────────────────────────────────┤
│  Add / Manage Account:                                                 │
│  Username: [ deepak@digitarmedia.com                                 ] │
│  Password: [ ******************                                      ] │
│  [x] Include in Cron Sync (login_try = 1)                              │
│  [x] Headless Browser Mode                                            │
│                                                                        │
│  [  ⚡ Authenticate & Capture Session  ]  [  💾 Save User Only  ]       │
├────────────────────────────────────────────────────────────────────────┤
│  Real-Time Progress (Server-Sent Events):                              │
│  [2026-09-21 11:00:05] Starting Chromium browser...                    │
│  [2026-09-21 11:00:08] Entering credentials for deepak@...            │
│  [2026-09-21 11:00:12] LinkedIn SMS Checkpoint detected!               │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  ⚠️ 2FA Verification Code Required                            │     │
│  │  Enter the 6-digit code sent to your phone/authenticator:     │     │
│  │  [ 492817      ]  [ Submit Code ]                             │     │
│  └───────────────────────────────────────────────────────────────┘     │
│  [2026-09-21 11:00:25] Code verified. Navigated to feed!               │
│  [2026-09-21 11:00:27] Captured 38 cookies, 12 localStorage items.    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2FA / OTP Interception Workflow

1. **Trigger**: When `/api/login` is called, Playwright opens LinkedIn's login page and enters credentials.
2. **Challenge Detection**: If LinkedIn responds with an SMS/Email checkpoint (`/checkpoint/challenge/` or `/checkpoint/v2/`), `LoginPage.ts` detects the challenge form.
3. **Event Emitted**: `OtpChallengeService.requestOtp(username)` creates a promise with a 3-minute timeout and emits a `status_update` event with status `waiting_for_otp`.
4. **SSE to Frontend**: The SSE stream at `/api/login/stream?username=...` instantly notifies the web page.
5. **Modal Appears**: The UI displays the OTP prompt modal with a countdown timer.
6. **User Submits Code**: The user types the code and clicks **Submit Code**, calling `POST /api/login/submit-otp`.
7. **Session Resumes**: `OtpChallengeService.submitOtp()` resolves the pending Playwright promise. Playwright types the code into LinkedIn's challenge input and clicks submit.
8. **Storage**: Once on `linkedin.com/feed`, Playwright captures cookies and localStorage, saving them to MySQL, and completes the HTTP response.

---

## 8. Backend REST API Reference

All routes accept and return `application/json` (except SSE streams and static HTML).

### 8.1 Public & Health Endpoints

#### `GET /`
Returns service status, active port, and endpoint directory.
- **Response `200 OK`**:
```json
{
  "status": "online",
  "service": "LinkedIn Test Automation & Session Sync Service",
  "cronEndpoint": "/cron/login",
  "ui": "http://localhost:3011/addnewuser"
}
```

#### `GET /addnewuser`
Renders the interactive Single-Page Application management dashboard.

---

### 8.2 Account & User Management

#### `GET /api/users`
Lists all accounts stored in `linkedin_test_users` with their session health flags.
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 1,
  "users": [
    {
      "id": 1,
      "username": "deepak@digitarmedia.com",
      "login_try": 1,
      "status": "active",
      "last_login_at": "2026-09-21T05:30:00.000Z",
      "last_login_status": "success",
      "login_count": 4,
      "has_saved_session": true,
      "session_cookies_count": 42
    }
  ]
}
```

#### `POST /api/users`
Upserts a test user into the database without executing an immediate browser login.
- **Body**:
```json
{
  "username": "user@example.com",
  "password": "SecretPassword123",
  "login_try": 1,
  "status": "active",
  "meta_data": { "role": "sales_rep" }
}
```

#### `PATCH /api/users/:userId/login-try`
Toggles whether this account should be included in automated cron logins.
- **Body**:
```json
{
  "login_try": 1
}
```

#### `GET /api/users/:userId/details`
Fetches all stored cookies, tokens, and metadata for a specific user from `loggedin_details`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "userId": 1,
  "totalRecords": 38,
  "secretTokensFound": ["li_at", "JSESSIONID", "bcookie"],
  "details": [ ... ]
}
```

---

### 8.3 Authentication & Session Management

#### `POST /api/login`
Executes browser automation to authenticate a user, solve checkpoints, and capture state.
- **Body**:
```json
{
  "username": "user@example.com",
  "password": "SecretPassword123",
  "forceFresh": true,
  "headless": true
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Authentication successful! Captured 38 session items for user@example.com",
  "user": {
    "id": 1,
    "username": "user@example.com",
    "status": "active",
    "has_saved_session": true
  },
  "secrets": {
    "li_at": "AQEDAT...",
    "JSESSIONID": "\"ajax:123...\""
  }
}
```

#### `GET /api/login/stream?username=user@example.com`
Server-Sent Events endpoint streaming real-time browser status updates and challenge notifications.

#### `GET /api/login/challenge?username=user@example.com`
Checks if an account is currently blocked on an active SMS/Email OTP checkpoint.

#### `POST /api/login/submit-otp`
Submits the verification code entered by the user to the active Playwright runner.
- **Body**:
```json
{
  "username": "user@example.com",
  "otp": "492817"
}
```

#### `GET /api/session/check?userId=1`
Validates whether stored session cookies are still accepted by LinkedIn.
- **Parameters**: `userId` (optional), `username` (optional), `deep=true` (optional, opens a headless browser to test feed access).

#### `POST /api/session/restore`
Restores an authenticated browser session for an existing account without re-entering credentials.

#### `POST /api/session/logout`
Clears stored session cookies and `storage_state_json` in the database for the given user.

---

### 8.4 LinkedIn Automation Actions

#### `POST /api/connect/invite`
Dispatches a direct connection invite using LinkedIn's custom-invite preload link.
- **Body**:
```json
{
  "senderUsername": "user@example.com",
  "targetUrl": "https://www.linkedin.com/in/williamhgates",
  "note": "Hi Bill, I would love to connect with you!",
  "headless": true
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "status": "sent",
  "vanityName": "williamhgates",
  "targetUrl": "https://www.linkedin.com/in/williamhgates",
  "senderUsername": "user@example.com",
  "noteIncluded": true,
  "message": "Successfully sent connection request to williamhgates",
  "timestamp": "2026-09-21T05:35:10.000Z"
}
```

#### `POST /api/connect/sent-today`
Opens the LinkedIn Sent Invitations page and counts invitations sent today.
- **Body**:
```json
{
  "senderUsername": "user@example.com",
  "headless": true
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 5,
  "totalPendingCount": 142,
  "invites": [
    { "name": "Jane Smith", "timeSent": "Sent 2 hours ago", "isToday": true },
    { "name": "Alex Jones", "timeSent": "Sent 4 hours ago", "isToday": true }
  ]
}
```

---

### 8.5 Automated Cron Synchronizer

#### `GET /cron/login` or `POST /cron/login`
Executes automated login for all users where `login_try = 1` (or a specific user via `?userId=1`).
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Cron multi-user login run completed. 2 succeeded, 0 failed.",
  "timestamp": "2026-09-21T05:40:00.000Z",
  "totalTargetUsers": 2,
  "successfulLogins": 2,
  "failedLogins": 0,
  "results": [ ... ]
}
```

---

## 9. Production Server Setup & Deployment

### Recommended Server Specifications
- **Operating System**: Ubuntu 22.04 LTS or 24.04 LTS
- **CPU**: 2 vCPUs minimum (Chromium browser execution requires multi-threading)
- **RAM**: 4 GB RAM minimum (2 GB RAM with 2 GB Swap file minimum)
- **Disk**: 25 GB SSD

### 9.1 Server Provisioning Script

Log into your Ubuntu production server and run:

```bash
# Update package list
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git, MySQL Server, Nginx, Certbot
sudo apt-get install -y git mysql-server nginx certbot python3-certbot-nginx

# Install Process Manager (PM2) globally
sudo npm install -g pm2

# Clone the repository
sudo mkdir -p /var/www/linkedin-auto
sudo chown -R $USER:$USER /var/www/linkedin-auto
git clone <your_git_repo_url> /var/www/linkedin-auto
cd /var/www/linkedin-auto

# Install root dependencies
npm install --production=false

# Install automation dependencies and Playwright system libraries
cd linkedin
npm install --production=false
npx playwright install-deps chromium
npx playwright install chromium
cd ..
```

### 9.2 Configure Production Environment

Create `/var/www/linkedin-auto/.env`:

```bash
nano /var/www/linkedin-auto/.env
```

Paste your production credentials:
```ini
PORT=3011
APP_BASE_URL=https://www.linkedin.com
TEST_USERNAME=primary_account@yourdomain.com
TEST_PASSWORD=YourSecurePassword123!
HEADLESS=true
DEFAULT_TIMEOUT=45000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=linkedin_db
DB_USER=linkedin_user
DB_PASSWORD=YourMySQLPasswordHere
```

Initialize the database:
```bash
cd /var/www/linkedin-auto/linkedin
npm run db:init
cd ..
```

### 9.3 Docker Deployment (Docker Compose)

The repository provides a production-hardened `Dockerfile` and `docker-compose.yml` with:
- Non-root user execution (`UID 1001`)
- Permission initialization container (`volumes-init`)
- Capabilities dropped (`cap_drop: - ALL`)
- Secure no-exec in-memory tmpfs (`/tmp:noexec,nosuid,nodev,size=64m`)
- External network integration (`webnet`)

To deploy using Docker:

```bash
# 1. Ensure external docker network exists
docker network create webnet || true

# 2. Build and start containers
docker compose up -d --build

# 3. Check logs
docker compose logs -f app
```

### 9.4 Run with PM2 (Process Manager)

Create a PM2 ecosystem file `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'linkedin-auto',
      script: 'server.js',
      interpreter: 'node',
      node_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
```

Start the application and configure automatic startup on reboot:

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Follow the command displayed on screen to enable systemd service
```

Useful PM2 commands:
```bash
pm2 status                    # Check service status
pm2 logs linkedin-auto        # Stream live logs
pm2 restart linkedin-auto     # Restart service
pm2 stop linkedin-auto        # Stop service
```

---

### 9.4 Nginx Reverse Proxy with SSE Support

Create an Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/linkedin-auto.conf
```

Paste the following configuration (replace `auto.yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name auto.yourdomain.com;

    # Client upload size and timeout adjustments
    client_max_body_size 50M;
    proxy_read_timeout 360s;
    proxy_connect_timeout 360s;
    proxy_send_timeout 360s;

    location / {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Critical for Server-Sent Events (SSE) & WebSocket support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
```

Enable the configuration and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/linkedin-auto.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 9.5 Configure SSL / HTTPS (Let's Encrypt)

Obtain a free automated SSL certificate with Certbot:

```bash
sudo certbot --nginx -d auto.yourdomain.com
```

Certbot will automatically edit the Nginx configuration, install certificates, and set up automatic renewal timers.

---

### 9.6 Setting Up Periodic Automated Cron

To automatically re-authenticate and verify all accounts with `login_try = 1` on a recurring schedule, add a crontab entry:

```bash
crontab -e
```

Add the following line to run the synchronization every 6 hours:

```bash
# Trigger LinkedIn account session sync every 6 hours
0 */6 * * * curl -s -X POST http://127.0.0.1:3011/cron/login >> /var/log/linkedin_cron.log 2>&1
```

Or configure an external monitoring/cron service (such as [cron-job.org](https://cron-job.org) or Cloud Scheduler) to make an HTTP `POST` request to `https://auto.yourdomain.com/cron/login` with your desired frequency.

---

## 10. Common Errors & Troubleshooting Guide

### 1. MySQL Authentication Plugin Error (`ER_NOT_SUPPORTED_AUTH_MODE`)
- **Symptom**: `Client does not support authentication protocol requested by server`.
- **Cause**: MySQL 8 defaults to `caching_sha2_password` which some clients fail to negotiate.
- **Fix**: Update the user's plugin to `mysql_native_password`:
  ```sql
  ALTER USER 'linkedin_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
  FLUSH PRIVILEGES;
  ```

### 2. Playwright Missing Browser Libraries on Linux
- **Symptom**: `browserType.launch: Host system is missing dependencies to run browsers`.
- **Fix**: Run the official Playwright dependency installer:
  ```bash
  sudo npx playwright install-deps chromium
  ```

### 3. LinkedIn 2FA / SMS Checkpoint Timed Out
- **Symptom**: `SMS OTP input timed out after 3 minutes (180 seconds)`.
- **Cause**: User did not submit the verification code in `/addnewuser` before the 180s countdown expired.
- **Fix**: Re-trigger login from the dashboard. Ensure the phone or email receiving the verification code is accessible.

### 4. LinkedIn CAPTCHA / Security Checkpoint Detected
- **Symptom**: Login status changes to `checkpoint`, and error contains `Security checkpoint detected`.
- **Cause**: LinkedIn detected unusual IP, new browser fingerprint, or excessive login attempts.
- **Fix**:
  1. Temporarily run in headed mode (`HEADLESS=false`) locally on your workstation to solve the CAPTCHA puzzle once.
  2. The authenticated session cookies will be saved to MySQL and can then be used in headless mode on your server.
  3. If deploying on cloud VPS (AWS, DigitalOcean, GCP), LinkedIn may block datacenters. Configure a residential proxy in `meta_data` or the `proxy` column of `linkedin_test_users`.

### 5. `ERR_CONNECTION_REFUSED` on Port 3011
- **Check**: Verify if the server is running:
  ```bash
  pm2 status
  # or
  sudo lsof -i :3011
  ```
- **Check Logs**:
  ```bash
  pm2 logs linkedin-auto --lines 100
  ```

### 6. Stored Session Expired (`li_at` cookie invalidated)
- **Symptom**: `/api/session/check` returns `isValid: false, reason: "session_expired"`.
- **Cause**: LinkedIn session expired naturally or was terminated from another device.
- **Fix**: Hit `/api/login` with `"forceFresh": true` to execute a fresh credentials login.

---

## 11. Complete Startup & Verification Checklist

Print or reference this quick checklist when handing off to a new developer:

- [ ] Node.js v18+ and MySQL 8.0+ installed.
- [ ] MySQL database `linkedin_db` created.
- [ ] Root dependencies installed via `npm install`.
- [ ] Subpackage dependencies installed via `cd linkedin && npm install`.
- [ ] Playwright Chromium installed via `npx playwright install chromium`.
- [ ] `.env` created in root directory with valid MySQL credentials.
- [ ] Schema initialized via `cd linkedin && npm run db:init`.
- [ ] Server running on `npm run dev`, PM2, or Docker.
- [ ] Health check verified at `http://localhost:3011/`.
- [ ] Interactive UI accessible at `http://localhost:3011/addnewuser`.
- [ ] Initial account successfully logged in and session verified in `linkedin_test_users`.
- [ ] Cron endpoint tested via `curl http://localhost:3011/cron/login`.
