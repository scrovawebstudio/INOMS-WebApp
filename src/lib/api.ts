/**
 * Authenticated API Client for INOMS Home Server Full-Stack Architecture
 */

import { getAuthToken, setAuthToken, clearAuthToken, getLocalDB } from './localDb';
import { getAppStorageItem, getDeletedTenantIds, markTenantDeletedInStorage } from './storage';
import { resolveApiUrl } from './serverConfig';

// Custom fetch wrapper that automatically routes requests to the configured Pro Local Server URL
const apiFetch = (url: string | URL | Request, init?: RequestInit) => {
  if (typeof url === 'string') {
    return fetch(resolveApiUrl(url), init);
  }
  return fetch(url, init);
};

export interface LoginResponse {
  success: boolean;
  token?: string;
  sessionId?: string;
  user?: {
    id: string;
    name: string;
    role: string;
    username?: string;
    mobile?: string;
    tenantId: string;
  };
  organization?: {
    id: string;
    name: string;
    code: string;
    ownerMobile: string;
    ownerName: string;
    status: string;
  };
  message?: string;
}

export async function loginViaApi(params: {
  tenantId: string;
  pin?: string;
  username?: string;
  password?: string;
  deviceInfo?: string;
}): Promise<LoginResponse> {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.success && data.token) {
      setAuthToken(data.token, true);
    }
    return data;
  } catch (err: any) {
    console.warn('Login API error:', err);
    return { success: false, message: 'Could not connect to Home Server' };
  }
}

export async function logoutViaApi(): Promise<void> {
  try {
    const token = getAuthToken();
    if (token) {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (e) {}
  clearAuthToken();
}

export async function verifyTOTPViaApi(
  tenantIdOrMobile: string,
  code: string,
  secretKey?: string
): Promise<{ success: boolean; token?: string; sessionId?: string; user?: any; organization?: any; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdOrMobile,
        mobile: tenantIdOrMobile,
        code,
        secretKey
      })
    });
    const data = await res.json();
    if (data.success && data.token) {
      setAuthToken(data.token, true);
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'Verification network error' };
  }
}

export async function verifyMasterPinViaApi(codeOrPin: string): Promise<boolean> {
  try {
    const res = await apiFetch('/api/auth/verify-master-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: codeOrPin
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token) {
        setAuthToken(data.token, true);
      }
      return !!data.success;
    }
    return false;
  } catch (err) {
    return false;
  }
}

export async function verifyOrgPinViaApi(
  tenantId: string,
  pin: string,
  secretKey?: string
): Promise<{ success: boolean; token?: string; sessionId?: string; user?: any; organization?: any; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        pin,
        secretKey
      })
    });
    const data = await res.json();
    if (data.success && data.token) {
      setAuthToken(data.token, true);
    }
    return data;
  } catch (err: any) {
    return { success: false, message: 'Server connection error during PIN verification' };
  }
}

const tenantSessionRequests = new Map<string, Promise<string | null>>();

export async function ensureTenantSessionViaApi(
  tenantId: string,
  user?: { id?: string; name?: string; role?: string; username?: string; mobile?: string } | null
): Promise<string | null> {
  if (!tenantId) return null;

  const userKey = user?.id || user?.username || user?.role || 'admin';
  const sessionKey = `${tenantId}:${userKey}`;
  const existing = tenantSessionRequests.get(sessionKey);
  if (existing) return existing;

  const request = (async () => {
    try {
      const res = await apiFetch('/api/auth/session-for-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId: user?.id,
          userName: user?.name,
          userRole: user?.role,
          username: user?.username,
          mobile: user?.mobile
        })
      });
      const data = await res.json();
      if (data.success && data.token) {
        setAuthToken(data.token, true);
        return data.token;
      }
      return null;
    } catch (e) {
      return null;
    } finally {
      tenantSessionRequests.delete(sessionKey);
    }
  })();

  tenantSessionRequests.set(sessionKey, request);
  return request;
}

