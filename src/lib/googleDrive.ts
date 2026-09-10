import { GoogleAuthProvider, signInWithPopup, User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { DEFAULT_GOOGLE_CLIENT_ID } from '../config/googleAuth';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface TenantDriveSession {
  accessToken: string;
  userEmail: string;
  userName: string;
  photoURL?: string;
  connectedAt: number;
  expiresAt?: number;
  lastRefreshedAt?: number;
  status?: 'active' | 'needs_refresh';
}

export interface TenantDrivePairing {
  userEmail: string;
  userName: string;
  photoURL?: string;
  connectedAt: number;
}

// In-memory tenant sessions map for multi-tenant isolation
const tenantDriveSessions = new Map<string, TenantDriveSession>();

// Active tenant ID being viewed/used
let currentActiveTenantId = '';
let isSyncingState = false;

// Proactive refresh timers for each tenant
const proactiveRefreshTimers = new Map<string, any>();

// In-flight refresh promises to deduplicate parallel silent refresh calls
const inFlightRefreshes = new Map<string, Promise<string>>();

/**
 * Schedule background token renewal 5 minutes before expiration
 */
export function scheduleProactiveTokenRefresh(tenantId: string, expiresAt?: number) {
  if (!tenantId || !expiresAt) return;
  if (proactiveRefreshTimers.has(tenantId)) {
    clearTimeout(proactiveRefreshTimers.get(tenantId));
    proactiveRefreshTimers.delete(tenantId);
  }

  // Renew 5 minutes (300,000 ms) before expiry, or in 5 seconds if already near/past
  const msUntilExpiry = expiresAt - Date.now();
  const msUntilRefresh = Math.max(5000, msUntilExpiry - 5 * 60 * 1000);

  const timerId = setTimeout(async () => {
    try {
      console.info(`[Google Drive] Proactively auto-renewing token for tenant: ${tenantId}`);
      await refreshDriveAccessToken(tenantId, { silent: true });
    } catch (e) {
      console.warn('[Google Drive] Proactive token auto-renewal notice:', e);
    }
  }, msUntilRefresh);

  proactiveRefreshTimers.set(tenantId, timerId);
}

export function clearProactiveTokenRefresh(tenantId: string) {
  if (proactiveRefreshTimers.has(tenantId)) {
    clearTimeout(proactiveRefreshTimers.get(tenantId));
    proactiveRefreshTimers.delete(tenantId);
  }
}

// Helper: check if HTTP response is a 401/403 authorization error
export function checkDriveAuthResponse(res: Response, tenantId?: string) {
  if (res.status === 401 || res.status === 403) {
    const tId = tenantId || currentActiveTenantId;
    if (tId) {
      // Invalidate the expired token so next call silently refreshes, but DO NOT delete the pairing!
      const session = tenantDriveSessions.get(tId);
      if (session) {
        session.expiresAt = 0;
        session.status = 'needs_refresh';
      }
      notifyListeners();
    }
    throw new Error('Google Drive authorization token expired. Refreshing connection...');
  }
}

// Helper: load session from storage for a tenant - NEVER deletes paired sessions upon expiry!
export function loadSessionForTenant(tenantId: string): TenantDriveSession | null {
  if (!tenantId) return null;

  if (tenantDriveSessions.has(tenantId)) {
    const session = tenantDriveSessions.get(tenantId)!;
    // If token has valid expiresAt in the future, ensure proactive refresh is running
    if (session.expiresAt && session.expiresAt > Date.now() && !proactiveRefreshTimers.has(tenantId)) {
      scheduleProactiveTokenRefresh(tenantId, session.expiresAt);
    }
    return session;
  }

  try {
    const raw = localStorage.getItem(`inoms_drive_session_${tenantId}`);
    if (raw) {
      const parsed: TenantDriveSession = JSON.parse(raw);
      if (parsed && (parsed.accessToken || parsed.userEmail)) {
        tenantDriveSessions.set(tenantId, parsed);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          scheduleProactiveTokenRefresh(tenantId, parsed.expiresAt);
        }
        return parsed;
      }
    }

    // Check if durable pairing record exists
    const pairedRaw = localStorage.getItem(`inoms_drive_paired_${tenantId}`);
    if (pairedRaw) {
      const paired: TenantDrivePairing = JSON.parse(pairedRaw);
      if (paired && paired.userEmail) {
        const dummySession: TenantDriveSession = {
          accessToken: '',
          userEmail: paired.userEmail,
          userName: paired.userName || paired.userEmail,
          photoURL: paired.photoURL,
          connectedAt: paired.connectedAt || Date.now(),
          expiresAt: 0,
          status: 'needs_refresh'
        };
        tenantDriveSessions.set(tenantId, dummySession);
        return dummySession;
      }
    }
  } catch (_) {}
  return null;
}

