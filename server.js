import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MultiUserLoginCronService } from './linkedin/src/services/MultiUserLoginCronService.ts';
import { LoggedInDetailsRepository } from './linkedin/src/db/repositories/LoggedInDetailsRepository.ts';
import { TestUserRepository } from './linkedin/src/db/repositories/TestUserRepository.ts';
import { OtpChallengeService } from './linkedin/src/services/OtpChallengeService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Interactive UI Route ─────────────────────────────────────────────────────
app.get(['/addnewuser', '/addneCron', '/addnecron', '/add-cron'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'addnewuser.html'));
});

app.get('/add-user', (req, res) => {
  res.redirect('/addnewuser');
});

// ── Public Health Check Route ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'LinkedIn Test Automation & Session Sync Service',
    cronEndpoint: '/cron/login',
    ui: 'http://localhost:' + PORT + '/addnewuser',
    docs: {
      addNewUserPage: 'GET /addnewuser (Interactive UI to add user and capture session)',
      directLogin: 'POST /api/login (Accepts username + password, authenticates and captures details)',
      publicCron: 'GET /cron/login or POST /cron/login (supports optional ?userId=1)',
      userDetails: 'GET /api/users/:userId/details',
      usersList: 'GET /api/users',
      addUser: 'POST /api/users',
    },
  });
});

