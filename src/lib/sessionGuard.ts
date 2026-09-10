/**
 * Active Session Concurrency Guard
 * 
 * Prevents simultaneous multi-device data collision and accidental overwrites
 * by ensuring only one device operates as the primary active editing terminal.
 * Secondary devices are placed into Safe Read-Only Mode with an option to Take Over.
 */

import { fetchWithDriveAuth, INOMS_DRIVE_FOLDER_NAME, getOrCreateFolder } from './googleDrive';

export interface DeviceSessionInfo {
  tenantId: string;
  tenantName?: string;
  deviceId: string;
  deviceName: string;
  userEmail?: string;
  userName?: string;
  openedAt: number;
  lastHeartbeat: number;
  status: 'active' | 'released' | 'read_only';
}

export interface ConcurrencyState {
  hasConflict: boolean;
  conflictDevice: DeviceSessionInfo | null;
  isReadOnly: boolean;
  myDeviceId: string;
  myDeviceName: string;
  isModalDismissed: boolean;
  isEvicted?: boolean;
  evictionReason?: string;
  evictedByDevice?: string;
}

export interface EvictionEventInfo {
  tenantId: string;
  reason: string;
  takenOverBy: string;
}

const DEVICE_ID_KEY = 'inoms_device_id';
const DEVICE_NAME_KEY = 'inoms_device_custom_name';
const LOCAL_PRESENCE_PREFIX = 'inoms_presence_';
const CONCURRENCY_BROADCAST_CHANNEL = 'inoms_concurrency_bus';

// Generate or retrieve stable device ID
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_instance';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}

// Automatically detect human-readable device name based on User-Agent and platform
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Server Terminal';
  try {
    const custom = localStorage.getItem(DEVICE_NAME_KEY);
    if (custom && custom.trim()) return custom.trim();

    const ua = navigator.userAgent;
    let base = 'Web Browser';

    if (/iPad|Macintosh/i.test(ua) && 'ontouchend' in document) {
      base = 'iPad Tablet';
    } else if (/Android/i.test(ua)) {
      base = /Mobile/i.test(ua) ? 'Android Mobile' : 'Android Tablet';
    } else if (/iPhone/i.test(ua)) {
      base = 'iPhone Mobile';
    } else if (/Windows/i.test(ua)) {
      base = 'Windows PC';
    } else if (/Macintosh/i.test(ua)) {
      base = 'Mac Computer';
    } else if (/Linux/i.test(ua)) {
      base = 'Linux Workstation';
    }

    return base;
  } catch {
    return 'Terminal Device';
  }
}

export function setCustomDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  } catch {}
}

// Multi-Tab & Local Network BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CONCURRENCY_BROADCAST_CHANNEL);
  }
} catch {}

type ConcurrencyListener = (state: ConcurrencyState) => void;
const listeners = new Set<ConcurrencyListener>();

let currentState: ConcurrencyState = {
  hasConflict: false,
  conflictDevice: null,
  isReadOnly: false,
  myDeviceId: getDeviceId(),
  myDeviceName: getDeviceName(),
  isModalDismissed: false
};

function notifyListeners() {
  listeners.forEach(fn => {
    try { fn(currentState); } catch (e) { console.warn('[Session Guard] Listener error:', e); }
  });
}

export function subscribeConcurrency(listener: ConcurrencyListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

// Drive Presence Helper: File ID cache
const drivePresenceFileIdCache = new Map<string, string>();

async function getDrivePresence(tenantId: string): Promise<DeviceSessionInfo | null> {
  try {
    const fileName = `inoms_presence_${tenantId}.json`;
    
    let fileId = drivePresenceFileIdCache.get(tenantId);
    if (!fileId) {
      // Search globally on Drive for this tenant's presence file
      const searchRes = await fetchWithDriveAuth(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name = '${fileName}' and trashed = false`
        )}&fields=files(id,name,modifiedTime)&spaces=drive`,
        {},
        tenantId
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          fileId = data.files[0].id;
          drivePresenceFileIdCache.set(tenantId, fileId);
        }
      }
    }

    if (!fileId) return null;

    const contentRes = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {},
      tenantId
    );
    if (contentRes.ok) {
      const data = await contentRes.json();
      return data as DeviceSessionInfo;
    }
  } catch (err) {
    console.debug('[Session Guard] Drive presence check note:', err);
  }
  return null;
}

