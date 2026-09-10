/**
 * INOMS Local Pro Server Configuration & URL Resolver
 *
 * Supports seamless communication for:
 * 1. Web browser running on the same host (uses relative paths /api)
 * 2. Technician Android device over LAN/Wi-Fi (e.g. http://192.168.1.100:3000)
 * 3. Technician browser on other PC over LAN
 * 4. Never hard-codes customer IP addresses
 */

export const LOCAL_SERVER_STORAGE_KEY = 'inoms_local_server_url';
export const LAST_PAIRED_ORG_KEY = 'inoms_paired_org_info';

export interface ServerConnectionStatus {
  ok: boolean;
  url: string;
  postgres: boolean;
  engine: 'postgresql' | 'sqlite' | 'unknown';
  latencyMs: number;
  time?: string;
  error?: string;
}

export interface PairingPayload {
  code?: string;
  serverUrl: string;
  tenantId: string;
  tenantName?: string;
  createdAt?: string;
  expiresAt?: string;
}

/**
 * Returns true if running inside the Capacitor Android native wrapper.
 */
export function isNativeCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

/**
 * Gets the configured base URL for the INOMS Local Server.
 * Returns empty string for same-origin web browsing.
 */
export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(LOCAL_SERVER_STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }
  return '';
}

/**
 * Sets and validates the INOMS Local Server base URL.
 */
export function setServerBaseUrl(rawUrl: string): string {
  if (typeof window === 'undefined') return '';
  let cleaned = (rawUrl || '').trim();
  if (!cleaned) {
    localStorage.removeItem(LOCAL_SERVER_STORAGE_KEY);
    return '';
  }

  // Prepend http:// if user entered plain IP or hostname e.g. 192.168.1.50:3000
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  // Strip trailing slash
  cleaned = cleaned.replace(/\/+$/, '');

  localStorage.setItem(LOCAL_SERVER_STORAGE_KEY, cleaned);
  return cleaned;
}

/**
 * Clears the custom server URL, resetting to same-origin.
 */
export function clearServerBaseUrl(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_SERVER_STORAGE_KEY);
}

/**
 * Resolves any API path (e.g. '/api/auth/login') against the configured base URL.
 */
export function resolveApiUrl(path: string): string {
  const base = getServerBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return cleanPath;
  }
  return `${base}${cleanPath}`;
}

/**
 * Tests connection and health of an INOMS server endpoint.
 */
export async function testServerConnection(customUrl?: string): Promise<ServerConnectionStatus> {
  const targetBase = customUrl !== undefined ? (customUrl.trim().replace(/\/+$/, '') || '') : getServerBaseUrl();
  const testEndpoint = targetBase ? `${targetBase}/api/health` : '/api/health';

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(testEndpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const isPg = Boolean(data.postgres);
      return {
        ok: true,
        url: targetBase || window.location.origin,
        postgres: isPg,
        engine: isPg ? 'postgresql' : 'sqlite',
        latencyMs,
        time: data.time
      };
    } else {
      return {
        ok: false,
        url: targetBase || window.location.origin,
        postgres: false,
        engine: 'unknown',
        latencyMs,
        error: `Server responded with HTTP ${res.status}`
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      url: targetBase || (typeof window !== 'undefined' ? window.location.origin : ''),
      postgres: false,
      engine: 'unknown',
      latencyMs,
      error: err?.name === 'AbortError' ? 'Connection timed out (Check Wi-Fi / IP)' : (err?.message || 'Cannot reach local server')
    };
  }
}

/**
 * Stores paired organization metadata for quick technician reconnection.
 */
export function savePairedOrgInfo(info: { tenantId: string; name?: string; serverUrl: string }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_PAIRED_ORG_KEY, JSON.stringify({
      ...info,
      pairedAt: new Date().toISOString()
    }));
  } catch (_) {}
}

export function getPairedOrgInfo(): { tenantId?: string; name?: string; serverUrl?: string; pairedAt?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_PAIRED_ORG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