function saveSessionForTenant(tenantId: string, session: TenantDriveSession) {
  if (!tenantId) return;
  tenantDriveSessions.set(tenantId, session);
  try {
    localStorage.setItem(`inoms_drive_session_${tenantId}`, JSON.stringify(session));
    // Also save durable pairing record that survives session expiry
    if (session.userEmail) {
      localStorage.setItem(`inoms_drive_paired_${tenantId}`, JSON.stringify({
        userEmail: session.userEmail,
        userName: session.userName,
        photoURL: session.photoURL,
        connectedAt: session.connectedAt || Date.now()
      }));
    }
  } catch (_) {}

  if (session.expiresAt && session.expiresAt > Date.now()) {
    scheduleProactiveTokenRefresh(tenantId, session.expiresAt);
  }
}

function removeSessionForTenant(tenantId: string) {
  if (!tenantId) return;
  tenantDriveSessions.delete(tenantId);
  clearProactiveTokenRefresh(tenantId);
  try {
    localStorage.removeItem(`inoms_drive_session_${tenantId}`);
    localStorage.removeItem(`inoms_drive_paired_${tenantId}`);
  } catch (_) {}
}

export function setDriveActiveTenantId(tenantId: string) {
  currentActiveTenantId = tenantId || '';
  // Check if session for this tenant needs immediate silent refresh
  if (currentActiveTenantId) {
    const session = loadSessionForTenant(currentActiveTenantId);
    if (session && session.userEmail) {
      const isExpired = !session.expiresAt || Date.now() > (session.expiresAt - 180000);
      if (isExpired) {
        refreshDriveAccessToken(currentActiveTenantId, { silent: true }).catch(() => {});
      }
    }
  }
  notifyListeners();
}

export function getDriveActiveTenantId(): string {
  return currentActiveTenantId;
}

// Window focus & visibility change listeners: auto-renew token when returning to tab
if (typeof window !== 'undefined') {
  const handleTabWakeup = () => {
    if (!currentActiveTenantId) return;
    const session = loadSessionForTenant(currentActiveTenantId);
    if (session && session.userEmail) {
      const isExpiringSoon = !session.expiresAt || Date.now() > (session.expiresAt - 5 * 60 * 1000);
      if (isExpiringSoon) {
        refreshDriveAccessToken(currentActiveTenantId, { silent: true }).catch(() => {});
      }
    }
  };

  window.addEventListener('focus', handleTabWakeup);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleTabWakeup();
    }
  });
}

// Track sync listeners
type DriveStateListener = (state: {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  tenantId: string | null;
  status: 'active' | 'needs_refresh';
}) => void;

const stateListeners = new Set<DriveStateListener>();

function notifyListeners() {
  const session = currentActiveTenantId ? loadSessionForTenant(currentActiveTenantId) : null;
  let lastSynced: string | null = null;
  if (currentActiveTenantId) {
    try {
      lastSynced = localStorage.getItem(`inoms_drive_last_synced_at_${currentActiveTenantId}`) || null;
    } catch (_) {}
  }

  // Organization is connected if it has a paired Google account
  const isConnected = !!(session && (session.userEmail || session.accessToken));

  const state = {
    isConnected,
    userEmail: session?.userEmail || null,
    userName: session?.userName || null,
    isSyncing: isSyncingState,
    lastSyncedAt: lastSynced,
    tenantId: currentActiveTenantId || null,
    status: session?.status || (session?.accessToken ? 'active' : 'needs_refresh')
  };

  stateListeners.forEach((cb) => {
    try {
      cb(state);
    } catch (_) {}
  });
}