async function writeDrivePresence(tenantId: string, presence: DeviceSessionInfo): Promise<void> {
  try {
    const fileName = `inoms_presence_${tenantId}.json`;
    const payload = JSON.stringify(presence, null, 2);

    let fileId = drivePresenceFileIdCache.get(tenantId);
    if (!fileId) {
      const searchRes = await fetchWithDriveAuth(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name = '${fileName}' and trashed = false`
        )}&fields=files(id,name)&spaces=drive`,
        {},
        tenantId
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          fileId = data.files[0].id;
          drivePresenceFileIdCache.set(tenantId, fileId);
        }
      }
    }

    if (fileId) {
      await fetchWithDriveAuth(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        },
        tenantId
      );
    } else {
      const folderId = await getOrCreateFolder(INOMS_DRIVE_FOLDER_NAME, undefined, tenantId);
      const boundary = '-------inoms_presence_boundary';
      const meta = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId]
      };
      const multipart =
        `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(meta) +
        `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        payload +
        `\r\n--${boundary}--`;

      const createRes = await fetchWithDriveAuth(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipart
        },
        tenantId
      );
      if (createRes.ok) {
        const d = await createRes.json();
        if (d.id) {
          drivePresenceFileIdCache.set(tenantId, d.id);
        }
      }
    }
  } catch (err) {
    console.debug('[Session Guard] Drive presence write note:', err);
  }
}

/**
 * Active Session Guard Coordinator
 */
class SessionGuardCoordinator {
  private activeTenantId: string | null = null;
  private tenantName: string = '';
  private userName: string = '';
  private userEmail: string = '';
  private heartbeatTimer: any = null;
  private isDriveConnected: boolean = false;
  private isRunning: boolean = false;
  private isEvicted: boolean = false;
  private evictionListeners = new Set<(info: EvictionEventInfo) => void>();

  constructor() {
    this.setupListeners();
  }

  public onEvicted(listener: (info: EvictionEventInfo) => void): () => void {
    this.evictionListeners.add(listener);
    return () => {
      this.evictionListeners.delete(listener);
    };
  }

  public resetEviction(): void {
    this.isEvicted = false;
    currentState = {
      ...currentState,
      isEvicted: false,
      evictionReason: undefined,
      evictedByDevice: undefined
    };
    notifyListeners();
  }

  public triggerEviction(info: EvictionEventInfo): void {
    if (this.isEvicted) return;
    this.isEvicted = true;

    console.warn('[Session Guard] Triggering session eviction for this device:', info);

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isRunning = false;

    currentState = {
      ...currentState,
      hasConflict: false,
      conflictDevice: null,
      isReadOnly: true,
      isEvicted: true,
      evictionReason: info.reason,
      evictedByDevice: info.takenOverBy
    };
    notifyListeners();

    this.evictionListeners.forEach(fn => {
      try {
        fn(info);
      } catch (err) {
        console.error('[Session Guard] Eviction listener error:', err);
      }
    });
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    // Cross-tab broadcast listener
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || msg.tenantId !== this.activeTenantId) return;

