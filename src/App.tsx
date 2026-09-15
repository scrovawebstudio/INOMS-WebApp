/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Wallet,
  Receipt,
  Package,
  PiggyBank,
  Settings,
  TrendingUp,
  Building,
  ShieldCheck,
  ChevronDown,
  Bell,
  RefreshCw,
  LogOut,
  UserCheck,
  BookOpen,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Server,
  Activity,
  Truck,
  Kanban,
  Menu,
  X,
  WifiOff,
  Wifi,
  Clock,
  Calendar,
  ShoppingCart,
  Store,
  Wrench,
  Cloud
} from 'lucide-react';

import GoogleDriveHubModal from './components/GoogleDriveHubModal';
import { ActiveSessionConflictModal } from './components/ActiveSessionConflictModal';
import {
  sessionGuard,
  subscribeConcurrency,
  ConcurrencyState
} from './lib/sessionGuard';
import {
  subscribeDriveState,
  setDriveActiveTenantId,
  uploadSnapshotToDrive,
  fetchLatestSnapshotFromDrive,
  downloadSnapshotFromDrive,
  getLatestDriveSnapshotMeta
} from './lib/googleDrive';
import { normalizeSnapshotData, mergeOrganizationData } from './lib/driveMerge';

import { getDirectoryHandle, getLatestBackupFromDirectoryHandle, writeBackupToDirectoryHandle } from './lib/directoryHandleStorage';
import { getBackupOrgPrefix } from './lib/backupUtils';
import { getOrgPrefix, isTenantProPlan, isTenantTrialActive } from './lib/orgUtils';
import { hasCapability } from './lib/capabilities';
import { LocalServerHubModal } from './components/LocalServerHubModal';
import {
  getAppStorageItem,
  setAppStorageItem,
  removeAppStorageItem,
  getAppSessionItem,
  setAppSessionItem,
  removeAppSessionItem,
  getDeletedTenantIds,
  markTenantDeletedInStorage,
  unmarkTenantDeletedInStorage
} from './lib/storage';

import {
  getHomeServerDbKey,
  saveHomeServerDbKey,
  restoreHomeServerDb,
  registerHomeServerSession,
  checkHomeServerSession,
  saveAllTenantDataViaApi,
  fetchTenantsViaApi,
  ensureTenantSessionViaApi,
  saveBackupSnapshotToServer,
  fetchServerHealth,
  syncTenantsViaApi,
  logoutViaApi
} from './lib/api';

import {
  bootstrapTenantFromHomeServer,
  pullDeltaFromHomeServer,
  pushPendingOperations,
  getPendingOperationsCount,
  replaceLocalCollection,
  getAuthToken,
  subscribeLocalDb
} from './lib/localDb';

import {
  broadcastLocalMutation,
  subscribeSyncBroadcast,
  startLiveSyncPolling
} from './lib/syncBroadcast';

// Modular Components
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Inwards from './components/Inwards';
import LiveRepairQueue from './components/LiveRepairQueue';
import Outwards from './components/Outwards';
import Billing from './components/Billing';
import Payments from './components/Payments';
import Inventory from './components/Inventory';
import PurchasesHub from './components/PurchasesHub';
import Suppliers from './components/Suppliers';
import ServicePartners from './components/ServicePartners';
import Expenses from './components/Expenses';
import SettingsComponent from './components/Settings';
import Reports from './components/Reports';
import AuthModal, { TenantOrg, SystemAnnouncement, INITIAL_TENANTS, getTenantFeatures } from './components/AuthModal';
import MasterAdminDashboard from './components/MasterAdminDashboard';
import {
  subscribeTenants,
  broadcastTenantListUpdate,
  saveTenantToFirestore,
  deleteTenantFromFirestore,
  saveCompanyConfigToFirestore,
  subscribeCompanyConfig,
  subscribeTenantCollection,
  saveTenantCollectionToFirestore,
  subscribeAnnouncements,
  saveAnnouncementToFirestore,
  deleteAnnouncementFromFirestore,
  saveUserSessionToFirestore,
  subscribeUserSession,
  isQuotaExhausted,
  getPendingQueueCount,
  clearPendingQueue,
  retryPendingCloudSync
} from './lib/firebase';
import { deleteOrgApi, purgeAllDataApi, clearOrgWorkspaceApi, importBrowserTenantDataToServer } from './lib/api';

// Data Mock repos
import {
  INITIAL_CLIENTS,
  INITIAL_LEDGER,
  INITIAL_JOBS,
  INITIAL_PAYMENTS,
  INITIAL_INVOICES,
  INITIAL_PRODUCTS,
  INITIAL_EXPENSES,
  MASTER_ADMIN_USER,
  INITIAL_ORG_USERS,
  INITIAL_USERS,
  INITIAL_LOGS,
  EQUIPMENT_TYPES,
  COMMON_PROBLEMS,
  INITIAL_CATEGORIES,
  INITIAL_RACKS,
  INITIAL_SUPPLIERS,
  INITIAL_SERVICE_PARTNERS,
  INITIAL_PURCHASES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_PURCHASE_RETURNS,
  INITIAL_SUPPLIER_PAYMENTS,
  INITIAL_SERVICE_PARTNER_PAYMENTS,
  INITIAL_INVENTORY_SERIALS,
  INITIAL_INVENTORY_TRANSACTIONS
} from './data';