export async function getValidTenantToken(tenantId: string): Promise<string | null> {
  if (!tenantId) return getAuthToken();

  const currentToken = getAuthToken();
  if (currentToken) {
    try {
      const sessionRes = await apiFetch('/api/auth/session', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        }
      });
      const sessionData = await sessionRes.json();
      if (sessionRes.ok && sessionData?.success && sessionData?.authenticated !== false && sessionData?.user?.tenantId && String(sessionData.user.tenantId) === String(tenantId)) {
        return currentToken;
      }
      // If server explicitly says session is invalid/expired, clear the stale token
      if (sessionData && (sessionData.authenticated === false || sessionData.success === false)) {
        clearAuthToken();
      }
    } catch (e) {
      // Fall through to tenant re-authentication.
    }
  }

  // Attempt retrieving stored user information from browser storage
  let savedUser: any = null;
  try {
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem('inoms_session_current_user') ||
                  localStorage.getItem('app_storage_current_user') ||
                  sessionStorage.getItem('current_user');
      if (raw) savedUser = JSON.parse(raw);
    }
  } catch (e) {}

  const refreshedToken = await ensureTenantSessionViaApi(tenantId, savedUser);
  return refreshedToken || currentToken || getAuthToken();
}

export async function bootstrapTenantFromHomeServer(tenantId: string): Promise<{
  success: boolean;
  serverRevision?: number;
  companyConfig?: any;
  collections?: Record<string, any[]>;
  message?: string;
}> {
  if (!tenantId) return { success: false, message: 'Tenant ID required' };
  try {
    let token = await getValidTenantToken(tenantId);
    if (!token) token = await ensureTenantSessionViaApi(tenantId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await apiFetch(`/api/sync/bootstrap?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    if (data.success) {
      console.info(`[Home Server Sync] GET /api/sync/bootstrap -> Bootstrapped authoritative data for ${tenantId}`);
    }
    return data;
  } catch (err: any) {
    console.warn(`[Home Server Sync] GET /api/sync/bootstrap failed:`, err?.message || err);
    return { success: false, message: err?.message || 'Bootstrap failed' };
  }
}

export async function pullDeltaFromHomeServerViaApi(tenantId: string, sinceRevision = 0): Promise<{
  success: boolean;
  currentRevision?: number;
  hasChanges?: boolean;
  changes?: any[];
  message?: string;
}> {
  if (!tenantId) return { success: false, message: 'Tenant ID required' };
  try {
    let token = await getValidTenantToken(tenantId);
    if (!token) token = await ensureTenantSessionViaApi(tenantId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await apiFetch(`/api/sync/pull?sinceRevision=${sinceRevision}&tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'GET',
      headers
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Pull delta failed' };
  }
}

export async function collectBrowserSyncSnapshot(): Promise<{
  tenants: any[];
  companyConfigs: Record<string, any>;
  collections: Record<string, Record<string, any[]>>;
}> {
  const snapshot = {
    tenants: [] as any[],
    companyConfigs: {} as Record<string, any>,
    collections: {} as Record<string, Record<string, any[]>>
  };

  if (typeof window === 'undefined') return snapshot;

  const seenTenantIds = new Set<string>();
  const deletedTenantIds = getDeletedTenantIds();

  for (const candidate of [
    getAppStorageItem('tenants_v3'),
    localStorage.getItem('inoms_tenants_v3'),
    localStorage.getItem('tenants_v3')
  ]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (!Array.isArray(parsed)) continue;
      for (const tenant of parsed) {
        if (!tenant || !tenant.id) continue;
        const tid = String(tenant.id);
        if (deletedTenantIds.has(tid) || tid === 'global_system_branding') continue;
        if (!seenTenantIds.has(tid)) {
          seenTenantIds.add(tid);
          snapshot.tenants.push(tenant);
        }
      }
    } catch {
      // Ignore malformed cached tenant blobs.
    }
  }

  for (const key of Object.keys(localStorage)) {
    if (!/^(inoms_)?company_config_/.test(key)) continue;
    const configTenantId = key.replace(/^(inoms_)?company_config_/, '');
    if (deletedTenantIds.has(configTenantId) || configTenantId === 'global_system_branding') continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        snapshot.companyConfigs[configTenantId] = parsed;
      }
    } catch {
      // Ignore malformed config payloads.
    }
  }

  try {
    const db = await getLocalDB();
    const tx = db.transaction('entities', 'readonly');
    const allRecords = await tx.objectStore('entities').getAll();
    for (const entry of allRecords) {
      if (!entry || !entry.tenantId || !entry.entity || !entry.data || entry.deletedAt) continue;
      if (!snapshot.collections[entry.tenantId]) snapshot.collections[entry.tenantId] = {};
      const entityBucket = snapshot.collections[entry.tenantId][entry.entity] || [];
      entityBucket.push(entry.data);
      snapshot.collections[entry.tenantId][entry.entity] = entityBucket;
    }
  } catch {
    // Ignore local replica read failures; import is best-effort and should not block the app.
  }

  return snapshot;
}

