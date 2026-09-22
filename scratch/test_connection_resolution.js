import { TestUserRepository } from '../linkedin/src/db/repositories/TestUserRepository.js';
import { AcceptedConnectionsService } from '../linkedin/src/services/AcceptedConnectionsService.js';
import { MessagingService } from '../linkedin/src/services/MessagingService.js';
import { ConnectionTrackingRepository } from '../linkedin/src/db/repositories/ConnectionTrackingRepository.js';

async function testResolution() {
  console.log('--- TEST: DYNAMIC CONNECTION RESOLUTION & MESSAGING ---');

  const sender = await TestUserRepository.getActiveSessionUser();
  if (!sender) {
    console.error('No active session user found.');
    process.exit(1);
  }
  console.log(`Using active sender: ${sender.username} (ID: ${sender.id})`);

  // Step 1: Test searching & resolving connection on Connections page
  console.log('\n[Step 1] Resolving "Khushi K. Rathore" on Connections page...');
  const resolved = await AcceptedConnectionsService.resolveConnectionByName(sender, 'Khushi K. Rathore', true);
  console.log('Resolved Connection Result:', JSON.stringify(resolved, null, 2));

  if (resolved) {
    console.log('✓ Successfully resolved connection identity!');
    console.log(`  Name: ${resolved.name}`);
    console.log(`  Vanity: ${resolved.vanityName}`);
    console.log(`  Profile URL: ${resolved.profileUrl}`);
    console.log(`  Message URL: ${resolved.messageUrl}`);
    console.log(`  Recipient URN: ${resolved.recipientUrn}`);
  } else {
    console.warn('Could not resolve via typeahead search, proceeding to test fallback message dispatch...');
  }

  // Step 2: Test sending message to "Khushi K. Rathore" using only recipientName
  console.log('\n[Step 2] Sending message to "Khushi K. Rathore" using only recipientName...');
  const msgResult = await MessagingService.sendMessageToRecipient({
    user: sender,
    recipientName: 'Khushi K. Rathore',
    message: 'Hi, thank you for connecting!',
    headless: true,
  });

  console.log('\nSend Result:', JSON.stringify(msgResult, null, 2));
  if (msgResult.success) {
    console.log('🎉 TEST PASSED! Message successfully sent to Khushi K. Rathore!');
    console.log(`   Thread URL: ${msgResult.threadUrl}`);
    console.log(`   Thread ID: ${msgResult.threadId}`);
  } else {
    console.error('❌ Send failed:', msgResult.error);
  }

  // Step 3: Verify DB state
  console.log('\n[Step 3] Checking DB records for sender...');
  await ConnectionTrackingRepository.initTable();
  const dbRows = await ConnectionTrackingRepository.findMatchingRows(sender.id, 'Khushi K. Rathore');
  console.log('Matched DB Row:', JSON.stringify(dbRows, null, 2));

  process.exit(0);
}

testResolution().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