import {
  Client,
  ClientLedgerEntry,
  RepairJob,
  Payment,
  Invoice,
  Product,
  Expense,
  SystemUser,
  ActivityLog,
  Equipment,
  Problem,
  Category,
  LocationRack,
  CompanyConfig,
  DEFAULT_THEME_PALETTE,
  TenantThemePalette,
  getEffectiveBillAmount,
  sortJobsByLatest,
  AddonPricingConfig,
  MasterAdminInvoice,
  DEFAULT_ADDON_PRICING,
  Supplier,
  ServicePartner,
  Purchase,
  PurchaseOrder,
  PurchaseReturn,
  SupplierPayment,
  ServicePartnerPayment,
  InventorySerial,
  InventoryTransaction
} from './types';
import { isModuleAnAddon } from './lib/masterAdminConfig';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [purchaseHubInitialSupplierId, setPurchaseHubInitialSupplierId] = useState<string | null>(null);
  const [purchaseHubInitialModal, setPurchaseHubInitialModal] = useState<'purchase' | 'order' | 'return' | null>(null);
  
  // Helper to construct tenant-isolated default company config
  const getDefaultCompanyConfig = (tenant: TenantOrg): CompanyConfig => {
    if (tenant.id === 'org-admin' || tenant.code === 'ADMIN-00' || tenant.ownerMobile?.includes('8149862034')) {
      return {
        name: 'Master System Admin',
        address: 'Badambadi, Cuttack, Odisha',
        phone: '+91 8149862034',
        email: 'admin@mastersystem.com',
        website: 'www.mastersystem.com',
        gstin: '21AJDSBSDWERDS',
        syncMode: 'offline',
        lanHostIp: '192.168.25.10',
        driveConnected: false,
        autoBackupTimes: ['10:00', '18:00'],
        localBackupEnabled: true,
        localBackupPath: 'C:\\INOMS_Backups\\',
        localBackupScheduleTime: '18:00',
        localBackupFrequency: 'on_sync',
        lastLocalBackupTime: '2026-07-26 08:00:00'
      };
    } else if (tenant.id === 'org-nibban' || tenant.code === 'NIBBAN-01' || tenant.name === 'Nibban Technologies' || tenant.id === 'org-inoms') {
      return {
        name: 'INOMS Enterprises',
        address: 'Link Road, Cuttack, Odisha',
        phone: '+91 9876543210',
        email: 'support@inoms.com',
        website: 'www.inoms.com',
        gstin: '21INOMS1234F1Z',
        syncMode: 'offline',
        lanHostIp: '192.168.1.15',
        driveConnected: false,
        autoBackupTimes: ['12:00'],
        localBackupEnabled: true,
        localBackupPath: 'C:\\INOMS_Backups\\',
        localBackupScheduleTime: '20:00',
        localBackupFrequency: 'on_sync',
        lastLocalBackupTime: '2026-07-26 12:00:00'
      };
    } else {
      return {
        name: tenant.name,
        address: 'Main Office',
        phone: tenant.ownerMobile || '',
        email: `contact@${tenant.code?.toLowerCase() || 'org'}.com`,
        website: `www.${tenant.code?.toLowerCase() || 'org'}.com`,
        gstin: '',
        syncMode: 'offline',
        lanHostIp: '192.168.1.100',
        driveConnected: false,
        autoBackupTimes: ['18:00'],
        localBackupEnabled: true,
        localBackupPath: 'C:\\Backups\\',
        localBackupScheduleTime: '18:00',
        localBackupFrequency: 'on_sync',
        lastLocalBackupTime: ''
      };
    }
  };

  // Helper to accurately calculate remaining subscription time for the active organization
  const getSubscriptionTimeLeft = (tenant: TenantOrg) => {
    if (tenant.id === 'org-admin' || tenant.code?.toUpperCase() === 'ADMIN-00' || tenant.ownerMobile?.includes('8149862034') || tenant.subscriptionPlan === 'lifetime') {
      return {
        text: 'Lifetime',
        planLabel: 'Lifetime Unlimited Access',
        validUntil: 'Never Expires (Permanent)',
        type: 'lifetime',
        isUrgent: false,
        isExpired: false,
        days: 9999
      };
    }

    const rawPlan = ((tenant.subscriptionPlan || (tenant as any).plan || '') as string).toLowerCase().trim();
    const isTrial = Boolean(tenant.isTrial || rawPlan === 'trial' || rawPlan.includes('trial'));
    
    let planLabel = isTrial ? '7-Day Free Trial' : 'Monthly Subscription';
    if (rawPlan === 'standard' || rawPlan.includes('standard')) planLabel = 'Standard Plan';
    else if (rawPlan === 'basic' || rawPlan.includes('basic')) planLabel = 'Basic Plan';
    else if (rawPlan === 'pro' || rawPlan.includes('pro')) planLabel = 'Pro Plan';
    else if (rawPlan === 'premium' || rawPlan.includes('premium')) planLabel = 'Premium Plan';
    else if (rawPlan === 'quarterly' || rawPlan.includes('quarter')) planLabel = 'Quarterly Subscription';
    else if (rawPlan === 'annual' || rawPlan === 'yearly' || rawPlan.includes('year')) planLabel = 'Annual Subscription';
    else if (rawPlan === 'lifetime') planLabel = 'Lifetime License';
    else if (rawPlan === 'monthly') planLabel = 'Monthly Subscription';

    let endDate: Date | null = null;
    const rawEndDate = tenant.subscriptionEndDate || (tenant as any).validUntil || (tenant as any).expiryDate || (tenant as any).expiresAt;

    if (rawEndDate && typeof rawEndDate === 'string') {
      const cleanRaw = rawEndDate.includes('T') ? rawEndDate.split('T')[0] : rawEndDate.trim();
      const parts = cleanRaw.split('-');
      if (parts.length === 3 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
        endDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        const parsed = new Date(cleanRaw);
        if (!isNaN(parsed.getTime())) endDate = parsed;
      }
    }

    if (!endDate && (tenant as any).validity && typeof (tenant as any).validity === 'string') {
      const valStr = ((tenant as any).validity as string).toLowerCase();
      const created = tenant.createdAt ? new Date(tenant.createdAt) : new Date();
      if (valStr.includes('year') || valStr.includes('365')) {
        endDate = new Date(created.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else if (valStr.includes('quarter') || valStr.includes('90')) {
        endDate = new Date(created.getTime() + 90 * 24 * 60 * 60 * 1000);
      } else if (valStr.includes('month') || valStr.includes('30')) {
        endDate = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (valStr.includes('trial') || valStr.includes('7')) {
        endDate = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    if (!endDate || isNaN(endDate.getTime())) {
      if (tenant.createdAt) {
        const created = new Date(tenant.createdAt);
        if (!isNaN(created.getTime())) {
          const daysToAdd = isTrial ? (tenant.trialDays || 7) : 30;
          endDate = new Date(created.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
      }
    }

    if (!endDate || isNaN(endDate.getTime())) {
      // Default from current time
      const now = new Date();
      endDate = new Date(now.getTime() + (isTrial ? (tenant.trialDays || 7) : 30) * 24 * 60 * 60 * 1000);
    }

    // Set end date to end of that calendar day
    endDate.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Formatted date (e.g., "22 Aug 2026")
    const validUntil = endDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    if (diffDays < 0) {
      const ago = Math.abs(diffDays);
      return {
        text: ago === 1 ? 'Expired (1d ago)' : ago <= 30 ? `Expired (${ago}d ago)` : 'Expired',
        planLabel,
        validUntil,
        type: 'expired',
        isUrgent: true,
        isExpired: true,
        days: diffDays
      };
    }

    if (diffDays === 0) {
      return {
        text: 'Expires today',
        planLabel,
        validUntil,
        type: 'day',
        isUrgent: true,
        isExpired: false,
        days: 0
      };
    }

    if (diffDays === 1) {
      return {
        text: '1 day left',
        planLabel,
        validUntil,
        type: 'day',
        isUrgent: true,
        isExpired: false,
        days: 1
      };
    }

    if (diffDays <= 30) {
      return {
        text: `${diffDays} days left`,
        planLabel,
        validUntil,
        type: 'day',
        isUrgent: diffDays <= 5,
        isExpired: false,
        days: diffDays
      };
    }

    if (diffDays <= 365) {
      const months = Math.floor(diffDays / 30);
      const remDays = diffDays % 30;
      const text = remDays > 0 
        ? `${months} month${months > 1 ? 's' : ''} ${remDays}d left` 
        : (months === 1 ? '1 month left' : `${months} months left`);
      return {
        text,
        planLabel,
        validUntil,
        type: 'month',
        isUrgent: false,
        isExpired: false,
        days: diffDays
      };
    }

    const years = Math.floor(diffDays / 365);
    const remDaysAfterYears = diffDays % 365;
    const remMonths = Math.floor(remDaysAfterYears / 30);
    const text = remMonths > 0 
      ? `${years} year${years > 1 ? 's' : ''} ${remMonths}m left` 
      : (years === 1 ? '1 year left' : `${years} years left`);
    return {
      text,
      planLabel,
      validUntil,
      type: 'year',
      isUrgent: false,
      isExpired: false,
      days: diffDays
    };
  };

  // Helper to ensure Master System Admin org exists and keep all registered organizations intact
  const ensureAdminActive = (list: TenantOrg[]) => {
    let result = Array.isArray(list) ? list.filter(t => t && t.id && t.id !== 'global_system_branding' && t.code !== 'GLOBAL_SYS') : [];
    const hasAdminOrg = result.some(t => t.id === 'org-admin' || t.ownerMobile?.includes('8149862034') || t.code?.toUpperCase() === 'ADMIN-00');
    if (!hasAdminOrg) {
      result = [INITIAL_TENANTS[0], ...result];
    }
    
    // Deduplicate by ID strictly so no valid user organization is lost
    const seenIds = new Set<string>();
    const deduped: TenantOrg[] = [];

    for (const t of result) {
      if (!t || !t.id || t.id === 'global_system_branding' || t.code === 'GLOBAL_SYS' || seenIds.has(t.id)) continue;
      seenIds.add(t.id);

      const cleanMobile = (t.ownerMobile || '').replace(/\D/g, '');
      const isMasterAdmin = t.id === 'org-admin' || cleanMobile === '8149862034' || t.code?.toUpperCase() === 'ADMIN-00';

      if (isMasterAdmin) {
        deduped.push({
          ...t,
          id: 'org-admin',
          name: t.name || 'Master System Admin',
          ownerName: t.ownerName || 'Master System Admin',
          ownerMobile: t.ownerMobile || '+91 8149862034',
          pin: '••••••', // Master Admin PIN is strictly server-side verified, never stored in client browser storage
          status: 'active' as const
        });
      } else {
        deduped.push({
          ...t,
          pin: '••••••' // All organization PINs are server-side verified; never stored in plaintext in browser
        });
      }
    }

    return deduped;
  };

  const sanitizeTenantsForStorage = (list: TenantOrg[]): TenantOrg[] => {
    return list.map(t => ({
      ...t,
      pin: '••••••'
    }));
  };

  // Multi-Tenant Organizations State
  const [tenants, setTenants] = useState<TenantOrg[]>(() => {
    try {
      const saved = getAppStorageItem('tenants_v3');
      const parsed = saved ? JSON.parse(saved) : INITIAL_TENANTS;
      return ensureAdminActive(Array.isArray(parsed) ? parsed : INITIAL_TENANTS);
    } catch {
      return ensureAdminActive(INITIAL_TENANTS);
    }
  });

  const [activeTenant, setActiveTenant] = useState<TenantOrg>(() => {
    const saved = getAppStorageItem('active_tenant_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id === 'org-admin' || parsed.id === 'org-nibban' || parsed.code?.toUpperCase() === 'NIBBAN' || parsed.code?.toUpperCase() === 'ADMIN') {
          return { ...parsed, status: 'active' };
        }
        return parsed;
      } catch (e) {}
    }
    return INITIAL_TENANTS[0];
  });
  const homeServerSyncEnabled = activeTenant.id === 'org-admin' || getTenantFeatures(activeTenant).allowHomeServerSync;

  // Lifted Company Config state strictly isolated by active tenant
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(() => {
    const saved = getAppStorageItem(`company_config_${activeTenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (activeTenant.id !== 'org-admin' && (parsed.name === 'Master System Admin' || parsed.phone === '+91 8149862034')) {
            return getDefaultCompanyConfig(activeTenant);
          }
          return {
            ...getDefaultCompanyConfig(activeTenant),
            ...parsed,
            name: parsed.name || activeTenant.name,
            phone: parsed.phone || activeTenant.ownerMobile
          };
        }
      } catch (e) {}
    }
    return getDefaultCompanyConfig(activeTenant);
  });

  // Track which tenant ID the currently loaded companyConfig belongs to
  const configTenantIdRef = React.useRef<string>(activeTenant.id);

  const [activeCompany, setActiveCompany] = useState<string>(companyConfig.name);
  
  // Font size setting state with localStorage persistence
  const [fontSize, setFontSize] = useState<string>(() => {
    return getAppStorageItem('app_font_size') || '16';
  });

  React.useEffect(() => {
    setAppStorageItem('tenants_v3', JSON.stringify(sanitizeTenantsForStorage(tenants)));
  }, [tenants]);

  React.useEffect(() => {
    setAppStorageItem('active_tenant_v3', JSON.stringify({
      ...activeTenant,
      pin: '••••••'
    }));
  }, [activeTenant]);

  // Load tenant-specific company config when active tenant switches
  React.useEffect(() => {
    if (!activeTenant?.id) return;
    configTenantIdRef.current = activeTenant.id;
    const savedForTenant = getAppStorageItem(`company_config_${activeTenant.id}`);
    const globalBrandingStr = getAppStorageItem('global_system_branding');
    let globalBranding: any = null;
    if (globalBrandingStr) {
      try { globalBranding = JSON.parse(globalBrandingStr); } catch (e) {}
    }

    if (savedForTenant) {
      try {
        const parsed = JSON.parse(savedForTenant);
        if (parsed && typeof parsed === 'object') {
          // If this is not the admin org but contains admin details, sanitize and clean it up
          if (activeTenant.id !== 'org-admin' && (parsed.name === 'Master System Admin' || parsed.phone === '+91 8149862034')) {
            const clean = getDefaultCompanyConfig(activeTenant);
            if (globalBranding?.appLogoUrl) clean.appLogoUrl = globalBranding.appLogoUrl;
            if (globalBranding?.appName) clean.appName = globalBranding.appName;
            if (globalBranding?.appTagline) clean.appTagline = globalBranding.appTagline;
            setCompanyConfig(clean);
            setAppStorageItem(`company_config_${activeTenant.id}`, JSON.stringify(clean));
            return;
          }
          setCompanyConfig({
            ...getDefaultCompanyConfig(activeTenant),
            ...parsed,
            name: parsed.name || activeTenant.name,
            phone: parsed.phone || activeTenant.ownerMobile,
            appLogoUrl: parsed.appLogoUrl || globalBranding?.appLogoUrl || '/inoms_logo.jpg',
            appName: parsed.appName || globalBranding?.appName || 'INOMS',
            appTagline: parsed.appTagline || globalBranding?.appTagline || 'Integrated Inward & Outward Management System',
            localBackupFrequency: 'on_sync'
          });
          return;
        }
      } catch (e) {}
    }
    const defaultConfig = getDefaultCompanyConfig(activeTenant);
    if (globalBranding?.appLogoUrl) defaultConfig.appLogoUrl = globalBranding.appLogoUrl;
    if (globalBranding?.appName) defaultConfig.appName = globalBranding.appName;
    if (globalBranding?.appTagline) defaultConfig.appTagline = globalBranding.appTagline;
    setCompanyConfig(defaultConfig);
    setAppStorageItem(`company_config_${activeTenant.id}`, JSON.stringify(defaultConfig));
  }, [activeTenant?.id]);

  // Persist tenant company config when companyConfig changes
  const savedGlobalBranding = React.useMemo(() => {
    const saved = getAppStorageItem('global_system_branding');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  }, [companyConfig?.appName, companyConfig?.appTagline, companyConfig?.appLogoUrl]);

  const systemAppName = companyConfig.appName || savedGlobalBranding?.appName || 'INOMS';
  const systemAppTagline = companyConfig.appTagline || savedGlobalBranding?.appTagline || 'Integrated Inward & Outward Management System';
  const systemAppLogo = companyConfig.appLogoUrl || savedGlobalBranding?.appLogoUrl || companyConfig.logoUrl || '/inoms_logo.jpg';

  React.useEffect(() => {
    document.title = `${systemAppName} - ${systemAppTagline}`;
    try {
      const favicons = document.querySelectorAll("link[rel*='icon']");
      if (favicons.length > 0) {
        favicons.forEach((el) => {
          (el as HTMLLinkElement).href = '/favicon-32x32.png';
        });
      }
    } catch {}
  }, [systemAppName, systemAppTagline]);

  React.useEffect(() => {
    if (!activeTenant?.id) return;
    if (configTenantIdRef.current !== activeTenant.id) return;

    setAppStorageItem(`company_config_${activeTenant.id}`, JSON.stringify(companyConfig));
    setActiveCompany(companyConfig.name || activeTenant.name);

    // Persist active tenant config remotely only when this organisation opted in.
    if (homeServerSyncEnabled) {
      saveCompanyConfigToFirestore(activeTenant.id, companyConfig);
    }

    // Synchronize global application branding ONLY if updated by Master Admin or if appLogoUrl is explicitly set
    const isMasterAdminOrg = activeTenant.id === 'org-admin' || activeTenant.code === 'ADMIN-00' || activeTenant.ownerMobile?.includes('8149862034');

    if (isMasterAdminOrg || companyConfig.appLogoUrl) {
      const globalBrandingPayload = {
        appName: systemAppName,
        appTagline: systemAppTagline,
        appLogoUrl: systemAppLogo
      };
      setAppStorageItem('global_system_branding', JSON.stringify(globalBrandingPayload));

      // Global branding is a Master Admin setting; never upload it from a local-only tenant.
      if (homeServerSyncEnabled && isMasterAdminOrg) {
        saveCompanyConfigToFirestore('global_system_branding', {
          ...companyConfig,
          ...globalBrandingPayload
        });
      }
    }
  }, [companyConfig, activeTenant?.id, homeServerSyncEnabled, systemAppName, systemAppTagline, systemAppLogo]);

  React.useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    setAppStorageItem('app_font_size', fontSize);
  }, [fontSize]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  });
  const [justSynced, setJustSynced] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return getAppSessionItem('authenticated') === 'true';
  });

  const [userRole, setUserRole] = useState<string>(() => {
    return getAppSessionItem('user_role') || 'Admin';
  });

  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = getAppSessionItem('current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(!isAuthenticated);

  // Google Drive Multi-Device Cloud Sync State & Handlers
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState<boolean>(false);
  const [showLocalServerHubModal, setShowLocalServerHubModal] = useState<boolean>(false);
  const [driveSyncState, setDriveSyncState] = useState({
    isConnected: false,
    userEmail: null as string | null,
    userName: null as string | null,
    isSyncing: false,
    lastSyncedAt: null as string | null
  });

  React.useEffect(() => {
    if (activeTenant?.id) {
      setDriveActiveTenantId(activeTenant.id);
    }
  }, [activeTenant?.id]);

  React.useEffect(() => {
    const unsub = subscribeDriveState(setDriveSyncState);
    return unsub;
  }, []);

  const isProTenant = React.useMemo(() => hasCapability(activeTenant, 'local_server') || isTenantProPlan(activeTenant), [activeTenant]);
  const isTrialActiveTenant = React.useMemo(() => isTenantTrialActive(activeTenant), [activeTenant]);

  // Active Session Concurrency Guard State
  const [concurrencyState, setConcurrencyState] = useState<ConcurrencyState>({
    hasConflict: false,
    conflictDevice: null,
    isReadOnly: false,
    myDeviceId: '',
    myDeviceName: ''
  });
  const concurrencyStateRef = React.useRef<ConcurrencyState>(concurrencyState);
  concurrencyStateRef.current = concurrencyState;

  // Track which conflict device has been seen and dismissed by the user so modal doesn't pop up every 30s
  const dismissedConflictDeviceIdRef = React.useRef<string | null>(null);
  const [isConflictModalDismissed, setIsConflictModalDismissed] = useState<boolean>(() => {
    try {
      const activeTenantId = activeTenant?.id;
      return activeTenantId && sessionStorage.getItem(`inoms_conflict_dismissed_${activeTenantId}`) ? true : false;
    } catch {
      return false;
    }
  });

  // Eviction State for Forced Logout when another device takes over
  const [sessionEvictionInfo, setSessionEvictionInfo] = useState<{
    isEvicted: boolean;
    reason: string;
    takenOverBy: string;
  } | null>(null);

  React.useEffect(() => {
    if (!activeTenant?.id) return;
    sessionGuard.start({
      tenantId: activeTenant.id,
      tenantName: companyConfig.name || activeTenant.name,
      userName: currentUser?.name || 'Admin',
      userEmail: currentUser?.email || driveSyncState.userEmail || '',
      isDriveConnected: driveSyncState.isConnected
    });

    const unsubscribe = subscribeConcurrency((state) => {
      setConcurrencyState(state);
      setIsConflictModalDismissed(state.isModalDismissed);
    });

    // Handle forced logout when another device chooses "Take Over as Active Terminal"
    const unsubEvicted = sessionGuard.onEvicted((info) => {
      console.warn('[App] Session evicted by takeover from another terminal:', info);
      // Immediately log out of this device
      setIsAuthenticated(false);
      removeAppSessionItem('authenticated');
      setDriveActiveTenantId('');
      try {
        localStorage.removeItem('remembered_login_mobile');
      } catch (e) {}
      logoutViaApi().catch(() => {});

      // Record eviction notice so user is clearly informed
      setSessionEvictionInfo({
        isEvicted: true,
        reason: info.reason,
        takenOverBy: info.takenOverBy
      });

      setShowAuthModal(true);
    });

    return () => {
      unsubscribe();
      unsubEvicted();
      sessionGuard.stop();
    };
  }, [activeTenant?.id, driveSyncState.isConnected, driveSyncState.userEmail, currentUser?.name, currentUser?.email, companyConfig.name]);

  // Global Save Notification Status Banner
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const triggerSaveNotification = React.useCallback((message: string, isError = false) => {
    setSaveStatus({ type: isError ? 'error' : 'success', message });
  }, []);

  // Multi-device sync state refs
  const tenantCollectionPersistRef = React.useRef<string | null>(null);
  const lastKnownDriveSnapshotTimeRef = React.useRef<string | null>(null);
  const isDriveOperationInProgressRef = React.useRef<boolean>(false);
  const isApplyingSnapshotRef = React.useRef<boolean>(false);
  const pendingAutoDriveSyncRef = React.useRef<boolean>(false);
  const lastAutoDriveUploadTimeRef = React.useRef<number>(0);
  const autoDriveSyncTimerRef = React.useRef<any>(null);
  const driveSyncStateRef = React.useRef(driveSyncState);
  driveSyncStateRef.current = driveSyncState;

  /**
   * Universal snapshot application: normalizes payload format (camelCase & snake_case),
   * updates all active state hooks, synchronizes Firestore collections, and updates persistence ref.
   */
  const applySnapshotData = React.useCallback(
    async (snapshot: any, tId: string, showNotification = true, customMessage?: string): Promise<boolean> => {
      isApplyingSnapshotRef.current = true;
      try {
        const data = normalizeSnapshotData(snapshot);
        if (!data) return false;

      // Update React state hooks, local persistence cache, and Firestore
      if (Array.isArray(data.clients)) {
        setClients(data.clients);
        clientsRef.current = data.clients;
        setAppStorageItem(`clients_${tId}`, JSON.stringify(data.clients));
        saveTenantCollectionToFirestore(tId, 'clients', data.clients);
      }
      if (Array.isArray(data.ledger)) {
        setLedger(data.ledger);
        ledgerRef.current = data.ledger;
        setAppStorageItem(`ledger_${tId}`, JSON.stringify(data.ledger));
        saveTenantCollectionToFirestore(tId, 'ledger', data.ledger);
      }
      if (Array.isArray(data.jobs)) {
        const sorted = sortJobsByLatest(data.jobs);
        setJobs(sorted);
        jobsRef.current = sorted;
        setAppStorageItem(`jobs_${tId}`, JSON.stringify(sorted));
        saveTenantCollectionToFirestore(tId, 'jobs', sorted);
      }
      if (Array.isArray(data.payments)) {
        setPayments(data.payments);
        paymentsRef.current = data.payments;
        setAppStorageItem(`payments_${tId}`, JSON.stringify(data.payments));
        saveTenantCollectionToFirestore(tId, 'payments', data.payments);
      }
      if (Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
        invoicesRef.current = data.invoices;
        setAppStorageItem(`invoices_${tId}`, JSON.stringify(data.invoices));
        saveTenantCollectionToFirestore(tId, 'invoices', data.invoices);
      }
      if (Array.isArray(data.products)) {
        setProducts(data.products);
        productsRef.current = data.products;
        setAppStorageItem(`products_${tId}`, JSON.stringify(data.products));
        saveTenantCollectionToFirestore(tId, 'products', data.products);
      }
      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
        expensesRef.current = data.expenses;
        setAppStorageItem(`expenses_${tId}`, JSON.stringify(data.expenses));
        saveTenantCollectionToFirestore(tId, 'expenses', data.expenses);
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        setUsers(data.users);
        usersRef.current = data.users;
        setAppStorageItem(`users_${tId}`, JSON.stringify(data.users));
        saveTenantCollectionToFirestore(tId, 'users', data.users);
      }
      if (Array.isArray(data.logs)) {
        setLogs(data.logs);
        logsRef.current = data.logs;
        saveTenantCollectionToFirestore(tId, 'logs', data.logs);
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
        categoriesRef.current = data.categories;
        setAppStorageItem(`categories_${tId}`, JSON.stringify(data.categories));
        saveTenantCollectionToFirestore(tId, 'categories', data.categories);
      }
      if (Array.isArray(data.racks)) {
        setRacks(data.racks);
        racksRef.current = data.racks;
        setAppStorageItem(`racks_${tId}`, JSON.stringify(data.racks));
        saveTenantCollectionToFirestore(tId, 'racks', data.racks);
      }
      if (Array.isArray(data.equipments)) {
        setEquipments(data.equipments);
        equipmentsRef.current = data.equipments;
        setAppStorageItem(`equipments_${tId}`, JSON.stringify(data.equipments));
        saveTenantCollectionToFirestore(tId, 'equipments', data.equipments);
      }
      if (Array.isArray(data.problems)) {
        setProblems(data.problems);
        problemsRef.current = data.problems;
        setAppStorageItem(`problems_${tId}`, JSON.stringify(data.problems));
        saveTenantCollectionToFirestore(tId, 'problems', data.problems);
      }
      if (Array.isArray(data.suppliers)) {
        setSuppliers(data.suppliers);
        suppliersRef.current = data.suppliers;
        setAppStorageItem(`suppliers_${tId}`, JSON.stringify(data.suppliers));
        saveTenantCollectionToFirestore(tId, 'suppliers', data.suppliers);
      }
      if (Array.isArray(data.servicePartners)) {
        setServicePartners(data.servicePartners);
        servicePartnersRef.current = data.servicePartners;
        setAppStorageItem(`servicePartners_${tId}`, JSON.stringify(data.servicePartners));
        saveTenantCollectionToFirestore(tId, 'service_partners', data.servicePartners);
      }
      if (Array.isArray(data.purchases)) {
        setPurchases(data.purchases);
        purchasesRef.current = data.purchases;
        setAppStorageItem(`purchases_${tId}`, JSON.stringify(data.purchases));
        saveTenantCollectionToFirestore(tId, 'purchases', data.purchases);
      }
      if (Array.isArray(data.purchaseOrders)) {
        setPurchaseOrders(data.purchaseOrders);
        purchaseOrdersRef.current = data.purchaseOrders;
        setAppStorageItem(`purchaseOrders_${tId}`, JSON.stringify(data.purchaseOrders));
        saveTenantCollectionToFirestore(tId, 'purchase_orders', data.purchaseOrders);
      }
      if (Array.isArray(data.purchaseReturns)) {
        setPurchaseReturns(data.purchaseReturns);
        purchaseReturnsRef.current = data.purchaseReturns;
        setAppStorageItem(`purchaseReturns_${tId}`, JSON.stringify(data.purchaseReturns));
        saveTenantCollectionToFirestore(tId, 'purchase_returns', data.purchaseReturns);
      }
      if (Array.isArray(data.supplierPayments)) {
        setSupplierPayments(data.supplierPayments);
        supplierPaymentsRef.current = data.supplierPayments;
        setAppStorageItem(`supplierPayments_${tId}`, JSON.stringify(data.supplierPayments));
        saveTenantCollectionToFirestore(tId, 'supplier_payments', data.supplierPayments);
      }
      if (Array.isArray(data.servicePartnerPayments)) {
        setServicePartnerPayments(data.servicePartnerPayments);
        servicePartnerPaymentsRef.current = data.servicePartnerPayments;
        setAppStorageItem(`servicePartnerPayments_${tId}`, JSON.stringify(data.servicePartnerPayments));
        saveTenantCollectionToFirestore(tId, 'service_partner_payments', data.servicePartnerPayments);
      }
      if (Array.isArray(data.inventorySerials)) {
        setInventorySerials(data.inventorySerials);
        inventorySerialsRef.current = data.inventorySerials;
        setAppStorageItem(`inventorySerials_${tId}`, JSON.stringify(data.inventorySerials));
        saveTenantCollectionToFirestore(tId, 'inventory_serials', data.inventorySerials);
      }
      if (Array.isArray(data.inventoryTransactions)) {
        setInventoryTransactions(data.inventoryTransactions);
        inventoryTransactionsRef.current = data.inventoryTransactions;
        setAppStorageItem(`inventoryTransactions_${tId}`, JSON.stringify(data.inventoryTransactions));
        saveTenantCollectionToFirestore(tId, 'inventory_transactions', data.inventoryTransactions);
      }
      if (data.companyConfig) {
        setCompanyConfig(data.companyConfig);
        setAppStorageItem(`company_config_${tId}`, JSON.stringify(data.companyConfig));
        saveCompanyConfigToFirestore(tId, data.companyConfig);
      }

      // Keep persistence ref updated so this pull isn't mistakenly treated as a fresh local edit
      tenantCollectionPersistRef.current = JSON.stringify({
        clients: data.clients,
        ledger: data.ledger,
        jobs: data.jobs,
        payments: data.payments,
        invoices: data.invoices,
        products: data.products,
        expenses: data.expenses,
        users: data.users,
        logs: data.logs,
        categories: data.categories,
        racks: data.racks,
        equipments: data.equipments,
        problems: data.problems,
        suppliers: data.suppliers,
        servicePartners: data.servicePartners,
        purchases: data.purchases,
        purchaseOrders: data.purchaseOrders,
        purchaseReturns: data.purchaseReturns,
        supplierPayments: data.supplierPayments,
        servicePartnerPayments: data.servicePartnerPayments,
        inventorySerials: data.inventorySerials,
        inventoryTransactions: data.inventoryTransactions
      });

      const modTime = snapshot._fileMeta?.modifiedTime || snapshot.createdAt;
      if (modTime) {
        lastKnownDriveSnapshotTimeRef.current = modTime;
      }

      if (showNotification) {
        const msg = customMessage || `✓ Synchronized with Google Drive (${data.jobs?.length || 0} jobs, ${data.invoices?.length || 0} invoices)`;
        triggerSaveNotification(msg);
      }
      return true;
    } finally {
      setTimeout(() => {
        isApplyingSnapshotRef.current = false;
      }, 1500);
    }
  },
  []
);

  /**
   * Pull-First Push to Google Drive:
   * 1. Fetches current master snapshot from Google Drive to inspect other device changes.
   * 2. Zero-Data Safety Guard: If local device is empty (e.g. newly connected tablet),
   *    restores the cloud data instead of wiping it out.
   * 3. Merges cloud and local records using timestamp-aware union-by-id strategy.
   * 4. Uploads consolidated snapshot and updates active master (skipping if 0 data changes).
   */
  const handlePushSnapshotToDrive = React.useCallback(async (silent = false, force = false): Promise<any> => {
    if (!driveSyncStateRef.current.isConnected) {
      if (!silent) {
        triggerSaveNotification('⚠️ Google Drive is not connected.', true);
      }
      return null;
    }

    const tId = activeTenant?.id || 'org-admin';

    // Concurrency Guard: Pause pushes if this device is in Read-Only mode
    if (concurrencyStateRef.current?.isReadOnly) {
      if (!silent) {
        triggerSaveNotification('🛡️ Push paused: This device is in Read-Only mode to avoid data collisions.', true);
      }
      return null;
    }

    // Prevent re-entrant or colliding uploads
    if (isDriveOperationInProgressRef.current) {
      pendingAutoDriveSyncRef.current = true;
      return null;
    }

    isDriveOperationInProgressRef.current = true;

    try {
      const localPayload = {
        clients: clientsRef.current,
        ledger: ledgerRef.current,
        jobs: jobsRef.current,
        payments: paymentsRef.current,
        invoices: invoicesRef.current,
        products: productsRef.current,
        expenses: expensesRef.current,
        users: usersRef.current,
        logs: logsRef.current,
        categories: categoriesRef.current,
        racks: racksRef.current,
        equipments: equipmentsRef.current,
        problems: problemsRef.current,
        suppliers: suppliersRef.current,
        service_partners: servicePartnersRef.current,
        purchases: purchasesRef.current,
        purchase_orders: purchaseOrdersRef.current,
        purchase_returns: purchaseReturnsRef.current,
        supplier_payments: supplierPaymentsRef.current,
        service_partner_payments: servicePartnerPaymentsRef.current,
        inventory_serials: inventorySerialsRef.current,
        inventory_transactions: inventoryTransactionsRef.current,
        companyConfig
      };

      let payloadToUpload: any = localPayload;

      // 1. Pull-First Compare
      try {
        const latestCloud = await fetchLatestSnapshotFromDrive(tId);
        if (latestCloud) {
          const cloudNorm = normalizeSnapshotData(latestCloud);
          const localTotal = (localPayload.jobs?.length || 0) + (localPayload.clients?.length || 0) + (localPayload.invoices?.length || 0);
          const cloudTotal = (cloudNorm.jobs?.length || 0) + (cloudNorm.clients?.length || 0) + (cloudNorm.invoices?.length || 0);

          // Zero-Data Safety Guard: If local device is blank but cloud has data, restore cloud data first!
          if (localTotal === 0 && cloudTotal > 0) {
            console.info('[Google Drive] Zero-Data Protection: Restoring cloud data to empty local device.');
            await applySnapshotData(latestCloud, tId, !silent, '✓ Restored existing cloud records to this device.');
            return { success: true, zeroDataRestored: true };
          }

          // Bidirectional merge to protect both devices
          const { merged, changesFound } = mergeOrganizationData(latestCloud, localPayload);
          if (changesFound) {
            console.info('[Google Drive] Merged cloud and local datasets.');
            await applySnapshotData({ data: merged }, tId, false);
            payloadToUpload = {
              ...merged,
              companyConfig: merged.companyConfig || companyConfig
            };
          }
        }
      } catch (checkErr) {
        console.warn('[Google Drive] Pre-push cloud compare error, proceeding with local snapshot:', checkErr);
      }

      // 2. Upload consolidated snapshot (skips redundant network call if data payload hash matches)
      const res = await uploadSnapshotToDrive(tId, activeTenant?.name || activeCompany, payloadToUpload, { force });

      lastAutoDriveUploadTimeRef.current = Date.now();
      if (res?.timestamp) {
        lastKnownDriveSnapshotTimeRef.current = res.timestamp;
      }

      if (!silent) {
        if (res?.skipped) {
          triggerSaveNotification('✓ Cloud data is already up to date with Google Drive.');
        } else {
          triggerSaveNotification('✓ Cloud snapshot uploaded to Google Drive successfully!');
        }
      }

      return res;
    } finally {
      isDriveOperationInProgressRef.current = false;

      // Process pending mutations that arrived while uploading
      if (pendingAutoDriveSyncRef.current) {
        pendingAutoDriveSyncRef.current = false;
        if (autoDriveSyncTimerRef.current) clearTimeout(autoDriveSyncTimerRef.current);
        autoDriveSyncTimerRef.current = setTimeout(() => {
          handlePushSnapshotToDrive(true).catch(() => {});
        }, 5000);
      }
    }
  }, [activeTenant?.id, activeTenant?.name, activeCompany, triggerSaveNotification, companyConfig, applySnapshotData]);

  /**
   * Pulls latest active snapshot from Google Drive and restores to local device
   */
  const handlePullLatestSnapshotFromDrive = async (): Promise<boolean> => {
    const tId = activeTenant?.id || 'org-admin';
    const snapshot = await fetchLatestSnapshotFromDrive(tId);
    if (!snapshot) return false;

    return await applySnapshotData(snapshot, tId, true, '✓ Pulled and restored latest cloud data from Google Drive!');
  };

  /**
   * Restores a point-in-time snapshot by file ID from Google Drive
   */
  const handleRestoreSnapshotById = async (fileId: string): Promise<boolean> => {
    const tId = activeTenant?.id || 'org-admin';
    const snapshot = await downloadSnapshotFromDrive(fileId, tId);
    if (!snapshot) return false;

    return await applySnapshotData(snapshot, tId, true, '✓ Point-in-time snapshot restored from Google Drive!');
  };

  /**
   * Fast background check: compares latest Drive snapshot metadata and merges if newer records exist
   */
  const checkAndPullLatestFromDrive = React.useCallback(async (silent = true): Promise<boolean> => {
    if (!driveSyncStateRef.current.isConnected || !activeTenant?.id) return false;
    const tId = activeTenant.id;
    if (isDriveOperationInProgressRef.current) return false;

    try {
      const meta = await getLatestDriveSnapshotMeta(tId);
      if (!meta) return false;

      const isLocalEmpty = (jobsRef.current.length === 0 && clientsRef.current.length === 0);
      const isNewer = (!lastKnownDriveSnapshotTimeRef.current || meta.modifiedTime !== lastKnownDriveSnapshotTimeRef.current);

      // If data timestamp on Drive is already identical to what we know and local is not empty, skip downloading!
      if (!isNewer && !isLocalEmpty && silent) {
        return false;
      }

      // Mark this snapshot timestamp as checked immediately to prevent repeated downloads
      lastKnownDriveSnapshotTimeRef.current = meta.modifiedTime;

      // If a newer snapshot is found on Drive OR this device is currently blank (0 jobs, 0 clients like a newly opened tablet):
      if (isNewer || isLocalEmpty || !silent) {
        isDriveOperationInProgressRef.current = true;
        try {
          const snapshot = await fetchLatestSnapshotFromDrive(tId);
          if (snapshot) {
            const localPayload = {
              clients: clientsRef.current,
              ledger: ledgerRef.current,
              jobs: jobsRef.current,
              payments: paymentsRef.current,
              invoices: invoicesRef.current,
              products: productsRef.current,
              expenses: expensesRef.current,
              users: usersRef.current,
              logs: logsRef.current,
              categories: categoriesRef.current,
              racks: racksRef.current,
              equipments: equipmentsRef.current,
              problems: problemsRef.current,
              suppliers: suppliersRef.current,
              service_partners: servicePartnersRef.current,
              purchases: purchasesRef.current,
              purchase_orders: purchaseOrdersRef.current,
              purchase_returns: purchaseReturnsRef.current,
              supplier_payments: supplierPaymentsRef.current,
              service_partner_payments: servicePartnerPaymentsRef.current,
              inventory_serials: inventorySerialsRef.current,
              inventory_transactions: inventoryTransactionsRef.current,
              companyConfig
            };

            const { merged, changesFound, isCloudAuthoritative } = mergeOrganizationData(snapshot, localPayload);
            const shouldApply = changesFound || isCloudAuthoritative || (jobsRef.current.length === 0 && Array.isArray(snapshot?.data?.jobs || snapshot?.jobs));

            if (shouldApply) {
              await applySnapshotData(
                { data: merged, _fileMeta: meta || snapshot._fileMeta },
                tId,
                !silent,
                '✓ Synchronized latest records from Google Drive'
              );
              return true;
            } else if (!silent) {
              triggerSaveNotification('✓ Data is already up to date with Google Drive.');
            }
          }
        } finally {
          isDriveOperationInProgressRef.current = false;
        }
      }
    } catch (err) {
      console.warn('[Google Drive] Check and pull skipped:', err);
    }
    return false;
  }, [activeTenant?.id, applySnapshotData, companyConfig, triggerSaveNotification]);

  /**
   * Helper to schedule an immediate 5-second debounced sync upon any user mutation
   */
  const scheduleAutoDriveSyncDebounced = React.useCallback(() => {
    if (!driveSyncStateRef.current.isConnected || !activeTenant?.id) return;
    const tId = activeTenant.id;
    const isAutoSyncEnabled = localStorage.getItem(`inoms_auto_drive_sync_${tId}`) !== 'false';
    if (!isAutoSyncEnabled) return;

    if (autoDriveSyncTimerRef.current) clearTimeout(autoDriveSyncTimerRef.current);
    autoDriveSyncTimerRef.current = setTimeout(() => {
      // Respect an 8-second minimum gap between active uploads
      const now = Date.now();
      const elapsed = now - lastAutoDriveUploadTimeRef.current;
      if (elapsed < 8000) {
        if (autoDriveSyncTimerRef.current) clearTimeout(autoDriveSyncTimerRef.current);
        autoDriveSyncTimerRef.current = setTimeout(() => {
          handlePushSnapshotToDrive(true).catch(() => {});
        }, 8000 - elapsed);
        return;
      }
      handlePushSnapshotToDrive(true).catch(() => {});
    }, 5000);
  }, [activeTenant?.id, handlePushSnapshotToDrive]);

  // Real-time Server Health & Connection Indicator State (Green/Red dot)
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('online');
  const [isServerSaving, setIsServerSaving] = useState<boolean>(false);
  const [lastServerCheckTime, setLastServerCheckTime] = useState<string>('');

  // Flag to track whether there are uncommitted changes made while offline
  const hasUnsavedOfflineChangesRef = React.useRef<boolean>(false);
  const isSyncingToServerRef = React.useRef<boolean>(false);

  // Sync latest client state to the server (reconnect or manual retry)
  const syncOfflineChangesToServer = React.useCallback(async (reason = 'reconnect') => {
    if (!homeServerSyncEnabled || !isAuthenticated || !activeTenant?.id || isSyncingToServerRef.current) return;
    
    isSyncingToServerRef.current = true;
    setIsServerSaving(true);
    setIsSyncing(true);

    try {
      const bundle = {
        clients: clientsRef.current,
        ledger: ledgerRef.current,
        jobs: jobsRef.current,
        payments: paymentsRef.current,
        invoices: invoicesRef.current,
        products: productsRef.current,
        expenses: expensesRef.current,
        users: usersRef.current,
        logs: logsRef.current,
        categories: categoriesRef.current,
        racks: racksRef.current,
        equipments: equipmentsRef.current,
        problems: problemsRef.current,
        suppliers: suppliersRef.current,
        servicePartners: servicePartnersRef.current,
        purchases: purchasesRef.current,
        purchaseOrders: purchaseOrdersRef.current,
        purchaseReturns: purchaseReturnsRef.current,
        supplierPayments: supplierPaymentsRef.current,
        servicePartnerPayments: servicePartnerPaymentsRef.current,
        inventorySerials: inventorySerialsRef.current,
        inventoryTransactions: inventoryTransactionsRef.current
      };

      const saveRes = await saveAllTenantDataViaApi(activeTenant.id, companyConfig, bundle);
      // Flush pending indexedDB operations if any
      await pushPendingOperations(activeTenant.id).catch(() => {});

      if (saveRes?.success) {
        hasUnsavedOfflineChangesRef.current = false;
        setServerStatus('online');
        setIsSyncing(false);
        setJustSynced(true);
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        setLastSyncedAt(timeStr);
        setTimeout(() => setJustSynced(false), 2500);

        if (reason === 'reconnect' || reason === 'manual') {
          triggerSaveNotification('✓ Server Reconnected: All offline changes synced to server successfully!');
        }
      } else {
        hasUnsavedOfflineChangesRef.current = true;
        setServerStatus('offline');
      }
    } catch (err) {
      hasUnsavedOfflineChangesRef.current = true;
      setServerStatus('offline');
    } finally {
      setIsServerSaving(false);
      isSyncingToServerRef.current = false;
    }
  }, [homeServerSyncEnabled, isAuthenticated, activeTenant?.id, companyConfig]);

  const checkServerStatus = React.useCallback(async () => {
    if (!homeServerSyncEnabled) {
      setServerStatus('offline');
      setIsServerSaving(false);
      return false;
    }
    try {
      const health = await fetchServerHealth();
      const isOk = !!(health && (health.status === 'ok' || health.ok === true));
      
      setServerStatus(prevStatus => {
        if (isOk) {
          // If server was offline or has uncommitted offline changes, trigger immediate sync
          if (prevStatus === 'offline' || hasUnsavedOfflineChangesRef.current) {
            setTimeout(() => {
              syncOfflineChangesToServer('reconnect');
            }, 60);
          }
          return 'online';
        } else {
          return 'offline';
        }
      });

      const now = new Date();
      setLastServerCheckTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      return isOk;
    } catch (_) {
      setServerStatus('offline');
      return false;
    }
  }, [homeServerSyncEnabled, syncOfflineChangesToServer]);

  // Periodic Server Health Check every 60s (was 5s) + on window focus & online events (Active only when authenticated)
  React.useEffect(() => {
    if (!isAuthenticated || showAuthModal || !homeServerSyncEnabled) {
      setServerStatus('offline');
      setIsServerSaving(false);
      return;
    }
    checkServerStatus();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      checkServerStatus();
    }, 60000);

    const onFocus = () => checkServerStatus();
    const onOnline = () => checkServerStatus();
    const onOffline = () => setServerStatus('offline');

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [isAuthenticated, showAuthModal, homeServerSyncEnabled, checkServerStatus]);

  const handleAuthenticated = (tenant: TenantOrg, role: string, loggedInUser?: SystemUser) => {
    setSessionEvictionInfo(null);
    sessionGuard.resetEviction();
    setActiveTenant(tenant);
    setDriveActiveTenantId(tenant.id);
    setUserRole(role);
    setCurrentUser(loggedInUser || null);
    setIsAuthenticated(true);
    setShowAuthModal(false);
    setAppSessionItem('authenticated', 'true');
    setAppSessionItem('user_role', role);
    if (loggedInUser) {
      setAppSessionItem('current_user', JSON.stringify(loggedInUser));
    } else {
      removeAppSessionItem('current_user');
    }

    // Establish a Home Server session only for organisations with the add-on enabled.
    if (tenant.id === 'org-admin' || getTenantFeatures(tenant).allowHomeServerSync) {
      ensureTenantSessionViaApi(tenant.id, loggedInUser)
        .then(() => importBrowserTenantDataToServer(tenant.id))
        .catch(() => {});
    }

    if (role === 'Admin') {
      setActiveTab('master_admin');
    } else {
      setActiveTab('dashboard');
    }

    // Sync company config with authenticated tenant details safely without inheriting previous tenant's assets
    const tenantConfig = (() => {
      const saved = getAppStorageItem(`company_config_${tenant.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            if (tenant.id !== 'org-admin' && (parsed.name === 'Master System Admin' || parsed.phone === '+91 8149862034')) {
              return getDefaultCompanyConfig(tenant);
            }
            return {
              ...getDefaultCompanyConfig(tenant),
              ...parsed,
              name: parsed.name || tenant.name,
              phone: parsed.phone || tenant.ownerMobile
            };
          }
        } catch (e) {}
      }
      return getDefaultCompanyConfig(tenant);
    })();
    setCompanyConfig(tenantConfig);
    setAppStorageItem(`company_config_${tenant.id}`, JSON.stringify(tenantConfig));

    // Load state corresponding to this tenant with fallback and legacy data support
    const tId = tenant.id;
    setClients(getTenantData('clients', tId, INITIAL_CLIENTS));
    setJobs(getTenantData('jobs', tId, INITIAL_JOBS));
    setInvoices(getTenantData('invoices', tId, INITIAL_INVOICES));
    setProducts(getTenantData('products', tId, INITIAL_PRODUCTS));
    setLedger(getTenantData('ledger', tId, INITIAL_LEDGER));
    setPayments(getTenantData('payments', tId, INITIAL_PAYMENTS));
    setExpenses(getTenantData('expenses', tId, INITIAL_EXPENSES));
    setUsers(getTenantData('users', tId, INITIAL_USERS));
    setLogs(getTenantData('logs', tId, INITIAL_LOGS));
    setCategories(getTenantData('categories', tId, INITIAL_CATEGORIES));
    setRacks(getTenantData('racks', tId, INITIAL_RACKS));
    setEquipments(getTenantData('equipments', tId, EQUIPMENT_TYPES));
    setProblems(getTenantData('problems', tId, COMMON_PROBLEMS));
  };

  // System Announcements & Broadcast State
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(() => {
    try {
      const saved = getAppStorageItem('announcements_v2');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [
      {
        id: 'ann-1',
        title: 'Platform System Announcement',
        message: 'All registered organizations have active Microsoft Authenticator 2FA security enabled.',
        targetTenantId: 'all',
        createdAt: '2026-07-24 10:00',
        severity: 'info',
        createdBy: 'Master Admin'
      },
      {
        id: 'ann-2',
        title: 'Scheduled Cloud Backup',
        message: 'Automated nightly sync scheduled at 11:30 PM. Active sessions will remain uninterrupted.',
        targetTenantId: 'all',
        createdAt: '2026-07-23 18:00',
        severity: 'warning',
        createdBy: 'Master Admin'
      }
    ];
  });

  React.useEffect(() => {
    setAppStorageItem('announcements_v2', JSON.stringify(announcements));
  }, [announcements]);

  // Subscribe to real-time Cloud Firestore updates for System Announcements
  React.useEffect(() => {
    const unsubscribe = subscribeAnnouncements((cloudAnnouncements) => {
      if (Array.isArray(cloudAnnouncements) && cloudAnnouncements.length > 0) {
        setAnnouncements(cloudAnnouncements);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to real-time organization updates from Home Server / SQLite
  React.useEffect(() => {
    const unsubscribe = subscribeTenants((cloudTenants) => {
      if (Array.isArray(cloudTenants) && cloudTenants.length > 0) {
        const deletedIds = getDeletedTenantIds();
        const validTenants = cloudTenants.filter(t => t && t.id && !deletedIds.has(t.id) && t.id !== 'global_system_branding');
        setTenants(validTenants);
        setAppStorageItem('tenants_v3', JSON.stringify(validTenants));
        try { localStorage.setItem('tenants_v3', JSON.stringify(validTenants)); } catch (_) {}
        try { localStorage.setItem('inoms_tenants_v3', JSON.stringify(validTenants)); } catch (_) {}
      }
    });
    return () => unsubscribe();
  }, []);

  // Synchronize activeTenant with latest tenants list so subscription/plan/features updates propagate immediately
  React.useEffect(() => {
    if (!activeTenant?.id) return;
    const latest = tenants.find(t => t.id === activeTenant.id);
    if (latest) {
      if (
        latest.subscriptionEndDate !== activeTenant.subscriptionEndDate ||
        latest.subscriptionPlan !== activeTenant.subscriptionPlan ||
        latest.isTrial !== activeTenant.isTrial ||
        latest.trialDays !== activeTenant.trialDays ||
        latest.status !== activeTenant.status ||
        latest.name !== activeTenant.name ||
        latest.code !== activeTenant.code ||
        latest.ownerMobile !== activeTenant.ownerMobile ||
        latest.pin !== activeTenant.pin ||
        JSON.stringify(latest.features) !== JSON.stringify(activeTenant.features)
      ) {
        setActiveTenant(latest);
        setAppStorageItem('active_tenant_v3', JSON.stringify(latest));
      }
    }
  }, [tenants, activeTenant]);

  const handleRegisterOrg = async (newTenant: TenantOrg) => {
    // Immediately seed and store isolated company config for the new tenant
    const newOrgConfig = getDefaultCompanyConfig(newTenant);
    setAppStorageItem(`company_config_${newTenant.id}`, JSON.stringify(newOrgConfig));
    saveCompanyConfigToFirestore(newTenant.id, newOrgConfig);

    // Initialize clean, completely empty collections for the new tenant
    setAppStorageItem(`clients_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`jobs_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`invoices_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`payments_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`products_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`expenses_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`ledger_${newTenant.id}`, JSON.stringify([]));
    setAppStorageItem(`logs_${newTenant.id}`, JSON.stringify([]));

    let nextTenants: TenantOrg[] = [];
    setTenants(prev => {
      const exists = prev.some(t => t.id === newTenant.id);
      if (exists) {
        nextTenants = prev;
        return prev;
      }
      const next = [...prev, newTenant];
      nextTenants = next;
      setAppStorageItem('tenants_v3', JSON.stringify(next));
      return next;
    });

    if (nextTenants.length > 0) {
      broadcastTenantListUpdate(nextTenants);
    }
    await saveTenantToFirestore(newTenant);
  };

  const handleUpdateTenant = async (updatedTenant: TenantOrg) => {
    let effectiveTenant = { ...updatedTenant };
    if (effectiveTenant.status === 'active') {
      unmarkTenantDeletedInStorage(effectiveTenant.id);
      const subInfo = getSubscriptionTimeLeft(effectiveTenant);
      if (subInfo.isExpired) {
        const d = new Date();
        const days = effectiveTenant.subscriptionPlan === 'annual' ? 365
          : effectiveTenant.subscriptionPlan === 'quarterly' ? 90
          : (effectiveTenant.isTrial || effectiveTenant.subscriptionPlan === 'trial') ? (effectiveTenant.trialDays || 7)
          : 30;
        d.setDate(d.getDate() + days);
        effectiveTenant.subscriptionEndDate = d.toISOString().split('T')[0];
      }
    }

    let nextTenants: TenantOrg[] = [];
    setTenants(prev => {
      const next = prev.map(t => t.id === effectiveTenant.id ? effectiveTenant : t);
      nextTenants = next;
      const sanitized = sanitizeTenantsForStorage(next);
      const jsonStr = JSON.stringify(sanitized);
      setAppStorageItem('tenants_v3', jsonStr);
      try { localStorage.setItem('tenants_v3', jsonStr); } catch (_) {}
      try { localStorage.setItem('inoms_tenants_v3', jsonStr); } catch (_) {}
      return next;
    });

    if (activeTenant.id === effectiveTenant.id) {
      setActiveTenant(effectiveTenant);
      setCompanyConfig(prev => ({
        ...prev,
        name: effectiveTenant.name,
        phone: effectiveTenant.ownerMobile
      }));
    }

    if (nextTenants.length > 0) {
      broadcastTenantListUpdate(nextTenants);
    }
    await saveTenantToFirestore(effectiveTenant);
    triggerSaveNotification(`✓ Organization details for "${effectiveTenant.name}" updated successfully!`);
  };

  const handleToggleTenantStatus = async (tenantId: string) => {
    const targetOrg = tenants.find(t => t.id === tenantId);
    if (targetOrg && (targetOrg.id === 'org-admin' || targetOrg.code?.toUpperCase() === 'ADMIN-00' || targetOrg.ownerMobile?.includes('8149862034'))) {
      triggerSaveNotification('🛡️ Security Guard: Master System Admin Organization (+91 8149862034) can NEVER be deactivated.', true);
      return;
    }

    const nextStatus: 'active' | 'deactivated' = targetOrg?.status === 'active' ? 'deactivated' : 'active';
    let nextEndDate = targetOrg?.subscriptionEndDate;

    // If activating an expired or un-set account, guarantee it has an active subscription date in the future!
    if (nextStatus === 'active' && targetOrg) {
      unmarkTenantDeletedInStorage(tenantId);
      const subInfo = getSubscriptionTimeLeft(targetOrg);
      const isPastOrEmpty = !targetOrg.subscriptionEndDate || new Date(targetOrg.subscriptionEndDate).getTime() < Date.now();
      if (subInfo.isExpired || isPastOrEmpty) {
        const d = new Date();
        const days = targetOrg.subscriptionPlan === 'annual' ? 365
          : targetOrg.subscriptionPlan === 'quarterly' ? 90
          : (targetOrg.isTrial || targetOrg.subscriptionPlan === 'trial') ? (targetOrg.trialDays || 7)
          : 30;
        d.setDate(d.getDate() + days);
        nextEndDate = d.toISOString().split('T')[0];
      }
    }

    let updatedTenant: TenantOrg | null = null;
    setTenants(prev => {
      const next = prev.map(t => {
        if (t.id === tenantId) {
          updatedTenant = {
            ...t,
            status: nextStatus,
            subscriptionEndDate: nextEndDate || t.subscriptionEndDate
          };
          return updatedTenant;
        }
        return t;
      });
      const jsonStr = JSON.stringify(next);
      setAppStorageItem('tenants_v3', jsonStr);
      try { localStorage.setItem('tenants_v3', jsonStr); } catch (_) {}
      try { localStorage.setItem('inoms_tenants_v3', jsonStr); } catch (_) {}
      return next;
    });

    if (updatedTenant) {
      await saveTenantToFirestore(updatedTenant);
      const nextState = (updatedTenant as TenantOrg).status === 'active' ? 'ACTIVATED' : 'DEACTIVATED';
      triggerSaveNotification(`✓ Account "${(updatedTenant as TenantOrg).name}" (${(updatedTenant as TenantOrg).code}) access ${nextState}!`);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    const targetOrg = tenants.find(t => t.id === tenantId);
    if (targetOrg && (targetOrg.id === 'org-admin' || targetOrg.code?.toUpperCase() === 'ADMIN-00' || targetOrg.ownerMobile?.includes('8149862034'))) {
      triggerSaveNotification('🛡️ Security Guard: Master System Admin Organization (+91 8149862034) can NEVER be deleted.', true);
      return;
    }

    // 1. Immediately mark tombstone so background pollers/snapshot syncs ignore this tenant forever
    markTenantDeletedInStorage(tenantId);

    // 2. Immediately update local state and localStorage so UI updates with zero lag
    setTenants(prev => {
      const next = prev.filter(t => t.id !== tenantId);
      setAppStorageItem('tenants_v3', JSON.stringify(next));
      try { localStorage.setItem('tenants_v3', JSON.stringify(next)); } catch (_) {}
      try { localStorage.setItem('inoms_tenants_v3', JSON.stringify(next)); } catch (_) {}
      return next;
    });

    // 3. Remove all local storage cached collections for this tenant across legacy prefixes
    const collectionsToPurge = [
      'clients', 'jobs', 'invoices', 'products', 'ledger', 'payments',
      'expenses', 'users', 'categories', 'racks', 'equipments', 'problems',
      'company_config', 'config'
    ];
    collectionsToPurge.forEach(c => {
      removeAppStorageItem(`${c}_${tenantId}`);
      try { localStorage.removeItem(`${c}_${tenantId}`); } catch (_) {}
      try { localStorage.removeItem(`inoms_${c}_${tenantId}`); } catch (_) {}
      try { localStorage.removeItem(`repair_track_${c}_${tenantId}`); } catch (_) {}
      try { localStorage.removeItem(`nibban_${c}_${tenantId}`); } catch (_) {}
    });

    // 4. Delete on server and propagate to all subscribers
    try {
      await deleteTenantFromFirestore(tenantId);
    } catch (e: any) {
      console.warn('[Delete Tenant Error]:', e?.message || e);
    }

    triggerSaveNotification(`✓ Account "${targetOrg?.name || tenantId}" permanently deleted!`);
  };

  // AUTOMATIC SUBSCRIPTION EXPIRY ENFORCEMENT:
  // Automatically deactivates accounts whose trial or subscription validity period has expired
  React.useEffect(() => {
    let hasDeactivatedAny = false;
    setTenants(prev => {
      const next = prev.map(t => {
        if (t.id === 'org-admin' || t.code?.toUpperCase() === 'ADMIN-00' || t.ownerMobile?.includes('8149862034') || t.subscriptionPlan === 'lifetime') {
          return t;
        }
        if (t.status === 'active') {
          const subInfo = getSubscriptionTimeLeft(t);
          if (subInfo.isExpired) {
            hasDeactivatedAny = true;
            const deactivatedOrg: TenantOrg = {
              ...t,
              status: 'deactivated'
            };
            saveTenantToFirestore(deactivatedOrg);
            return deactivatedOrg;
          }
        }
        return t;
      });
      if (hasDeactivatedAny) {
        setAppStorageItem('tenants_v3', JSON.stringify(next));
      }
      return hasDeactivatedAny ? next : prev;
    });
  }, [tenants]);

  // ACTIVE SESSION SECURITY GUARD: Log out active user if non-admin organization is deactivated or deleted
  React.useEffect(() => {
    if (isAuthenticated && activeTenant) {
      const isAdminOrg = activeTenant.id === 'org-admin' || activeTenant.id === 'org-nibban' || activeTenant.code?.toUpperCase() === 'NIBBAN' || activeTenant.code?.toUpperCase() === 'ADMIN' || userRole === 'Admin' || userRole === 'Master Admin';
      if (isAdminOrg) {
        // Master Admin & Admin accounts are fully protected and never logged out or blocked
        return;
      }

      const currentOrg = tenants.find(t => t.id === activeTenant.id);
      if (!currentOrg) {
        alert(`🔒 ACCESS TERMINATED: Organization "${activeTenant.name}" has been deleted by the System Administrator.`);
        setIsAuthenticated(false);
        removeAppSessionItem('authenticated');
        setShowAuthModal(true);
      } else if (currentOrg.status === 'deactivated') {
        alert(`🔒 ACCOUNT DEACTIVATED: Organization "${activeTenant.name}" access has been deactivated by the System Administrator.`);
        setIsAuthenticated(false);
        removeAppSessionItem('authenticated');
        setShowAuthModal(true);
      }
    }
  }, [tenants, activeTenant, isAuthenticated, userRole]);

  // Master Admin SaaS Invoices & Add-on Pricing Configuration States
  const [initialSaasBillingTenantId, setInitialSaasBillingTenantId] = useState<string | null>(null);

  const [pricingConfig, setPricingConfig] = useState<AddonPricingConfig>(() => {
    try {
      const saved = getAppStorageItem('master_admin_addon_pricing_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ADDON_PRICING;
  });

  // Sync pricing config across browser tabs or when Master Admin saves new rates
  React.useEffect(() => {
    const handlePricingUpdate = () => {
      try {
        const saved = getAppStorageItem('master_admin_addon_pricing_v1');
        if (saved) setPricingConfig(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener('storage', handlePricingUpdate);
    window.addEventListener('master_pricing_updated', handlePricingUpdate);
    return () => {
      window.removeEventListener('storage', handlePricingUpdate);
      window.removeEventListener('master_pricing_updated', handlePricingUpdate);
    };
  }, []);

  const handleSavePricing = (newConfig: AddonPricingConfig) => {
    setPricingConfig(newConfig);
    try {
      setAppStorageItem('master_admin_addon_pricing_v1', JSON.stringify(newConfig));
    } catch {}
    triggerSaveNotification('✓ Add-on Pricing Matrix updated successfully!');
  };

  const [saasInvoices, setSaasInvoices] = useState<MasterAdminInvoice[]>(() => {
    try {
      const saved = getAppStorageItem('master_admin_saas_invoices_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'SAAS-1001',
        tenantId: 'org-1',
        tenantName: 'Dev Infotech',
        tenantCode: 'DEV-10',
        ownerMobile: '+91 9876543210',
        ownerName: 'Devendra Patel',
        date: '2026-07-01',
        dueDate: '2026-07-08',
        billingPeriod: 'Monthly',
        items: [
          { id: 'it-1', description: 'Core Enterprise ERP Platform License (Monthly)', addonKey: 'basePlatform', qty: 1, rate: 999, amount: 999 },
          { id: 'it-2', description: 'WhatsApp Automated Cloud Messaging Integration (1 Mo)', addonKey: 'whatsAppMessaging', qty: 1, rate: 499, amount: 499 },
          { id: 'it-3', description: 'Thermal Barcode & QR Code Tag Generation (1 Mo)', addonKey: 'barcodeQrTags', qty: 1, rate: 299, amount: 299 }
        ],
        subtotal: 1797,
        discount: 0,
        gstPercent: 18,
        gstAmount: 323,
        grandTotal: 2120,
        paymentStatus: 'Paid',
        paymentMode: 'UPI',
        notes: 'Monthly SaaS subscription active.',
        createdAt: '2026-07-01T10:00:00.000Z'
      }
    ];
  });

  const handleAddSaasInvoice = (inv: MasterAdminInvoice) => {
    const next = [inv, ...saasInvoices];
    setSaasInvoices(next);
    try {
      setAppStorageItem('master_admin_saas_invoices_v1', JSON.stringify(next));
    } catch {}
    triggerSaveNotification(`✓ SaaS Bill #${inv.id} generated for ${inv.tenantName}!`);
  };

  const handleUpdateSaasInvoice = (inv: MasterAdminInvoice) => {
    const next = saasInvoices.map(i => i.id === inv.id ? inv : i);
    setSaasInvoices(next);
    try {
      setAppStorageItem('master_admin_saas_invoices_v1', JSON.stringify(next));
    } catch {}
    triggerSaveNotification(`✓ SaaS Bill #${inv.id} updated successfully!`);
  };

  const handleDeleteSaasInvoice = (id: string) => {
    const next = saasInvoices.filter(i => i.id !== id);
    setSaasInvoices(next);
    try {
      setAppStorageItem('master_admin_saas_invoices_v1', JSON.stringify(next));
    } catch {}
    triggerSaveNotification(`✓ SaaS Bill #${id} deleted.`);
  };

  const handleSendAnnouncement = async (newAnn: Omit<SystemAnnouncement, 'id' | 'createdAt' | 'createdBy'>) => {
    const announcement: SystemAnnouncement = {
      id: `ann-${Date.now()}`,
      ...newAnn,
      createdAt: new Date().toLocaleString('en-GB', { hour12: false }),
      createdBy: 'Master Admin'
    };
    setAnnouncements(prev => {
      const next = [announcement, ...prev];
      setAppStorageItem('announcements_v3', JSON.stringify(next));
      return next;
    });
    await saveAnnouncementToFirestore(announcement);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setAnnouncements(prev => {
      const next = prev.filter(a => a.id !== id);
      setAppStorageItem('announcements_v3', JSON.stringify(next));
      return next;
    });
    await deleteAnnouncementFromFirestore(id);
  };

  const handleLockSession = () => {
    setIsAuthenticated(false);
    removeAppSessionItem('authenticated');
    setDriveActiveTenantId('');
    if (userRole === 'Admin' || activeTenant.id === 'org-admin') {
      try {
        localStorage.removeItem('remembered_login_mobile');
      } catch (e) {}
    }
    setShowAuthModal(true);
  };

  // Global Interactive React States with localStorage Persistence & Tenant Data Isolation
  const isDefaultActiveOrg = activeTenant.id === 'org-nibban';

  const getTenantData = <T,>(keySuffix: string, tenantId: string, fallback: T[]): T[] => {
    const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    const snakeKey = camelToSnake(keySuffix);
    let saved = getAppStorageItem(`${keySuffix}_${tenantId}`);
    if (!saved && snakeKey !== keySuffix) {
      saved = getAppStorageItem(`${snakeKey}_${tenantId}`);
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let items = parsed
            .filter((item: any) => !item.tenantId || item.tenantId === tenantId)
            .map((item: any) => ({ ...item, tenantId }));

          // Automatically purge legacy demo records so users start with a clean slate
          const LEGACY_DEMO_IDS = new Set([
            'c1', 'c2', 'c3', 'c4',
            'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7',
            'NTS/2026/100', 'NTS/2026/101',
            'p1', 'p2', 'p3', 'p4',
            'NTS/2026/BILL/457', 'INV-2026-4',
            'prod1', 'prod2',
            'u2',
            'log1', 'log2', 'log3', 'log4', 'log5',
            'sup-1', 'sup-2',
            'sp-1', 'sp-2',
            'PUR-2026-001',
            'PO-2026-001',
            'spay-1',
            'ser-1', 'ser-2',
            'itrx-1'
          ]);
          items = items.filter((item: any) => !LEGACY_DEMO_IDS.has(item.id));

          if (keySuffix === 'clients') {
            items = items.filter((c: any) => c.name !== 'Ashun Dada' && c.name !== 'gfgfgfg' && c.name !== 'fdfdfdf' && c.name !== 'test');
          }
          if (keySuffix === 'jobs') {
            items = items.filter((j: any) => j.clientName !== 'Ashun Dada' && j.clientName !== 'fdfdfdf');
          }
          if (keySuffix === 'suppliers') {
            items = items.filter((s: any) => !s.name?.includes('Supreme Chipset') && !s.name?.includes('Apex Displays'));
          }
          if (keySuffix === 'servicePartners' || keySuffix === 'service_partners') {
            items = items.filter((s: any) => !s.name?.includes('Apex Chipset') && !s.name?.includes('Precision Laser Screen'));
          }

          if (keySuffix === 'users') {
            items = items.filter((u: any) => u.name !== 'Jackie A' && u.email !== 'test@gmail.com');
            if (tenantId === 'org-admin') {
              const hasMasterAdmin = items.some((u: any) => u.mobile?.includes('8149862034') || u.username === 'scrova');
              if (!hasMasterAdmin && MASTER_ADMIN_USER) {
                items.unshift({ ...MASTER_ADMIN_USER, tenantId: 'org-admin' });
              }
            } else {
              items = items.filter((u: any) => !u.mobile?.includes('8149862034') && u.username !== 'scrova' && u.email !== 'admin@mastersystem.com' && u.name !== 'Master System Admin');
            }
          }
          return items;
        }
      } catch (e) {}
    }

    if (keySuffix === 'users') {
      if (tenantId === 'org-admin') {
        return [{ ...MASTER_ADMIN_USER, tenantId: 'org-admin' }] as unknown as T[];
      } else {
        return [] as unknown as T[];
      }
    }

    if (keySuffix === 'equipments') return EQUIPMENT_TYPES.map((item: any) => ({ ...item, tenantId })) as unknown as T[];
    if (keySuffix === 'problems') return COMMON_PROBLEMS.map((item: any) => ({ ...item, tenantId })) as unknown as T[];
    if (keySuffix === 'categories') return INITIAL_CATEGORIES.map((item: any) => ({ ...item, tenantId })) as unknown as T[];
    if (keySuffix === 'racks') return INITIAL_RACKS.map((item: any) => ({ ...item, tenantId })) as unknown as T[];

    // Default clean slate - all transactional and master entity collections start completely blank
    return [] as T[];
  };

  const [clients, setClients] = useState<Client[]>(() => getTenantData('clients', activeTenant.id, INITIAL_CLIENTS));
  const [ledger, setLedger] = useState(() => getTenantData('ledger', activeTenant.id, INITIAL_LEDGER));
  const [jobs, setJobs] = useState<RepairJob[]>(() => getTenantData('jobs', activeTenant.id, INITIAL_JOBS));
  const [payments, setPayments] = useState<Payment[]>(() => getTenantData('payments', activeTenant.id, INITIAL_PAYMENTS));
  const [invoices, setInvoices] = useState<Invoice[]>(() => getTenantData('invoices', activeTenant.id, INITIAL_INVOICES));
  const [products, setProducts] = useState<Product[]>(() => getTenantData('products', activeTenant.id, INITIAL_PRODUCTS));
  const [expenses, setExpenses] = useState<Expense[]>(() => getTenantData('expenses', activeTenant.id, INITIAL_EXPENSES));
  const [users, setUsers] = useState<SystemUser[]>(() => getTenantData('users', activeTenant.id, INITIAL_USERS));
  const [logs, setLogs] = useState<ActivityLog[]>(() => getTenantData('logs', activeTenant.id, INITIAL_LOGS));
  const [categories, setCategories] = useState<Category[]>(() => getTenantData('categories', activeTenant.id, INITIAL_CATEGORIES));
  const [racks, setRacks] = useState<LocationRack[]>(() => getTenantData('racks', activeTenant.id, INITIAL_RACKS));
  const [equipments, setEquipments] = useState<Equipment[]>(() => getTenantData('equipments', activeTenant.id, EQUIPMENT_TYPES));
  const [problems, setProblems] = useState<Problem[]>(() => getTenantData('problems', activeTenant.id, COMMON_PROBLEMS));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getTenantData('suppliers', activeTenant.id, INITIAL_SUPPLIERS));
  const [servicePartners, setServicePartners] = useState<ServicePartner[]>(() => getTenantData('servicePartners', activeTenant.id, INITIAL_SERVICE_PARTNERS));
  const [purchases, setPurchases] = useState<Purchase[]>(() => getTenantData('purchases', activeTenant.id, INITIAL_PURCHASES));
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getTenantData('purchaseOrders', activeTenant.id, INITIAL_PURCHASE_ORDERS));
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>(() => getTenantData('purchaseReturns', activeTenant.id, INITIAL_PURCHASE_RETURNS));
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(() => getTenantData('supplierPayments', activeTenant.id, INITIAL_SUPPLIER_PAYMENTS));
  const [servicePartnerPayments, setServicePartnerPayments] = useState<ServicePartnerPayment[]>(() => getTenantData('servicePartnerPayments', activeTenant.id, INITIAL_SERVICE_PARTNER_PAYMENTS));
  const [inventorySerials, setInventorySerials] = useState<InventorySerial[]>(() => getTenantData('inventorySerials', activeTenant.id, INITIAL_INVENTORY_SERIALS));
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(() => getTenantData('inventoryTransactions', activeTenant.id, INITIAL_INVENTORY_TRANSACTIONS));
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState<RepairJob | null>(null);

  // Synchronize state refs for safe access inside subscription callbacks
  const clientsRef = React.useRef(clients);
  const ledgerRef = React.useRef(ledger);
  const jobsRef = React.useRef(jobs);
  const paymentsRef = React.useRef(payments);
  const invoicesRef = React.useRef(invoices);
  const productsRef = React.useRef(products);
  const expensesRef = React.useRef(expenses);
  const usersRef = React.useRef(users);
  const logsRef = React.useRef(logs);
  const categoriesRef = React.useRef(categories);
  const racksRef = React.useRef(racks);
  const equipmentsRef = React.useRef(equipments);
  const problemsRef = React.useRef(problems);
  const suppliersRef = React.useRef(suppliers);
  const servicePartnersRef = React.useRef(servicePartners);
  const purchasesRef = React.useRef(purchases);
  const purchaseOrdersRef = React.useRef(purchaseOrders);
  const purchaseReturnsRef = React.useRef(purchaseReturns);
  const supplierPaymentsRef = React.useRef(supplierPayments);
  const servicePartnerPaymentsRef = React.useRef(servicePartnerPayments);
  const inventorySerialsRef = React.useRef(inventorySerials);
  const inventoryTransactionsRef = React.useRef(inventoryTransactions);

  React.useEffect(() => { clientsRef.current = clients; }, [clients]);
  React.useEffect(() => { ledgerRef.current = ledger; }, [ledger]);
  React.useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  React.useEffect(() => { paymentsRef.current = payments; }, [payments]);
  React.useEffect(() => { invoicesRef.current = invoices; }, [invoices]);
  React.useEffect(() => { productsRef.current = products; }, [products]);
  React.useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  React.useEffect(() => { usersRef.current = users; }, [users]);
  React.useEffect(() => { logsRef.current = logs; }, [logs]);
  React.useEffect(() => { categoriesRef.current = categories; }, [categories]);
  React.useEffect(() => { racksRef.current = racks; }, [racks]);
  React.useEffect(() => { equipmentsRef.current = equipments; }, [equipments]);
  React.useEffect(() => { problemsRef.current = problems; }, [problems]);
  React.useEffect(() => { suppliersRef.current = suppliers; }, [suppliers]);
  React.useEffect(() => { servicePartnersRef.current = servicePartners; }, [servicePartners]);
  React.useEffect(() => { purchasesRef.current = purchases; }, [purchases]);
  React.useEffect(() => { purchaseOrdersRef.current = purchaseOrders; }, [purchaseOrders]);
  React.useEffect(() => { purchaseReturnsRef.current = purchaseReturns; }, [purchaseReturns]);
  React.useEffect(() => { supplierPaymentsRef.current = supplierPayments; }, [supplierPayments]);
  React.useEffect(() => { servicePartnerPaymentsRef.current = servicePartnerPayments; }, [servicePartnerPayments]);
  React.useEffect(() => { inventorySerialsRef.current = inventorySerials; }, [inventorySerials]);
  React.useEffect(() => { inventoryTransactionsRef.current = inventoryTransactions; }, [inventoryTransactions]);

  // Track collections that have finished initial Cloud Firestore sync to ensure Cloud as Absolute Master
  const hasLoadedCloudRef = React.useRef<Set<string>>(new Set());

  const [pendingQueueCount, setPendingQueueCount] = useState<number>(() => getPendingQueueCount());
  const [isQuotaExhaustedState, setIsQuotaExhaustedState] = useState<boolean>(() => isQuotaExhausted());
  const [isSyncRetrying, setIsSyncRetrying] = useState<boolean>(false);
  const [isOfflineBannerDismissed, setIsOfflineBannerDismissed] = useState<boolean>(false);

  React.useEffect(() => {
    const handleQueueChange = () => {
      setPendingQueueCount(getPendingQueueCount());
      setIsQuotaExhaustedState(isQuotaExhausted());
    };
    window.addEventListener('inoms_sync_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('inoms_sync_queue_changed', handleQueueChange);
    };
  }, []);

  // Unique active session ID for single active device restriction per user account
  const [currentSessionId] = useState<string>(() => {
    let id = getAppSessionItem('active_device_session_id');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setAppSessionItem('active_device_session_id', id);
    }
    return id;
  });

  const handleCloudCollectionUpdate = <T,>(colName: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    return (items: T[]) => {
      hasLoadedCloudRef.current.add(colName);
      setter(prev => {
        if (!items || prev === items) return prev;
        if (prev && prev.length === items.length) {
          let isSame = true;
          for (let i = 0; i < prev.length; i++) {
            const p = prev[i] as any;
            const it = items[i] as any;
            if (p?.id !== it?.id || p?.version !== it?.version || p?.updatedAt !== it?.updatedAt) {
              isSame = false;
              break;
            }
          }
          if (isSame) return prev;
        }
        return items;
      });
    };
  };

  // Re-sync states whenever active tenant changes to strictly isolate organization data
  React.useEffect(() => {
    if (!activeTenant?.id) return;
    const tId = activeTenant.id;
    setClients(getTenantData('clients', tId, INITIAL_CLIENTS));
    setJobs(getTenantData('jobs', tId, INITIAL_JOBS));
    setInvoices(getTenantData('invoices', tId, INITIAL_INVOICES));
    setProducts(getTenantData('products', tId, INITIAL_PRODUCTS));
    setLedger(getTenantData('ledger', tId, INITIAL_LEDGER));
    setPayments(getTenantData('payments', tId, INITIAL_PAYMENTS));
    setExpenses(getTenantData('expenses', tId, INITIAL_EXPENSES));
    setUsers(getTenantData('users', tId, INITIAL_USERS));
    setLogs(getTenantData('logs', tId, INITIAL_LOGS));
    setCategories(getTenantData('categories', tId, INITIAL_CATEGORIES));
    setRacks(getTenantData('racks', tId, INITIAL_RACKS));
    setEquipments(getTenantData('equipments', tId, EQUIPMENT_TYPES));
    setProblems(getTenantData('problems', tId, COMMON_PROBLEMS));
    setSuppliers(getTenantData('suppliers', tId, INITIAL_SUPPLIERS));
    setServicePartners(getTenantData('servicePartners', tId, INITIAL_SERVICE_PARTNERS));
    setPurchases(getTenantData('purchases', tId, INITIAL_PURCHASES));
    setPurchaseOrders(getTenantData('purchaseOrders', tId, INITIAL_PURCHASE_ORDERS));
    setPurchaseReturns(getTenantData('purchaseReturns', tId, INITIAL_PURCHASE_RETURNS));
    setSupplierPayments(getTenantData('supplierPayments', tId, INITIAL_SUPPLIER_PAYMENTS));
    setServicePartnerPayments(getTenantData('servicePartnerPayments', tId, INITIAL_SERVICE_PARTNER_PAYMENTS));
    setInventorySerials(getTenantData('inventorySerials', tId, INITIAL_INVENTORY_SERIALS));
    setInventoryTransactions(getTenantData('inventoryTransactions', tId, INITIAL_INVENTORY_TRANSACTIONS));
  }, [activeTenant?.id]);

  // Single Active Device / Session Enforcement per User Account via Home Server
  React.useEffect(() => {
    if (!isAuthenticated || !activeTenant?.id) return;

    const sessionUserId = currentUser?.id 
      ? `user_${currentUser.id}`
      : currentUser?.username 
        ? `user_${currentUser.username.toLowerCase()}`
        : 'org_owner';

    const sessionStorageKey = `active_session_${activeTenant.id}_${sessionUserId}`;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser';

    // Claim active session locally in localStorage
    setAppStorageItem(sessionStorageKey, currentSessionId);

    // Register active device session on Home Server & Firestore
    registerHomeServerSession(activeTenant.id, sessionUserId, currentSessionId, userAgent);
    saveUserSessionToFirestore(activeTenant.id, sessionUserId, currentSessionId);

    const handleDisplacement = (newDeviceName?: string) => {
      triggerSaveNotification(`⚠️ Account was signed in on another device/window${newDeviceName ? ` (${newDeviceName})` : ''}. Signed out.`, true);
      setTimeout(() => {
        setIsAuthenticated(false);
        setShowAuthModal(true);
        removeAppSessionItem('authenticated');
        removeAppSessionItem('current_user');
      }, 1500);
    };

    // 1. Setup Local BroadcastChannel for instant same-browser multi-tab displacement
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('inoms_session_channel');
        
        // Claim session on channel
        bc.postMessage({
          type: 'CLAIM_SESSION',
          tenantId: activeTenant.id,
          sessionUserId,
          sessionId: currentSessionId
        });

        bc.onmessage = (event) => {
          const data = event.data;
          if (
            data &&
            data.tenantId === activeTenant.id &&
            data.sessionUserId === sessionUserId &&
            data.sessionId !== currentSessionId
          ) {
            if (data.type === 'CLAIM_SESSION') {
              handleDisplacement('New Tab/Window Login');
            }
          }
        };
      }
    } catch (err) {
      console.warn('BroadcastChannel session setup notice:', err);
    }

    // 2. Setup Storage Event Listener for multi-window / tab takeover
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `app_storage_${sessionStorageKey}` || e.key === sessionStorageKey) {
        if (e.newValue && e.newValue !== currentSessionId) {
          handleDisplacement('Another Window/Tab');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Periodic Home Server check to log out older remote sessions if a newer session claimed ownership
    const sessionPollTimer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const status = await checkHomeServerSession(activeTenant.id, sessionUserId);
      if (status && status.activeSessionId && status.activeSessionId !== currentSessionId) {
        handleDisplacement(status.deviceInfo || 'Remote Device');
      }
    }, 45000);

    return () => {
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(sessionPollTimer);
    };
  }, [isAuthenticated, activeTenant?.id, currentUser?.id, currentUser?.username, currentSessionId]);

  // Subscribe to real-time Cloud Firestore updates for active Tenant Organization (Only when authenticated)
  React.useEffect(() => {
    if (!isAuthenticated || showAuthModal || !activeTenant?.id) return;
    const tId = activeTenant.id;

    // Reset cloud loaded tracker when active tenant changes
    hasLoadedCloudRef.current = new Set();

    // Trigger spinning rotation animation during initial Cloud Firestore sync
    setIsSyncing(true);
    const syncTimer = setTimeout(() => {
      setIsSyncing(false);
    }, 1500);

    // Real-time Cloud Company Config sync across all devices
    const unSubConfig = subscribeCompanyConfig(tId, (cloudConfig) => {
      if (cloudConfig) {
        setCompanyConfig(prev => ({ ...prev, ...cloudConfig }));
      }
    });

    // Real-time Cloud Global Branding sync across all devices for logo & titles
    const unSubGlobalBranding = subscribeCompanyConfig('global_system_branding', (globalConfig) => {
      if (globalConfig) {
        setCompanyConfig(prev => ({
          ...prev,
          appName: globalConfig.appName || prev.appName,
          appTagline: globalConfig.appTagline || prev.appTagline,
          appLogoUrl: globalConfig.appLogoUrl || prev.appLogoUrl
        }));
      }
    });

    // Real-time Cloud Collections sync across all devices (Cloud as Absolute Master)
    const unSubClients = subscribeTenantCollection<Client>(tId, 'clients', handleCloudCollectionUpdate('clients', setClients), () => clientsRef.current);
    const unSubLedger = subscribeTenantCollection<ClientLedgerEntry>(tId, 'ledger', handleCloudCollectionUpdate('ledger', setLedger), () => ledgerRef.current);
    const unSubJobs = subscribeTenantCollection<RepairJob>(tId, 'jobs', handleCloudCollectionUpdate('jobs', setJobs), () => jobsRef.current);
    const unSubPayments = subscribeTenantCollection<Payment>(tId, 'payments', handleCloudCollectionUpdate('payments', setPayments), () => paymentsRef.current);
    const unSubInvoices = subscribeTenantCollection<Invoice>(tId, 'invoices', handleCloudCollectionUpdate('invoices', setInvoices), () => invoicesRef.current);
    const unSubProducts = subscribeTenantCollection<Product>(tId, 'products', handleCloudCollectionUpdate('products', setProducts), () => productsRef.current);
    const unSubExpenses = subscribeTenantCollection<Expense>(tId, 'expenses', handleCloudCollectionUpdate('expenses', setExpenses), () => expensesRef.current);
    const unSubUsers = subscribeTenantCollection<SystemUser>(tId, 'users', handleCloudCollectionUpdate('users', setUsers), () => usersRef.current);
    const unSubLogs = subscribeTenantCollection<ActivityLog>(tId, 'logs', handleCloudCollectionUpdate('logs', setLogs), () => logsRef.current);
    const unSubCategories = subscribeTenantCollection<Category>(tId, 'categories', handleCloudCollectionUpdate('categories', setCategories), () => categoriesRef.current);
    const unSubRacks = subscribeTenantCollection<LocationRack>(tId, 'racks', handleCloudCollectionUpdate('racks', setRacks), () => racksRef.current);
    const unSubEquipments = subscribeTenantCollection<Equipment>(tId, 'equipments', handleCloudCollectionUpdate('equipments', setEquipments), () => equipmentsRef.current);
    const unSubProblems = subscribeTenantCollection<Problem>(tId, 'problems', handleCloudCollectionUpdate('problems', setProblems), () => problemsRef.current);
    const unSubSuppliers = subscribeTenantCollection<Supplier>(tId, 'suppliers', handleCloudCollectionUpdate('suppliers', setSuppliers), () => suppliersRef.current);
    const unSubServicePartners = subscribeTenantCollection<ServicePartner>(tId, 'service_partners', handleCloudCollectionUpdate('service_partners', setServicePartners), () => servicePartnersRef.current);
    const unSubPurchases = subscribeTenantCollection<Purchase>(tId, 'purchases', handleCloudCollectionUpdate('purchases', setPurchases), () => purchasesRef.current);
    const unSubPurchaseOrders = subscribeTenantCollection<PurchaseOrder>(tId, 'purchase_orders', handleCloudCollectionUpdate('purchase_orders', setPurchaseOrders), () => purchaseOrdersRef.current);
    const unSubPurchaseReturns = subscribeTenantCollection<PurchaseReturn>(tId, 'purchase_returns', handleCloudCollectionUpdate('purchase_returns', setPurchaseReturns), () => purchaseReturnsRef.current);
    const unSubSupplierPayments = subscribeTenantCollection<SupplierPayment>(tId, 'supplier_payments', handleCloudCollectionUpdate('supplier_payments', setSupplierPayments), () => supplierPaymentsRef.current);
    const unSubServicePartnerPayments = subscribeTenantCollection<ServicePartnerPayment>(tId, 'service_partner_payments', handleCloudCollectionUpdate('service_partner_payments', setServicePartnerPayments), () => servicePartnerPaymentsRef.current);
    const unSubInventorySerials = subscribeTenantCollection<InventorySerial>(tId, 'inventory_serials', handleCloudCollectionUpdate('inventory_serials', setInventorySerials), () => inventorySerialsRef.current);
    const unSubInventoryTransactions = subscribeTenantCollection<InventoryTransaction>(tId, 'inventory_transactions', handleCloudCollectionUpdate('inventory_transactions', setInventoryTransactions), () => inventoryTransactionsRef.current);

    // 1. Initial authoritative bootstrap and a single lightweight delta pull per tenant session.
    const bootstrapPromise = homeServerSyncEnabled
      ? bootstrapTenantFromHomeServer(tId)
      : Promise.resolve(null);
    bootstrapPromise
      .then(bData => {
        if (bData && bData.collections) {
          const col = bData.collections;
          if (Array.isArray(col.clients)) { setClients(col.clients); clientsRef.current = col.clients; setAppStorageItem(`clients_${tId}`, JSON.stringify(col.clients)); }
          if (Array.isArray(col.jobs)) { const sorted = sortJobsByLatest(col.jobs); setJobs(sorted); jobsRef.current = sorted; setAppStorageItem(`jobs_${tId}`, JSON.stringify(sorted)); }
          if (Array.isArray(col.invoices)) { setInvoices(col.invoices); invoicesRef.current = col.invoices; setAppStorageItem(`invoices_${tId}`, JSON.stringify(col.invoices)); }
          if (Array.isArray(col.payments)) { setPayments(col.payments); paymentsRef.current = col.payments; setAppStorageItem(`payments_${tId}`, JSON.stringify(col.payments)); }
          if (Array.isArray(col.products)) { setProducts(col.products); productsRef.current = col.products; setAppStorageItem(`products_${tId}`, JSON.stringify(col.products)); }
          if (Array.isArray(col.expenses)) { setExpenses(col.expenses); expensesRef.current = col.expenses; setAppStorageItem(`expenses_${tId}`, JSON.stringify(col.expenses)); }
          if (Array.isArray(col.ledger)) { setLedger(col.ledger); ledgerRef.current = col.ledger; setAppStorageItem(`ledger_${tId}`, JSON.stringify(col.ledger)); }
          if (Array.isArray(col.users) && col.users.length > 0) { setUsers(col.users); usersRef.current = col.users; setAppStorageItem(`users_${tId}`, JSON.stringify(col.users)); }
          if (Array.isArray(col.categories)) { setCategories(col.categories); categoriesRef.current = col.categories; setAppStorageItem(`categories_${tId}`, JSON.stringify(col.categories)); }
          if (Array.isArray(col.racks)) { setRacks(col.racks); racksRef.current = col.racks; setAppStorageItem(`racks_${tId}`, JSON.stringify(col.racks)); }
          if (Array.isArray(col.equipments)) { setEquipments(col.equipments); equipmentsRef.current = col.equipments; setAppStorageItem(`equipments_${tId}`, JSON.stringify(col.equipments)); }
          if (Array.isArray(col.problems)) { setProblems(col.problems); problemsRef.current = col.problems; setAppStorageItem(`problems_${tId}`, JSON.stringify(col.problems)); }
          if (Array.isArray(col.suppliers)) { setSuppliers(col.suppliers); suppliersRef.current = col.suppliers; setAppStorageItem(`suppliers_${tId}`, JSON.stringify(col.suppliers)); }
          if (Array.isArray(col.servicePartners)) { setServicePartners(col.servicePartners); servicePartnersRef.current = col.servicePartners; setAppStorageItem(`servicePartners_${tId}`, JSON.stringify(col.servicePartners)); }
          if (Array.isArray(col.purchases)) { setPurchases(col.purchases); purchasesRef.current = col.purchases; setAppStorageItem(`purchases_${tId}`, JSON.stringify(col.purchases)); }
          if (Array.isArray(col.purchaseOrders)) { setPurchaseOrders(col.purchaseOrders); purchaseOrdersRef.current = col.purchaseOrders; setAppStorageItem(`purchaseOrders_${tId}`, JSON.stringify(col.purchaseOrders)); }
          if (Array.isArray(col.purchaseReturns)) { setPurchaseReturns(col.purchaseReturns); purchaseReturnsRef.current = col.purchaseReturns; setAppStorageItem(`purchaseReturns_${tId}`, JSON.stringify(col.purchaseReturns)); }
          if (Array.isArray(col.supplierPayments)) { setSupplierPayments(col.supplierPayments); supplierPaymentsRef.current = col.supplierPayments; setAppStorageItem(`supplierPayments_${tId}`, JSON.stringify(col.supplierPayments)); }
          if (Array.isArray(col.servicePartnerPayments)) { setServicePartnerPayments(col.servicePartnerPayments); servicePartnerPaymentsRef.current = col.servicePartnerPayments; setAppStorageItem(`servicePartnerPayments_${tId}`, JSON.stringify(col.servicePartnerPayments)); }
          if (Array.isArray(col.inventorySerials)) { setInventorySerials(col.inventorySerials); inventorySerialsRef.current = col.inventorySerials; setAppStorageItem(`inventorySerials_${tId}`, JSON.stringify(col.inventorySerials)); }
          if (Array.isArray(col.inventoryTransactions)) { setInventoryTransactions(col.inventoryTransactions); inventoryTransactionsRef.current = col.inventoryTransactions; setAppStorageItem(`inventoryTransactions_${tId}`, JSON.stringify(col.inventoryTransactions)); }
          if (bData.companyConfig) {
            setCompanyConfig(prev => ({ ...prev, ...bData.companyConfig }));
            setAppStorageItem(`company_config_${tId}`, JSON.stringify(bData.companyConfig));
          }
        }
      })
      .catch(err => {
        console.info('Home Server bootstrap info:', err?.message || err);
      });

    // 2. Real-time Reactive LocalDb state synchronization (Updates React state on any delta pull)
    const unSubLocalDb = subscribeLocalDb((tenantId, entity, data) => {
      if (tenantId !== tId || !Array.isArray(data)) return;
      switch (entity) {
        case 'clients': setClients(data); clientsRef.current = data; setAppStorageItem(`clients_${tId}`, JSON.stringify(data)); break;
        case 'jobs': { const s = sortJobsByLatest(data); setJobs(s); jobsRef.current = s; setAppStorageItem(`jobs_${tId}`, JSON.stringify(s)); break; }
        case 'invoices': setInvoices(data); invoicesRef.current = data; setAppStorageItem(`invoices_${tId}`, JSON.stringify(data)); break;
        case 'payments': setPayments(data); paymentsRef.current = data; setAppStorageItem(`payments_${tId}`, JSON.stringify(data)); break;
        case 'products': setProducts(data); productsRef.current = data; setAppStorageItem(`products_${tId}`, JSON.stringify(data)); break;
        case 'expenses': setExpenses(data); expensesRef.current = data; setAppStorageItem(`expenses_${tId}`, JSON.stringify(data)); break;
        case 'ledger': setLedger(data); ledgerRef.current = data; setAppStorageItem(`ledger_${tId}`, JSON.stringify(data)); break;
        case 'users': if (data.length > 0) { setUsers(data); usersRef.current = data; setAppStorageItem(`users_${tId}`, JSON.stringify(data)); } break;
        case 'categories': setCategories(data); categoriesRef.current = data; setAppStorageItem(`categories_${tId}`, JSON.stringify(data)); break;
        case 'racks': setRacks(data); racksRef.current = data; setAppStorageItem(`racks_${tId}`, JSON.stringify(data)); break;
        case 'equipments': setEquipments(data); equipmentsRef.current = data; setAppStorageItem(`equipments_${tId}`, JSON.stringify(data)); break;
        case 'problems': setProblems(data); problemsRef.current = data; setAppStorageItem(`problems_${tId}`, JSON.stringify(data)); break;
        case 'suppliers': setSuppliers(data); suppliersRef.current = data; setAppStorageItem(`suppliers_${tId}`, JSON.stringify(data)); break;
        case 'servicePartners': case 'service_partners': setServicePartners(data); servicePartnersRef.current = data; setAppStorageItem(`servicePartners_${tId}`, JSON.stringify(data)); break;
        case 'purchases': setPurchases(data); purchasesRef.current = data; setAppStorageItem(`purchases_${tId}`, JSON.stringify(data)); break;
        case 'purchaseOrders': case 'purchase_orders': setPurchaseOrders(data); purchaseOrdersRef.current = data; setAppStorageItem(`purchaseOrders_${tId}`, JSON.stringify(data)); break;
        case 'purchaseReturns': case 'purchase_returns': setPurchaseReturns(data); purchaseReturnsRef.current = data; setAppStorageItem(`purchaseReturns_${tId}`, JSON.stringify(data)); break;
        case 'supplierPayments': case 'supplier_payments': setSupplierPayments(data); supplierPaymentsRef.current = data; setAppStorageItem(`supplierPayments_${tId}`, JSON.stringify(data)); break;
        case 'servicePartnerPayments': case 'service_partner_payments': setServicePartnerPayments(data); servicePartnerPaymentsRef.current = data; setAppStorageItem(`servicePartnerPayments_${tId}`, JSON.stringify(data)); break;
        case 'inventorySerials': case 'inventory_serials': setInventorySerials(data); inventorySerialsRef.current = data; setAppStorageItem(`inventorySerials_${tId}`, JSON.stringify(data)); break;
        case 'inventoryTransactions': case 'inventory_transactions': setInventoryTransactions(data); inventoryTransactionsRef.current = data; setAppStorageItem(`inventoryTransactions_${tId}`, JSON.stringify(data)); break;
      }
    });

    // 3. Real-time Cross-Tab Broadcast Channel (Instant 0ms multi-tab sync without page refresh)
    const unSubBroadcast = subscribeSyncBroadcast((msg) => {
      if (msg.tenantId !== tId) return;
      if (msg.entity && Array.isArray(msg.items)) {
        switch (msg.entity) {
          case 'clients': setClients(msg.items); clientsRef.current = msg.items; setAppStorageItem(`clients_${tId}`, JSON.stringify(msg.items)); break;
          case 'jobs': { const s = sortJobsByLatest(msg.items); setJobs(s); jobsRef.current = s; setAppStorageItem(`jobs_${tId}`, JSON.stringify(s)); break; }
          case 'invoices': setInvoices(msg.items); invoicesRef.current = msg.items; setAppStorageItem(`invoices_${tId}`, JSON.stringify(msg.items)); break;
          case 'payments': setPayments(msg.items); paymentsRef.current = msg.items; setAppStorageItem(`payments_${tId}`, JSON.stringify(msg.items)); break;
          case 'products': setProducts(msg.items); productsRef.current = msg.items; setAppStorageItem(`products_${tId}`, JSON.stringify(msg.items)); break;
          case 'expenses': setExpenses(msg.items); expensesRef.current = msg.items; setAppStorageItem(`expenses_${tId}`, JSON.stringify(msg.items)); break;
          case 'ledger': setLedger(msg.items); ledgerRef.current = msg.items; setAppStorageItem(`ledger_${tId}`, JSON.stringify(msg.items)); break;
          case 'users': if (msg.items.length > 0) { setUsers(msg.items); usersRef.current = msg.items; setAppStorageItem(`users_${tId}`, JSON.stringify(msg.items)); } break;
          case 'categories': setCategories(msg.items); categoriesRef.current = msg.items; setAppStorageItem(`categories_${tId}`, JSON.stringify(msg.items)); break;
          case 'racks': setRacks(msg.items); racksRef.current = msg.items; setAppStorageItem(`racks_${tId}`, JSON.stringify(msg.items)); break;
          case 'equipments': setEquipments(msg.items); equipmentsRef.current = msg.items; setAppStorageItem(`equipments_${tId}`, JSON.stringify(msg.items)); break;
          case 'problems': setProblems(msg.items); problemsRef.current = msg.items; setAppStorageItem(`problems_${tId}`, JSON.stringify(msg.items)); break;
          case 'suppliers': setSuppliers(msg.items); suppliersRef.current = msg.items; setAppStorageItem(`suppliers_${tId}`, JSON.stringify(msg.items)); break;
          case 'servicePartners': case 'service_partners': setServicePartners(msg.items); servicePartnersRef.current = msg.items; setAppStorageItem(`servicePartners_${tId}`, JSON.stringify(msg.items)); break;
          case 'purchases': setPurchases(msg.items); purchasesRef.current = msg.items; setAppStorageItem(`purchases_${tId}`, JSON.stringify(msg.items)); break;
          case 'purchaseOrders': case 'purchase_orders': setPurchaseOrders(msg.items); purchaseOrdersRef.current = msg.items; setAppStorageItem(`purchaseOrders_${tId}`, JSON.stringify(msg.items)); break;
          case 'purchaseReturns': case 'purchase_returns': setPurchaseReturns(msg.items); purchaseReturnsRef.current = msg.items; setAppStorageItem(`purchaseReturns_${tId}`, JSON.stringify(msg.items)); break;
          case 'supplierPayments': case 'supplier_payments': setSupplierPayments(msg.items); supplierPaymentsRef.current = msg.items; setAppStorageItem(`supplierPayments_${tId}`, JSON.stringify(msg.items)); break;
          case 'servicePartnerPayments': case 'service_partner_payments': setServicePartnerPayments(msg.items); servicePartnerPaymentsRef.current = msg.items; setAppStorageItem(`servicePartnerPayments_${tId}`, JSON.stringify(msg.items)); break;
          case 'inventorySerials': case 'inventory_serials': setInventorySerials(msg.items); inventorySerialsRef.current = msg.items; setAppStorageItem(`inventorySerials_${tId}`, JSON.stringify(msg.items)); break;
          case 'inventoryTransactions': case 'inventory_transactions': setInventoryTransactions(msg.items); inventoryTransactionsRef.current = msg.items; setAppStorageItem(`inventoryTransactions_${tId}`, JSON.stringify(msg.items)); break;
        }
      }
      if (msg.config) {
        setCompanyConfig(prev => ({ ...prev, ...msg.config }));
        setAppStorageItem(`company_config_${tId}`, JSON.stringify(msg.config));
      }
    });

    // 4. Lightweight Cross-Device Live Polling (Checks server revision periodically & on tab focus)
    const unSubLivePolling = homeServerSyncEnabled
      ? startLiveSyncPolling(tId, async () => {
          try {
            await pullDeltaFromHomeServer(tId);
          } catch (_) {}
        }, 30000)
      : () => {};

    const handleOnline = () => {
      if (!homeServerSyncEnabled || !navigator.onLine || !getAuthToken()) return;
      // Push local-first changes before pulling remote state so reconnect cannot
      // replace offline edits with an older server snapshot.
      pushPendingOperations(tId)
        .then(() => pullDeltaFromHomeServer(tId))
        .catch(() => {});
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(syncTimer);
      unSubLocalDb();
      unSubBroadcast();
      unSubLivePolling();
      window.removeEventListener('online', handleOnline);
      unSubConfig();
      unSubGlobalBranding();
      unSubClients();
      unSubLedger();
      unSubJobs();
      unSubPayments();
      unSubInvoices();
      unSubProducts();
      unSubExpenses();
      unSubUsers();
      unSubLogs();
      unSubCategories();
      unSubRacks();
      unSubEquipments();
      unSubProblems();
      unSubSuppliers();
      unSubServicePartners();
      unSubPurchases();
      unSubPurchaseOrders();
      unSubPurchaseReturns();
      unSubSupplierPayments();
      unSubServicePartnerPayments();
      unSubInventorySerials();
      unSubInventoryTransactions();
    };
  }, [isAuthenticated, showAuthModal, activeTenant?.id, homeServerSyncEnabled]);

  // Cross navigation states for clickable Job ID and Invoice links
  const [initialJobIdToView, setInitialJobIdToView] = useState<string | null>(null);
  const [initialInvoiceIdToView, setInitialInvoiceIdToView] = useState<string | null>(null);
  const [initialOpenAddInwardModal, setInitialOpenAddInwardModal] = useState<boolean>(false);

  const handleNavigateToJob = (jobId: string) => {
    const match = jobs.find(j => j.id === jobId || j.id.includes(jobId));
    if (match && (match.status === 'Product Out' || match.status === 'Outwarded')) {
      setActiveTab('outwards');
    } else {
      setActiveTab('inwards');
    }
    setInitialJobIdToView(jobId);
  };

  const handleNavigateToInvoice = (invoiceId: string) => {
    setActiveTab('billing');
    setInitialInvoiceIdToView(invoiceId);
  };

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => {
        setSaveStatus(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Auto-sync states to tenant-isolated localStorage & Cloud Firestore with live sync indicator feedback
  const isInitialCollectionMountRef = React.useRef<boolean>(true);
  const syncFeedbackTimerRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!activeTenant?.id) return;

    const collectionBundle = {
      clients,
      ledger,
      jobs,
      payments,
      invoices,
      products,
      expenses,
      users,
      logs,
      categories,
      racks,
      equipments,
      problems,
      suppliers,
      servicePartners,
      purchases,
      purchaseOrders,
      purchaseReturns,
      supplierPayments,
      servicePartnerPayments,
      inventorySerials,
      inventoryTransactions
    };

    const snapshot = JSON.stringify(collectionBundle);
    if (tenantCollectionPersistRef.current === snapshot) return;

    // Concurrency Guard: If in safe read-only mode, do not persist mutations or push to cloud
    if (concurrencyState.isReadOnly) {
      tenantCollectionPersistRef.current = snapshot;
      return;
    }

    // Snapshot restoration guard: do not re-push when receiving/applying data from cloud
    if (isApplyingSnapshotRef.current) {
      tenantCollectionPersistRef.current = snapshot;
      return;
    }

    // Immediately persist synchronously to local storage & indexedDB so refresh never loses data
    Object.entries(collectionBundle).forEach(([entity, items]) => {
      setAppStorageItem(`${entity}_${activeTenant.id}`, JSON.stringify(items));
      replaceLocalCollection(activeTenant.id, entity, items as any[], false, false).catch(() => {});
      broadcastLocalMutation(activeTenant.id, entity, items);
    });

    if (isInitialCollectionMountRef.current) {
      isInitialCollectionMountRef.current = false;
      tenantCollectionPersistRef.current = snapshot;
      return;
    }

    tenantCollectionPersistRef.current = snapshot;

    // Trigger visible live sync state immediately upon any data edit/save
    setIsSyncing(true);

    // Schedule debounced push to Google Drive on every data change
    scheduleAutoDriveSyncDebounced();

    const timer = window.setTimeout(async () => {
      if (isAuthenticated && homeServerSyncEnabled) {
        try {
          setIsServerSaving(true);
          const saveRes = await saveAllTenantDataViaApi(activeTenant.id, companyConfig, collectionBundle);
          if (saveRes?.success) {
            setServerStatus('online');
            hasUnsavedOfflineChangesRef.current = false;
          } else {
            setServerStatus('offline');
            hasUnsavedOfflineChangesRef.current = true;
          }
        } catch (_) {
          // If network failure during save, mark server offline and flag uncommitted changes
          setServerStatus('offline');
          hasUnsavedOfflineChangesRef.current = true;
        } finally {
          setIsServerSaving(false);
        }
      }

      // Smooth transition to confirm sync completion
      if (syncFeedbackTimerRef.current) clearTimeout(syncFeedbackTimerRef.current);
      syncFeedbackTimerRef.current = setTimeout(() => {
        setIsSyncing(false);
        setJustSynced(true);
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        setLastSyncedAt(timeStr);
        setTimeout(() => setJustSynced(false), 2500);
      }, 700);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeTenant?.id,
    homeServerSyncEnabled,
    clients,
    ledger,
    jobs,
    payments,
    invoices,
    products,
    expenses,
    users,
    logs,
    categories,
    racks,
    equipments,
    problems,
    companyConfig,
    isAuthenticated
  ]);

  // Silent Background Local PC Auto-Backup Service across all tabs
  const lastBackedUpSnapshotRef = React.useRef<string | null>(null);
  const backupTimerRef = React.useRef<any>(null);
  const mountTimeRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    mountTimeRef.current = Date.now();
    lastBackedUpSnapshotRef.current = null;
    if (backupTimerRef.current) {
      clearTimeout(backupTimerRef.current);
      backupTimerRef.current = null;
    }
  }, [activeTenant.id, isAuthenticated]);

  React.useEffect(() => {
    // CRITICAL: Prevent any background backup from triggering before user completes authentication
    if (!isAuthenticated) return;
    // SECURITY GUARD: Only Organization Owners (Admin) and Master Admin can execute local backups to PC folder
    const isAllowedRoleForBackup = userRole === 'Admin'
      || String(userRole) === 'Org Admin'
      || userRole === 'Master Admin'
      || currentUser?.role === 'Admin'
      || currentUser?.role === 'Org Admin'
      || activeTenant?.id === 'org-admin';
    if (!isAllowedRoleForBackup) return;

    const isEnabled = companyConfig.localBackupEnabled ?? true;
    if (!isEnabled) return;
    const freq = companyConfig.localBackupFrequency || 'on_change';
    if (freq === 'manual') return;

    // Calculate snapshot fingerprint of current data collections
    const currentSnapshot = JSON.stringify([
      clients,
      jobs,
      invoices,
      products,
      ledger,
      payments,
      expenses,
      users,
      categories,
      racks,
      equipments,
      problems,
      logs,
      fontSize,
      // Include organisation details, but ignore the timestamp written by the backup itself.
      { ...companyConfig, lastLocalBackupTime: undefined }
    ]);

    const isChangeBasedBackup = freq === 'on_change' || freq === 'on_sync';

    // GUARD: Ignore initial mount & initial 2.5-second hydration window for change-based backups.
    const isInitialHydration = (Date.now() - mountTimeRef.current) < 2500;
    if (isChangeBasedBackup && (isInitialHydration || lastBackedUpSnapshotRef.current === null)) {
      lastBackedUpSnapshotRef.current = currentSnapshot;
      return;
    }

    // If data hasn't changed since last backed up snapshot, skip change-based backups.
    if (isChangeBasedBackup && lastBackedUpSnapshotRef.current === currentSnapshot) {
      return;
    }

    const performBackgroundLocalBackup = async () => {
      try {
        lastBackedUpSnapshotRef.current = currentSnapshot;

        let dirHandle = (window as any)[`__repairTrackLocalDirectoryHandle_${activeTenant.id}`] || (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`];
        if (!dirHandle) {
          dirHandle = await getDirectoryHandle(activeTenant.id);
          if (dirHandle) {
            (window as any)[`__repairTrackLocalDirectoryHandle_${activeTenant.id}`] = dirHandle;
            (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`] = dirHandle;
          }
        }

        const dataToExport = {
          tenantId: activeTenant.id,
          orgName: companyConfig.name || activeTenant.name,
          organization: activeTenant,
          backupVersion: 1,
          clients,
          jobs,
          invoices,
          products,
          ledger,
          payments,
          expenses,
          users,
          categories,
          racks,
          equipments,
          problems,
          logs,
          suppliers,
          servicePartners,
          service_partners: servicePartners,
          purchases,
          purchaseOrders,
          purchase_orders: purchaseOrders,
          purchaseReturns,
          purchase_returns: purchaseReturns,
          supplierPayments,
          supplier_payments: supplierPayments,
          servicePartnerPayments,
          service_partner_payments: servicePartnerPayments,
          inventorySerials,
          inventory_serials: inventorySerials,
          inventoryTransactions,
          inventory_transactions: inventoryTransactions,
          fontSize,
          companyConfig
        };

        const now = new Date();
        const YYYY = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');

        const formattedTimestamp = `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
        const orgPrefix = getBackupOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.id);
        const filename = `${orgPrefix}_Local_Backup_${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}.json`;
        const jsonStr = JSON.stringify(dataToExport, null, 2);

        // 1. Save a server snapshot only when this organisation has Home Server access.
        if (homeServerSyncEnabled) {
          try {
            await saveBackupSnapshotToServer(activeTenant.id, companyConfig.name || activeTenant.name, dataToExport, filename);
          } catch (serverSnapErr) {
            console.warn('Server disk snapshot failed:', serverSnapErr);
          }
        }

        // 2. Write directly into the connected PC folder when available.
        let savedToConnectedFolder = false;
        if (dirHandle) {
          const success = await writeBackupToDirectoryHandle(dirHandle, filename, jsonStr);
          if (success) {
            savedToConnectedFolder = true;
          }
        }

        setCompanyConfig(prev => ({ ...prev, lastLocalBackupTime: formattedTimestamp }));
        if (savedToConnectedFolder) {
          triggerSaveNotification(`✓ Automatic JSON backup saved to ${dirHandle?.name || 'the connected PC folder'}.`);
        } else {
          triggerSaveNotification('Automatic backup could not access the selected PC folder. Choose the folder again in Backup Settings.', true);
        }
      } catch (err) {
        console.warn('Background local backup skipped:', err);
        triggerSaveNotification('Automatic JSON backup could not be created.', true);
      }
    };

    // 1. On Every Change Mode
    if (isChangeBasedBackup) {
      if (backupTimerRef.current) {
        clearTimeout(backupTimerRef.current);
      }
      backupTimerRef.current = setTimeout(() => {
        performBackgroundLocalBackup();
      }, 1200);
      return () => {
        if (backupTimerRef.current) {
          clearTimeout(backupTimerRef.current);
        }
      };
    }

    // 2. Custom time mode, supporting one or two daily times.
    if (freq === 'custom' || freq === 'daily') {
      const scheduleTimes = companyConfig.localBackupScheduleTimes?.length
        ? companyConfig.localBackupScheduleTimes
        : [companyConfig.localBackupScheduleTime || '18:00'];
      const interval = setInterval(() => {
        const now = new Date();
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (scheduleTimes.includes(currentHHMM) && now.getSeconds() === 0) {
          performBackgroundLocalBackup();
        }
      }, 1000);
      return () => clearInterval(interval);
    }

    // 3. Periodic Duration Intervals (30 mins, 1 hour to 12 hours)
    const intervalMs = freq === 'minutes'
      ? (companyConfig.localBackupInterval || 5) * 60 * 1000
      : freq === 'hours'
      ? (companyConfig.localBackupInterval || 1) * 60 * 60 * 1000
      : undefined;
    if (intervalMs) {
      const interval = setInterval(() => {
        performBackgroundLocalBackup();
      }, intervalMs);
      return () => clearInterval(interval);
    }
  }, [
    isAuthenticated,
    userRole,
    currentUser?.role,
    activeTenant.id,
    homeServerSyncEnabled,
    companyConfig,
    companyConfig.localBackupEnabled,
    companyConfig.localBackupFrequency,
    companyConfig.localBackupInterval,
    companyConfig.localBackupScheduleTime,
    companyConfig.localBackupScheduleTimes,
    clients,
    jobs,
    invoices,
    products,
    ledger,
    payments,
    expenses,
    users,
    categories,
    racks,
    equipments,
    problems,
    logs,
    fontSize
  ]);

  // Multi-Device Google Drive Sync: Fast pull on boot/connect, periodic 15s polling, and window focus checks
  React.useEffect(() => {
    if (!driveSyncState.isConnected || !activeTenant?.id) return;
    checkAndPullLatestFromDrive(true);
  }, [driveSyncState.isConnected, activeTenant?.id, checkAndPullLatestFromDrive]);

  React.useEffect(() => {
    if (!driveSyncState.isConnected || !activeTenant?.id) return;

    // Periodic 60-second check: verifies if another device uploaded newer data without flooding Drive API
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAndPullLatestFromDrive(true);
      }
    }, 60000);

    // Immediate check when switching to this tab or focusing browser window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndPullLatestFromDrive(true);
      }
    };
    const handleFocus = () => {
      checkAndPullLatestFromDrive(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [driveSyncState.isConnected, activeTenant?.id, checkAndPullLatestFromDrive]);

  // Git-like Pull-First database synchronization handler
  const handleSyncData = async () => {
    setIsSyncing(true);
    const syncStartTime = Date.now();
    try {
      if (!homeServerSyncEnabled) {
        if (driveSyncState.isConnected) {
          triggerSaveNotification('🔄 Synchronizing with Google Drive...');
          if (concurrencyStateRef.current?.isReadOnly) {
            const pulled = await handlePullLatestSnapshotFromDrive();
            if (pulled) {
              setJustSynced(true);
              setTimeout(() => setJustSynced(false), 3000);
            }
          } else {
            const pushed = await handlePushSnapshotToDrive(false, true);
            if (pushed) {
              setJustSynced(true);
              setTimeout(() => setJustSynced(false), 3000);
            }
          }
          return;
        }
        triggerSaveNotification('✓ Organisation is in local-only mode. All changes are saved on this device.');
        return;
      }
      console.info(`[Home Server Sync] Pull-First Sync initiated for tenant: ${activeTenant.id}`);

      // STEP 1: Push local-first changes before pulling server state.
      await pushPendingOperations(activeTenant.id);

      // STEP 2: Pull the merged/authoritative state from Home Server SQLite
      const bootstrap = await bootstrapTenantFromHomeServer(activeTenant.id);
      if (bootstrap && bootstrap.collections) {
        const col = bootstrap.collections;
        const tId = activeTenant.id;
        if (Array.isArray(col.clients)) { setClients(col.clients); clientsRef.current = col.clients; setAppStorageItem(`clients_${tId}`, JSON.stringify(col.clients)); }
        if (Array.isArray(col.jobs)) { const sorted = sortJobsByLatest(col.jobs); setJobs(sorted); jobsRef.current = sorted; setAppStorageItem(`jobs_${tId}`, JSON.stringify(sorted)); }
        if (Array.isArray(col.invoices)) { setInvoices(col.invoices); invoicesRef.current = col.invoices; setAppStorageItem(`invoices_${tId}`, JSON.stringify(col.invoices)); }
        if (Array.isArray(col.payments)) { setPayments(col.payments); paymentsRef.current = col.payments; setAppStorageItem(`payments_${tId}`, JSON.stringify(col.payments)); }
        if (Array.isArray(col.products)) { setProducts(col.products); productsRef.current = col.products; setAppStorageItem(`products_${tId}`, JSON.stringify(col.products)); }
        if (Array.isArray(col.expenses)) { setExpenses(col.expenses); expensesRef.current = col.expenses; setAppStorageItem(`expenses_${tId}`, JSON.stringify(col.expenses)); }
        if (Array.isArray(col.ledger)) { setLedger(col.ledger); ledgerRef.current = col.ledger; setAppStorageItem(`ledger_${tId}`, JSON.stringify(col.ledger)); }
        if (Array.isArray(col.categories)) { setCategories(col.categories); categoriesRef.current = col.categories; setAppStorageItem(`categories_${tId}`, JSON.stringify(col.categories)); }
        if (Array.isArray(col.racks)) { setRacks(col.racks); racksRef.current = col.racks; setAppStorageItem(`racks_${tId}`, JSON.stringify(col.racks)); }
        if (Array.isArray(col.equipments)) { setEquipments(col.equipments); equipmentsRef.current = col.equipments; setAppStorageItem(`equipments_${tId}`, JSON.stringify(col.equipments)); }
        if (Array.isArray(col.problems)) { setProblems(col.problems); problemsRef.current = col.problems; setAppStorageItem(`problems_${tId}`, JSON.stringify(col.problems)); }
        if (Array.isArray(col.suppliers)) { setSuppliers(col.suppliers); suppliersRef.current = col.suppliers; setAppStorageItem(`suppliers_${tId}`, JSON.stringify(col.suppliers)); }
        if (Array.isArray(col.servicePartners)) { setServicePartners(col.servicePartners); servicePartnersRef.current = col.servicePartners; setAppStorageItem(`servicePartners_${tId}`, JSON.stringify(col.servicePartners)); }
        if (Array.isArray(col.purchases)) { setPurchases(col.purchases); purchasesRef.current = col.purchases; setAppStorageItem(`purchases_${tId}`, JSON.stringify(col.purchases)); }
        if (Array.isArray(col.purchaseOrders)) { setPurchaseOrders(col.purchaseOrders); purchaseOrdersRef.current = col.purchaseOrders; setAppStorageItem(`purchaseOrders_${tId}`, JSON.stringify(col.purchaseOrders)); }
        if (Array.isArray(col.purchaseReturns)) { setPurchaseReturns(col.purchaseReturns); purchaseReturnsRef.current = col.purchaseReturns; setAppStorageItem(`purchaseReturns_${tId}`, JSON.stringify(col.purchaseReturns)); }
        if (Array.isArray(col.supplierPayments)) { setSupplierPayments(col.supplierPayments); supplierPaymentsRef.current = col.supplierPayments; setAppStorageItem(`supplierPayments_${tId}`, JSON.stringify(col.supplierPayments)); }
        if (Array.isArray(col.servicePartnerPayments)) { setServicePartnerPayments(col.servicePartnerPayments); servicePartnerPaymentsRef.current = col.servicePartnerPayments; setAppStorageItem(`servicePartnerPayments_${tId}`, JSON.stringify(col.servicePartnerPayments)); }
        if (Array.isArray(col.inventorySerials)) { setInventorySerials(col.inventorySerials); inventorySerialsRef.current = col.inventorySerials; setAppStorageItem(`inventorySerials_${tId}`, JSON.stringify(col.inventorySerials)); }
        if (Array.isArray(col.inventoryTransactions)) { setInventoryTransactions(col.inventoryTransactions); inventoryTransactionsRef.current = col.inventoryTransactions; setAppStorageItem(`inventoryTransactions_${tId}`, JSON.stringify(col.inventoryTransactions)); }
        if (Array.isArray(col.users) && col.users.length > 0) { setUsers(col.users); usersRef.current = col.users; setAppStorageItem(`users_${tId}`, JSON.stringify(col.users)); }
        if (bootstrap.companyConfig) {
          setCompanyConfig(prev => ({ ...prev, ...bootstrap.companyConfig }));
          setAppStorageItem(`company_config_${tId}`, JSON.stringify(bootstrap.companyConfig));
        }
      } else {
        await pullDeltaFromHomeServer(activeTenant.id);
      }

      // Sync Company Config & Global System Branding
      await saveCompanyConfigToFirestore(activeTenant.id, companyConfig);
      const isMasterAdminOrg = activeTenant.id === 'org-admin' || activeTenant.code === 'ADMIN-00' || activeTenant.ownerMobile?.includes('8149862034');
      if (isMasterAdminOrg || companyConfig.appLogoUrl) {
        await saveCompanyConfigToFirestore('global_system_branding', {
          ...companyConfig,
          appName: systemAppName,
          appTagline: systemAppTagline,
          appLogoUrl: systemAppLogo
        });
      }

      setPendingQueueCount(getPendingQueueCount());
      setIsQuotaExhaustedState(isQuotaExhausted());

      // STEP 3: Admin-only PC Folder write (Optional, only if Admin previously configured folder handle)
      const isAllowedRoleForBackup = userRole === 'Admin'
        || String(userRole) === 'Org Admin'
        || userRole === 'Master Admin'
        || currentUser?.role === 'Admin'
        || currentUser?.role === 'Org Admin'
        || activeTenant?.id === 'org-admin';
      let pcFolderSynced = false;
      if (isAllowedRoleForBackup) {
        const dirHandle = (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`] || (await getDirectoryHandle(activeTenant.id));
        if (dirHandle) {
          (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`] = dirHandle;
          const now = new Date();
          const YYYY = now.getFullYear();
          const MM = String(now.getMonth() + 1).padStart(2, '0');
          const DD = String(now.getDate()).padStart(2, '0');
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const orgPrefix = getBackupOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.id);
          const syncFilename = `${orgPrefix}_Sync_Backup_${YYYY}-${MM}-${DD}_${hh}-${mm}.json`;
          const syncPayload = JSON.stringify({
            tenantId: activeTenant.id,
            orgName: companyConfig.name || activeTenant.name,
            clients,
            jobs,
            invoices,
            products,
            ledger,
            payments,
            expenses,
            users,
            categories,
            racks,
            equipments,
            problems,
            suppliers,
            servicePartners,
            service_partners: servicePartners,
            purchases,
            purchaseOrders,
            purchase_orders: purchaseOrders,
            purchaseReturns,
            purchase_returns: purchaseReturns,
            supplierPayments,
            supplier_payments: supplierPayments,
            servicePartnerPayments,
            service_partner_payments: servicePartnerPayments,
            inventorySerials,
            inventory_serials: inventorySerials,
            inventoryTransactions,
            inventory_transactions: inventoryTransactions,
            companyConfig
          }, null, 2);
          await writeBackupToDirectoryHandle(dirHandle, syncFilename, syncPayload);
          pcFolderSynced = true;
        }
      }

      // Log audit
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || (userRole === 'Technician' ? 'Technician' : 'Admin'),
        action: 'SYNC',
        details: `Git-like Pull & Push sync completed with Home Server SQLite database.`
      };
      setLogs(prev => [newLog, ...prev]);

      // Ensure minimum 1200ms sync rotation animation duration
      const elapsedTime = Date.now() - syncStartTime;
      if (elapsedTime < 1200) {
        await new Promise(res => setTimeout(res, 1200 - elapsedTime));
      }

      triggerSaveNotification(`✓ Data synchronized with Home Server SQLite database (Push & Pull complete)!`);
    } catch (err: any) {
      console.error('[Home Server Sync Error]', err);
      triggerSaveNotification(`✓ Synced locally (${err.message || 'Home Server sync completed'})`);
    } finally {
      setIsSyncing(false);
      setJustSynced(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setLastSyncedAt(timeStr);
      setTimeout(() => setJustSynced(false), 3000);
    }
  };

  // State Action Callbacks
  const addClient = (newClient: Omit<Client, 'id'>): Client => {
    try {
      const id = `c-${Date.now()}`;
      const balance = Number(newClient.outstandingBalance) || 0;
      const opening = newClient.openingBalance !== undefined ? Number(newClient.openingBalance) : balance;
      const client: Client = {
        id,
        tenantId: activeTenant.id,
        ...newClient,
        openingBalance: opening,
        outstandingBalance: balance
      };
      setClients(prev => [...prev, client]);

      if (opening !== 0) {
        const openingLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: id,
          date: new Date().toLocaleDateString('en-IN'),
          type: 'Opening Balance',
          refNo: 'OPENING',
          debit: opening > 0 ? opening : 0,
          credit: opening < 0 ? Math.abs(opening) : 0,
          balance: opening
        };
        setLedger(prev => [openingLedgerLog, ...prev]);
      }

      triggerSaveNotification(`✓ Client "${newClient.name}" added & saved!`);
      return client;
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save client: ${err.message}`, true);
      return null;
    }
  };

  const editClient = (updatedClient: Client) => {
    try {
      setClients(prevClients => prevClients.map(c => c.id === updatedClient.id ? updatedClient : c));
      
      // If opening balance was changed, update or create OPENING ledger entry
      if (updatedClient.openingBalance !== undefined) {
        const opening = Number(updatedClient.openingBalance) || 0;
        setLedger(prevLedger => {
          const existingOpeningIdx = prevLedger.findIndex(l => l.clientId === updatedClient.id && (l.refNo === 'OPENING' || l.type === 'Opening Balance'));
          if (existingOpeningIdx >= 0) {
            const updated = [...prevLedger];
            updated[existingOpeningIdx] = {
              ...updated[existingOpeningIdx],
              debit: opening > 0 ? opening : 0,
              credit: opening < 0 ? Math.abs(opening) : 0,
              balance: opening
            };
            return updated;
          } else if (opening !== 0) {
            const newOpeningEntry: ClientLedgerEntry = {
              id: `l-${Date.now()}`,
              tenantId: activeTenant.id,
              clientId: updatedClient.id,
              date: new Date().toLocaleDateString('en-IN'),
              type: 'Opening Balance',
              refNo: 'OPENING',
              debit: opening > 0 ? opening : 0,
              credit: opening < 0 ? Math.abs(opening) : 0,
              balance: opening
            };
            return [newOpeningEntry, ...prevLedger];
          }
          return prevLedger;
        });
      }

      triggerSaveNotification(`✓ Client profile "${updatedClient.name}" updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save client: ${err.message}`, true);
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const client = clients.find(c => c.id === id);
      const nextClients = clients.filter(c => c.id !== id);
      setClients(nextClients);
      setAppStorageItem(`clients_${activeTenant.id}`, JSON.stringify(nextClients));
      await saveTenantCollectionToFirestore(activeTenant.id, 'clients', nextClients);
      triggerSaveNotification(`✓ Client "${client?.name || id}" removed & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete client: ${err.message}`, true);
    }
  };

  const addJob = (newJob: Omit<RepairJob, 'id'>) => {
    try {
      const orgPrefix = getOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.code);
      const usedJobNumbers = new Set(
        jobs
          .map(job => job.id.match(/\/(\d+)$/)?.[1])
          .filter(Boolean)
          .map(Number)
      );
      let nextJobNumber = 101;
      while (usedJobNumbers.has(nextJobNumber)) nextJobNumber += 1;
      const jobId = `${orgPrefix}/2026/${nextJobNumber}`;
      const nowIso = new Date().toISOString();
      const formattedNow = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const immutableInDate = newJob.inDate || newJob.inwardDate || newJob.createdAt || formattedNow;

      const job: RepairJob = {
        id: jobId,
        tenantId: activeTenant.id,
        ...newJob,
        createdAt: newJob.createdAt || nowIso,
        updatedAt: nowIso,
        inDate: immutableInDate,
        inwardDate: immutableInDate
      };
      setJobs(prev => sortJobsByLatest([job, ...prev]));

      // If inward advance payment was accepted during creation
      if (newJob.advanceAmount && newJob.advanceAmount > 0) {
        const advAmount = Number(newJob.advanceAmount) || 0;
        const advancePayment: Payment = {
          id: `pay-${Date.now()}`,
          tenantId: activeTenant.id,
          date: newJob.date || new Date().toISOString().split('T')[0],
          clientId: newJob.clientId,
          clientName: newJob.clientName,
          amount: advAmount,
          mode: newJob.advancePaymentMode || 'UPI',
          refNo: `Inward Advance ${jobId}`,
          remarks: `Advance payment accepted during inward job card ${jobId}`,
          linkedJobId: jobId
        };
        setPayments(prev => [advancePayment, ...prev]);

        // Credit client ledger for advance received
        const advLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: newJob.clientId,
          date: newJob.date || new Date().toLocaleDateString('en-IN'),
          type: 'Inward Advance Payment',
          refNo: `ADV-${jobId}`,
          debit: 0,
          credit: advAmount,
          balance: (clients.find(c => c.id === newJob.clientId)?.outstandingBalance || 0) - advAmount
        };
        setLedger(prev => [advLedgerLog, ...prev]);

        // Update client balance (minus advance received)
        setClients(prev => prev.map(c => {
          if (c.id === newJob.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + (newJob.estimateAmount || 0) - advAmount
            };
          }
          return c;
        }));
      } else {
        // Update client outstandings with estimate
        setClients(prev => prev.map(c => {
          if (c.id === newJob.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + (newJob.estimateAmount || 0)
            };
          }
          return c;
        }));
      }

      // Update log
      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Staff',
        action: 'INWARD_JOB',
        details: `Inwarded ${newJob.equipment} (${newJob.productName}) for ${newJob.clientName}.${newJob.advanceAmount ? ` Advance received: ₹${newJob.advanceAmount}` : ''}`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Inward Job card ${jobId} logged & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to log repair job: ${err.message}`, true);
    }
  };

  const updateJob = (updatedJob: RepairJob) => {
    try {
      const oldJob = jobs.find(j => j.id === updatedJob.id);

      const oldBill = oldJob ? getEffectiveBillAmount(oldJob) : 0;
      const oldAdvance = oldJob ? (oldJob.advanceAmount || 0) : 0;
      const oldIsPaid = oldJob ? oldJob.paymentStatus === 'Paid' : false;

      const newBill = getEffectiveBillAmount(updatedJob);
      const newAdvance = updatedJob.advanceAmount || 0;
      const newIsPaid = updatedJob.paymentStatus === 'Paid';

      // Calculate bill difference
      const billDiff = newBill - oldBill;

      const nowIso = new Date().toISOString();
      const immutableInDate = oldJob?.inDate || oldJob?.inwardDate || oldJob?.createdAt || updatedJob.inDate || updatedJob.inwardDate || updatedJob.createdAt || new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      let finalOutDate = updatedJob.outDate || updatedJob.outwardedDate;
      if (!finalOutDate && (updatedJob.status === 'Product Out' || updatedJob.status === 'Outwarded' || updatedJob.deliveryStatus === 'Delivered')) {
        finalOutDate = oldJob?.outDate || oldJob?.outwardedDate || new Date().toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true
        });
      }

      const jobToSave: RepairJob = {
        ...updatedJob,
        createdAt: oldJob?.createdAt || updatedJob.createdAt || nowIso,
        updatedAt: nowIso,
        inDate: immutableInDate,
        inwardDate: immutableInDate,
        outDate: finalOutDate,
        outwardedDate: finalOutDate || updatedJob.outwardedDate
      };

      // Update jobs array sorted by latest
      setJobs(prevJobs => sortJobsByLatest(prevJobs.map(j => j.id === jobToSave.id ? jobToSave : j)));

      // Handle Client Balance updates
      if (oldJob && oldJob.clientId !== updatedJob.clientId) {
        // Client changed on job
        const oldPending = oldIsPaid ? 0 : Math.max(0, oldBill - oldAdvance);
        const newPending = newIsPaid ? 0 : Math.max(0, newBill - newAdvance);

        setClients(prevClients => prevClients.map(c => {
          if (c.id === oldJob.clientId) {
            return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - oldPending) };
          }
          if (c.id === updatedJob.clientId) {
            return { ...c, outstandingBalance: c.outstandingBalance + newPending };
          }
          return c;
        }));
      } else {
        // Same client
        if (billDiff !== 0) {
          setClients(prevClients => prevClients.map(c => {
            if (c.id === updatedJob.clientId) {
              return { ...c, outstandingBalance: c.outstandingBalance + billDiff };
            }
            return c;
          }));
        }

        // If status changed from Paid -> Unpaid, restore unpaid amount to client balance
        if (oldIsPaid && !newIsPaid && updatedJob.repairOutcome !== 'Not Repaired') {
          const amountToRestore = Math.max(0, newBill - newAdvance);
          if (amountToRestore > 0) {
            setClients(prevClients => prevClients.map(c => {
              if (c.id === updatedJob.clientId) {
                return { ...c, outstandingBalance: c.outstandingBalance + amountToRestore };
              }
              return c;
            }));
          }
        }
      }

      // Sync Advance Payment with Payments list if advance amount changed or payment mode changed
      if (oldAdvance !== newAdvance || (oldJob && oldJob.advancePaymentMode !== updatedJob.advancePaymentMode)) {
        setPayments(prevPayments => {
          const existingIndex = prevPayments.findIndex(p => 
            p.linkedJobId === updatedJob.id || 
            (p.refNo && (p.refNo.includes(`Inward Advance ${updatedJob.id}`) || p.refNo.includes(`ADV-${updatedJob.id}`)))
          );

          if (newAdvance > 0) {
            if (existingIndex >= 0) {
              const updated = [...prevPayments];
              updated[existingIndex] = {
                ...updated[existingIndex],
                amount: newAdvance,
                mode: updatedJob.advancePaymentMode || updated[existingIndex].mode || 'UPI',
                clientId: updatedJob.clientId,
                clientName: updatedJob.clientName,
                date: updatedJob.date || updated[existingIndex].date,
                remarks: `Advance payment updated for inward job card ${updatedJob.id}`
              };
              return updated;
            } else {
              const newAdvPay: Payment = {
                id: `pay-${Date.now()}`,
                tenantId: activeTenant.id,
                date: updatedJob.date || new Date().toISOString().split('T')[0],
                clientId: updatedJob.clientId,
                clientName: updatedJob.clientName,
                amount: newAdvance,
                mode: updatedJob.advancePaymentMode || 'UPI',
                refNo: `Inward Advance ${updatedJob.id}`,
                remarks: `Advance payment added for job card ${updatedJob.id}`,
                linkedJobId: updatedJob.id
              };
              return [newAdvPay, ...prevPayments];
            }
          } else {
            if (existingIndex >= 0) {
              return prevPayments.filter((_, idx) => idx !== existingIndex);
            }
            return prevPayments;
          }
        });
      }

      // Handle Advance Refund if checked and advance was taken
      if (updatedJob.advanceRefunded && newAdvance > 0 && (!oldJob || !oldJob.advanceRefunded) && !oldIsPaid) {
        const refundAmount = newAdvance;
        const payDate = new Date().toISOString().split('T')[0];
        const payMode = updatedJob.advanceRefundMode || 'Cash';

        const refundPayment: Payment = {
          id: `pay-refund-${Date.now()}`,
          tenantId: activeTenant.id,
          date: payDate,
          clientId: updatedJob.clientId,
          clientName: updatedJob.clientName,
          amount: -refundAmount,
          mode: payMode,
          refNo: `REFUND-${updatedJob.id}`,
          remarks: `Advance refunded for Not Repaired job card #${updatedJob.id} (${updatedJob.equipment || 'Device'})`
        };

        setPayments(prev => [refundPayment, ...prev]);

        const clientObj = clients.find(c => c.id === updatedJob.clientId);
        const currentBal = clientObj ? clientObj.outstandingBalance : 0;

        const refundLedgerLog: ClientLedgerEntry = {
          id: `l-refund-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: updatedJob.clientId,
          date: new Date().toLocaleDateString('en-IN'),
          type: 'Advance Refunded',
          refNo: `REFUND-${updatedJob.id}`,
          debit: refundAmount,
          credit: 0,
          balance: currentBal + refundAmount
        };
        setLedger(prev => [refundLedgerLog, ...prev]);

        // Refunding advance increases client balance by refundAmount (offsets negative credit)
        setClients(prevClients => prevClients.map(c => {
          if (c.id === updatedJob.clientId) {
            return { ...c, outstandingBalance: c.outstandingBalance + refundAmount };
          }
          return c;
        }));
      }

      // Check if job is linked to an existing invoice
      const linkedInvoice = invoices.find(inv => inv.linkedJobId === updatedJob.id);

      // If status changed from Unpaid -> Paid and NOT Not Repaired, generate or link payment record and credit client
      if (newIsPaid && !oldIsPaid && updatedJob.repairOutcome !== 'Not Repaired') {
        const remainingPaid = Math.max(0, newBill - newAdvance);
        if (remainingPaid > 0) {
          // Check if payment already exists for this job card or linked invoice
          const existingJobPayment = payments.find(p => 
            p.linkedJobId === updatedJob.id || 
            (linkedInvoice && p.invoiceId === linkedInvoice.id) ||
            (p.refNo && p.refNo.includes(updatedJob.id))
          );

          if (existingJobPayment) {
            // Already recorded -> Ensure linkedJobId and invoiceId are connected without duplicating
            setPayments(prev => prev.map(p => {
              if (p.id === existingJobPayment.id) {
                return {
                  ...p,
                  linkedJobId: updatedJob.id,
                  invoiceId: linkedInvoice?.id || p.invoiceId,
                  clientName: p.clientName && p.clientName !== 'Unknown' ? p.clientName : updatedJob.clientName
                };
              }
              return p;
            }));
          } else {
            const payDate = new Date().toISOString().split('T')[0];
            const payMode = updatedJob.advancePaymentMode || 'UPI';

            const outwardPayment: Payment = {
              id: `pay-${Date.now()}`,
              tenantId: activeTenant.id,
              date: payDate,
              clientId: updatedJob.clientId,
              clientName: updatedJob.clientName,
              amount: remainingPaid,
              mode: payMode,
              refNo: linkedInvoice ? `Invoice ${linkedInvoice.id} (Job #${updatedJob.id})` : `Outward Bill ${updatedJob.id}`,
              remarks: `Full payment cleared for job card #${updatedJob.id} (${updatedJob.equipment || 'Device'})`,
              linkedJobId: updatedJob.id,
              invoiceId: linkedInvoice?.id
            };

            setPayments(prev => [outwardPayment, ...prev]);

            const clientObj = clients.find(c => c.id === updatedJob.clientId);
            const currentBal = clientObj ? clientObj.outstandingBalance : 0;

            const outwardLedgerLog: ClientLedgerEntry = {
              id: `l-${Date.now()}`,
              tenantId: activeTenant.id,
              clientId: updatedJob.clientId,
              date: new Date().toLocaleDateString('en-IN'),
              type: 'Outward Payment Received',
              refNo: `OUT-${updatedJob.id}`,
              debit: 0,
              credit: remainingPaid,
              balance: Math.max(0, currentBal - remainingPaid)
            };
            setLedger(prev => [outwardLedgerLog, ...prev]);

            // Deduct from client balance
            setClients(prevClients => prevClients.map(c => {
              if (c.id === updatedJob.clientId) {
                return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - remainingPaid) };
              }
              return c;
            }));
          }
        }
      }

      // If status changed from Paid -> Unpaid (e.g. brought back from Outward / reverted by mistake)
      if (oldIsPaid && !newIsPaid) {
        // Cleanly remove any auto-generated outward payment record for this job
        const targetPayment = payments.find(p => 
          p.linkedJobId === updatedJob.id && 
          p.refNo?.includes(`Outward Bill ${updatedJob.id}`)
        );
        if (targetPayment) {
          setPayments(prev => prev.filter(p => p.id !== targetPayment.id));
          setClients(prevClients => prevClients.map(c => {
            if (c.id === updatedJob.clientId) {
              return { ...c, outstandingBalance: c.outstandingBalance + targetPayment.amount };
            }
            return c;
          }));
        }
      }

      // A paid job changed to Not Repaired: reverse the paid bill once and keep
      // the reversal visible in payment history.
      if (oldIsPaid && updatedJob.repairOutcome === 'Not Repaired' && updatedJob.advanceRefunded) {
        const linkedPaidInvoice = invoices.find(invoice => invoice.linkedJobId === updatedJob.id);
        const paidAmountToReturn = linkedPaidInvoice?.paidAmount || payments
          .filter(payment => payment.linkedJobId === updatedJob.id && payment.amount > 0)
          .reduce((total, payment) => total + payment.amount, 0);
        const refundRef = `REFUND-${updatedJob.id}`;
        const alreadyRefunded = payments.some(payment => payment.refNo === refundRef);

        if (paidAmountToReturn > 0 && !alreadyRefunded) {
          const refundPayment: Payment = {
            id: `pay-refund-${updatedJob.id}-${Date.now()}`,
            tenantId: activeTenant.id,
            date: new Date().toISOString().split('T')[0],
            clientId: updatedJob.clientId,
            clientName: updatedJob.clientName,
            amount: -paidAmountToReturn,
            mode: updatedJob.advanceRefundMode || updatedJob.advancePaymentMode || 'Cash',
            refNo: refundRef,
            remarks: `Paid amount returned because job card #${updatedJob.id} was marked Not Repaired.`,
            linkedJobId: updatedJob.id,
            invoiceId: linkedPaidInvoice?.id
          };
          setPayments(prev => [refundPayment, ...prev]);
          setLedger(prev => [{
            id: `l-refund-${updatedJob.id}-${Date.now()}`,
            tenantId: activeTenant.id,
            clientId: updatedJob.clientId,
            date: new Date().toLocaleDateString('en-IN'),
            type: 'Paid Amount Returned - Not Repaired',
            refNo: refundRef,
            debit: paidAmountToReturn,
            credit: 0,
            balance: 0
          }, ...prev]);
        }

        if (linkedPaidInvoice) {
          setInvoices(prev => prev.map(invoice => invoice.id === linkedPaidInvoice.id
            ? { ...invoice, isPaid: false, paidAmount: 0, balanceAmount: invoice.grandTotal }
            : invoice
          ));
        }
      }

      // If already paid and bill amount changed while editing
      if (newIsPaid && oldIsPaid && newBill !== oldBill && updatedJob.repairOutcome !== 'Not Repaired') {
        const newRemaining = Math.max(0, newBill - newAdvance);
        const oldRemaining = Math.max(0, oldBill - oldAdvance);
        const diff = newRemaining - oldRemaining;
        setPayments(prev => prev.map(p => {
          if (p.linkedJobId === updatedJob.id && p.refNo?.includes(`Outward Bill ${updatedJob.id}`)) {
            return { ...p, amount: newRemaining };
          }
          return p;
        }));
        if (diff !== 0) {
          setClients(prevClients => prevClients.map(c => {
            if (c.id === updatedJob.clientId) {
              return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - diff) };
            }
            return c;
          }));
        }
      }

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Staff',
        action: 'UPDATE_JOB',
        details: `Updated repair job card ${updatedJob.id} status to ${updatedJob.status}.`
      };
      setLogs(prev => [audit, ...prev]);
      triggerSaveNotification(`✓ Repair job ${updatedJob.id} updated & synced with Client & Payments!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update job: ${err.message}`, true);
    }
  };

  const deleteJob = async (id: string) => {
    try {
      const targetJob = jobs.find(j => j.id === id);
      if (targetJob && targetJob.paymentStatus !== 'Paid') {
        const bill = getEffectiveBillAmount(targetJob);
        const pending = Math.max(0, bill - (targetJob.advanceAmount || 0));
        if (pending > 0) {
          setClients(prev => prev.map(c => {
            if (c.id === targetJob.clientId) {
              return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - pending) };
            }
            return c;
          }));
        }
      }
      const nextJobs = jobs.filter(j => j.id !== id);
      setJobs(nextJobs);
      setAppStorageItem(`jobs_${activeTenant.id}`, JSON.stringify(nextJobs));

      // Remove any linked advance / outward payments associated with deleted job
      const nextPayments = payments.filter(p => 
        p.linkedJobId !== id && 
        !(p.refNo && (p.refNo.includes(`Inward Advance ${id}`) || p.refNo.includes(`ADV-${id}`) || p.refNo.includes(`Outward Bill ${id}`)))
      );
      setPayments(nextPayments);
      setAppStorageItem(`payments_${activeTenant.id}`, JSON.stringify(nextPayments));

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Staff',
        action: 'DELETE_JOB',
        details: `Deleted job ticket #${targetJob?.id || id}`
      };
      setLogs(prev => [audit, ...prev]);
      await saveTenantCollectionToFirestore(activeTenant.id, 'jobs', nextJobs);
      await saveTenantCollectionToFirestore(activeTenant.id, 'payments', nextPayments);
      triggerSaveNotification(`✓ Job card ${targetJob?.id ? '#' + targetJob.id : ''} permanently deleted & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete job card: ${err.message}`, true);
    }
  };

  const addPayment = (newPayment: Omit<Payment, 'id'>) => {
    try {
      const paymentId = `pay-${Date.now()}`;
      const payment: Payment = {
        id: paymentId,
        tenantId: activeTenant.id,
        ...newPayment
      };
      setPayments([payment, ...payments]);

      // Deduct client ledger balance
      setClients(clients.map(c => {
        if (c.id === newPayment.clientId) {
          return {
            ...c,
            outstandingBalance: c.outstandingBalance - newPayment.amount
          };
        }
        return c;
      }));

      // If specific job(s) or invoice were cleared, update their payment status
      if (newPayment.linkedJobIds && newPayment.linkedJobIds.length > 0) {
        setJobs(prevJobs => prevJobs.map(job => {
          if (newPayment.linkedJobIds?.includes(job.id) && job.repairOutcome !== 'Not Repaired') {
            return {
              ...job,
              paymentStatus: 'Paid'
            };
          }
          return job;
        }));
      } else if (newPayment.linkedJobId) {
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.id === newPayment.linkedJobId && job.repairOutcome !== 'Not Repaired') {
            return {
              ...job,
              paymentStatus: 'Paid'
            };
          }
          return job;
        }));
      }

      if (newPayment.invoiceId) {
        setInvoices(prevInvoices => prevInvoices.map(inv => {
          if (inv.id === newPayment.invoiceId) {
            const nextPaid = Math.min(inv.grandTotal, (inv.paidAmount || 0) + newPayment.amount);
            const nextBal = Math.max(0, inv.grandTotal - nextPaid);
            return {
              ...inv,
              paidAmount: nextPaid,
              balanceAmount: nextBal,
              isPaid: nextBal <= 0
            };
          }
          return inv;
        }));
      }

      // Add ledger log
      const ledgerLog = {
        id: `l-${Date.now()}`,
        tenantId: activeTenant.id,
        clientId: newPayment.clientId,
        date: newPayment.date,
        type: newPayment.linkedJobIds && newPayment.linkedJobIds.length > 1 
          ? `Lump-sum Payment (${newPayment.linkedJobIds.length} JCs)` 
          : 'Payment Received',
        refNo: `${newPayment.mode} (${newPayment.refNo || 'Direct Credit'})`,
        debit: 0,
        credit: newPayment.amount,
        balance: (clients.find(c => c.id === newPayment.clientId)?.outstandingBalance || 0) - newPayment.amount
      };
      setLedger([ledgerLog, ...ledger]);

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'PAYMENT_CREDIT',
        details: `Credited ₹${newPayment.amount} payment from client ${newPayment.clientName}.${newPayment.linkedJobIds?.length ? ` Allocated to JCs: ${newPayment.linkedJobIds.join(', ')}` : ''}`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Payment ₹${newPayment.amount} credited & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save payment: ${err.message}`, true);
    }
  };

  const updatePayment = (updatedPayment: Payment) => {
    try {
      const oldPayment = payments.find(p => p.id === updatedPayment.id);
      const oldAmount = oldPayment ? oldPayment.amount : 0;
      const diff = updatedPayment.amount - oldAmount;

      setPayments(payments.map(p => p.id === updatedPayment.id ? updatedPayment : p));

      if (diff !== 0) {
        setClients(clients.map(c => {
          if (c.id === updatedPayment.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance - diff
            };
          }
          return c;
        }));
      }

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'PAYMENT_EDIT',
        details: `Edited payment record ${updatedPayment.id} amount to ₹${updatedPayment.amount}.`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Payment record ${updatedPayment.id} updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update payment: ${err.message}`, true);
    }
  };

  const deletePayment = async (paymentId: string) => {
    try {
      const targetPayment = payments.find(p => p.id === paymentId);
      if (!targetPayment) return;

      const nextPayments = payments.filter(p => p.id !== paymentId);
      setPayments(nextPayments);
      setAppStorageItem(`payments_${activeTenant.id}`, JSON.stringify(nextPayments));

      // Restore client outstanding balance
      const nextClients = clients.map(c => {
        if (c.id === targetPayment.clientId) {
          return {
            ...c,
            outstandingBalance: c.outstandingBalance + targetPayment.amount
          };
        }
        return c;
      });
      setClients(nextClients);
      setAppStorageItem(`clients_${activeTenant.id}`, JSON.stringify(nextClients));

      // Log audit
      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'PAYMENT_DELETE',
        details: `Deleted payment receipt ${targetPayment.id} of ₹${targetPayment.amount} for client ${targetPayment.clientName}.`
      };
      setLogs(prev => [audit, ...prev]);

      await saveTenantCollectionToFirestore(activeTenant.id, 'payments', nextPayments);
      await saveTenantCollectionToFirestore(activeTenant.id, 'clients', nextClients);
      triggerSaveNotification(`✓ Payment receipt of ₹${targetPayment.amount} deleted & client balance restored!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete payment: ${err.message}`, true);
    }
  };

  // Helper to match an invoice line item against an inventory product reliably
  const isInvoiceItemProductMatch = (item: { productName: string; serialNo?: string }, prod: Product): boolean => {
    const itemPN = (item.productName || '').trim().toLowerCase();
    const prodN = (prod.name || '').trim().toLowerCase();
    const itemSKU = (item.serialNo || '').trim().toLowerCase();
    const prodID = (prod.id || '').trim().toLowerCase();
    const prodHSN = (prod.hsnCode || '').trim().toLowerCase();

    if (!itemPN && !itemSKU) return false;

    // 1. Direct match on ID / HSN
    if (itemSKU && (
      itemSKU === prodID ||
      itemSKU === prodHSN ||
      itemSKU === `hsn:${prodHSN}`
    )) {
      return true;
    }

    // 2. Exact match on Product Name
    if (itemPN === prodN) return true;

    // 3. Substring match if name is reasonably long (>= 3 chars)
    if (prodN.length >= 3 && itemPN.includes(prodN)) return true;
    if (itemPN.length >= 3 && prodN.includes(itemPN)) return true;

    return false;
  };

  const addInvoice = (newInvoice: Omit<Invoice, 'id'>) => {
    try {
      const orgPrefix = getOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.code);
      const usedInvoiceNumbers = new Set(
        invoices
          .map(invoice => invoice.id.match(/\/BILL\/(\d+)$/)?.[1])
          .filter(Boolean)
          .map(Number)
      );
      let nextInvoiceNumber = 459;
      while (usedInvoiceNumbers.has(nextInvoiceNumber)) nextInvoiceNumber += 1;
      const invoiceNo = `${orgPrefix}/2026/BILL/${nextInvoiceNumber}`;
      const paid = newInvoice.isPaid !== false ? newInvoice.paidAmount : 0;
      const bal = newInvoice.grandTotal - paid;
      const invoice: Invoice = {
        id: invoiceNo,
        tenantId: activeTenant.id,
        ...newInvoice,
        paidAmount: paid,
        balanceAmount: bal > 0 ? bal : 0,
        isPaid: newInvoice.isPaid !== false && bal <= 0
      };
      setInvoices([invoice, ...invoices]);

      // Check if payments for the linked job card already exist in payments table
      let existingJobPayments: Payment[] = [];
      if (newInvoice.linkedJobId) {
        existingJobPayments = payments.filter(p => 
          p.linkedJobId === newInvoice.linkedJobId ||
          (p.refNo && p.refNo.includes(newInvoice.linkedJobId!))
        );
      }

      if (existingJobPayments.length > 0) {
        // Link this invoice ID to those existing payment records so they connect to this bill without duplicating
        const totalAlreadyPaid = existingJobPayments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0);

        setPayments(prev => prev.map(p => {
          if (p.linkedJobId === newInvoice.linkedJobId || (p.refNo && p.refNo.includes(newInvoice.linkedJobId!))) {
            return {
              ...p,
              invoiceId: invoiceNo,
              clientName: p.clientName && p.clientName !== 'Unknown' ? p.clientName : newInvoice.clientName,
              refNo: p.refNo ? (p.refNo.includes(invoiceNo) ? p.refNo : `${p.refNo} / ${invoiceNo}`) : `Invoice ${invoiceNo} (Job #${newInvoice.linkedJobId})`,
              remarks: `Payment for Job Card #${newInvoice.linkedJobId} (Tax Invoice ${invoiceNo})`
            };
          }
          return p;
        }));

        // If invoice total paid is greater than what was already paid under this job card, record only the newly paid difference
        const newlyPaidDelta = Math.max(0, paid - totalAlreadyPaid);
        if (newlyPaidDelta > 0) {
          const deltaPaymentRecord: Payment = {
            id: `pay-${Date.now()}`,
            tenantId: activeTenant.id,
            date: newInvoice.date || new Date().toISOString().split('T')[0],
            clientId: newInvoice.clientId,
            clientName: newInvoice.clientName,
            amount: newlyPaidDelta,
            mode: newInvoice.paymentMode || 'UPI',
            refNo: `Invoice ${invoiceNo} (Bal Pay)`,
            remarks: `Additional balance payment for Tax Invoice ${invoiceNo} (Job #${newInvoice.linkedJobId})`,
            invoiceId: invoiceNo,
            linkedJobId: newInvoice.linkedJobId
          };
          setPayments(prev => [deltaPaymentRecord, ...prev]);

          // Deduct only newlyPaidDelta from client balance
          setClients(prev => prev.map(c => {
            if (c.id === newInvoice.clientId) {
              return {
                ...c,
                outstandingBalance: c.outstandingBalance - newlyPaidDelta
              };
            }
            return c;
          }));
        }
      } else if (paid > 0) {
        // No prior payment existed for this job/invoice -> record full paid amount
        const paymentRecord: Payment = {
          id: `pay-${Date.now()}`,
          tenantId: activeTenant.id,
          date: newInvoice.date || new Date().toISOString().split('T')[0],
          clientId: newInvoice.clientId,
          clientName: newInvoice.clientName,
          amount: paid,
          mode: newInvoice.paymentMode || 'UPI',
          refNo: `Invoice ${invoiceNo}`,
          remarks: newInvoice.linkedJobId
            ? `Payment for Job Card #${newInvoice.linkedJobId} (Tax Invoice ${invoiceNo})`
            : `Auto-recorded payment for Tax Invoice ${invoiceNo}`,
          invoiceId: invoiceNo,
          linkedJobId: newInvoice.linkedJobId
        };
        setPayments(prev => [paymentRecord, ...prev]);

        // Add ledger log for invoice payment
        const invPaymentLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: newInvoice.clientId,
          date: newInvoice.date || new Date().toLocaleDateString('en-IN'),
          type: 'Invoice Payment Received',
          refNo: invoiceNo,
          debit: 0,
          credit: paid,
          balance: (clients.find(c => c.id === newInvoice.clientId)?.outstandingBalance || 0) - paid
        };
        setLedger(prev => [invPaymentLedgerLog, ...prev]);

        setClients(prev => prev.map(c => {
          if (c.id === newInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance - paid
            };
          }
          return c;
        }));
      }

      // Sync linked repair job final bill amount and payment status
      if (newInvoice.linkedJobId) {
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.id === newInvoice.linkedJobId) {
            return {
              ...job,
              finalBillAmount: newInvoice.grandTotal,
              paymentStatus: (invoice.isPaid || invoice.balanceAmount <= 0) ? 'Paid' : 'Unpaid'
            };
          }
          return job;
        }));
      }

      // Automatically deduct product stock count for items in inventory
      if (newInvoice.items && newInvoice.items.length > 0) {
        setProducts(prevProducts => {
          const updated = prevProducts.map(prod => {
            const matchedItems = newInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod));
            if (matchedItems.length > 0) {
              const totalBilledQty = matchedItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
              const newStock = Math.max(0, prod.stock - totalBilledQty);
              return {
                ...prod,
                stock: newStock
              };
            }
            return prod;
          });
          setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updated));
          saveTenantCollectionToFirestore(activeTenant.id, 'products', updated);
          return updated;
        });
      }

      // Increment log
      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'BILL_GEN',
        details: `Generated tax invoice ${invoiceNo} for ${newInvoice.clientName} (₹${newInvoice.grandTotal}). Status: ${invoice.isPaid ? 'PAID' : 'UNPAID'}.`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Tax Invoice ${invoiceNo} generated & inventory stock updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to generate invoice: ${err.message}`, true);
    }
  };

  const updateInvoice = (updatedInvoice: Invoice) => {
    try {
      const oldInvoice = invoices.find(inv => inv.id === updatedInvoice.id);
      setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));

      // Calculate newly paid amount difference
      const oldPaid = oldInvoice ? oldInvoice.paidAmount : 0;
      const newlyPaid = updatedInvoice.paidAmount - oldPaid;

      if (newlyPaid > 0) {
        // Record payment in Payments tab automatically
        const paymentRecord: Payment = {
          id: `pay-${Date.now()}`,
          tenantId: activeTenant.id,
          date: updatedInvoice.date || new Date().toISOString().split('T')[0],
          clientId: updatedInvoice.clientId,
          clientName: updatedInvoice.clientName,
          amount: newlyPaid,
          mode: updatedInvoice.paymentMode || 'UPI',
          refNo: `Invoice ${updatedInvoice.id}`,
          remarks: `Payment received for Tax Invoice ${updatedInvoice.id} (${updatedInvoice.isPaid ? 'Marked as Paid' : 'Partial Settlement'})`,
          invoiceId: updatedInvoice.id,
          linkedJobId: updatedInvoice.linkedJobId
        };
        setPayments(prev => [paymentRecord, ...prev]);

        // Add ledger log
        const invPaymentLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: updatedInvoice.clientId,
          date: updatedInvoice.date || new Date().toLocaleDateString('en-IN'),
          type: 'Invoice Payment Received',
          refNo: updatedInvoice.id,
          debit: 0,
          credit: newlyPaid,
          balance: Math.max(0, (clients.find(c => c.id === updatedInvoice.clientId)?.outstandingBalance || 0) - newlyPaid)
        };
        setLedger(prev => [invPaymentLedgerLog, ...prev]);

        // Reduce client outstanding balance
        setClients(prev => prev.map(c => {
          if (c.id === updatedInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: Math.max(0, c.outstandingBalance - newlyPaid)
            };
          }
          return c;
        }));
      } else if (newlyPaid < 0) {
        const reversedAmount = Math.abs(newlyPaid);
        // Payment was marked UNPAID or reduced -> remove payment log for this invoice
        setPayments(prev => prev.filter(p => !(p.refNo && p.refNo.includes(updatedInvoice.id)) && p.invoiceId !== updatedInvoice.id));

        // Add reversal log in client ledger
        const invPaymentReversalLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: updatedInvoice.clientId,
          date: updatedInvoice.date || new Date().toLocaleDateString('en-IN'),
          type: 'Invoice Payment Reversed / Marked Unpaid',
          refNo: updatedInvoice.id,
          debit: reversedAmount,
          credit: 0,
          balance: (clients.find(c => c.id === updatedInvoice.clientId)?.outstandingBalance || 0) + reversedAmount
        };
        setLedger(prev => [invPaymentReversalLedgerLog, ...prev]);

        // Increase client outstanding balance back
        setClients(prev => prev.map(c => {
          if (c.id === updatedInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + reversedAmount
            };
          }
          return c;
        }));
      }

      // Sync linked repair job final bill amount and payment status
      if (updatedInvoice.linkedJobId) {
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.id === updatedInvoice.linkedJobId) {
            return {
              ...job,
              finalBillAmount: updatedInvoice.grandTotal,
              paymentStatus: (updatedInvoice.isPaid || updatedInvoice.balanceAmount <= 0) ? 'Paid' : 'Unpaid'
            };
          }
          return job;
        }));
      }

      // Adjust product stock counts based on item changes between oldInvoice and updatedInvoice
      setProducts(prevProducts => {
        const updated = prevProducts.map(prod => {
          const oldMatched = oldInvoice ? oldInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod)) : [];
          const newMatched = updatedInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod));

          const oldQty = oldMatched.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
          const newQty = newMatched.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

          const diffQty = newQty - oldQty;
          if (diffQty !== 0) {
            const newStock = Math.max(0, prod.stock - diffQty);
            return {
              ...prod,
              stock: newStock
            };
          }
          return prod;
        });
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updated));
        saveTenantCollectionToFirestore(activeTenant.id, 'products', updated);
        return updated;
      });

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'BILL_EDIT',
        details: `Updated tax invoice ${updatedInvoice.id} for ${updatedInvoice.clientName} (₹${updatedInvoice.grandTotal}). Status: ${updatedInvoice.isPaid ? 'PAID' : 'UNPAID'}.`
      };
      setLogs(prev => [audit, ...prev]);
      triggerSaveNotification(`✓ Tax Invoice ${updatedInvoice.id} updated & stock synced!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update invoice: ${err.message}`, true);
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      const targetInvoice = invoices.find(inv => inv.id === id);
      const nextInvoices = invoices.filter(inv => inv.id !== id);
      setInvoices(nextInvoices);
      setAppStorageItem(`invoices_${activeTenant.id}`, JSON.stringify(nextInvoices));

      let nextPayments = payments;
      let nextClients = clients;
      let nextJobs = jobs;
      let nextProducts = products;

      if (targetInvoice) {
        if (targetInvoice.paidAmount > 0) {
          // Remove payments recorded for this invoice
          nextPayments = payments.filter(p => !(p.refNo && p.refNo.includes(targetInvoice.id)) && p.invoiceId !== targetInvoice.id);
          setPayments(nextPayments);
          setAppStorageItem(`payments_${activeTenant.id}`, JSON.stringify(nextPayments));

          // Restore client outstanding balance
          nextClients = clients.map(c => {
            if (c.id === targetInvoice.clientId) {
              return {
                ...c,
                outstandingBalance: c.outstandingBalance + targetInvoice.paidAmount
              };
            }
            return c;
          });
          setClients(nextClients);
          setAppStorageItem(`clients_${activeTenant.id}`, JSON.stringify(nextClients));

          // Ledger reversal
          const reversalLog: ClientLedgerEntry = {
            id: `l-${Date.now()}`,
            tenantId: activeTenant.id,
            clientId: targetInvoice.clientId,
            date: new Date().toLocaleDateString('en-IN'),
            type: 'Invoice Deleted / Payment Voided',
            refNo: targetInvoice.id,
            debit: targetInvoice.paidAmount,
            credit: 0,
            balance: (clients.find(c => c.id === targetInvoice.clientId)?.outstandingBalance || 0) + targetInvoice.paidAmount
          };
          setLedger(prev => [reversalLog, ...prev]);
        }

        if (targetInvoice.linkedJobId) {
          nextJobs = jobs.map(job => {
            if (job.id === targetInvoice.linkedJobId) {
              return {
                ...job,
                paymentStatus: 'Unpaid'
              };
            }
            return job;
          });
          setJobs(nextJobs);
          setAppStorageItem(`jobs_${activeTenant.id}`, JSON.stringify(nextJobs));
        }

        // Restore inventory product stock counts for items in deleted invoice
        if (targetInvoice.items && targetInvoice.items.length > 0) {
          nextProducts = products.map(prod => {
            const matched = targetInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod));
            if (matched.length > 0) {
              const totalQtyToRestore = matched.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
              return {
                ...prod,
                stock: prod.stock + totalQtyToRestore
              };
            }
            return prod;
          });
          setProducts(nextProducts);
          setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(nextProducts));
        }
      }

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'BILL_DELETE',
        details: `Deleted tax invoice ${id} for ${targetInvoice?.clientName || 'Client'}.`
      };
      setLogs(prev => [audit, ...prev]);

      await saveTenantCollectionToFirestore(activeTenant.id, 'invoices', nextInvoices);
      if (nextPayments !== payments) await saveTenantCollectionToFirestore(activeTenant.id, 'payments', nextPayments);
      if (nextClients !== clients) await saveTenantCollectionToFirestore(activeTenant.id, 'clients', nextClients);
      if (nextJobs !== jobs) await saveTenantCollectionToFirestore(activeTenant.id, 'jobs', nextJobs);
      if (nextProducts !== products) await saveTenantCollectionToFirestore(activeTenant.id, 'products', nextProducts);

      triggerSaveNotification(`✓ Tax Invoice ${id} deleted & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete invoice: ${err.message}`, true);
    }
  };

  const addProduct = async (newProd: Omit<Product, 'id'>) => {
    try {
      const prod: Product = {
        id: `prod-${Date.now()}`,
        tenantId: activeTenant.id,
        ...newProd
      };
      const nextProducts = [...products, prod];
      setProducts(nextProducts);
      setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(nextProducts));
      await saveTenantCollectionToFirestore(activeTenant.id, 'products', nextProducts);
      triggerSaveNotification(`✓ Product "${newProd.name}" added to inventory & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to add product: ${err.message}`, true);
    }
  };

  const editProduct = async (updatedProd: Product) => {
    try {
      const nextProducts = products.map(p => p.id === updatedProd.id ? updatedProd : p);
      setProducts(nextProducts);
      setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(nextProducts));
      await saveTenantCollectionToFirestore(activeTenant.id, 'products', nextProducts);
      triggerSaveNotification(`✓ Product "${updatedProd.name}" updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to edit product: ${err.message}`, true);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const p = products.find(prod => prod.id === id);
      const nextProducts = products.filter(prod => prod.id !== id);
      setProducts(nextProducts);
      setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(nextProducts));
      await saveTenantCollectionToFirestore(activeTenant.id, 'products', nextProducts);
      triggerSaveNotification(`✓ Product "${p?.name || id}" removed & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete product: ${err.message}`, true);
    }
  };

  const updateLedgerEntry = async (updatedEntry: ClientLedgerEntry) => {
    try {
      const updatedLedger = ledger.map(l => l.id === updatedEntry.id ? updatedEntry : l);
      setLedger(updatedLedger);
      setAppStorageItem(`ledger_${activeTenant.id}`, JSON.stringify(updatedLedger));
      await saveTenantCollectionToFirestore(activeTenant.id, 'ledger', updatedLedger);

      if (updatedEntry.clientId) {
        const clientLogs = updatedLedger.filter(l => l.clientId === updatedEntry.clientId);
        const totalDebit = clientLogs.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = clientLogs.reduce((sum, l) => sum + (l.credit || 0), 0);
        const newBalance = totalDebit - totalCredit;

        const nextClients = clients.map(c => c.id === updatedEntry.clientId ? { ...c, outstandingBalance: newBalance } : c);
        setClients(nextClients);
        setAppStorageItem(`clients_${activeTenant.id}`, JSON.stringify(nextClients));
        await saveTenantCollectionToFirestore(activeTenant.id, 'clients', nextClients);
      }
      triggerSaveNotification(`✓ Client ledger transaction updated & balance recalculation completed!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update ledger transaction: ${err.message}`, true);
    }
  };

  const addExpense = async (newExp: Omit<Expense, 'id'>) => {
    try {
      const now = new Date().toISOString();
      const exp: Expense = {
        id: `exp-${Date.now()}`,
        tenantId: activeTenant.id,
        createdAt: now,
        updatedAt: now,
        ...newExp
      };
      const nextExpenses = [exp, ...expenses];
      setExpenses(nextExpenses);
      expensesRef.current = nextExpenses;
      setAppStorageItem(`expenses_${activeTenant.id}`, JSON.stringify(nextExpenses));
      await saveTenantCollectionToFirestore(activeTenant.id, 'expenses', nextExpenses);
      triggerSaveNotification(`✓ Expense ₹${newExp.amount} recorded & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save expense: ${err.message}`, true);
    }
  };

  const updateExpense = async (updatedExp: Expense) => {
    try {
      const now = new Date().toISOString();
      const patchedExp = { ...updatedExp, updatedAt: now };
      const nextExpenses = expenses.map(e => e.id === updatedExp.id ? patchedExp : e);
      setExpenses(nextExpenses);
      expensesRef.current = nextExpenses;
      setAppStorageItem(`expenses_${activeTenant.id}`, JSON.stringify(nextExpenses));
      await saveTenantCollectionToFirestore(activeTenant.id, 'expenses', nextExpenses);
      triggerSaveNotification(`✓ Expense updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update expense: ${err.message}`, true);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const nextExpenses = expenses.filter(e => e.id !== id);
      setExpenses(nextExpenses);
      expensesRef.current = nextExpenses;
      setAppStorageItem(`expenses_${activeTenant.id}`, JSON.stringify(nextExpenses));
      await saveTenantCollectionToFirestore(activeTenant.id, 'expenses', nextExpenses, [id]);
      triggerSaveNotification(`✓ Expense entry deleted & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete expense: ${err.message}`, true);
    }
  };

  const addUser = async (newUser: Omit<SystemUser, 'id'>) => {
    try {
      const u: SystemUser = {
        id: `user-${Date.now()}`,
        tenantId: activeTenant.id,
        status: 'Active',
        isDeactivated: false,
        ...newUser
      };
      const updatedUsers = [...users, u];
      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));
      await saveTenantCollectionToFirestore(activeTenant.id, 'users', updatedUsers);
      triggerSaveNotification(`✓ User account "${newUser.name}" (${newUser.role}) created & activated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save user account: ${err.message}`, true);
    }
  };

  const updateUser = async (updatedUser: SystemUser) => {
    try {
      const updatedUsers = users.map(usr => usr.id === updatedUser.id ? { ...usr, ...updatedUser, tenantId: activeTenant.id } : usr);
      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));

      // Update currentUser in state and session if editing current user
      if (currentUser && (currentUser.id === updatedUser.id || (currentUser.username && updatedUser.username && currentUser.username.toLowerCase() === updatedUser.username.toLowerCase()))) {
        const mergedUser = { ...currentUser, ...updatedUser };
        setCurrentUser(mergedUser);
        setAppSessionItem('current_user', JSON.stringify(mergedUser));
        if (updatedUser.role) {
          setUserRole(updatedUser.role);
          setAppSessionItem('user_role', updatedUser.role);
        }
      }

      await saveTenantCollectionToFirestore(activeTenant.id, 'users', updatedUsers);
      triggerSaveNotification(`✓ Account "${updatedUser.name}" (${updatedUser.role}) updated successfully!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update user account: ${err.message}`, true);
    }
  };

  const toggleUserStatus = async (id: string) => {
    try {
      const u = users.find(usr => usr.id === id);
      if (!u) return;

      const isCurrentlyDeactivated = u.isDeactivated || u.status === 'Deactivated';

      // Protect against deactivating Master System Admin (+91 8149862034)
      if (u.mobile?.includes('8149862034') && !isCurrentlyDeactivated) {
        const remainingMasterAdmins = users.filter(usr => usr.mobile?.includes('8149862034') && usr.id !== id && !usr.isDeactivated && usr.status !== 'Deactivated');
        if (remainingMasterAdmins.length === 0) {
          triggerSaveNotification('🛡️ Security Protection: Master System Admin account (+91 8149862034) cannot be deactivated!', true);
          return;
        }
      }

      // If deactivating an Admin, ensure at least 1 active Admin remains
      if (!isCurrentlyDeactivated && u.role === 'Admin') {
        const remainingActiveAdmins = users.filter(usr => usr.role === 'Admin' && usr.id !== id && !usr.isDeactivated && usr.status !== 'Deactivated');
        if (remainingActiveAdmins.length === 0) {
          triggerSaveNotification('🛡️ Protection: You cannot deactivate the only active Admin account! Keep at least one active Admin.', true);
          return;
        }
      }

      const updatedUsers = users.map(usr => {
        if (usr.id === id) {
          const nextDeactivated = !isCurrentlyDeactivated;
          return {
            ...usr,
            isDeactivated: nextDeactivated,
            status: (nextDeactivated ? 'Deactivated' : 'Active') as 'Active' | 'Deactivated'
          };
        }
        return usr;
      });

      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));
      await saveTenantCollectionToFirestore(activeTenant.id, 'users', updatedUsers);
      const actionLabel = isCurrentlyDeactivated ? 'Activated' : 'Deactivated';
      triggerSaveNotification(`✓ Account "${u.name}" (${u.role}) ${actionLabel}!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to change account status: ${err.message}`, true);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const u = users.find(usr => usr.id === id);
      if (u) {
        if (u.mobile?.includes('8149862034')) {
          const remainingMasterAdmins = users.filter(usr => usr.mobile?.includes('8149862034') && usr.id !== id);
          if (remainingMasterAdmins.length === 0) {
            triggerSaveNotification('🛡️ Security Protection: Master System Admin account (+91 8149862034) cannot be deleted!', true);
            return;
          }
        }
        if (u.role === 'Admin') {
          const remainingAdmins = users.filter(usr => usr.role === 'Admin' && usr.id !== id);
          if (remainingAdmins.length === 0) {
            triggerSaveNotification('🛡️ Protection: You must keep at least 1 Admin account!', true);
            return;
          }
        }
      }

      const updatedUsers = users.filter(usr => usr.id !== id);
      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));
      await saveTenantCollectionToFirestore(activeTenant.id, 'users', updatedUsers);
      triggerSaveNotification(`✓ Account "${u?.name || id}" (${u?.role || 'User'}) permanently deleted & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete user: ${err.message}`, true);
    }
  };

  const addCategory = async (name: string) => {
    try {
      const next = [...categories, { id: `cat-${Date.now()}`, tenantId: activeTenant.id, name: name.toUpperCase() }];
      setCategories(next);
      setAppStorageItem(`categories_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'categories', next);
      triggerSaveNotification(`✓ Category "${name}" added & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding category: ${err.message}`, true);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const next = categories.filter(c => c.id !== id);
      setCategories(next);
      setAppStorageItem(`categories_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'categories', next);
      triggerSaveNotification(`✓ Category removed & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error deleting category: ${err.message}`, true);
    }
  };

  const addRack = async (name: string) => {
    try {
      const next = [...racks, { id: `rack-${Date.now()}`, tenantId: activeTenant.id, name }];
      setRacks(next);
      setAppStorageItem(`racks_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'racks', next);
      triggerSaveNotification(`✓ Location rack "${name}" added & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding rack: ${err.message}`, true);
    }
  };

  const deleteRack = async (id: string) => {
    try {
      const next = racks.filter(r => r.id !== id);
      setRacks(next);
      setAppStorageItem(`racks_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'racks', next);
      triggerSaveNotification(`✓ Rack location removed & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error deleting rack: ${err.message}`, true);
    }
  };

  const addEquipment = async (name: string) => {
    try {
      const next = [...equipments, { id: `eq-${Date.now()}`, tenantId: activeTenant.id, name: name.toUpperCase() }];
      setEquipments(next);
      setAppStorageItem(`equipments_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'equipments', next);
      triggerSaveNotification(`✓ Equipment type "${name}" saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding equipment: ${err.message}`, true);
    }
  };

  const deleteEquipment = async (id: string) => {
    try {
      const next = equipments.filter(e => e.id !== id);
      setEquipments(next);
      setAppStorageItem(`equipments_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'equipments', next);
      triggerSaveNotification(`✓ Equipment type deleted & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error deleting equipment: ${err.message}`, true);
    }
  };

  const addProblem = async (name: string) => {
    try {
      const next = [...problems, { id: `pb-${Date.now()}`, tenantId: activeTenant.id, name: name.toUpperCase() }];
      setProblems(next);
      setAppStorageItem(`problems_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'problems', next);
      triggerSaveNotification(`✓ Problem fault "${name}" saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding problem: ${err.message}`, true);
    }
  };

  const deleteProblem = async (id: string) => {
    try {
      const next = problems.filter(p => p.id !== id);
      setProblems(next);
      setAppStorageItem(`problems_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'problems', next);
      triggerSaveNotification(`✓ Problem fault deleted & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error deleting problem: ${err.message}`, true);
    }
  };

  // ==================== SUPPLIERS HANDLERS ====================
  const addSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
    try {
      const newSupplier: Supplier = {
        id: `supp-${Date.now()}`,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...supplierData
      };
      const next = [...suppliers, newSupplier];
      setSuppliers(next);
      setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', next);
      triggerSaveNotification(`✓ Supplier "${newSupplier.name}" added successfully!`);
      return newSupplier;
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to add supplier: ${err.message}`, true);
      return undefined;
    }
  };

  const updateSupplier = async (updatedSupplier: Supplier) => {
    try {
      const next = suppliers.map(s => s.id === updatedSupplier.id ? { ...s, ...updatedSupplier, tenantId: activeTenant.id } : s);
      setSuppliers(next);
      setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', next);
      triggerSaveNotification(`✓ Supplier "${updatedSupplier.name}" updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update supplier: ${err.message}`, true);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      const supp = suppliers.find(s => s.id === id);
      const next = suppliers.filter(s => s.id !== id);
      setSuppliers(next);
      setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', next);
      triggerSaveNotification(`✓ Supplier "${supp?.name || id}" removed.`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete supplier: ${err.message}`, true);
    }
  };

  // ==================== SERVICE PARTNERS HANDLERS ====================
  const addServicePartner = async (partnerData: Omit<ServicePartner, 'id'>) => {
    try {
      const newPartner: ServicePartner = {
        id: `sp-${Date.now()}`,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...partnerData
      };
      const next = [...servicePartners, newPartner];
      setServicePartners(next);
      setAppStorageItem(`servicePartners_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'service_partners', next);
      triggerSaveNotification(`✓ Service partner "${newPartner.name}" added!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to add service partner: ${err.message}`, true);
    }
  };

  const updateServicePartner = async (updatedPartner: ServicePartner) => {
    try {
      const next = servicePartners.map(p => p.id === updatedPartner.id ? { ...p, ...updatedPartner, tenantId: activeTenant.id } : p);
      setServicePartners(next);
      setAppStorageItem(`servicePartners_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'service_partners', next);
      triggerSaveNotification(`✓ Service partner "${updatedPartner.name}" updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update service partner: ${err.message}`, true);
    }
  };

  const deleteServicePartner = async (id: string) => {
    try {
      const partner = servicePartners.find(p => p.id === id);
      const next = servicePartners.filter(p => p.id !== id);
      setServicePartners(next);
      setAppStorageItem(`servicePartners_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'service_partners', next);
      triggerSaveNotification(`✓ Service partner "${partner?.name || id}" removed.`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete service partner: ${err.message}`, true);
    }
  };

  // ==================== PURCHASES & STOCK TRANSACTIONS ====================
  const addPurchase = async (purchaseData: Omit<Purchase, 'id'>) => {
    try {
      const purchaseId = `PUR-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(purchases.length + 1).toString().padStart(3, '0')}`;
      const newPurchase: Purchase = {
        id: purchaseId,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...purchaseData
      };
      const nextPurchases = [newPurchase, ...purchases];
      setPurchases(nextPurchases);
      setAppStorageItem(`purchases_${activeTenant.id}`, JSON.stringify(nextPurchases));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchases', nextPurchases);

      // If linked to a Purchase Order, auto-mark that PO as Received
      if (newPurchase.purchaseOrderRef) {
        const targetPoId = newPurchase.purchaseOrderRef;
        const poIndex = purchaseOrders.findIndex(po => po.id === targetPoId || (po.poNumber && po.poNumber === targetPoId));
        if (poIndex >= 0 && purchaseOrders[poIndex].status !== 'Received') {
          const updatedPOs = purchaseOrders.map((po, idx) => idx === poIndex ? { ...po, status: 'Received' as const } : po);
          setPurchaseOrders(updatedPOs);
          setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(updatedPOs));
          setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(updatedPOs));
          await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', updatedPOs);
        }
      }

      // Auto-update Product Stock & create InventoryTransactions if Received or Active
      if ((newPurchase.status === 'Received' || (newPurchase.status as any) === 'Active') && newPurchase.items && newPurchase.items.length > 0) {
        let updatedProducts = [...products];
        let newTransactions: InventoryTransaction[] = [...inventoryTransactions];
        let newSerials: InventorySerial[] = [...inventorySerials];

        for (const item of newPurchase.items) {
          const qty = Number(item.quantity || item.qty || 1);
          const rate = Number(item.unitCost || item.rate || 0);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const updatedStock = currentStock + qty;
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: updatedStock,
              stockQty: updatedStock,
              costPrice: rate || updatedProducts[pIndex].costPrice,
              purchasePrice: rate || updatedProducts[pIndex].purchasePrice,
              updatedAt: new Date().toISOString()
            };

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: updatedProducts[pIndex].id,
              productName: item.productName,
              type: 'Purchase',
              quantity: qty,
              previousStock: currentStock,
              currentStock: updatedStock,
              referenceId: purchaseId,
              referenceType: 'Purchase',
              date: newPurchase.purchaseDate || newPurchase.date || new Date().toISOString().split('T')[0],
              notes: `Stock in from Purchase Bill #${newPurchase.billNumber || newPurchase.referenceNumber || purchaseId}${newPurchase.purchaseOrderRef ? ` (Ref PO: ${newPurchase.purchaseOrderRef})` : ''}`
            });

            // If item has serial numbers
            const rawSerials = Array.isArray(item.serialNumbers)
              ? item.serialNumbers
              : typeof item.serialNumbers === 'string' && (item.serialNumbers as string).trim().length > 0
              ? (item.serialNumbers as string).split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];

            if (rawSerials.length > 0) {
              for (const sn of rawSerials) {
                newSerials.push({
                  id: `sn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  tenantId: activeTenant.id,
                  productId: updatedProducts[pIndex].id,
                  serialNumber: sn,
                  purchaseId: purchaseId,
                  status: 'In Stock',
                  warrantyExpiry: item.warrantyExpiry,
                  costPrice: rate
                });
              }
            }
          } else {
            // New product typed into Purchase Bill: automatically create & register in inventory catalog
            const newProdId = item.productId && !item.productId.startsWith('temp-')
              ? item.productId
              : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const sellingPriceEst = rate > 0 ? Math.round(rate * 1.25) : 0;

            const createdProduct: Product = {
              id: newProdId,
              tenantId: activeTenant.id,
              name: item.productName.trim(),
              category: item.category || 'Spare Parts',
              brand: (item as any).brand || '',
              stock: qty,
              stockQty: qty,
              minStockAlert: 2,
              minQtyAlert: 2,
              costPrice: rate,
              purchasePrice: rate,
              sellingPrice: sellingPriceEst,
              price: sellingPriceEst,
              hsnCode: (item as any).hsnCode || '847330',
              gstRate: item.taxPercent !== undefined ? item.taxPercent : 18,
              unit: 'Pcs',
              isActive: true,
              location: 'Main Store',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            updatedProducts.unshift(createdProduct);

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: createdProduct.id,
              productName: item.productName,
              type: 'Purchase',
              quantity: qty,
              previousStock: 0,
              currentStock: qty,
              referenceId: purchaseId,
              referenceType: 'Purchase',
              date: newPurchase.purchaseDate || newPurchase.date || new Date().toISOString().split('T')[0],
              notes: `Initial stock from Purchase Bill #${newPurchase.billNumber || newPurchase.referenceNumber || purchaseId}${newPurchase.purchaseOrderRef ? ` (Ref PO: ${newPurchase.purchaseOrderRef})` : ''}`
            });

            const rawSerials = Array.isArray(item.serialNumbers)
              ? item.serialNumbers
              : typeof item.serialNumbers === 'string' && (item.serialNumbers as string).trim().length > 0
              ? (item.serialNumbers as string).split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];

            if (rawSerials.length > 0) {
              for (const sn of rawSerials) {
                newSerials.push({
                  id: `sn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  tenantId: activeTenant.id,
                  productId: createdProduct.id,
                  serialNumber: sn,
                  purchaseId: purchaseId,
                  status: 'In Stock',
                  warrantyExpiry: item.warrantyExpiry,
                  costPrice: rate
                });
              }
            }
          }
        }

        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);

        setInventoryTransactions(newTransactions);
        setAppStorageItem(`inventoryTransactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        setAppStorageItem(`inventory_transactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        await saveTenantCollectionToFirestore(activeTenant.id, 'inventory_transactions', newTransactions);

        if (newSerials.length !== inventorySerials.length) {
          setInventorySerials(newSerials);
          setAppStorageItem(`inventorySerials_${activeTenant.id}`, JSON.stringify(newSerials));
          setAppStorageItem(`inventory_serials_${activeTenant.id}`, JSON.stringify(newSerials));
          await saveTenantCollectionToFirestore(activeTenant.id, 'inventory_serials', newSerials);
        }
      }

      // If initial payment was made with the purchase bill, automatically log SupplierPayment
      if (newPurchase.paidAmount && newPurchase.paidAmount > 0 && newPurchase.supplierId) {
        const spId = `SPAY-${Date.now()}`;
        const autoSupplierPayment: SupplierPayment = {
          id: spId,
          tenantId: activeTenant.id,
          supplierId: newPurchase.supplierId,
          supplierName: newPurchase.supplierName || suppliers.find(s => s.id === newPurchase.supplierId)?.name || 'Supplier',
          amount: newPurchase.paidAmount,
          date: newPurchase.date || newPurchase.purchaseDate || new Date().toISOString().split('T')[0],
          paymentMode: ((newPurchase as any).paymentMode as any) || 'Cash',
          referenceNo: newPurchase.referenceNumber || `Bill #${purchaseId}`,
          notes: `Direct payment recorded upon inwarding purchase bill #${purchaseId}`,
          allocations: [{
            purchaseId: purchaseId,
            purchaseNumber: purchaseId,
            allocatedAmount: newPurchase.paidAmount
          }],
          unallocatedAmount: 0,
          createdAt: new Date().toISOString()
        };
        const nextSupplierPays = [autoSupplierPayment, ...supplierPayments];
        setSupplierPayments(nextSupplierPays);
        setAppStorageItem(`supplierPayments_${activeTenant.id}`, JSON.stringify(nextSupplierPays));
        setAppStorageItem(`supplier_payments_${activeTenant.id}`, JSON.stringify(nextSupplierPays));
        await saveTenantCollectionToFirestore(activeTenant.id, 'supplier_payments', nextSupplierPays);
      }

      // Update Supplier balance for unpaid or balance amount
      if (newPurchase.supplierId && (newPurchase.balanceAmount || 0) > 0) {
        const supp = suppliers.find(s => s.id === newPurchase.supplierId);
        if (supp) {
          const updatedSuppliers = suppliers.map(s => s.id === supp.id ? { ...s, balance: (s.balance || 0) + (newPurchase.balanceAmount || 0) } : s);
          setSuppliers(updatedSuppliers);
          setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
          await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
        }
      }

      triggerSaveNotification(`✓ Purchase Bill "${purchaseId}" recorded & synced across stock & payments!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to record purchase: ${err.message}`, true);
    }
  };

  const updatePurchase = async (updatedPurchase: Purchase) => {
    try {
      const oldPurchase = purchases.find(p => p.id === updatedPurchase.id);
      const next = purchases.map(p => p.id === updatedPurchase.id ? { ...p, ...updatedPurchase, tenantId: activeTenant.id } : p);
      setPurchases(next);
      setAppStorageItem(`purchases_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchases', next);

      // Sync inventory stock adjustments between old and updated purchase items
      if (oldPurchase && (oldPurchase.status === 'Received' || (oldPurchase.status as any) === 'Active')) {
        let updatedProducts = [...products];
        let newTransactions = [...inventoryTransactions];

        // 1. Revert quantities from old purchase
        for (const item of oldPurchase.items || []) {
          const qty = Number(item.quantity || item.qty || 1);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const revertedStock = Math.max(0, currentStock - qty);
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: revertedStock,
              stockQty: revertedStock
            };
          }
        }

        // 2. Apply updated quantities (if still Active or Received)
        if (updatedPurchase.status === 'Received' || (updatedPurchase.status as any) === 'Active') {
          for (const item of updatedPurchase.items || []) {
            const qty = Number(item.quantity || item.qty || 1);
            const rate = Number(item.unitCost || item.rate || 0);
            const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
            if (pIndex >= 0) {
              const currentStock = updatedProducts[pIndex].stock || 0;
              const appliedStock = currentStock + qty;
              updatedProducts[pIndex] = {
                ...updatedProducts[pIndex],
                stock: appliedStock,
                stockQty: appliedStock,
                costPrice: rate || updatedProducts[pIndex].costPrice,
                purchasePrice: rate || updatedProducts[pIndex].purchasePrice,
                updatedAt: new Date().toISOString()
              };

              newTransactions.unshift({
                id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                tenantId: activeTenant.id,
                productId: updatedProducts[pIndex].id,
                productName: item.productName,
                type: 'Purchase',
                quantity: qty,
                previousStock: currentStock,
                currentStock: appliedStock,
                referenceId: updatedPurchase.id,
                referenceType: 'Purchase',
                date: updatedPurchase.purchaseDate || updatedPurchase.date || new Date().toISOString().split('T')[0],
                notes: `Stock updated from edited Purchase Bill #${updatedPurchase.billNumber || updatedPurchase.referenceNumber || updatedPurchase.id}`
              });
            } else {
              // Newly added product
              const newProdId = item.productId && !item.productId.startsWith('temp-')
                ? item.productId
                : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
              const sellingPriceEst = rate > 0 ? Math.round(rate * 1.25) : 0;
              const newProd: Product = {
                id: newProdId,
                tenantId: activeTenant.id,
                name: item.productName.trim(),
                category: item.category || 'Spare Parts',
                brand: '',
                stock: qty,
                stockQty: qty,
                minStockAlert: 2,
                minQtyAlert: 2,
                costPrice: rate,
                purchasePrice: rate,
                sellingPrice: sellingPriceEst,
                price: sellingPriceEst,
                hsnCode: '847330',
                gstRate: item.taxPercent !== undefined ? item.taxPercent : 18,
                unit: 'Pcs',
                isActive: true,
                location: 'Main Store',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              updatedProducts.unshift(newProd);
            }
          }
        }

        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);

        setInventoryTransactions(newTransactions);
        setAppStorageItem(`inventoryTransactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        setAppStorageItem(`inventory_transactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        await saveTenantCollectionToFirestore(activeTenant.id, 'inventory_transactions', newTransactions);
      }

      // Adjust supplier balance if balanceAmount changed
      if (oldPurchase && updatedPurchase.supplierId) {
        const oldBal = Number(oldPurchase.balanceAmount || 0);
        const newBal = Number(updatedPurchase.balanceAmount || 0);
        const balDelta = newBal - oldBal;
        if (balDelta !== 0) {
          const updatedSuppliers = suppliers.map(s => s.id === updatedPurchase.supplierId ? { ...s, balance: Math.max(0, (s.balance || 0) + balDelta) } : s);
          setSuppliers(updatedSuppliers);
          setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
          await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
        }
      }

      // Mark linked PO as Received if present
      if (updatedPurchase.purchaseOrderRef) {
        const targetPoId = updatedPurchase.purchaseOrderRef;
        const poIndex = purchaseOrders.findIndex(po => po.id === targetPoId || (po.poNumber && po.poNumber === targetPoId));
        if (poIndex >= 0 && purchaseOrders[poIndex].status !== 'Received') {
          const updatedPOs = purchaseOrders.map((po, idx) => idx === poIndex ? { ...po, status: 'Received' as const } : po);
          setPurchaseOrders(updatedPOs);
          setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(updatedPOs));
          setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(updatedPOs));
          await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', updatedPOs);
        }
      }

      triggerSaveNotification(`✓ Purchase "${updatedPurchase.id}" updated & stock synced!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update purchase: ${err.message}`, true);
    }
  };

  const cancelPurchase = async (id: string, reason: string) => {
    try {
      const target = purchases.find(p => p.id === id);
      if (!target) return;

      const next = purchases.map(p => p.id === id ? { ...p, status: 'Cancelled' as const, remarks: `${p.remarks || ''} [Cancelled: ${reason}]` } : p);
      setPurchases(next);
      setAppStorageItem(`purchases_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchases', next);

      // Revert stock if it was Received or Active
      if ((target.status === 'Received' || (target.status as any) === 'Active') && target.items) {
        let updatedProducts = [...products];
        for (const item of target.items) {
          const qty = Number(item.quantity || item.qty || 1);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const newStock = Math.max(0, currentStock - qty);
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: newStock,
              stockQty: newStock,
              updatedAt: new Date().toISOString()
            };
          }
        }
        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);
      }

      // Revert supplier balance by the unpaid amount of this cancelled purchase
      if (target.supplierId) {
        const balanceToDeduct = Number(target.balanceAmount !== undefined ? target.balanceAmount : target.grandTotal);
        if (balanceToDeduct > 0) {
          const updatedSuppliers = suppliers.map(s => s.id === target.supplierId ? { ...s, balance: Math.max(0, (s.balance || 0) - balanceToDeduct) } : s);
          setSuppliers(updatedSuppliers);
          setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
          await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
        }
      }

      // If this purchase was linked to a PO, reopen the PO to Ordered status
      if (target.purchaseOrderRef) {
        const targetPoId = target.purchaseOrderRef;
        const poIndex = purchaseOrders.findIndex(po => po.id === targetPoId || (po.poNumber && po.poNumber === targetPoId));
        if (poIndex >= 0 && purchaseOrders[poIndex].status === 'Received') {
          const updatedPOs = purchaseOrders.map((po, idx) => idx === poIndex ? { ...po, status: 'Ordered' as const } : po);
          setPurchaseOrders(updatedPOs);
          setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(updatedPOs));
          setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(updatedPOs));
          await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', updatedPOs);
        }
      }

      triggerSaveNotification(`✓ Purchase "${id}" marked as cancelled & balances adjusted.`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to cancel purchase: ${err.message}`, true);
    }
  };

  const deletePurchase = async (id: string) => {
    try {
      const target = purchases.find(p => p.id === id);
      if (!target) return;

      const next = purchases.filter(p => p.id !== id);
      setPurchases(next);
      setAppStorageItem(`purchases_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchases', next);

      // Revert stock if it was Received or Active
      if ((target.status === 'Received' || (target.status as any) === 'Active') && target.items) {
        let updatedProducts = [...products];
        for (const item of target.items) {
          const qty = Number(item.quantity || item.qty || 1);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const newStock = Math.max(0, currentStock - qty);
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: newStock,
              stockQty: newStock,
              updatedAt: new Date().toISOString()
            };
          }
        }
        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);
      }

      // Revert supplier balance by the unpaid amount of this purchase
      if (target.supplierId) {
        const balanceToDeduct = Number(target.balanceAmount !== undefined ? target.balanceAmount : target.grandTotal);
        if (balanceToDeduct > 0) {
          const updatedSuppliers = suppliers.map(s => s.id === target.supplierId ? { ...s, balance: Math.max(0, (s.balance || 0) - balanceToDeduct) } : s);
          setSuppliers(updatedSuppliers);
          setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
          await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
        }
      }

      triggerSaveNotification(`✓ Purchase "${id}" deleted & stock/balances reverted.`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete purchase: ${err.message}`, true);
    }
  };

  // ==================== PURCHASE ORDERS ====================
  const addPurchaseOrder = async (poData: Omit<PurchaseOrder, 'id'>) => {
    try {
      const poId = `PO-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(purchaseOrders.length + 1).toString().padStart(3, '0')}`;
      const newPO: PurchaseOrder = {
        id: poId,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...poData
      };
      const next = [newPO, ...purchaseOrders];
      setPurchaseOrders(next);
      setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(next));
      setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', next);

      // Auto-register any newly typed products from PO into inventory catalog
      if (newPO.items && newPO.items.length > 0) {
        let updatedProducts = [...products];
        let hasNewProd = false;
        for (const it of newPO.items) {
          const exists = updatedProducts.some(p => p.id === it.productId || p.name.toLowerCase() === it.productName.toLowerCase());
          if (!exists && it.productName && it.productName.trim()) {
            hasNewProd = true;
            const newProdId = it.productId && !it.productId.startsWith('temp-')
              ? it.productId
              : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const rate = Number(it.rate || it.unitPrice || it.estimatedUnitPrice || 0);
            const sellingPriceEst = rate > 0 ? Math.round(rate * 1.25) : 0;
            updatedProducts.unshift({
              id: newProdId,
              tenantId: activeTenant.id,
              name: it.productName.trim(),
              category: it.category || 'Spare Parts',
              stock: 0,
              stockQty: 0,
              minStockAlert: 2,
              minQtyAlert: 2,
              costPrice: rate,
              purchasePrice: rate,
              sellingPrice: sellingPriceEst,
              price: sellingPriceEst,
              hsnCode: '847330',
              gstRate: it.taxPercent !== undefined ? it.taxPercent : 18,
              unit: 'Pcs',
              isActive: true,
              location: 'Main Store',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
        if (hasNewProd) {
          setProducts(updatedProducts);
          setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
          await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);
        }
      }

      triggerSaveNotification(`✓ Purchase Order "${poId}" generated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to create purchase order: ${err.message}`, true);
    }
  };

  const updatePurchaseOrder = async (updatedPO: PurchaseOrder) => {
    try {
      const oldPO = purchaseOrders.find(p => p.id === updatedPO.id);
      const next = purchaseOrders.map(p => p.id === updatedPO.id ? { ...p, ...updatedPO, tenantId: activeTenant.id } : p);
      setPurchaseOrders(next);
      setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(next));
      setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', next);

      // If status changed to 'Received' from another status, automatically inward goods into stock
      if (updatedPO.status === 'Received' && oldPO && oldPO.status !== 'Received' && updatedPO.items && updatedPO.items.length > 0) {
        let updatedProducts = [...products];
        let newTransactions = [...inventoryTransactions];

        for (const item of updatedPO.items) {
          const qty = Number(item.qty || item.quantity || 1);
          const rate = Number(item.rate || item.unitPrice || item.estimatedUnitPrice || 0);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());

          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const updatedStock = currentStock + qty;
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: updatedStock,
              stockQty: updatedStock,
              costPrice: rate || updatedProducts[pIndex].costPrice,
              purchasePrice: rate || updatedProducts[pIndex].purchasePrice,
              updatedAt: new Date().toISOString()
            };

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: updatedProducts[pIndex].id,
              productName: item.productName,
              type: 'Purchase',
              quantity: qty,
              previousStock: currentStock,
              currentStock: updatedStock,
              referenceId: updatedPO.id,
              referenceType: 'Purchase',
              date: new Date().toISOString().split('T')[0],
              notes: `Stock inwarded from Purchase Order #${updatedPO.id}`
            });
          } else {
            const newProdId = item.productId && !item.productId.startsWith('temp-')
              ? item.productId
              : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const sellingPriceEst = rate > 0 ? Math.round(rate * 1.25) : 0;
            const newProduct: Product = {
              id: newProdId,
              tenantId: activeTenant.id,
              name: item.productName.trim(),
              category: item.category || 'Spare Parts',
              brand: '',
              stock: qty,
              stockQty: qty,
              minStockAlert: 2,
              minQtyAlert: 2,
              costPrice: rate,
              purchasePrice: rate,
              sellingPrice: sellingPriceEst,
              price: sellingPriceEst,
              hsnCode: '847330',
              gstRate: item.taxPercent !== undefined ? item.taxPercent : 18,
              unit: 'Pcs',
              isActive: true,
              location: 'Main Store',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            updatedProducts.unshift(newProduct);

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: newProduct.id,
              productName: item.productName,
              type: 'Purchase',
              quantity: qty,
              previousStock: 0,
              currentStock: qty,
              referenceId: updatedPO.id,
              referenceType: 'Purchase',
              date: new Date().toISOString().split('T')[0],
              notes: `Initial stock inwarded from Purchase Order #${updatedPO.id}`
            });
          }
        }

        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);

        setInventoryTransactions(newTransactions);
        setAppStorageItem(`inventoryTransactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        setAppStorageItem(`inventory_transactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        await saveTenantCollectionToFirestore(activeTenant.id, 'inventory_transactions', newTransactions);
      }

      triggerSaveNotification(`✓ Purchase Order "${updatedPO.id}" updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update PO: ${err.message}`, true);
    }
  };

  const receivePurchaseOrder = async (poId: string) => {
    try {
      const target = purchaseOrders.find(p => p.id === poId);
      if (!target) return;
      if (target.status === 'Received') {
        triggerSaveNotification(`⚠️ Purchase Order "${poId}" is already marked as Received.`);
        return;
      }

      const nextPOs = purchaseOrders.map(p => p.id === poId ? { ...p, status: 'Received' as const } : p);
      setPurchaseOrders(nextPOs);
      setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(nextPOs));
      setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(nextPOs));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', nextPOs);

      if (target.items && target.items.length > 0) {
        let updatedProducts = [...products];
        let newTransactions: InventoryTransaction[] = [...inventoryTransactions];

        for (const item of target.items) {
          const qty = Number(item.qty || item.quantity || 1);
          const rate = Number(item.rate || item.unitPrice || item.estimatedUnitPrice || 0);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());

          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const updatedStock = currentStock + qty;
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: updatedStock,
              stockQty: updatedStock,
              costPrice: rate || updatedProducts[pIndex].costPrice,
              purchasePrice: rate || updatedProducts[pIndex].purchasePrice,
              updatedAt: new Date().toISOString()
            };

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: updatedProducts[pIndex].id,
              productName: item.productName,
              type: 'Purchase',
              quantity: qty,
              previousStock: currentStock,
              currentStock: updatedStock,
              referenceId: poId,
              referenceType: 'Purchase',
              date: new Date().toISOString().split('T')[0],
              notes: `Stock inwarded from Purchase Order #${poId}`
            });
          } else {
            const newProdId = item.productId && !item.productId.startsWith('temp-')
              ? item.productId
              : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const sellingPriceEst = rate > 0 ? Math.round(rate * 1.25) : 0;
            const newProduct: Product = {
              id: newProdId,
              tenantId: activeTenant.id,
              name: item.productName.trim(),
              category: item.category || 'Spare Parts',
              brand: '',
              stock: qty,
              stockQty: qty,
              minStockAlert: 2,
              minQtyAlert: 2,
              costPrice: rate,
              purchasePrice: rate,
              sellingPrice: sellingPriceEst,
              price: sellingPriceEst,
              hsnCode: '847330',
              gstRate: item.taxPercent !== undefined ? item.taxPercent : 18,
              unit: 'Pcs',
              isActive: true,
              location: 'Main Store',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            updatedProducts.unshift(newProduct);

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: newProduct.id,
              productName: item.productName,
              type: 'Purchase',
              quantity: qty,
              previousStock: 0,
              currentStock: qty,
              referenceId: poId,
              referenceType: 'Purchase',
              date: new Date().toISOString().split('T')[0],
              notes: `Initial stock inwarded from Purchase Order #${poId}`
            });
          }
        }

        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);

        setInventoryTransactions(newTransactions);
        setAppStorageItem(`inventoryTransactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        setAppStorageItem(`inventory_transactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        await saveTenantCollectionToFirestore(activeTenant.id, 'inventory_transactions', newTransactions);
      }

      triggerSaveNotification(`✓ Purchase Order "${poId}" received & stock inwarded to Inventory!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to receive PO: ${err.message}`, true);
    }
  };

  const deletePurchaseOrder = async (id: string) => {
    try {
      const next = purchaseOrders.filter(p => p.id !== id);
      setPurchaseOrders(next);
      setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(next));
      setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_orders', next);
      triggerSaveNotification(`✓ Purchase Order "${id}" deleted!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete PO: ${err.message}`, true);
    }
  };

  // ==================== PURCHASE RETURNS ====================
  const addPurchaseReturn = async (returnData: Omit<PurchaseReturn, 'id'>) => {
    try {
      const returnId = `PRET-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(purchaseReturns.length + 1).toString().padStart(3, '0')}`;
      const newReturn: PurchaseReturn = {
        id: returnId,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...returnData
      };
      const nextReturns = [newReturn, ...purchaseReturns];
      setPurchaseReturns(nextReturns);
      setAppStorageItem(`purchaseReturns_${activeTenant.id}`, JSON.stringify(nextReturns));
      setAppStorageItem(`purchase_returns_${activeTenant.id}`, JSON.stringify(nextReturns));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_returns', nextReturns);

      // Deduct stock for returned items
      if (newReturn.items && newReturn.items.length > 0) {
        let updatedProducts = [...products];
        let newTransactions: InventoryTransaction[] = [...inventoryTransactions];

        for (const item of newReturn.items) {
          const qty = Number(item.quantity || item.qty || 1);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const updatedStock = Math.max(0, currentStock - qty);
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: updatedStock,
              stockQty: updatedStock,
              updatedAt: new Date().toISOString()
            };

            newTransactions.unshift({
              id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              tenantId: activeTenant.id,
              productId: updatedProducts[pIndex].id,
              productName: item.productName,
              type: 'PURCHASE_RETURN',
              direction: 'OUT',
              quantity: -qty,
              previousStock: currentStock,
              currentStock: updatedStock,
              referenceId: returnId,
              referenceType: 'PurchaseReturn',
              date: newReturn.date || new Date().toISOString().split('T')[0],
              notes: `Stock return to vendor (${newReturn.reason || 'Debit Note'}) #${returnId}`
            });
          }
        }
        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);

        setInventoryTransactions(newTransactions);
        setAppStorageItem(`inventoryTransactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        setAppStorageItem(`inventory_transactions_${activeTenant.id}`, JSON.stringify(newTransactions));
        await saveTenantCollectionToFirestore(activeTenant.id, 'inventory_transactions', newTransactions);
      }

      // Deduct return value from Supplier balance
      if (newReturn.supplierId && (newReturn.grandTotal || 0) > 0) {
        const supp = suppliers.find(s => s.id === newReturn.supplierId);
        if (supp) {
          const updatedSuppliers = suppliers.map(s => s.id === supp.id ? { ...s, balance: Math.max(0, (s.balance || 0) - (newReturn.grandTotal || 0)) } : s);
          setSuppliers(updatedSuppliers);
          setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
          await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
        }
      }

      triggerSaveNotification(`✓ Debit Note / Purchase Return "${returnId}" recorded & supplier ledger updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to process return: ${err.message}`, true);
    }
  };

  const updatePurchaseReturn = async (updatedReturn: PurchaseReturn) => {
    try {
      const next = purchaseReturns.map(r => r.id === updatedReturn.id ? { ...r, ...updatedReturn, tenantId: activeTenant.id } : r);
      setPurchaseReturns(next);
      setAppStorageItem(`purchaseReturns_${activeTenant.id}`, JSON.stringify(next));
      setAppStorageItem(`purchase_returns_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_returns', next);
      triggerSaveNotification(`✓ Purchase Return "${updatedReturn.id}" updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update return: ${err.message}`, true);
    }
  };

  const deletePurchaseReturn = async (id: string) => {
    try {
      const target = purchaseReturns.find(r => r.id === id);
      if (!target) return;

      const next = purchaseReturns.filter(r => r.id !== id);
      setPurchaseReturns(next);
      setAppStorageItem(`purchaseReturns_${activeTenant.id}`, JSON.stringify(next));
      setAppStorageItem(`purchase_returns_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'purchase_returns', next);

      // Restore stock that was returned
      if (target.items && target.items.length > 0) {
        let updatedProducts = [...products];
        for (const item of target.items) {
          const qty = Number(item.quantity || item.qty || 1);
          const pIndex = updatedProducts.findIndex(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          if (pIndex >= 0) {
            const currentStock = updatedProducts[pIndex].stock || 0;
            const restoredStock = currentStock + qty;
            updatedProducts[pIndex] = {
              ...updatedProducts[pIndex],
              stock: restoredStock,
              stockQty: restoredStock,
              updatedAt: new Date().toISOString()
            };
          }
        }
        setProducts(updatedProducts);
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updatedProducts));
        await saveTenantCollectionToFirestore(activeTenant.id, 'products', updatedProducts);
      }

      // Restore supplier balance
      if (target.supplierId && (target.grandTotal || 0) > 0) {
        const updatedSuppliers = suppliers.map(s => s.id === target.supplierId ? { ...s, balance: (s.balance || 0) + (target.grandTotal || 0) } : s);
        setSuppliers(updatedSuppliers);
        setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
        await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
      }

      triggerSaveNotification(`✓ Purchase Return "${id}" deleted & stock/balances restored.`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete return: ${err.message}`, true);
    }
  };

  // ==================== SUPPLIER & PARTNER PAYMENTS ====================
  const addSupplierPayment = async (paymentData: Omit<SupplierPayment, 'id'>) => {
    try {
      const payId = `SPAY-${Date.now()}`;
      const newPay: SupplierPayment = {
        id: payId,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...paymentData
      };
      const nextPayments = [newPay, ...supplierPayments];
      setSupplierPayments(nextPayments);
      setAppStorageItem(`supplierPayments_${activeTenant.id}`, JSON.stringify(nextPayments));
      await saveTenantCollectionToFirestore(activeTenant.id, 'supplier_payments', nextPayments);

      // 1. Deduct supplier balance
      if (newPay.supplierId) {
        const updatedSuppliers = suppliers.map(s => s.id === newPay.supplierId ? { ...s, balance: Math.max(0, (s.balance || 0) - (newPay.amount || 0)) } : s);
        setSuppliers(updatedSuppliers);
        setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(updatedSuppliers));
        await saveTenantCollectionToFirestore(activeTenant.id, 'suppliers', updatedSuppliers);
      }

      // 2. Synchronize Purchase Bill balances and payment statuses
      if (newPay.supplierId) {
        let updatedPurchases = [...purchases];
        let hasPurchaseUpdates = false;

        if (newPay.allocations && newPay.allocations.length > 0) {
          // Explicit allocations specified
          for (const alloc of newPay.allocations) {
            const pIdx = updatedPurchases.findIndex(p => p.id === alloc.purchaseId || p.id === alloc.purchaseNumber);
            if (pIdx >= 0) {
              const currentPaid = Number(updatedPurchases[pIdx].paidAmount || 0);
              const grandTot = Number(updatedPurchases[pIdx].grandTotal || 0);
              const newPaid = Math.min(grandTot, currentPaid + alloc.allocatedAmount);
              const newBalance = Math.max(0, grandTot - newPaid);
              const newStatus = newBalance === 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Unpaid';

              updatedPurchases[pIdx] = {
                ...updatedPurchases[pIdx],
                paidAmount: newPaid,
                balanceAmount: newBalance,
                paymentStatus: newStatus as any
              };
              hasPurchaseUpdates = true;
            }
          }
        } else {
          // Auto-allocate across unpaid purchases sequentially (oldest first)
          let remainingToAllocate = Number(newPay.amount) || 0;
          const suppPurchases = updatedPurchases
            .map((p, idx) => ({ p, idx }))
            .filter(({ p }) => p.supplierId === newPay.supplierId && p.status !== 'Cancelled' && (p.balanceAmount === undefined || p.balanceAmount > 0))
            .sort((a, b) => (a.p.date || a.p.purchaseDate || '').localeCompare(b.p.date || b.p.purchaseDate || ''));

          for (const { p, idx } of suppPurchases) {
            if (remainingToAllocate <= 0) break;
            const currentBal = p.balanceAmount !== undefined ? p.balanceAmount : Math.max(0, p.grandTotal - (p.paidAmount || 0));
            const allocation = Math.min(remainingToAllocate, currentBal);
            if (allocation > 0) {
              const newPaid = (p.paidAmount || 0) + allocation;
              const newBalance = Math.max(0, p.grandTotal - newPaid);
              const newStatus = newBalance === 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Unpaid';

              updatedPurchases[idx] = {
                ...updatedPurchases[idx],
                paidAmount: newPaid,
                balanceAmount: newBalance,
                paymentStatus: newStatus as any
              };
              remainingToAllocate -= allocation;
              hasPurchaseUpdates = true;
            }
          }
        }

        if (hasPurchaseUpdates) {
          setPurchases(updatedPurchases);
          setAppStorageItem(`purchases_${activeTenant.id}`, JSON.stringify(updatedPurchases));
          await saveTenantCollectionToFirestore(activeTenant.id, 'purchases', updatedPurchases);
        }
      }

      triggerSaveNotification(`✓ Supplier payment of ₹${paymentData.amount.toLocaleString('en-IN')} recorded & purchases updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to record supplier payment: ${err.message}`, true);
    }
  };

  const addServicePartnerPayment = async (paymentData: Omit<ServicePartnerPayment, 'id'>) => {
    try {
      const payId = `PPAY-${Date.now()}`;
      const newPay: ServicePartnerPayment = {
        id: payId,
        tenantId: activeTenant.id,
        createdAt: new Date().toISOString(),
        ...paymentData
      };
      const next = [newPay, ...servicePartnerPayments];
      setServicePartnerPayments(next);
      setAppStorageItem(`servicePartnerPayments_${activeTenant.id}`, JSON.stringify(next));
      await saveTenantCollectionToFirestore(activeTenant.id, 'service_partner_payments', next);

      // Deduct partner balance
      if (newPay.partnerId) {
        const updatedPartners = servicePartners.map(p => p.id === newPay.partnerId ? { ...p, balance: Math.max(0, (p.balance || 0) - (newPay.amount || 0)) } : p);
        setServicePartners(updatedPartners);
        setAppStorageItem(`servicePartners_${activeTenant.id}`, JSON.stringify(updatedPartners));
        await saveTenantCollectionToFirestore(activeTenant.id, 'service_partners', updatedPartners);
      }

      triggerSaveNotification(`✓ Partner payment of ₹${paymentData.amount.toLocaleString('en-IN')} recorded!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to record partner payment: ${err.message}`, true);
    }
  };

  const isStaffUser = userRole === 'Technician' || userRole === 'Front Desk' || userRole === 'HR' || userRole === 'Staff';

  // Compute navigation menu items dynamically based on tenant & staff permissions
  const getNavItems = () => {
    // 1. Master System Admin Platform Organization
    if (activeTenant?.id === 'org-admin') {
      return [
        { id: 'master_admin', label: 'Organizations Admin', icon: ShieldCheck },
        { id: 'clients', label: 'Client Organizations', icon: Building },
        { id: 'billing', label: 'Billing & Invoices', icon: Receipt },
        { id: 'expenses', label: 'Expenses Outflow', icon: PiggyBank },
        { id: 'reports', label: 'Platform Reports', icon: TrendingUp },
        { id: 'settings', label: 'System Settings', icon: Settings }
      ];
    }

    // 2. Organization Admin / Owner (Full Access across ERP)
    const isAdmin = userRole === 'Admin' || currentUser?.role === 'Admin' || (!isStaffUser && userRole !== 'Technician');
    let items: { id: string; label: string; icon: any }[] = [];

    if (isAdmin) {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'live_queue', label: 'Live Queue & Bench', icon: Kanban },
        { id: 'inwards', label: 'Repair Inwards', icon: Briefcase },
        { id: 'outwards', label: 'Outward Jobs', icon: Truck },
        { id: 'billing', label: 'Billing / Invoice', icon: Receipt },
        { id: 'clients', label: 'Clients Ledger', icon: Users },
        { id: 'payments', label: 'Payment History', icon: Wallet },
        { id: 'inventory', label: 'Inventory / Stock', icon: Package },
        { id: 'purchases', label: 'Purchases & POs', icon: ShoppingCart },
        { id: 'suppliers', label: 'Suppliers Hub', icon: Store },
        { id: 'service_partners', label: 'Service Partners', icon: Wrench },
        { id: 'expenses', label: 'Expenses Outflow', icon: PiggyBank },
        { id: 'reports', label: 'Reports Hub', icon: TrendingUp },
        { id: 'settings', label: 'Setup Settings', icon: Settings }
      ];
    } else {
      // 3. Staff / Technician User (Dynamic Access strictly based on permissions saved by Admin)
      const perms = currentUser?.permissions || {};
      const hasExplicitPerms = !!(currentUser?.permissions && Object.keys(currentUser.permissions).length > 0);

      // Dashboard
      if (hasExplicitPerms ? !!perms.dashboard : true) {
        items.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
      }
      // Live Queue & Workbench
      if (hasExplicitPerms ? !!perms.operations : true) {
        items.push({ id: 'live_queue', label: 'Live Queue & Bench', icon: Kanban });
      }
      // Repair Inwards & Outward Jobs
      if (hasExplicitPerms ? !!perms.operations : true) {
        items.push({ id: 'inwards', label: 'Repair Inwards', icon: Briefcase });
        items.push({ id: 'outwards', label: 'Outward Jobs', icon: Truck });
      }
      // Billing / Invoice
      if (!!perms.billingInvoice || !!perms.billing) {
        items.push({ id: 'billing', label: 'Billing / Invoice', icon: Receipt });
      }
      // Clients Ledger
      if (!!perms.clientLedger) {
        items.push({ id: 'clients', label: 'Clients Ledger', icon: Users });
      }
      // Payment History
      if (!!perms.payments) {
        items.push({ id: 'payments', label: 'Payment History', icon: Wallet });
      }
      // Inventory / Stock
      if (!!perms.inventoryEdit || !!perms.inventory) {
        items.push({ id: 'inventory', label: 'Inventory / Stock', icon: Package });
      }
      // Purchases & POs
      if (!!perms.inventoryEdit || !!perms.inventory || !!perms.accounts) {
        items.push({ id: 'purchases', label: 'Purchases & POs', icon: ShoppingCart });
      }
      // Suppliers Hub
      if (!!perms.inventoryEdit || !!perms.inventory || !!perms.accounts) {
        items.push({ id: 'suppliers', label: 'Suppliers Hub', icon: Store });
      }
      // Service Partners
      if (!!perms.operations || !!perms.inventoryEdit || !!perms.inventory) {
        items.push({ id: 'service_partners', label: 'Service Partners', icon: Wrench });
      }
      // Expenses
      if (!!perms.accounts) {
        items.push({ id: 'expenses', label: 'Expenses Outflow', icon: PiggyBank });
      }
      // Reports Hub
      if (!!perms.reports) {
        items.push({ id: 'reports', label: 'Reports Hub', icon: TrendingUp });
      }
      // Setup Settings
      if (!!perms.setup) {
        items.push({ id: 'settings', label: 'Setup Settings', icon: Settings });
      }
    }

    // Filter by Organization Allowed Navigation Modules if restricted by Master Admin
    const allowedModules = activeTenant?.features?.allowedModules;
    if (allowedModules && allowedModules.length > 0 && activeTenant?.id !== 'org-admin') {
      items = items.filter(m => allowedModules.includes(m.id));
    }

    // Fallback if no items configured
    if (items.length === 0) {
      items.push({ id: 'inwards', label: 'Repair Inwards', icon: Briefcase });
    }

    return items;
  };

  // Ensure Admin and Staff are routed safely to allowed tabs
  React.useEffect(() => {
    const navItems = getNavItems();
    const isTabAllowed = navItems.some(item => item.id === activeTab);
    if (!isTabAllowed && navItems.length > 0) {
      setActiveTab(navItems[0].id);
    }
  }, [userRole, activeTab, activeTenant?.id, currentUser, activeTenant?.features]);

  const activeThemePalette: TenantThemePalette = companyConfig.themePalette || DEFAULT_THEME_PALETTE;

  // STRICT AUTHENTICATION GUARD: Prevent any rendering or access to app features unless properly authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none">
        {sessionEvictionInfo?.isEvicted && (
          <div className="w-full max-w-xl mb-4 bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 text-amber-200 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Logged Out: Device Takeover
                  </h4>
                  <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    Session Inactive
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Another device (<strong className="text-amber-300">{sessionEvictionInfo.takenOverBy || 'Another Terminal'}</strong>) has taken over as the active terminal for this organisation.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  This terminal has been logged out to prevent conflicting updates. To use this organisation on this device again, simply sign in.
                </p>
              </div>
            </div>
          </div>
        )}
        <AuthModal
          isOpen={true}
          tenants={tenants}
          activeTenantId={activeTenant?.id}
          users={users}
          onAuthenticated={handleAuthenticated}
          onRegisterOrg={handleRegisterOrg}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen font-sans select-none overflow-hidden transition-colors duration-200" style={{ backgroundColor: activeThemePalette.appBg }} id="app-root-shell">
      {/* Save Notification Toast Banner - Positioned cleanly at bottom center where no functional buttons exist */}
      {saveStatus && (
        <div
          onClick={() => setSaveStatus(null)}
          className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl shadow-2xl font-bold text-xs border transition-all duration-150 cursor-pointer select-none max-w-[90vw] sm:max-w-md pointer-events-auto animate-in fade-in slide-in-from-bottom-3 ${
            saveStatus.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-500 shadow-emerald-950/30'
              : 'bg-rose-700 text-white border-rose-500 shadow-rose-950/30'
          }`}
        >
          {saveStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span className="truncate">{saveStatus.message}</span>
          <span className="text-[10px] opacity-70 ml-1 hover:opacity-100 shrink-0">✕</span>
        </div>
      )}
      {/* Dynamic Theme Button & Font Accent Styles */}
      <style>{`
        .btn-theme-primary {
          background-color: ${activeThemePalette.buttonBg} !important;
          color: ${activeThemePalette.buttonText} !important;
        }
        .text-theme-accent {
          color: ${activeThemePalette.fontAccent} !important;
        }
      `}</style>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside 
            className="relative w-72 max-w-[85vw] flex flex-col justify-between h-full shadow-2xl z-10 transition-all duration-300"
            style={{ backgroundColor: activeThemePalette.sidebarBg, color: activeThemePalette.sidebarText }}
          >
            <div className="flex flex-col overflow-y-auto">
              {/* Mobile Drawer Header with Close */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/15">
                    <Menu className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white tracking-wide uppercase">Navigation</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Top Sidebar Utilities: Subscription (Left) & Synced (Right) */}
              <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                {/* Organization Subscription Remaining Time Badge (Left) */}
                {(() => {
                  const sub = getSubscriptionTimeLeft(activeTenant);
                  return (
                    <div
                      title={`🏢 Organization: ${activeTenant.name} (${activeTenant.code})\n⭐ Plan: ${sub.planLabel}\n📅 Valid Until: ${sub.validUntil}\n⏳ Time Remaining: ${sub.text}`}
                      className={`flex-1 px-2.5 py-1.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-xs truncate ${
                        sub.isExpired
                          ? 'bg-rose-500/25 border-rose-400/50 text-rose-300 animate-pulse'
                          : sub.isUrgent
                          ? 'bg-amber-500/25 border-amber-400/50 text-amber-300 animate-bounce'
                          : sub.type === 'lifetime'
                          ? 'bg-purple-500/20 border-purple-400/40 text-purple-300'
                          : 'bg-teal-500/20 border-teal-400/40 text-teal-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{sub.text}</span>
                    </div>
                  );
                })()}

                {/* Sync Status Button (Right of Subscription) */}
                <button
                  onClick={handleSyncData}
                  disabled={isSyncing}
                  title={
                    !isOnline
                      ? 'Device is offline. All data is saved locally in browser storage & PC backups until internet returns.'
                      : !homeServerSyncEnabled
                      ? 'Local-only mode. Data is saved on this device.'
                      : isSyncing
                      ? 'Synchronizing changes in real time with Home Server...'
                      : !homeServerSyncEnabled
                      ? 'Local-only mode. Data is saved on this device.'
                      : `Data synchronized in real time with Home Server. Last sync: ${lastSyncedAt || 'Just now'}. Click to trigger manual sync.`
                  }
                  className={`flex-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs ${
                    !isOnline
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30'
                      : isSyncing
                      ? 'bg-teal-500/30 border-teal-400/60 text-teal-200 animate-pulse'
                      : justSynced
                      ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
                      : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                  }`}
                >
                  {!homeServerSyncEnabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Local</span>
                    </>
                  ) : !isOnline ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Offline</span>
                    </>
                  ) : isSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-200 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">{homeServerSyncEnabled ? 'Syncing' : 'Saving Locally'}</span>
                    </>
                  ) : justSynced ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Synced</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Synced</span>
                    </>
                  )}
                </button>
              </div>

              {homeServerSyncEnabled ? (
              <>
              {/* Server Live Health Status Indicator (Green / Red Dot) */}
              <div className="px-3.5 py-2.5 border-b border-white/10 flex flex-col gap-2 shrink-0 bg-black/20" id="mobile-server-health-indicator">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Glowing / Pulsing Status Dot */}
                    <div className="relative flex items-center justify-center shrink-0">
                      {serverStatus === 'online' ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                        </>
                      ) : (
                        <>
                          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-rose-400 opacity-90"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-extrabold tracking-wide flex items-center gap-1.5 truncate">
                        {serverStatus === 'online' ? (
                          <span className="text-emerald-300 font-bold">
                            {isServerSaving ? 'Server Saving...' : 'Server Online'}
                          </span>
                        ) : (
                          <span className="text-rose-300 font-extrabold">
                            Server Disconnected
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] text-white/60 font-medium truncate">
                        {serverStatus === 'online'
                          ? (isServerSaving ? 'Saving changes to database' : 'Real-time server save active')
                          : "Don't refresh page!"}
                      </span>
                    </div>
                  </div>

                  {/* Quick Re-check Server Button & Hub Modal Opener */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setShowLocalServerHubModal(true)}
                      title="Open INOMS Pro Local Server & LAN Synchronization Hub"
                      className="px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer bg-purple-500/20 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30"
                    >
                      <Server className="w-3 h-3" />
                      <span>Hub</span>
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await checkServerStatus();
                        if (ok) await syncOfflineChangesToServer('manual');
                      }}
                      title={
                        serverStatus === 'online'
                          ? `Server online & healthy. Last checked: ${lastServerCheckTime || 'Just now'}. Click to re-verify.`
                          : 'Server connection lost. Click to retry connection and sync data immediately.'
                      }
                      className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer shrink-0 border ${
                        serverStatus === 'online'
                          ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'text-rose-100 bg-rose-600/50 border-rose-400/60 hover:bg-rose-600/70 shadow-xs'
                      }`}
                    >
                      <RefreshCw className={`w-3 h-3 ${isServerSaving ? 'animate-spin' : ''}`} />
                      <span>{serverStatus === 'online' ? 'Live' : 'Retry'}</span>
                    </button>
                  </div>
                </div>

                {/* Prominent Red Alert Card in Sidebar when Disconnected */}
                {serverStatus === 'offline' && (
                  <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-100 flex flex-col gap-1.5 shadow-md animate-pulse">
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 animate-bounce" />
                      <span>⚠️ Server Disconnected!</span>
                    </div>
                    <p className="text-[10.5px] leading-snug text-rose-200/90 font-medium">
                      <strong>Do NOT refresh the page.</strong> Connection to backend server is temporarily lost. Changes are safely saved locally and will auto-save to server once reconnected.
                    </p>
                  </div>
                )}
              </div>
              </>
              ) : (
                <div className="px-3.5 py-2.5 border-b border-white/10 text-[10px] text-teal-200 flex items-center gap-2 bg-black/20">
                  <WifiOff className="w-3.5 h-3.5 text-teal-300" />
                  <span>Local-only mode · Saved on this device</span>
                </div>
              )}

              <nav className="p-4 space-y-1.5">
                {getNavItems().map((menu) => {
                  const Icon = menu.icon;
                  const isActive = activeTab === menu.id;
                  return (
                    <button
                      key={menu.id}
                      onClick={() => {
                        setActiveTab(menu.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer group`}
                      style={isActive ? {
                        backgroundColor: activeThemePalette.buttonBg,
                        color: activeThemePalette.buttonText,
                        boxShadow: `0 8px 16px -4px ${activeThemePalette.buttonBg}40`
                      } : {
                        color: activeThemePalette.sidebarText,
                        opacity: 0.85
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4.5 h-4.5 shrink-0 transition group-hover:scale-110" style={{ color: isActive ? activeThemePalette.buttonText : activeThemePalette.sidebarText }} />
                        <span className="truncate">{menu.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Application Branding Footer */}
            <div className="p-4 border-t border-white/10 bg-black/25 text-[11px] font-semibold text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-md border border-white/25 shrink-0 flex items-center justify-center overflow-hidden">
                  <img 
                    src={systemAppLogo} 
                    alt={`${systemAppName} Logo`} 
                    className="w-full h-full object-contain" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/inoms_logo.jpg';
                    }}
                  />
                </div>
                <div className="text-left overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-white tracking-wide text-sm leading-tight truncate">
                      {systemAppName}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-emerald-300 font-bold border border-white/10">
                      v1.0
                    </span>
                  </div>
                  <p className="text-[10px] opacity-75 text-slate-300 font-medium truncate max-w-[140px]" title={systemAppTagline}>
                    {systemAppTagline}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 1. Left Navigation Sidebar (Desktop) */}
      <aside 
        className="hidden lg:flex w-64 flex-col justify-between shrink-0 h-full border-r border-white/10 transition-colors duration-200"
        style={{ backgroundColor: activeThemePalette.sidebarBg, color: activeThemePalette.sidebarText }}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Top Sidebar Utilities: Subscription (Left) & Synced (Right) */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            {/* Organization Subscription Remaining Time Badge (Left) */}
            {(() => {
              const sub = getSubscriptionTimeLeft(activeTenant);
              return (
                <div
                  title={`🏢 Organization: ${activeTenant.name} (${activeTenant.code})\n⭐ Plan: ${sub.planLabel}\n📅 Valid Until: ${sub.validUntil}\n⏳ Time Remaining: ${sub.text}`}
                  className={`flex-1 px-2.5 py-1.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-xs truncate ${
                    sub.isExpired
                      ? 'bg-rose-500/25 border-rose-400/50 text-rose-300 animate-pulse'
                      : sub.isUrgent
                      ? 'bg-amber-500/25 border-amber-400/50 text-amber-300 animate-bounce'
                      : sub.type === 'lifetime'
                      ? 'bg-purple-500/20 border-purple-400/40 text-purple-300'
                      : 'bg-teal-500/20 border-teal-400/40 text-teal-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{sub.text}</span>
                </div>
              );
            })()}

            {/* Sync Status Button (Right of Subscription) */}
            <button
              onClick={handleSyncData}
              disabled={isSyncing}
              title={
                !isOnline
                  ? 'Device is offline. All data is saved locally in browser storage & PC backups until internet returns.'
                  : isSyncing
                  ? 'Synchronizing changes in real time with Home Server...'
                  : `Data synchronized in real time with Home Server. Last sync: ${lastSyncedAt || 'Just now'}. Click to trigger manual sync.`
              }
              className={`flex-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs ${
                !isOnline
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30'
                  : isSyncing
                  ? 'bg-teal-500/30 border-teal-400/60 text-teal-200 animate-pulse'
                  : justSynced
                  ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
                  : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
                  {!homeServerSyncEnabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Local</span>
                    </>
                  ) : !isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wide">Offline</span>
                </>
              ) : isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-200 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">{homeServerSyncEnabled ? 'Syncing' : 'Saving Locally'}</span>
                </>
              ) : justSynced ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wide">Synced</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wide">Synced</span>
                </>
              )}
            </button>
          </div>

          {homeServerSyncEnabled ? (
          <>
          {/* Desktop Server Live Health Status Indicator (Green / Red Dot) */}
          <div className="px-3.5 py-2.5 border-b border-white/10 flex flex-col gap-2 shrink-0 bg-black/20" id="desktop-server-health-indicator">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {/* Glowing / Pulsing Status Dot */}
                <div className="relative flex items-center justify-center shrink-0">
                  {serverStatus === 'online' ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-rose-400 opacity-90"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
                    </>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-extrabold tracking-wide flex items-center gap-1.5 truncate">
                    {serverStatus === 'online' ? (
                      <span className="text-emerald-300 font-bold">
                        {isServerSaving ? 'Server Saving...' : 'Server Online'}
                      </span>
                    ) : (
                      <span className="text-rose-300 font-extrabold">
                        Server Disconnected
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-white/60 font-medium truncate">
                    {serverStatus === 'online'
                      ? (isServerSaving ? 'Saving changes to database' : 'Real-time server save active')
                      : "Don't refresh page!"}
                  </span>
                </div>
              </div>

              {/* Quick Re-check Server Button & Hub Modal Opener */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowLocalServerHubModal(true)}
                  title="Open INOMS Pro Local Server & LAN Synchronization Hub"
                  className="px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer bg-purple-500/20 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30"
                >
                  <Server className="w-3 h-3" />
                  <span>Hub</span>
                </button>
                <button
                  onClick={async () => {
                    const ok = await checkServerStatus();
                    if (ok) await syncOfflineChangesToServer('manual');
                  }}
                  title={
                    serverStatus === 'online'
                      ? `Server online & healthy. Last checked: ${lastServerCheckTime || 'Just now'}. Click to re-verify.`
                      : 'Server connection lost. Click to retry connection and sync data immediately.'
                  }
                  className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer shrink-0 border ${
                    serverStatus === 'online'
                      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'text-rose-100 bg-rose-600/50 border-rose-400/60 hover:bg-rose-600/70 shadow-xs'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isServerSaving ? 'animate-spin' : ''}`} />
                  <span>{serverStatus === 'online' ? 'Live' : 'Retry'}</span>
                </button>
              </div>
            </div>

            {/* Prominent Red Alert Card in Sidebar when Disconnected */}
            {serverStatus === 'offline' && (
              <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-100 flex flex-col gap-1.5 shadow-md animate-pulse">
                <div className="flex items-center gap-1.5 text-xs font-black text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 animate-bounce" />
                  <span>⚠️ Server Disconnected!</span>
                </div>
                <p className="text-[10.5px] leading-snug text-rose-200/90 font-medium">
                  <strong>Do NOT refresh the page.</strong> Connection to backend server is temporarily lost. Changes are safely saved locally and will auto-save to server once reconnected.
                </p>
              </div>
            )}
          </div>
          </>
          ) : (
            <div className="px-3.5 py-2.5 border-b border-white/10 text-[10px] text-teal-200 flex items-center gap-2 bg-black/20">
              <WifiOff className="w-3.5 h-3.5 text-teal-300" />
              <span>Local-only mode · Saved on this device</span>
            </div>
          )}

          {/* Menu items */}
          <nav className="p-4 pt-3.5 space-y-1.5" id="sidebar-nav">
            {getNavItems().map((menu) => {
              const Icon = menu.icon;
              const isActive = activeTab === menu.id;
              return (
                <button
                  key={menu.id}
                  onClick={() => setActiveTab(menu.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer group`}
                  style={isActive ? {
                    backgroundColor: activeThemePalette.buttonBg,
                    color: activeThemePalette.buttonText,
                    boxShadow: `0 8px 16px -4px ${activeThemePalette.buttonBg}40`
                  } : {
                    color: activeThemePalette.sidebarText,
                    opacity: 0.85
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4.5 h-4.5 shrink-0 transition group-hover:scale-110" style={{ color: isActive ? activeThemePalette.buttonText : activeThemePalette.sidebarText }} />
                    <span className="truncate">{menu.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Application Branding Footer */}
        <div className="p-4 border-t border-white/10 bg-black/25 text-[11px] font-semibold text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-md border border-white/25 shrink-0 flex items-center justify-center overflow-hidden">
              <img 
                src={systemAppLogo} 
                alt={`${systemAppName} Logo`} 
                className="w-full h-full object-contain" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/inoms_logo.jpg';
                }}
              />
            </div>
            <div className="text-left overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white tracking-wide text-sm leading-tight truncate">
                  {systemAppName}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-emerald-300 font-bold border border-white/10">
                  v1.0
                </span>
              </div>
              <p className="text-[10px] opacity-75 text-slate-300 font-medium truncate max-w-[140px]" title={systemAppTagline}>
                {systemAppTagline}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Notifications Popover (Global Modal Dialog) */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-start justify-start p-4 sm:p-6 bg-slate-900/40 backdrop-blur-2xs" onClick={() => setShowNotifications(false)}>
          <div 
            className="relative ml-0 lg:ml-64 mt-12 bg-white border border-slate-200/90 rounded-2xl shadow-2xl w-full max-w-sm p-4 space-y-3 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-teal-600" /> Notifications &amp; Broadcasts
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  {activeTenant?.name || 'Workspace'}
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Master Admin Broadcasts */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {announcements
                .filter(a => a.targetTenantId === 'all' || a.targetTenantId === activeTenant?.id)
                .map((ann, annIdx) => (
                  <div
                    key={ann.id ? `${ann.id}-${annIdx}` : `ann-${annIdx}`}
                    className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                      ann.severity === 'urgent'
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                        : ann.severity === 'warning'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-teal-50/80 border-teal-200 text-teal-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs block">{ann.title}</span>
                      <span className="text-[9px] font-mono opacity-70">{ann.createdAt.split(' ')[0]}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-90 font-medium">{ann.message}</p>
                    <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 pt-0.5">
                      <span>👑 Platform Announcement</span>
                    </div>
                  </div>
                ))}

              {/* Standard System Logs */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
                <p className="pb-1 border-b border-slate-50 flex items-center justify-between">
                  <span>🔔 Backup success: Cloud schema synced</span>
                  <span className="font-mono text-[9px]">Just now</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>⚠️ Low Stock Alert: Keyboard inventory under 10</span>
                  <span className="font-mono text-[9px]">Today</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Workstage Section */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Sticky Server Disconnected Warning Banner */}
        {homeServerSyncEnabled && serverStatus === 'offline' && (
          <div className="w-full bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 text-white px-3 sm:px-5 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg shrink-0 border-b border-rose-800 z-40 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-90"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-300"></span>
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 animate-bounce" />
              <span className="truncate sm:whitespace-normal">
                <strong>Server Disconnected:</strong> Live backend save is interrupted. <strong>Please DO NOT refresh or close this tab.</strong> All changes are safely stored in browser cache and will auto-upload once reconnected.
              </span>
            </div>
            <button
              onClick={async () => {
                const ok = await checkServerStatus();
                if (ok) await syncOfflineChangesToServer('manual');
              }}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shrink-0 ml-3 border border-white/30 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isServerSaving ? 'animate-spin' : ''}`} /> Reconnect Server
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <header 
          className="h-16 border-b border-slate-100 flex items-center justify-between px-2 sm:px-6 shrink-0 z-30 transition-colors duration-200 gap-1.5 sm:gap-2"
          style={{ backgroundColor: activeThemePalette.topHeaderBg }}
        >
          
          {/* Company Title & Org Selector */}
          <div className="flex items-center gap-1.5 sm:gap-3.5 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-teal-700" />
            </button>

            {/* Prominent Organisation Info Badge (The Sole Destination for Org Identity) */}
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-50/90 px-2.5 sm:px-3.5 py-1.5 rounded-2xl border border-slate-200/80 min-w-0 max-w-[130px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-none shadow-xs">
              {/* Organisation Logo / Badge (Larger & Attractive) */}
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-xs overflow-hidden border border-teal-700/20">
                {companyConfig.logoUrl ? (
                  <img 
                    src={companyConfig.logoUrl} 
                    alt="Organization Logo" 
                    className="w-full h-full object-contain bg-white rounded-xl sm:rounded-2xl p-0.5" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/inoms_logo.jpg';
                    }}
                  />
                ) : (
                  <div className="w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-xs sm:text-lg shadow-inner">
                    {(activeTenant?.name || activeCompany || 'O').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Organisation Details: Name, Number, and Role */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2.5 text-left min-w-0">
                <span className="text-xs sm:text-base font-black text-slate-800 leading-tight truncate">
                  {activeTenant?.name || activeCompany}
                </span>
                
                {activeTenant?.ownerMobile && (
                  <span className="text-[10px] sm:text-xs font-mono font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-lg border border-teal-200/80 hidden sm:inline-block">
                    {activeTenant.ownerMobile}
                  </span>
                )}

                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 hidden md:inline-block">
                  Role: {currentUser?.role || (activeTenant?.id === 'org-admin' || activeTenant?.code === 'ADMIN-00' ? 'System Admin' : 'Organization Owner')}
                </span>
              </div>
            </div>
          </div>

          {/* Right Corner: Google Drive Sync, Notifications & Logout */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Google Drive Multi-Device Sync Pill */}
            <button
              type="button"
              onClick={() => setIsGoogleDriveModalOpen(true)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-full border transition flex items-center gap-1.5 cursor-pointer shadow-xs text-xs font-bold ${
                !isProTenant
                  ? 'bg-purple-50/90 hover:bg-purple-100/90 border-purple-200 text-purple-800'
                  : driveSyncState.isConnected
                  ? 'bg-sky-50/90 hover:bg-sky-100/90 border-sky-300 text-sky-700'
                  : 'bg-slate-100 hover:bg-slate-200/80 border-slate-300 text-slate-700'
              }`}
              title={
                !isProTenant
                  ? 'Google Drive Cloud Hub & Multi-Device Sync (INOMS Pro Feature)'
                  : isTrialActiveTenant
                  ? 'Google Drive Cloud Hub (7-Day Free Trial - Full Access)'
                  : 'Google Drive Cloud Hub & Multi-Device Sync'
              }
            >
              <Cloud
                className={`w-4 h-4 ${
                  driveSyncState.isSyncing
                    ? 'animate-bounce text-sky-600'
                    : !isProTenant
                    ? 'text-purple-600'
                    : 'text-sky-600'
                }`}
              />
              <span className="hidden sm:inline">
                {driveSyncState.isSyncing ? 'Syncing...' : 'Sync to Drive'}
              </span>
              <span className="hidden xs:inline sm:hidden">Drive</span>
              {!isProTenant ? (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-900 border border-purple-300 leading-none hidden xs:inline-block">
                  PRO
                </span>
              ) : isTrialActiveTenant && !driveSyncState.isConnected ? (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 leading-none hidden xs:inline-block">
                  TRIAL
                </span>
              ) : driveSyncState.isConnected ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Connected"></span>
              ) : null}
            </button>

            {/* Notification Bell Button */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl cursor-pointer relative transition shadow-xs flex items-center justify-center min-h-[38px] min-w-[38px]"
                title="Notifications & Announcements"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
              </button>
            </div>

            <button
              onClick={handleLockSession}
              title="Logout / Lock Session"
              className="p-2 sm:px-3 sm:py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 rounded-xl cursor-pointer transition flex items-center gap-1.5 font-bold text-xs shadow-xs min-h-[38px]"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </header>

        {/* Active Device Concurrency Guard Banner */}
        {concurrencyState.isReadOnly && (
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white px-4 py-2.5 text-xs font-semibold border-b border-amber-700 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-black/20 rounded-xl text-white font-bold shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <p className="font-bold text-white flex items-center gap-2">
                  <span>🛡️ Safe Read-Only Mode Active</span>
                  {concurrencyState.conflictDevice && (
                    <span className="bg-black/25 text-amber-100 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide">
                      Active Terminal: {concurrencyState.conflictDevice.deviceName}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-amber-100 mt-0.5 font-medium">
                  {concurrencyState.conflictDevice ? (
                    <>Organisation is active on <strong>{concurrencyState.conflictDevice.deviceName}</strong>. Data editing is paused on this device to prevent duplicate records &amp; overwrites.</>
                  ) : (
                    <>This device is currently operating in Safe Read-Only mode. All records can be browsed safely.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  triggerSaveNotification('🔄 Fetching latest records from Google Drive...');
                  const success = await handlePullLatestSnapshotFromDrive();
                  if (success) {
                    triggerSaveNotification('✓ Station records updated to latest cloud state.');
                  }
                }}
                className="px-3 py-1.5 bg-amber-700/80 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-amber-500/50 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-200" />
                <span>Pull Latest Records</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await sessionGuard.takeOver();
                  triggerSaveNotification('✓ This device is now the primary active terminal.');
                }}
                className="px-3 py-1.5 bg-white text-slate-900 hover:bg-amber-50 rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                <span>Take Over as Active Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sessionGuard.reopenConflictModal();
                }}
                className="px-2.5 py-1.5 bg-black/25 hover:bg-black/35 text-amber-100 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Details
              </button>
            </div>
          </div>
        )}

        {/* Offline / Network Disconnection Banner */}
        {!isOfflineBannerDismissed && !navigator.onLine && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-semibold border-b border-amber-600 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-950/20 rounded-lg text-slate-950 font-bold shrink-0">
                <WifiOff className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <p className="font-bold text-slate-950 flex items-center gap-2">
                  <span>🌐 Offline Mode Active — Disconnected from Network</span>
                  <span className="bg-amber-950/20 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Saved Locally
                  </span>
                </p>
                <p className="text-[11px] text-slate-900 opacity-90 mt-0.5">
                  Your device is currently offline. All changes are being recorded in local storage and will sync to your Home Server once reconnected.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setIsSyncRetrying(true);
                  try {
                    await handleSyncData();
                    triggerSaveNotification('✓ Connection checked & synced');
                  } catch (err) {
                    console.error('Manual sync retry failed:', err);
                  } finally {
                    setIsSyncRetrying(false);
                  }
                }}
                disabled={isSyncRetrying}
                className="px-3 py-1.5 bg-slate-950 text-amber-300 hover:bg-slate-900 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncRetrying ? 'animate-spin' : ''}`} />
                <span>{isSyncRetrying ? 'Checking...' : 'Check Connection'}</span>
              </button>

              {(userRole === 'Admin' || userRole === 'Master Admin' || activeTenant?.id === 'org-admin') && (
                <button
                  type="button"
                  onClick={() => {
                    const dataToExport = {
                      tenantId: activeTenant.id,
                      orgName: companyConfig.name || activeTenant.name,
                      timestamp: new Date().toISOString(),
                      clients, jobs, invoices, products, ledger, payments, expenses, users, categories, racks, equipments, problems,
                      suppliers, servicePartners, service_partners: servicePartners,
                      purchases, purchaseOrders, purchase_orders: purchaseOrders,
                      purchaseReturns, purchase_returns: purchaseReturns,
                      supplierPayments, supplier_payments: supplierPayments,
                      servicePartnerPayments, service_partner_payments: servicePartnerPayments,
                      inventorySerials, inventory_serials: inventorySerials,
                      inventoryTransactions, inventory_transactions: inventoryTransactions,
                      companyConfig
                    };
                    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `INOMS_Local_Backup_${activeTenant.id}_${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-white/95 text-slate-900 hover:bg-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                  <span>Download JSON</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOfflineBannerDismissed(true)}
                className="p-1.5 text-slate-950/70 hover:text-slate-950 hover:bg-amber-600/40 rounded-lg transition cursor-pointer"
                title="Dismiss Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Screen stage area */}
        <div 
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:pb-24 lg:pb-6 transition-colors duration-200" 
          id="applet-workstage"
          style={{ backgroundColor: activeThemePalette.appBg }}
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              clients={clients}
              jobs={jobs}
              payments={payments}
              invoices={invoices}
              ledger={ledger}
              serverStatus={serverStatus}
              onNavigate={(tab) => setActiveTab(tab)}
              onSync={handleSyncData}
              isSyncing={isSyncing}
              lastSyncedAt={lastSyncedAt}
              justSynced={justSynced}
            />
          )}

          {activeTab === 'master_admin' && (
            <MasterAdminDashboard
              tenants={tenants}
              companyConfig={companyConfig}
              announcements={announcements}
              expenses={expenses}
              onNavigateToExpenses={() => setActiveTab('expenses')}
              onRegisterOrg={handleRegisterOrg}
              onUpdateTenant={handleUpdateTenant}
              onToggleTenantStatus={handleToggleTenantStatus}
              onDeleteTenant={handleDeleteTenant}
              onSendAnnouncement={handleSendAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              pricingConfig={pricingConfig}
              onSavePricing={handleSavePricing}
              saasInvoices={saasInvoices}
              onAddSaasInvoice={handleAddSaasInvoice}
              onUpdateSaasInvoice={handleUpdateSaasInvoice}
              onDeleteSaasInvoice={handleDeleteSaasInvoice}
              onNavigateToSaasBilling={(tenantId) => {
                setInitialSaasBillingTenantId(tenantId || null);
                setActiveTab('billing');
              }}
              onNavigateToPricing={() => {
                setInitialSaasBillingTenantId(null);
                setActiveTab('billing');
              }}
            />
          )}

          {activeTab === 'clients' && (
            <Clients
              clients={clients}
              ledger={ledger}
              jobs={jobs}
              invoices={invoices}
              tenants={tenants}
              isAdmin={userRole === 'Admin'}
              isStaff={isStaffUser}
              currentUser={currentUser}
              onAddClient={addClient}
              onEditClient={editClient}
              onDeleteClient={deleteClient}
              onUpdateLedgerEntry={updateLedgerEntry}
              onToggleTenantStatus={handleToggleTenantStatus}
              onRegisterOrg={handleRegisterOrg}
              onNavigateToBillingForOrg={() => setActiveTab('billing')}
              onNavigateToJob={handleNavigateToJob}
              onNavigateToInvoice={handleNavigateToInvoice}
            />
          )}

          {activeTab === 'live_queue' && activeTenant.id !== 'org-admin' && (
            <LiveRepairQueue
              jobs={jobs}
              companyConfig={companyConfig}
              users={users}
              currentUser={currentUser}
              onSelectJob={(job) => {
                setInitialJobIdToView(job.id);
                setActiveTab('inwards');
              }}
              onUpdateJob={updateJob}
              onNewJobClick={() => {
                setInitialOpenAddInwardModal(true);
                setActiveTab('inwards');
              }}
            />
          )}

          {activeTab === 'inwards' && activeTenant.id !== 'org-admin' && (
            <Inwards
              jobs={jobs}
              clients={clients}
              equipments={equipments}
              problems={problems}
              products={products}
              servicePartners={servicePartners}
              companyConfig={companyConfig}
              users={users}
              currentUser={currentUser}
              userRole={userRole}
              initialJobIdToView={initialJobIdToView}
              onClearInitialJobIdToView={() => setInitialJobIdToView(null)}
              initialOpenAddModal={initialOpenAddInwardModal}
              onClearInitialOpenAddModal={() => setInitialOpenAddInwardModal(false)}
              onAddJob={addJob}
              onUpdateJob={updateJob}
              onDeleteJob={deleteJob}
              onAddClient={addClient}
              onAddProblem={addProblem}
              onAddServicePartner={addServicePartner}
              onOpenOutwardJob={(jobId) => {
                setActiveTab('outwards');
                setInitialJobIdToView(jobId);
              }}
              onRecordPayment={(payData) => {
                const clientObj = clients.find(c => c.id === payData.clientId);
                addPayment({
                  clientId: payData.clientId,
                  clientName: clientObj?.name || 'Unknown',
                  date: new Date().toISOString().split('T')[0],
                  amount: payData.amount,
                  mode: payData.mode,
                  remarks: payData.remarks
                });
              }}
            />
          )}

          {activeTab === 'outwards' && activeTenant.id !== 'org-admin' && (
            <Outwards
              jobs={jobs}
              clients={clients}
              products={products}
              invoices={invoices}
              payments={payments}
              companyConfig={companyConfig}
              userRole={userRole}
              currentUser={currentUser}
              tenantFeatures={activeTenant?.features}
              initialJobIdToView={initialJobIdToView}
              onClearInitialJobIdToView={() => setInitialJobIdToView(null)}
              onUpdateJob={updateJob}
              onDeleteJob={deleteJob}
              onGenerateInvoiceForJob={(job) => {
                setSelectedJobForInvoice(job);
                setActiveTab('billing');
              }}
            />
          )}

          {activeTab === 'billing' && (
            <Billing
              invoices={invoices}
              clients={clients}
              jobs={jobs}
              products={products}
              companyConfig={companyConfig}
              tenants={tenants}
              tenantFeatures={activeTenant?.features}
              isAdmin={userRole === 'Admin'}
              currentUser={currentUser}
              activeTenantId={activeTenant.id}
              initialJobForInvoice={selectedJobForInvoice}
              onClearInitialJobForInvoice={() => setSelectedJobForInvoice(null)}
              initialInvoiceIdToView={initialInvoiceIdToView}
              onClearInitialInvoiceIdToView={() => setInitialInvoiceIdToView(null)}
              onAddInvoice={addInvoice}
              onUpdateInvoice={updateInvoice}
              onDeleteInvoice={deleteInvoice}
              onAddClient={addClient}
              categories={categories}
              racks={racks}
              suppliers={suppliers}
              onAddProduct={addProduct}
              pricingConfig={pricingConfig}
              onSavePricing={handleSavePricing}
              saasInvoices={saasInvoices}
              onAddSaasInvoice={handleAddSaasInvoice}
              onUpdateSaasInvoice={handleUpdateSaasInvoice}
              onDeleteSaasInvoice={handleDeleteSaasInvoice}
              initialSaasBillingTenantId={initialSaasBillingTenantId}
              onClearInitialSaasBillingTenantId={() => setInitialSaasBillingTenantId(null)}
            />
          )}

          {activeTab === 'payments' && (
            <Payments
              payments={payments}
              clients={clients}
              invoices={invoices}
              jobs={jobs}
              companyConfig={companyConfig}
              userRole={userRole}
              currentUser={currentUser}
              onAddPayment={addPayment}
              onUpdatePayment={updatePayment}
              onDeletePayment={deletePayment}
              onNavigateToJob={handleNavigateToJob}
              onNavigateToInvoice={handleNavigateToInvoice}
            />
          )}

          {activeTab === 'inventory' && activeTenant.id !== 'org-admin' && (
            <Inventory
              products={products}
              categories={categories}
              racks={racks}
              suppliers={suppliers}
              purchases={purchases}
              purchaseReturns={purchaseReturns}
              inventorySerials={inventorySerials}
              inventoryTransactions={inventoryTransactions}
              jobs={jobs}
              isStaff={isStaffUser}
              currentUser={currentUser}
              userRole={userRole}
              onAddProduct={addProduct}
              onEditProduct={editProduct}
              onDeleteProduct={deleteProduct}
              onAddCategory={addCategory}
              onDeleteCategory={deleteCategory}
              onAddRack={addRack}
              onDeleteRack={deleteRack}
              onNavigateToSupplier={(supplierId) => {
                setActiveTab('suppliers');
              }}
            />
          )}

          {activeTab === 'purchases' && activeTenant.id !== 'org-admin' && (
            <PurchasesHub
              purchases={purchases}
              purchaseOrders={purchaseOrders}
              purchaseReturns={purchaseReturns}
              suppliers={suppliers}
              products={products}
              isStaff={isStaffUser}
              currentUser={currentUser}
              userRole={userRole}
              onAddPurchase={addPurchase}
              onUpdatePurchase={updatePurchase}
              onDeletePurchase={deletePurchase}
              onCancelPurchase={cancelPurchase}
              onAddPurchaseOrder={addPurchaseOrder}
              onUpdatePurchaseOrder={updatePurchaseOrder}
              onReceivePurchaseOrder={receivePurchaseOrder}
              onDeletePurchaseOrder={deletePurchaseOrder}
              onAddSupplier={addSupplier}
              onAddPurchaseReturn={addPurchaseReturn}
              onUpdatePurchaseReturn={updatePurchaseReturn}
              onDeletePurchaseReturn={deletePurchaseReturn}
              initialSupplierId={purchaseHubInitialSupplierId}
              initialOpenModal={purchaseHubInitialModal}
              onClearInitialModal={() => {
                setPurchaseHubInitialSupplierId(null);
                setPurchaseHubInitialModal(null);
              }}
              onNavigateToSupplier={(supplierId) => {
                setActiveTab('suppliers');
              }}
            />
          )}

          {activeTab === 'suppliers' && activeTenant.id !== 'org-admin' && (
            <Suppliers
              suppliers={suppliers}
              purchases={purchases}
              purchaseReturns={purchaseReturns}
              purchaseOrders={purchaseOrders}
              supplierPayments={supplierPayments}
              products={products}
              isStaff={isStaffUser}
              currentUser={currentUser}
              userRole={userRole}
              onAddSupplier={addSupplier}
              onUpdateSupplier={updateSupplier}
              onDeleteSupplier={deleteSupplier}
              onRecordSupplierPayment={addSupplierPayment}
              onNewPurchase={(supplierId) => {
                setPurchaseHubInitialSupplierId(supplierId || null);
                setPurchaseHubInitialModal('purchase');
                setActiveTab('purchases');
              }}
              onNewPurchaseOrder={(supplierId) => {
                setPurchaseHubInitialSupplierId(supplierId || null);
                setPurchaseHubInitialModal('order');
                setActiveTab('purchases');
              }}
              onNewPurchaseReturn={(supplierId) => {
                setPurchaseHubInitialSupplierId(supplierId || null);
                setPurchaseHubInitialModal('return');
                setActiveTab('purchases');
              }}
              onNavigateToProduct={(productId) => {
                setActiveTab('inventory');
              }}
            />
          )}

          {activeTab === 'service_partners' && activeTenant.id !== 'org-admin' && (
            <ServicePartners
              servicePartners={servicePartners}
              jobs={jobs}
              servicePartnerPayments={servicePartnerPayments}
              isStaff={isStaffUser}
              currentUser={currentUser}
              userRole={userRole}
              onAddPartner={addServicePartner}
              onUpdatePartner={updateServicePartner}
              onDeletePartner={deleteServicePartner}
              onRecordPartnerPayment={addServicePartnerPayment}
              onUpdateJob={updateJob}
              onNavigateToJob={handleNavigateToJob}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses
              expenses={expenses}
              onAddExpense={addExpense}
              onUpdateExpense={updateExpense}
              onDeleteExpense={deleteExpense}
            />
          )}

          {activeTab === 'reports' && (
            <Reports
              jobs={jobs}
              payments={payments}
              invoices={invoices}
              expenses={expenses}
              clients={clients}
              onDeletePayment={deletePayment}
              onDeleteExpense={deleteExpense}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsComponent
              activeTenantId={activeTenant.id}
              activeTenant={activeTenant}
              onUpdateTenant={(updated) => handleUpdateTenant(updated)}
              onSyncTenants={(newTenants) => {
                setTenants(newTenants);
                const jsonStr = JSON.stringify(sanitizeTenantsForStorage(newTenants));
                setAppStorageItem('tenants_v3', jsonStr);
              }}
              userRole={userRole}
              currentUser={currentUser}
              tenantFeatures={activeTenant?.features}
              isStaff={isStaffUser}
              users={users}
              logs={logs.filter(l => !l.tenantId || l.tenantId === activeTenant.id)}
              equipments={equipments}
              problems={problems}
              companyConfig={companyConfig}
              onChangeCompanyConfig={(newCfg) => {
                setCompanyConfig(newCfg);
                triggerSaveNotification('✓ Store settings & company profile saved!');
              }}
              fontSize={fontSize}
              onChangeFontSize={setFontSize}
              onAddUser={addUser}
              onUpdateUser={updateUser}
              onDeleteUser={deleteUser}
              onToggleUserStatus={toggleUserStatus}
              onAddEquipment={addEquipment}
              onDeleteEquipment={deleteEquipment}
              onAddProblem={addProblem}
              onDeleteProblem={deleteProblem}
              appData={{
                clients,
                organization: activeTenant,
                backupVersion: 1,
                jobs,
                invoices,
                products,
                ledger,
                payments,
                expenses,
                users,
                logs,
                categories,
                racks,
                equipments,
                problems,
                suppliers,
                servicePartners,
                service_partners: servicePartners,
                purchases,
                purchaseOrders,
                purchase_orders: purchaseOrders,
                purchaseReturns,
                purchase_returns: purchaseReturns,
                supplierPayments,
                supplier_payments: supplierPayments,
                servicePartnerPayments,
                service_partner_payments: servicePartnerPayments,
                inventorySerials,
                inventory_serials: inventorySerials,
                inventoryTransactions,
                inventory_transactions: inventoryTransactions,
                companyConfig,
                fontSize
              }}
              onRestoreData={(restored) => {
                const tagTenant = (items: any[]) => Array.isArray(items) ? items.map(item => ({ ...item, tenantId: activeTenant.id })) : items;
                if (restored.clients) {
                  const items = tagTenant(restored.clients);
                  setClients(items);
                  replaceLocalCollection(activeTenant.id, 'clients', items, true);
                }
                if (restored.jobs) {
                  const items = tagTenant(restored.jobs);
                  setJobs(items);
                  replaceLocalCollection(activeTenant.id, 'jobs', items, true);
                }
                if (restored.invoices) {
                  const items = tagTenant(restored.invoices);
                  setInvoices(items);
                  replaceLocalCollection(activeTenant.id, 'invoices', items, true);
                }
                if (restored.products) {
                  const items = tagTenant(restored.products);
                  setProducts(items);
                  replaceLocalCollection(activeTenant.id, 'products', items, true);
                }
                if (restored.ledger) {
                  const items = tagTenant(restored.ledger);
                  setLedger(items);
                  replaceLocalCollection(activeTenant.id, 'ledger', items, true);
                }
                if (restored.payments) {
                  const items = tagTenant(restored.payments);
                  setPayments(items);
                  replaceLocalCollection(activeTenant.id, 'payments', items, true);
                }
                if (restored.expenses) {
                  const items = tagTenant(restored.expenses);
                  setExpenses(items);
                  replaceLocalCollection(activeTenant.id, 'expenses', items, true);
                }
                if (restored.users) {
                  const items = tagTenant(restored.users);
                  setUsers(items);
                  replaceLocalCollection(activeTenant.id, 'users', items, true);
                }
                if (restored.logs) {
                  const items = tagTenant(restored.logs);
                  setLogs(items);
                  replaceLocalCollection(activeTenant.id, 'logs', items, true);
                }
                if (restored.categories) {
                  const items = tagTenant(restored.categories);
                  setCategories(items);
                  replaceLocalCollection(activeTenant.id, 'categories', items, true);
                }
                if (restored.racks) {
                  const items = tagTenant(restored.racks);
                  setRacks(items);
                  replaceLocalCollection(activeTenant.id, 'racks', items, true);
                }
                if (restored.equipments) {
                  const items = tagTenant(restored.equipments);
                  setEquipments(items);
                  replaceLocalCollection(activeTenant.id, 'equipments', items, true);
                }
                if (restored.problems) {
                  const items = tagTenant(restored.problems);
                  setProblems(items);
                  replaceLocalCollection(activeTenant.id, 'problems', items, true);
                }
                if (restored.suppliers) {
                  const items = tagTenant(restored.suppliers);
                  setSuppliers(items);
                  suppliersRef.current = items;
                  setAppStorageItem(`suppliers_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'suppliers', items, true);
                }
                const restoredPartners = restored.servicePartners || restored.service_partners;
                if (restoredPartners) {
                  const items = tagTenant(restoredPartners);
                  setServicePartners(items);
                  servicePartnersRef.current = items;
                  setAppStorageItem(`servicePartners_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`service_partners_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'service_partners', items, true);
                }
                if (restored.purchases) {
                  const items = tagTenant(restored.purchases);
                  setPurchases(items);
                  purchasesRef.current = items;
                  setAppStorageItem(`purchases_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'purchases', items, true);
                }
                const restoredPOs = restored.purchaseOrders || restored.purchase_orders;
                if (restoredPOs) {
                  const items = tagTenant(restoredPOs);
                  setPurchaseOrders(items);
                  purchaseOrdersRef.current = items;
                  setAppStorageItem(`purchaseOrders_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`purchase_orders_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'purchase_orders', items, true);
                }
                const restoredReturns = restored.purchaseReturns || restored.purchase_returns;
                if (restoredReturns) {
                  const items = tagTenant(restoredReturns);
                  setPurchaseReturns(items);
                  purchaseReturnsRef.current = items;
                  setAppStorageItem(`purchaseReturns_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`purchase_returns_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'purchase_returns', items, true);
                }
                const restoredSupplierPays = restored.supplierPayments || restored.supplier_payments;
                if (restoredSupplierPays) {
                  const items = tagTenant(restoredSupplierPays);
                  setSupplierPayments(items);
                  supplierPaymentsRef.current = items;
                  setAppStorageItem(`supplierPayments_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`supplier_payments_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'supplier_payments', items, true);
                }
                const restoredPartnerPays = restored.servicePartnerPayments || restored.service_partner_payments;
                if (restoredPartnerPays) {
                  const items = tagTenant(restoredPartnerPays);
                  setServicePartnerPayments(items);
                  servicePartnerPaymentsRef.current = items;
                  setAppStorageItem(`servicePartnerPayments_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`service_partner_payments_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'service_partner_payments', items, true);
                }
                const restoredSerials = restored.inventorySerials || restored.inventory_serials;
                if (restoredSerials) {
                  const items = tagTenant(restoredSerials);
                  setInventorySerials(items);
                  inventorySerialsRef.current = items;
                  setAppStorageItem(`inventorySerials_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`inventory_serials_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'inventory_serials', items, true);
                }
                const restoredTxns = restored.inventoryTransactions || restored.inventory_transactions;
                if (restoredTxns) {
                  const items = tagTenant(restoredTxns);
                  setInventoryTransactions(items);
                  inventoryTransactionsRef.current = items;
                  setAppStorageItem(`inventoryTransactions_${activeTenant.id}`, JSON.stringify(items));
                  setAppStorageItem(`inventory_transactions_${activeTenant.id}`, JSON.stringify(items));
                  replaceLocalCollection(activeTenant.id, 'inventory_transactions', items, true);
                }
                if (restored.companyConfig) setCompanyConfig(prev => ({ ...prev, ...restored.companyConfig }));
                if (restored.fontSize) setFontSize(String(restored.fontSize));
                
                // Immediately flush queue to Home Server backend
                if (getAuthToken()) {
                  pushPendingOperations(activeTenant.id).catch(() => {});
                }

                triggerSaveNotification(`✓ Records & settings successfully restored & synchronized for ${activeTenant.name}!`);
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Native Bottom Navigation Bar */}
      <div 
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg lg:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab(activeTenant.id === 'org-admin' ? 'master_admin' : 'dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 touch-manipulation min-h-[46px] cursor-pointer ${
            activeTab === 'dashboard' || activeTab === 'master_admin'
              ? 'text-teal-700 font-extrabold bg-teal-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Overview</span>
        </button>

        {activeTenant.id !== 'org-admin' && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('inwards')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 touch-manipulation min-h-[46px] cursor-pointer relative ${
                activeTab === 'inwards'
                  ? 'text-teal-700 font-extrabold bg-teal-50/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Briefcase className="w-5 h-5 mb-0.5" />
                {jobs.filter(j => j.status === 'Received' || j.status === 'Under Diagnosis').length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {jobs.filter(j => j.status === 'Received' || j.status === 'Under Diagnosis').length}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight">Inwards</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('live_queue')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 touch-manipulation min-h-[46px] cursor-pointer relative ${
                activeTab === 'live_queue'
                  ? 'text-teal-700 font-extrabold bg-teal-50/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Kanban className="w-5 h-5 mb-0.5" />
                {jobs.filter(j => j.status === 'Under Repair' || j.status === 'Parts Required' || j.status === 'Ready for Delivery').length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-teal-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {jobs.filter(j => j.status === 'Under Repair' || j.status === 'Parts Required' || j.status === 'Ready for Delivery').length}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight">Queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outwards')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 touch-manipulation min-h-[46px] cursor-pointer ${
                activeTab === 'outwards'
                  ? 'text-teal-700 font-extrabold bg-teal-50/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Outwards</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 touch-manipulation min-h-[46px] cursor-pointer text-slate-500 hover:text-slate-800"
        >
          <Menu className="w-5 h-5 mb-0.5 text-teal-600" />
          <span className="text-[10px] leading-tight font-medium">Menu</span>
        </button>
      </div>

      {/* Security & Authenticator Modal */}
      <AuthModal
        isOpen={showAuthModal}
        tenants={tenants}
        activeTenantId={activeTenant?.id}
        users={users}
        onAuthenticated={handleAuthenticated}
        onRegisterOrg={handleRegisterOrg}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Google Drive Multi-Device Cloud Hub Modal */}
      <GoogleDriveHubModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
        tenantId={activeTenant?.id || 'org-admin'}
        tenantName={activeTenant?.name || activeCompany}
        tenantPlan={activeTenant?.subscriptionPlan || (activeTenant as any)?.planTier}
        isProPlan={isProTenant}
        isMasterAdmin={
          userRole === 'Master Admin' ||
          userRole === 'master_admin' ||
          activeTenant?.id === 'org-admin' ||
          activeTenant?.code === 'ADMIN-00' ||
          activeTenant?.ownerMobile?.includes('8149862034')
        }
        onPushSnapshot={handlePushSnapshotToDrive}
        onPullLatestSnapshot={handlePullLatestSnapshotFromDrive}
        onRestoreSnapshotById={handleRestoreSnapshotById}
      />

      {/* INOMS Pro Local Server & LAN Synchronization Hub Modal */}
      <LocalServerHubModal
        isOpen={showLocalServerHubModal}
        onClose={() => setShowLocalServerHubModal(false)}
        activeTenant={activeTenant}
        currentUser={currentUser}
      />

      {/* Active Session Concurrency Guard Modal */}
      <ActiveSessionConflictModal
        isOpen={concurrencyState.hasConflict && !isConflictModalDismissed}
        tenantName={companyConfig.name || activeTenant?.name || activeCompany}
        activeDevice={concurrencyState.conflictDevice}
        myDeviceName={concurrencyState.myDeviceName}
        onTakeOver={async () => {
          await sessionGuard.takeOver();
          sessionGuard.dismissConflictModal();
          triggerSaveNotification('✓ This device is now the primary active terminal.');
        }}
        onStayReadOnly={() => {
          sessionGuard.setReadOnly(true);
          sessionGuard.dismissConflictModal();
        }}
        onClose={() => {
          sessionGuard.setReadOnly(true);
          sessionGuard.dismissConflictModal();
        }}
        onSwitchOrgOrLogout={() => {
          sessionGuard.releaseSession();
          handleLockSession();
        }}
      />
    </div>
  );
}
