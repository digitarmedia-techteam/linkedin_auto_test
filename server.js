import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MultiUserLoginCronService } from './linkedin/src/services/MultiUserLoginCronService.ts';
import { LoggedInDetailsRepository } from './linkedin/src/db/repositories/LoggedInDetailsRepository.ts';
import { TestUserRepository } from './linkedin/src/db/repositories/TestUserRepository.ts';
import { OtpChallengeService } from './linkedin/src/services/OtpChallengeService.ts';
import { DirectConnectionService, extractVanityName } from './linkedin/src/services/DirectConnectionService.ts';
import { SentInvitationsService } from './linkedin/src/services/SentInvitationsService.ts';
import { MessagingService, extractThreadId } from './linkedin/src/services/MessagingService.ts';
import { AcceptedConnectionsService } from './linkedin/src/services/AcceptedConnectionsService.ts';
import { ConnectionTrackingRepository } from './linkedin/src/db/repositories/ConnectionTrackingRepository.ts';
import { EventEmitter } from 'events';

dotenv.config();

const sseEmitter = new EventEmitter();

// Forward OTP challenge status updates to SSE clients
OtpChallengeService.on('status_update', (data) => {
  sseEmitter.emit('status', data);
});

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
      loginStream: 'GET /api/login/stream?username=... (SSE endpoint for real-time auth progress)',
      publicCron: 'GET /cron/login or POST /cron/login (supports optional ?userId=1)',
      userDetails: 'GET /api/users/:userId/details',
      usersList: 'GET /api/users',
      addUser: 'POST /api/users',
      readThread: 'POST /api/messages/thread/read (Reads thread messages, full details & attached document name)',
      sendReply: 'POST /api/messages/thread/reply (Sends a reply message to a LinkedIn thread)',
      detectAccepted: 'POST /api/connections/detect-accepted (Runs full 3-method detection of accepted connection requests)',
      snapshotSent: 'POST /api/connections/snapshot-sent (Snapshots current pending sent invitations to DB)',
      snapshotConnections: 'POST /api/connections/snapshot-connections (Snapshots current connections baseline to DB)',
      acceptedList: 'GET /api/connections/accepted (Queries accepted connections from DB)',
      pendingList: 'GET /api/connections/pending (Queries pending invitations from DB)',
      connectionHistory: 'GET /api/connections/history (Queries complete connection tracking history and stats)',
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
      users: users.map((u) => {
        let cookiesCount = 0;
        if (u.storage_state_json) {
          try {
            const parsed = JSON.parse(u.storage_state_json);
            cookiesCount = parsed.cookies ? parsed.cookies.length : 0;
          } catch {
            cookiesCount = 0;
          }
        } else if (u.session_cookies_json) {
          try {
            const parsed = JSON.parse(u.session_cookies_json);
            cookiesCount = Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            cookiesCount = 0;
          }
        }
        return {
          id: u.id,
          username: u.username,
          login_try: u.login_try,
          status: u.status,
          last_login_at: u.last_login_at,
          last_login_status: u.last_login_status,
          login_count: u.login_count,
          has_saved_session: Boolean(u.storage_state_json || u.session_cookies_json),
          session_cookies_count: cookiesCount,
          cookies_count: cookiesCount,
          meta_data: u.meta_data,
        };
      }),
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

// ── Check Active Session & Auto-Login Status ────────────────────────────────
app.get('/api/session/check', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : undefined;
    const username = req.query.username;
    const deepCheck = req.query.deep === 'true';

    let user = null;
    if (userId) {
      user = await TestUserRepository.getUserById(userId);
    } else if (username) {
      user = await TestUserRepository.getUserByUsername(username);
    } else {
      user = await TestUserRepository.getActiveSessionUser();
    }

    if (!user || !user.storage_state_json) {
      return res.json({
        hasSession: false,
        isValid: false,
        reason: 'no_stored_session',
      });
    }

    const validation = await MultiUserLoginCronService.validateUserSession(user, {
      deepCheck,
    });

    res.json({
      hasSession: true,
      isValid: validation.isValid,
      reason: validation.reason,
      user: {
        id: user.id,
        username: user.username,
        status: user.status,
        last_login_at: user.last_login_at,
        last_login_status: user.last_login_status,
        login_count: user.login_count,
        has_saved_session: true,
      },
      session: validation.sessionMeta,
    });
  } catch (error) {
    console.error('[Server] Session check error:', error);
    res.status(500).json({ hasSession: false, isValid: false, error: error.message });
  }
});