        if (msg.type === 'HEARTBEAT' && msg.deviceId !== getDeviceId()) {
          this.handleRemotePresence(msg.presence);
        } else if (msg.type === 'TAKEOVER' && msg.deviceId !== getDeviceId()) {
          console.warn('[Session Guard] BroadcastChannel: Another device took over active terminal! Evicting this device.');
          this.triggerEviction({
            tenantId: this.activeTenantId,
            reason: `Session taken over by ${msg.presence?.deviceName || 'another terminal'}`,
            takenOverBy: msg.presence?.deviceName || 'Another terminal'
          });
        } else if (msg.type === 'RELEASE' && msg.deviceId === currentState.conflictDevice?.deviceId) {
          // Conflict cleared!
          currentState = {
            ...currentState,
            hasConflict: false,
            conflictDevice: null
          };
          notifyListeners();
        }
      };
    }

    // Storage event fallback
    window.addEventListener('storage', (e) => {
      if (e.key === `inoms_evicted_${this.activeTenantId}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.evictedByDeviceId !== getDeviceId()) {
            console.warn('[Session Guard] Storage event: Eviction detected! Evicting this device.');
            this.triggerEviction({
              tenantId: this.activeTenantId || data.tenantId,
              reason: `Session taken over by ${data.takenOverBy || 'another terminal'}`,
              takenOverBy: data.takenOverBy || 'Another terminal'
            });
          }
        } catch {}
      } else if (e.key && e.key.startsWith(LOCAL_PRESENCE_PREFIX) && e.newValue) {
        try {
          const presence: DeviceSessionInfo = JSON.parse(e.newValue);
          if (presence.tenantId === this.activeTenantId && presence.deviceId !== getDeviceId()) {
            this.handleRemotePresence(presence);
          }
        } catch {}
      }
    });

    // Window visibility & focus
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isRunning && !this.isEvicted) {
          this.runHeartbeatCycle();
        }
      });
    }

    window.addEventListener('focus', () => {
      if (this.isRunning && !this.isEvicted) {
        this.runHeartbeatCycle();
      }
    });

    // Window unload: gracefully release lock
    window.addEventListener('beforeunload', () => {
      this.releaseSession();
    });
  }

  public isConflictDismissed(): boolean {
    if (!this.activeTenantId) return false;
    try {
      return localStorage.getItem(`inoms_conflict_dismissed_${this.activeTenantId}`) === 'true';
    } catch {
      return false;
    }
  }

  public dismissConflictModal(): void {
    if (this.activeTenantId) {
      try {
        localStorage.setItem(`inoms_conflict_dismissed_${this.activeTenantId}`, 'true');
      } catch {}
    }
    currentState = {
      ...currentState,
      isModalDismissed: true
    };
    notifyListeners();
  }

  public reopenConflictModal(): void {
    currentState = {
      ...currentState,
      isModalDismissed: false
    };
    notifyListeners();
  }

  public start(
    tenantOrParams:
      | string
      | {
          tenantId: string;
          tenantName?: string;
          userName?: string;
          userEmail?: string;
          isDriveConnected?: boolean;
        },
    tenantName?: string,
    options?: {
      userName?: string;
      userEmail?: string;
      isDriveConnected?: boolean;
    }
  ) {
    if (typeof tenantOrParams === 'string') {
      this.activeTenantId = tenantOrParams;
      this.tenantName = tenantName || '';
      this.userName = options?.userName || '';
      this.userEmail = options?.userEmail || '';
      this.isDriveConnected = !!options?.isDriveConnected;
    } else {
      this.activeTenantId = tenantOrParams.tenantId;
      this.tenantName = tenantOrParams.tenantName || '';
      this.userName = tenantOrParams.userName || '';
      this.userEmail = tenantOrParams.userEmail || '';
      this.isDriveConnected = !!tenantOrParams.isDriveConnected;
    }

    this.isEvicted = false;
    currentState.myDeviceId = getDeviceId();
    currentState.myDeviceName = getDeviceName();
    currentState.isModalDismissed = this.isConflictDismissed();

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.isRunning = true;

    // Immediate check
    this.runHeartbeatCycle();

    // Heartbeat every 4 seconds for rapid cross-device synchronization
    this.heartbeatTimer = setInterval(() => {
      this.runHeartbeatCycle();
    }, 4000);
  }

  public stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.releaseSession();
    this.activeTenantId = null;
  }

  public setReadOnly(readOnly: boolean) {
    currentState = {
      ...currentState,
      isReadOnly: readOnly
    };
    notifyListeners();
  }

  public async takeOver(): Promise<void> {
    if (!this.activeTenantId) return;

    this.isEvicted = false;

    const myPresence: DeviceSessionInfo = {
      tenantId: this.activeTenantId,
      tenantName: this.tenantName,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      userName: this.userName,
      userEmail: this.userEmail,
      openedAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active'
    };

    // 1. Broadcast locally to all other tabs/windows
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'TAKEOVER',
          tenantId: this.activeTenantId,
          deviceId: getDeviceId(),
          presence: myPresence
        });
      } catch {}
    }

    // 2. Storage event for other tabs
    try {
      localStorage.setItem(`inoms_evicted_${this.activeTenantId}`, JSON.stringify({
        tenantId: this.activeTenantId,
        evictedByDeviceId: getDeviceId(),
        takenOverBy: getDeviceName(),
        timestamp: Date.now()
      }));
      localStorage.setItem(`${LOCAL_PRESENCE_PREFIX}${this.activeTenantId}`, JSON.stringify(myPresence));
    } catch {}

    // 3. Notify server to authoritatively evict all other terminals
    try {
      await fetch('/api/presence/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(myPresence)
      });
    } catch (e) {
      console.warn('[Session Guard] Server takeover notification error:', e);
    }

    // 4. Update Google Drive presence if connected
    if (this.isDriveConnected) {
      writeDrivePresence(this.activeTenantId, myPresence).catch(() => {});
    }

    currentState = {
      ...currentState,
      hasConflict: false,
      conflictDevice: null,
      isReadOnly: false,
      isModalDismissed: true,
      isEvicted: false
    };
    notifyListeners();
  }

  public releaseSession(): void {
    if (!this.activeTenantId) return;

    const myPresence: DeviceSessionInfo = {
      tenantId: this.activeTenantId,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      openedAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'released'
    };

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'RELEASE',
          tenantId: this.activeTenantId,
          deviceId: getDeviceId(),
          presence: myPresence
        });
      } catch {}
    }

    try {
      localStorage.removeItem(`${LOCAL_PRESENCE_PREFIX}${this.activeTenantId}`);
    } catch {}

    try {
      // Beacon for reliable unload delivery
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/presence/release',
          new Blob([JSON.stringify({ tenantId: this.activeTenantId, deviceId: getDeviceId() })], {
            type: 'application/json'
          })
        );
      } else {
        fetch('/api/presence/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: this.activeTenantId, deviceId: getDeviceId() }),
          keepalive: true
        }).catch(() => {});
      }
    } catch {}

    if (this.isDriveConnected) {
      writeDrivePresence(this.activeTenantId, myPresence).catch(() => {});
    }
  }

  private async runHeartbeatCycle(): Promise<void> {
    if (!this.isRunning || !this.activeTenantId || this.isEvicted) return;

    const myPresence: DeviceSessionInfo = {
      tenantId: this.activeTenantId,
      tenantName: this.tenantName,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      userName: this.userName,
      userEmail: this.userEmail,
      openedAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: currentState.isReadOnly ? 'read_only' : 'active'
    };

    // 1. Cross-tab heartbeat
    if (broadcastChannel && !currentState.isReadOnly) {
      try {
        broadcastChannel.postMessage({
          type: 'HEARTBEAT',
          tenantId: this.activeTenantId,
          deviceId: getDeviceId(),
          presence: myPresence
        });
      } catch {}
    }

    if (!currentState.isReadOnly) {
      try {
        localStorage.setItem(`${LOCAL_PRESENCE_PREFIX}${this.activeTenantId}`, JSON.stringify(myPresence));
      } catch {}
    }

    // 2. Server heartbeat & conflict query
    try {
      const res = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(myPresence)
      });
      if (res.ok) {
        const data = await res.json();

        // Check if server marked this device as evicted
        if (data.isEvicted || data.isLoggedOut) {
          console.warn('[Session Guard] Server confirmed session eviction! Forcing logout.');
          this.triggerEviction({
            tenantId: this.activeTenantId,
            reason: data.reason || `Session taken over by ${data.takenOverBy || 'another terminal'}`,
            takenOverBy: data.takenOverBy || 'Another terminal'
          });
          return;
        }

        // Check for active conflict
        if (data.isConflict && data.activeDevice && data.activeDevice.deviceId !== getDeviceId()) {
          if (!currentState.isReadOnly) {
            console.warn('[Session Guard] Another device became active terminal! Evicting this device.');
            this.triggerEviction({
              tenantId: this.activeTenantId,
              reason: `Session taken over by ${data.activeDevice.deviceName || 'another terminal'}`,
              takenOverBy: data.activeDevice.deviceName || 'Another terminal'
            });
            return;
          }
          this.handleRemotePresence(data.activeDevice);
          return;
        }
      }
    } catch {}

    // 3. Drive presence check (for remote multi-network devices)
    if (this.isDriveConnected) {
      try {
        const remotePresence = await getDrivePresence(this.activeTenantId);
        if (remotePresence && remotePresence.deviceId !== getDeviceId()) {
          this.handleRemotePresence(remotePresence);
          return;
        }

        // If I am active and no conflict, write my heartbeat to Drive
        if (!currentState.isReadOnly && !currentState.hasConflict) {
          await writeDrivePresence(this.activeTenantId, myPresence);
        }
      } catch {}
    }
  }

  private handleRemotePresence(remote: DeviceSessionInfo) {
    if (!remote || remote.deviceId === getDeviceId() || remote.status === 'released') {
      if (currentState.hasConflict && currentState.conflictDevice?.deviceId === remote?.deviceId) {
        currentState = {
          ...currentState,
          hasConflict: false,
          conflictDevice: null
        };
        notifyListeners();
      }
      return;
    }

    // Check if remote heartbeat was within the last 75 seconds
    const elapsed = Date.now() - remote.lastHeartbeat;
    if (elapsed < 75000 && remote.status === 'active') {
      // If this device was running as active, this remote active presence indicates a takeover!
      if (!currentState.isReadOnly && this.activeTenantId) {
        console.warn('[Session Guard] Remote active terminal detected on active device! Evicting this device.');
        this.triggerEviction({
          tenantId: this.activeTenantId,
          reason: `Session taken over by ${remote.deviceName || 'another terminal'}`,
          takenOverBy: remote.deviceName || 'Another terminal'
        });
        return;
      }

      // Conflict confirmed!
      const dismissed = this.isConflictDismissed();
      currentState = {
        ...currentState,
        hasConflict: true,
        conflictDevice: remote,
        isReadOnly: true, // Guard against conflicting writes by default
        isModalDismissed: dismissed
      };
      notifyListeners();
    } else if (currentState.hasConflict && currentState.conflictDevice?.deviceId === remote.deviceId) {
      // Remote device timed out
      currentState = {
        ...currentState,
        hasConflict: false,
        conflictDevice: null
      };
      notifyListeners();
    }
  }
}

export const sessionGuard = new SessionGuardCoordinator();