export function subscribeDriveState(callback: DriveStateListener) {
  stateListeners.add(callback);
  const session = currentActiveTenantId ? loadSessionForTenant(currentActiveTenantId) : null;
  let lastSynced: string | null = null;
  if (currentActiveTenantId) {
    try {
      lastSynced = localStorage.getItem(`inoms_drive_last_synced_at_${currentActiveTenantId}`) || null;
    } catch (_) {}
  }

  const isConnected = !!(session && (session.userEmail || session.accessToken));

  callback({
    isConnected,
    userEmail: session?.userEmail || null,
    userName: session?.userName || null,
    isSyncing: isSyncingState,
    lastSyncedAt: lastSynced,
    tenantId: currentActiveTenantId || null,
    status: session?.status || (session?.accessToken ? 'active' : 'needs_refresh')
  });
  return () => {
    stateListeners.delete(callback);
  };
}

export interface ClientIdConfigDetails {
  clientId: string;
  source: 'env' | 'code' | 'local' | 'none';
  sourceLabel: string;
}

/**
 * Retrieve current Google OAuth Client ID and its configuration source
 * Priority:
 * 1. Vite environment variable: import.meta.env.VITE_GOOGLE_CLIENT_ID (.env file)
 * 2. Code configuration: DEFAULT_GOOGLE_CLIENT_ID in src/config/googleAuth.ts
 * 3. Local browser override (if set): inoms_custom_google_client_id
 */
export function getClientIdDetails(): ClientIdConfigDetails {
  // 1. Vite environment variable from .env file (Active across all devices using this build/server)
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envId && typeof envId === 'string' && envId.trim()) {
    return {
      clientId: envId.trim(),
      source: 'env',
      sourceLabel: '.env file (VITE_GOOGLE_CLIENT_ID)'
    };
  }

  // 2. Static code configuration in src/config/googleAuth.ts (Active across all devices)
  if (DEFAULT_GOOGLE_CLIENT_ID && DEFAULT_GOOGLE_CLIENT_ID.trim()) {
    return {
      clientId: DEFAULT_GOOGLE_CLIENT_ID.trim(),
      source: 'code',
      sourceLabel: 'Code file (src/config/googleAuth.ts)'
    };
  }

  // 3. Optional local browser override
  try {
    const custom = localStorage.getItem('inoms_custom_google_client_id');
    if (custom && custom.trim()) {
      return {
        clientId: custom.trim(),
        source: 'local',
        sourceLabel: 'Local browser memory (Device override)'
      };
    }
  } catch (_) {}

  return {
    clientId: '',
    source: 'none',
    sourceLabel: 'Not configured'
  };
}

export function getOAuthClientId(): string {
  return getClientIdDetails().clientId;
}

export function setCustomGoogleClientId(id: string | null): void {
  try {
    if (id && id.trim()) {
      localStorage.setItem('inoms_custom_google_client_id', id.trim());
    } else {
      localStorage.removeItem('inoms_custom_google_client_id');
    }
  } catch (_) {}
}

/**
 * Ensure Google Identity Services script is dynamically loaded if not yet available
 */
export function ensureGoogleGsiLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if ((window as any).google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      } else if (attempts >= 50) {
        clearInterval(interval);
        reject(new Error('Google Identity Services library did not load in time. Please check your internet connection.'));
      }
    }, 100);

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * Connect directly using Google Identity Services (GIS) Token Client
 * Scoped to targetTenantId for strict multi-tenant isolation
 */