// ── Explicit Logout (Clear Stored Session) ───────────────────────────────────
app.post('/api/session/logout', async (req, res) => {
  try {
    const { userId, username } = req.body;
    let targetUser = null;
    if (userId) {
      targetUser = await TestUserRepository.getUserById(parseInt(userId, 10));
    } else if (username) {
      targetUser = await TestUserRepository.getUserByUsername(username);
    } else {
      targetUser = await TestUserRepository.getActiveSessionUser();
    }

    if (!targetUser) {
      return res.json({ success: true, message: 'No active session to clear' });
    }

    await TestUserRepository.clearUserSession(targetUser.id);
    console.log(`[Server] Cleared session in DB for user ${targetUser.username} (ID: ${targetUser.id})`);

    res.json({
      success: true,
      message: `Session cleared for ${targetUser.username}. Next visit will require login.`,
    });
  } catch (error) {
    console.error('[Server] Logout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Restore Stored Session to Feed ──────────────────────────────────────────
app.post('/api/session/restore', async (req, res) => {
  try {
    const { userId, username } = req.body;
    let targetUser = null;
    if (userId) {
      targetUser = await TestUserRepository.getUserById(parseInt(userId, 10));
    } else if (username) {
      targetUser = await TestUserRepository.getUserByUsername(username);
    } else {
      targetUser = await TestUserRepository.getActiveSessionUser();
    }

    if (!targetUser || !targetUser.storage_state_json) {
      return res.status(404).json({
        success: false,
        error: 'No saved session found for this user. Please log in first.',
      });
    }

    const validation = await MultiUserLoginCronService.validateUserSession(targetUser, {
      deepCheck: false,
    });

    if (!validation.isValid) {
      return res.status(401).json({
        success: false,
        error: `Stored session is invalid or expired (${validation.reason || 'expired'}). Please log in again.`,
      });
    }

    const details = await LoggedInDetailsRepository.getDetailsByUserId(targetUser.id);
    const secrets = await LoggedInDetailsRepository.getSecretTokens(targetUser.id);

    res.json({
      success: true,
      message: `Session restored for ${targetUser.username}`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        status: targetUser.status,
        last_login_at: targetUser.last_login_at,
        last_login_status: targetUser.last_login_status,
        login_count: targetUser.login_count,
        has_saved_session: true,
      },
      session: validation.sessionMeta,
      totalDetails: details.length,
      details,
      secrets,
    });
  } catch (error) {
    console.error('[Server] Session restore error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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

    // If not forcing fresh login and user has a saved session, validate it first
    if (!forceFresh && targetUser.storage_state_json) {
      console.log(`[Server] Checking existing session for ${targetUser.username}...`);
      sseEmitter.emit('status', { username: targetUser.username, status: 'authenticating', message: 'Checking existing saved session...' });
      const validation = await MultiUserLoginCronService.validateUserSession(targetUser, {
        deepCheck: true,
        headless: headless !== undefined ? Boolean(headless) : undefined,
      });

      if (validation.isValid) {
        console.log(`[Server] Existing session is valid for ${targetUser.username}! Skipping login.`);
        sseEmitter.emit('status', { username: targetUser.username, status: 'success', message: 'Existing session valid! Skipped login.' });
        const details = await LoggedInDetailsRepository.getDetailsByUserId(targetUser.id);
        const secrets = await LoggedInDetailsRepository.getSecretTokens(targetUser.id);
        return res.json({
          success: true,
          reusedExistingSession: true,
          message: `Existing session valid for ${targetUser.username}. Logged in directly to feed!`,
          user: {
            id: targetUser.id,
            username: targetUser.username,
            status: targetUser.status,
            last_login_at: targetUser.last_login_at,
            last_login_status: 'success',
            login_count: targetUser.login_count,
            has_saved_session: true,
          },
          summary: {
            userId: targetUser.id,
            username: targetUser.username,
            status: 'success',
            loginType: 'reused_existing_session',
          },
          secrets,
          totalDetails: details.length,
          details,
        });
      } else {
        console.log(`[Server] Stored session invalid (${validation.reason}). Proceeding to fresh login.`);
        sseEmitter.emit('status', { username: targetUser.username, status: 'authenticating', message: 'Stored session expired. Performing fresh login...' });
      }
    }

    console.log(`[Server] Authenticating and capturing session for ${targetUser.username} (ID: ${targetUser.id})...`);
    sseEmitter.emit('status', { username: targetUser.username, status: 'authenticating', message: 'Starting headless browser...' });

    // Run Playwright authentication and detail capture
    const { userResult, details, secrets } = await MultiUserLoginCronService.loginAndCaptureUser(targetUser, {
      headless: headless !== undefined ? Boolean(headless) : undefined,
      forceFresh: Boolean(forceFresh),
    });

    const refreshedUser = await TestUserRepository.getUserById(targetUser.id);
    const statusCode = userResult.status === 'success' ? 200 : 400;

    if (userResult.status === 'success') {
      sseEmitter.emit('status', { username: targetUser.username, status: 'success', message: 'Authentication successful!' });
    } else {
      sseEmitter.emit('status', { username: targetUser.username, status: 'failed', message: userResult.error || 'Login failed' });
    }

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
    if (req.body.username) {
      sseEmitter.emit('status', { username: req.body.username, status: 'failed', message: error.message });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/login', handleDirectLogin);
app.post('/api/users/login', handleDirectLogin);

// ── SSE Stream for Real-Time Authentication Status ───────────────────────────
app.get('/api/login/stream', (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).end('username query parameter is required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onStatus = (data) => {
    if (data.username === username) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  sseEmitter.on('status', onStatus);

  req.on('close', () => {
    sseEmitter.off('status', onStatus);
  });
});

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

// ── Check Live LinkedIn Connection Status (Pre-Flight Verifier) ────────────
const handleCheckConnectionStatus = async (req, res) => {
  const targetUrl = (req.body?.targetUrl || req.body?.targetUrlOrVanity || req.query?.targetUrl || req.query?.targetUrlOrVanity || req.query?.url || '').trim();
  const { sender, username } = await resolveSenderUser(req);
  const headless = req.body?.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      error: 'targetUrl parameter is required (LinkedIn profile URL or vanity username)',
    });
  }

  const vanityName = extractVanityName(targetUrl);
  if (!vanityName) {
    return res.status(400).json({
      success: false,
      error: 'Could not parse a valid vanity username from targetUrl',
    });
  }

  if (!sender) {
    return res.status(404).json({
      success: false,
      error: username
        ? `Sender account "${username}" was not found in database.`
        : 'No active sender session found. Please log in first.',
    });
  }

  try {
    console.log(`[Server] Checking connection status for "${vanityName}" using sender "${sender.username}"...`);
    const result = await DirectConnectionService.checkConnectionStatus({
      user: sender,
      targetUrlOrVanity: targetUrl,
      headless,
    });

    // Auto-update connection tracking in MySQL if already connected or pending
    if (result.status === 'already_connected') {
      try {
        await ConnectionTrackingRepository.markAsAccepted({
          senderUserId: sender.id,
          recipientName: result.recipientName || vanityName,
          recipientVanity: vanityName,
          recipientProfileUrl: result.profileUrl,
          recipientHeadline: result.recipientHeadline,
          detectedVia: 'profile_check',
        });
      } catch (dbErr) {
        console.warn('[Server] Could not update already_connected status in connection_tracking:', dbErr);
      }
    } else if (result.status === 'already_pending') {
      try {
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: sender.id,
          recipient_name: result.recipientName || vanityName,
          recipient_vanity_name: vanityName,
          recipient_profile_url: result.profileUrl,
          recipient_headline: result.recipientHeadline,
          status: 'pending',
          detected_via: 'profile_check',
        });
      } catch (dbErr) {
        console.warn('[Server] Could not update pending status in connection_tracking:', dbErr);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('[Server] Check connection status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/connect/check-status', handleCheckConnectionStatus);
app.get('/api/connect/check-status', handleCheckConnectionStatus);
app.post('/api/connect/status', handleCheckConnectionStatus);
app.get('/api/connect/status', handleCheckConnectionStatus);

// ── Send Direct LinkedIn Connection Invite ──────────────────────────────────
app.post('/api/connect/invite', async (req, res) => {
  const targetUrl = (req.body.targetUrl || req.body.targetUrlOrVanity || '').trim();
  const username = (req.body.username || req.body.senderUsername || '').trim();
  const userId = req.body.userId;
  const note = req.body.note;
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      error: 'targetUrl parameter is required (LinkedIn profile URL or vanity username)',
    });
  }

  const vanityName = extractVanityName(targetUrl);
  if (!vanityName) {
    return res.status(400).json({
      success: false,
      error: 'Could not parse a valid vanity username from targetUrl',
    });
  }

  try {
    let sender = null;
    if (userId) {
      sender = await TestUserRepository.getUserById(parseInt(userId, 10));
    } else if (username) {
      sender = await TestUserRepository.getUserByUsername(username);
    } else {
      sender = await TestUserRepository.getActiveSessionUser();
    }

    if (!sender) {
      return res.status(404).json({
        success: false,
        reason: 'SENDER_NOT_FOUND',
        error: username
          ? `Sender account "${username}" was not found in the database. Please check registered accounts.`
          : 'No sender account selected or found with an active session. Please log in first.',
      });
    }

    if (!sender.storage_state_json && !sender.session_cookies_json) {
      return res.status(400).json({
        success: false,
        reason: 'NO_SESSION_STORED',
        error: `Selected sender "${sender.username}" does not have an active saved session. Please log in first.`,
      });
    }

    console.log(`[Server] Initiating connection flow for "${vanityName}" using sender "${sender.username}"...`);
    sseEmitter.emit('status', {
      username: sender.username,
      status: 'connecting',
      message: `Verifying connection status for ${vanityName}...`,
    });

    const result = await DirectConnectionService.sendConnectionInvite({
      user: sender,
      targetUrlOrVanity: targetUrl,
      note: typeof note === 'string' ? note.trim() : undefined,
      headless: headless !== undefined ? Boolean(headless) : undefined,
    });

    if (result.status === 'sent') {
      try {
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: sender.id,
          recipient_name: (result.recipientName || req.body.recipientName || vanityName).trim(),
          recipient_vanity_name: vanityName,
          recipient_profile_url: `https://www.linkedin.com/in/${vanityName}/`,
          recipient_headline: result.recipientHeadline || null,
          status: 'pending',
          invite_sent_at: new Date(),
          detected_via: 'invite_api',
          note_sent: typeof note === 'string' ? note.trim() : null,
        });
      } catch (dbErr) {
        console.warn('[Server] Could not auto-record sent invite in connection_tracking:', dbErr);
      }
      return res.status(200).json(result);
    } else if (result.status === 'already_connected') {
      try {
        await ConnectionTrackingRepository.markAsAccepted({
          senderUserId: sender.id,
          recipientName: (result.recipientName || req.body.recipientName || vanityName).trim(),
          recipientVanity: vanityName,
          recipientProfileUrl: `https://www.linkedin.com/in/${vanityName}/`,
          recipientHeadline: result.recipientHeadline || null,
          detectedVia: 'profile_check',
        });
      } catch (dbErr) {
        console.warn('[Server] Could not update already_connected in connection_tracking:', dbErr);
      }
      return res.status(200).json(result);
    } else if (result.status === 'already_pending') {
      try {
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: sender.id,
          recipient_name: (result.recipientName || req.body.recipientName || vanityName).trim(),
          recipient_vanity_name: vanityName,
          recipient_profile_url: `https://www.linkedin.com/in/${vanityName}/`,
          recipient_headline: result.recipientHeadline || null,
          status: 'pending',
          detected_via: 'profile_check',
        });
      } catch (dbErr) {
        console.warn('[Server] Could not update pending in connection_tracking:', dbErr);
      }
      return res.status(200).json(result);
    }

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('[Server] Connection invite error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// ── Check Today's Sent Invitations ──────────────────────────────────────────
app.post('/api/connect/sent-today', async (req, res) => {
  const username = (req.body.username || req.body.senderUsername || '').trim();
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  try {
    let sender = null;
    if (username) {
      sender = await TestUserRepository.getUserByUsername(username);
    } else {
      sender = await TestUserRepository.getActiveSessionUser();
    }

    if (!sender) {
      return res.status(404).json({
        success: false,
        reason: 'SENDER_NOT_FOUND',
        error: username
          ? `Sender account "${username}" was not found in the database. Please check registered accounts.`
          : 'No sender account selected or found with an active session. Please log in first.',
      });
    }

    if (!sender.storage_state_json && !sender.session_cookies_json) {
      return res.status(400).json({
        success: false,
        reason: 'NO_SESSION_STORED',
        error: `Selected sender "${sender.username}" does not have an active saved session. Please log in first.`,
      });
    }

    console.log(`[Server] Checking today's sent invitations for "${sender.username}"...`);

    const result = await SentInvitationsService.checkTodaySentInvites(sender, headless);

    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('[Server] Check sent invites error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ── Read LinkedIn Messaging Thread & Last Message ──────────────────────────
const handleReadThread = async (req, res) => {
  const threadUrl = (req.body.threadUrl || req.body.threadUrlOrId || req.body.url || '').trim();
  const username = (req.body.username || req.body.senderUsername || '').trim();
  const userId = req.body.userId;
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!threadUrl || !extractThreadId(threadUrl)) {
    return res.status(200).json({
      success: true,
      threadId: '',
      threadUrl: threadUrl || '',
      allMessages: [],
      messages: [],
      isNewThread: true,
    });
  }

  try {
    let sender = null;
    if (userId) {
      sender = await TestUserRepository.getUserById(parseInt(userId, 10));
    } else if (username) {
      sender = await TestUserRepository.getUserByUsername(username);
    } else {
      sender = await TestUserRepository.getActiveSessionUser();
    }

    if (!sender) {
      return res.status(404).json({
        success: false,
        error: username
          ? `Sender account "${username}" was not found in the database.`
          : 'No sender account found with an active session. Please log in first.',
      });
    }

    if (!sender.storage_state_json && !sender.session_cookies_json) {
      return res.status(400).json({
        success: false,
        error: `Selected account "${sender.username}" does not have an active saved session. Please log in first.`,
      });
    }

    console.log(`[Server] Reading messaging thread "${threadUrl}" using account "${sender.username}"...`);

    const result = await MessagingService.readThread({
      user: sender,
      threadUrlOrId: threadUrl,
      headless,
    });

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('[Server] Read thread error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/messages/thread/read', handleReadThread);
app.post('/api/messages/read', handleReadThread);

// ── Send Message / Reply to LinkedIn Recipient or Thread ───────────────────
const handleSendReply = async (req, res) => {
  let threadUrl = (req.body.threadUrl || req.body.threadUrlOrId || req.body.url || '').trim();
  let recipientVanity = (req.body.recipientVanity || req.body.vanity || req.body.vanityName || '').trim();
  let recipientProfileUrl = (req.body.recipientProfileUrl || req.body.profileUrl || '').trim();
  let recipientName = (req.body.recipientName || req.body.name || '').trim();
  const message = (req.body.message || req.body.replyText || req.body.text || '').trim();
  const username = (req.body.username || req.body.senderUsername || '').trim();
  const userId = req.body.userId;
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'message text is required.',
    });
  }

  // Sanitize threadUrl: discard compose URLs or non-thread URLs
  if (threadUrl && !extractThreadId(threadUrl)) {
    threadUrl = '';
  }

  try {
    let sender = null;
    if (userId) {
      sender = await TestUserRepository.getUserById(parseInt(userId, 10));
    } else if (username) {
      sender = await TestUserRepository.getUserByUsername(username);
    } else {
      sender = await TestUserRepository.getActiveSessionUser();
    }

    if (!sender) {
      return res.status(404).json({
        success: false,
        error: username
          ? `Sender account "${username}" was not found in the database.`
          : 'No sender account found with an active session. Please log in first.',
      });
    }

    if (!sender.storage_state_json && !sender.session_cookies_json) {
      return res.status(400).json({
        success: false,
        error: `Selected account "${sender.username}" does not have an active saved session. Please log in first.`,
      });
    }

    // Auto-resolve missing recipient identifiers from database or vanity strings
    if (!threadUrl || !recipientVanity || !recipientProfileUrl || !recipientName) {
      try {
        await ConnectionTrackingRepository.initTable();
        const existingRows = await ConnectionTrackingRepository.findBySender(sender.id);
        const match = existingRows.find(
          (r) =>
            (recipientName && r.recipient_name && r.recipient_name.toLowerCase().trim() === recipientName.toLowerCase().trim()) ||
            (recipientVanity && r.recipient_vanity_name && r.recipient_vanity_name.toLowerCase().trim() === recipientVanity.toLowerCase().trim()) ||
            (recipientProfileUrl && r.recipient_profile_url && r.recipient_profile_url.toLowerCase().trim() === recipientProfileUrl.toLowerCase().trim())
        );
        if (match) {
          if (!recipientVanity && match.recipient_vanity_name) recipientVanity = match.recipient_vanity_name;
          if (!recipientProfileUrl && match.recipient_profile_url) recipientProfileUrl = match.recipient_profile_url;
          if (!recipientName && match.recipient_name) recipientName = match.recipient_name;
          if (!threadUrl) {
            const rawThreadUrl = match.meta_data?.threadUrl || match.meta_data?.messageUrl || '';
            if (rawThreadUrl && extractThreadId(rawThreadUrl)) {
              threadUrl = rawThreadUrl;
            }
          }
        }
      } catch (dbErr) {
        console.warn('[Server] Could not lookup recipient in ConnectionTrackingRepository:', dbErr);
      }

      if (!recipientVanity && recipientProfileUrl) {
        recipientVanity = extractVanityName(recipientProfileUrl) || '';
      }
      if (!recipientProfileUrl && recipientVanity) {
        recipientProfileUrl = `https://www.linkedin.com/in/${encodeURIComponent(recipientVanity)}/`;
      }
      if (!recipientVanity && !recipientProfileUrl && recipientName && /^[a-zA-Z0-9_%-]+$/.test(recipientName) && (recipientName.includes('-') || recipientName.includes('_'))) {
        recipientVanity = extractVanityName(recipientName) || recipientName;
        recipientProfileUrl = `https://www.linkedin.com/in/${encodeURIComponent(recipientVanity)}/`;
      }
    }

    if (!threadUrl && !recipientVanity && !recipientProfileUrl && !recipientName) {
      return res.status(400).json({
        success: false,
        error: 'Either recipientName, threadUrl, recipientVanity, or recipientProfileUrl is required to send a message.',
      });
    }

    console.log(`[Server] Sending message to ${recipientName || threadUrl || recipientVanity || recipientProfileUrl} using account "${sender.username}"...`);

    const result = await MessagingService.sendMessageToRecipient({
      user: sender,
      threadUrlOrId: threadUrl,
      recipientVanity,
      recipientProfileUrl,
      recipientName,
      message,
      headless,
    });

    if (result.success) {
      try {
        const cleanVanity = recipientVanity ? extractVanityName(recipientVanity) : (recipientProfileUrl ? extractVanityName(recipientProfileUrl) : null);
        const nameToSave = (result.recipientName || recipientName || cleanVanity || 'LinkedIn Contact').trim();
        await ConnectionTrackingRepository.initTable();
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: sender.id,
          recipient_name: nameToSave,
          recipient_vanity_name: cleanVanity || null,
          recipient_profile_url: recipientProfileUrl || (cleanVanity ? `https://www.linkedin.com/in/${cleanVanity}/` : null),
          status: 'accepted',
          accepted_at: new Date(),
          detected_via: 'message_send',
          meta_data: {
            threadUrl: result.threadUrl,
            threadId: result.threadId,
            lastSentMessage: message,
            lastMessageSentAt: new Date().toISOString(),
          },
        });
      } catch (dbErr) {
        console.warn('[Server] Could not update connection_tracking after sending message:', dbErr);
      }
    }

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('[Server] Send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/messages/thread/reply', handleSendReply);
app.post('/api/messages/reply', handleSendReply);
app.post('/api/messages/send', handleSendReply);

// ── Dynamic Connection Identity Resolver ────────────────────────────────────
const handleResolveConnection = async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  const targetName = (req.body.name || req.body.recipientName || req.query.name || '').trim();
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found with active session.' });
  }
  if (!targetName) {
    return res.status(400).json({ success: false, error: 'Target connection name is required.' });
  }

  try {
    console.log(`[Server] Resolving connection identity for "${targetName}" using account "${sender.username}"...`);
    const resolved = await AcceptedConnectionsService.resolveConnectionByName(sender, targetName, headless);
    if (resolved) {
      res.status(200).json({ success: true, connection: resolved });
    } else {
      res.status(404).json({ success: false, error: `Could not find connection matching "${targetName}" on LinkedIn.` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

app.post('/api/connections/resolve', handleResolveConnection);
app.get('/api/connections/resolve', handleResolveConnection);

// ── Track & Process Recent Conversations Dynamically ───────────────────────
const handleTrackConversations = async (req, res) => {
  const username = (req.body.username || req.body.senderUsername || '').trim();
  const userId = req.body.userId;
  const limit = req.body.limit ? parseInt(req.body.limit, 10) : 10;
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  try {
    let sender = null;
    if (userId) {
      sender = await TestUserRepository.getUserById(parseInt(userId, 10));
    } else if (username) {
      sender = await TestUserRepository.getUserByUsername(username);
    } else {
      sender = await TestUserRepository.getActiveSessionUser();
    }

    if (!sender) {
      return res.status(404).json({
        success: false,
        error: username
          ? `Sender account "${username}" was not found in the database.`
          : 'No sender account found with an active session. Please log in first.',
      });
    }

    if (!sender.storage_state_json && !sender.session_cookies_json) {
      return res.status(400).json({
        success: false,
        error: `Selected account "${sender.username}" does not have an active saved session. Please log in first.`,
      });
    }

    console.log(`[Server] Dynamically tracking top ${limit} conversations for "${sender.username}"...`);

    const result = await MessagingService.trackAndProcessRecentConversations({
      user: sender,
      limit,
      headless,
    });

    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('[Server] Track conversations error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/messages/conversations/recent', handleTrackConversations);
app.post('/api/messages/recent', handleTrackConversations);
app.get('/api/messages/conversations/recent', handleTrackConversations);

// ── Unified Account Scan & Index Endpoint ───────────────────────────────────
const handleScanAndIndex = async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const headless = req.body?.headless !== undefined ? Boolean(req.body.headless) : true;
  const limit = req.body?.limit ? parseInt(req.body.limit, 10) : 10;

  if (!sender) {
    return res.status(404).json({
      success: false,
      error: username
        ? `Sender account "${username}" was not found in the database.`
        : 'No sender account found with an active session. Please log in first.',
    });
  }

  if (!sender.storage_state_json && !sender.session_cookies_json) {
    return res.status(400).json({
      success: false,
      error: `Selected account "${sender.username}" does not have an active saved session. Please log in first.`,
    });
  }

  try {
    console.log(`[Server] Running unified Scan & Index for "${sender.username}" (Today's connections + Top 10 chats)...`);

    // 1. Scan connections accepted today
    const connectionsResult = await AcceptedConnectionsService.detectAcceptedTodayFromConnectionsPage(sender, {
      headless,
      limit: 60,
    });

    // 2. Scan top 10 latest conversations
    const conversationsResult = await MessagingService.trackAndProcessRecentConversations({
      user: sender,
      limit: Math.max(limit, 10),
      headless,
    });

    res.status(200).json({
      success: true,
      senderUsername: sender.username,
      senderUserId: sender.id,
      timestamp: new Date().toISOString(),
      connections: connectionsResult,
      conversations: conversationsResult,
      message: `Scan & Index complete: ${connectionsResult.acceptedTodayCount || 0} connection(s) accepted today, ${conversationsResult.totalTracked || 0} conversation(s) indexed.`,
    });
  } catch (error) {
    console.error('[Server] Scan and Index error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/account/scan-index', handleScanAndIndex);
app.post('/api/connections/scan-index', handleScanAndIndex);
app.get('/api/account/scan-index', handleScanAndIndex);

// ── Client-side In-Browser Tracker Script ────────────────────────────────────
app.get('/api/messages/conversations/tracker-script', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(MessagingService.getClientSideObserverCode());
});

// ── Helper to Resolve Sender User ───────────────────────────────────────────
async function resolveSenderUser(req) {
  const userId = req.body?.userId || req.query?.userId;
  const username = (req.body?.username || req.body?.senderUsername || req.query?.username || req.query?.senderUsername || '').trim();

  let sender = null;
  if (userId) {
    sender = await TestUserRepository.getUserById(parseInt(userId, 10));
  } else if (username) {
    sender = await TestUserRepository.getUserByUsername(username);
  } else {
    sender = await TestUserRepository.getActiveSessionUser();
  }

  return { sender, username };
}

// ── Detect Accepted Connections (Full 3-Method Orchestration) ───────────────
const handleDetectAccepted = async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;
  const connectionsLimit = req.body.limit ? parseInt(req.body.limit, 10) : 30;

  if (!sender) {
    return res.status(404).json({
      success: false,
      error: username
        ? `Sender account "${username}" was not found in the database.`
        : 'No sender account found with an active session. Please log in first.',
    });
  }

  if (!sender.storage_state_json && !sender.session_cookies_json) {
    return res.status(400).json({
      success: false,
      error: `Selected account "${sender.username}" does not have an active saved session. Please log in first.`,
    });
  }

  try {
    console.log(`[Server] Running full accepted connection detection for "${sender.username}"...`);
    const result = await AcceptedConnectionsService.runFullDetection(sender, {
      headless,
      connectionsLimit,
    });

    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('[Server] Detect accepted connections error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/connections/detect-accepted', handleDetectAccepted);
app.post('/api/connections/detect', handleDetectAccepted);

// ── Detect Connections Accepted Today from /mynetwork/invite-connect/connections/ ──
const handleDetectAcceptedToday = async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const limit = req.body?.limit ? parseInt(req.body.limit, 10) : (req.query?.limit ? parseInt(req.query.limit, 10) : 60);
  const headless = req.body?.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({
      success: false,
      error: username
        ? `Sender account "${username}" was not found in database.`
        : 'No active sender session found. Please log in first.',
    });
  }

  if (!sender.storage_state_json && !sender.session_cookies_json) {
    return res.status(400).json({
      success: false,
      error: `Selected account "${sender.username}" does not have an active saved session. Please log in first.`,
    });
  }

  try {
    console.log(`[Server] Detecting connections accepted today for "${sender.username}" from /mynetwork/invite-connect/connections/...`);
    const result = await AcceptedConnectionsService.detectAcceptedTodayFromConnectionsPage(sender, {
      headless,
      limit,
    });

    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('[Server] Detect connections accepted today error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

app.post('/api/connections/detect-accepted-today', handleDetectAcceptedToday);
app.post('/api/connections/connections-today', handleDetectAcceptedToday);
app.get('/api/connections/detect-accepted-today', handleDetectAcceptedToday);

// ── Method 1: Detect from Notifications Only ─────────────────────────────────
app.post('/api/connections/detect/notifications', async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    console.log(`[Server] Detecting from notifications for "${sender.username}"...`);
    const result = await AcceptedConnectionsService.detectFromNotifications(sender, headless);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Method 2: Detect from Sent Invitations Diff ─────────────────────────────
app.post('/api/connections/detect/sent-diff', async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    console.log(`[Server] Detecting from sent invitations diff for "${sender.username}"...`);
    const result = await AcceptedConnectionsService.detectFromSentInvitationsDiff(sender, headless);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Method 3: Detect from Connections Diff ──────────────────────────────────
app.post('/api/connections/detect/connections-diff', async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const limit = req.body.limit ? parseInt(req.body.limit, 10) : 30;
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    console.log(`[Server] Detecting from connections list diff for "${sender.username}"...`);
    const result = await AcceptedConnectionsService.detectFromConnectionsDiff(sender, limit, headless);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Snapshot Sent Invitations ────────────────────────────────────────────────
app.post('/api/connections/snapshot-sent', async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    console.log(`[Server] Snapshotting sent invitations for "${sender.username}"...`);
    const result = await AcceptedConnectionsService.snapshotSentInvitations(sender, headless);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Snapshot Connections List ────────────────────────────────────────────────
app.post('/api/connections/snapshot-connections', async (req, res) => {
  const { sender, username } = await resolveSenderUser(req);
  const limit = req.body.limit ? parseInt(req.body.limit, 10) : 50;
  const headless = req.body.headless !== undefined ? Boolean(req.body.headless) : true;

  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    console.log(`[Server] Snapshotting connections list for "${sender.username}"...`);
    const result = await AcceptedConnectionsService.snapshotCurrentConnections(sender, limit, headless);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Query Accepted Contacts from DB (No Browser) ────────────────────────────
app.get('/api/connections/accepted', async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    await ConnectionTrackingRepository.initTable();
    const since = req.query.since ? new Date(req.query.since) : undefined;
    const accepted = await ConnectionTrackingRepository.getAcceptedContacts(sender.id, since);
    const stats = await ConnectionTrackingRepository.getStats(sender.id);

    res.json({
      success: true,
      senderUsername: sender.username,
      senderUserId: sender.id,
      count: accepted.length,
      stats,
      accepted,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Query Accepted Contacts Today from DB (No Browser) ──────────────────────
app.get('/api/connections/accepted-today', async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    await ConnectionTrackingRepository.initTable();
    const acceptedToday = await ConnectionTrackingRepository.getAcceptedTodayContacts(sender.id);
    const stats = await ConnectionTrackingRepository.getStats(sender.id);

    res.json({
      success: true,
      senderUsername: sender.username,
      senderUserId: sender.id,
      count: acceptedToday.length,
      stats,
      acceptedToday,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Query Pending Contacts from DB (No Browser) ─────────────────────────────
app.get('/api/connections/pending', async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    await ConnectionTrackingRepository.initTable();
    const pending = await ConnectionTrackingRepository.getPendingContacts(sender.id);
    const stats = await ConnectionTrackingRepository.getStats(sender.id);

    res.json({
      success: true,
      senderUsername: sender.username,
      senderUserId: sender.id,
      count: pending.length,
      stats,
      pending,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Query Complete Tracking History & Stats from DB ─────────────────────────
app.get(['/api/connections/history', '/api/connections/all'], async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    await ConnectionTrackingRepository.initTable();
    const contacts = await ConnectionTrackingRepository.getAllContacts(sender.id);
    const stats = await ConnectionTrackingRepository.getStats(sender.id);

    res.json({
      success: true,
      senderUsername: sender.username,
      senderUserId: sender.id,
      total: contacts.length,
      stats,
      contacts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Query Tracking Stats Only ────────────────────────────────────────────────
app.get('/api/connections/stats', async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  try {
    await ConnectionTrackingRepository.initTable();
    const stats = await ConnectionTrackingRepository.getStats(sender.id);
    res.json({
      success: true,
      senderUsername: sender.username,
      senderUserId: sender.id,
      stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Manually Track / Update a Contact ────────────────────────────────────────
app.post('/api/connections/track', async (req, res) => {
  const { sender } = await resolveSenderUser(req);
  if (!sender) {
    return res.status(404).json({ success: false, error: 'Sender account not found.' });
  }

  const { recipientName, recipientVanity, recipientProfileUrl, recipientHeadline, status, note } = req.body;
  if (!recipientName && !recipientVanity) {
    return res.status(400).json({ success: false, error: 'recipientName or recipientVanity is required.' });
  }

  try {
    await ConnectionTrackingRepository.initTable();
    const contact = await ConnectionTrackingRepository.upsertContact({
      sender_user_id: sender.id,
      recipient_name: (recipientName || recipientVanity).trim(),
      recipient_vanity_name: recipientVanity ? extractVanityName(recipientVanity) : null,
      recipient_profile_url: recipientProfileUrl || (recipientVanity ? `https://www.linkedin.com/in/${extractVanityName(recipientVanity)}/` : null),
      recipient_headline: recipientHeadline || null,
      status: status || 'pending',
      invite_sent_at: status === 'pending' ? new Date() : null,
      accepted_at: status === 'accepted' ? new Date() : null,
      detected_via: 'manual',
      note_sent: note || null,
    });

    res.json({ success: true, contact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


const server = app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Automation Server running on http://localhost:${PORT}`);
  console.log(`⏰ Public Cron Route: http://localhost:${PORT}/cron/login`);
  console.log(`💻 Add User & Session Capture UI: http://localhost:${PORT}/addnewuser`);
});

server.timeout = 360000; // 6 minutes
server.keepAliveTimeout = 360000;
