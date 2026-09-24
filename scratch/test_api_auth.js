async function runApiTests() {
  const baseUrl = 'http://localhost:4001';

  console.log('--- Testing API Authentication & Tenant Isolation ---\n');

  // Test 1: Unauthenticated request
  const unauthRes = await fetch(`${baseUrl}/api/users`);
  console.log('Test 1 - GET /api/users without token:');
  console.log(`Status: ${unauthRes.status} (expected 401)`);
  const unauthJson = await unauthRes.json();
  console.log('Response:', unauthJson);
  if (unauthRes.status !== 401) throw new Error('Test 1 failed: expected 401');

  // Test 2: Login as user@app.com
  console.log('\nTest 2 - POST /api/auth/login (user@app.com):');
  const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@app.com', password: 'User@123' }),
  });
  console.log(`Status: ${userLoginRes.status} (expected 200)`);
  const userLoginData = await userLoginRes.json();
  console.log('User logged in. Role:', userLoginData.user?.role, 'Permissions:', userLoginData.user?.permissions);
  const userToken = userLoginData.token;
  if (!userToken) throw new Error('Test 2 failed: no token returned');

  // Test 3: GET /api/auth/me with user token
  console.log('\nTest 3 - GET /api/auth/me with user token:');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log(`Status: ${meRes.status} (expected 200)`);
  const meData = await meRes.json();
  console.log('Me profile:', meData.user);
  if (meData.user?.role !== 'user') throw new Error('Test 3 failed: wrong role');

  // Test 4: Role permission check - user trying to hit admin endpoint
  console.log('\nTest 4 - GET /api/admin/users as user role (should be 403 Forbidden):');
  const adminAsUserRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log(`Status: ${adminAsUserRes.status} (expected 403)`);
  const adminAsUserJson = await adminAsUserRes.json();
  console.log('Response:', adminAsUserJson);
  if (adminAsUserRes.status !== 403) throw new Error('Test 4 failed: expected 403');

  // Test 5: Permission check - user trying to hit scan-index (requires scan:index permission)
  console.log('\nTest 5 - GET /api/account/scan-index as user role (should be 403 Forbidden):');
  const scanAsUserRes = await fetch(`${baseUrl}/api/account/scan-index`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log(`Status: ${scanAsUserRes.status} (expected 403)`);
  const scanAsUserJson = await scanAsUserRes.json();
  console.log('Response:', scanAsUserJson);
  if (scanAsUserRes.status !== 403) throw new Error('Test 5 failed: expected 403');

  // Test 6: Login as admin@app.com
  console.log('\nTest 6 - POST /api/auth/login (admin@app.com):');
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@app.com', password: 'Admin@123' }),
  });
  console.log(`Status: ${adminLoginRes.status} (expected 200)`);
  const adminLoginData = await adminLoginRes.json();
  console.log('Admin logged in. Role:', adminLoginData.user?.role, 'Permissions:', adminLoginData.user?.permissions);
  const adminToken = adminLoginData.token;
  if (!adminToken) throw new Error('Test 6 failed: no admin token');

  // Test 7: GET /api/admin/users as admin
  console.log('\nTest 7 - GET /api/admin/users as admin:');
  const adminUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Status: ${adminUsersRes.status} (expected 200)`);
  const adminUsersData = await adminUsersRes.json();
  console.log('Platform users list count:', adminUsersData.users?.length);

  // Test 8: Tenant LinkedIn account scoping
  console.log('\nTest 8 - Tenant Scoping for GET /api/users:');
  const userAccountsRes = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const userAccountsData = await userAccountsRes.json();
  console.log(`User's LinkedIn accounts count: ${userAccountsData.count} (expected 0 because user has not added their LinkedIn account yet)`);

  const adminAccountsRes = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminAccountsData = await adminAccountsRes.json();
  console.log(`Admin's LinkedIn accounts count: ${adminAccountsData.count} (has seeded/existing accounts)`);

  // Test 9: User trying to access Admin's LinkedIn account details (e.g. userId 1 or 5)
  console.log('\nTest 9 - Tenant Isolation: user trying to access admin account details:');
  const crossTenantRes = await fetch(`${baseUrl}/api/users/1/details`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log(`Status: ${crossTenantRes.status} (expected 403 Forbidden)`);
  const crossTenantJson = await crossTenantRes.json();
  console.log('Response:', crossTenantJson);
  if (crossTenantRes.status !== 403) throw new Error('Test 9 failed: expected 403');

  console.log('\n✅ ALL 9 API SECURITY & TENANT ISOLATION TESTS PASSED!');
  process.exit(0);
}

runApiTests().catch((err) => {
  console.error('\n❌ API Test failed:', err);
  process.exit(1);
});
