import { AppUserRepository } from '../linkedin/src/db/repositories/AppUserRepository.js';

async function testAuth() {
  try {
    console.log('Initializing auth tables...');
    await AppUserRepository.initTables();
    console.log('Tables initialized successfully.');

    const users = await AppUserRepository.getAllUsers();
    console.log('Seeded platform users:', users);

    console.log('\nTesting validation for admin@app.com...');
    const admin = await AppUserRepository.validateCredentials('admin@app.com', 'Admin@123');
    console.log('Admin login result:', admin ? 'SUCCESS' : 'FAILED');

    if (admin) {
      const token = await AppUserRepository.createSession(admin.id);
      console.log('Created session token:', token);
      const sessionUser = await AppUserRepository.getSessionUser(token);
      console.log('Session user resolved:', sessionUser);
    }

    console.log('\nTesting wrong password...');
    const wrong = await AppUserRepository.validateCredentials('admin@app.com', 'WrongPass');
    console.log('Wrong pass result (should be null):', wrong);

    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testAuth();
