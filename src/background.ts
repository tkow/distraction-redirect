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

/** Returns true if the given url is matched by the blocked domain entry. */
function domainMatchesUrl(domain: BlockedDomain, url: string): boolean {
  if (domain.isRegex) {
    try { return new RegExp(domain.hostname).test(url); } catch { return false; }
  }
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h === domain.hostname || h.endsWith(`.${domain.hostname}`);
  } catch {
    return false;
  }
}

function isProtected(hostname: string, redirectUrl: string): boolean {
  const rh = redirectHostname(redirectUrl);
  return hostname === rh || hostname.endsWith(`.${rh}`);
}

async function updateRedirectRules(domains: BlockedDomain[], redirectUrl: string): Promise<void> {
  // Exclude any entry that would redirect the redirect target itself (loop prevention).
  const safeDomains = domains.filter((d) => !domainMatchesUrl(d, redirectUrl));

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  const newRules: chrome.declarativeNetRequest.Rule[] = safeDomains.map((domain, index) => {
    const base = {
      id: index + 1,
      priority: 1,
      action: {
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
        redirect: { url: redirectUrl },
      },
    };
    if (domain.isRegex) {
      return {
        ...base,
        condition: {
          regexFilter: domain.hostname,
          resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
        },
      };
    }
    return {
      ...base,
      condition: {
        urlFilter: `||${domain.hostname}/`,
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules,
  });
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  (async () => {
    try {
      const redirectUrl = await getRedirectUrl();

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
        const updated = [...domains, {
          hostname: message.hostname,
          isRegex: message.isRegex ?? false,
          addedAt: Date.now(),
        }];
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

// Re-apply rules whenever the redirect URL changes.
chrome.storage.onChanged.addListener((changes) => {
  if (changes[REDIRECT_URL_KEY]) restoreRules();
});

chrome.runtime.onInstalled.addListener(restoreRules);
chrome.runtime.onStartup.addListener(restoreRules);
