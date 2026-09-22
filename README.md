# LinkedIn Automation & Session Sync Service (`linkedin_auto_test`)

A robust, production-grade automation and session synchronization service for LinkedIn built with **Node.js (Express 5)**, **Playwright**, **TypeScript**, and **MySQL**.

---

## 📖 Complete Documentation

For the full step-by-step setup, database schema, environment variables, API reference, PM2/Nginx production deployment, and troubleshooting, read:

👉 **[PROJECT_SETUP_AND_HANDOVER_GUIDE.md](PROJECT_SETUP_AND_HANDOVER_GUIDE.md)**

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v18+ LTS
- **MySQL Server** v8.0+
- **Playwright Chromium**

### 2. Installation

```bash
# Clone repository
git clone <repo-url> test-auto
cd test-auto

# Install server dependencies
npm install

# Install automation engine dependencies & Playwright Chromium
cd linkedin
npm install
npx playwright install chromium
cd ..
```

### 3. Environment Setup

```bash
cp linkedin/.env.example .env
```

Edit `.env` with your database and LinkedIn test account credentials:

```ini
PORT=4001
APP_BASE_URL=https://www.linkedin.com
TEST_USERNAME=your_email@example.com
TEST_PASSWORD=YourPassword123
HEADLESS=false
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=linkedin_db
DB_USER=root
DB_PASSWORD=your_mysql_password
```

### 4. Database Setup

```bash
# Automated migration & user seeding:
cd linkedin
npm run db:init
cd ..

# Or direct SQL import:
mysql -u root -p linkedin_db < db/schema.sql
```

### 5. Run Server

```bash
# Start development server with live watch:
npm run dev

# Or start in production mode:
npm start
```

Open **`http://localhost:4001/addnewuser`** to access the interactive web management dashboard.

---

## 🏗 Architecture & Key Features

- **Express 5 API Gateway**: Exposes REST endpoints for session verification, account management, direct connection requests, and sent invites checking.
- **Interactive UI Dashboard**: Located at `/addnewuser` for managing accounts, watching real-time login progression via Server-Sent Events (SSE), and entering 2FA/SMS challenge codes.
- **Playwright Automation Engine**: Isolated browser contexts, automated `storageState` capture, and deep session extraction (`li_at`, `JSESSIONID`, `bcookie`, `bscookie`, localStorage).
- **Scheduled Multi-Account Cron**: Endpoint `/cron/login` authenticates and synchronizes all accounts flagged with `login_try = 1`.
- **Preload Invite Dispatcher**: Sends connection requests using preload URLs (`/preload/custom-invite/?vanityName=...`) with custom personalized notes.

---

## 📡 API Endpoints Overview

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check & service status |
| `GET` | `/addnewuser` | Interactive Admin Management Dashboard |
| `GET` | `/api/users` | List all registered accounts and session status |
| `POST` | `/api/users` | Register or update an account |
| `PATCH` | `/api/users/:userId/login-try` | Toggle `login_try` flag (`1` or `0`) for cron |
| `POST` | `/api/login` | Authenticate account and capture session in Playwright |
| `GET` | `/api/login/stream` | Server-Sent Events (SSE) live authentication stream |
| `GET` | `/api/login/challenge` | Check pending 2FA/SMS verification checkpoint |
| `POST` | `/api/login/submit-otp` | Submit 2FA/SMS verification code to browser |
| `GET` | `/api/session/check` | Validate active session cookies |
| `POST` | `/api/session/restore` | Restore session without re-entering credentials |
| `POST` | `/api/session/logout` | Clear stored session cookies |
| `POST` | `/api/connect/invite` | Send direct connection request |
| `POST` | `/api/connect/sent-today` | Fetch today's sent connection requests |
| `GET / POST` | `/cron/login` | Run scheduled multi-user login cron |

---

## 📄 License & Safety Note

This software is for internal automation and testing purposes. Do not bypass CAPTCHAs or engage in unsolicited mass messaging. Always comply with LinkedIn's terms of service.
