import { TestUserRepository } from '../linkedin/src/db/repositories/TestUserRepository.js';
import { CompanySearchService } from '../linkedin/src/services/CompanySearchService.js';

async function main() {
  console.log('=== DEBUG COMPANY SEARCH ===');
  const user = await TestUserRepository.getActiveSessionUser();
  if (!user) {
    console.error('No active LinkedIn user session found in DB!');
    process.exit(1);
  }

  console.log(`Active user: ${user.username} (ID: ${user.id})`);
  console.log('Running search for "Digitar Media"...');

  const result = await CompanySearchService.searchCompanies({
    user,
    keyword: 'Digitar Media',
    headless: true,
    limit: 10,
  });

  console.log('\n--- SEARCH RESULT ---');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal debug error:', err);
  process.exit(1);
});
