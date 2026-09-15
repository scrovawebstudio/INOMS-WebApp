import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TenantOrg, SystemAnnouncement, INITIAL_TENANTS } from '../components/AuthModal';
import { CompanyConfig } from '../types';
import { saveTenantCollectionViaApi } from './api';
import { broadcastLocalMutation } from './syncBroadcast';
import {
  saveLocalRecord,
  deleteLocalRecord,
  replaceLocalCollection,
  getLocalCollection,
  subscribeLocalDb
} from './localDb';
import {
  getAppStorageItem,
  setAppStorageItem,
  removeAppStorageItem,
  getDeletedTenantIds,
  markTenantDeletedInStorage,
  unmarkTenantDeletedInStorage
} from './storage';
import {
  isSupabaseConfigured,
  syncCollectionToSupabase,
  syncCompanyConfigToSupabase,
  syncTenantToSupabase,
  deleteTenantFromSupabase,
  fetchCollectionFromSupabase
} from './supabase';
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

function isHomeServerSyncEnabledForTenant(tenantId: string): boolean {
  if (tenantId === 'org-admin') return true;
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const tenants = raw ? JSON.parse(raw) : [];
    const tenant = Array.isArray(tenants) ? tenants.find((item: TenantOrg) => item.id === tenantId) : null;
    return tenant?.features?.allowHomeServerSync !== false;
  } catch {
    return true;
  }
}

/**
 * Executes official Google Login popup to authenticate the user using Firebase Auth.
 * Authentication identity only — NO business data is stored or retrieved from Firebase.
 */
export async function signInWithGoogle(): Promise<{ userEmail: string; displayName: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    const result = await signInWithPopup(auth, provider);
    const userEmail = result.user.email || '';
    const displayName = result.user.displayName || userEmail.split('@')[0] || '';

    return { userEmail, displayName };
  } catch (err: any) {
    console.warn('Firebase Google Auth popup notice:', err?.message || err);
    return { userEmail: '', displayName: '' };
  }
}

// -------------------------------------------------------------
// HOME SERVER MULTI-TENANT & CONFIGURATION SYNC
// -------------------------------------------------------------

let cachedTenants: TenantOrg[] | null = null;
let isFetchingTenants = false;
const tenantListeners = new Set<(tenants: TenantOrg[]) => void>();
let tenantPollTimer: any = null;

function ensureAdminActiveInList(list: TenantOrg[]): TenantOrg[] {
  let hasAdmin = false;
  const filtered = (list || []).filter(t => t && t.id && t.id !== 'global_system_branding' && t.code !== 'GLOBAL_SYS');
  const result = filtered.map(t => {
    if (t.id === 'org-admin' || t.id === 'org-nibban' || t.code?.toUpperCase() === 'NIBBAN' || t.code?.toUpperCase() === 'ADMIN' || t.code?.toUpperCase() === 'ADMIN-00') {
      hasAdmin = true;
      return { ...t, status: 'active' as const };
    }
    return t;
  });
  if (!hasAdmin) {
    result.unshift({
      id: 'org-admin',
      name: 'Master System Admin',
      code: 'ADMIN-00',
      ownerMobile: '+91 8149862034',
      ownerName: 'Master Admin',
      status: 'active',
      createdAt: '2026-01-01',
      subscriptionPlan: 'lifetime',
      isTrial: false,
      trialDays: 0,
      pin: '1234'
    });
  }
  return result;
}

// In-flight organization mutation tracking to prevent background poll collisions
const inFlightTenantUpdates = new Set<string>();