export async function importBrowserTenantDataToServer(tenantId?: string): Promise<{ success: boolean; imported?: number; message?: string }> {
  try {
    const snapshot = await collectBrowserSyncSnapshot();
    const hasData = snapshot.tenants.length > 0 || Object.keys(snapshot.companyConfigs).length > 0 || Object.keys(snapshot.collections).length > 0;
    if (!hasData) {
      return { success: true, imported: 0, message: 'No browser-stored tenant data found to import.' };
    }

    let token = tenantId ? await getValidTenantToken(tenantId) : getAuthToken();
    if (!token && tenantId) {
      token = await ensureTenantSessionViaApi(tenantId);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await apiFetch('/api/sync/import-browser-data', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId: tenantId || snapshot.tenants[0]?.id || Object.keys(snapshot.companyConfigs)[0],
        tenants: snapshot.tenants,
        companyConfigs: snapshot.companyConfigs,
        collections: snapshot.collections
      })
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('[Home Server Sync] Browser tenant import failed:', err?.message || err);
    return { success: false, message: err?.message || 'Browser tenant import failed' };
  }
}

export async function saveAllTenantDataViaApi(
  tenantId: string,
  companyConfig: any,
  collections: Record<string, any[]>
): Promise<{ success: boolean; serverRevision?: number; message?: string }> {
  try {
    // For regular tenant organizations, day-to-day operational collections are stored locally in the browser & local backup.
    // Only company details/config are sent to server unless the tenant is Master Admin ('org-admin').
    const collectionsToSend = tenantId === 'org-admin' ? collections : {};

    let token = await getValidTenantToken(tenantId);
    if (!token) token = await ensureTenantSessionViaApi(tenantId);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await apiFetch('/api/sync/save-all', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId, companyConfig, collections: collectionsToSend })
    });

    if (res.status === 401 || res.status === 403) {
      // Re-issue token and retry once
      const newToken = await ensureTenantSessionViaApi(tenantId);
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryRes = await apiFetch('/api/sync/save-all', {
          method: 'POST',
          headers,
          body: JSON.stringify({ tenantId, companyConfig, collections: collectionsToSend })
        });
        const retryData = await retryRes.json();
        if (retryData.success) {
          console.info(`[Home Server Sync] POST /api/sync/save-all (retry) -> Snapshot saved for tenant: ${tenantId}`);
        }
        return retryData;
      }
    }

    const data = await res.json();
    if (data.success) {
      console.info(`[Home Server Sync] POST /api/sync/save-all -> Snapshot saved to Home Server SQLite for tenant: ${tenantId}`);
    }
    return data;
  } catch (err: any) {
    console.warn(`[Home Server Sync] POST /api/sync/save-all failed:`, err?.message || err);
    return { success: false, message: err?.message || 'Home Server save failed' };
  }
}

const syncDebounceTimers = new Map<string, any>();
const inFlightSaveRequests = new Map<string, Promise<{ success: boolean; message?: string }>>();
const lastSerializedSavePayloads = new Map<string, string>();

function isTenantHomeServerEnabled(tenantId: string): boolean {
  if (tenantId === 'org-admin' || tenantId === 'global_system_branding') return true;
  try {
    const raw = typeof window !== 'undefined' ? getAppStorageItem('tenants_v3') : null;
    const tenants = raw ? JSON.parse(raw) : [];
    const tenant = Array.isArray(tenants) ? tenants.find((item: any) => item.id === tenantId) : null;
    return tenant?.features?.allowHomeServerSync !== false;
  } catch {
    return true;
  }
}

