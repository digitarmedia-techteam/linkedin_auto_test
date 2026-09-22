import { TestUserRepository } from '../linkedin/src/db/repositories/TestUserRepository.js';
import { AcceptedConnectionsService } from '../linkedin/src/services/AcceptedConnectionsService.js';
import { ConnectionTrackingRepository } from '../linkedin/src/db/repositories/ConnectionTrackingRepository.js';

async function testSecondContact() {
  const sender = await TestUserRepository.getActiveSessionUser();
  if (!sender) {
    console.error('No sender');
    process.exit(1);
  }

  console.log('Testing resolution for "Anaya K"...');
  const resolved = await AcceptedConnectionsService.resolveConnectionByName(sender, 'Anaya K', true);
  console.log('Resolved:', JSON.stringify(resolved, null, 2));

  await ConnectionTrackingRepository.initTable();
  const dbRows = await ConnectionTrackingRepository.findMatchingRows(sender.id, 'Anaya K');
  console.log('DB rows for Anaya K:', JSON.stringify(dbRows, null, 2));
  process.exit(0);
}

testSecondContact().catch(e => { console.error(e); process.exit(1); });
