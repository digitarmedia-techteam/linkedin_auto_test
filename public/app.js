// =============================================================================
// DigiLink Enterprise Hub - Production-Grade React 18 + Tailwind Application
// Light SaaS Theme with Left Sidebar Navigation & Role-Based Access Control
// =============================================================================

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ── Complete Country Dataset from Platform Configuration (78 Countries) ──────
const ALL_COUNTRIES = [
  { name: "United States", code: "US", geoId: "103644278", flag: "🇺🇸" },
  { name: "United Kingdom", code: "GB", geoId: "101165590", flag: "🇬🇧" },
  { name: "India", code: "IN", geoId: "102713980", flag: "🇮🇳" },
  { name: "Canada", code: "CA", geoId: "101174742", flag: "🇨🇦" },
  { name: "Australia", code: "AU", geoId: "101452733", flag: "🇦🇺" },
  { name: "Germany", code: "DE", geoId: "101282230", flag: "🇩🇪" },
  { name: "France", code: "FR", geoId: "105015875", flag: "🇫🇷" },
  { name: "Spain", code: "ES", geoId: "105646813", flag: "🇪🇸" },
  { name: "Italy", code: "IT", geoId: "103350119", flag: "🇮🇹" },
  { name: "Mexico", code: "MX", geoId: "103323778", flag: "🇲🇽" },
  { name: "Brazil", code: "BR", geoId: "106057199", flag: "🇧🇷" },
  { name: "Singapore", code: "SG", geoId: "102454443", flag: "🇸🇬" },
  { name: "United Arab Emirates", code: "AE", geoId: "104305776", flag: "🇦🇪" },
  { name: "Saudi Arabia", code: "SA", geoId: "100459316", flag: "🇸🇦" },
  { name: "Netherlands", code: "NL", geoId: "102890719", flag: "🇳🇱" },
  { name: "Switzerland", code: "CH", geoId: "106693272", flag: "🇨🇭" },
  { name: "Sweden", code: "SE", geoId: "105117694", flag: "🇸🇪" },
  { name: "Poland", code: "PL", geoId: "105072130", flag: "🇵🇱" },
  { name: "Ireland", code: "IE", geoId: "104738515", flag: "🇮🇪" },
  { name: "Japan", code: "JP", geoId: "101355337", flag: "🇯🇵" },
  { name: "China", code: "CN", geoId: "102890883", flag: "🇨🇳" },
  { name: "South Korea", code: "KR", geoId: "105149562", flag: "🇰🇷" },
  { name: "Israel", code: "IL", geoId: "101620260", flag: "🇮🇱" },
  { name: "South Africa", code: "ZA", geoId: "104035573", flag: "🇿🇦" },
  { name: "Argentina", code: "AR", geoId: "100446943", flag: "🇦🇷" },
  { name: "Chile", code: "CL", geoId: "104621616", flag: "🇨🇱" },
  { name: "Colombia", code: "CO", geoId: "100876405", flag: "🇨🇴" },
  { name: "Costa Rica", code: "CR", geoId: "101739942", flag: "🇨🇷" },
  { name: "Dominican Republic", code: "DO", geoId: "105057336", flag: "🇩🇴" },
  { name: "Ecuador", code: "EC", geoId: "106373116", flag: "🇪🇨" },
  { name: "Guatemala", code: "GT", geoId: "104445899", flag: "🇬🇹" },
  { name: "Panama", code: "PA", geoId: "100808673", flag: "🇵🇦" },
  { name: "Peru", code: "PE", geoId: "102927786", flag: "🇵🇪" },
  { name: "Uruguay", code: "UY", geoId: "100867946", flag: "🇺🇾" },
  { name: "Austria", code: "AT", geoId: "103883259", flag: "🇦🇹" },
  { name: "Belgium", code: "BE", geoId: "100565514", flag: "🇧🇪" },
  { name: "Bulgaria", code: "BG", geoId: "105333783", flag: "🇧🇬" },
  { name: "Croatia", code: "HR", geoId: "104688944", flag: "🇭🇷" },
  { name: "Czech Republic", code: "CZ", geoId: "104508036", flag: "🇨🇿" },
  { name: "Denmark", code: "DK", geoId: "104514075", flag: "🇩🇰" },
  { name: "Estonia", code: "EE", geoId: "102974008", flag: "🇪🇪" },
  { name: "Finland", code: "FI", geoId: "100456013", flag: "🇫🇮" },
  { name: "Greece", code: "GR", geoId: "104677530", flag: "🇬🇷" },
  { name: "Hungary", code: "HU", geoId: "100288700", flag: "🇭🇺" },
  { name: "Iceland", code: "IS", geoId: "105238872", flag: "🇮🇸" },
  { name: "Latvia", code: "LV", geoId: "104341318", flag: "🇱🇻" },
  { name: "Lithuania", code: "LT", geoId: "101464403", flag: "🇱🇹" },
  { name: "Luxembourg", code: "LU", geoId: "104042105", flag: "🇱🇺" },
  { name: "Norway", code: "NO", geoId: "103819153", flag: "🇳🇴" },
  { name: "Portugal", code: "PT", geoId: "100364837", flag: "🇵🇹" },
  { name: "Romania", code: "RO", geoId: "106670623", flag: "🇷🇴" },
  { name: "Russia", code: "RU", geoId: "101728296", flag: "🇷🇺" },
  { name: "Slovakia", code: "SK", geoId: "103119917", flag: "🇸🇰" },
  { name: "Slovenia", code: "SI", geoId: "106137034", flag: "🇸🇮" },
  { name: "Turkey", code: "TR", geoId: "102105699", flag: "🇹🇷" },
  { name: "Ukraine", code: "UA", geoId: "102264497", flag: "🇺🇦" },
  { name: "Bangladesh", code: "BD", geoId: "106215326", flag: "🇧🇩" },
  { name: "Hong Kong", code: "HK", geoId: "103291313", flag: "🇭🇰" },
  { name: "Indonesia", code: "ID", geoId: "102478259", flag: "🇮🇩" },
  { name: "Malaysia", code: "MY", geoId: "106808692", flag: "🇲🇾" },
  { name: "New Zealand", code: "NZ", geoId: "105490917", flag: "🇳🇿" },
  { name: "Pakistan", code: "PK", geoId: "101022442", flag: "🇵🇰" },
  { name: "Philippines", code: "PH", geoId: "103121230", flag: "🇵🇭" },
  { name: "Sri Lanka", code: "LK", geoId: "100446352", flag: "🇱🇰" },
  { name: "Taiwan", code: "TW", geoId: "104187078", flag: "🇹🇼" },
  { name: "Thailand", code: "TH", geoId: "105146118", flag: "🇹🇭" },
  { name: "Vietnam", code: "VN", geoId: "104195383", flag: "🇻🇳" },
  { name: "Bahrain", code: "BH", geoId: "100425729", flag: "🇧🇭" },
  { name: "Egypt", code: "EG", geoId: "106155005", flag: "🇪🇬" },
  { name: "Ghana", code: "GH", geoId: "105769538", flag: "🇬🇭" },
  { name: "Jordan", code: "JO", geoId: "103710677", flag: "🇯🇴" },
  { name: "Kenya", code: "KE", geoId: "100710459", flag: "🇰🇪" },
  { name: "Kuwait", code: "KW", geoId: "103239229", flag: "🇰🇼" },
  { name: "Lebanon", code: "LB", geoId: "101834488", flag: "🇱🇧" },
  { name: "Morocco", code: "MA", geoId: "102787409", flag: "🇲🇦" },
  { name: "Nigeria", code: "NG", geoId: "105365761", flag: "🇳🇬" },
  { name: "Oman", code: "OM", geoId: "103619019", flag: "🇴🇲" },
  { name: "Qatar", code: "QA", geoId: "104170880", flag: "🇶🇦" }
];

