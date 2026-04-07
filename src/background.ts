import { BlockedDomain, Message } from './types';

const STORAGE_KEY = 'blockedDomains';
const REDIRECT_URL_KEY = 'redirectUrl';
const DEFAULT_REDIRECT_URL = 'https://github.com';

async function getBlockedDomains(): Promise<BlockedDomain[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

async function saveBlockedDomains(domains: BlockedDomain[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: domains });
}

async function getRedirectUrl(): Promise<string> {
  const result = await chrome.storage.local.get(REDIRECT_URL_KEY);
  return result[REDIRECT_URL_KEY] ?? DEFAULT_REDIRECT_URL;
}

function redirectHostname(redirectUrl: string): string {
  return new URL(redirectUrl).hostname.replace(/^www\./, '');
}

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** Match a plain/wildcard pattern against a hostname. * is a free-length wildcard. Exact match for plain patterns. */
function matchesPattern(pattern: string, hostname: string): boolean {
  if (pattern.includes('*')) {
    return new RegExp(`^${escapeRegex(pattern).replace(/\*/g, '.*')}$`).test(hostname);
  }
  return hostname === pattern;
}

/**
 * Build a urlFilter for declarativeNetRequest from a plain/wildcard pattern.
 * |  = left-anchor (URL must start here)
 * *  = wildcard covering the protocol (http/https)
 * ^  = separator character (matches /, ?, # or end-of-URL) — ensures exact hostname match,
 *      not a suffix match (e.g. sharelot.jp does NOT match store.sharelot.jp).
 */
function patternToUrlFilter(pattern: string): string {
  return `|*://${pattern}^`;
}

function domainMatchesUrl(domain: BlockedDomain, url: string): boolean {
  if (domain.isRegex) {
    try { return new RegExp(domain.hostname).test(url); } catch { return false; }
  }
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return matchesPattern(domain.hostname, h);
  } catch {
    return false;
  }
}

function isProtected(hostname: string, redirectUrl: string): boolean {
  return hostname === redirectHostname(redirectUrl);
}

async function updateRedirectRules(domains: BlockedDomain[], redirectUrl: string): Promise<void> {
  // Exclude entries that would also redirect the redirect target (loop prevention).
  const safeDomains = domains.filter((d) => !domainMatchesUrl(d, redirectUrl));

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  const newRules: chrome.declarativeNetRequest.Rule[] = safeDomains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      redirect: { url: redirectUrl },
    },
    condition: {
      ...(domain.isRegex
        ? { regexFilter: domain.hostname }
        : { urlFilter: patternToUrlFilter(domain.hostname) }),
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules,
  });
}

async function validateDomain(hostname: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    await fetch(`https://${hostname}`, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    return { valid: true };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { valid: false, error: 'Request timed out — site may not exist' };
    }
    return { valid: false, error: 'Could not reach site — check the domain name' };
  }
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  (async () => {
    try {
      const redirectUrl = await getRedirectUrl();

      if (message.type === 'VALIDATE_DOMAIN') {
        if (isProtected(message.hostname, redirectUrl)) {
          sendResponse({ success: false, error: 'Cannot block the redirect target' });
          return;
        }
        const result = await validateDomain(message.hostname);
        sendResponse(result.valid ? { success: true } : { success: false, error: result.error });
        return;
      }

      if (message.type === 'ADD_DOMAIN') {
        if (!message.isRegex && isProtected(message.hostname, redirectUrl)) {
          sendResponse({ success: false, error: 'Cannot block the redirect target' });
          return;
        }
        const domains = await getBlockedDomains();
        if (domains.find((d) => d.hostname === message.hostname)) {
          sendResponse({ success: false, error: 'Already in the list' });
          return;
        }
        const updated = [...domains, { hostname: message.hostname, isRegex: message.isRegex ?? false, addedAt: Date.now() }];
        await saveBlockedDomains(updated);
        await updateRedirectRules(updated, redirectUrl);
        sendResponse({ success: true });
        return;
      }

      if (message.type === 'REMOVE_DOMAIN') {
        const domains = await getBlockedDomains();
        const updated = domains.filter((d) => d.hostname !== message.hostname);
        await saveBlockedDomains(updated);
        await updateRedirectRules(updated, redirectUrl);
        sendResponse({ success: true });
        return;
      }

      if (message.type === 'SYNC_DOMAINS') {
        // Filter out entries that would block the redirect target.
        const incoming = message.hostnames.filter((h) => !isProtected(h, redirectUrl));
        const incomingSet = new Set(incoming);
        const current = await getBlockedDomains();
        // Preserve existing entries that appear in the file (keeps addedAt etc.).
        const kept = current.filter((d) => incomingSet.has(d.hostname));
        const keptSet = new Set(kept.map((d) => d.hostname));
        // Add entries from the file that aren't already in the list.
        const added: BlockedDomain[] = incoming
          .filter((h) => !keptSet.has(h))
          .map((h) => ({ hostname: h, addedAt: Date.now() }));
        const updated = [...kept, ...added];
        await saveBlockedDomains(updated);
        await updateRedirectRules(updated, redirectUrl);
        sendResponse({ success: true });
        return;
      }
    } catch (e) {
      sendResponse({ success: false, error: String(e) });
    }
  })();
  return true;
});

async function restoreRules() {
  const [domains, redirectUrl] = await Promise.all([getBlockedDomains(), getRedirectUrl()]);
  await updateRedirectRules(domains, redirectUrl);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[REDIRECT_URL_KEY]) restoreRules();
});

chrome.runtime.onInstalled.addListener(restoreRules);
chrome.runtime.onStartup.addListener(restoreRules);