export async function fetchTenantsOnce(force = false): Promise<TenantOrg[]> {
  const deletedIds = getDeletedTenantIds();

  if (cachedTenants && !force && !isFetchingTenants) {
    return cachedTenants.filter(t => t?.id && !deletedIds.has(t.id));
  }

  // Load from local storage immediately so UI is instant on first mount
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && list.length > 0) {
      cachedTenants = ensureAdminActiveInList(list.filter((t: any) => !!t?.id && !deletedIds.has(t.id) && t.id !== 'global_system_branding'));
    }
  } catch (e) {}

  if (isFetchingTenants) {
    return cachedTenants || INITIAL_TENANTS;
  }

  isFetchingTenants = true;
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inoms_auth_token') || sessionStorage.getItem('inoms_auth_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/auth/tenants', { headers }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.tenants)) {
        const serverTenants: TenantOrg[] = data.tenants;
        const currentDeleted = getDeletedTenantIds();

        // Server is the single source of truth for existing organizations!
        // Filter out tombstoned, deleted, and global system branding records.
        const validServerTenants = serverTenants.filter(
          st => st && st.id && !currentDeleted.has(st.id) && st.id !== 'global_system_branding'
        );

        // Merge with locally registered or cached organizations so newly created tenants are not wiped out
        const serverIds = new Set(validServerTenants.map(t => t.id));
        const retainedLocals = (cachedTenants || []).filter(
          lt => lt && lt.id && !serverIds.has(lt.id) && !currentDeleted.has(lt.id) && lt.id !== 'global_system_branding'
        );

        // Guard: If this tenant is currently undergoing an in-flight save/toggle, preserve local state
        const combined = [...validServerTenants.map(st => {
          if (inFlightTenantUpdates.has(st.id)) {
            const currentLocal = (cachedTenants || []).find(t => t.id === st.id);
            if (currentLocal) return currentLocal;
          }
          return st;
        }), ...retainedLocals];

        const merged = ensureAdminActiveInList(combined);
        cachedTenants = merged;
        setAppStorageItem('tenants_v3', JSON.stringify(merged));
        try { localStorage.setItem('tenants_v3', JSON.stringify(merged)); } catch (_) {}
        try { localStorage.setItem('inoms_tenants_v3', JSON.stringify(merged)); } catch (_) {}

        tenantListeners.forEach(cb => {
          try { cb(merged); } catch (_) {}
        });
      }
    }
  } catch (err) {
    console.warn('Fetch tenants notice:', err);
  } finally {
    isFetchingTenants = false;
  }

  return cachedTenants || INITIAL_TENANTS;
}

let tenantBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    tenantBroadcastChannel = new BroadcastChannel('inoms_tenants_broadcast');
    tenantBroadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'TENANTS_UPDATED' && Array.isArray(event.data.tenants)) {
        cachedTenants = event.data.tenants;
        setAppStorageItem('tenants_v3', JSON.stringify(cachedTenants));
        tenantListeners.forEach(cb => {
          try { cb(cachedTenants!); } catch (_) {}
        });
      }
    };
  } catch (_) {}
}

export function broadcastTenantListUpdate(tenants: TenantOrg[]) {
  if (tenantBroadcastChannel) {
    try {
      tenantBroadcastChannel.postMessage({ type: 'TENANTS_UPDATED', tenants });
    } catch (_) {}
  }
}

export function subscribeTenants(onUpdate: (tenants: TenantOrg[]) => void) {
  tenantListeners.add(onUpdate);

  // Deliver cached or local tenants immediately
  if (cachedTenants && cachedTenants.length > 0) {
    onUpdate(cachedTenants);
  } else {
    try {
      const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length > 0) {
        const safe = ensureAdminActiveInList(list);
        cachedTenants = safe;
        onUpdate(safe);
      }
    } catch (_) {}
  }

  // Fetch tenants immediately from server on subscription
  fetchTenantsOnce(true);

  // Periodic polling every 60 seconds (was 6s) when tab is active
  const pollInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetchTenantsOnce(true);
  }, 60000);

  const handleVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetchTenantsOnce(true);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  return () => {
    tenantListeners.delete(onUpdate);
    clearInterval(pollInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    }
  };
}