export async function connectViaGoogleIdentityServices(
  targetTenantId?: string
): Promise<{ userEmail: string; displayName: string; accessToken: string }> {
  const tenantId = targetTenantId || currentActiveTenantId;
  if (!tenantId) {
    throw new Error('No active organisation selected for Google Drive connection.');
  }

  await ensureGoogleGsiLoaded();

  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    const clientId = getOAuthClientId();

    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services client is not initialized. Please refresh the page.'));
      return;
    }

    if (!clientId) {
      reject(
        new Error(
          'Google OAuth Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID in your .env file or DEFAULT_GOOGLE_CLIENT_ID in src/config/googleAuth.ts.'
        )
      );
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: `${DRIVE_SCOPE} email profile openid`,
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            const errCode = tokenResponse.error;
            const errDesc = tokenResponse.error_description || errCode;
            if (errCode === 'origin_mismatch' || errDesc?.includes('origin_mismatch')) {
              reject(
                new Error(
                  `OAuth Error 400 (origin_mismatch): The origin "${window.location.origin}" is not registered in Google Cloud Console under Authorized JavaScript origins for Client ID ${clientId}.`
                )
              );
              return;
            }
            reject(new Error(errDesc || 'Failed to authenticate with Google.'));
            return;
          }

          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            reject(new Error('No access token received from Google authorization.'));
            return;
          }

          let email = 'Google User';
          let displayName = 'Google User';
          let photoURL: string | undefined;

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userInfoRes.ok) {
              const userInfo = await userInfoRes.json();
              email = userInfo.email || email;
              displayName = userInfo.name || userInfo.email?.split('@')[0] || displayName;
              photoURL = userInfo.picture;
            }
          } catch (_) {}

          const expiresInSec = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
          const session: TenantDriveSession = {
            accessToken,
            userEmail: email,
            userName: displayName,
            photoURL,
            connectedAt: Date.now(),
            expiresAt: Date.now() + (expiresInSec - 60) * 1000, // 60-second safety window
            lastRefreshedAt: Date.now(),
            status: 'active'
          };

          saveSessionForTenant(tenantId, session);
          notifyListeners();

          resolve({
            userEmail: email,
            displayName,
            accessToken
          });
        }
      });

      client.requestAccessToken();
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Silently refresh Google Drive OAuth Access Token without displaying popups
 * Uses Google Identity Services prompt: '' and hint: userEmail for zero-click background refresh
 */
export async function refreshDriveAccessToken(
  tenantId: string,
  options: { silent?: boolean; prompt?: string } = { silent: true }
): Promise<string> {
  const existingPromise = inFlightRefreshes.get(tenantId);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    await ensureGoogleGsiLoaded();
    const google = (window as any).google;
    const clientId = getOAuthClientId();

    if (!google?.accounts?.oauth2) {
      throw new Error('Google Identity Services client is not initialized.');
    }
    if (!clientId) {
      throw new Error('Google OAuth Client ID is missing.');
    }

    const currentSession = loadSessionForTenant(tenantId);
    const userHint = currentSession?.userEmail || '';

    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          inFlightRefreshes.delete(tenantId);
          reject(new Error('Silent token renewal timed out.'));
        }
      }, 15000);

      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: `${DRIVE_SCOPE} email profile openid`,
          hint: userHint || undefined,
          prompt: options.prompt !== undefined ? options.prompt : (options.silent !== false ? '' : 'select_account'),
          callback: async (tokenResponse: any) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutTimer);
            inFlightRefreshes.delete(tenantId);

            if (tokenResponse.error) {
              const errDesc = tokenResponse.error_description || tokenResponse.error;
              console.warn(`[Google Drive Token Refresh] Notice: ${errDesc}`);
              // If user needs to re-grant or cookie expired
              if (currentSession) {
                currentSession.status = 'needs_refresh';
                notifyListeners();
              }
              reject(new Error(errDesc || 'Failed to silently refresh token'));
              return;
            }

            const accessToken = tokenResponse.access_token;
            if (!accessToken) {
              reject(new Error('No access token received from Google refresh.'));
              return;
            }

            const expiresInSec = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
            const updatedSession: TenantDriveSession = {
              accessToken,
              userEmail: currentSession?.userEmail || 'Google User',
              userName: currentSession?.userName || 'Google User',
              photoURL: currentSession?.photoURL,
              connectedAt: currentSession?.connectedAt || Date.now(),
              expiresAt: Date.now() + (expiresInSec - 60) * 1000,
              lastRefreshedAt: Date.now(),
              status: 'active'
            };

            saveSessionForTenant(tenantId, updatedSession);
            notifyListeners();
            console.info(`[Google Drive] Token silently refreshed for ${tenantId}. Valid for ${expiresInSec}s.`);
            resolve(accessToken);
          }
        });

        client.requestAccessToken(
          options.silent !== false
            ? { prompt: '', hint: userHint || undefined }
            : { prompt: options.prompt || 'select_account', hint: userHint || undefined }
        );
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        inFlightRefreshes.delete(tenantId);
        reject(err);
      }
    });
  })();

  inFlightRefreshes.set(tenantId, promise);
  return promise;
}

/**
 * Connect to Google Drive via OAuth with drive.file scope
 * Scoped to targetTenantId for strict multi-tenant isolation
 */