export async function saveTenantCollectionViaApi(
  tenantId: string,
  entity: string,
  items?: any[],
  deletedIdsOrConfig?: any,
  immediate = false
): Promise<{ success: boolean; message?: string }> {
  if (!tenantId || !entity) return { success: false, message: 'Tenant and entity required' };

  if (!isTenantHomeServerEnabled(tenantId)) return { success: true, message: 'Local-only tenant; server save skipped' };

  const deletedIds = Array.isArray(deletedIdsOrConfig) ? deletedIdsOrConfig : undefined;
  const config = !Array.isArray(deletedIdsOrConfig) ? deletedIdsOrConfig : undefined;

  const requestKey = `${tenantId}:${entity}`;
  const payloadSignature = JSON.stringify({
    items: Array.isArray(items) ? items.map(item => ({
      ...item,
      __syncKey: item?.id || item?._id || JSON.stringify(item)
    })) : items,
    config: config ? { ...config } : null,
    deletedIds: deletedIds || null
  });

  const previousPayload = lastSerializedSavePayloads.get(requestKey);
  if (previousPayload === payloadSignature && !immediate) {
    return { success: true, message: 'Duplicate collection payload suppressed' };
  }

  const existing = inFlightSaveRequests.get(requestKey);
  if (existing && !immediate) return existing;

  lastSerializedSavePayloads.set(requestKey, payloadSignature);

  const doExecuteSave = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      let token = await getValidTenantToken(tenantId);
      if (!token) token = await ensureTenantSessionViaApi(tenantId);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      let res = await apiFetch('/api/sync/save-collection', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tenantId, entity, items, config, deletedIds })
      });

      if (res.status === 401 || res.status === 403) {
        const newToken = await ensureTenantSessionViaApi(tenantId);
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          res = await apiFetch('/api/sync/save-collection', {
            method: 'POST',
            headers,
            body: JSON.stringify({ tenantId, entity, items, config, deletedIds })
          });
        }
      }

      const data = await res.json().catch(() => null);
      if (data && data.success) {
        console.info(`[Home Server Sync] POST /api/sync/save-collection -> Saved ${entity} (${Array.isArray(items) ? items.length : 1} records) for tenant: ${tenantId}`);
        return data;
      }
      return { success: false, message: data?.error || data?.message || `Server returned error (${res.status})` };
    } catch (err: any) {
      console.warn(`[Home Server Sync] POST /api/sync/save-collection failed for ${entity}:`, err?.message || err);
      return { success: false, message: err?.message || 'Home Server collection save failed' };
    } finally {
      inFlightSaveRequests.delete(requestKey);
    }
  };

  if (immediate) {
    const timerKey = `${tenantId}:${entity}`;
    if (syncDebounceTimers.has(timerKey)) {
      clearTimeout(syncDebounceTimers.get(timerKey));
      syncDebounceTimers.delete(timerKey);
    }
    const directPromise = doExecuteSave();
    inFlightSaveRequests.set(requestKey, directPromise);
    return directPromise;
  }

  const request = new Promise<{ success: boolean; message?: string }>((resolve) => {
    const timerKey = `${tenantId}:${entity}`;
    if (syncDebounceTimers.has(timerKey)) {
      clearTimeout(syncDebounceTimers.get(timerKey));
    }

    const timer = setTimeout(async () => {
      syncDebounceTimers.delete(timerKey);
      const result = await doExecuteSave();
      resolve(result);
    }, 500);

    syncDebounceTimers.set(timerKey, timer);
  });

  inFlightSaveRequests.set(requestKey, request);
  return request;
}

export async function uploadInvoicePdfViaApi(
  filename: string,
  base64Pdf: string,
  subfolder: string = 'invoices'
): Promise<{ success: boolean; filename?: string; publicUrl?: string; message?: string }> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await apiFetch('/api/docs/upload-pdf', {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename, base64Pdf, subfolder })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not upload PDF document' };
  }
}

