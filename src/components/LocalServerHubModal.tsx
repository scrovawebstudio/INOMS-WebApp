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
  Laptop
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
  const [activeTab, setActiveTab] = useState<'server' | 'technician'>(isTechnician ? 'technician' : 'server');

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
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Technician connection state
  const [customUrlInput, setCustomUrlInput] = useState(getServerBaseUrl());
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ServerConnectionStatus | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadServerStatus();
      setCustomUrlInput(getServerBaseUrl());
    }
  }, [isOpen]);

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
    try {
      const res = await generateServerPairingToken();
      if (res.success && res.code && res.serverUrl) {
        setPairingData({
          code: res.code,
          serverUrl: res.serverUrl,
          expiresAt: res.expiresAt || ''
        });

        // Generate safe QR code containing connection payload (NO secrets)
        const qrPayload = JSON.stringify({
          app: 'INOMS_PRO',
          code: res.code,
          serverUrl: res.serverUrl,
          tenantId: res.tenantId
        });
        const qrDataUri = await QRCode.toDataURL(qrPayload, {
          width: 256,
          margin: 2,
          color: { dark: '#1e1b4b', light: '#ffffff' }
        });
        setPairingQrUrl(qrDataUri);
      }
    } catch (e: any) {
      console.warn('Pairing generation error:', e);
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
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">INOMS Pro Local Server Hub</h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-500/30 border border-purple-400/40 text-purple-200 rounded-full">
                  LAN Architecture
                </span>
              </div>
              <p className="text-xs text-purple-200/80">
                Authoritative local source of truth for workshop data & technician devices
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
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'server'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Organisation Server</span>
          </button>
          <button
            onClick={() => setActiveTab('technician')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'technician'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Technician Android / Device Setup</span>
            {isNative && (
              <span className="ml-1.5 px-1.5 py-0.2 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-bold">
                Android
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'server' && (
            <div className="space-y-6">
              {/* Server Status Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Local Server Status: Online & Authoritative
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
                    <div className="text-slate-500 dark:text-slate-400 mb-1">Server Hostname</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {serverInfo?.serverName || 'INOMS-HOME-SERVER'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 mb-1">LAN Port</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      3000 (HTTP / Ingress)
                    </div>
                  </div>
                </div>

                {/* Local Network LAN IPs */}
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-1.5">
                    <Wifi className="w-3.5 h-3.5 text-purple-600" />
                    <span>Local Office Wi-Fi / LAN Addresses (Give to Technicians):</span>
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
                  <div className="font-semibold text-sm mb-0.5">Central Local Communication Model</div>
                  Technicians communicate strictly with the <strong>Organisation's Local INOMS Server</strong> over LAN/Wi-Fi. Devices do not connect directly to raw database files or bypass authentication.
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
