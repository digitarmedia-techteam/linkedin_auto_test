import { TestUserRepository } from '../linkedin/src/db/repositories/TestUserRepository.js';
import { CompanyPeopleSearchService } from '../linkedin/src/services/CompanyPeopleSearchService.js';

async function main() {
  console.log('=== TEST PEOPLE SEARCH IN COMPANY ===');
  const user = await TestUserRepository.getActiveSessionUser();
  if (!user) {
    console.error('No active LinkedIn session user found in DB!');
    process.exit(1);
  }

  console.log(`Active user: ${user.username} (ID: ${user.id})`);
  console.log('Searching for people at Digitar Media (Company ID: 67952029, keywords: "Account Manager Prerna")...');

  const result = await CompanyPeopleSearchService.searchPeopleInCompany({
    user,
    companyId: '67952029',
    companyName: 'Digitar Media',
    keywords: 'Account Manager Prerna',
    limit: 10,
    headless: true,
  });

  console.log('\n--- PEOPLE SEARCH RESULT ---');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
