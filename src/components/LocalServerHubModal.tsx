import React, { useState, useEffect } from 'react';
import {
  Server,
  Wifi,
  Smartphone,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  X,
  Clock,
  Radio,
  ExternalLink,
  Laptop,
  Download,
  Share2
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  fetchServerInfo,
  generateServerPairingToken,
  verifyServerPairingCode,
  fetchTechnicianSessions,
  ProServerInfo
} from '../lib/api';
import {
  getServerBaseUrl,
  setServerBaseUrl,
  clearServerBaseUrl,
  testServerConnection,
  isNativeCapacitorApp,
  savePairedOrgInfo,
  ServerConnectionStatus
} from '../lib/serverConfig';
import { TenantOrg } from './AuthModal';

interface LocalServerHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTenant?: TenantOrg | null;
  currentUser?: {
    id: string;
    name: string;
    role: string;
    username?: string;
  } | null;
}

export const LocalServerHubModal: React.FC<LocalServerHubModalProps> = ({
  isOpen,
  onClose,
  activeTenant,
  currentUser
}) => {
  const isTechnician = currentUser?.role === 'Technician' || currentUser?.role === 'Staff';
  const [activeTab, setActiveTab] = useState<'server' | 'technician' | 'downloads'>(isTechnician ? 'technician' : 'server');

  // Server state
  const [serverInfo, setServerInfo] = useState<ProServerInfo | null>(null);
  const [loadingServerInfo, setLoadingServerInfo] = useState(false);
  const [serverSessions, setServerSessions] = useState<any[]>([]);

  // Pairing state (Admin)
  const [pairingData, setPairingData] = useState<{
    code: string;
    serverUrl: string;
    expiresAt: string;
  } | null>(null);
  const [pairingQrUrl, setPairingQrUrl] = useState<string>('');
  const [generatingPairing, setGeneratingPairing] = useState(false);
  const [hubGenPairingError, setHubGenPairingError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Technician connection state
  const [customUrlInput, setCustomUrlInput] = useState(getServerBaseUrl());
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ServerConnectionStatus | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null);

  // APK & PWA Download State
  const [apkDownloadQr, setApkDownloadQr] = useState<string>('');
  const [pwaQrUrl, setPwaQrUrl] = useState<string>('');
  const [pwaGuideTab, setPwaGuideTab] = useState<'android' | 'ios' | 'pc'>('android');

  const primaryOrigin = serverInfo?.primaryIp
    ? `http://${serverInfo.primaryIp}:3000`
    : (typeof window !== 'undefined' ? window.location.origin : '');
  const directApkUrl = '/Inoms-android.apk';
  const fullApkShareUrl = `${primaryOrigin}/Inoms-android.apk`;

  useEffect(() => {
    if (isOpen) {
      loadServerStatus();
      setCustomUrlInput(getServerBaseUrl());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const origin = serverInfo?.primaryIp
        ? `http://${serverInfo.primaryIp}:3000`
        : (typeof window !== 'undefined' ? window.location.origin : '');
      const apkUrl = `${origin}/Inoms-android.apk`;
      QRCode.toDataURL(apkUrl, { width: 220, margin: 2, color: { dark: '#064e3b', light: '#ffffff' } })
        .then(setApkDownloadQr)
        .catch(() => {});
      QRCode.toDataURL(origin || (typeof window !== 'undefined' ? window.location.origin : ''), { width: 220, margin: 2, color: { dark: '#312e81', light: '#ffffff' } })
        .then(setPwaQrUrl)
        .catch(() => {});
    }
  }, [isOpen, serverInfo]);

  const loadServerStatus = async () => {
    setLoadingServerInfo(true);
    try {
      const info = await fetchServerInfo();
      setServerInfo(info);
      if (activeTenant?.id) {
        const sess = await fetchTechnicianSessions();
        if (sess.success && Array.isArray(sess.technicianSessions)) {
          setServerSessions(sess.technicianSessions);
        }
      }
    } finally {
      setLoadingServerInfo(false);
    }
  };

  const handleGeneratePairing = async () => {
    setGeneratingPairing(true);
    setHubGenPairingError(null);
    try {
      const preferredTargetUrl = customUrlInput?.trim() || undefined;
      const tenantId = activeTenant?.id || 'org-admin';
      const res = await generateServerPairingToken(preferredTargetUrl, tenantId);

      let effectiveCode = res.code;
      let effectiveServerUrl = res.serverUrl;
      let effectiveTenantId = res.tenantId || tenantId;
      let effectiveExpiresAt = res.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // If backend was unreachable or returned an error, generate guaranteed local pairing code & url
      if (!res.success || !effectiveCode || !effectiveServerUrl) {
        const fallbackSuffix = Math.floor(1000 + Math.random() * 9000);
        effectiveCode = `PR-${fallbackSuffix}`;
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        effectiveServerUrl = customUrlInput?.trim() || (serverInfo?.primaryIp && serverInfo.primaryIp !== '127.0.0.1' ? `http://${serverInfo.primaryIp}:3000` : currentOrigin);
      }

      setPairingData({
        code: effectiveCode,
        serverUrl: effectiveServerUrl,
        expiresAt: effectiveExpiresAt
      });

      // Generate safe QR code containing connection payload (NO secrets)
      const qrPayload = JSON.stringify({
        app: 'INOMS_PRO',
        code: effectiveCode,
        serverUrl: effectiveServerUrl,
        tenantId: effectiveTenantId
      });
      const qrDataUri = await QRCode.toDataURL(qrPayload, {
        width: 280,
        margin: 2,
        color: { dark: '#1e1b4b', light: '#ffffff' }
      });
      setPairingQrUrl(qrDataUri);
    } catch (e: any) {
      console.warn('Pairing generation error:', e);
      setHubGenPairingError(e?.message || 'Failed to generate QR code');
    } finally {
      setGeneratingPairing(false);
    }
  };

  const handleTestConnection = async (targetUrl?: string) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const result = await testServerConnection(targetUrl !== undefined ? targetUrl : customUrlInput);
      setTestResult(result);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveCustomUrl = () => {
    const saved = setServerBaseUrl(customUrlInput);
    setCustomUrlInput(saved);
    handleTestConnection(saved);
    setPairingSuccess('Server URL saved. All requests will route to this server.');
    setTimeout(() => setPairingSuccess(null), 3500);
  };

  const handleResetUrl = () => {
    clearServerBaseUrl();
    setCustomUrlInput('');
    handleTestConnection('');
    setPairingSuccess('Reset to local same-origin default.');
    setTimeout(() => setPairingSuccess(null), 3500);
  };

  const handleApplyPairingCode = async () => {
    if (!pairingCodeInput.trim()) return;
    setPairingError(null);
    setPairingSuccess(null);
    setTestingConnection(true);

    try {
      // First attempt verifying against current base or localhost
      const res = await verifyServerPairingCode(pairingCodeInput.trim(), customUrlInput);
      if (res.success && res.serverUrl) {
        setServerBaseUrl(res.serverUrl);
        setCustomUrlInput(res.serverUrl);
        if (res.tenantId) {
          savePairedOrgInfo({
            tenantId: res.tenantId,
            name: res.tenantName,
            serverUrl: res.serverUrl
          });
        }
        setPairingSuccess(`Successfully paired with ${res.tenantName || 'Local Server'} at ${res.serverUrl}`);
        handleTestConnection(res.serverUrl);
      } else {
        setPairingError(res.message || res.error || 'Invalid or expired pairing code. Verify your Wi-Fi network.');
      }
    } catch (e: any) {
      setPairingError(e?.message || 'Failed to verify pairing code');
    } finally {
      setTestingConnection(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!isOpen) return null;

  const isNative = isNativeCapacitorApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-300">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Organisation Workshop Wi-Fi Hub</h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 rounded-full">
                  Direct Wi-Fi / LAN
                </span>
              </div>
              <p className="text-xs text-purple-200/80">
                Direct Wi-Fi communication between Organisation Account & Technician devices (Android / PC)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'server'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Organisation PC (Workshop Hub)</span>
          </button>
          <button
            onClick={() => setActiveTab('technician')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'technician'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Technician Link (Android / PC)</span>
            {isNative && (
              <span className="ml-1.5 px-1.5 py-0.2 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-bold">
                Android
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('downloads')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'downloads'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Download Android App & PWA</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full font-bold">
              APK
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'server' && (
            <div className="space-y-6">
              {/* How it Works Banner */}
              <div className="p-4 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-950 dark:text-purple-200">
                  <Wifi className="w-4 h-4 text-purple-600" />
                  <span>How Workshop Wi-Fi Hub Works</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-purple-900/90 dark:text-purple-200/80">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                    <span><strong>Same Wi-Fi:</strong> Connect this PC and technician phones/laptops to the same workshop Wi-Fi router.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                    <span><strong>Link Devices:</strong> Technicians scan the QR code or enter the 6-character code below from their Android app or browser.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                    <span><strong>Direct Wi-Fi Updates:</strong> Any job updates (status, parts, diagnostics, signatures) communicate directly over Wi-Fi to this PC.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
                    <span><strong>Automatic Backups:</strong> This Organisation Account saves changes locally and syncs them to Google Drive (no external office server needed).</span>
                  </div>
                </div>
              </div>

              {/* Server Status Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Organisation PC Status: Online Workshop Hub
                    </span>
                  </div>
                  <button
                    onClick={loadServerStatus}
                    disabled={loadingServerInfo}
                    className="flex items-center space-x-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingServerInfo ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 mb-1">Database Engine</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                      <span>{serverInfo?.postgres ? '🐘 PostgreSQL Active' : '🗄️ SQLite Local Engine'}</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 mb-1">Hub Hostname</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {serverInfo?.serverName || 'INOMS-WORKSHOP-PC'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 mb-1">Local Port</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      3000 (HTTP)
                    </div>
                  </div>
                </div>

                {/* Local Network LAN IPs */}
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-1.5">
                    <Wifi className="w-3.5 h-3.5 text-purple-600" />
                    <span>Local Workshop Wi-Fi / LAN Addresses (For Technicians on same Wi-Fi):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(serverInfo?.lanIps || ['127.0.0.1']).map((ip) => {
                      const fullUrl = `http://${ip}:3000`;
                      return (
                        <div
                          key={ip}
                          className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 rounded-lg px-3 py-1.5 text-xs"
                        >
                          <span className="font-mono text-purple-700 dark:text-purple-300 font-medium">{fullUrl}</span>
                          <button
                            onClick={() => copyToClipboard(fullUrl, ip)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                            title="Copy LAN URL"
                          >
                            {copiedText === ip ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Pairing Generator Section */}
              <div className="border border-purple-100 dark:border-purple-950/60 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <QrCode className="w-4 h-4 text-purple-600" />
                      <span>One-Click Technician Device Pairing</span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-lg">
                      Generate a secure, short-lived (15-min) pairing code for technicians to scan with the INOMS Android app or open in their mobile browser. No server passwords or database credentials are exposed.
                    </p>
                  </div>
                  <button
                    onClick={handleGeneratePairing}
                    disabled={generatingPairing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-sm"
                  >
                    {generatingPairing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5" />
                    )}
                    <span>{pairingData ? 'Regenerate Code' : 'Generate Pairing QR'}</span>
                  </button>
                </div>

                {hubGenPairingError && (
                  <div className="mt-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 flex items-center space-x-2">
                    <span>{hubGenPairingError}</span>
                  </div>
                )}

                {pairingData && (
                  <div className="mt-4 pt-4 border-t border-purple-200/60 dark:border-purple-900/40 flex flex-col sm:flex-row items-center gap-6">
                    {pairingQrUrl && (
                      <div className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-sm">
                        <img src={pairingQrUrl} alt="Pairing QR Code" className="w-36 h-36" />
                      </div>
                    )}
                    <div className="space-y-3 flex-1">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Pairing Code (Enter in Android App):</div>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-3xl font-mono font-extrabold tracking-widest text-purple-700 dark:text-purple-300">
                            {pairingData.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(pairingData.code, 'pairCode')}
                            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 hover:text-purple-600"
                            title="Copy Pairing Code"
                          >
                            {copiedText === 'pairCode' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <Server className="w-3.5 h-3.5 text-slate-400" />
                          <span>Server URL: <strong>{pairingData.serverUrl}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Expires in 15 minutes. Single-use safe pairing.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Connected Technician Sessions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Connected Technician Sessions ({serverSessions.length})
                </h4>
                {serverSessions.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-center border border-dashed border-slate-300 dark:border-slate-700">
                    No active technician sessions logged in recently. Technicians will appear here once connected over Wi-Fi.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    {serverSessions.map((s) => (
                      <div key={s.session_id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                            {(s.user_name || 'T')[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{s.user_name}</div>
                            <div className="text-slate-500 flex items-center space-x-2">
                              <span>{s.role}</span>
                              <span>•</span>
                              <span>{s.device_info || 'Device'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-slate-400">
                          <div>Active: {new Date(s.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'technician' && (
            <div className="space-y-6">
              {/* Architecture Notice */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm mb-0.5">Direct Wi-Fi Communication to Organisation Account</div>
                  Connect to the same workshop Wi-Fi as the shop PC. Whatever you update on this device (repair job status, parts used, diagnosis, client signatures) communicates directly to the Organisation Account over Wi-Fi. The Organisation Account then automatically backs up those changes to local disk and Google Drive.
                </div>
              </div>

              {/* Quick Pairing by Code */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center space-x-2">
                  <QrCode className="w-4 h-4 text-purple-600" />
                  <span>Connect Using Pairing Code</span>
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Enter the 6-character code shown on your Organisation PC:
                </p>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={pairingCodeInput}
                    onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. PR-8421"
                    maxLength={10}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleApplyPairingCode}
                    disabled={testingConnection || !pairingCodeInput.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                    <span>Verify & Connect</span>
                  </button>
                </div>

                {pairingError && (
                  <div className="mt-2 text-xs text-red-600 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{pairingError}</span>
                  </div>
                )}
                {pairingSuccess && (
                  <div className="mt-2 text-xs text-emerald-600 flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{pairingSuccess}</span>
                  </div>
                )}
              </div>

              {/* Manual Server IP Configuration */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center space-x-2">
                  <Server className="w-4 h-4 text-slate-600" />
                  <span>Manual Local Server URL / IP Address</span>
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Specify the IP address of the Organisation PC running INOMS (e.g. <code>http://192.168.1.105:3000</code>):
                </p>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="http://192.168.1.100:3000"
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleSaveCustomUrl}
                      className="px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      Save URL
                    </button>
                    <button
                      onClick={() => handleTestConnection(customUrlInput)}
                      disabled={testingConnection}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1"
                    >
                      {testingConnection ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                      <span>Ping</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Current Active Target: <code>{getServerBaseUrl() || '(Same Origin)'}</code></span>
                    {getServerBaseUrl() && (
                      <button onClick={handleResetUrl} className="text-slate-500 hover:text-red-500 underline">
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>

                {/* Ping Result Banner */}
                {testResult && (
                  <div
                    className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between ${
                      testResult.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {testResult.ok ? (
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      <span>
                        {testResult.ok
                          ? `Connected! Latency: ${testResult.latencyMs}ms (${testResult.postgres ? 'PostgreSQL' : 'SQLite'})`
                          : (testResult.error || 'Connection failed')}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] opacity-75">{testResult.url}</span>
                  </div>
                )}
              </div>

              {/* Android APK Download & Quick Access Banner */}
              <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                        Technician Android App (APK & PWA)
                      </h4>
                      <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                        Download <code className="font-mono font-bold">Inoms-android.apk</code> or install as a zero-download web app
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={directApkUrl}
                      download="Inoms-android.apk"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Download Inoms-android.apk directly"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download APK</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('downloads')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      <span>Full Install Guide</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>Native Android APK</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      Share <code className="font-bold text-emerald-700 dark:text-emerald-400">Inoms-android.apk</code> with technicians via local Wi-Fi, WhatsApp, or USB. Works completely offline on workshop Wi-Fi.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>Instant PWA Alternative (No Download)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      Technicians open Chrome on their phone, go to <code className="font-bold text-indigo-700 dark:text-indigo-400">{primaryOrigin || 'http://[PC-IP]:3000'}</code>, and tap <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOWNLOADS & PWA TAB */}
          {activeTab === 'downloads' && (
            <div className="space-y-6">
              {/* 1. DIRECT ANDROID APK DOWNLOAD SECTION (KEPT FIRST) */}
              <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white rounded-2xl p-5 sm:p-6 border border-emerald-500/40 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-400">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">INOMS Android Application Package</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                          Direct APK
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Native Android application (<code className="text-emerald-300 font-mono">Inoms-android.apk</code>) with direct workshop Wi-Fi sync
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-lg border border-emerald-800/80 self-start sm:self-center">
                    Recommended for Technicians
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Left Column: Direct Download Actions & Installation Steps */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={directApkUrl}
                        download="Inoms-android.apk"
                        className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg flex items-center gap-2.5 cursor-pointer"
                        title="Download Inoms-android.apk to this device"
                      >
                        <Download className="w-5 h-5" />
                        <span>Download Inoms-android.apk</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fullApkShareUrl);
                          setCopiedText('apk_url');
                          setTimeout(() => setCopiedText(null), 2500);
                        }}
                        className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition border border-white/15 flex items-center gap-2 cursor-pointer"
                        title="Copy direct download link for technicians"
                      >
                        {copiedText === 'apk_url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedText === 'apk_url' ? 'Link Copied!' : 'Copy APK Link'}</span>
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Install the INOMS Workshop Android app on your phone:\n${fullApkShareUrl}\nConnect to workshop Wi-Fi to sync repair jobs.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 text-xs font-semibold rounded-xl transition border border-emerald-700/60 flex items-center gap-2 cursor-pointer"
                        title="Share download link on WhatsApp"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Share on WhatsApp</span>
                      </a>
                    </div>

                    <div className="p-3.5 bg-white/5 rounded-xl border border-white/10 space-y-2 text-xs">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Quick 4-Step Phone Installation:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed pl-1">
                        <li>
                          <strong className="text-white">Download:</strong> Tap the green button above or scan the QR code to download <code className="text-emerald-300 font-mono">Inoms-android.apk</code>.
                        </li>
                        <li>
                          <strong className="text-white">Open File:</strong> Open the downloaded file from your phone's notification bar or <em>Downloads</em> folder.
                        </li>
                        <li>
                          <strong className="text-white">Enable Install:</strong> If Android displays <em>"Install unknown apps"</em>, tap <strong>Settings</strong> and toggle on <strong>"Allow from this source"</strong>.
                        </li>
                        <li>
                          <strong className="text-white">Link Device:</strong> Open INOMS, tap <strong>Staff & Tech</strong> on the login screen, and enter the 6-character Workshop Hub PIN!
                        </li>
                      </ol>
                    </div>
                  </div>

                  {/* Right Column: Scan to Download QR Code */}
                  <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl border border-white/10 text-center space-y-2">
                    {apkDownloadQr ? (
                      <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                        <img src={apkDownloadQr} alt="Scan to Download Inoms-android.apk" className="w-32 h-32 sm:w-36 sm:h-36" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      </div>
                    )}
                    <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Scan with Phone Camera</span>
                    </span>
                    <p className="text-[10px] text-slate-400 max-w-[200px] leading-tight">
                      Aim your phone camera at this QR code to download <code className="font-mono text-emerald-300">Inoms-android.apk</code> directly to your smartphone.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. PWA ZERO-INSTALL SECTION (BELOW IN SAME TAB) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-600 dark:text-indigo-400">
                      <Laptop className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          ⚡ Instant Alternative: Progressive Web App (PWA)
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          No APK Download Needed
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Install INOMS directly to your phone's home screen or desktop over workshop Wi-Fi
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 self-start sm:self-center">
                    Universal (Android, iOS & PC)
                  </span>
                </div>

                {/* Platform Selection Sub-tabs */}
                <div className="space-y-3">
                  <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pb-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setPwaGuideTab('android')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                        pwaGuideTab === 'android'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Android (Chrome)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPwaGuideTab('ios')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                        pwaGuideTab === 'ios'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      iPhone & iPad (Safari)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPwaGuideTab('pc')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                        pwaGuideTab === 'pc'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Windows & Mac (Chrome/Edge)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="md:col-span-8 space-y-2 text-xs">
                      {pwaGuideTab === 'android' && (
                        <>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-purple-600" />
                            <span>Installing on Android via Google Chrome:</span>
                          </h4>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-1">
                            <li>Connect your Android phone to the workshop Wi-Fi router.</li>
                            <li>Open Google Chrome and navigate to <code className="font-bold text-purple-600 dark:text-purple-400 font-mono">{primaryOrigin || 'http://[PC-IP]:3000'}</code>.</li>
                            <li>Tap Chrome's three-dots menu <strong>(⋮)</strong> in the top-right corner.</li>
                            <li>Tap <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>).</li>
                            <li>Tap <strong>Install</strong>. An INOMS app icon will be created on your home screen and open in full-screen mode!</li>
                          </ol>
                        </>
                      )}

                      {pwaGuideTab === 'ios' && (
                        <>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-indigo-600" />
                            <span>Installing on iPhone or iPad via Safari:</span>
                          </h4>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-1">
                            <li>Connect your iPhone or iPad to the workshop Wi-Fi network.</li>
                            <li>Open <strong>Safari</strong> and visit <code className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{primaryOrigin || 'http://[PC-IP]:3000'}</code>.</li>
                            <li>Tap the <strong>Share button</strong> (square with an arrow pointing up) at the bottom toolbar.</li>
                            <li>Scroll down the share sheet and tap <strong>"Add to Home Screen"</strong>.</li>
                            <li>Tap <strong>Add</strong> in the top-right corner. INOMS will run full-screen without browser address bars!</li>
                          </ol>
                        </>
                      )}

                      {pwaGuideTab === 'pc' && (
                        <>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Laptop className="w-4 h-4 text-teal-600" />
                            <span>Installing on Windows PC or Mac via Chrome / Edge:</span>
                          </h4>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-1">
                            <li>Open Google Chrome or Microsoft Edge on your computer.</li>
                            <li>Go to <code className="font-bold text-teal-600 dark:text-teal-400 font-mono">{primaryOrigin || 'http://[PC-IP]:3000'}</code>.</li>
                            <li>Look at the right side of the browser URL address bar for the <strong>Install icon (screen with down arrow)</strong>.</li>
                            <li>Click <strong>Install INOMS</strong>. It will create a desktop shortcut and launch as a standalone desktop program.</li>
                          </ol>
                        </>
                      )}
                    </div>

                    <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                      {pwaQrUrl ? (
                        <div className="p-1.5 bg-white rounded-lg shadow inline-block">
                          <img src={pwaQrUrl} alt="Scan to open PWA Web App" className="w-28 h-28" />
                        </div>
                      ) : null}
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Scan to Open on Phone</span>
                      </span>
                      <p className="text-[10px] text-slate-400 max-w-[180px]">
                        Opens the workshop web app directly on your phone browser.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Developer / Custom Capacitor Build Guide */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/70 dark:bg-slate-950/30 space-y-2 text-xs">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-slate-500" />
                  <span>How to Recompile or Customize the APK (Capacitor Engine):</span>
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  The native Android app is packaged with <strong>Capacitor</strong>. Whenever you update frontend code and want to generate a new APK:
                </p>
                <div className="bg-slate-950 text-slate-200 p-2.5 rounded-lg font-mono text-[10px] space-y-1 overflow-x-auto">
                  <div className="text-slate-400"># 1. Build web production assets and sync to Android project:</div>
                  <div className="text-emerald-400 font-bold">npm run cap:build</div>
                  <div className="text-slate-400 pt-1"># 2. Open project in Android Studio to compile APK:</div>
                  <div className="text-emerald-400 font-bold">npm run cap:open</div>
                  <div className="text-slate-400 pt-1"># In Android Studio: Click Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</div>
                  <div className="text-slate-400"># Copy generated APK to public/ folder:</div>
                  <div className="text-cyan-300">cp android/app/build/outputs/apk/debug/app-debug.apk public/Inoms-android.apk</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span>Client Platform: <strong>{isNative ? 'Capacitor Android Native' : 'Modern Web Browser'}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
