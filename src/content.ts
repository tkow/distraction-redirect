// Content script — redirect blocked sites (including BFCache restores)

const STORAGE_KEY = 'blockedDomains';
const REDIRECT_URL_KEY = 'redirectUrl';
const DEFAULT_REDIRECT_URL = 'https://github.com';

type BlockedDomain = { hostname: string; isRegex?: boolean; addedAt: number };

const hostname = window.location.hostname.replace(/^www\./, '');
const fullUrl = window.location.href;

setup();

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function matchesDomain(domain: BlockedDomain, h: string, url: string): boolean {
  if (domain.isRegex) {
    try { return new RegExp(domain.hostname).test(url); } catch { return false; }
  }
  if (domain.hostname.includes('*')) {
    return new RegExp(`^${escapeRegex(domain.hostname).replace(/\*/g, '.*')}$`).test(h);
  }
  return h === domain.hostname; // exact match — no implicit subdomain matching
}

async function redirectIfBlocked(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEY, REDIRECT_URL_KEY]);
  const domains: BlockedDomain[] = result[STORAGE_KEY] ?? [];
  const redirectUrl: string = result[REDIRECT_URL_KEY] ?? DEFAULT_REDIRECT_URL;

  let redirectHostname: string;
  try {
    redirectHostname = new URL(redirectUrl).hostname.replace(/^www\./, '');
  } catch {
    return;
  }

  // Don't redirect if we're already on the redirect target.
  if (hostname === redirectHostname) return;

  // Don't redirect if the redirect target itself matches a rule (loop prevention).
  if (domains.some((d) => matchesDomain(d, redirectHostname, redirectUrl))) return;

  if (domains.some((d) => matchesDomain(d, hostname, fullUrl))) {
    window.location.replace(redirectUrl);
  }
}

function setup() {
  redirectIfBlocked();

  // Re-check on BFCache page restore (back/forward navigation).
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) redirectIfBlocked();
  });

  // Redirect immediately when storage changes.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY] || changes[REDIRECT_URL_KEY]) redirectIfBlocked();
  });
}
