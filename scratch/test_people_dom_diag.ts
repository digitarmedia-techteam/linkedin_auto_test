import { TestUserRepository } from '../linkedin/src/db/repositories/TestUserRepository.ts';
import { CompanyPeopleSearchService } from '../linkedin/src/services/CompanyPeopleSearchService.ts';

async function main() {
  const user = await TestUserRepository.getActiveSessionUser();
  if (!user) {
    console.log('No active user found');
    return;
  }
  console.log('Active user found:', user.username);
  
  // Test searching for Yeahmobi (or company search)
  const result = await CompanyPeopleSearchService.searchPeopleInCompany({
    user,
    companyId: '67952029',
    companyName: 'Yeahmobi',
    position: 'Account Manager',
    name: 'Prerna',
    limit: 10,
    headless: true,
  });

  console.log('Search result summary:');
  console.log({
    success: result.success,
    companyId: result.companyId,
    totalFound: result.totalFound,
    message: result.message,
    results: result.results.map(r => ({
      name: r.name,
      headline: r.headline,
      position: r.position,
      profileUrl: r.profileUrl,
      photoUrl: r.photoUrl ? r.photoUrl.substring(0, 50) + '...' : null,
      degree: r.degree,
      canMessage: r.canMessage,
      canConnect: r.canConnect
    }))
  });
}

main().catch(console.error);
