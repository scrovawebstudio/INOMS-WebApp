/**
 * Supabase Cloud Sync & Data Migration Manager
 * 
 * Provides interactive Supabase connection testing, schema management,
 * and one-click data migration from the live running application to Supabase.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Download,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Layers,
  HardDrive,
  Trash2,
  Key,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  migrateAllLiveRunningDataToSupabase,
  MigrationProgress
} from '../lib/supabase';

interface SupabaseSyncManagerProps {
  onMigrationComplete?: () => void;
  className?: string;
  onClose?: () => void;
}

export const SupabaseSyncManager: React.FC<SupabaseSyncManagerProps> = ({
  onMigrationComplete,
  className = '',
  onClose
}) => {
  const [config, setConfig] = useState(getSupabaseConfig());
  const [urlInput, setUrlInput] = useState(config.url);
  const [keyInput, setKeyInput] = useState(config.anonKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    counts: Record<string, number>;
    message: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [sqlContent, setSqlContent] = useState<string>('');

  useEffect(() => {
    fetch('/supabase_schema.sql')
      .then(res => res.text())
      .then(text => setSqlContent(text))
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(urlInput, keyInput);
      setTestResult(res);
      if (res.success) {
        saveSupabaseConfig(urlInput, keyInput);
        setConfig(getSupabaseConfig());
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Failed to connect to Supabase'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = () => {
    saveSupabaseConfig(urlInput, keyInput);
    setConfig(getSupabaseConfig());
    handleTestConnection();
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    setConfig(getSupabaseConfig());
    setUrlInput('');
    setKeyInput('');
    setTestResult(null);
    setMigrationResult(null);
  };

  const handleCopySql = () => {
    if (!sqlContent) return;
    navigator.clipboard.writeText(sqlContent);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStartMigration = async () => {
    if (!config.isConfigured && (!urlInput || !keyInput)) {
      alert('Please configure and test your Supabase credentials first.');
      return;
    }

    if (!config.isConfigured) {
      saveSupabaseConfig(urlInput, keyInput);
      setConfig(getSupabaseConfig());
    }

    setMigrating(true);
    setMigrationProgress(null);
    setMigrationResult(null);

    try {
      const res = await migrateAllLiveRunningDataToSupabase((progress) => {
        setMigrationProgress(progress);
      });
      setMigrationResult(res);
      if (onMigrationComplete) {
        onMigrationComplete();
      }
    } catch (err: any) {
      setMigrationResult({
        success: false,
        counts: {},
        message: err?.message || 'Migration failed'
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. STATUS HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database size={160} />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                <Cloud size={24} />
              </span>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Supabase Cloud Database</h3>
                <p className="text-sm text-slate-400">
                  Direct edge persistence, real-time live replication, and multi-tenant data isolation.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {config.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Configured & Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <AlertCircle size={14} className="text-amber-400" />
                Not Configured
              </span>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
                title="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CREDENTIALS FORM */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Key size={18} className="text-indigo-600 dark:text-indigo-400" />
          Supabase Connection Settings
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Find your Project URL and anon public API key in your Supabase project dashboard under <b>Project Settings &gt; API</b>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Project URL
            </label>
            <input
              type="text"
              placeholder="https://your-project.supabase.co"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Anon / Public API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3.5 rounded-lg mb-4 text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{testResult.message}</p>
              {testResult.latencyMs !== undefined && (
                <p className="text-[11px] opacity-80 mt-0.5">Roundtrip response time: {testResult.latencyMs}ms</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !urlInput || !keyInput}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
            {testing ? 'Testing Connection...' : 'Test Connection'}
          </button>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={!urlInput || !keyInput}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Save Credentials
          </button>
          {config.isConfigured && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium transition-colors ml-auto"
            >
              <Trash2 size={14} />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* 3. SQL SCHEMA SETUP GUIDE */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={18} className="text-emerald-600 dark:text-emerald-400" />
            Supabase Database Tables & Security Schema
          </h4>
          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
            PostgreSQL Ready
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          The INOMS schema provisions all 12 multi-tenant relational tables (organizations, clients, jobs, invoices, payments, inventory, expenses, categories, racks, equipments, problems, audit logs) along with Row Level Security (RLS) policies and Realtime publication.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleCopySql}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-medium transition-colors"
          >
            {copiedSql ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Schema'}
          </button>
          <button
            type="button"
            onClick={handleDownloadSql}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-medium transition-colors"
          >
            <Download size={14} />
            Download supabase_schema.sql
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-medium transition-colors ml-auto"
          >
            Open Supabase Dashboard
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* 4. LIVE DATA MIGRATION ENGINE (HERO COMPONENT) */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border border-indigo-700/50 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 mb-2">
              <ShieldCheck size={12} />
              Zero Data Loss Migration
            </div>
            <h4 className="text-lg font-bold tracking-tight">Migrate All Data to Supabase</h4>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Extracts all existing organizations, clients, repair inward/outward jobs, billing invoices, receipts, inventory parts, and workshop settings from the live application and inserts them into Supabase.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartMigration}
            disabled={migrating}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold shadow-lg transition-all transform active:scale-95 shrink-0"
          >
            <RefreshCw size={16} className={migrating ? 'animate-spin' : ''} />
            {migrating ? 'Migrating Data...' : 'Migrate Live Data Now'}
          </button>
        </div>

        {/* Progress Bar */}
        {migrating && migrationProgress && (
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" />
                {migrationProgress.stage}
              </span>
              <span className="text-slate-400">
                Step {migrationProgress.currentStage} of {migrationProgress.totalStages}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(migrationProgress.currentStage / migrationProgress.totalStages) * 100}%`
                }}
              />
            </div>
            <p className="text-xs text-slate-300">{migrationProgress.message}</p>
          </div>
        )}

        {/* Success Result */}
        {migrationResult && (
          <div
            className={`p-4 rounded-lg mt-4 text-xs ${
              migrationResult.success
                ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 border border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {migrationResult.success ? (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold text-sm mb-1">{migrationResult.message}</p>
                {migrationResult.success && Object.keys(migrationResult.counts).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-emerald-800/60">
                    {Object.entries(migrationResult.counts).map(([k, v]) => (
                      <div key={k} className="bg-emerald-900/30 rounded p-1.5 text-center">
                        <span className="text-slate-400 block text-[10px] capitalize">
                          {k.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="text-white font-bold text-sm">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupabaseSyncManager;
