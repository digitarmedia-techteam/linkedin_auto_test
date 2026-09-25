import { chromium } from 'playwright';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';

export interface CompanyDetailedResult {
  companyId: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  location: string | null;
  followers: string | null;
  employeeCount: string | null;
  companySize: string | null;
  website: string | null;
  type: string | null;
  founded: string | null;
  specialties: string | null;
  tagline: string | null;
  description: string | null;
  companyUrl: string;
  isVerified: boolean;
  crawlStatus: 'complete' | 'partial';
}

export interface CompanySearchResponse {
  success: boolean;
  keyword: string;
  country?: string | null;
  countryGeoId?: string | null;
  results: CompanyDetailedResult[];
  totalFound: number;
  message: string;
  timestamp: string;
}

export const LINKEDIN_COUNTRY_GEO_MAP: Record<string, { geoId: string; name: string; code: string; flag: string }> = {
  mexico: { geoId: '103323778', name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  unitedstates: { geoId: '103644278', name: 'United States', code: 'US', flag: '🇺🇸' },
  usa: { geoId: '103644278', name: 'United States', code: 'US', flag: '🇺🇸' },
  us: { geoId: '103644278', name: 'United States', code: 'US', flag: '🇺🇸' },
  unitedkingdom: { geoId: '101165590', name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  uk: { geoId: '101165590', name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  india: { geoId: '102713980', name: 'India', code: 'IN', flag: '🇮🇳' },
  canada: { geoId: '101174742', name: 'Canada', code: 'CA', flag: '🇨🇦' },
  australia: { geoId: '101452733', name: 'Australia', code: 'AU', flag: '🇦🇺' },
  germany: { geoId: '101282230', name: 'Germany', code: 'DE', flag: '🇩🇪' },
  france: { geoId: '105015875', name: 'France', code: 'FR', flag: '🇫🇷' },
  spain: { geoId: '105646813', name: 'Spain', code: 'ES', flag: '🇪🇸' },
  italy: { geoId: '103350119', name: 'Italy', code: 'IT', flag: '🇮🇹' },
  brazil: { geoId: '106057199', name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  singapore: { geoId: '102454443', name: 'Singapore', code: 'SG', flag: '🇸🇬' },
  unitedarabemirates: { geoId: '104305776', name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
  uae: { geoId: '104305776', name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
  saudiarabia: { geoId: '100459316', name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  netherlands: { geoId: '102890719', name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  switzerland: { geoId: '106693272', name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
  china: { geoId: '102890883', name: 'China', code: 'CN', flag: '🇨🇳' },
  japan: { geoId: '101355337', name: 'Japan', code: 'JP', flag: '🇯🇵' },
  southkorea: { geoId: '105149562', name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  korea: { geoId: '105149562', name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  indonesia: { geoId: '102478259', name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
  malaysia: { geoId: '106808692', name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
  philippines: { geoId: '103121230', name: 'Philippines', code: 'PH', flag: '🇵🇭' },
  vietnam: { geoId: '104195383', name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
  thailand: { geoId: '105146118', name: 'Thailand', code: 'TH', flag: '🇹🇭' },
  southafrica: { geoId: '104035573', name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  nigeria: { geoId: '105365761', name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
  egypt: { geoId: '106155005', name: 'Egypt', code: 'EG', flag: '🇪🇬' },
  israel: { geoId: '101620260', name: 'Israel', code: 'IL', flag: '🇮🇱' },
  ireland: { geoId: '104738515', name: 'Ireland', code: 'IE', flag: '🇮🇪' },
  sweden: { geoId: '105117694', name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  norway: { geoId: '103819153', name: 'Norway', code: 'NO', flag: '🇳🇴' },
  denmark: { geoId: '104514075', name: 'Denmark', code: 'DK', flag: '🇩🇰' },
  finland: { geoId: '100456013', name: 'Finland', code: 'FI', flag: '🇫🇮' },
  poland: { geoId: '105072130', name: 'Poland', code: 'PL', flag: '🇵🇱' },
  argentina: { geoId: '100446943', name: 'Argentina', code: 'AR', flag: '🇦🇷' },
  colombia: { geoId: '100876405', name: 'Colombia', code: 'CO', flag: '🇨🇴' },
  chile: { geoId: '104621616', name: 'Chile', code: 'CL', flag: '🇨🇱' },
  peru: { geoId: '102927786', name: 'Peru', code: 'PE', flag: '🇵🇪' },
  newzealand: { geoId: '105490917', name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
  pakistan: { geoId: '101022442', name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  bangladesh: { geoId: '106215326', name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
  turkey: { geoId: '102105699', name: 'Turkey', code: 'TR', flag: '🇹🇷' },
  russia: { geoId: '101728296', name: 'Russia', code: 'RU', flag: '🇷🇺' },
  belgium: { geoId: '100565514', name: 'Belgium', code: 'BE', flag: '🇧🇪' },
  austria: { geoId: '103883259', name: 'Austria', code: 'AT', flag: '🇦🇹' },
  portugal: { geoId: '100364837', name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  greece: { geoId: '104677530', name: 'Greece', code: 'GR', flag: '🇬🇷' },
  czechrepublic: { geoId: '104508036', name: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
  czechia: { geoId: '104508036', name: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
  romania: { geoId: '106670623', name: 'Romania', code: 'RO', flag: '🇷🇴' },
  hungary: { geoId: '100288700', name: 'Hungary', code: 'HU', flag: '🇭🇺' },
  hongkong: { geoId: '103291313', name: 'Hong Kong', code: 'HK', flag: '🇭🇰' },
  taiwan: { geoId: '104187078', name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
  qatar: { geoId: '104170880', name: 'Qatar', code: 'QA', flag: '🇶🇦' },
  kuwait: { geoId: '103239229', name: 'Kuwait', code: 'KW', flag: '🇰🇼' },
  panama: { geoId: '100808673', name: 'Panama', code: 'PA', flag: '🇵🇦' },
  costarica: { geoId: '101739942', name: 'Costa Rica', code: 'CR', flag: '🇨🇷' },
  uruguay: { geoId: '100867946', name: 'Uruguay', code: 'UY', flag: '🇺🇾' },
  ecuador: { geoId: '106373116', name: 'Ecuador', code: 'EC', flag: '🇪🇨' },
  guatemala: { geoId: '104445899', name: 'Guatemala', code: 'GT', flag: '🇬🇹' },
  dominicanrepublic: { geoId: '105057336', name: 'Dominican Republic', code: 'DO', flag: '🇩🇴' },
  srilanka: { geoId: '100446352', name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
  kenya: { geoId: '100710459', name: 'Kenya', code: 'KE', flag: '🇰🇪' },
  morocco: { geoId: '102787409', name: 'Morocco', code: 'MA', flag: '🇲🇦' },
  ghana: { geoId: '105769538', name: 'Ghana', code: 'GH', flag: '🇬🇭' },
  jordan: { geoId: '103710677', name: 'Jordan', code: 'JO', flag: '🇯🇴' },
  lebanon: { geoId: '101834488', name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
  bahrain: { geoId: '100425729', name: 'Bahrain', code: 'BH', flag: '🇧🇭' },
  oman: { geoId: '103619019', name: 'Oman', code: 'OM', flag: '🇴🇲' },
  luxembourg: { geoId: '104042105', name: 'Luxembourg', code: 'LU', flag: '🇱🇺' },
  iceland: { geoId: '105238872', name: 'Iceland', code: 'IS', flag: '🇮🇸' },
  croatia: { geoId: '104688944', name: 'Croatia', code: 'HR', flag: '🇭🇷' },
  slovakia: { geoId: '103119917', name: 'Slovakia', code: 'SK', flag: '🇸🇰' },
  slovenia: { geoId: '106137034', name: 'Slovenia', code: 'SI', flag: '🇸🇮' },
  estonia: { geoId: '102974008', name: 'Estonia', code: 'EE', flag: '🇪🇪' },
  latvia: { geoId: '104341318', name: 'Latvia', code: 'LV', flag: '🇱🇻' },
  lithuania: { geoId: '101464403', name: 'Lithuania', code: 'LT', flag: '🇱🇹' },
  cyprus: { geoId: '106774002', name: 'Cyprus', code: 'CY', flag: '🇨🇾' },
  malta: { geoId: '100961908', name: 'Malta', code: 'MT', flag: '🇲🇹' },
  ukraine: { geoId: '102264497', name: 'Ukraine', code: 'UA', flag: '🇺🇦' },
  kazakhstan: { geoId: '106049128', name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿' },
  bulgaria: { geoId: '105333783', name: 'Bulgaria', code: 'BG', flag: '🇧🇬' },
  serbia: { geoId: '101855787', name: 'Serbia', code: 'RS', flag: '🇷🇸' },
};

export class CompanySearchService {
  /**
   * Resolves a country name, code, or numeric Geo ID to a normalized LinkedIn Geo descriptor
   */
  static resolveCountryGeo(countryInput?: string | null, countryGeoId?: string | null): { geoId: string; name: string; flag: string } | null {
    if (countryGeoId && String(countryGeoId).trim()) {
      const cleanId = String(countryGeoId).trim();
      // Look up name by ID if possible
      for (const item of Object.values(LINKEDIN_COUNTRY_GEO_MAP)) {
        if (item.geoId === cleanId) {
          return { geoId: cleanId, name: item.name, flag: item.flag };
        }
      }
      return { geoId: cleanId, name: countryInput || `Geo ${cleanId}`, flag: '🌐' };
    }

    if (!countryInput || !countryInput.trim()) return null;

    const normalized = countryInput.trim().toLowerCase().replace(/[\s\-_,\.]+/g, '');

    // Check direct normalized match
    if (LINKEDIN_COUNTRY_GEO_MAP[normalized]) {
      const match = LINKEDIN_COUNTRY_GEO_MAP[normalized];
      return { geoId: match.geoId, name: match.name, flag: match.flag };
    }

    // Check code match (e.g. MX, US, IN, GB)
    for (const item of Object.values(LINKEDIN_COUNTRY_GEO_MAP)) {
      if (item.code.toLowerCase() === normalized || item.name.toLowerCase().replace(/[\s\-_,\.]+/g, '') === normalized) {
        return { geoId: item.geoId, name: item.name, flag: item.flag };
      }
    }

    // Partial substring match
    for (const [key, item] of Object.entries(LINKEDIN_COUNTRY_GEO_MAP)) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return { geoId: item.geoId, name: item.name, flag: item.flag };
      }
    }

    // Check if input is purely numeric Geo ID
    if (/^\d+$/.test(countryInput.trim())) {
      return { geoId: countryInput.trim(), name: countryInput.trim(), flag: '🌐' };
    }

    return null;
  }

  private static async createBrowserContext(user: LinkedInTestUser, headless: boolean = true) {
    if (!user.storage_state_json && !user.session_cookies_json) {
      throw new Error(
        `User ${user.username} does not have an active LinkedIn session. Please log in first.`,
      );
    }

    const browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let cookiesToAdd: any[] = [];
    if (user.storage_state_json) {
      try {
        const parsedState = JSON.parse(user.storage_state_json) as StorageStateData;
        if (parsedState.cookies && parsedState.cookies.length > 0) {
          cookiesToAdd = parsedState.cookies;
        }
      } catch (e) {
        logger.warn(`[CompanySearch] Failed to parse storage_state_json: ${e}`);
      }
    }
    if (cookiesToAdd.length === 0 && user.session_cookies_json) {
      try {
        const parsedCookies = JSON.parse(user.session_cookies_json);
        if (Array.isArray(parsedCookies)) cookiesToAdd = parsedCookies;
      } catch (e) {
        logger.warn(`[CompanySearch] Failed to parse session_cookies_json: ${e}`);
      }
    }

    const context = await browser.newContext({
      baseURL: config.baseUrl,
      userAgent: user.user_agent ?? undefined,
      viewport: { width: 1280, height: 900 },
    });

    if (cookiesToAdd.length > 0) await context.addCookies(cookiesToAdd);

    const page = await context.newPage();
    page.setDefaultTimeout(40_000);
    page.setDefaultNavigationTimeout(40_000);

    return { browser, context, page };
  }

  private static async crawlCompanyDetails(
    page: any,
    company: {
      companyId: string;
      name: string;
      logoUrl: string | null;
      industry: string | null;
      location: string | null;
      followers: string | null;
      companyUrl: string;
      description: string | null;
      isVerified: boolean;
    }
  ): Promise<CompanyDetailedResult> {
    const detailed: CompanyDetailedResult = {
      ...company,
      employeeCount: null,
      companySize: null,
      website: null,
      type: null,
      founded: null,
      specialties: null,
      tagline: null,
      crawlStatus: 'partial',
    };

    let targetUrl = company.companyUrl.replace(/\/+$/, '');
    if (!targetUrl.includes('/about')) {
      targetUrl += '/about/';
    }

    try {
      logger.info(`[CompanySearch] Crawling deep details for "${company.name}": ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });

      try {
        await page.waitForSelector(
          '.org-page-details-module__definition-list, .artdeco-card, dl, section.artdeco-card',
          { timeout: 8_000 }
        );
      } catch { }

      await page.waitForTimeout(1000);

      const crawled = await page.evaluate(() => {
        const out: any = {};

        // 0. Company Name on company header
        const nameEl = document.querySelector(
          '.org-top-card-summary__title, h1.org-top-card-summary__title, .org-top-card-primary-content__title, h1'
        );
        if (nameEl && nameEl.textContent?.trim()) {
          out.name = nameEl.textContent.trim().replace(/\s+/g, ' ');
        }

        // 1. Tagline on company header
        const taglineEl = document.querySelector(
          '.org-top-card-summary__tagline, .org-top-card-summary-info-list__info-item, p.break-words'
        );
        if (taglineEl) out.tagline = taglineEl.textContent?.trim() || null;

        // 2. High-res Logo
        const logoImg = document.querySelector(
          '.org-top-card-primary-content__logo-container img, .org-top-card-primary-content__logo img, img.org-top-card-summary__logo'
        ) as HTMLImageElement | null;
        if (logoImg?.src && !logoImg.src.startsWith('data:')) {
          out.logoUrl = logoImg.src;
        }

        // 3. Follower and Employee metrics in header
        const infoItems = Array.from(
          document.querySelectorAll(
            '.org-top-card-summary-info-list__info-item, .org-top-card-secondary-content *, .org-top-card-summary-info-list *'
          )
        );
        for (const el of infoItems) {
          const txt = el.textContent?.trim() || '';
          if (/followers?/i.test(txt) && !out.followers) {
            const m = txt.match(/([\d,\.]+\s*[KkMm]?\s*followers?)/i);
            if (m) out.followers = m[1];
          }
          if (/employees?\s*(on linkedin)?/i.test(txt) && !out.employeeCount) {
            const m = txt.match(/([\d,\.]+\s*employees?(?:\s*on\s*linkedin)?)/i);
            if (m) out.employeeCount = m[1];
          }
        }

        // 4. Description in Overview / About
        const descEl = document.querySelector(
          'section.artdeco-card p.break-words, .org-about-us-organization-description__text, [data-test-id="about-us__description"], .org-about-company-module__about-us-description, .org-page-details-module__description'
        );
        if (descEl) {
          out.description = descEl.textContent?.trim() || null;
        }

        // 5. Definition list (.org-page-details-module__definition-list or dt/dd pairs)
        const dts = Array.from(document.querySelectorAll('dt'));
        for (const dt of dts) {
          const label = dt.textContent?.trim().toLowerCase() || '';
          let dd = dt.nextElementSibling;
          while (dd && dd.tagName.toLowerCase() !== 'dd' && dd.tagName.toLowerCase() !== 'dt') {
            dd = dd.nextElementSibling;
          }
          if (!dd || dd.tagName.toLowerCase() !== 'dd') continue;

          const text = dd.textContent?.trim() || '';

          if (label.includes('website')) {
            const link = dd.querySelector('a');
            out.website = link ? (link.href || link.textContent?.trim()) : text;
          } else if (label.includes('industry')) {
            if (!out.industry || out.industry.length < text.length) out.industry = text;
          } else if (label.includes('company size')) {
            out.companySize = text.replace(/\s+/g, ' ');
            const empMatch = text.match(/([\d,]+)\s*on\s*linkedin/i);
            if (empMatch && !out.employeeCount) {
              out.employeeCount = `${empMatch[1]} on LinkedIn`;
            }
          } else if (label.includes('headquarters')) {
            if (!out.location || out.location.length < text.length) out.location = text;
          } else if (label.includes('type')) {
            out.type = text;
          } else if (label.includes('founded')) {
            out.founded = text;
          } else if (label.includes('specialties')) {
            out.specialties = text;
          }
        }

        // Fallback for Website
        if (!out.website) {
          const webLink = document.querySelector(
            'a[data-control-name="org_about_website"], a[href^="http"]:not([href*="linkedin.com"]):not([href*="licdn.com"])'
          ) as HTMLAnchorElement | null;
          if (webLink && webLink.href && !webLink.href.includes('linkedin.com')) {
            out.website = webLink.href;
          }
        }

        // 6. Extract dynamic Company ID from currentCompany parameter or company URN
        let pageNumericCompanyId: string | null = null;
        const currentCompanyLinks = Array.from(document.querySelectorAll('a[href*="currentCompany"]'));
        for (const a of currentCompanyLinks) {
          const href = a.getAttribute('href') || '';
          try {
            const decoded = decodeURIComponent(href);
            const m = decoded.match(/currentCompany=\[?"?(\d+)"?\]?/i) || href.match(/currentCompany=(?:%5B%22|\["|%22)?(\d+)/i);
            if (m && m[1]) {
              pageNumericCompanyId = m[1];
              break;
            }
          } catch { }
        }

        if (!pageNumericCompanyId) {
          const html = document.body ? document.body.innerHTML : '';
          const m =
            html.match(/currentCompany(?:%3D|=)(?:%5B%22|%5B%27|\["|\['|%22|")?(\d+)/i) ||
            html.match(/urn:li:fsd_company:(\d+)/i) ||
            html.match(/urn:li:company:(\d+)/i);
          if (m && m[1]) {
            pageNumericCompanyId = m[1];
          }
        }

        if (pageNumericCompanyId) {
          out.numericCompanyId = pageNumericCompanyId;
        }

        return out;
      });

      if (crawled) {
        if (crawled.numericCompanyId) detailed.companyId = crawled.numericCompanyId;
        if (crawled.name) detailed.name = crawled.name;
        if (crawled.logoUrl) detailed.logoUrl = crawled.logoUrl;
        if (crawled.tagline) detailed.tagline = crawled.tagline;
        if (crawled.industry) detailed.industry = crawled.industry;
        if (crawled.location) detailed.location = crawled.location;
        if (crawled.followers) detailed.followers = crawled.followers;
        if (crawled.employeeCount) detailed.employeeCount = crawled.employeeCount;
        if (crawled.companySize) detailed.companySize = crawled.companySize;
        if (crawled.website) detailed.website = crawled.website;
        if (crawled.type) detailed.type = crawled.type;
        if (crawled.founded) detailed.founded = crawled.founded;
        if (crawled.specialties) detailed.specialties = crawled.specialties;
        if (crawled.description) detailed.description = crawled.description;
        detailed.crawlStatus = 'complete';
      }
    } catch (err: any) {
      logger.warn(`[CompanySearch] Failed to crawl details for "${company.name}": ${err.message}`);
    }

    return detailed;
  }

  static async searchCompanies(options: {
    user: LinkedInTestUser;
    keyword: string;
    country?: string;
    countryGeoId?: string;
    headless?: boolean;
    limit?: number;
  }): Promise<CompanySearchResponse> {
    const { user, keyword, country, countryGeoId } = options;
    const headless = options.headless !== false;
    const limit = options.limit ?? 20;
    const timestamp = new Date().toISOString();

    if (!keyword || !keyword.trim()) {
      return { success: false, keyword, results: [], totalFound: 0, message: 'Search keyword is required.', timestamp };
    }

    const trimmedKeyword = keyword.trim();
    const resolvedGeo = CompanySearchService.resolveCountryGeo(country, countryGeoId);
    let browser: any = null;
    let context: any = null;

    try {
      const geoLog = resolvedGeo ? ` in ${resolvedGeo.flag} ${resolvedGeo.name} (Geo ID: ${resolvedGeo.geoId})` : '';
      logger.info(`[CompanySearch] Searching for: "${trimmedKeyword}"${geoLog} as ${user.username}`);

      const ctx = await CompanySearchService.createBrowserContext(user, headless);
      browser = ctx.browser;
      context = ctx.context;
      const page = ctx.page;

      // Construct search URL with country facet if specified
      let searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(trimmedKeyword)}`;
      if (resolvedGeo && resolvedGeo.geoId) {
        searchUrl += `&origin=GLOBAL_SEARCH_HEADER&companyHqGeo=${encodeURIComponent('["' + resolvedGeo.geoId + '"]')}`;
      } else {
        searchUrl += `&origin=SPELL_CHECK_REPLACE&spellCorrectionEnabled=false`;
      }

      logger.info(`[CompanySearch] Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 40_000 });

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 40_000 });

      try {
        await page.waitForSelector(
          '.entity-result, [data-view-name="search-entity-result-universal-template"], .reusable-search__entity-result-list, .reusable-search__result-container, a[href*="/company/"]',
          { timeout: 15_000 }
        );
      } catch {
        try {
          await page.waitForSelector('.entity-result__title-text, .artdeco-entity-lockup__title', { timeout: 10_000 });
        } catch {
          logger.warn('[CompanySearch] Results did not load within timeout.');
        }
      }

      // Gentle scroll to ensure lazy-loaded items render
      try {
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(1500);
      } catch { }

      const candidateResults = await page.evaluate((maxResults: number) => {
        const companies: any[] = [];
        const seen = new Set<string>();

        // Find all links referencing /company/
        const allCompanyLinks = Array.from(document.querySelectorAll('a[href*="/company/"]'));

        for (const link of allCompanyLinks) {
          if (companies.length >= maxResults) break;
          try {
            let companyUrl = link.getAttribute('href') || '';
            if (!companyUrl) continue;
            if (!companyUrl.startsWith('http')) companyUrl = 'https://www.linkedin.com' + companyUrl;
            companyUrl = companyUrl.split('?')[0].replace(/\/+$/, '');

            const companyIdMatch = companyUrl.match(/\/company\/([^/?#]+)/);
            if (!companyIdMatch) continue;
            const companyId = companyIdMatch[1].toLowerCase();

            // Skip administrative / non-company profile endpoints
            if (['setup', 'login', 'about', 'help', 'admin', 'careers', 'jobs'].includes(companyId)) continue;
            if (seen.has(companyId)) continue;

            // Find surrounding item card container
            const container =
              link.closest('[role="listitem"]') ||
              link.closest('div[componentkey]') ||
              link.closest('li') ||
              link.parentElement?.parentElement ||
              link;

            // Extract Name
            let name: string | null = null;
            const ariaHiddenSpan = link.querySelector('span[aria-hidden="true"]');
            if (ariaHiddenSpan && ariaHiddenSpan.textContent?.trim()) {
              name = ariaHiddenSpan.textContent.trim();
            } else {
              name = link.textContent?.trim() || null;
            }

            if (!name || name.length > 80) {
              const nameEl =
                container.querySelector('.entity-result__title-text') ||
                container.querySelector('.artdeco-entity-lockup__title') ||
                container.querySelector('h3, h4, p');
              name = nameEl?.textContent?.trim() || null;
            }
            if (name) name = name.replace(/\s+/g, ' ').trim();
            if (!name) continue;

            seen.add(companyId);

            // Extract numeric Company ID from currentCompany parameter
            let numericCompanyId: string | null = null;
            const allLinksInContainer = Array.from(container.querySelectorAll('a[href]'));
            for (const aEl of allLinksInContainer) {
              const href = aEl.getAttribute('href') || '';
              if (href.includes('currentCompany')) {
                try {
                  const decoded = decodeURIComponent(href);
                  const m = decoded.match(/currentCompany=\[?"?(\d+)"?\]?/i) || href.match(/currentCompany=(?:%5B%22|\["|%22)?(\d+)/i);
                  if (m && m[1]) {
                    numericCompanyId = m[1];
                    break;
                  }
                } catch { }
              }
            }

            if (!numericCompanyId) {
              const cHtml = container.innerHTML || '';
              const m = cHtml.match(/currentCompany(?:%3D|=)(?:%5B%22|%5B%27|\["|\['|%22|")?(\d+)/i);
              if (m && m[1]) {
                numericCompanyId = m[1];
              }
            }

            const finalCompanyId = numericCompanyId || companyId;

            // Extract Logo URL
            const imgEl = (
              container.querySelector('img[src*="company-logo"]') ||
              container.querySelector('img[src*="licdn.com"]') ||
              container.querySelector('.entity-result__universal-image img') ||
              container.querySelector('.artdeco-entity-image img') ||
              container.querySelector('img')
            ) as HTMLImageElement | null;
            let logoUrl = imgEl?.src || null;
            if (logoUrl && logoUrl.startsWith('data:')) logoUrl = null;

            // Extract Subtitles / Followers / Description
            const textNodes = Array.from(container.querySelectorAll('p, span, div')).map(el => el.textContent?.trim() || '').filter(Boolean);

            let industry: string | null = null;
            let location: string | null = null;
            let followers: string | null = null;
            let description: string | null = null;

            const containerText = container.textContent || '';
            const followerMatch = containerText.match(/(\d[\d,\.]*\s*[KkMm]?\s*followers?)/i);
            if (followerMatch) followers = followerMatch[1].trim();

            const subtitleEls = container.querySelectorAll('.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle');
            if (subtitleEls.length > 0) {
              industry = subtitleEls[0]?.textContent?.trim()?.replace(/\s+/g, ' ') || null;
            }

            const secondarySubEls = container.querySelectorAll('.entity-result__secondary-subtitle');
            if (secondarySubEls.length > 0) {
              location = secondarySubEls[0]?.textContent?.trim()?.replace(/\s+/g, ' ') || null;
            }

            for (const text of textNodes) {
              if (text === name || text.includes(name) || /followers?/i.test(text) || text === 'Follow' || text === 'Following') continue;

              if (!industry && (text.includes('Services') || text.includes('Media') || text.includes('Technology') || text.includes('Production') || text.includes('Advertising') || text.includes('Software') || text.includes('Financial'))) {
                industry = text;
              } else if (!location && (text.includes('India') || text.includes('United States') || text.includes('BOGOTA') || text.includes(',') || text.includes('&'))) {
                location = text;
              } else if (!description && text.length > 25) {
                description = text;
              }
            }

            const descEl = container.querySelector('.entity-result__summary, .entity-result__content--summary');
            if (descEl) description = descEl.textContent?.trim()?.replace(/\s+/g, ' ') || description;

            const isVerified = !!container.querySelector('[aria-label*="Verified"], svg[id*="verified"]');

            companies.push({
              companyId: finalCompanyId,
              name,
              logoUrl,
              industry,
              location,
              followers,
              companyUrl: companyUrl + '/',
              description,
              isVerified,
            });
          } catch (e) { /* skip */ }
        }

        return companies;
      }, limit);

      logger.info(`[CompanySearch] Extracted ${candidateResults.length} initial candidate companies for "${trimmedKeyword}"`);

      // Take top 2 relevant company results to deep-crawl
      const top2Candidates = candidateResults.slice(0, 2);
      const detailedResults: CompanyDetailedResult[] = [];

      for (let i = 0; i < top2Candidates.length; i++) {
        const candidate = top2Candidates[i];
        logger.info(`[CompanySearch] Deep-crawling company ${i + 1}/${top2Candidates.length}: ${candidate.name}`);
        const detailed = await CompanySearchService.crawlCompanyDetails(page, candidate);
        detailedResults.push(detailed);
        if (i < top2Candidates.length - 1) {
          await page.waitForTimeout(1000);
        }
      }

      logger.info(`[CompanySearch] Completed deep extraction for ${detailedResults.length} top companies.`);

      return {
        success: true,
        keyword: trimmedKeyword,
        country: resolvedGeo ? `${resolvedGeo.flag} ${resolvedGeo.name}` : (country || null),
        countryGeoId: resolvedGeo ? resolvedGeo.geoId : (countryGeoId || null),
        results: detailedResults,
        totalFound: detailedResults.length,
        message: detailedResults.length > 0
          ? `Retrieved complete details for ${detailedResults.length} compan${detailedResults.length === 1 ? 'y' : 'ies'} matching "${trimmedKeyword}"${resolvedGeo ? ` in ${resolvedGeo.flag} ${resolvedGeo.name}` : ''}.`
          : `No company results found for "${trimmedKeyword}"${resolvedGeo ? ` in ${resolvedGeo.flag} ${resolvedGeo.name}` : ''}. Try a different keyword or country.`,
        timestamp,
      };
    } catch (error: any) {
      logger.error(`[CompanySearch] Error: ${error.message}`);
      return {
        success: false,
        keyword: trimmedKeyword,
        country: resolvedGeo ? `${resolvedGeo.flag} ${resolvedGeo.name}` : (country || null),
        countryGeoId: resolvedGeo ? resolvedGeo.geoId : (countryGeoId || null),
        results: [],
        totalFound: 0,
        message: `Search failed: ${error.message}`,
        timestamp,
      };
    } finally {
      try { if (context) await context.close(); } catch { }
      try { if (browser) await browser.close(); } catch { }
    }
  }
}