export async function saveTenantToFirestore(tenant: TenantOrg): Promise<{ success: boolean; org?: TenantOrg }> {
  if (!tenant?.id) throw new Error('Invalid organization ID');

  inFlightTenantUpdates.add(tenant.id);
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inoms_auth_token') || sessionStorage.getItem('inoms_auth_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) credentialsHeader(headers, token);

    const res = await fetch('/api/auth/update-org', {
      method: 'POST',
      headers,
      body: JSON.stringify(tenant)
    });

    if (!res.ok) {
      let errDetail = `Server returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error || errJson?.message) errDetail = errJson.error || errJson.message;
      } catch (_) {}
      throw new Error(errDetail);
    }

    const result = await res.json().catch(() => null);
    if (!result?.success) {
      throw new Error(result?.error || result?.message || 'Server rejected organization update');
    }

    const confirmedOrg: TenantOrg = result.org || tenant;

    // If tenant is active, ensure any deleted tombstone is cleared
    if (confirmedOrg.status === 'active') {
      unmarkTenantDeletedInStorage(confirmedOrg.id);
    }

    // Direct Supabase Cloud Sync
    if (isSupabaseConfigured()) {
      syncTenantToSupabase(confirmedOrg).catch(err => {
        console.warn('[Supabase Sync] organization update error:', err?.message || err);
      });
    }

    // 1. Authoritative server confirmed update -> Commit to local cache and subscribers
    try {
      const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
      const list: TenantOrg[] = raw ? JSON.parse(raw) : [];
      const index = list.findIndex(t => t.id === tenant.id);
      let nextList: TenantOrg[];
      if (index >= 0) {
        nextList = list.map(t => t.id === tenant.id ? { ...t, ...confirmedOrg } : t);
      } else {
        nextList = [...list, confirmedOrg];
      }
      const safe = ensureAdminActiveInList(nextList);
      cachedTenants = safe;
      const jsonStr = JSON.stringify(safe);
      setAppStorageItem('tenants_v3', jsonStr);
      try { localStorage.setItem('tenants_v3', jsonStr); } catch (_) {}
      try { localStorage.setItem('inoms_tenants_v3', jsonStr); } catch (_) {}
      tenantListeners.forEach(cb => {
        try { cb(safe); } catch (_) {}
      });
      broadcastTenantListUpdate(safe);
    } catch (_) {}

    return { success: true, org: confirmedOrg };
  } finally {
    inFlightTenantUpdates.delete(tenant.id);
  }
}

function credentialsHeader(headers: Record<string, string>, token: string) {
  headers['Authorization'] = `Bearer ${token}`;
}

export async function updateTenantInFirestore(tenant: TenantOrg): Promise<{ success: boolean; org?: TenantOrg }> {
  return await saveTenantToFirestore(tenant);
}

export async function deleteTenantFromFirestore(tenantId: string): Promise<void> {
  if (!tenantId) throw new Error('Tenant ID required');

  // Immediately tombstone this tenant so it can never be pulled or pushed anywhere
  markTenantDeletedInStorage(tenantId);
  inFlightTenantUpdates.add(tenantId);

  // Purge all browser-stored data for this tenant
  try {
    const prefixes = [
      'clients_', 'jobs_', 'invoices_', 'payments_', 'products_', 'expenses_', 'ledger_',
      'users_', 'categories_', 'racks_', 'equipments_', 'problems_', 'suppliers_',
      'servicePartners_', 'purchaseOrders_', 'purchases_', 'purchaseReturns_', 'company_config_'
    ];
    for (const prefix of prefixes) {
      setAppStorageItem(`${prefix}${tenantId}`, null as any);
      try { localStorage.removeItem(`${prefix}${tenantId}`); } catch (_) {}
      try { localStorage.removeItem(`inoms_${prefix}${tenantId}`); } catch (_) {}
    }
  } catch (_) {}

  // Immediately remove from in-memory cache and notify local subscribers with zero delay
  if (cachedTenants) {
    cachedTenants = cachedTenants.filter(t => t.id !== tenantId);
  }
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const list: TenantOrg[] = raw ? JSON.parse(raw) : [];
    const nextList = ensureAdminActiveInList(list.filter(t => t.id !== tenantId));
    cachedTenants = nextList;
    setAppStorageItem('tenants_v3', JSON.stringify(nextList));
    try { localStorage.setItem('tenants_v3', JSON.stringify(nextList)); } catch (_) {}
    try { localStorage.setItem('inoms_tenants_v3', JSON.stringify(nextList)); } catch (_) {}
    tenantListeners.forEach(cb => {
      try { cb(nextList); } catch (_) {}
    });
    broadcastTenantListUpdate(nextList);
  } catch (_) {}

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inoms_auth_token') || sessionStorage.getItem('inoms_auth_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) credentialsHeader(headers, token);

    const res = await fetch('/api/auth/delete-org', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: tenantId })
    });

    if (!res.ok) {
      let errDetail = `Server returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error || errJson?.message) errDetail = errJson.error || errJson.message;
      } catch (_) {}
      throw new Error(errDetail);
    }

    const result = await res.json().catch(() => null);
    if (!result?.success) {
      throw new Error(result?.error || result?.message || 'Server rejected organization deletion');
    }

    if (isSupabaseConfigured()) {
      deleteTenantFromSupabase(tenantId).catch(err => {
        console.warn('[Supabase Sync] organization delete error:', err?.message || err);
      });
    }
  } finally {
    inFlightTenantUpdates.delete(tenantId);
  }
}

export function subscribeAnnouncements(onUpdate: (announcements: SystemAnnouncement[]) => void) {
  // Empty or local announcements
  return () => {};
}

export async function saveAnnouncementToFirestore(announcement: SystemAnnouncement): Promise<void> {
  // Local only
}

export async function deleteAnnouncementFromFirestore(id: string): Promise<void> {
  // Local only
}

export function subscribeCompanyConfig(tenantId: string, onUpdate: (config: CompanyConfig) => void) {
  if (!tenantId) return () => {};
  
  // Listen to localDb updates for config scoped to tenantId
  const unsub = subscribeLocalDb((tId, entity, data) => {
    if (tId === tenantId && entity === 'config' && data.length > 0) {
      onUpdate(data[0] as unknown as CompanyConfig);
    }
  });

  return unsub;
}

