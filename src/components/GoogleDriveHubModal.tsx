import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  ShieldCheck,
  HardDrive,
  LogOut,
  Sparkles,
  Crown,
  Settings,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Key
} from 'lucide-react';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  refreshDriveAccessToken,
  subscribeDriveState,
  setDriveActiveTenantId,
  listSnapshotsFromDrive,
  listDocumentsFromDrive,
  getOAuthClientId,
  getClientIdDetails,
  setCustomGoogleClientId,
  INOMS_DRIVE_FOLDER_NAME
} from '../lib/googleDrive';
import { isTenantProPlan, isTenantTrialActive } from '../lib/orgUtils';
import { hasCapability } from '../lib/capabilities';

interface GoogleDriveHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  tenantPlan?: string;
  isProPlan?: boolean;
  isMasterAdmin?: boolean;
  onPushSnapshot: () => Promise<any>;
  onPullLatestSnapshot: () => Promise<boolean>;
  onRestoreSnapshotById: (fileId: string) => Promise<boolean>;
  onOpenUpgradeModal?: () => void;
}

export default function GoogleDriveHubModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  tenantPlan,
  isProPlan,
  isMasterAdmin = false,
  onPushSnapshot,
  onPullLatestSnapshot,
  onRestoreSnapshotById,
  onOpenUpgradeModal
}: GoogleDriveHubModalProps) {
  const isTrialActive = isTenantTrialActive({ id: tenantId, name: tenantName, subscriptionPlan: tenantPlan });
  const isPro = typeof isProPlan === 'boolean'
    ? isProPlan
    : (isTrialActive || hasCapability({ id: tenantId, name: tenantName, subscriptionPlan: tenantPlan }, 'google_drive_backup') || isTenantProPlan({ id: tenantId, name: tenantName, subscriptionPlan: tenantPlan }));
  const [driveState, setDriveState] = useState({
    isConnected: false,
    userEmail: null as string | null,
    userName: null as string | null,
    isSyncing: false,
    lastSyncedAt: null as string | null,
    status: 'active' as 'active' | 'needs_refresh'
  });

  const [activeTab, setActiveTab] = useState<'sync' | 'snapshots' | 'documents'>('sync');
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showOAuthSettings, setShowOAuthSettings] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(() => getOAuthClientId());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    try {
      return localStorage.getItem(`inoms_auto_drive_sync_${tenantId}`) !== 'false';
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    try {
      setAutoSyncEnabled(localStorage.getItem(`inoms_auto_drive_sync_${tenantId}`) !== 'false');
    } catch (_) {
      setAutoSyncEnabled(true);
    }
  }, [tenantId]);

  const handleToggleAutoSync = () => {
    const next = !autoSyncEnabled;
    setAutoSyncEnabled(next);
    try {
      localStorage.setItem(`inoms_auto_drive_sync_${tenantId}`, String(next));
    } catch (_) {}
    setActionMessage({
      type: 'info',
      text: next
        ? `✓ Automatic background Drive sync enabled for ${tenantName}. Snapshots will upload automatically.`
        : `Automatic background sync paused for ${tenantName}. You can still save snapshots manually.`
    });
  };

  const handleCopy = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (_) {}
  };

  const handleSaveCustomClientId = () => {
    setCustomGoogleClientId(clientIdInput.trim());
    setActionMessage({
      type: 'success',
      text: 'Google OAuth Client ID updated. You can now connect to Google Drive.'
    });
  };

  const handleResetClientId = () => {
    setCustomGoogleClientId(null);
    const def = getOAuthClientId();
    setClientIdInput(def);
    setActionMessage({
      type: 'info',
      text: 'Reset Google OAuth Client ID to default.'
    });
  };

  useEffect(() => {
    if (tenantId) {
      setDriveActiveTenantId(tenantId);
    }
    const unsub = subscribeDriveState((state) => {
      setDriveState(state);
    });
    return unsub;
  }, [tenantId]);

  useEffect(() => {
    if (isOpen && driveState.isConnected) {
      loadDriveFiles();
    }
  }, [isOpen, driveState.isConnected, activeTab]);

  const loadDriveFiles = async () => {
    if (!driveState.isConnected) return;
    setIsLoadingList(true);
    try {
      if (activeTab === 'snapshots' || activeTab === 'sync') {
        const snapList = await listSnapshotsFromDrive(tenantId);
        setSnapshots(snapList);
      }
      if (activeTab === 'documents') {
        const docList = await listDocumentsFromDrive(tenantId);
        setDocuments(docList);
      }
    } catch (e: any) {
      console.warn('Error fetching Drive files:', e);
      if (e?.message?.includes('expired') || e?.message?.includes('revoked') || e?.message?.includes('reconnect') || e?.message?.includes('renewal') || e?.message?.includes('token')) {
        // Attempt silent recovery
        try {
          await refreshDriveAccessToken(tenantId, { silent: true });
          if (activeTab === 'snapshots' || activeTab === 'sync') {
            const snapList = await listSnapshotsFromDrive(tenantId);
            setSnapshots(snapList);
          }
          if (activeTab === 'documents') {
            const docList = await listDocumentsFromDrive(tenantId);
            setDocuments(docList);
          }
          return;
        } catch (_) {}

        setActionMessage({
          type: 'info',
          text: 'Google Drive authorization is auto-renewing. Click Refresh Token if access was recently revoked in your Google Account.'
        });
      }
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleConnect = async () => {
    setIsBusy(true);
    setActionMessage(null);
    try {
      const res = await connectGoogleDrive(tenantId);
      setActionMessage({
        type: 'success',
        text: `Connected to Google Drive as ${res.userEmail} for ${tenantName}!`
      });
      loadDriveFiles();
    } catch (e: any) {
      let msg = e?.message || 'Failed to connect Google Drive.';
      if (e?.code === 'auth/popup-closed-by-user' || e?.message?.includes('closed-by-user')) {
        msg = 'Sign in was cancelled before completion. Please click Connect again to authorize Google Drive.';
      } else if (e?.code === 'auth/popup-blocked' || e?.message?.includes('popup-blocked')) {
        msg = 'The browser blocked the sign-in popup. Please allow popups in your browser address bar or open the app in a new tab.';
      } else if (e?.code === 'auth/unauthorized-domain' || e?.message?.includes('unauthorized-domain')) {
        msg = 'Domain authorization updated. If you are running locally on custom ports, please refresh the page and try again.';
      } else if (e?.message?.includes('origin_mismatch') || e?.message?.includes('Error 400')) {
        if (isMasterAdmin) {
          setShowOAuthSettings(true);
        }
        msg = `Google OAuth Error 400 (origin_mismatch): The domain "${window.location.origin}" is not yet registered under Authorized JavaScript origins in Google Cloud Console.`;
      }
      setActionMessage({
        type: 'error',
        text: msg
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive(tenantId);
    setActionMessage({
      type: 'info',
      text: `Google Drive account unlinked for ${tenantName}.`
    });
  };

  const handlePush = async () => {
    if (!driveState.isConnected) {
      await handleConnect();
    }
    setIsBusy(true);
    setActionMessage(null);
    try {
      const res = await onPushSnapshot();
      setActionMessage({
        type: 'success',
        text: `Successfully saved full cloud snapshot to Google Drive (${new Date().toLocaleTimeString()})!`
      });
      loadDriveFiles();
    } catch (e: any) {
      setActionMessage({
        type: 'error',
        text: e?.message || 'Failed to upload snapshot to Drive.'
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handlePull = async () => {
    if (!confirm('Restore the latest Google Drive snapshot to this device? Any unsaved local edits will be updated with the cloud version.')) {
      return;
    }
    setIsBusy(true);
    setActionMessage(null);
    try {
      const success = await onPullLatestSnapshot();
      if (success) {
        setActionMessage({
          type: 'success',
          text: 'Latest organization data pulled from Google Drive and synchronized locally!'
        });
      } else {
        setActionMessage({
          type: 'info',
          text: 'No prior Google Drive snapshots found for this organization.'
        });
      }
    } catch (e: any) {
      setActionMessage({
        type: 'error',
        text: e?.message || 'Failed to pull snapshot from Drive.'
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreFile = async (file: any) => {
    if (!confirm(`Restore snapshot "${file.name}" saved on ${new Date(file.modifiedTime).toLocaleString()}? This will update local data with this point-in-time backup.`)) {
      return;
    }
    setIsBusy(true);
    setActionMessage(null);
    try {
      const success = await onRestoreSnapshotById(file.id);
      if (success) {
        setActionMessage({
          type: 'success',
          text: `Restored snapshot from ${new Date(file.modifiedTime).toLocaleDateString()}!`
        });
      }
    } catch (e: any) {
      setActionMessage({
        type: 'error',
        text: e?.message || 'Failed to restore snapshot.'
      });
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) return null;

  // Gatekeeper: Google Drive features are strictly for INOMS Pro Plan subscribers
  if (!isPro) {
    return (
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-3xl shadow-2xl border border-purple-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Pro Header */}
          <div className="p-5 sm:p-6 border-b border-purple-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-purple-50 via-fuchsia-50/40 to-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">
                    Google Drive Cloud Hub
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                    INOMS Pro Feature
                  </span>
                </div>
                <p className="text-xs text-purple-700/80 font-medium">
                  Multi-Device Workshop Synchronization &amp; Cloud Drive Archiving
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pro Gate Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {/* Value Proposition Callout */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-950 space-y-1">
                <span className="font-black text-sm block text-purple-900">
                  Google Drive Sync is exclusive to the INOMS Pro Plan
                </span>
                <p className="leading-relaxed text-purple-800/90">
                  {tenantPlan === 'trial'
                    ? 'Your 7-day free trial has concluded. During the trial, Google Drive Cloud Sync was provided free. To continue syncing repair tickets, customer ledgers, and invoice records across all workshop devices, upgrade to the INOMS Pro Plan.'
                    : 'Seamlessly sync repair tickets, inventory, customer ledgers, and invoice records across all workshop phones, tablets, and computers directly through your own Google Drive. (Included free during 7-day trial).'}
                </p>
              </div>
            </div>

            {/* Pro Capabilities Grid */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                What INOMS Pro unlocks for your shop:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 shrink-0 mt-0.5">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Multi-Device Cloud Sync</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Front-desk PC, technician workbench tablets, and mobile phones share real-time state.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Private Drive Backups</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Snapshots saved securely in your Google Drive (<code className="text-emerald-700 font-bold">{INOMS_DRIVE_FOLDER_NAME}</code>).
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">PDF Invoices Cloud Archiving</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      1-click PDF upload to Google Drive with shareable customer links for WhatsApp.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Service Outsourcing Challans</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Manage external third-party service lab repairs and vendor accounting.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Plan vs Pro Plan Comparison */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold block">
                  Current Workspace Plan
                </span>
                <span className="text-sm font-black text-slate-200">
                  {tenantPlan ? `INOMS ${tenantPlan}` : 'INOMS Basic / Business'}
                </span>
                <span className="text-xs text-purple-300 block mt-0.5">
                  Upgrade required to activate Google Drive features
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-extrabold text-purple-300 block">INOMS Pro</span>
                <span className="text-xl font-black text-white">₹699<span className="text-xs font-normal text-slate-300">/mo</span></span>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500">
              Instant activation available via Master Admin.
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <a
                href={`https://wa.me/918149862034?text=${encodeURIComponent(
                  `Hello INOMS Team, I would like to upgrade my organization "${tenantName}" (${tenantId}) to the INOMS Pro Plan (₹699/mo) to activate Google Drive Cloud Sync & Multi-Device access.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade to INOMS Pro</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-50/60 via-blue-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">
                  Google Drive Cloud Hub
                </h3>
                {isTrialActive ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    7-Day Free Trial • Pro Access
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                    INOMS Pro
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Safeguard {tenantName} data &amp; sync seamlessly across any phone, tablet, or PC.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Banner */}
        {actionMessage && (
          <div
            className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : actionMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : actionMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
            )}
            <span className="flex-1">{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Connection Status Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                  driveState.isConnected
                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 ring-4 ring-emerald-100'
                    : 'bg-slate-300 ring-4 ring-slate-100'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  {driveState.isConnected ? (
                    <>
                      <span>Connected:</span>
                      <span className="font-mono text-slate-900 truncate font-black">
                        {driveState.userEmail}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                        driveState.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${driveState.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        {driveState.status === 'active' ? 'Silent Auto-Renewal Active' : 'Token Expired (Auto-renewing)'}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">Google Drive Not Connected</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {driveState.lastSyncedAt
                      ? `Last synced: ${new Date(driveState.lastSyncedAt).toLocaleString()}`
                      : 'Never synced on this device'}
                  </span>
                </div>
              </div>
            </div>

            {driveState.isConnected ? (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {driveState.status === 'needs_refresh' && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsBusy(true);
                      try {
                        await refreshDriveAccessToken(tenantId, { silent: false });
                        setActionMessage({ type: 'success', text: 'Google Drive authorization token refreshed successfully!' });
                        loadDriveFiles();
                      } catch (e: any) {
                        setActionMessage({ type: 'error', text: e?.message || 'Token refresh failed.' });
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                    disabled={isBusy}
                    className="px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                    <span>Quick Re-Authorize</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadDriveFiles}
                  disabled={isLoadingList}
                  title="Refresh File List"
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin text-sky-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={isBusy}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-black shadow-xs transition flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Connect Google Drive</span>
              </button>
            )}
          </div>

          {/* Google Cloud Console Setup & Production (app.inoms.in) Guide - Master Admin Only */}
          {isMasterAdmin && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowOAuthSettings(!showOAuthSettings)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:bg-slate-100/80 transition cursor-pointer"
              >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-600" />
                <span>Google Cloud Console &amp; Production Setup (<code className="text-slate-900 font-mono text-[11px]">app.inoms.in</code>)</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <span>{showOAuthSettings ? 'Hide Guide' : 'Setup Origins'}</span>
                {showOAuthSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showOAuthSettings && (
              <div className="p-4 border-t border-slate-200 bg-white space-y-4 text-xs">
                {/* Notice */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span>Resolving "Error 400: origin_mismatch"</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90">
                    Google OAuth requires you to whitelist your domain(s) in Google Cloud Console. Copy and add these URIs to <strong>Authorized JavaScript origins</strong>:
                  </p>
                </div>

                {/* Current Active Parameters Inspector */}
                <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 text-sky-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Current App Origin Detected:</span>
                    <span className="text-[10px] text-sky-600 font-medium">Must match exactly in Cloud Console</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-sky-200">
                    <code className="text-xs font-mono font-bold text-sky-900 select-all">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(window.location.origin, 'current_origin')}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-sky-100 hover:bg-sky-200 text-sky-800 flex items-center gap-1 cursor-pointer transition"
                    >
                      {copiedKey === 'current_origin' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'current_origin' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-sky-700/80">
                    Active Client ID: <code className="font-mono font-semibold text-sky-900 break-all">{getOAuthClientId()}</code>
                  </div>
                </div>

                {/* Origins List with 1-click copy */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    1. Authorized JavaScript Origins (Add in Google Cloud Console):
                  </span>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Localhost (Current Dev Port)', uri: 'http://localhost:3000' },
                      { label: 'Localhost Alternate', uri: 'http://localhost' },
                      { label: 'Production Application (Your Custom Domain)', uri: 'https://app.inoms.in' }
                    ].map((item) => (
                      <div key={item.uri} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-medium block">{item.label}</span>
                          <code className="text-xs font-mono font-bold text-slate-800 select-all">{item.uri}</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.uri, item.uri)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs shrink-0 ml-2"
                        >
                          {copiedKey === item.uri ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Redirect URIs */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    2. Authorized Redirect URIs (Add in Google Cloud Console):
                  </span>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Localhost Dev Redirect', uri: 'http://localhost:3000' },
                      { label: 'Production App Redirect', uri: 'https://app.inoms.in' }
                    ].map((item) => (
                      <div key={item.uri} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-medium block">{item.label}</span>
                          <code className="text-xs font-mono font-bold text-slate-800 select-all">{item.uri}</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.uri, item.uri)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs shrink-0 ml-2"
                        >
                          {copiedKey === item.uri ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom OAuth Client ID (Configured in Code / .env for All Devices) */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-sky-600" />
                      Google OAuth 2.0 Web Client ID
                    </label>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1"
                    >
                      <span>Google Cloud Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Active Source Banner */}
                  {(() => {
                    const details = getClientIdDetails();
                    return (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${details.clientId ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-400'}`}></span>
                          <div>
                            <span className="font-bold text-slate-800 text-[11px] block">
                              Active Source: {details.sourceLabel}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono break-all">
                              {details.clientId ? details.clientId : 'No Client ID set yet'}
                            </span>
                          </div>
                        </div>
                        {details.source === 'env' || details.source === 'code' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            <Check className="w-3 h-3" />
                            Synced on All Devices
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            Configure in .env or Code
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Permanent Code Setup Instructions */}
                  <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 text-[11px] text-slate-700 space-y-1.5">
                    <span className="font-bold text-sky-900 block">Where to put your Client ID in code (One-time setup for all devices):</span>
                    <p className="text-slate-600">
                      <strong>Option 1 (Recommended):</strong> In your project root <code className="bg-sky-100/80 px-1 py-0.5 rounded text-sky-950 font-mono">.env</code> file:
                    </p>
                    <div className="p-1.5 rounded-md bg-slate-900 text-emerald-400 font-mono text-[10px] select-all">
                      VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
                    </div>
                    <p className="text-slate-600 pt-0.5">
                      <strong>Option 2:</strong> Directly in <code className="bg-sky-100/80 px-1 py-0.5 rounded text-sky-950 font-mono">src/config/googleAuth.ts</code>:
                    </p>
                    <div className="p-1.5 rounded-md bg-slate-900 text-emerald-400 font-mono text-[10px] select-all">
                      export const DEFAULT_GOOGLE_CLIENT_ID = 'your_client_id_here.apps.googleusercontent.com';
                    </div>
                  </div>

                  {/* Manual Browser Override (Optional for quick local testing) */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Quick Browser Override (Local Testing Only):
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={clientIdInput}
                        onChange={(e) => setClientIdInput(e.target.value)}
                        placeholder="Paste Client ID to test in this browser..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomClientId}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        Apply Locally
                      </button>
                      <button
                        type="button"
                        onClick={handleResetClientId}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition cursor-pointer shrink-0"
                        title="Reset to permanent code/env configuration"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Checklist: Why Origin Mismatch happens */}
                <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 space-y-2 text-[11px] text-slate-700">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    Checklist if you still see "Access blocked: Error 400: origin_mismatch":
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-relaxed">
                    <li>
                      <strong>Check "Error Details" in the popup:</strong> Click <em>"see error details"</em> in the black Google error window. Look at the <code className="font-mono text-slate-900">client_id</code> shown there. It must be the exact same Client ID you edited in Google Cloud Console.
                    </li>
                    <li>
                      <strong>No Trailing Slash:</strong> In Google Cloud Console, the origin must be exactly <code className="font-mono text-slate-900">http://localhost:3000</code>. If you added a trailing slash (<code className="font-mono text-slate-900">http://localhost:3000/</code>), delete the slash and save.
                    </li>
                    <li>
                      <strong>Google Server Propagation Delay:</strong> Google explicitly states that newly added origins can take <strong>5 to 10 minutes</strong> to propagate across their global auth servers.
                    </li>
                    <li>
                      <strong>Browser Cache:</strong> Google caches OAuth client metadata. Try doing a hard refresh (<code className="font-mono text-slate-900">Ctrl + Shift + R</code> or <code className="font-mono text-slate-900">Cmd + Shift + R</code>) or open the app in an Incognito window.
                    </li>
                    <li>
                      <strong>OAuth Consent Screen - Test Users:</strong> If your app publishing status in Google Cloud Console is <em>"Testing"</em>, make sure <code className="font-mono text-slate-900">scrovawebstudio@gmail.com</code> (and any other email you test with) is added under <strong>Audience &gt; Test users</strong>.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Multi-Device Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('snapshots')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'snapshots'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Drive Snapshots ({snapshots.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Invoices &amp; PDFs ({documents.length})</span>
            </button>
          </div>

          {/* Tab 1: Sync Controls */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Auto-Sync Toggle Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 border border-purple-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-600 text-white shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">Background Auto-Sync to Drive</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        autoSyncEnabled && driveState.isConnected
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {autoSyncEnabled && driveState.isConnected ? '● Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Automatically uploads workshop snapshots to your Google Drive every 10–15 minutes and after adding jobs or invoices. No manual clicking needed!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAutoSync}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ${
                    autoSyncEnabled
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  <span>{autoSyncEnabled ? 'Auto-Sync: ON' : 'Auto-Sync: OFF'}</span>
                </button>
              </div>

              {/* Smart Cloud Snapshot Detector Card (Ideal for New Devices) */}
              {driveState.isConnected && snapshots.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-950">Latest Cloud Snapshot in Drive</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                          {snapshots[0].size || 'Cloud Backup'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800/90 mt-0.5">
                        Found backup: <strong className="font-mono">{snapshots[0].name}</strong> ({new Date(snapshots[0].modifiedTime).toLocaleString()}).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePull}
                    disabled={isBusy}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 self-stretch sm:self-auto justify-center"
                  >
                    <DownloadCloud className={`w-3.5 h-3.5 ${isBusy ? 'animate-bounce' : ''}`} />
                    <span>Restore to This Device</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Push Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-50/70 to-blue-50/40 border border-sky-200/80 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm text-slate-900">Push to Google Drive</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Uploads a full snapshot of Customers, Jobs, Inventory, Invoices, and Billing from this device into your Google Drive folder.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePush}
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black shadow-md shadow-sky-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className={`w-4 h-4 ${isBusy ? 'animate-bounce' : ''}`} />
                    <span>{isBusy ? 'Uploading to Drive...' : 'Save Snapshot to Drive'}</span>
                  </button>
                </div>

                {/* Pull Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <DownloadCloud className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm text-slate-900">Pull &amp; Load on this Device</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Use when opening the app on your mobile, laptop, or home computer to pull the latest active records saved to Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePull}
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <DownloadCloud className={`w-4 h-4 ${isBusy ? 'animate-bounce' : ''}`} />
                    <span>{isBusy ? 'Restoring from Drive...' : 'Restore Latest on this Device'}</span>
                  </button>
                </div>
              </div>

              {/* Data Safety & Location Notice */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 space-y-1">
                  <span className="font-black text-slate-800 block">100% Private Google Drive Storage</span>
                  <p>
                    All snapshots and documents are stored inside the <code className="font-mono text-teal-700 font-bold">{INOMS_DRIVE_FOLDER_NAME}</code> folder in your personal Google Drive. No third-party servers have access to your data.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Snapshots History */}
          {activeTab === 'snapshots' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Point-in-Time Snapshots in Drive</span>
                <button
                  type="button"
                  onClick={loadDriveFiles}
                  disabled={isLoadingList}
                  className="text-xs text-sky-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingList ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {snapshots.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate font-mono">{snap.name}</span>
                          {snap.isMaster && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ⚡ Active Master Snapshot
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{new Date(snap.modifiedTime).toLocaleString()}</span>
                          <span>•</span>
                          <span className="font-mono font-semibold">{snap.size}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {snap.webViewLink && (
                          <a
                            href={snap.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRestoreFile(snap)}
                          disabled={isBusy}
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg font-bold text-[11px] transition cursor-pointer"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                  {isLoadingList ? 'Checking Drive for snapshots...' : 'No snapshots found yet. Click "Save Snapshot to Drive" to create your first cloud backup.'}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Documents & Invoices */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Stored Invoices &amp; Job PDFs</span>
                <button
                  type="button"
                  onClick={loadDriveFiles}
                  disabled={isLoadingList}
                  className="text-xs text-sky-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingList ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {documents.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate font-mono">{doc.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{new Date(doc.modifiedTime).toLocaleString()}</span>
                            <span>•</span>
                            <span className="font-mono font-semibold">{doc.size}</span>
                          </div>
                        </div>
                      </div>

                      {doc.webViewLink && (
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <span>Open PDF</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                  {isLoadingList
                    ? 'Loading documents from Drive...'
                    : 'No documents saved to Drive yet. In the Invoice view modal, click "Save to Drive" to archive and share PDFs.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Folder: <code className="text-slate-700 font-bold">{INOMS_DRIVE_FOLDER_NAME}</code> in your Google Drive
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