export async function connectGoogleDrive(
  targetTenantId?: string
): Promise<{ userEmail: string; displayName: string; accessToken: string }> {
  const tenantId = targetTenantId || currentActiveTenantId;
  if (!tenantId) {
    throw new Error('No active organisation selected for Google Drive connection.');
  }

  const clientId = getOAuthClientId();

  // If a Client ID is configured (via .env, src/config/googleAuth.ts, or localStorage),
  // always use Google Identity Services directly so the specified Client ID and registered origins are strictly used.
  if (clientId && clientId.trim()) {
    return await connectViaGoogleIdentityServices(tenantId);
  }

  // If no Client ID is provided anywhere, provide a clear, actionable guide
  throw new Error(
    'Google OAuth Client ID is not configured. Please paste your Client ID in .env (as VITE_GOOGLE_CLIENT_ID=...) or directly in src/config/googleAuth.ts.'
  );
}

/**
 * Disconnect Google Drive for a specific tenant or active tenant
 */
export function disconnectGoogleDrive(targetTenantId?: string): void {
  const tenantId = targetTenantId || currentActiveTenantId;
  if (tenantId) {
    removeSessionForTenant(tenantId);
  }
  notifyListeners();
}

/**
 * Get valid access token for specific tenant, auto-refreshing in the background when needed
 */
export async function getValidAccessToken(targetTenantId?: string, interactive = false): Promise<string> {
  const tenantId = targetTenantId || currentActiveTenantId;
  if (!tenantId) {
    throw new Error('No organisation selected for Google Drive operation.');
  }

  const session = loadSessionForTenant(tenantId);

  // If token is still valid with at least 2 minutes (120,000 ms) safety window, return it directly
  if (session?.accessToken && session.expiresAt && Date.now() < (session.expiresAt - 120000)) {
    return session.accessToken;
  }

  // If session has paired user email, attempt zero-click silent refresh
  if (session?.userEmail) {
    try {
      const freshToken = await refreshDriveAccessToken(tenantId, { silent: true });
      return freshToken;
    } catch (silentErr) {
      console.warn('[Google Drive] Silent token renewal notice:', silentErr);
      if (interactive) {
        const interactiveToken = await refreshDriveAccessToken(tenantId, { silent: false, prompt: 'select_account' });
        return interactiveToken;
      }
      // If we have an existing token, attempt to use it as fallback rather than hard failing
      if (session.accessToken) {
        return session.accessToken;
      }
      throw new Error('Google Drive access token needs renewal. Please click Reconnect Google Drive.');
    }
  }

  if (interactive) {
    const connected = await connectGoogleDrive(tenantId);
    return connected.accessToken;
  }

  throw new Error('Google Drive is not connected for this organisation.');
}

/**
 * Robust fetch wrapper that injects Google Drive Authorization,
 * and automatically retries with a fresh token if a 401 Unauthorized is encountered.
 */