// ── Public Cron Route ────────────────────────────────────────────────────────
// Can be hit by any public cron scheduler (cron-job.org, Cloud Scheduler, curl, etc.)
// Automates login for all users where login_try = 1 in separate browser contexts
const handleCronLogin = async (req, res) => {
  const userId = req.query.userId ? parseInt(req.query.userId, 10) : req.body?.userId;
  console.log(`[Server] Cron login route triggered${userId ? ` for user ${userId}` : ' for all users with login_try = 1'}`);

  try {
    const result = await MultiUserLoginCronService.runCron(userId);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('[Server] Cron execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

app.get('/cron/login', handleCronLogin);
app.post('/cron/login', handleCronLogin);
app.get('/api/cron/login', handleCronLogin);
app.post('/api/cron/login', handleCronLogin);

// ── Query Details for a User from loggedin_details Table ─────────────────────
app.get('/api/users/:userId/details', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const details = await LoggedInDetailsRepository.getDetailsByUserId(userId);
    const secrets = await LoggedInDetailsRepository.getSecretTokens(userId);

    res.json({
      success: true,
      userId,
      totalRecords: details.length,
      secretTokensFound: Object.keys(secrets),
      details,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── List All Test Users ─────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const users = await TestUserRepository.getAllUsers();
    res.json({
      success: true,
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        login_try: u.login_try,
        status: u.status,
        last_login_at: u.last_login_at,
        last_login_status: u.last_login_status,
        login_count: u.login_count,
        has_saved_session: u.storage_state_json !== null,
        meta_data: u.meta_data,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Add or Update a Test User ───────────────────────────────────────────────
app.post('/api/users', async (req, res) => {
  const { username, password, login_try = 1, status = 'active', meta_data } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'username and password are required' });
  }

  try {
    await TestUserRepository.upsertUser({
      username,
      password,
      login_try: Number(login_try),
      status,
      meta_data: meta_data ?? { source: 'api' },
    });
    const user = await TestUserRepository.getUserByUsername(username);
    res.json({
      success: true,
      message: `User ${username} saved with login_try = ${String(login_try)}`,
      user: {
        id: user?.id,
        username: user?.username,
        login_try: user?.login_try,
        status: user?.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Update User login_try Flag ───────────────────────────────────────────────
// Allows toggling login_try between 1 (include in cron) and 0 (skip in cron)
const handleUpdateLoginTry = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { login_try } = req.body;

  if (isNaN(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid userId parameter' });
  }

  if (login_try === undefined || login_try === null) {
    return res.status(400).json({ success: false, error: 'login_try field (1 or 0) is required in body' });
  }

  const numericLoginTry = Number(login_try) ? 1 : 0;

  try {
    const user = await TestUserRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: `User with ID ${userId} not found` });
    }

    await TestUserRepository.updateLoginTry(userId, numericLoginTry);
    const updated = await TestUserRepository.getUserById(userId);

    console.log(`[Server] Updated user ${updated.username} (ID: ${userId}) login_try to ${numericLoginTry}`);

    res.json({
      success: true,
      message: `User ${updated.username} login_try set to ${numericLoginTry}`,
      user: {
        id: updated.id,
        username: updated.username,
        login_try: updated.login_try,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('[Server] Failed to update login_try:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

app.patch('/api/users/:userId/login-try', handleUpdateLoginTry);
app.put('/api/users/:userId/login-try', handleUpdateLoginTry);
app.post('/api/users/:userId/login-try', handleUpdateLoginTry);
app.patch('/api/users/:userId', handleUpdateLoginTry);

// ── Direct Login & Detail Capture ───────────────────────────────────────────
// Authenticates user in Playwright, persists cookies, secret keys, localStorage,
// and session state into loggedin_details and returns full captured details
const handleDirectLogin = async (req, res) => {
  const {
    username,
    password,
    userId: inputUserId,
    login_try = 1,
    status = 'active',
    meta_data,
    forceFresh = true,
    headless,
  } = req.body;

  // Set generous socket timeouts for 3-minute 2FA OTP flow
  req.setTimeout(360000);
  res.setTimeout(360000);

  try {
    let targetUser;

    if (username && password) {
      // Upsert user into database first
      await TestUserRepository.upsertUser({
        username,
        password,
        login_try: Number(login_try),
        status,
        meta_data: meta_data ?? { source: 'addnewuser_form' },
      });
      targetUser = await TestUserRepository.getUserByUsername(username);
    } else if (inputUserId) {
      targetUser = await TestUserRepository.getUserById(Number(inputUserId));
    } else if (username) {
      targetUser = await TestUserRepository.getUserByUsername(username);
    }

    if (!targetUser) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required for login (or a valid existing userId/username)',
      });
    }

    console.log(`[Server] Authenticating and capturing session for ${targetUser.username} (ID: ${targetUser.id})...`);

    // Run Playwright authentication and detail capture
    const { userResult, details, secrets } = await MultiUserLoginCronService.loginAndCaptureUser(targetUser, {
      headless: headless !== undefined ? Boolean(headless) : undefined,
      forceFresh: Boolean(forceFresh),
    });

    const refreshedUser = await TestUserRepository.getUserById(targetUser.id);
    const statusCode = userResult.status === 'success' ? 200 : 400;

    return res.status(statusCode).json({
      success: userResult.status === 'success',
      message: userResult.status === 'success'
        ? `Authentication successful! Captured ${details.length} session items for ${targetUser.username}`
        : `Login failed: ${userResult.error || 'Authentication error or security challenge'}`,
      user: {
        id: refreshedUser?.id,
        username: refreshedUser?.username,
        status: refreshedUser?.status,
        last_login_at: refreshedUser?.last_login_at,
        last_login_status: refreshedUser?.last_login_status,
        login_count: refreshedUser?.login_count,
        has_saved_session: refreshedUser?.storage_state_json !== null,
      },
      summary: userResult,
      secrets,
      totalDetails: details.length,
      details,
    });
  } catch (error) {
    console.error('[Server] Login capture failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/login', handleDirectLogin);
app.post('/api/users/login', handleDirectLogin);

// ── Check Active 2FA/SMS Challenge ──────────────────────────────────────────
app.get('/api/login/challenge', (req, res) => {
  const username = req.query.username;
  const userId = req.query.userId ? parseInt(req.query.userId, 10) : undefined;
  const challenge = OtpChallengeService.getChallenge(username || userId || '');
  if (challenge && challenge.status === 'waiting_for_otp') {
    return res.json({
      active: true,
      username: challenge.username,
      userId: challenge.userId,
      status: challenge.status,
      requestedAt: challenge.requestedAt,
      expiresAt: challenge.expiresAt,
    });
  }
  res.json({ active: false });
});

// ── Submit OTP from UI ──────────────────────────────────────────────────────
app.post('/api/login/submit-otp', (req, res) => {
  const { username, userId, otp } = req.body;
  if (!otp || String(otp).trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Valid OTP code is required' });
  }

  const success = OtpChallengeService.submitOtp(username || userId || '', String(otp).trim());
  if (success) {
    console.log(`[Server] Submitted OTP for ${username || userId || 'pending user'} to browser runner`);
    return res.json({ success: true, message: 'OTP submitted to browser session' });
  } else {
    return res.status(404).json({ success: false, error: 'No active OTP challenge waiting or already submitted' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Automation Server running on http://localhost:${PORT}`);
  console.log(`⏰ Public Cron Route: http://localhost:${PORT}/cron/login`);
  console.log(`💻 Add User & Session Capture UI: http://localhost:${PORT}/addnewuser`);
});

server.timeout = 360000; // 6 minutes
server.keepAliveTimeout = 360000;
