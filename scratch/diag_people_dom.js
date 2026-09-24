import { TestUserRepository } from '../linkedin/src/db/repositories/TestUserRepository.js';
import { CompanyPeopleSearchService } from '../linkedin/src/services/CompanyPeopleSearchService.js';
import { chromium } from 'playwright';

async function main() {
  const user = await TestUserRepository.getActiveSessionUser();
  const cookies = JSON.parse(user.storage_state_json || user.session_cookies_json);
  const cookieList = cookies.cookies || cookies;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: user.user_agent });
  await context.addCookies(cookieList);
  const page = await context.newPage();

  const url = 'https://www.linkedin.com/search/results/people/?origin=FACETED_SEARCH&currentCompany=%5B%2267952029%22%5D&keywords=Account%20Manager%20Prerna';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  const diag = await page.evaluate(() => {
    const inLinks = Array.from(document.querySelectorAll('a[href*="/in/"]')).map(a => ({
      href: a.href,
      text: a.textContent?.trim(),
      parentTag: a.parentElement?.tagName,
      grandParentClass: a.parentElement?.parentElement?.className,
    }));
    return {
      title: document.title,
      url: window.location.href,
      inLinksCount: inLinks.length,
      sampleLinks: inLinks.slice(0, 10),
      bodyTextSnippet: document.body.innerText.substring(0, 500)
    };
  });

  console.log('Diagnostic result:', JSON.stringify(diag, null, 2));
  await browser.close();
}

main().catch(console.error);