const POPULAR_COUNTRIES = ALL_COUNTRIES.slice(0, 13);
const ALL_COUNTRIES_SORTED = [...ALL_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
const COUNTRY_PRESETS = POPULAR_COUNTRIES;

const DESIGNATION_PRESETS = [
  'Founder', 'CEO', 'Director', 'Manager', 'Vice President',
  'Head of Sales', 'Product Manager', 'Software Engineer', 'Talent Acquisition'
];

// ── Reusable SVG Icons ───────────────────────────────────────────────────────
function Icon({ name, className = "w-5 h-5", ...props }) {
  switch (name) {
    case 'logo':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
          <rect width="24" height="24" rx="6" fill="#2563eb" />
          <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'users':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    case 'search':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case 'send':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
    case 'check-circle':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'chat':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case 'shield':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
    case 'building':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    case 'refresh':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
    case 'plus':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
    case 'external-link':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;
    case 'map-pin':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'key':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>;
    case 'sparkles':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
    case 'close':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>;
    case 'copy':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>;
    case 'menu':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'trash':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
    case 'logout':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    case 'linkedin':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" /></svg>;
    case 'check':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>;
    case 'clock':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'info':
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    default:
      return null;
  }
}

// ── Animated Spinner Component ───────────────────────────────────────────────
function Spinner({ className = "w-4 h-4 text-current" }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

// ── Main DigiLink Application Component ─────────────────────────────────────
function App() {
  // ── Authentication & Multi-Tenancy State ──────────────────────────────────
  const [token, setToken] = useState(() => localStorage.getItem('app_auth_token') || '');
  const [appUser, setAppUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('admin@app.com');
  const [loginPassword, setLoginPassword] = useState('Admin@123');
  const [loggingIn, setLoggingIn] = useState(false);

  // ── Layout & Navigation ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('accounts');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── LinkedIn Accounts & Sessions ───────────────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newProxy, setNewProxy] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // ── Session Resync State ──────────────────────────────────────────────────
  const [resyncingSessionId, setResyncingSessionId] = useState(null);

  // ── Live Login Stream & 2FA Challenge ──────────────────────────────────────
  const [loggingInAccount, setLoggingInAccount] = useState(false);
  const [loggingInAccountId, setLoggingInAccountId] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpChallengeUser, setOtpChallengeUser] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [inCardOtpMode, setInCardOtpMode] = useState(false);
  const [isManualAddMode, setIsManualAddMode] = useState(false);
  const [loggingOutSession, setLoggingOutSession] = useState(false);

  // ── Global Outreach Stats ──────────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalAccounts: 0,
    acceptedToday: 0,
    totalTracked: 0,
    pending: 0,
    rate: '0%'
  });

  // ── Stats Debouncing Ref to prevent duplicate consecutive calls ─────────
  const lastStatsFetchedUserIdRef = useRef(null);

  // ── Search & Intelligence Suite ────────────────────────────────────────────
  const [searchVertical, setSearchVertical] = useState('companies'); // 'companies' | 'people'

  // Company Search (All filters optional)
  const [companyKeyword, setCompanyKeyword] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [companyCountryGeoId, setCompanyCountryGeoId] = useState('');
  const [companyLimit, setCompanyLimit] = useState(20);
  const [companyHeadless, setCompanyHeadless] = useState(true);
  const [companyResults, setCompanyResults] = useState(() => {
    try {
      const saved = localStorage.getItem('last_company_search_results');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [companySearchMeta, setCompanySearchMeta] = useState(() => {
    try {
      const saved = localStorage.getItem('last_company_search_meta');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [companyFilterQuery, setCompanyFilterQuery] = useState('');
  const [companyViewMode, setCompanyViewMode] = useState('cards'); // 'cards' | 'table'
  const [companyExpandedDesc, setCompanyExpandedDesc] = useState({}); // { [companyId]: boolean }
  const [searchingCompanies, setSearchingCompanies] = useState(false);

  // People Search (All filters optional - no defaults applied)
  const [peopleKeywords, setPeopleKeywords] = useState('');
  const [peopleDesignation, setPeopleDesignation] = useState('');
  const [peopleCountries, setPeopleCountries] = useState([]); // Empty by default (no country filter applied)
  const [peopleCompany, setPeopleCompany] = useState('');
  const [peopleNetwork, setPeopleNetwork] = useState('');
  const [peopleLimit, setPeopleLimit] = useState(25);
  const [peopleHeadless, setPeopleHeadless] = useState(true);
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleSearchMeta, setPeopleSearchMeta] = useState(null);
  const [peopleFilterQuery, setPeopleFilterQuery] = useState('');
  const [searchingPeople, setSearchingPeople] = useState(false);

  // Direct Messaging / Connect Modals for Search Results
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [msgRecipient, setMsgRecipient] = useState({ name: '', vanity: '', profileUrl: '', threadId: '' });
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectRecipient, setConnectRecipient] = useState({ name: '', vanity: '', profileUrl: '', headline: '' });
  const [connectNote, setConnectNote] = useState('');
  const [sendingConnect, setSendingConnect] = useState(false);

  // ── Direct Outreach Tab ────────────────────────────────────────────────────
  const [outreachTarget, setOutreachTarget] = useState('');
  const [outreachNote, setOutreachNote] = useState('');
  const [preflightStatus, setPreflightStatus] = useState(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [sentTodayItems, setSentTodayItems] = useState([]);
  const [loadingSentToday, setLoadingSentToday] = useState(false);

  // ── Accepted Connections & Intelligence Tab ────────────────────────────────
  const [scanningAccepted, setScanningAccepted] = useState(false);
  const [trackingSubTab, setTrackingSubTab] = useState('recent_connections'); // 'recent_connections' | 'conversations' | 'accepted' | 'pending' | 'history'
  const [trackedContacts, setTrackedContacts] = useState([]);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const [trackingFilter, setTrackingFilter] = useState('');
  const [scanIndexData, setScanIndexData] = useState(() => {
    try {
      const saved = localStorage.getItem('last_scan_index_data');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [scanIndexConnections, setScanIndexConnections] = useState(() => {
    try {
      const saved = localStorage.getItem('last_scan_index_data');
      return saved ? (JSON.parse(saved).connections?.allScraped || []) : [];
    } catch { return []; }
  });
  const [indexedConversations, setIndexedConversations] = useState(() => {
    try {
      const saved = localStorage.getItem('last_scan_index_data');
      return saved ? (JSON.parse(saved).conversations?.conversations || []) : [];
    } catch { return []; }
  });

  // ── Conversation Studio Tab ────────────────────────────────────────────────
  const [threadQuery, setThreadQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [studioThreadSearch, setStudioThreadSearch] = useState('');
  const [threadData, setThreadData] = useState(null);
  const [readingThread, setReadingThread] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // ── Team & Organization (RBAC) Tab ─────────────────────────────────────────
  const [teamUsers, setTeamUsers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('');
  const [newTeamRole, setNewTeamRole] = useState('user');
  const [newTeamManagerId, setNewTeamManagerId] = useState('');
  const [creatingTeamUser, setCreatingTeamUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // ── Toasts Notification System ─────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // ── Selected Active Account Object ─────────────────────────────────────────
  const currentAccount = useMemo(() => {
    return accounts.find(a => String(a.id) === String(selectedAccountId)) || accounts[0] || null;
  }, [accounts, selectedAccountId]);

  // ── Active Session Verification Indicator ──────────────────────────────────
  const hasActiveSession = useMemo(() => {
    return Boolean(
      currentAccount && (
        currentAccount.has_saved_session ||
        currentAccount.storage_state_json ||
        currentAccount.li_at_token ||
        currentAccount.last_login_status === 'success'
      )
    );
  }, [currentAccount]);

  // ── Fetch Helper with Authorization Header ─────────────────────────────────
  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAppUser(null);
          setToken('');
          localStorage.removeItem('app_auth_token');
          setAuthModalOpen(true);
        }
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  }, [token]);

  // ── Verify & Hydrate App User ──────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const data = await apiFetch('/api/auth/me');
      if (data.success && data.user) {
        setAppUser(data.user);
      } else {
        setToken('');
        localStorage.removeItem('app_auth_token');
        setAuthModalOpen(true);
      }
    } catch {
      setToken('');
      localStorage.removeItem('app_auth_token');
      setAuthModalOpen(true);
    }
  }, [token, apiFetch]);

  // ── Load LinkedIn Accounts (Filtered per user role) ────────────────────────
  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setLoadingAccounts(true);
    try {
      const data = await apiFetch('/api/users');
      const list = data.users || [];
      setAccounts(list);
      if (list.length > 0 && !selectedAccountId) {
        const active = list.find(u => u.storage_state_json || u.li_at_token);
        setSelectedAccountId(String((active || list[0]).id));
      }
      setStats(prev => ({ ...prev, totalAccounts: list.length }));
    } catch (err) {
      showToast(`Could not load LinkedIn accounts: ${err.message}`, 'error');
    } finally {
      setLoadingAccounts(false);
    }
  }, [token, selectedAccountId, apiFetch, showToast]);

  // ── Load Global Stats ─────────────────────────────────────────────────────
  const loadGlobalStats = useCallback(async () => {
    if (!token || !currentAccount) return;
    try {
      const data = await apiFetch(`/api/connections/stats?userId=${currentAccount.id}`);
      if (data.success && data.stats) {
        const s = data.stats;
        const total = s.total_tracked || 0;
        const accepted = s.accepted || 0;
        const rate = total > 0 ? `${Math.round((accepted / total) * 100)}%` : '0%';
        setStats(prev => ({
          ...prev,
          totalTracked: total,
          acceptedToday: s.accepted_today || 0,
          pending: s.pending || 0,
          rate
        }));
      }
    } catch {
      // non-blocking
    }
  }, [token, currentAccount, apiFetch]);

  // ── Initial Boot ──────────────────────────────────────────────────────────
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (token) {
      loadAccounts();
    }
  }, [token, loadAccounts]);

  useEffect(() => {
    if (token && currentAccount?.id) {
      if (lastStatsFetchedUserIdRef.current === currentAccount.id) return;
      lastStatsFetchedUserIdRef.current = currentAccount.id;
      loadGlobalStats();
    }
  }, [token, currentAccount?.id, loadGlobalStats]);

  // ── LinkedIn OTP / Security Challenge Watcher (Active only during login attempts) ──
  useEffect(() => {
    // Only poll when actively attempting a login or awaiting 2FA/OTP PIN
    if (!loggingInAccount && !inCardOtpMode) return;

    let active = true;
    const pollChallenge = async () => {
      try {
        const chRes = await apiFetch('/api/login/challenge');
        if (!active) return;
        if (chRes && chRes.active && chRes.status === 'waiting_for_otp') {
          const challengedUser = chRes.username || 'LinkedIn Account';
          setOtpChallengeUser(challengedUser);
          setInCardOtpMode(true);
          setOtpModalOpen(true);
          if (chRes.username) {
            const matched = accounts.find(a =>
              a.username.toLowerCase() === chRes.username.toLowerCase() ||
              (chRes.userId && a.id === chRes.userId)
            );
            if (matched && String(selectedAccountId) !== String(matched.id)) {
              setSelectedAccountId(String(matched.id));
            }
          }
        }
      } catch (err) {
        // non-blocking
      }
    };

    const interval = setInterval(pollChallenge, 1500);
    pollChallenge();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loggingInAccount, inCardOtpMode, token, accounts, selectedAccountId, apiFetch]);

  // ── Platform Login Handler ────────────────────────────────────────────────
  const handlePlatformLogin = async (e) => {
    if (e) e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }
      setToken(data.token);
      setAppUser(data.user);
      localStorage.setItem('app_auth_token', data.token);
      setAuthModalOpen(false);
      showToast(`Welcome back, ${data.user.email} (${data.user.role.toUpperCase()})!`, 'success');
      loadAccounts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handlePlatformLogout = async () => {
    try {
      if (token) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch { }
    setToken('');
    setAppUser(null);
    localStorage.removeItem('app_auth_token');
    setAuthModalOpen(true);
    setProfileModalOpen(false);
    showToast('Signed out of DigiLink successfully.', 'info');
  };

  // ── Add / Connect LinkedIn Account & Direct Login ─────────────────────────
  const handleAddAccount = async (e) => {
    e.preventDefault();
    const cleanUsername = (newUsername || '').trim();
    const cleanPassword = newPassword;
    const cleanProxy = (newProxy || '').trim();

    if (!cleanUsername || !cleanPassword) {
      showToast('Username and password are required', 'warning');
      return;
    }

    if (appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode) {
      const existing = accounts.find(a => a.username.toLowerCase() === cleanUsername.toLowerCase());
      if (!existing) {
        const roleTitle = appUser?.role === 'manager' ? 'Manager' : 'User';
        showToast(`${roleTitle} role can only connect 1 LinkedIn account. Please disconnect your current account before adding a new one.`, 'warning');
        return;
      }
    }

    setAddingAccount(true);
    setLoggingInAccount(true);
    setTerminalLogs([`[DigiLink] Registering account details for ${cleanUsername}...`]);

    try {
      // 1. Immediately register account in database so it is saved
      const saveRes = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
          proxy: cleanProxy || undefined,
          login_try: 1,
          status: 'active'
        })
      });

      if (!saveRes.success && saveRes.error) {
        throw new Error(saveRes.error);
      }

      // 2. Instantly reload accounts and send to "Registered LinkedIn Accounts" table
      const usersData = await apiFetch('/api/users');
      const updatedAccounts = usersData.users || [];
      setAccounts(updatedAccounts);

      const targetAccount = updatedAccounts.find(a => a.username.toLowerCase() === cleanUsername.toLowerCase()) || saveRes.user;
      const targetId = targetAccount?.id;

      if (targetId) {
        setSelectedAccountId(String(targetId));
        setLoggingInAccountId(targetId);
      }
      setOtpChallengeUser(cleanUsername);
      setIsManualAddMode(false);
      setNewPassword('');
      setNewProxy('');

      showToast(`Account "${cleanUsername}" registered! Initializing realtime session capture...`, 'info');

      // Scroll smoothly to the Registered Accounts table so user sees the newly registered account
      const tableEl = document.getElementById('registered-accounts-table');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // 3. Launch real-time login session for the newly registered account
      await handleDirectLogin({
        id: targetId,
        username: cleanUsername,
        password: cleanPassword,
        proxy: cleanProxy || undefined
      });

    } catch (err) {
      showToast(err.message, 'error');
      setTerminalLogs(prev => [...prev, `[Error] ${err.message}`]);
      setLoggingInAccount(false);
      setLoggingInAccountId(null);
    } finally {
      setAddingAccount(false);
    }
  };

  // ── Disconnect / Delete LinkedIn Account ──────────────────────────────────
  const handleDeleteAccount = async (acc) => {
    if (!acc) return;
    const confirmed = window.confirm(`Are you sure you want to disconnect LinkedIn account "${acc.username}"? This will remove saved credentials and session data.`);
    if (!confirmed) return;

    try {
      await apiFetch(`/api/users/${acc.id}`, { method: 'DELETE' });
      showToast(`LinkedIn account "${acc.username}" disconnected successfully`, 'success');
      if (String(selectedAccountId) === String(acc.id)) {
        setSelectedAccountId('');
      }
      setIsManualAddMode(false);
      setInCardOtpMode(false);
      setOtpModalOpen(false);
      loadAccounts();
    } catch (err) {
      showToast(`Failed to disconnect account: ${err.message}`, 'error');
    }
  };

  // ── Trigger Direct Login with Live SSE Terminal ───────────────────────────
  const handleDirectLogin = async (account) => {
    const target = account || currentAccount;
    if (!target) return;
    setSelectedAccountId(String(target.id));
    setOtpChallengeUser(target.username);
    setIsManualAddMode(false);
    setLoggingInAccount(true);
    setLoggingInAccountId(target.id);
    setTerminalLogs([`[DigiLink] Initializing browser automation session for ${target.username}...`]);

    let evtSource = null;
    let challengePoll = null;
    try {
      evtSource = new EventSource(`/api/login/stream?username=${encodeURIComponent(target.username)}`);
      evtSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.message) {
            setTerminalLogs(prev => [...prev.slice(-35), `[${payload.step || 'Info'}] ${payload.message}`]);
          }
          if (payload.status === 'otp_required' || payload.status === 'challenge_required' || payload.challengeType) {
            setOtpChallengeUser(target.username);
            setInCardOtpMode(true);
            setOtpModalOpen(true);
            setSelectedAccountId(String(target.id));
            showToast('LinkedIn security PIN code required.', 'warning');
          }
        } catch {
          setTerminalLogs(prev => [...prev.slice(-35), event.data]);
        }
      };
      evtSource.onerror = () => {
        if (evtSource) evtSource.close();
      };

      challengePoll = setInterval(async () => {
        try {
          const chRes = await apiFetch(`/api/login/challenge?username=${encodeURIComponent(target.username)}`);
          if (chRes.active && chRes.status === 'waiting_for_otp') {
            setOtpChallengeUser(chRes.username || target.username);
            setInCardOtpMode(true);
            setOtpModalOpen(true);
            setSelectedAccountId(String(target.id));
          }
        } catch { }
      }, 1000);

      const res = await apiFetch('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({
          userId: target.id,
          username: target.username,
          password: target.password || newPassword,
          proxy: target.proxy || newProxy,
          headless: true
        })
      });

      if (res.success) {
        showToast(`Authentication successful for ${target.username}!`, 'success');
        setTerminalLogs(prev => [...prev, `[Success] Session connected and active for ${target.username}`]);
        setInCardOtpMode(false);
        setOtpModalOpen(false);
        setIsManualAddMode(false);
        setSelectedAccountId(String(target.id));
        await loadAccounts();
      } else if (res.checkpoint || res.status === 'checkpoint') {
        setOtpChallengeUser(target.username);
        setInCardOtpMode(true);
        setOtpModalOpen(true);
        setSelectedAccountId(String(target.id));
        showToast('LinkedIn security PIN required.', 'warning');
      } else {
        throw new Error(res.message || 'Login attempt failed');
      }
    } catch (err) {
      showToast(`Login failed: ${err.message}`, 'error');
      setTerminalLogs(prev => [...prev, `[Error] ${err.message}`]);
    } finally {
      if (challengePoll) clearInterval(challengePoll);
      if (evtSource) evtSource.close();
      setLoggingInAccount(false);
      setLoggingInAccountId(null);
    }
  };

  // ── Submit 2FA / OTP Verification ──────────────────────────────────────────
  const handleSubmitOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpCode || !otpCode.trim()) {
      showToast('Please enter the verification PIN code', 'warning');
      return;
    }
    const targetUser = otpChallengeUser || currentAccount?.username || '';
    setSubmittingOtp(true);
    try {
      const res = await apiFetch('/api/login/submit-otp', {
        method: 'POST',
        body: JSON.stringify({ username: targetUser, otp: otpCode.trim() })
      });
      if (res.success) {
        showToast('Verification PIN accepted! Capturing session state...', 'success');
        setOtpModalOpen(false);
        setInCardOtpMode(false);
        setOtpCode('');
        // Wait briefly for browser session capture to finalize
        setTimeout(async () => {
          await loadAccounts();
        }, 2500);
      } else {
        throw new Error(res.message || 'Failed to submit PIN code');
      }
    } catch (err) {
      showToast(`Verification error: ${err.message}`, 'error');
    } finally {
      setSubmittingOtp(false);
    }
  };

  // ── Logout LinkedIn Active Session ─────────────────────────────────────────
  const handleLogoutLinkedIn = async (account) => {
    const target = account || currentAccount;
    if (!target) return;
    const confirmed = window.confirm(`Log out of LinkedIn session for "${target.username}"? This will terminate the active session.`);
    if (!confirmed) return;

    setLoggingOutSession(true);
    try {
      await apiFetch('/api/session/logout', {
        method: 'POST',
        body: JSON.stringify({ userId: target.id, username: target.username })
      });
      showToast(`Logged out of LinkedIn session for ${target.username}`, 'info');
      setIsManualAddMode(false);
      setInCardOtpMode(false);
      await loadAccounts();
    } catch (err) {
      showToast(`Logout failed: ${err.message}`, 'error');
    } finally {
      setLoggingOutSession(false);
    }
  };

  // ── Resync Session (Reload & Re-validate session) ──────────────
  const handleResyncSession = async (account) => {
    const target = account || currentAccount;
    if (!target) return;
    if (!target.has_saved_session && !target.storage_state_json && !target.li_at_token) {
      showToast(`No saved session found for "${target.username}". Please login first.`, 'warning');
      return;
    }

    setResyncingSessionId(target.id);
    setTerminalLogs(prev => [...prev.slice(-35), `[DigiLink] Re-syncing session for ${target.username}...`]);
    showToast(`Re-syncing session for "${target.username}"...`, 'info');

    try {
      const res = await apiFetch('/api/session/resync', {
        method: 'POST',
        body: JSON.stringify({ userId: target.id, username: target.username })
      });

      if (res.success) {
        showToast(`Session for "${target.username}" is verified and active!`, 'success');
        setTerminalLogs(prev => [...prev.slice(-35), `[Success] Session re-validated and active for ${target.username}`]);
        await loadAccounts();
        await loadGlobalStats();
      } else {
        throw new Error(res.error || res.message || 'Session verification failed');
      }
    } catch (err) {
      showToast(`Resync failed: ${err.message}`, 'error');
      setTerminalLogs(prev => [...prev.slice(-35), `[Error] ${err.message}`]);
    } finally {
      setResyncingSessionId(null);
    }
  };

  // ── Company Search Action ─────────────────────────────────────────────────
  const handleCompanySearch = async (e) => {
    if (e) e.preventDefault();
    if (!companyKeyword.trim()) {
      showToast('Please enter a company name or keyword', 'warning');
      return;
    }
    if (!currentAccount) {
      showToast('Select an active LinkedIn account first', 'warning');
      return;
    }
    setSearchingCompanies(true);
    try {
      const data = await apiFetch('/api/company/search', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount.id,
          keyword: companyKeyword.trim(),
          country: companyCountry.trim() || undefined,
          countryGeoId: companyCountryGeoId.trim() || undefined,
          limit: parseInt(companyLimit, 10),
          headless: companyHeadless
        })
      });
      const list = Array.isArray(data.results) ? data.results : (Array.isArray(data.companies) ? data.companies : []);
      setCompanyResults(list);
      const meta = {
        totalFound: data.totalFound ?? list.length,
        keyword: data.keyword || companyKeyword,
        country: data.country || companyCountry,
        message: data.message
      };
      setCompanySearchMeta(meta);
      try {
        localStorage.setItem('last_company_search_results', JSON.stringify(list));
        localStorage.setItem('last_company_search_meta', JSON.stringify(meta));
      } catch (e) {}
      setCompanyFilterQuery('');
      if (list.length > 0) {
        showToast(data.message || `Retrieved complete details for ${list.length} companies`, 'success');
      } else {
        showToast(data.message || 'No companies found matching your criteria', 'info');
      }
    } catch (err) {
      showToast(`Company search failed: ${err.message}`, 'error');
    } finally {
      setSearchingCompanies(false);
    }
  };

  // ── People Search Action ──────────────────────────────────────────────────
  const handlePeopleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!currentAccount) {
      showToast('Select an active LinkedIn account first', 'warning');
      return;
    }
    setSearchingPeople(true);
    try {
      const data = await apiFetch('/api/people/search', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount.id,
          keywords: peopleKeywords.trim() || undefined,
          designation: peopleDesignation.trim() || undefined,
          countries: peopleCountries,
          currentCompany: peopleCompany.trim() || undefined,
          network: peopleNetwork.trim() || undefined,
          limit: parseInt(peopleLimit, 10),
          headless: peopleHeadless
        })
      });
      const profiles = Array.isArray(data.results) ? data.results : (Array.isArray(data.people) ? data.people : []);
      setPeopleResults(profiles);
      const pMeta = {
        totalFound: data.totalFound ?? profiles.length,
        searchUrl: data.searchUrl || '',
        message: data.message || '',
        query: data.query || null
      };
      setPeopleSearchMeta(pMeta);
      try {
        localStorage.setItem('last_people_search_results', JSON.stringify(profiles));
        localStorage.setItem('last_people_search_meta', JSON.stringify(pMeta));
      } catch (e) {}
      setPeopleFilterQuery('');
      if (profiles.length > 0) {
        showToast(data.message || `Found ${profiles.length} matching profile${profiles.length === 1 ? '' : 's'}`, 'success');
      } else {
        showToast(data.message || 'No matching profiles found with current filters.', 'info');
      }
    } catch (err) {
      showToast(`People search failed: ${err.message}`, 'error');
    } finally {
      setSearchingPeople(false);
    }
  };

  // ── Switch from Company result to People Search for that company ──────────
  const searchEmployeesOfCompany = (company) => {
    setSearchVertical('people');
    setPeopleCompany(company.companyId || company.numericCompanyId || company.name);
    setPeopleDesignation('');
    showToast(`Filtering people for company: ${company.name}`, 'info');
  };

  // ── Conversation Studio: Load Thread Messages ─────────────────────────────
  const loadThreadMessages = async (queryTarget, conversationObj = null) => {
    const target = (queryTarget || threadQuery || '').trim();
    if (!target) return;
    if (conversationObj) {
      setSelectedConversation(conversationObj);
    }
    setThreadQuery(target);
    setReadingThread(true);
    try {
      const data = await apiFetch('/api/messages/thread/read', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount?.id,
          threadUrl: target,
          threadUrlOrId: target,
          threadId: conversationObj?.threadId || (target.startsWith('2-') ? target : undefined),
          profileUrl: conversationObj?.participantProfileUrl || target,
          headless: true
        })
      });
      setThreadData(data);
      showToast('Messages loaded successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReadingThread(false);
    }
  };

  // ── Send Direct Message Modal Action ───────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgBody.trim()) return;
    setSendingMsg(true);
    try {
      const res = await apiFetch('/api/messages/thread/reply', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount?.id,
          threadId: msgRecipient.threadId || undefined,
          profileUrl: msgRecipient.profileUrl || undefined,
          message: msgBody.trim(),
          headless: true
        })
      });
      if (res.success) {
        showToast(`Message delivered to ${msgRecipient.name}!`, 'success');
        setMsgModalOpen(false);
        setMsgBody('');
      } else {
        throw new Error(res.error || 'Could not send message');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  // ── Send Direct Connection Request Action ──────────────────────────────────
  const handleSendConnection = async (e) => {
    e.preventDefault();
    setSendingConnect(true);
    try {
      const res = await apiFetch('/api/connect/invite', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount?.id,
          targetUrl: connectRecipient.profileUrl || connectRecipient.vanity,
          note: connectNote.trim() || undefined,
          headless: true
        })
      });
      if (res.success) {
        showToast(`Invitation sent to ${connectRecipient.name}!`, 'success');
        setConnectModalOpen(false);
        setConnectNote('');
        loadGlobalStats();
      } else {
        throw new Error(res.message || 'Invitation failed');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingConnect(false);
    }
  };

  // ── Direct Outreach Tab Pre-flight Status Check ───────────────────────────
  const handleCheckOutreachStatus = async () => {
    if (!outreachTarget.trim()) {
      showToast('Enter a LinkedIn profile URL or vanity name', 'warning');
      return;
    }
    setCheckingPreflight(true);
    setPreflightStatus(null);
    try {
      const data = await apiFetch('/api/connect/check-status', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount?.id,
          targetUrl: outreachTarget.trim()
        })
      });
      setPreflightStatus(data);
      if (data.isConnected) {
        showToast(`Already connected with ${data.recipientName || outreachTarget}!`, 'info');
      } else if (data.isPending) {
        showToast(`Invitation to ${data.recipientName || outreachTarget} is pending.`, 'warning');
      } else {
        showToast(`Ready to connect with ${data.recipientName || outreachTarget}!`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCheckingPreflight(false);
    }
  };

  // ── Direct Outreach Send ──────────────────────────────────────────────────
  const handleSendDirectOutreach = async (e) => {
    e.preventDefault();
    if (!outreachTarget.trim()) return;
    setSendingOutreach(true);
    try {
      const data = await apiFetch('/api/connect/invite', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentAccount?.id,
          targetUrl: outreachTarget.trim(),
          note: outreachNote.trim() || undefined,
          headless: true
        })
      });
      if (data.success) {
        showToast(`Invitation sent to ${data.recipientName || outreachTarget}!`, 'success');
        setOutreachTarget('');
        setOutreachNote('');
        setPreflightStatus(null);
        loadSentToday();
        loadGlobalStats();
      } else {
        throw new Error(data.message || 'Invitation failed');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingOutreach(false);
    }
  };

  // ── Load Sent Today Invitations ───────────────────────────────────────────
  const loadSentToday = useCallback(async () => {
    if (!currentAccount) return;
    setLoadingSentToday(true);
    try {
      const data = await apiFetch('/api/connect/sent-today', {
        method: 'POST',
        body: JSON.stringify({ userId: currentAccount.id, headless: true })
      });
      setSentTodayItems(data.invitations || []);
      showToast(`Scanned ${data.invitations?.length || 0} invitations sent today`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingSentToday(false);
    }
  }, [currentAccount, apiFetch, showToast]);

  // ── Unified 1-Click Scan & Index ──────────────────────────────────────────
  const handleScanAndIndex = async () => {
    if (!currentAccount) return;
    setScanningAccepted(true);
    try {
      const data = await apiFetch('/api/account/scan-index', {
        method: 'POST',
        body: JSON.stringify({ userId: currentAccount.id, limit: 60, headless: true })
      });
      if (data && (data.success || data.connections)) {
        setScanIndexData(data);
        try {
          localStorage.setItem('last_scan_index_data', JSON.stringify(data));
        } catch {}

        const scraped = data.connections?.allScraped || [];
        setScanIndexConnections(scraped);

        const convos = data.conversations?.conversations || [];
        setIndexedConversations(convos);

        setTrackingSubTab('recent_connections');
        showToast(data.message || `Scan & Index complete: ${scraped.length} connections and ${convos.length} conversations indexed!`, 'success');
        loadTrackedContacts();
        loadGlobalStats();
      } else {
        throw new Error(data.message || 'Scan & Index returned unsuccessful status');
      }
    } catch (err) {
      showToast(`Scan & Index error: ${err.message}`, 'error');
    } finally {
      setScanningAccepted(false);
    }
  };

  // ── Load Tracked Contacts from DB ─────────────────────────────────────────
  const loadTrackedContacts = useCallback(async () => {
    if (!currentAccount) return;
    if (trackingSubTab === 'recent_connections' || trackingSubTab === 'conversations') return;
    setLoadingTracked(true);
    try {
      let endpoint = '/api/connections/history';
      if (trackingSubTab === 'accepted') endpoint = '/api/connections/accepted';
      if (trackingSubTab === 'pending') endpoint = '/api/connections/pending';
      const data = await apiFetch(`${endpoint}?userId=${currentAccount.id}`);
      setTrackedContacts(data.contacts || data.accepted || data.pending || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingTracked(false);
    }
  }, [currentAccount, trackingSubTab, apiFetch, showToast]);

  useEffect(() => {
    if (activeTab === 'tracking' && currentAccount) {
      loadTrackedContacts();
    }
  }, [activeTab, trackingSubTab, currentAccount, loadTrackedContacts]);

  // ── Load Team Users for Admin / Manager ───────────────────────────────────
  const loadTeamUsers = useCallback(async () => {
    if (!token || !appUser) return;
    if (appUser.role === 'user') return; // users cannot manage team
    setLoadingTeam(true);
    try {
      const endpoint = appUser.role === 'admin' ? '/api/admin/users' : '/api/manager/my-users';
      const data = await apiFetch(endpoint);
      setTeamUsers(data.users || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingTeam(false);
    }
  }, [token, appUser, apiFetch, showToast]);

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamUsers();
    }
  }, [activeTab, loadTeamUsers]);

  // ── Create Team User (Role-Enforced) ──────────────────────────────────────
  const handleCreateTeamUser = async (e) => {
    e.preventDefault();
    if (!newTeamEmail || !newTeamPassword) return;
    setCreatingTeamUser(true);
    try {
      let endpoint = '/api/manager/my-users';
      let payload = { email: newTeamEmail.trim(), password: newTeamPassword };

      if (appUser?.role === 'admin') {
        endpoint = '/api/admin/users';
        payload = {
          email: newTeamEmail.trim(),
          password: newTeamPassword,
          role: newTeamRole,
          manager_id: newTeamRole === 'user' && newTeamManagerId ? parseInt(newTeamManagerId, 10) : undefined
        };
      }

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`User ${newTeamEmail} created successfully!`, 'success');
      setTeamModalOpen(false);
      setNewTeamEmail('');
      setNewTeamPassword('');
      setNewTeamManagerId('');
      loadTeamUsers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreatingTeamUser(false);
    }
  };

  // ── Delete Team User ──────────────────────────────────────────────────────
  const handleDeleteTeamUser = async (userId) => {
    if (!confirm('Are you sure you want to remove this user from the organization?')) return;
    setDeletingUserId(userId);
    try {
      const endpoint = appUser?.role === 'admin' ? `/api/admin/users/${userId}` : `/api/manager/my-users/${userId}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      showToast('User removed successfully', 'success');
      loadTeamUsers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  // ── Country Filter & Helper Functions ─────────────────────────────────────
  const toggleCountry = (geoId) => {
    setPeopleCountries(prev => {
      if (prev.includes(geoId)) {
        return prev.filter(g => g !== geoId);
      } else {
        return [...prev, geoId];
      }
    });
  };

  const removePeopleCountry = (geoId) => {
    setPeopleCountries(prev => prev.filter(g => g !== geoId));
  };

  const handleResetPeopleFilters = () => {
    setPeopleKeywords('');
    setPeopleDesignation('');
    setPeopleCompany('');
    setPeopleCountries([]);
    setPeopleNetwork('');
    setPeopleLimit(25);
    showToast('Reset all people search filters', 'info');
  };

  const activePeopleFiltersCount = useMemo(() => {
    let count = 0;
    if (peopleKeywords.trim()) count++;
    if (peopleDesignation.trim()) count++;
    if (peopleCompany.trim()) count++;
    if (peopleCountries.length > 0) count++;
    if (peopleNetwork.trim()) count++;
    return count;
  }, [peopleKeywords, peopleDesignation, peopleCompany, peopleCountries, peopleNetwork]);

  // ── Filtered Contacts ─────────────────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    if (!trackingFilter.trim()) return trackedContacts;
    const q = trackingFilter.toLowerCase();
    return trackedContacts.filter(c =>
      (c.recipient_name && c.recipient_name.toLowerCase().includes(q)) ||
      (c.recipient_vanity_name && c.recipient_vanity_name.toLowerCase().includes(q)) ||
      (c.recipient_headline && c.recipient_headline.toLowerCase().includes(q))
    );
  }, [trackedContacts, trackingFilter]);

  // ── Filtered Live Scanned Connections ───────────────────────────────────────
  const filteredScanConnections = useMemo(() => {
    if (!trackingFilter.trim()) return scanIndexConnections;
    const q = trackingFilter.toLowerCase();
    return scanIndexConnections.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.vanityName && c.vanityName.toLowerCase().includes(q)) ||
      (c.headline && c.headline.toLowerCase().includes(q)) ||
      (c.connectedTime && c.connectedTime.toLowerCase().includes(q))
    );
  }, [scanIndexConnections, trackingFilter]);

  // ── Filtered Indexed Conversations ──────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    if (!trackingFilter.trim()) return indexedConversations;
    const q = trackingFilter.toLowerCase();
    return indexedConversations.filter(c =>
      (c.participantName && c.participantName.toLowerCase().includes(q)) ||
      (c.participantHeadline && c.participantHeadline.toLowerCase().includes(q)) ||
      (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(q))
    );
  }, [indexedConversations, trackingFilter]);

  // ── Filtered Discovered Companies ──────────────────────────────────────────
  const filteredCompanyResults = useMemo(() => {
    if (!companyFilterQuery.trim()) return companyResults;
    const q = companyFilterQuery.toLowerCase();
    return companyResults.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.industry && c.industry.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.specialties && c.specialties.toLowerCase().includes(q)) ||
      (c.tagline && c.tagline.toLowerCase().includes(q)) ||
      (c.companyUrl && c.companyUrl.toLowerCase().includes(q)) ||
      (c.companySize && c.companySize.toLowerCase().includes(q)) ||
      (c.employeeCount && c.employeeCount.toLowerCase().includes(q))
    );
  }, [companyResults, companyFilterQuery]);

  // ── Filtered Studio Threads ────────────────────────────────────────────────
  const filteredStudioThreads = useMemo(() => {
    if (!studioThreadSearch.trim()) return indexedConversations;
    const q = studioThreadSearch.toLowerCase();
    return indexedConversations.filter(c =>
      (c.participantName && c.participantName.toLowerCase().includes(q)) ||
      (c.participantHeadline && c.participantHeadline.toLowerCase().includes(q)) ||
      (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(q))
    );
  }, [indexedConversations, studioThreadSearch]);

  // ── Managers List (for Admin dropdown) ────────────────────────────────────
  const availableManagers = useMemo(() => {
    return teamUsers.filter(u => u.role === 'manager');
  }, [teamUsers]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased font-sans">

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200/90 shadow-sm flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-black text-lg">
              D
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">DigiLink</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 border border-blue-200">PRO</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">LinkedIn Automation Hub</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-600 p-1"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('accounts'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'accounts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Icon name="key" className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Accounts & Sessions</span>
          </button>

          <button
            onClick={() => { setActiveTab('search'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Icon name="search" className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Search & Intelligence</span>
          </button>

          <button
            onClick={() => { setActiveTab('outreach'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'outreach'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Icon name="send" className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Direct Outreach</span>
          </button>

          <button
            onClick={() => { setActiveTab('tracking'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'tracking'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Icon name="check-circle" className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Accepted & Tracking</span>
          </button>

          <button
            onClick={() => { setActiveTab('messaging'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'messaging'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Icon name="chat" className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Conversation Studio</span>
          </button>

          {/* Role-Specific Team Management Link */}
          <button
            onClick={() => { setActiveTab('team'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'team'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Icon name="shield" className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {appUser?.role === 'user' ? 'My Profile & Access' : 'Team & Hierarchy'}
            </span>
          </button>
        </nav>

        {/* Sidebar Footer: Profile Section */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          {appUser ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm flex items-center justify-between">
              <div
                className="flex items-center space-x-2.5 min-w-0 cursor-pointer hover:opacity-80 transition"
                onClick={() => setProfileModalOpen(true)}
                title="View Profile Details"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0 uppercase shadow-sm">
                  {appUser.email.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight">{appUser.email}</p>
                  <span className={`inline-block mt-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${appUser.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : appUser.role === 'manager'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                    {appUser.role}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePlatformLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-xl transition shadow-sm"
            >
              Sign In to DigiLink
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER (Offset by sidebar width on desktop) ───── */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">

        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Icon name="menu" className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900 capitalize">
                {activeTab === 'accounts' && 'LinkedIn Accounts & Sessions'}
                {activeTab === 'search' && 'Search & Outreach Intelligence'}
                {activeTab === 'outreach' && 'Direct Connection Outreach'}
                {activeTab === 'tracking' && 'Accepted Connections & Tracking'}
                {activeTab === 'messaging' && 'Conversation & Message Studio'}
                {activeTab === 'team' && (appUser?.role === 'user' ? 'My Profile & Access' : 'Team & Hierarchy Management')}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">DigiLink Enterprise Orchestrator</p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center space-x-3">
            {/* Active Account Dropdown */}
            <div className="flex items-center space-x-2 bg-slate-100/80 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <span className={`w-2 h-2 rounded-full ${currentAccount?.storage_state_json ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-slate-500 hidden sm:inline">Active:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-transparent text-slate-800 font-bold outline-none cursor-pointer pr-1 max-w-[150px] truncate"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} className="text-slate-900">
                    {acc.username} {acc.storage_state_json ? '🟢' : '⚪'}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Avatar Quick Button */}
            {appUser && (
              <button
                onClick={() => setProfileModalOpen(true)}
                className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 hover:ring-2 hover:ring-blue-300 transition"
                title="Profile Details"
              >
                {appUser.email.charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </header>

        {/* ── KPI METRICS RIBBON ─────────────────────────────────────────── */}
        <div className="px-4 lg:px-8 pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Icon name="users" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Accounts</p>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{stats.totalAccounts}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Icon name="check-circle" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Accepted Today</p>
                <h3 className="text-lg font-bold text-emerald-600 tracking-tight">{stats.acceptedToday}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Icon name="sparkles" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Total Tracked</p>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{stats.totalTracked}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Icon name="send" className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Pending</p>
                <h3 className="text-lg font-bold text-amber-600 tracking-tight">{stats.pending}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Icon name="shield" className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">Acceptance Rate</p>
                  <h3 className="text-lg font-bold text-indigo-600 tracking-tight">{stats.rate}</h3>
                </div>
              </div>
              <button
                onClick={loadGlobalStats}
                title="Refresh Metrics"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <Icon name="refresh" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── TAB CONTENT ───────────────────────────────────────────────── */}
        <main className="px-4 lg:px-8 py-6 flex-1">

          {/* ── TAB 1: ACCOUNTS & SESSIONS ────────────────────────────────── */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── CARD: LOGIN FORM / OTP FORM / LINKEDIN PROFILE CARD ── */}
                {inCardOtpMode ? (
                  /* State 2: OTP Verification Form */
                  <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs">
                          🔐
                        </div>
                        <span>LinkedIn Security PIN</span>
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        Awaiting PIN
                      </span>
                    </div>

                    <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                      <p className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                        <Icon name="info" className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Security Challenge Active</span>
                      </p>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        LinkedIn sent a verification PIN code for <strong className="font-semibold text-blue-950">{otpChallengeUser}</strong>. Enter it below to complete authentication.
                      </p>
                    </div>

                    <form onSubmit={handleSubmitOtp} className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Verification Code (PIN / OTP)</label>
                        <input
                          type="text"
                          autoFocus
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value)}
                          placeholder="e.g. 123456"
                          maxLength="8"
                          className="w-full text-center text-xl font-mono tracking-widest py-3 rounded-xl border border-slate-300 text-slate-900 outline-none font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-sm transition"
                        />
                      </div>

                      <div className="flex space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setInCardOtpMode(false);
                            setOtpModalOpen(false);
                            setOtpCode('');
                          }}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingOtp || !otpCode.trim()}
                          className="flex-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-1.5"
                        >
                          {submittingOtp && <Spinner className="w-3.5 h-3.5" />}
                          <span>{submittingOtp ? 'Verifying PIN...' : 'Verify & Complete Login'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (hasActiveSession && !isManualAddMode) ? (
                  /* State 3: LinkedIn Profile Card */
                  <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
                    <div>
                      {/* LinkedIn Header Banner */}
                      <div className="h-20 bg-gradient-to-r from-[#0a66c2] via-[#004182] to-[#002f5c] relative px-4 flex items-start justify-between pt-3">
                        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[10px] font-bold">
                          <Icon name="linkedin" className="w-3 h-3 text-white" />
                          <span>Connected LinkedIn</span>
                        </div>
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          <span>Active</span>
                        </span>
                      </div>

                      {/* Profile Details with Overlapping Circular Avatar */}
                      <div className="px-6 pb-4 pt-0 space-y-4">
                        <div className="flex items-end justify-between -mt-10">
                          <div className="relative">
                            <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl uppercase tracking-wider">
                              {currentAccount.username.charAt(0)}
                            </div>
                            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" title="Session active"></span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-400">ID: #{currentAccount.id}</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 truncate" title={currentAccount.username}>
                            {currentAccount.username}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">LinkedIn Member • Cloud Synchronized</p>
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Session Active & Ready</span>
                          </div>
                        </div>

                        {/* Session Details Box */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-slate-500 flex items-center space-x-1.5">
                              <Icon name="check" className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Session Status</span>
                            </span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                              Authenticated
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-slate-500 flex items-center space-x-1.5">
                              <Icon name="clock" className="w-3.5 h-3.5 text-slate-400" />
                              <span>Last Login</span>
                            </span>
                            <span className="font-semibold text-slate-700">
                              {currentAccount.last_login_at ? new Date(currentAccount.last_login_at).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions: CTA to Logout LinkedIn & Inspect */}
                    <div className="p-6 pt-0 space-y-2 border-t border-slate-100 mt-2 pt-4">
                      <button
                        onClick={() => handleLogoutLinkedIn(currentAccount)}
                        disabled={loggingOutSession}
                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {loggingOutSession ? <Spinner className="w-3.5 h-3.5" /> : <Icon name="logout" className="w-4 h-4 text-rose-600" />}
                        <span>{loggingOutSession ? 'Logging out...' : 'Logout LinkedIn'}</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleResyncSession(currentAccount)}
                          disabled={resyncingSessionId === currentAccount.id}
                          title="Reload & verify session"
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                        >
                          {resyncingSessionId === currentAccount.id ? (
                            <Spinner className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Icon name="refresh" className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{resyncingSessionId === currentAccount.id ? 'Re-syncing...' : 'Resync Session'}</span>
                        </button>

                        {appUser?.role === 'admin' && (
                          <button
                            onClick={() => setIsManualAddMode(true)}
                            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center space-x-1.5"
                          >
                            <Icon name="plus" className="w-3.5 h-3.5" />
                            <span>Add Another</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* State 1: Connect / Login Form */
                  <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <Icon name="plus" className="w-4 h-4 text-blue-600" />
                        <span>{isManualAddMode ? 'Add Another Account' : 'Connect LinkedIn Account'}</span>
                      </h3>
                      {isManualAddMode ? (
                        <button
                          onClick={() => setIsManualAddMode(false)}
                          className="text-[11px] text-slate-500 hover:text-slate-700 underline font-medium"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Direct Login
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Enter credentials to initiate automated session authentication and connection.
                    </p>

                    {appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5">
                        <Icon name="info" className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-xs text-amber-800 leading-relaxed">
                          <span className="font-bold">1 Account Limit:</span> Your {appUser?.role === 'manager' ? 'Manager' : 'User'} role allows 1 connected LinkedIn account. Disconnect your current account from the table before adding another.
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleAddAccount} className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn Email / Username</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={e => setNewUsername(e.target.value)}
                          placeholder="e.g. member@domain.com"
                          disabled={loggingInAccount || addingAccount || (appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode)}
                          className="w-full bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm disabled:bg-slate-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          disabled={loggingInAccount || addingAccount || (appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode)}
                          className="w-full bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm disabled:bg-slate-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Proxy Server (Optional)</label>
                        <input
                          type="text"
                          value={newProxy}
                          onChange={e => setNewProxy(e.target.value)}
                          placeholder="http://user:pass@host:port"
                          disabled={loggingInAccount || addingAccount || (appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode)}
                          className="w-full bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm disabled:bg-slate-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loggingInAccount || addingAccount || (appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {(loggingInAccount || addingAccount) && <Spinner className="w-3.5 h-3.5" />}
                        <span>
                          {loggingInAccount || addingAccount
                            ? 'Connecting & Authenticating...'
                            : (appUser?.role !== 'admin' && accounts.length >= 1 && !isManualAddMode)
                              ? 'Account Limit Reached (1/1 Max)'
                              : 'Connect & Login LinkedIn'}
                        </span>
                      </button>
                    </form>
                  </div>
                )}

                {/* Accounts Table */}
                <div id="registered-accounts-table" className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-4 scroll-mt-20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <Icon name="key" className="w-4 h-4 text-blue-600" />
                        <span>Registered LinkedIn Accounts</span>
                      </h3>
                      <p className="text-xs text-slate-500">Accounts available for automated search, outreach & session sync.</p>
                    </div>
                    <button
                      onClick={loadAccounts}
                      disabled={loadingAccounts}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                    >
                      <Icon name="refresh" className={`w-3.5 h-3.5 ${loadingAccounts ? 'animate-spin' : ''}`} />
                      <span>Reload</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3.5">Account</th>
                          <th className="py-2.5 px-3.5">Session Status</th>
                          <th className="py-2.5 px-3.5">Cron Login</th>
                          <th className="py-2.5 px-3.5">Last Login</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingAccounts ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-400">
                              <Spinner className="w-5 h-5 mx-auto mb-2 text-blue-600" />
                              <span>Loading accounts...</span>
                            </td>
                          </tr>
                        ) : accounts.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-500">
                              No LinkedIn accounts registered yet. Use the form to add one.
                            </td>
                          </tr>
                        ) : accounts.map(acc => {
                          const hasSession = Boolean(acc.has_saved_session || acc.storage_state_json || acc.li_at_token || acc.last_login_status === 'success');
                          const isSelected = String(acc.id) === String(selectedAccountId);
                          return (
                            <tr key={acc.id} className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/50' : ''}`}>
                              <td className="py-3 px-3.5 font-medium text-slate-900 flex items-center space-x-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700">
                                  {acc.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{acc.username}</p>
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {acc.id}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3.5">
                                {hasSession ? (
                                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>Active Session</span>
                                  </span>
                                ) : loggingInAccountId === acc.id ? (
                                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                    <Spinner className="w-3 h-3 text-amber-600" />
                                    <span>{inCardOtpMode ? 'Awaiting PIN' : 'Authenticating...'}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    <span>Offline</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${acc.login_try ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                  {acc.login_try ? 'Enabled' : 'Disabled'}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-slate-500 text-[11px]">
                                {acc.last_login_at ? new Date(acc.last_login_at).toLocaleDateString() : 'Never'}
                              </td>
                              <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                                {!hasSession ? (
                                  <button
                                    onClick={() => {
                                      if (loggingInAccountId === acc.id && inCardOtpMode) {
                                        setOtpModalOpen(true);
                                      } else {
                                        handleDirectLogin(acc);
                                      }
                                    }}
                                    disabled={loggingInAccount && loggingInAccountId !== acc.id}
                                    className={`px-2.5 py-1 font-semibold rounded-lg text-[11px] transition shadow-xs inline-flex items-center ${loggingInAccountId === acc.id && inCardOtpMode
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                                      }`}
                                  >
                                    {loggingInAccountId === acc.id && <Spinner className={`w-3 h-3 mr-1 ${loggingInAccountId === acc.id && inCardOtpMode ? 'text-white' : ''}`} />}
                                    <span>
                                      {loggingInAccountId === acc.id
                                        ? (inCardOtpMode ? 'Enter OTP' : 'Logging in...')
                                        : 'Login'}
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleLogoutLinkedIn(acc)}
                                    disabled={loggingOutSession}
                                    title="Logout active LinkedIn session"
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold rounded-lg text-[11px] transition shadow-xs"
                                  >
                                    Logout
                                  </button>
                                )}
                                <button
                                  onClick={() => handleResyncSession(acc)}
                                  disabled={resyncingSessionId === acc.id}
                                  title="Resync & reload session"
                                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-lg text-[11px] transition shadow-xs inline-flex items-center space-x-1 disabled:opacity-50"
                                >
                                  {resyncingSessionId === acc.id ? (
                                    <Spinner className="w-3 h-3 text-blue-600" />
                                  ) : (
                                    <Icon name="refresh" className="w-3 h-3 text-blue-600" />
                                  )}
                                  <span>{resyncingSessionId === acc.id ? 'Resyncing...' : 'Resync'}</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteAccount(acc)}
                                  title="Disconnect / Remove LinkedIn Account"
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-[11px] transition shadow-xs"
                                >
                                  Disconnect
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Terminal Logs Display */}
              {terminalLogs.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 text-white shadow-md">
                  <div className="flex items-center justify-between text-xs text-blue-400 font-mono font-bold">
                    <span className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                      <span>Live Automation Stream</span>
                    </span>
                    <button onClick={() => setTerminalLogs([])} className="text-slate-400 hover:text-white">Clear</button>
                  </div>
                  <div className="bg-black/50 rounded-xl p-3 font-mono text-[11px] text-emerald-400 h-36 overflow-y-auto space-y-1">
                    {terminalLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: SEARCH & INTELLIGENCE ──────────────────────────────── */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Search Sub-Tabs Header */}
              <div className="bg-white border border-slate-200 p-1.5 rounded-2xl flex max-w-sm shadow-sm">
                <button
                  onClick={() => setSearchVertical('companies')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${searchVertical === 'companies'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Icon name="building" className="w-4 h-4" />
                  <span>Companies Search</span>
                </button>

                <button
                  onClick={() => setSearchVertical('people')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${searchVertical === 'people'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Icon name="users" className="w-4 h-4" />
                  <span>People Search</span>
                </button>
              </div>

              {/* Company Search Panel */}
              {searchVertical === 'companies' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Icon name="building" className="w-4 h-4 text-blue-600" />
                      <span>Search LinkedIn Companies</span>
                    </h3>

                    <form onSubmit={handleCompanySearch} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Company Keyword / Name</label>
                          <input
                            type="text"
                            value={companyKeyword}
                            onChange={e => setCompanyKeyword(e.target.value)}
                            placeholder="e.g. OpenAI, Stripe, SaaS, FinTech..."
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Results Limit</label>
                          <select
                            value={companyLimit}
                            onChange={e => setCompanyLimit(e.target.value)}
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                          >
                            <option value="10">10 Companies</option>
                            <option value="20">20 Companies</option>
                            <option value="50">50 Companies</option>
                          </select>
                        </div>
                      </div>

                      {/* Country Location Filter */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                            <Icon name="map-pin" className="w-3.5 h-3.5 text-rose-500" />
                            <span>Country Location Filter</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                          <select
                            value={companyCountryGeoId}
                            onChange={e => {
                              const val = e.target.value;
                              setCompanyCountryGeoId(val);
                              const match = ALL_COUNTRIES.find(c => c.geoId === val);
                              setCompanyCountry(match ? match.name : '');
                            }}
                            className="w-full bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm cursor-pointer"
                          >
                            <option value="">🌐 All Countries (Global / Any) — No Filter</option>
                            <optgroup label="Popular Regions">
                              {POPULAR_COUNTRIES.map(c => (
                                <option key={c.geoId} value={c.geoId}>
                                  {c.flag} {c.name} ({c.code})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="All Supported Countries (A - Z)">
                              {ALL_COUNTRIES_SORTED.map(c => (
                                <option key={c.geoId} value={c.geoId}>
                                  {c.flag} {c.name} ({c.code})
                                </option>
                              ))}
                            </optgroup>
                          </select>

                          {companyCountryGeoId && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold flex items-center space-x-1.5 shadow-2xs">
                                <span>{ALL_COUNTRIES.find(c => c.geoId === companyCountryGeoId)?.flag || '🌐'}</span>
                                <span>{companyCountry}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => { setCompanyCountry(''); setCompanyCountryGeoId(''); }}
                                className="text-[11px] text-rose-600 hover:underline font-semibold"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={companyHeadless}
                            onChange={e => setCompanyHeadless(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>Headless Execution (Background)</span>
                        </label>

                        <button
                          type="submit"
                          disabled={searchingCompanies}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center space-x-2"
                        >
                          {searchingCompanies ? <Spinner className="w-4 h-4" /> : <Icon name="search" className="w-4 h-4" />}
                          <span>{searchingCompanies ? 'Searching Companies...' : 'Search Companies'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Company Results Section */}
                  <div className="space-y-4">
                    {/* Header Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          <Icon name="building" className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-slate-900">Verified Companies Discovered</h3>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {companyResults.length}
                            </span>
                            {companySearchMeta?.keyword && (
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                query: "{companySearchMeta.keyword}"
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {companySearchMeta?.message || 'Corporate organizations with verified employee rosters'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {companyResults.length > 0 && (
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                            <button
                              type="button"
                              onClick={() => setCompanyViewMode('cards')}
                              className={`px-3 py-1 rounded-lg font-semibold transition ${
                                companyViewMode === 'cards' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Cards
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompanyViewMode('table')}
                              className={`px-3 py-1 rounded-lg font-semibold transition ${
                                companyViewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        )}

                        {companyResults.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyResults([]);
                              setCompanySearchMeta(null);
                              setCompanyFilterQuery('');
                              try {
                                localStorage.removeItem('last_company_search_results');
                                localStorage.removeItem('last_company_search_meta');
                              } catch (e) {}
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold transition shadow-xs"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Top KPI Metrics Strip (when companies exist) */}
                    {companyResults.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Discovered</span>
                          <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">{companyResults.length} Companies</span>
                        </div>
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verified Organizations</span>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-lg font-extrabold text-blue-600">
                              {companyResults.filter(c => c.isVerified).length}
                            </span>
                            <span className="text-xs text-slate-500">Verified</span>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deep Enriched</span>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-lg font-extrabold text-emerald-600">
                              {companyResults.filter(c => c.crawlStatus === 'complete').length}
                            </span>
                            <span className="text-xs text-slate-500">Profiles</span>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audience Reach</span>
                          <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                            {companyResults.filter(c => c.followers).map(c => c.followers.replace(/\s+/g, ' ').trim()).join(', ') || 'Global'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Filter Within Extracted Results (if > 1 company) */}
                    {companyResults.length > 1 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={companyFilterQuery}
                          onChange={e => setCompanyFilterQuery(e.target.value)}
                          placeholder="Filter extracted companies by name, industry, location, or specialties..."
                          className="w-full bg-white border border-slate-200/90 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-xs"
                        />
                        <div className="absolute left-3 top-2.5 text-slate-400">
                          <Icon name="search" className="w-3.5 h-3.5" />
                        </div>
                        {companyFilterQuery && (
                          <button
                            onClick={() => setCompanyFilterQuery('')}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}

                    {/* Empty or Loaded state */}
                    {companyResults.length === 0 ? (
                      <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
                          <Icon name="building" className="w-6 h-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">No Companies Discovered Yet</h4>
                          <p className="text-xs text-slate-500">
                            Enter an organization name, keyword, or domain above and click <span className="font-semibold text-blue-600">Search Companies</span> to discover verified corporate profiles and unlock their employees.
                          </p>
                        </div>
                      </div>
                    ) : companyViewMode === 'table' ? (
                      /* Table View Mode */
                      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr>
                                <th className="py-2.5 px-4">Company</th>
                                <th className="py-2.5 px-4">Industry</th>
                                <th className="py-2.5 px-4">Location</th>
                                <th className="py-2.5 px-4">Scale / Headcount</th>
                                <th className="py-2.5 px-4">Followers</th>
                                <th className="py-2.5 px-4">Website</th>
                                <th className="py-2.5 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredCompanyResults.map((c, i) => {
                                const extUrl = c.companyUrl || c.linkedinUrl || (c.companyId ? `https://www.linkedin.com/company/${c.companyId}/` : null);
                                const vanity = (c.companyUrl || '').match(/company\/([a-zA-Z0-9_-]+)/i)?.[1] || '';
                                const cleanLocation = (c.location || '').replace(/\s*Follow\s*$/i, '').replace(/\s+/g, ' ').trim();
                                const followersStr = c.followers ? c.followers.replace(/\s+/g, ' ').trim() : '—';
                                let cleanDomain = '';
                                if (c.website) {
                                  try {
                                    cleanDomain = new URL(c.website.startsWith('http') ? c.website : `https://${c.website}`).hostname.replace(/^www\./, '');
                                  } catch {
                                    cleanDomain = c.website;
                                  }
                                }

                                return (
                                  <tr key={c.companyId || i} className="hover:bg-slate-50/80 transition">
                                    <td className="py-3.5 px-4">
                                      <div className="flex items-center space-x-3">
                                        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 overflow-hidden shrink-0 shadow-2xs">
                                          {c.logoUrl ? (
                                            <img
                                              src={c.logoUrl}
                                              alt={c.name}
                                              className="w-full h-full object-cover"
                                              onError={e => { e.currentTarget.style.display = 'none'; }}
                                            />
                                          ) : null}
                                          <span className="text-xs select-none">{c.name ? c.name.charAt(0).toUpperCase() : 'C'}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center space-x-1.5">
                                            <p className="font-bold text-slate-900 truncate">{c.name}</p>
                                            {c.isVerified && (
                                              <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold inline-flex items-center space-x-0.5" title="Verified Organization">
                                                <span>✓</span>
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                                            {vanity && <span className="font-mono text-blue-600">@{vanity}</span>}
                                            {c.companyId && <span className="font-mono">ID:{c.companyId}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                                      {c.industry || '—'}
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-500 max-w-[160px] truncate" title={cleanLocation}>
                                      {cleanLocation || '—'}
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600">
                                      <div>
                                        <span className="font-semibold text-slate-800">{c.companySize || c.employeeCount || '—'}</span>
                                        {c.companySize && c.employeeCount && c.companySize !== c.employeeCount && (
                                          <span className="text-[10px] text-slate-400 block">({c.employeeCount})</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                                      {followersStr}
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-500">
                                      {c.website ? (
                                        <a
                                          href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-blue-600 hover:underline font-mono text-[11px]"
                                        >
                                          {cleanDomain}
                                        </a>
                                      ) : '—'}
                                    </td>
                                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                                      <button
                                        onClick={() => searchEmployeesOfCompany(c)}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition shadow-2xs"
                                        title="Search all verified employees working at this company"
                                      >
                                        Find People
                                      </button>
                                      {extUrl && (
                                        <a
                                          href={extUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                                          title="Open LinkedIn Company Page"
                                        >
                                          <Icon name="linkedin" className="w-3.5 h-3.5 text-blue-700" />
                                        </a>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* Cards View Mode */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCompanyResults.map((c, i) => {
                          const extUrl = c.companyUrl || c.linkedinUrl || (c.companyId ? `https://www.linkedin.com/company/${c.companyId}/` : null);
                          const vanity = (c.companyUrl || '').match(/company\/([a-zA-Z0-9_-]+)/i)?.[1] || '';
                          const cleanLocation = (c.location || '').replace(/\s*Follow\s*$/i, '').replace(/\s+/g, ' ').trim();
                          const followersStr = c.followers ? c.followers.replace(/\s+/g, ' ').trim() : null;
                          const isExpanded = Boolean(companyExpandedDesc[c.companyId || i]);
                          let cleanDomain = '';
                          if (c.website) {
                            try {
                              cleanDomain = new URL(c.website.startsWith('http') ? c.website : `https://${c.website}`).hostname.replace(/^www\./, '');
                            } catch {
                              cleanDomain = c.website;
                            }
                          }

                          return (
                            <div
                              key={c.companyId || i}
                              className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 group"
                            >
                              <div className="space-y-3">
                                {/* Top Row: Logo + Name + Vanity Handle + Badges */}
                                <div className="flex items-start space-x-3.5">
                                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 overflow-hidden shrink-0 shadow-xs">
                                    {c.logoUrl ? (
                                      <img
                                        src={c.logoUrl}
                                        alt={c.name}
                                        className="w-full h-full object-cover"
                                        onError={e => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : null}
                                    <span className="text-sm select-none">
                                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                                    </span>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <h4 className="font-bold text-slate-900 text-sm truncate" title={c.name}>
                                        {c.name}
                                      </h4>
                                      <div className="flex items-center space-x-1 shrink-0">
                                        {c.isVerified && (
                                          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center space-x-0.5" title="Verified Organization">
                                            <span>✓</span>
                                            <span className="hidden sm:inline">Verified</span>
                                          </span>
                                        )}
                                        {c.crawlStatus === 'complete' && (
                                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold" title="Full Profile Crawled">
                                            Enriched
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Vanity & ID Row */}
                                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                                      {vanity && (
                                        <span className="font-mono text-blue-600 font-semibold truncate">@{vanity}</span>
                                      )}
                                      {c.companyId && (
                                        <span className="font-mono bg-slate-100 px-1 rounded text-slate-500">ID: {c.companyId}</span>
                                      )}
                                    </div>

                                    {/* Industry */}
                                    <p className="text-xs text-blue-700 font-semibold truncate mt-1" title={c.industry}>
                                      {c.industry || 'Corporate Organization'}
                                    </p>
                                  </div>
                                </div>

                                {/* Tagline if provided */}
                                {c.tagline && (
                                  <div className="bg-blue-50/50 border border-blue-100/70 rounded-xl p-2.5 text-[11px] text-blue-900 italic leading-snug">
                                    "{c.tagline}"
                                  </div>
                                )}

                                {/* Location */}
                                {cleanLocation && (
                                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                                    <Icon name="map-pin" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate" title={cleanLocation}>{cleanLocation}</span>
                                  </div>
                                )}

                                {/* Key Metrics Grid */}
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                                  {followersStr && (
                                    <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Followers</span>
                                      <span className="font-bold text-slate-800 truncate block">{followersStr}</span>
                                    </div>
                                  )}

                                  {(c.companySize || c.employeeCount) && (
                                    <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Employees</span>
                                      <span className="font-bold text-slate-800 truncate block">
                                        {c.companySize || c.employeeCount}
                                      </span>
                                    </div>
                                  )}

                                  {c.founded && (
                                    <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Founded</span>
                                      <span className="font-bold text-slate-800 block">{c.founded}</span>
                                    </div>
                                  )}

                                  {c.employeeCount && c.companySize && c.companySize !== c.employeeCount && (
                                    <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Headcount</span>
                                      <span className="font-bold text-slate-800 truncate block">{c.employeeCount}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Description with Show more toggle */}
                                {c.description && (
                                  <div className="text-xs text-slate-600 pt-1">
                                    <p className={`whitespace-pre-line leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                      {c.description}
                                    </p>
                                    {c.description.length > 130 && (
                                      <button
                                        type="button"
                                        onClick={() => setCompanyExpandedDesc(prev => ({ ...prev, [c.companyId || i]: !prev[c.companyId || i] }))}
                                        className="text-[11px] font-semibold text-blue-600 hover:underline mt-1"
                                      >
                                        {isExpanded ? 'Show less' : 'Read full description'}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Specialties Focus */}
                                {c.specialties && (
                                  <div className="text-[10px] text-slate-500 truncate" title={c.specialties}>
                                    <span className="font-semibold text-slate-700">Specialties:</span> {c.specialties}
                                  </div>
                                )}
                              </div>

                              {/* Direct Action Buttons */}
                              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                <button
                                  onClick={() => searchEmployeesOfCompany(c)}
                                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5"
                                  title="Search all verified employees working at this company"
                                >
                                  <Icon name="users" className="w-3.5 h-3.5" />
                                  <span>Find People</span>
                                </button>

                                {c.website && (
                                  <a
                                    href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition border border-slate-200 text-xs font-semibold flex items-center space-x-1 shrink-0"
                                    title={`Visit ${cleanDomain || 'website'}`}
                                  >
                                    <Icon name="external-link" className="w-3 h-3" />
                                    <span className="hidden sm:inline">{cleanDomain ? cleanDomain.slice(0, 14) : 'Web'}</span>
                                  </a>
                                )}

                                {extUrl && (
                                  <a
                                    href={extUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition border border-slate-200 shrink-0"
                                    title="Open LinkedIn Company Page"
                                  >
                                    <Icon name="linkedin" className="w-3.5 h-3.5 text-blue-700" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* People Search Panel */}
              {searchVertical === 'people' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-5">
                    {/* Header with Relatable Badge & Filter Reset */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                            <Icon name="users" className="w-4 h-4 text-blue-600" />
                            <span>Search LinkedIn People & Decision Makers</span>
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            All Filters Optional
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Discover target profiles across companies, job roles, and regions. Leave any field blank to search broadly.
                        </p>
                      </div>

                      {activePeopleFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetPeopleFilters}
                          className="self-start sm:self-auto text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 shadow-2xs"
                        >
                          <Icon name="refresh" className="w-3.5 h-3.5" />
                          <span>Reset All Filters ({activePeopleFiltersCount})</span>
                        </button>
                      )}
                    </div>

                    <form onSubmit={handlePeopleSearch} className="space-y-4">
                      {/* Grid 1: Keywords, Designation, Current Company */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <Icon name="search" className="w-3.5 h-3.5 text-slate-400" />
                              <span>Keywords / Person Name</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                          </label>
                          <input
                            type="text"
                            value={peopleKeywords}
                            onChange={e => setPeopleKeywords(e.target.value)}
                            placeholder="e.g. Sales Director, John Doe..."
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              <span>Target Designation / Job Title</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                          </label>
                          <input
                            type="text"
                            value={peopleDesignation}
                            onChange={e => setPeopleDesignation(e.target.value)}
                            placeholder="e.g. Founder, CEO, VP Sales..."
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <Icon name="building" className="w-3.5 h-3.5 text-slate-400" />
                              <span>Current Company</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                          </label>
                          <input
                            type="text"
                            value={peopleCompany}
                            onChange={e => setPeopleCompany(e.target.value)}
                            placeholder="e.g. Google, Microsoft, 1441..."
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Fast Designation Suggestion Pills */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-600 flex items-center space-x-1.5">
                            <Icon name="sparkles" className="w-3.5 h-3.5 text-amber-500" />
                            <span>Quick Role Suggestions (Click to fill/toggle)</span>
                          </label>
                          {peopleDesignation && (
                            <button
                              type="button"
                              onClick={() => setPeopleDesignation('')}
                              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                            >
                              Clear Role
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DESIGNATION_PRESETS.map(d => {
                            const isMatch = peopleDesignation.toLowerCase() === d.toLowerCase();
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setPeopleDesignation(isMatch ? '' : d)}
                                className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${isMatch
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                              >
                                {d} {isMatch && '✓'}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grid 2: Country Filter, Network Degree, Results Limit */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                        {/* 1. Country Filter (Renamed from Strict Country Filter with dropdown containing all countries from JSON) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                              <Icon name="map-pin" className="w-3.5 h-3.5 text-rose-500" />
                              <span>Country Filter</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                          </div>

                          <select
                            id="people-country-dropdown"
                            value={peopleCountries[0] || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) {
                                setPeopleCountries([]);
                              } else {
                                if (!peopleCountries.includes(val)) {
                                  setPeopleCountries([...peopleCountries, val]);
                                }
                              }
                            }}
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm cursor-pointer"
                          >
                            <option value="">🌐 All Countries (Global / Any) — No Filter</option>
                            <optgroup label="Popular Regions">
                              {POPULAR_COUNTRIES.map(c => (
                                <option key={c.geoId} value={c.geoId}>
                                  {c.flag} {c.name} ({c.code})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="All Supported Countries (A - Z)">
                              {ALL_COUNTRIES_SORTED.map(c => (
                                <option key={c.geoId} value={c.geoId}>
                                  {c.flag} {c.name} ({c.code})
                                </option>
                              ))}
                            </optgroup>
                          </select>

                          {/* Selected Country Chips */}
                          {peopleCountries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium">Selected ({peopleCountries.length}):</span>
                              {peopleCountries.map(geoId => {
                                const cObj = ALL_COUNTRIES.find(c => c.geoId === geoId) || { name: `Geo: ${geoId}`, flag: '🌐' };
                                return (
                                  <span
                                    key={geoId}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold"
                                  >
                                    <span>{cObj.flag}</span>
                                    <span>{cObj.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => removePeopleCountry(geoId)}
                                      className="text-blue-400 hover:text-rose-600 font-bold ml-1"
                                      title="Remove country"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => setPeopleCountries([])}
                                className="text-[10px] text-rose-600 hover:underline font-semibold ml-1"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 2. Network Degree */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <Icon name="users" className="w-3.5 h-3.5 text-blue-500" />
                              <span>Network Connection Degree</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                          </label>
                          <select
                            value={peopleNetwork}
                            onChange={e => setPeopleNetwork(e.target.value)}
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm cursor-pointer"
                          >
                            <option value="">🌐 All Degrees (1st, 2nd, 3rd+) — No Filter</option>
                            <option value="F">1st Degree Connections (Direct Connections)</option>
                            <option value="S">2nd Degree Connections (Mutual Connections)</option>
                            <option value="O">3rd+ Degree Connections (Extended Network)</option>
                          </select>
                        </div>

                        {/* 3. Results Limit */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                              <span>Results Limit</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Profiles</span>
                          </label>
                          <select
                            value={peopleLimit}
                            onChange={e => setPeopleLimit(e.target.value)}
                            className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm cursor-pointer"
                          >
                            <option value="10">10 Profiles (Fastest)</option>
                            <option value="25">25 Profiles (Balanced)</option>
                            <option value="50">50 Profiles (Deep)</option>
                            <option value="100">100 Profiles (Maximum)</option>
                          </select>
                        </div>
                      </div>

                      {/* Relatable Active Filter Summary Pill & Action Controls */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center space-x-2 text-xs">
                          {activePeopleFiltersCount === 0 ? (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                              <span>🌐</span>
                              <span>Broad Search: No filters active (searches all global LinkedIn profiles)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                              <span>🎯</span>
                              <span>Targeted Search: {activePeopleFiltersCount} active filter criteria</span>
                            </span>
                          )}

                          <label className="hidden md:flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer ml-2">
                            <input
                              type="checkbox"
                              checked={peopleHeadless}
                              onChange={e => setPeopleHeadless(e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Headless Browser</span>
                          </label>
                        </div>

                        <div className="flex items-center space-x-2.5 self-end sm:self-auto">
                          {activePeopleFiltersCount > 0 && (
                            <button
                              type="button"
                              onClick={handleResetPeopleFilters}
                              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={searchingPeople}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center space-x-2"
                          >
                            {searchingPeople ? <Spinner className="w-4 h-4" /> : <Icon name="search" className="w-4 h-4" />}
                            <span>{searchingPeople ? 'Extracting Verified Profiles...' : 'Search People'}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* People Results Section */}
                  <div className="space-y-4">
                    {/* Header Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          <Icon name="users" className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-slate-900">Verified Profiles Extracted</h3>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {peopleResults.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {peopleSearchMeta?.message || 'Live LinkedIn profiles matched with direct outreach actions'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {peopleSearchMeta?.searchUrl && (
                          <a
                            href={peopleSearchMeta.searchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs"
                            title="Open live LinkedIn Search URL"
                          >
                            <Icon name="external-link" className="w-3.5 h-3.5 text-blue-600" />
                            <span>View on LinkedIn</span>
                          </a>
                        )}

                        {peopleResults.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPeopleResults([]);
                              setPeopleSearchMeta(null);
                              setPeopleFilterQuery('');
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold transition shadow-xs"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter Within Extracted Results (if > 1 profile) */}
                    {peopleResults.length > 1 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={peopleFilterQuery}
                          onChange={e => setPeopleFilterQuery(e.target.value)}
                          placeholder="Filter extracted results by name, title, company, location..."
                          className="w-full bg-white border border-slate-200/90 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-xs"
                        />
                        <div className="absolute left-3 top-2.5 text-slate-400">
                          <Icon name="search" className="w-3.5 h-3.5" />
                        </div>
                        {peopleFilterQuery && (
                          <button
                            onClick={() => setPeopleFilterQuery('')}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}

                    {/* Empty or Loaded state */}
                    {peopleResults.length === 0 ? (
                      <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
                          <Icon name="search" className="w-6 h-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">No Profiles Extracted Yet</h4>
                          <p className="text-xs text-slate-500">
                            Enter keywords, designations, or company names above and click <span className="font-semibold text-blue-600">Search People</span> to discover and extract verified LinkedIn profiles.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {peopleResults
                          .filter(p => {
                            if (!peopleFilterQuery.trim()) return true;
                            const q = peopleFilterQuery.toLowerCase();
                            return (
                              (p.name && p.name.toLowerCase().includes(q)) ||
                              (p.designation && p.designation.toLowerCase().includes(q)) ||
                              (p.headline && p.headline.toLowerCase().includes(q)) ||
                              (p.companyName && p.companyName.toLowerCase().includes(q)) ||
                              (p.location && p.location.toLowerCase().includes(q)) ||
                              (p.summarySnippet && p.summarySnippet.toLowerCase().includes(q))
                            );
                          })
                          .map((p, idx) => {
                            const isConnected = p.connectionStatus === 'connected';
                            const isPending = p.connectionStatus === 'pending';
                            const title = p.designation || p.headline || p.position || 'LinkedIn Member';

                            return (
                              <div
                                key={p.personId || p.vanityName || idx}
                                className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 group"
                              >
                                <div className="space-y-3">
                                  {/* Top Row: Avatar + Name + Degree + Connection Badge */}
                                  <div className="flex items-start space-x-3.5">
                                    <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 overflow-hidden flex-shrink-0 shadow-xs">
                                      {p.photoUrl ? (
                                        <img
                                          src={p.photoUrl}
                                          alt={p.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                      ) : null}
                                      <span className="text-sm select-none">
                                        {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                                      </span>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center space-x-1.5 truncate">
                                          <h4 className="font-bold text-slate-900 text-sm truncate" title={p.name}>
                                            {p.name}
                                          </h4>
                                          {p.degree && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                              {p.degree}
                                            </span>
                                          )}
                                        </div>
                                        {isConnected ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center space-x-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            <span>Connected</span>
                                          </span>
                                        ) : isPending ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0 flex items-center space-x-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            <span>Pending</span>
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                                            Not Connected
                                          </span>
                                        )}
                                      </div>

                                      {/* Designation / Headline */}
                                      <p className="text-xs text-blue-700 font-semibold line-clamp-2 mt-1 leading-snug" title={title}>
                                        {title}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Company, Location, Country & Mutuals */}
                                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                                    {p.companyName && (
                                      <div className="flex items-center justify-between text-[11px]">
                                        <div className="flex items-center space-x-1.5 text-slate-700 font-medium truncate min-w-0">
                                          <Icon name="building" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="truncate" title={p.companyName}>{p.companyName}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => searchEmployeesOfCompany({ name: p.companyName })}
                                          className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold shrink-0 ml-2"
                                          title="Filter people by this company"
                                        >
                                          Filter
                                        </button>
                                      </div>
                                    )}

                                    {p.location && (
                                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                                        <Icon name="map-pin" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate" title={p.location}>{p.location}</span>
                                        {p.country && p.country !== 'Global' && (
                                          <span className="text-[10px] font-semibold text-slate-400 shrink-0 ml-1">
                                            ({p.countryFlag || '🌐'} {p.country})
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Summary Snippet / Past Experience */}
                                    {p.summarySnippet && (
                                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-start space-x-2 mt-1">
                                        <span className="text-slate-400 text-xs shrink-0 mt-0.5">💬</span>
                                        <span className="leading-snug text-slate-700 line-clamp-2">{p.summarySnippet}</span>
                                      </div>
                                    )}

                                    {/* Mutual Connections */}
                                    {p.mutualConnectionsText && (
                                      <div className="text-[10px] text-emerald-700 font-semibold bg-emerald-50/70 border border-emerald-200/60 rounded-lg px-2 py-1 flex items-center space-x-1.5">
                                        <span>🤝</span>
                                        <span className="truncate">{p.mutualConnectionsText}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Direct Action Buttons */}
                                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                  {p.canConnect && !isConnected && (
                                    <button
                                      onClick={() => {
                                        setConnectRecipient({
                                          name: p.name,
                                          vanity: p.vanityName || p.personId,
                                          profileUrl: p.profileUrl,
                                          headline: p.headline || p.designation
                                        });
                                        setConnectModalOpen(true);
                                      }}
                                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5"
                                      title="Send LinkedIn Connection Request"
                                    >
                                      <Icon name="plus" className="w-3.5 h-3.5" />
                                      <span>Connect</span>
                                    </button>
                                  )}

                                  {p.canMessage && (
                                    <button
                                      onClick={() => {
                                        setMsgRecipient({
                                          name: p.name,
                                          vanity: p.vanityName || p.personId,
                                          profileUrl: p.profileUrl,
                                          threadId: ''
                                        });
                                        setMsgModalOpen(true);
                                      }}
                                      className={`${p.canConnect && !isConnected ? 'flex-1' : 'w-full'} bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 shadow-xs`}
                                      title="Send direct LinkedIn message"
                                    >
                                      <Icon name="chat" className="w-3.5 h-3.5" />
                                      <span>Message</span>
                                    </button>
                                  )}

                                  {!p.canConnect && !p.canMessage && (
                                    <button
                                      onClick={() => {
                                        setActiveTab('outreach');
                                        setOutreachTarget(p.profileUrl || p.vanityName || p.name);
                                      }}
                                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5"
                                      title="Open in Outreach Hub"
                                    >
                                      <Icon name="send" className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Outreach</span>
                                    </button>
                                  )}

                                  {p.profileUrl && (
                                    <a
                                      href={p.profileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition border border-slate-200 shrink-0"
                                      title="Open Profile on LinkedIn"
                                    >
                                      <Icon name="external-link" className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: DIRECT OUTREACH ─────────────────────────────────────── */}
          {activeTab === 'outreach' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Send Invitation Form */}
                <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Icon name="send" className="w-4 h-4 text-emerald-600" />
                    <span>Send Connection Invitation</span>
                  </h3>
                  <p className="text-xs text-slate-500">Live pre-flight DOM status check & personalized invitation dispatch.</p>

                  <form onSubmit={handleSendDirectOutreach} className="space-y-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Target Profile URL or Vanity Name</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={outreachTarget}
                          onChange={e => setOutreachTarget(e.target.value)}
                          placeholder="https://linkedin.com/in/satyanadella"
                          className="flex-1 bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={handleCheckOutreachStatus}
                          disabled={checkingPreflight}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 transition flex items-center space-x-1"
                        >
                          {checkingPreflight && <Spinner className="w-3 h-3" />}
                          <span>{checkingPreflight ? 'Checking...' : 'Check'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Preflight Check Card */}
                    {preflightStatus && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <p className="font-bold text-slate-900">{preflightStatus.recipientName || 'Member Verified'}</p>
                        <p className="text-slate-500 text-[11px] truncate">{preflightStatus.recipientHeadline || 'Profile detected'}</p>
                        <div className="pt-1">
                          {preflightStatus.isConnected && <span className="text-emerald-600 font-bold">✓ Already 1st Degree Connection</span>}
                          {preflightStatus.isPending && <span className="text-amber-600 font-bold">⏳ Invitation Already Pending</span>}
                          {preflightStatus.canConnect && <span className="text-blue-600 font-bold">✓ Ready for Invitation</span>}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">Invitation Note (Optional)</label>
                        <span className="text-[10px] text-slate-400">{outreachNote.length}/300</span>
                      </div>
                      <textarea
                        rows="3"
                        maxLength="300"
                        value={outreachNote}
                        onChange={e => setOutreachNote(e.target.value)}
                        placeholder="Hi {name}, noticed our shared background and would love to connect..."
                        className="w-full bg-white border border-slate-300 p-3 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm resize-none"
                      ></textarea>
                    </div>

                    {/* Note Templates */}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setOutreachNote('Hi, noticed our shared professional network on LinkedIn and would love to connect!')}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        🤝 Shared Network
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutreachNote('Hi, really impressed by your background and work. Would be great to connect here!')}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        🎯 Impressed
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutreachNote('')}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600"
                      >
                        Clear
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={sendingOutreach}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {sendingOutreach && <Spinner className="w-3.5 h-3.5" />}
                      <span>{sendingOutreach ? 'Dispatching Invitation...' : 'Send Connection Invitation'}</span>
                    </button>
                  </form>
                </div>

                {/* Sent Today Invitations Table */}
                <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <Icon name="check-circle" className="w-4 h-4 text-emerald-600" />
                        <span>Invitations Sent Today</span>
                      </h3>
                      <p className="text-xs text-slate-500">Live monitoring of connection invitations sent today from your account.</p>
                    </div>
                    <button
                      onClick={loadSentToday}
                      disabled={loadingSentToday}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <Icon name="refresh" className={`w-3.5 h-3.5 ${loadingSentToday ? 'animate-spin' : ''}`} />
                      <span>Scan Sent Today</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3.5">Recipient</th>
                          <th className="py-2.5 px-3.5">Headline</th>
                          <th className="py-2.5 px-3.5">Time Sent</th>
                          <th className="py-2.5 px-3.5 text-right">Profile</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingSentToday ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-slate-400">
                              <Spinner className="w-5 h-5 mx-auto mb-2 text-emerald-600" />
                              <span>Scanning today's invitations...</span>
                            </td>
                          </tr>
                        ) : sentTodayItems.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-slate-500">
                              No invitations sent today yet. Click "Scan Sent Today" to refresh.
                            </td>
                          </tr>
                        ) : (
                          sentTodayItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-3.5 font-bold text-slate-900">{item.name}</td>
                              <td className="py-3 px-3.5 text-slate-500 max-w-[200px] truncate">{item.headline || '—'}</td>
                              <td className="py-3 px-3.5 text-emerald-600 font-semibold">{item.timeSent || 'Today'}</td>
                              <td className="py-3 px-3.5 text-right">
                                {item.profileUrl && (
                                  <a
                                    href={item.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline font-semibold"
                                  >
                                    View
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: ACCEPTED & TRACKING ─────────────────────────────────── */}
          {activeTab === 'tracking' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Icon name="check-circle" className="w-4 h-4 text-purple-600" />
                    <span>Accepted Connections & Network Intelligence</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live scan of LinkedIn connections, real-time message indexing, and outreach status lifecycle.
                  </p>
                </div>

                <button
                  onClick={handleScanAndIndex}
                  disabled={scanningAccepted}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 disabled:opacity-50 shrink-0"
                >
                  {scanningAccepted ? <Spinner className="w-4 h-4" /> : <Icon name="refresh" className="w-4 h-4" />}
                  <span>{scanningAccepted ? 'Scanning LinkedIn Network...' : 'Scan & Index Network'}</span>
                </button>
              </div>

              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Network</span>
                  <p className="text-xl font-bold text-slate-900">
                    {scanIndexData?.connections?.totalConnectionsOnLinkedIn || '157 connections'}
                  </p>
                  <span className="text-[10px] text-slate-400">Total LinkedIn Connections</span>
                </div>

                <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recent Scanned</span>
                  <p className="text-xl font-bold text-blue-600">
                    {scanIndexConnections.length || scanIndexData?.connections?.totalScraped || 20}
                  </p>
                  <span className="text-[10px] text-slate-400">Live indexed contacts</span>
                </div>

                <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Accepted Today</span>
                  <p className="text-xl font-bold text-emerald-600">
                    {scanIndexData?.connections?.acceptedTodayCount || stats.acceptedToday || 0}
                  </p>
                  <span className="text-[10px] text-slate-400">Accepted within 24h</span>
                </div>

                <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Threads</span>
                  <p className="text-xl font-bold text-purple-600">
                    {indexedConversations.length || scanIndexData?.conversations?.totalTracked || 15}
                  </p>
                  <span className="text-[10px] text-slate-400">Indexed conversations</span>
                </div>
              </div>

              {/* Sub-Tabs & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setTrackingSubTab('recent_connections')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trackingSubTab === 'recent_connections' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Recent Connections ({scanIndexConnections.length || 20})
                  </button>
                  <button
                    onClick={() => setTrackingSubTab('conversations')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trackingSubTab === 'conversations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Indexed Conversations ({indexedConversations.length || 15})
                  </button>
                  <button
                    onClick={() => setTrackingSubTab('accepted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trackingSubTab === 'accepted' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Outreach Accepted
                  </button>
                  <button
                    onClick={() => setTrackingSubTab('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trackingSubTab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Outreach Pending
                  </button>
                  <button
                    onClick={() => setTrackingSubTab('history')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trackingSubTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All History
                  </button>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={trackingFilter}
                    onChange={e => setTrackingFilter(e.target.value)}
                    placeholder="Search by name, headline..."
                    className="w-full bg-white border border-slate-300 px-3.5 py-1.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                  />
                </div>
              </div>

              {/* View 1: Recent Live Scanned Connections */}
              {trackingSubTab === 'recent_connections' && (
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Contact</th>
                        <th className="py-2.5 px-4">Headline</th>
                        <th className="py-2.5 px-4">Connection Date</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredScanConnections.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-10 text-center text-slate-500">
                            No connections displayed. Click "Scan & Index Network" to live-fetch your latest LinkedIn connections.
                          </td>
                        </tr>
                      ) : (
                        filteredScanConnections.map((c, idx) => (
                          <tr key={c.recipientUrn || c.vanityName || idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div className="flex items-center space-x-2.5">
                                <div className="relative w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700 overflow-hidden shrink-0">
                                  {c.avatarUrl ? (
                                    <img 
                                      src={c.avatarUrl} 
                                      alt={c.name} 
                                      className="w-full h-full object-cover" 
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : null}
                                  <span className="select-none">{c.name ? c.name.charAt(0).toUpperCase() : 'U'}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{c.name}</p>
                                  <span className="text-[10px] text-slate-400 font-mono truncate block">
                                    @{c.vanityName || 'member'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[240px] truncate" title={c.headline}>
                              {c.headline || 'LinkedIn Member'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                              {c.connectedDate || c.connectedTime || 'Recently'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {c.isAcceptedToday ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ACCEPTED TODAY
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  CONNECTED
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setMsgRecipient({ name: c.name, vanity: c.vanityName, profileUrl: c.profileUrl, threadId: '' });
                                  setMsgModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-semibold transition"
                              >
                                Message
                              </button>
                              {c.profileUrl && (
                                <a
                                  href={c.profileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                                  title="View LinkedIn Profile"
                                >
                                  <Icon name="external-link" className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 2: Recent Indexed Conversations */}
              {trackingSubTab === 'conversations' && (
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Participant</th>
                        <th className="py-2.5 px-4">Latest Message Snippet</th>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Sender</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredConversations.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-10 text-center text-slate-500">
                            No conversations indexed yet. Click "Scan & Index Network" to live-fetch conversations.
                          </td>
                        </tr>
                      ) : (
                        filteredConversations.map((t, idx) => (
                          <tr key={t.threadId || idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div className="flex items-center space-x-2.5">
                                <div className="relative w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center font-bold text-xs text-purple-700 overflow-hidden shrink-0">
                                  {t.participantAvatarUrl ? (
                                    <img 
                                      src={t.participantAvatarUrl} 
                                      alt={t.participantName} 
                                      className="w-full h-full object-cover" 
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : null}
                                  <span className="select-none">{t.participantName ? t.participantName.charAt(0).toUpperCase() : 'U'}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-1.5">
                                    <p className="font-bold text-slate-900 truncate">{t.participantName}</p>
                                    {t.isUnread && (
                                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread Message"></span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 truncate block max-w-[180px]">
                                    {t.participantHeadline || 'LinkedIn Contact'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[280px]">
                              <p className="truncate text-xs" title={t.lastMessageSnippet}>
                                <span className="font-semibold text-slate-800">{t.isSentByMe ? 'You: ' : ''}</span>
                                {t.lastMessageSnippet || 'No message preview'}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                              {t.timestamp || 'Recent'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                t.isSentByMe ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {t.isSentByMe ? 'You' : 'Participant'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setActiveTab('messaging');
                                  setThreadQuery(t.participantProfileUrl || t.threadId);
                                }}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold transition"
                              >
                                Open Studio
                              </button>
                              {t.threadUrl && (
                                <a
                                  href={t.threadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                                  title="Open Thread on LinkedIn"
                                >
                                  <Icon name="external-link" className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 3: Outbound Database Tracked Contacts (Accepted / Pending / History) */}
              {trackingSubTab !== 'recent_connections' && trackingSubTab !== 'conversations' && (
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Contact</th>
                        <th className="py-2.5 px-4">Headline</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Detected Via</th>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingTracked ? (
                        <tr>
                          <td colSpan="6" className="py-10 text-center text-slate-400">
                            <Spinner className="w-5 h-5 mx-auto mb-2 text-purple-600" />
                            <span>Loading tracking records...</span>
                          </td>
                        </tr>
                      ) : filteredContacts.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-10 text-center text-slate-500">
                            No matching tracking records found. Click "Scan & Index Network" to detect acceptances.
                          </td>
                        </tr>
                      ) : (
                        filteredContacts.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center font-bold text-xs text-purple-700">
                                  {c.recipient_name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{c.recipient_name}</p>
                                  <span className="text-[10px] text-slate-400 font-mono">@{c.recipient_vanity_name || 'member'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 max-w-[220px] truncate">
                              {c.recipient_headline || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'accepted'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                {c.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                              {c.detected_via || 'live_scan'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {c.accepted_at ? new Date(c.accepted_at).toLocaleDateString() : (c.invite_sent_at ? new Date(c.invite_sent_at).toLocaleDateString() : '—')}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setMsgRecipient({ name: c.recipient_name, vanity: c.recipient_vanity_name, profileUrl: c.recipient_profile_url, threadId: '' });
                                  setMsgModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold transition"
                              >
                                Message
                              </button>
                              {c.recipient_profile_url && (
                                <a
                                  href={c.recipient_profile_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline font-semibold"
                                >
                                  View
                                </a>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 5: CONVERSATION STUDIO ─────────────────────────────────── */}
          {activeTab === 'messaging' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Icon name="chat" className="w-4 h-4 text-blue-600" />
                    <span>LinkedIn Conversation & Message Studio</span>
                  </h3>
                  <p className="text-xs text-slate-500">Inspect full message threads, view document attachments & send replies.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={threadQuery}
                    onChange={e => setThreadQuery(e.target.value)}
                    placeholder="Thread ID or Recipient LinkedIn Profile URL..."
                    className="flex-1 bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                  />
                  <button
                    onClick={() => loadThreadMessages(threadQuery)}
                    disabled={readingThread}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 py-2 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center space-x-2"
                  >
                    {readingThread && <Spinner className="w-3.5 h-3.5" />}
                    <span>{readingThread ? 'Loading Messages...' : 'Read Thread'}</span>
                  </button>
                </div>
              </div>

              {/* ── SPLIT PANEL: Thread List (left) + Viewer (right) ── */}
              <div className="flex gap-4" style={{height: '600px'}}>
                {/* LEFT: Indexed Conversations List */}
                <div className="w-72 shrink-0 bg-white border border-slate-200/90 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  <div className="p-3.5 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">Indexed Threads</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {indexedConversations.length}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={studioThreadSearch}
                        onChange={e => setStudioThreadSearch(e.target.value)}
                        placeholder="Search threads..."
                        className="w-full bg-slate-50 border border-slate-200 pl-7 pr-3 py-1.5 rounded-lg text-[11px] text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                      />
                      <Icon name="search" className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                      {studioThreadSearch && (
                        <button onClick={() => setStudioThreadSearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs">×</button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredStudioThreads.length === 0 ? (
                      <div className="p-6 text-center">
                        <Icon name="chat" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[11px] text-slate-400 font-medium">
                          {indexedConversations.length === 0
                            ? 'No threads indexed yet. Run "Scan & Index Network" first.'
                            : 'No threads match your search.'}
                        </p>
                      </div>
                    ) : (
                      filteredStudioThreads.map((t, idx) => {
                        const isActive = selectedConversation?.threadId === t.threadId && selectedConversation?.threadId ||
                          selectedConversation?.participantProfileUrl === t.participantProfileUrl && t.participantProfileUrl;
                        return (
                          <button
                            key={t.threadId || idx}
                            onClick={() => loadThreadMessages(t.participantProfileUrl || t.threadId, t)}
                            className={`w-full text-left px-3.5 py-3 hover:bg-slate-50 transition flex items-start space-x-2.5 ${isActive ? 'bg-blue-50/60 border-l-2 border-blue-500' : ''}`}
                          >
                            <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-xs overflow-hidden shrink-0 mt-0.5">
                              {t.participantAvatarUrl ? (
                                <img src={t.participantAvatarUrl} alt={t.participantName} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                              ) : null}
                              <span className="select-none">{t.participantName ? t.participantName.charAt(0).toUpperCase() : 'U'}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-slate-900 text-[12px] truncate">{t.participantName || 'LinkedIn Contact'}</span>
                                <div className="flex items-center space-x-1 shrink-0">
                                  {t.isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" title="Unread" />}
                                  {t.timestamp && <span className="text-[10px] text-slate-400">{t.timestamp}</span>}
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {t.isSentByMe ? <span className="text-slate-700 font-semibold">You: </span> : null}
                                {t.lastMessageSnippet || 'No preview available'}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: Message Viewer + Reply Box */}
                <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  {threadData ? (
                    <>
                      {/* Thread Header */}
                      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-3">
                          {selectedConversation?.participantAvatarUrl && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 overflow-hidden shrink-0">
                              <img src={selectedConversation.participantAvatarUrl} alt={selectedConversation.participantName} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{threadData.recipientName || selectedConversation?.participantName || 'LinkedIn Conversation'}</h4>
                            <p className="text-[11px] text-slate-400">{threadData.totalMessages} message{threadData.totalMessages !== 1 ? 's' : ''} loaded</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {threadData.documentName && (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">📎 {threadData.documentName}</span>
                          )}
                          {(selectedConversation?.participantProfileUrl) && (
                            <a href={selectedConversation.participantProfileUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition border border-slate-200" title="View LinkedIn Profile">
                              <Icon name="linkedin" className="w-3.5 h-3.5 text-blue-700" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                        {(threadData.messages || []).length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-slate-400 text-xs">No messages found in this thread.</p>
                          </div>
                        ) : (
                          (threadData.messages || []).map((m, idx) => (
                            <div key={idx} className={`p-3.5 rounded-2xl text-xs ${m.isSender ? 'bg-blue-600 text-white ml-auto rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`} style={{maxWidth: '80%'}}>
                              <div className={`flex items-center justify-between font-semibold text-[10px] mb-1.5 ${m.isSender ? 'text-blue-200' : 'text-slate-500'}`}>
                                <span>{m.sender}</span>
                                <span className="ml-3 font-normal">{m.timestamp}</span>
                              </div>
                              <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Reply Box */}
                      <div className="px-5 py-3.5 border-t border-slate-100 space-y-2 shrink-0">
                        <textarea
                          rows={2}
                          value={replyInput}
                          onChange={e => setReplyInput(e.target.value)}
                          placeholder="Type your reply..."
                          className="w-full bg-white border border-slate-300 p-3 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm resize-none"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={async () => {
                              if (!replyInput.trim()) return;
                              setSendingReply(true);
                              try {
                                await apiFetch('/api/messages/thread/reply', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    userId: currentAccount?.id,
                                    threadId: threadData.threadId,
                                    profileUrl: selectedConversation?.participantProfileUrl || threadQuery,
                                    message: replyInput.trim(),
                                    headless: true
                                  })
                                });
                                showToast('Reply sent successfully!', 'success');
                                setReplyInput('');
                              } catch (err) {
                                showToast(err.message, 'error');
                              } finally {
                                setSendingReply(false);
                              }
                            }}
                            disabled={sendingReply}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                          >
                            {sendingReply && <Spinner className="w-3.5 h-3.5" />}
                            <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
                      {readingThread ? (
                        <>
                          <Spinner className="w-8 h-8 text-blue-500" />
                          <p className="text-sm text-slate-500 font-medium">Loading conversation...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <Icon name="chat" className="w-8 h-8 text-blue-400" />
                          </div>
                          <div className="text-center space-y-1 max-w-xs">
                            <h4 className="font-bold text-slate-800 text-sm">Select a Conversation</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Click any thread from the left panel, or paste a LinkedIn profile URL / Thread ID above and click <span className="font-semibold text-blue-600">Read Thread</span>.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 6: TEAM MANAGEMENT & ROLE PRIVACY ───────────────────────── */}
          {activeTab === 'team' && (
            <div className="space-y-6">

              {/* 1. ADMIN VIEW */}
              {appUser?.role === 'admin' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900">Organization User Management</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                          Admin View
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">As an Administrator, you can invite Managers and Users across the entire platform.</p>
                    </div>

                    <button
                      onClick={() => {
                        setNewTeamRole('user');
                        setNewTeamManagerId('');
                        setTeamModalOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-1.5"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>Add Member</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">User Email</th>
                          <th className="py-2.5 px-4">Role</th>
                          <th className="py-2.5 px-4">Manager Assignment</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Created Date</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingTeam ? (
                          <tr><td colSpan="6" className="py-8 text-center text-slate-400">Loading team members...</td></tr>
                        ) : teamUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 uppercase">
                                {u.email.charAt(0)}
                              </div>
                              <span>{u.email}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : (u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')
                                }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-[11px]">
                              {u.manager_id ? `Assigned to Manager ID: ${u.manager_id}` : (u.role === 'admin' ? 'Organization Admin' : 'Unassigned')}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-emerald-700 font-semibold">Active</span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {u.id !== appUser.id && (
                                <button
                                  onClick={() => handleDeleteTeamUser(u.id)}
                                  disabled={deletingUserId === u.id}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                  title="Delete user"
                                >
                                  {deletingUserId === u.id ? <Spinner className="w-3.5 h-3.5 text-rose-600" /> : <Icon name="trash" className="w-4 h-4" />}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. MANAGER VIEW */}
              {appUser?.role === 'manager' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900">My Team Users</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                          Manager View
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">As a Manager, you can only see and add users belonging to your direct team.</p>
                    </div>

                    <button
                      onClick={() => {
                        setNewTeamRole('user');
                        setTeamModalOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-1.5"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>Add Team User</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">User Email</th>
                          <th className="py-2.5 px-4">Role</th>
                          <th className="py-2.5 px-4">LinkedIn Account Status</th>
                          <th className="py-2.5 px-4">Created Date</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingTeam ? (
                          <tr><td colSpan="5" className="py-8 text-center text-slate-400">Loading your team users...</td></tr>
                        ) : teamUsers.length === 0 ? (
                          <tr><td colSpan="5" className="py-8 text-center text-slate-500">No users in your team yet. Click "Add Team User" to invite.</td></tr>
                        ) : teamUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 uppercase">
                                {u.email.charAt(0)}
                              </div>
                              <span>{u.email}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-[11px]">
                              {u.linkedin_account ? (
                                <span className="text-emerald-700 font-semibold">Connected ({u.linkedin_account.username})</span>
                              ) : (
                                <span className="text-slate-400">No LinkedIn connected</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteTeamUser(u.id)}
                                disabled={deletingUserId === u.id}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                title="Remove team user"
                              >
                                {deletingUserId === u.id ? <Spinner className="w-3.5 h-3.5 text-rose-600" /> : <Icon name="trash" className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. USER VIEW (Own Data & Profile Only) */}
              {appUser?.role === 'user' && (
                <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm space-y-4 max-w-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg border border-emerald-200">
                      {appUser.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{appUser.email}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                        Member Account (User)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Tenant Account ID:</span>
                      <span className="font-mono font-bold text-slate-900">{appUser.id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Reporting Manager:</span>
                      <span className="font-semibold text-slate-900">
                        {appUser.manager_id ? `Manager ID: ${appUser.manager_id}` : 'Direct Organization'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Data Access Policy:</span>
                      <span className="font-semibold text-emerald-700">Strict Tenant Privacy (Own Data Only)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Account Created:</span>
                      <span className="font-semibold text-slate-800">{new Date(appUser.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* ── MODALS / DIALOGUES ────────────────────────────────────────────── */}

      {/* 1. Platform Sign In Modal */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && appUser) setAuthModalOpen(false); }}
        >
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-5 relative">
            {appUser && (
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                title="Close"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            )}

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-xl mx-auto">
                D
              </div>
              <h3 className="text-base font-bold text-slate-900 pt-2">Sign In to DigiLink</h3>
              <p className="text-xs text-slate-500">Multi-tenant role-based authentication portal.</p>
            </div>

            {/* Quick Demo Sign In Pills */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">1-Click Demo Logins:</span>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setLoginEmail('admin@app.com'); setLoginPassword('Admin@123'); }}
                  className="py-1.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] transition font-bold"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginEmail('manager@app.com'); setLoginPassword('Manager@123'); }}
                  className="py-1.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] transition font-bold"
                >
                  👔 Manager
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginEmail('user@app.com'); setLoginPassword('User@123'); }}
                  className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] transition font-bold"
                >
                  👤 User
                </button>
              </div>
            </div>

            <form onSubmit={handlePlatformLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loggingIn && <Spinner className="w-3.5 h-3.5" />}
                <span>{loggingIn ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. My Profile Details Modal */}
      {profileModalOpen && appUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setProfileModalOpen(false); }}
        >
          <div className="bg-white max-w-sm w-full p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>👤</span>
                <span>User Profile Details</span>
              </h3>
              <button onClick={() => setProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center uppercase shadow-md shadow-blue-500/20">
                {appUser.email.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{appUser.email}</p>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.2 rounded-full ${appUser.role === 'admin' ? 'bg-purple-100 text-purple-700' : (appUser.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')
                    }`}>
                    {appUser.role}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Active Session</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Platform User ID:</span>
                <span className="font-mono font-bold text-slate-900">#{appUser.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Data Access Policy:</span>
                <span className="font-semibold text-emerald-700">🔒 Multi-Tenant Privacy Active</span>
              </div>
              {appUser.manager_id && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Assigned Manager:</span>
                  <span className="font-semibold text-blue-600">Manager ID #{appUser.manager_id}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Account Role Scope:</span>
                <span className="font-semibold text-slate-800">
                  {appUser.role === 'admin' ? 'Full Organization Admin' : (appUser.role === 'manager' ? 'Team Lead (Oversees Team Users)' : 'Member User (Own Data Only)')}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Account Created:</span>
                <span className="text-slate-800">{new Date(appUser.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2 rounded-xl transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePlatformLogout}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 rounded-xl border border-rose-200 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 2FA / OTP Verification Modal */}
      {otpModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOtpModalOpen(false);
              setInCardOtpMode(false);
            }
          }}
        >
          <div className="bg-white max-w-sm w-full p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto text-xl font-bold shadow-xs">
                🔐
              </div>
              <h3 className="text-sm font-bold text-slate-900">LinkedIn Security Verification</h3>
              <p className="text-xs text-slate-500">
                Enter the PIN code sent for <strong className="font-semibold text-slate-800">{otpChallengeUser || 'your LinkedIn account'}</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmitOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">Security Code (PIN / OTP)</label>
                <input
                  type="text"
                  autoFocus
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="e.g. 123456"
                  maxLength="8"
                  className="w-full text-center text-2xl font-mono tracking-widest py-3 rounded-xl border border-slate-300 text-slate-900 outline-none font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-sm transition"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setOtpModalOpen(false);
                    setInCardOtpMode(false);
                    setOtpCode('');
                  }}
                  className="flex-1 bg-slate-100 text-slate-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOtp || !otpCode.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {submittingOtp && <Spinner className="w-3.5 h-3.5" />}
                  <span>{submittingOtp ? 'Verifying...' : 'Submit PIN'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Send Direct Message Modal */}
      {msgModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMsgModalOpen(false); }}
        >
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Direct Message</h3>
                <p className="text-xs text-slate-500">To: <span className="text-blue-600 font-semibold">{msgRecipient.name}</span></p>
              </div>
              <button onClick={() => setMsgModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMsgBody(`Hi ${msgRecipient.name.split(' ')[0]}, great connecting with you on LinkedIn! Would love to chat about potential synergies.`)}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                🤝 Synergies
              </button>
              <button
                type="button"
                onClick={() => setMsgBody(`Hi ${msgRecipient.name.split(' ')[0]}, following up on your recent work. Are you free for a brief call next week?`)}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                💼 Quick Call
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea
                rows="4"
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                placeholder="Type your message..."
                required
                className="w-full bg-white border border-slate-300 p-3 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm resize-none"
              ></textarea>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setMsgModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingMsg}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {sendingMsg && <Spinner className="w-3.5 h-3.5" />}
                  <span>{sendingMsg ? 'Delivering...' : 'Send Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Send Connection Invitation Modal */}
      {connectModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConnectModalOpen(false); }}
        >
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Connect with {connectRecipient.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-1">{connectRecipient.headline || 'LinkedIn Professional'}</p>
              </div>
              <button onClick={() => setConnectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setConnectNote(`Hi ${connectRecipient.name.split(' ')[0]}, noticed our shared network on LinkedIn and would love to connect!`)}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                🤝 Shared Network
              </button>
              <button
                type="button"
                onClick={() => setConnectNote(`Hi ${connectRecipient.name.split(' ')[0]}, really impressed by your background. Would love to stay connected!`)}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                🎯 Impressed
              </button>
              <button
                type="button"
                onClick={() => setConnectNote('')}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            </div>

            <form onSubmit={handleSendConnection} className="space-y-4">
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Custom Invitation Note (Optional)</span>
                  <span>{connectNote.length}/300</span>
                </div>
                <textarea
                  rows="3"
                  maxLength="300"
                  value={connectNote}
                  onChange={e => setConnectNote(e.target.value)}
                  placeholder="Include a personalized invitation note..."
                  className="w-full bg-white border border-slate-300 p-3 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingConnect}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {sendingConnect && <Spinner className="w-3.5 h-3.5" />}
                  <span>{sendingConnect ? 'Sending...' : 'Send Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Invite Team User Modal (Role-Enforced) */}
      {teamModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setTeamModalOpen(false); }}
        >
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {appUser?.role === 'admin' ? 'Add Platform Member (Admin)' : 'Add Team Member (Manager)'}
                </h3>
                <p className="text-xs text-slate-500">
                  {appUser?.role === 'admin'
                    ? 'Create a Manager or User account and assign hierarchy.'
                    : 'Invite a User to join your managed team.'}
                </p>
              </div>
              <button onClick={() => setTeamModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeamUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newTeamEmail}
                  onChange={e => setNewTeamEmail(e.target.value)}
                  required
                  placeholder="member@company.com"
                  className="w-full bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newTeamPassword}
                  onChange={e => setNewTeamPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                />
              </div>

              {appUser?.role === 'admin' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Role</label>
                    <select
                      value={newTeamRole}
                      onChange={e => setNewTeamRole(e.target.value)}
                      className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                    >
                      <option value="user">User (Team Member)</option>
                      <option value="manager">Manager (Team Lead)</option>
                    </select>
                  </div>

                  {newTeamRole === 'user' && availableManagers.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Manager (Optional)</label>
                      <select
                        value={newTeamManagerId}
                        onChange={e => setNewTeamManagerId(e.target.value)}
                        className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                      >
                        <option value="">No Manager (Direct Admin)</option>
                        {availableManagers.map(m => (
                          <option key={m.id} value={m.id}>{m.email} (ID: {m.id})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTeamModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTeamUser}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {creatingTeamUser && <Spinner className="w-3.5 h-3.5" />}
                  <span>{creatingTeamUser ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ── FLOATING TOAST NOTIFICATIONS ─────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center space-x-2.5 transform transition-all duration-300 bg-white ${t.type === 'success'
                ? 'border-emerald-300 text-emerald-900 border-l-4 border-l-emerald-600'
                : t.type === 'error'
                  ? 'border-rose-300 text-rose-900 border-l-4 border-l-rose-600'
                  : t.type === 'warning'
                    ? 'border-amber-300 text-amber-900 border-l-4 border-l-amber-600'
                    : 'border-blue-300 text-blue-900 border-l-4 border-l-blue-600'
              }`}
          >
            {t.type === 'success' && <Icon name="check-circle" className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {t.type === 'error' && <span className="text-rose-600 font-bold text-sm">⚠️</span>}
            {t.type === 'warning' && <span className="text-amber-600 font-bold text-sm">⚠️</span>}
            {t.type === 'info' && <Icon name="sparkles" className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Mount DigiLink Application ───────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