export async function saveCompanyConfigToFirestore(tenantId: string, config: CompanyConfig): Promise<void> {
  if (!tenantId) return;
  setAppStorageItem(`company_config_${tenantId}`, JSON.stringify(config));
  await saveLocalRecord(tenantId, 'config', { ...config, id: tenantId });

  if (isSupabaseConfigured()) {
    syncCompanyConfigToSupabase(tenantId, config).catch(err => {
      console.warn('[Supabase Sync] company config error:', err?.message || err);
    });
  }

  if (!isHomeServerSyncEnabledForTenant(tenantId)) return;
  try {
    saveTenantCollectionViaApi(tenantId, 'config', undefined, config).catch(() => {});
  } catch (e) {}
}

export async function saveUserSessionToFirestore(
  tenantId: string,
  sessionUserId: string,
  sessionId: string,
  deviceInfo?: string
): Promise<void> {
  // Handled automatically by Home Server /api/auth/login and /api/auth/session
}

export function subscribeUserSession(
  tenantId: string,
  sessionUserId: string,
  onUpdate: (sessionData: { activeSessionId: string; deviceInfo?: string }) => void
) {
  return () => {};
}

// Sync status and pending queue utilities
export function isQuotaExhausted(): boolean {
  return false;
}

export function getPendingQueueCount(): number {
  return 0;
}

export function clearPendingQueue(): void {}

export async function retryPendingCloudSync(): Promise<void> {}

// -------------------------------------------------------------

export function subscribeTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  onUpdate: (items: T[]) => void,
  getLocalData?: () => T[]
) {
  if (!tenantId || !collectionName) return () => {};

  // 1. Immediately check synchronous localStorage (authoritative for fresh local edits)
  let hasLoadedFromStorage = false;
  try {
    const cachedRaw = getAppStorageItem(`${collectionName}_${tenantId}`) ||
                      localStorage.getItem(`inoms_${collectionName}_${tenantId}`) ||
                      localStorage.getItem(`${collectionName}_${tenantId}`);
    if (cachedRaw !== null && cachedRaw !== undefined) {
      const parsed = JSON.parse(cachedRaw);
      if (Array.isArray(parsed)) {
        hasLoadedFromStorage = true;
        onUpdate(parsed as T[]);
        // Ensure IndexedDB replica is also synchronized with this latest snapshot
        replaceLocalCollection(tenantId, collectionName, parsed, false, false).catch(() => {});
      }
    }
  } catch (e) {}

  // 2. If storage was empty or not found, fall back to IndexedDB
  if (!hasLoadedFromStorage) {
    getLocalCollection<T>(tenantId, collectionName).then(items => {
      if (Array.isArray(items) && items.length > 0) {
        onUpdate(items);
        setAppStorageItem(`${collectionName}_${tenantId}`, JSON.stringify(items));
      } else if (Array.isArray(items) && items.length === 0) {
        // Honor deleted/empty collection state
        onUpdate([] as T[]);
      } else if (tenantId === 'org-admin' && getLocalData) {
        const fallback = getLocalData();
        if (fallback && fallback.length > 0) {
          onUpdate(fallback);
        }
      }
    }).catch(() => {});
  }

  // 3. Subscribe to reactive local replica updates with strict tenant isolation
  const unsubscribe = subscribeLocalDb((tId, entity, data) => {
    if (tId === tenantId && entity === collectionName) {
      onUpdate(data as T[]);
    }
  });

  return unsubscribe;
}

export async function saveTenantCollectionToFirestore(
  tenantId: string,
  collectionName: string,
  items: any[],
  deletedIds?: string[]
): Promise<void> {
  if (!tenantId || !collectionName) return;
  const safeItems = Array.isArray(items) ? items : [];

  // 1. Save synchronously to localStorage
  setAppStorageItem(`${collectionName}_${tenantId}`, JSON.stringify(safeItems));

  // 2. Atomically replace collection in local IndexedDB replica
  await replaceLocalCollection(tenantId, collectionName, safeItems, false, false);

  // Broadcast immediate update to other tabs/windows
  broadcastLocalMutation(tenantId, collectionName, safeItems);

  // 3. Persist directly to Home Server SQLite database and await authoritative server response
  const res = await saveTenantCollectionViaApi(tenantId, collectionName, safeItems, deletedIds, true);
  if (res && res.success === false) {
    throw new Error(res.message || `Failed to persist ${collectionName} to server`);
  }

  // 4. Direct Supabase Cloud Sync
  if (isSupabaseConfigured()) {
    syncCollectionToSupabase(tenantId, collectionName, safeItems, deletedIds).catch(err => {
      console.warn(`[Supabase Sync] ${collectionName} collection error:`, err?.message || err);
    });
  }
}