export async function fetchWithDriveAuth(
  url: string,
  init: RequestInit = {},
  tenantId?: string
): Promise<Response> {
  const tId = tenantId || currentActiveTenantId;
  let token = await getValidAccessToken(tId);

  const makeReq = (bearerToken: string) => {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${bearerToken}`);
    return fetch(url, { ...init, headers });
  };

  let res = await makeReq(token);

  // If 401 Unauthorized, Google access token has expired or was revoked
  // Perform silent background refresh and retry once automatically!
  if (res.status === 401) {
    console.info(`[Google Drive Auth] Received 401 on ${url}. Silently renewing token and retrying...`);
    try {
      token = await refreshDriveAccessToken(tId, { silent: true });
      res = await makeReq(token);
    } catch (refreshErr) {
      console.warn('[Google Drive Auth] Auto-retry after 401 failed:', refreshErr);
    }
  }

  return res;
}

export const INOMS_DRIVE_FOLDER_NAME = 'INOMS Cloud Data';

/**
 * Helper: Find or create a folder in Google Drive
 */
export async function getOrCreateFolder(
  folderName: string,
  parentFolderId?: string,
  targetTenantId?: string
): Promise<string> {
  const tId = targetTenantId || currentActiveTenantId;

  let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await fetchWithDriveAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    {},
    tId
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // If looking for INOMS Cloud Data root folder and not found yet, check legacy 'Nibban ERP Cloud Data' and rename to INOMS Cloud Data
  if (folderName === INOMS_DRIVE_FOLDER_NAME && !parentFolderId) {
    const legacyQuery = `name = 'Nibban ERP Cloud Data' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const legRes = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(legacyQuery)}&fields=files(id,name)&spaces=drive`,
      {},
      tId
    );
    if (legRes.ok) {
      const legData = await legRes.json();
      if (legData.files && legData.files.length > 0) {
        const legacyId = legData.files[0].id;
        try {
          await fetchWithDriveAuth(
            `https://www.googleapis.com/drive/v3/files/${legacyId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: INOMS_DRIVE_FOLDER_NAME })
            },
            tId
          );
        } catch (_) {}
        return legacyId;
      }
    }
  }

  // Create folder
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createRes = await fetchWithDriveAuth(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    },
    tId
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create folder "${folderName}" in Drive: ${err}`);
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Upload Full Organization Snapshot to Google Drive
 */
export async function uploadSnapshotToDrive(
  tenantId: string,
  tenantName: string,
  payload: Record<string, any>
): Promise<{ success: boolean; fileId: string; fileName: string; webViewLink?: string; timestamp: string }> {
  isSyncingState = true;
  notifyListeners();

  try {
    const rootFolderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
    const backupsFolderId = await getOrCreateFolder('Snapshots & Backups', rootFolderId, tenantId);

    const timestamp = new Date().toISOString();
    const safeDate = timestamp.replace(/[:.]/g, '-');
    const fileName = `inoms_backup_${tenantId}_${safeDate}.json`;

    const snapshotContent = JSON.stringify({
      version: '3.0',
      system: 'INOMS - Integrated Inward & Outward Management System',
      tenantId,
      tenantName,
      createdAt: timestamp,
      data: payload
    }, null, 2);

    // 1. Upload timestamped snapshot
    const boundary = '-------inoms_boundary_314159';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [backupsFolderId],
      description: `Complete ERP Snapshot for ${tenantName} (${tenantId}) created on ${new Date().toLocaleString()}`
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      snapshotContent +
      closeDelimiter;

    const uploadRes = await fetchWithDriveAuth(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      },
      tenantId
    );

    checkDriveAuthResponse(uploadRes, tenantId);
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Drive snapshot upload failed: ${err}`);
    }

    const fileData = await uploadRes.json();

    // 2. Also upsert master 'inoms_latest_[tenantId].json' for 1-click restoration on other devices
    try {
      const latestName = `inoms_latest_${tenantId}.json`;
      // Search globally across Drive for the tenant's latest master file
      const searchLatest = await fetchWithDriveAuth(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name = '${latestName}' and trashed = false`
        )}&orderBy=modifiedTime desc&fields=files(id)`,
        {},
        tenantId
      );

      checkDriveAuthResponse(searchLatest, tenantId);

      let latestFileId: string | null = null;
      if (searchLatest.ok) {
        const latestJson = await searchLatest.json();
        if (latestJson.files && latestJson.files.length > 0) {
          latestFileId = latestJson.files[0].id;
        }
      }

      if (latestFileId) {
        // Update existing master file content
        const patchRes = await fetchWithDriveAuth(
          `https://www.googleapis.com/upload/drive/v3/files/${latestFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: snapshotContent
          },
          tenantId
        );
        checkDriveAuthResponse(patchRes, tenantId);
      } else {
        // Create new master file inside backupsFolderId
        const latestMeta = {
          name: latestName,
          mimeType: 'application/json',
          parents: [backupsFolderId],
          description: `Active latest snapshot for ${tenantName} (${tenantId})`
        };
        const latestMultipart =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(latestMeta) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          snapshotContent +
          closeDelimiter;

        const postRes = await fetchWithDriveAuth(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: latestMultipart
          },
          tenantId
        );
        checkDriveAuthResponse(postRes, tenantId);
      }
    } catch (e) {
      console.warn('Could not update inoms_latest master file:', e);
    }

    try {
      localStorage.setItem(`inoms_drive_last_synced_at_${tenantId}`, timestamp);
    } catch (_) {}

    return {
      success: true,
      fileId: fileData.id,
      fileName: fileData.name,
      webViewLink: fileData.webViewLink,
      timestamp
    };
  } finally {
    isSyncingState = false;
    notifyListeners();
  }
}

/**
 * List available snapshots for a tenant in Google Drive
 */
export async function listSnapshotsFromDrive(
  tenantId: string
): Promise<Array<{ id: string; name: string; size: string; modifiedTime: string; webViewLink?: string; isMaster?: boolean }>> {
  try {
    // 1. Search globally first across user's accessible Drive files
    const globalQuery = `name contains 'inoms_' and trashed = false`;
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        globalQuery
      )}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,size,modifiedTime,webViewLink)`,
      {},
      tenantId
    );

    checkDriveAuthResponse(res, tenantId);

    if (res.ok) {
      const data = await res.json();
      const matching = (data.files || []).filter((f: any) =>
        f.name && (f.name.includes(tenantId) || f.name.includes('inoms_') || f.name.endsWith('.json'))
      );

      if (matching.length > 0) {
        return matching.map((f: any) => ({
          id: f.id,
          name: f.name,
          size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : 'Unknown',
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink,
          isMaster: f.name.startsWith('inoms_latest_')
        }));
      }
    }
  } catch (err) {
    console.debug('[Google Drive] Global snapshot list note:', err);
  }

  // 2. Fallback to folder query
  try {
    const rootFolderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
    const backupsFolderId = await getOrCreateFolder('Snapshots & Backups', rootFolderId, tenantId);

    const query = `'${backupsFolderId}' in parents and trashed = false`;
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,size,modifiedTime,webViewLink)`,
      {},
      tenantId
    );

    checkDriveAuthResponse(res, tenantId);

    if (res.ok) {
      const data = await res.json();
      const matching = (data.files || []).filter((f: any) =>
        f.name && (f.name.includes(tenantId) || f.name.includes('inoms_') || f.name.endsWith('.json'))
      );

      return matching.map((f: any) => ({
        id: f.id,
        name: f.name,
        size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : 'Unknown',
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
        isMaster: f.name.startsWith('inoms_latest_')
      }));
    }
  } catch (_) {}

  return [];
}

/**
 * Lightweight query to check if a newer snapshot exists on Drive without downloading payload
 */
export async function getLatestDriveSnapshotMeta(
  tenantId: string
): Promise<{ id: string; name: string; modifiedTime: string } | null> {
  try {
    // 1. Search globally across Drive for the newest INOMS snapshot
    const globalQuery = `name contains 'inoms_' and trashed = false`;
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        globalQuery
      )}&orderBy=modifiedTime desc&pageSize=30&fields=files(id,name,modifiedTime)`,
      {},
      tenantId
    );

    checkDriveAuthResponse(res, tenantId);
    if (res.ok) {
      const data = await res.json();
      const files = data.files || [];
      const match = files.find((f: any) =>
        f.name && (f.name.includes(tenantId) || f.name.includes('inoms_latest') || f.name.includes('inoms_backup') || f.name.endsWith('.json'))
      );
      if (match) {
        return {
          id: match.id,
          name: match.name,
          modifiedTime: match.modifiedTime
        };
      }
    }

    // 2. Fallback folder checks if global returned nothing
    const rootFolderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
    const backupsFolderId = await getOrCreateFolder('Snapshots & Backups', rootFolderId, tenantId);

    const query = `'${backupsFolderId}' in parents and trashed = false`;
    const backupRes = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&orderBy=modifiedTime desc&pageSize=25&fields=files(id,name,modifiedTime)`,
      {},
      tenantId
    );

    checkDriveAuthResponse(backupRes, tenantId);
    if (backupRes.ok) {
      const data = await backupRes.json();
      const files = data.files || [];
      const match = files.find((f: any) =>
        f.name && (f.name.includes(tenantId) || f.name.includes('inoms_') || f.name.endsWith('.json'))
      );
      if (match) {
        return {
          id: match.id,
          name: match.name,
          modifiedTime: match.modifiedTime
        };
      }
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Download and parse a snapshot file content
 */
export async function downloadSnapshotFromDrive(fileId: string, tenantId?: string): Promise<any> {
  const res = await fetchWithDriveAuth(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {}, tenantId);

  checkDriveAuthResponse(res, tenantId);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to download snapshot from Drive: ${err}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Fetch the latest active snapshot for a tenant across any device
 */
export async function fetchLatestSnapshotFromDrive(tenantId: string): Promise<any | null> {
  // 1. Search globally first across user's Google Drive
  try {
    const globalQuery = `name contains 'inoms_' and trashed = false`;
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        globalQuery
      )}&orderBy=modifiedTime desc&pageSize=30&fields=files(id,name,modifiedTime)`,
      {},
      tenantId
    );

    checkDriveAuthResponse(res, tenantId);
    if (res.ok) {
      const data = await res.json();
      const files = data.files || [];
      const latestFile = files.find((f: any) =>
        f.name && (f.name.includes(tenantId) || f.name.includes('inoms_latest') || f.name.includes('inoms_backup') || f.name.endsWith('.json'))
      );
      if (latestFile) {
        const snapshotContent = await downloadSnapshotFromDrive(latestFile.id, tenantId);
        return {
          ...snapshotContent,
          _fileMeta: {
            id: latestFile.id,
            name: latestFile.name,
            modifiedTime: latestFile.modifiedTime
          }
        };
      }
    }
  } catch (err) {
    console.debug('[Google Drive] Global snapshot download check note:', err);
  }

  // 2. Fallback check in Snapshots & Backups folder
  try {
    const rootFolderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
    const backupsFolderId = await getOrCreateFolder('Snapshots & Backups', rootFolderId, tenantId);

    const query = `'${backupsFolderId}' in parents and trashed = false`;
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&orderBy=modifiedTime desc&pageSize=25&fields=files(id,name,modifiedTime)`,
      {},
      tenantId
    );

    checkDriveAuthResponse(res, tenantId);
    if (res.ok) {
      const data = await res.json();
      const files = data.files || [];
      const latestFile = files.find((f: any) =>
        f.name && (f.name.includes(tenantId) || f.name.includes('inoms_') || f.name.endsWith('.json'))
      );
      if (latestFile) {
        const snapshotContent = await downloadSnapshotFromDrive(latestFile.id, tenantId);
        return {
          ...snapshotContent,
          _fileMeta: {
            id: latestFile.id,
            name: latestFile.name,
            modifiedTime: latestFile.modifiedTime
          }
        };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Upload PDF document (Invoice, Job Card, Challan) to Drive 'Invoices & Job Sheets' folder
 */
export async function uploadDocumentToDrive(
  fileName: string,
  blob: Blob,
  description?: string,
  tenantId?: string
): Promise<{ success: boolean; fileId: string; webViewLink?: string; webContentLink?: string }> {
  const rootFolderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
  const invoicesFolderId = await getOrCreateFolder('Invoices & Job Sheets', rootFolderId, tenantId);

  const boundary = '-------inoms_doc_boundary_987654';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: [invoicesFolderId],
    description: description || `Document generated by INOMS on ${new Date().toLocaleString()}`
  };

  // Convert Blob to ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Build binary multipart body
  const metaPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/pdf\r\n\r\n';

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaPart);
  const closeBytes = encoder.encode(closeDelimiter);

  const totalLength = metaBytes.length + uint8Array.length + closeBytes.length;
  const mergedBody = new Uint8Array(totalLength);
  mergedBody.set(metaBytes, 0);
  mergedBody.set(uint8Array, metaBytes.length);
  mergedBody.set(closeBytes, metaBytes.length + uint8Array.length);

  const uploadRes = await fetchWithDriveAuth(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: mergedBody
    },
    tenantId
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload document to Drive: ${err}`);
  }

  const fileData = await uploadRes.json();

  return {
    success: true,
    fileId: fileData.id,
    webViewLink: fileData.webViewLink,
    webContentLink: fileData.webContentLink
  };
}

/**
 * List stored PDF documents in Drive
 */
export async function listDocumentsFromDrive(tenantId?: string): Promise<
  Array<{ id: string; name: string; size: string; modifiedTime: string; webViewLink?: string }>
> {
  const rootFolderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
  const invoicesFolderId = await getOrCreateFolder('Invoices & Job Sheets', rootFolderId, tenantId);

  const query = `'${invoicesFolderId}' in parents and mimeType = 'application/pdf' and trashed = false`;
  const res = await fetchWithDriveAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&orderBy=modifiedTime desc&pageSize=25&fields=files(id,name,size,modifiedTime,webViewLink)`,
    {},
    tenantId
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : 'Unknown',
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink
  }));
}