export async function fetchAdminOrganizationsViaApi(): Promise<{ success: boolean; organizations?: any[]; message?: string }> {
  try {
    const token = getAuthToken();
    const res = await apiFetch('/api/admin/organizations', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not fetch admin organizations' };
  }
}

export async function staffLoginViaApi(
  tenantId: string,
  username: string,
  password: string
): Promise<{ success: boolean; user?: any; role?: string; message?: string }> {
  try {
    const res = await loginViaApi({ tenantId, username, password });
    if (res.success && res.user) {
      return { success: true, user: res.user, role: res.user.role };
    }
    return { success: false, message: res.message || 'Login failed' };
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function registerOrgViaApi(
  name: string,
  ownerMobile: string,
  ownerName?: string,
  pin?: string,
  secretKey?: string,
  options?: {
    isTrial?: boolean;
    trialDays?: number;
    subscriptionPlan?: string;
    city?: string;
    source?: string;
  }
): Promise<{ success: boolean; org?: any; token?: string; user?: any; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/register-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        ownerMobile, 
        ownerName, 
        pin, 
        secretKey,
        isTrial: options?.isTrial !== undefined ? options.isTrial : true,
        trialDays: options?.trialDays ?? 7,
        subscriptionPlan: options?.subscriptionPlan || 'trial',
        city: options?.city,
        source: options?.source || 'inoms.in_7day_trial'
      })
    });
    const data = await res.json();
    if (data.success && data.token) {
      setAuthToken(data.token, true);
    }
    return data;
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function lookupOrgByMobileViaApi(
  mobileOrCode: string
): Promise<{ success: boolean; org?: any; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/lookup-mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobileOrCode, code: mobileOrCode })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not connect to server during organization lookup' };
  }
}

export async function updateOrgViaApi(
  orgData: any
): Promise<{ success: boolean; org?: any; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/update-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgData)
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function fetchOwnOrganizationPinViaApi(tenantId: string): Promise<{ success: boolean; pin?: string; message?: string }> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await apiFetch(`/api/auth/my-org-pin?tenantId=${encodeURIComponent(tenantId)}`, { headers });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not load organisation PIN' };
  }
}

export async function syncTenantsViaApi(
  tenants: any[]
): Promise<{ success: boolean; count?: number; message?: string }> {
  if (!Array.isArray(tenants) || tenants.length === 0) return { success: true, count: 0 };
  try {
    const res = await apiFetch('/api/auth/sync-tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenants })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not sync tenants to server' };
  }
}

export async function deleteOrgViaApi(
  id: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/delete-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function fetchServerHealth(): Promise<{ status: string; ok: boolean; postgres?: boolean; time?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await apiFetch('/api/health', {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return { status: 'offline', ok: false };
    }
    const data = await res.json();
    return {
      status: data.status || 'ok',
      ok: true,
      postgres: data.postgres,
      time: data.time
    };
  } catch (e) {
    return { status: 'offline', ok: false };
  }
}

export async function getHomeServerDbKey(key: string): Promise<any> {
  return null;
}

export async function saveHomeServerDbKey(key: string, data: any): Promise<boolean> {
  return true;
}

export async function restoreHomeServerDb(data: any): Promise<boolean> {
  return true;
}

export async function registerHomeServerSession(
  tenantId: string,
  sessionUserId: string,
  sessionId: string,
  deviceInfo?: string
): Promise<void> {
  // Session registration handled via login tokens
}

export async function checkHomeServerSession(
  tenantId: string,
  sessionUserId: string
): Promise<{ activeSessionId?: string; deviceInfo?: string } | null> {
  return null;
}

export async function fetchTenantsViaApi(): Promise<{ success: boolean; tenants?: any[]; message?: string }> {
  try {
    const res = await apiFetch('/api/auth/tenants');
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not fetch organizations' };
  }
}

export async function scanAndImportDataFolderApi(): Promise<{
  success: boolean;
  filesScanned: number;
  filesImported: string[];
  counts: Record<string, number>;
  message: string;
  organizations?: any[];
  collections?: any;
}> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/admin/scan-import-data-folder', {
      method: 'POST',
      headers
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      filesScanned: 0,
      filesImported: [],
      counts: {},
      message: err?.message || 'Failed to scan and import data folder'
    };
  }
}

export async function uploadOrgsFolderApi(files: { path: string; content: any }[]): Promise<{
  success: boolean;
  filesScanned: number;
  filesImported: string[];
  counts: Record<string, number>;
  message: string;
  organizations?: any[];
  collections?: any;
}> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/admin/upload-orgs-folder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ files })
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      filesScanned: 0,
      filesImported: [],
      counts: {},
      message: err?.message || 'Failed to upload and import organizations folder'
    };
  }
}

