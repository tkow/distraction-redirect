import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BlockedDomain } from './types';

const STORAGE_KEY = 'blockedDomains';
const REDIRECT_URL_KEY = 'redirectUrl';
const PRIVACY_KEY = 'privacyMode';
const DEFAULT_REDIRECT_URL = 'https://github.com';

const HOSTNAME_RE = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function normalizeHostname(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesDomain(domain: BlockedDomain, hostname: string): boolean {
  if (domain.hostname.includes('*')) return patternToRegex(domain.hostname).test(hostname);
  return domain.hostname === hostname; // exact match only
}

async function getCurrentTab(): Promise<{ hostname: string; url: string } | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    const parsed = new URL(tab.url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return { hostname: parsed.hostname.replace(/^www\./, ''), url: tab.url };
  } catch {
    return null;
  }
}

function RedirectUrlConfig() {
  const [saved, setSaved] = useState(DEFAULT_REDIRECT_URL);
  const [draft, setDraft] = useState(DEFAULT_REDIRECT_URL);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.storage.local.get(REDIRECT_URL_KEY).then((result) => {
      const url = result[REDIRECT_URL_KEY] ?? DEFAULT_REDIRECT_URL;
      setSaved(url);
      setDraft(url);
    });
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    // Empty input → silently reset to default
    const urlToSave = trimmed === '' ? DEFAULT_REDIRECT_URL : trimmed;
    if (trimmed !== '') {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          setError('Must be an http or https URL');
          return;
        }
      } catch {
        setError('Invalid URL');
        return;
      }
    }
    await chrome.storage.local.set({ [REDIRECT_URL_KEY]: urlToSave });
    setSaved(urlToSave);
    setDraft(urlToSave);
    setEditing(false);
    setError(null);
  };

  const handleDiscard = () => {
    setDraft(saved);
    setEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleDiscard();
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Redirect to
      </p>
      {editing ? (
        <>
          <input
            ref={inputRef}
            type="url"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder={DEFAULT_REDIRECT_URL}
            style={{
              width: '100%',
              padding: '7px 8px',
              border: `1px solid ${error ? '#e63946' : '#ddd'}`,
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
              marginBottom: 6,
              outline: 'none',
            }}
          />
          {error && <p style={{ color: '#e63946', fontSize: 12, margin: '0 0 6px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={{ flex: 1, padding: '6px', background: '#e63946', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Save
            </button>
            <button onClick={handleDiscard} style={{ flex: 1, padding: '6px', background: 'white', color: '#666', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#333', wordBreak: 'break-all' }}>{saved}</span>
          <button onClick={() => setEditing(true)} style={{ flexShrink: 0, background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12, color: '#555' }}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

function CurrentSiteBlock({ domains }: { domains: BlockedDomain[] }) {
  const [tab, setTab] = useState<{ hostname: string; url: string } | null>(null);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    getCurrentTab().then(setTab);
  }, []);

  if (!tab) return null;

  const isBlocked = domains.some((d) => matchesDomain(d, tab.hostname));

  const handleBlock = async () => {
    setBlocking(true);
    await chrome.runtime.sendMessage({ type: 'ADD_DOMAIN', hostname: tab.hostname });
    setBlocking(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: 12, background: '#f7f7f7', borderRadius: 8, border: '1px solid #eee' }}>
      <span style={{ fontSize: 13, color: '#333', wordBreak: 'break-all', marginRight: 8 }}>{tab.hostname}</span>
      {isBlocked ? (
        <span style={{ flexShrink: 0, fontSize: 12, color: '#2e7d32', fontWeight: 500 }}>✓ Blocked</span>
      ) : (
        <button
          onClick={handleBlock}
          disabled={blocking}
          style={{ flexShrink: 0, padding: '4px 12px', background: blocking ? '#aaa' : '#e63946', color: 'white', border: 'none', borderRadius: 6, cursor: blocking ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
        >
          {blocking ? 'Blocking…' : 'Block'}
        </button>
      )}
    </div>
  );
}

function DomainItem({ domain, onRemove, privacy }: { domain: BlockedDomain; onRemove: (h: string) => void; privacy: boolean }) {
  return (
    <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {domain.hostname.includes('*') && (
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#7c3aed', background: '#ede9fe', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace' }}>
            *
          </span>
        )}
        <span style={{
          fontSize: 13, color: '#333', wordBreak: 'break-all',
          filter: privacy ? 'blur(4px)' : 'none',
          userSelect: privacy ? 'none' : 'auto',
          transition: 'filter 0.2s',
        }}>
          {domain.hostname}
        </span>
      </div>
      <button
        onClick={() => onRemove(domain.hostname)}
        style={{ flexShrink: 0, marginLeft: 8, background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12, color: '#e63946' }}
      >
        Remove
      </button>
    </li>
  );
}

function AddDomainForm({ onSaved, onDiscard }: { onSaved: () => void; onDiscard: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = useCallback(async () => {
    const raw = value.trim();
    if (!raw) return;

    setSaving(true);
    setError(null);

    const hasWildcard = raw.includes('*');
    const hostname = hasWildcard ? raw.toLowerCase() : normalizeHostname(raw);

    if (hasWildcard) {
      // Must have at least one non-wildcard, non-dot character and a dot
      const stripped = hostname.replace(/\*/g, '');
      if (!stripped.includes('.') || stripped.trim() === '.') {
        setError('Enter a valid pattern, e.g. *.social or twitter.*');
        setSaving(false);
        return;
      }
    } else {
      if (!HOSTNAME_RE.test(hostname)) {
        setError('Enter a valid domain, e.g. twitter.com');
        setSaving(false);
        return;
      }
    }

    const res = await chrome.runtime.sendMessage({ type: 'ADD_DOMAIN', hostname });
    if (!res?.success) {
      setError(res?.error ?? 'Failed to add');
      setSaving(false);
      return;
    }
    onSaved();
  }, [value, onSaved]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onDiscard();
  }, [handleSave, onDiscard]);

  return (
    <div style={{ marginTop: 8 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={handleKeyDown}
        placeholder="e.g. twitter.com or *.social"
        disabled={saving}
        style={{ width: '100%', padding: '8px', border: `1px solid ${error ? '#e63946' : '#ddd'}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 6, outline: 'none' }}
      />
      {error && <p style={{ color: '#e63946', fontSize: 12, margin: '0 0 6px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          style={{ flex: 1, padding: '8px', background: saving || !value.trim() ? '#ccc' : '#e63946', color: 'white', border: 'none', borderRadius: 6, cursor: saving || !value.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Adding…' : 'Save'}
        </button>
        <button
          onClick={onDiscard}
          disabled={saving}
          style={{ flex: 1, padding: '8px', background: 'white', color: '#666', border: '1px solid #ddd', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function parseImportFile(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^["']|["']$/g, '')) // strip surrounding quotes (CSV)
    .filter((line) => line.length > 0);
}

const Popup = () => {
  const [domains, setDomains] = useState<BlockedDomain[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY, PRIVACY_KEY]).then((result) => {
      setDomains(result[STORAGE_KEY] ?? []);
      setPrivacy(result[PRIVACY_KEY] ?? false);
    });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEY]) setDomains(changes[STORAGE_KEY].newValue ?? []);
      if (changes[PRIVACY_KEY]) setPrivacy(changes[PRIVACY_KEY].newValue ?? false);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleRemove = useCallback(async (hostname: string) => {
    await chrome.runtime.sendMessage({ type: 'REMOVE_DOMAIN', hostname });
  }, []);

  const togglePrivacy = useCallback(() => {
    const next = !privacy;
    setPrivacy(next);
    chrome.storage.local.set({ [PRIVACY_KEY]: next });
  }, [privacy]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = ''; // reset so same file can be re-imported
    if (!file) return;

    const text = await file.text();
    const hostnames = parseImportFile(text);

    if (hostnames.length === 0) {
      setImportStatus({ ok: false, msg: 'File is empty or has no valid entries' });
      return;
    }

    const res = await chrome.runtime.sendMessage({ type: 'SYNC_DOMAINS', hostnames });
    if (res?.success) {
      setImportStatus({ ok: true, msg: `Synced ${hostnames.length} entr${hostnames.length === 1 ? 'y' : 'ies'} from ${file.name}` });
    } else {
      setImportStatus({ ok: false, msg: res?.error ?? 'Import failed' });
    }
    setTimeout(() => setImportStatus(null), 4000);
  }, []);

  return (
    <div style={{ width: 340, fontFamily: 'system-ui, -apple-system, sans-serif', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🚫</span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1a1a2e', flex: 1 }}>Distraction Redirect</h2>
        <button
          onClick={togglePrivacy}
          title={privacy ? 'Privacy mode on — click to reveal' : 'Privacy mode off — click to mask'}
          style={{
            background: privacy ? '#1a1a2e' : 'none',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: '3px 8px',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            color: privacy ? 'white' : '#888',
          }}
        >
          {privacy ? '🔒' : '👁'}
        </button>
      </div>

      <RedirectUrlConfig />

      <CurrentSiteBlock domains={domains} />

      {domains.length === 0 && !isAdding && (
        <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No sites blocked yet.</p>
      )}

      {domains.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', maxHeight: 240, overflowY: 'auto' }}>
          {domains.map((d) => (
            <DomainItem key={d.hostname} domain={d} onRemove={handleRemove} privacy={privacy} />
          ))}
        </ul>
      )}

      {!isAdding && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setIsAdding(true)}
              style={{ flex: 1, padding: '9px', background: '#e63946', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              + Add Domain
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, padding: '9px', background: 'white', color: '#333', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              Import file
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {importStatus && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: importStatus.ok ? '#2e7d32' : '#e63946', textAlign: 'center' }}>
              {importStatus.msg}
            </p>
          )}
        </>
      )}

      {isAdding && <AddDomainForm onSaved={() => setIsAdding(false)} onDiscard={() => setIsAdding(false)} />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><Popup /></React.StrictMode>);