export async function getDataFolderStatusApi(): Promise<any> {
  try {
    const res = await apiFetch('/api/admin/data-folder-status');
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteOrgApi(orgId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!orgId) return { success: false, error: 'Organization ID is required' };
  markTenantDeletedInStorage(orgId);
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/auth/delete-org', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: orgId })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete organization' };
  }
}

export async function purgeAllDataApi(wipeMasterData: boolean = false): Promise<{ success: boolean; message?: string; purgedCount?: number; tenants?: any[]; error?: string }> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/admin/purge-all-data', {
      method: 'POST',
      headers,
      body: JSON.stringify({ wipeMasterData })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to purge database' };
  }
}

export async function clearOrgWorkspaceApi(tenantId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/org/clear-workspace', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to clear workspace' };
  }
}

export async function saveBackupSnapshotToServer(
  tenantId: string,
  orgName: string,
  data: any,
  filename?: string
): Promise<{ success: boolean; filename?: string; size?: string; date?: string; downloadUrl?: string; message?: string; error?: string }> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/backup/save-snapshot', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId, orgName, data, filename })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save snapshot to server' };
  }
}

export async function listServerBackupSnapshots(): Promise<{
  success: boolean;
  snapshots?: Array<{
    id: string;
    filename: string;
    size: string;
    sizeBytes: number;
    mtime: number;
    date: string;
    downloadUrl: string;
  }>;
  error?: string;
}> {
  try {
    const res = await apiFetch('/api/backup/list-json-snapshots');
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list snapshots' };
  }
}

export function getDirectBackupDownloadUrl(tenantId: string = 'org-admin'): string {
  return `/api/backup/download-json?tenantId=${encodeURIComponent(tenantId)}`;
}

export function getMasterBackupDownloadUrl(): string {
  return resolveApiUrl('/api/backup/download-master-json');
}

// -------------------------------------------------------------
// PRO LOCAL SERVER & TECHNICIAN DISCOVERY / PAIRING HELPERS
// -------------------------------------------------------------

export interface ProServerInfo {
  success: boolean;
  serverName: string;
  lanIps: string[];
  recommendedServerUrl: string;
  port: number;
  engine: 'postgresql' | 'sqlite';
  postgres: boolean;
  uptimeSeconds: number;
  timestamp: string;
  isProServer: boolean;
  error?: string;
}

export async function fetchServerInfo(): Promise<ProServerInfo> {
  try {
    const res = await apiFetch('/api/server/info');
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      serverName: 'Offline',
      lanIps: [],
      recommendedServerUrl: '',
      port: 3000,
      engine: 'sqlite',
      postgres: false,
      uptimeSeconds: 0,
      timestamp: new Date().toISOString(),
      isProServer: true,
      error: err?.message || 'Cannot reach INOMS server'
    };
  }
}

export async function generateServerPairingToken(customServerUrl?: string): Promise<{
  success: boolean;
  code?: string;
  serverUrl?: string;
  tenantId?: string;
  tenantName?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  error?: string;
}> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/server/pairing-token', {
      method: 'POST',
      headers,
      body: JSON.stringify({ customServerUrl })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate pairing token' };
  }
}

export async function verifyServerPairingCode(code: string, explicitServerBaseUrl?: string): Promise<{
  success: boolean;
  serverUrl?: string;
  tenantId?: string;
  tenantName?: string;
  message?: string;
  error?: string;
}> {
  try {
    const endpoint = explicitServerBaseUrl
      ? `${explicitServerBaseUrl.replace(/\/+$/, '')}/api/server/verify-pairing`
      : resolveApiUrl('/api/server/verify-pairing');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to connect to local server' };
  }
}

export async function fetchTechnicianSessions(): Promise<{
  success: boolean;
  technicianSessions?: Array<{
    session_id: string;
    device_info: string;
    last_active_at: string;
    created_at: string;
    user_id: string;
    user_name: string;
    role: string;
    username?: string;
  }>;
  error?: string;
}> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/api/server/technician-sessions', { headers });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch technician sessions' };
  }
}


