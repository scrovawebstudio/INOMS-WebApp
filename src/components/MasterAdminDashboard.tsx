import React, { useState, useEffect, useMemo } from 'react';
import MicrosoftAuthQR, { generateBase32Secret } from './MicrosoftAuthQR';
import { TenantOrg, SystemAnnouncement, getTenantFeatures, TenantFeatures } from './AuthModal';
import { fetchAdminOrganizationsViaApi, purgeAllDataApi } from '../lib/api';
import { fetchTenantsOnce } from '../lib/firebase';
import {
  Building,
  Plus,
  ShieldCheck,
  Power,
  Trash2,
  Send,
  Bell,
  Search,
  Key,
  Copy,
  Check,
  QrCode,
  Smartphone,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Users,
  Briefcase,
  DollarSign,
  Share2,
  X,
  RefreshCw,
  Lock,
  Unlock,
  Edit,
  Receipt,
  Tag,
  Sparkles,
  Layers,
  Clock,
  AlertCircle,
  PiggyBank,
  Loader2,
  Database,
  Download,
  Calendar,
  CalendarDays
} from 'lucide-react';
import { AddonPricingConfig, MasterAdminInvoice, DEFAULT_ADDON_PRICING, SubscriptionRenewalRequest, Expense, CompanyConfig, SubscriptionPlanConfig } from '../types';
import {
  getTierPlan,
  getTierFeatures,
  getTierAllowedModules,
  getAllSubscriptionPlanVariations,
  resolvePlanInfo,
  ResolvedPlanInfo
} from '../lib/masterAdminConfig';
import MasterAdminPricing from './MasterAdminPricing';
import MasterAdminBilling from './MasterAdminBilling';
import DirectRenewalQueue from './DirectRenewalQueue';
import WhatsAppRenewalNoticeModal, { WhatsAppSvgIcon } from './WhatsAppRenewalNoticeModal';

interface MasterAdminDashboardProps {
  tenants: TenantOrg[];
  companyConfig?: CompanyConfig;
  announcements: SystemAnnouncement[];
  expenses?: Expense[];
  onNavigateToExpenses?: () => void;
  onRegisterOrg: (newTenant: TenantOrg) => void | Promise<void>;
  onUpdateTenant?: (updatedTenant: TenantOrg) => void | Promise<void>;
  onToggleTenantStatus: (tenantId: string) => void | Promise<void>;
  onDeleteTenant: (tenantId: string) => void | Promise<void>;
  onSendAnnouncement: (announcement: Omit<SystemAnnouncement, 'id' | 'createdAt' | 'createdBy'>) => void;
  onDeleteAnnouncement: (id: string) => void;
  jobsCountByTenant?: Record<string, number>;
  revenueByTenant?: Record<string, number>;
  onNavigateToSaasBilling?: (tenantId?: string) => void;
  onNavigateToPricing?: () => void;
  pricingConfig?: AddonPricingConfig;
  onSavePricing?: (config: AddonPricingConfig) => void;
  saasInvoices?: MasterAdminInvoice[];
  onAddSaasInvoice?: (inv: MasterAdminInvoice) => void;
  onUpdateSaasInvoice?: (inv: MasterAdminInvoice) => void;
  onDeleteSaasInvoice?: (id: string) => void;
}

export default function MasterAdminDashboard({
  tenants,
  companyConfig,
  announcements,
  expenses = [],
  onNavigateToExpenses,
  onRegisterOrg,
  onUpdateTenant,
  onToggleTenantStatus,
  onDeleteTenant,
  onSendAnnouncement,
  onDeleteAnnouncement,
  jobsCountByTenant = {},
  revenueByTenant = {},
  onNavigateToSaasBilling,
  onNavigateToPricing,
  pricingConfig: propPricingConfig,
  onSavePricing: propOnSavePricing,
  saasInvoices: propSaasInvoices,
  onAddSaasInvoice: propOnAddSaasInvoice,
  onUpdateSaasInvoice: propOnUpdateSaasInvoice,
  onDeleteSaasInvoice: propOnDeleteSaasInvoice
}: MasterAdminDashboardProps) {
  // Navigation Tabs: Accounts / Direct UPI Renewals / Plan Price Set / SaaS Billing
  const [masterTab, setMasterTab] = useState<'accounts' | 'renewals' | 'pricing' | 'billing'>('accounts');
  const [preSelectedBillingTenantId, setPreSelectedBillingTenantId] = useState<string | null>(null);
  const [isSyncingServer, setIsSyncingServer] = useState<boolean>(false);

  // Add-on Pricing Configuration State
  const [localPricingConfig, setLocalPricingConfig] = useState<AddonPricingConfig>(() => {
    try {
      const saved = localStorage.getItem('master_admin_addon_pricing_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ADDON_PRICING;
  });

  const pricingConfig = propPricingConfig || localPricingConfig;

  const handleSavePricing = (newConfig: AddonPricingConfig) => {
    if (propOnSavePricing) {
      propOnSavePricing(newConfig);
    } else {
      setLocalPricingConfig(newConfig);
      try {
        localStorage.setItem('master_admin_addon_pricing_v1', JSON.stringify(newConfig));
      } catch {}
    }
  };

  // Master Admin Generated SaaS Invoices State
  const [localSaasInvoices, setLocalSaasInvoices] = useState<MasterAdminInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('master_admin_saas_invoices_v1');
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

  const saasInvoices = propSaasInvoices || localSaasInvoices;

  const handleAddSaasInvoice = (inv: MasterAdminInvoice) => {
    if (propOnAddSaasInvoice) {
      propOnAddSaasInvoice(inv);
    } else {
      const next = [inv, ...localSaasInvoices];
      setLocalSaasInvoices(next);
      try {
        localStorage.setItem('master_admin_saas_invoices_v1', JSON.stringify(next));
      } catch {}
    }
  };

  const handleUpdateSaasInvoice = (inv: MasterAdminInvoice) => {
    if (propOnUpdateSaasInvoice) {
      propOnUpdateSaasInvoice(inv);
    } else {
      const next = localSaasInvoices.map(i => i.id === inv.id ? inv : i);
      setLocalSaasInvoices(next);
      try {
        localStorage.setItem('master_admin_saas_invoices_v1', JSON.stringify(next));
      } catch {}
    }
  };

  const handleDeleteSaasInvoice = (id: string) => {
    if (propOnDeleteSaasInvoice) {
      propOnDeleteSaasInvoice(id);
    } else {
      const next = localSaasInvoices.filter(i => i.id !== id);
      setLocalSaasInvoices(next);
      try {
        localStorage.setItem('master_admin_saas_invoices_v1', JSON.stringify(next));
      } catch {}
    }
  };

  // Direct UPI Subscription Renewal Requests state
  const [renewalRequests, setRenewalRequests] = useState<SubscriptionRenewalRequest[]>(() => {
    try {
      const saved = localStorage.getItem('inoms_subscription_renewal_requests_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('inoms_subscription_renewal_requests_v1');
        if (saved) setRenewalRequests(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleApproveRenewal = (req: SubscriptionRenewalRequest) => {
    const targetTenant = tenants.find(t => t.id === req.tenantId || t.code === req.tenantCode);
    if (!targetTenant) {
      alert(`Could not find organization ${req.tenantName} (${req.tenantCode}) in system.`);
      return;
    }

    // Calculate new expiration date
    const currentEnd = targetTenant.subscriptionEndDate ? new Date(targetTenant.subscriptionEndDate) : new Date();
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    
    // Calculate duration in days
    let daysToAdd = req.durationDays || 30;
    if (!req.durationDays) {
      if (req.plan === 'quarterly') daysToAdd = 90;
      else if (req.plan === 'annual') daysToAdd = 365;
      else if (req.plan === 'lifetime') daysToAdd = 3650;
      else daysToAdd = 30;
    }

    const newEnd = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const newEndStr = newEnd.toISOString().split('T')[0];

    // Selected add-on keys from client renewal request
    const selectedKeys = req.selectedAddonKeys || [];

    // Core base modules that are always included with any base subscription plan
    const CORE_MODULES = [
      'dashboard',
      'inwards',
      'outwards',
      'billing',
      'payments',
      'clients',
      'inventory',
      'expenses',
      'reports',
      'settings'
    ];

    // Build the exact allowed modules list based on tier or selected keys
    const tierPlan = getTierPlan(req.plan || 'basic');
    const tierAllowed = tierPlan.allowedModules || CORE_MODULES;
    const tierFeats: Partial<TenantFeatures> = tierPlan.features || {};

    const updatedAllowedModules = Array.from(new Set([
      ...CORE_MODULES,
      ...tierAllowed,
      ...selectedKeys
    ]));

    // Explicitly toggle feature flags
    const updatedFeatures: TenantFeatures = {
      allowLiveQueue: !!(tierFeats.allowLiveQueue || selectedKeys.includes('live_queue') || selectedKeys.includes('liveQueue')),
      allowBarcodeQrTags: tierFeats.allowBarcodeQrTags !== false,
      allowHomeServerSync: !!(tierFeats.allowHomeServerSync || selectedKeys.includes('homeServerSync')),
      allowTechnicianAccounts: !!(tierFeats.allowTechnicianAccounts || selectedKeys.includes('technicianAccounts')),
      allowOutwardTaxInvoiceButton: tierFeats.allowOutwardTaxInvoiceButton !== false,
      allowWhatsAppMessaging: true,
      allowedModules: updatedAllowedModules
    };

    const updatedTenant: TenantOrg = {
      ...targetTenant,
      status: 'active',
      subscriptionPlan: (req.plan as 'monthly' | 'quarterly' | 'annual' | 'lifetime' | 'trial') || 'monthly',
      isTrial: false,
      subscriptionEndDate: newEndStr,
      subscriptionStartDate: targetTenant.subscriptionStartDate || new Date().toISOString().split('T')[0],
      features: updatedFeatures
    };

    if (onUpdateTenant) {
      onUpdateTenant(updatedTenant);
    }

    // Update renewal request status
    const updatedRequests = renewalRequests.map(r => 
      r.id === req.id 
        ? { ...r, status: 'approved' as const, approvedAt: new Date().toISOString(), approvedBy: 'Master Admin' }
        : r
    );
    setRenewalRequests(updatedRequests);
    try {
      localStorage.setItem('inoms_subscription_renewal_requests_v1', JSON.stringify(updatedRequests));
    } catch {}

    // Auto-generate SaaS Invoice for records
    const invoiceItems = [
      {
        id: `item-${Date.now()}-plan`,
        description: `SaaS Subscription Renewal (${req.planTitle || req.plan}) - UTR: ${req.utrNumber}`,
        addonKey: 'basePlatform',
        qty: 1,
        rate: req.amount,
        amount: req.amount
      }
    ];

    if (req.selectedAddonTitles && req.selectedAddonTitles.length > 0) {
      req.selectedAddonTitles.forEach((title, idx) => {
        invoiceItems.push({
          id: `item-${Date.now()}-addon-${idx}`,
          description: `Add-on Feature Included: ${title}`,
          addonKey: req.selectedAddonKeys?.[idx] || 'addon',
          qty: 1,
          rate: 0,
          amount: 0
        });
      });
    }

    const autoInvoice: MasterAdminInvoice = {
      id: `INV-RENEW-${Date.now().toString().slice(-6)}`,
      tenantId: targetTenant.id,
      tenantName: targetTenant.name,
      tenantCode: targetTenant.code,
      ownerMobile: targetTenant.ownerMobile,
      ownerName: targetTenant.ownerName,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      billingPeriod: req.plan === 'annual' ? 'Annual' : req.plan === 'quarterly' ? 'Quarterly' : req.plan === 'lifetime' ? 'One-Time' : 'Monthly',
      items: invoiceItems,
      subtotal: req.amount,
      discount: 0,
      gstPercent: 0,
      gstAmount: 0,
      grandTotal: req.amount,
      paymentStatus: 'Paid',
      paymentMode: 'UPI QR',
      notes: `Verified & Auto-Activated by Master Admin on ${new Date().toLocaleDateString('en-IN')}. UTR: ${req.utrNumber}`,
      createdAt: new Date().toISOString()
    };
    handleAddSaasInvoice(autoInvoice);

    alert(`✅ Organization "${targetTenant.name}" has been successfully reactivated with the ${req.planTitle || req.plan} until ${newEndStr}!`);
  };

  const handleRejectRenewal = (requestId: string) => {
    if (!confirm('Are you sure you want to reject this renewal request?')) return;
    const updatedRequests = renewalRequests.map(r => 
      r.id === requestId 
        ? { ...r, status: 'rejected' as const }
        : r
    );
    setRenewalRequests(updatedRequests);
    try {
      localStorage.setItem('inoms_subscription_renewal_requests_v1', JSON.stringify(updatedRequests));
    } catch {}
  };


  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [showSensitiveKeys, setShowSensitiveKeys] = useState<boolean>(false);
  const [adminOrgDetails, setAdminOrgDetails] = useState<Record<string, { pin?: string; secretKey?: string }>>({});

  useEffect(() => {
    fetchAdminOrganizationsViaApi().then(res => {
      if (res.success && Array.isArray(res.organizations)) {
        const details: Record<string, { pin?: string; secretKey?: string }> = {};
        res.organizations.forEach(o => {
          if (o && o.id) {
            details[o.id] = { pin: o.pin, secretKey: o.secretKey };
          }
        });
        setAdminOrgDetails(details);
      }
    }).catch(() => {});
  }, []);

  // Purge System Data Modal State
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purgeWipeMasterData, setPurgeWipeMasterData] = useState<boolean>(false);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState<string>('');
  const [isPurgingData, setIsPurgingData] = useState<boolean>(false);
  const [purgeResultMsg, setPurgeResultMsg] = useState<string>('');

  // Register New Org Modal state
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [regStep, setRegStep] = useState<number>(1);
  const [regName, setRegName] = useState<string>('');
  const [regMobile, setRegMobile] = useState<string>('');
  const [regOwner, setRegOwner] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('1234');
  const [regSecretKey, setRegSecretKey] = useState<string>('');
  const [regSubscriptionType, setRegSubscriptionType] = useState<string>('trial');

  // Edit Org Modal state
  const [editingOrg, setEditingOrg] = useState<TenantOrg | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editOwnerName, setEditOwnerName] = useState<string>('');
  const [editOwnerMobile, setEditOwnerMobile] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('1234');
  const [editSecretKey, setEditSecretKey] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'deactivated'>('active');
  const [editSubPlan, setEditSubPlan] = useState<string>('basic_30d');
  const [editSubEndDate, setEditSubEndDate] = useState<string>('');
  const [editTierTab, setEditTierTab] = useState<'all' | 'basic' | 'business' | 'pro' | 'special'>('all');

  // Subscription Plan Variations available in Master Admin (from Pricing Matrix config or defaults)
  const allPlanVariations = useMemo(() => {
    return getAllSubscriptionPlanVariations(pricingConfig);
  }, [pricingConfig]);

  const basicPlanVariations = useMemo(() => {
    return allPlanVariations.filter(p => p.tier === 'basic');
  }, [allPlanVariations]);

  const businessPlanVariations = useMemo(() => {
    return allPlanVariations.filter(p => p.tier === 'business');
  }, [allPlanVariations]);

  const proPlanVariations = useMemo(() => {
    return allPlanVariations.filter(p => p.tier === 'pro');
  }, [allPlanVariations]);

  const currentEditPlanInfo = useMemo(() => {
    return resolvePlanInfo(editSubPlan, pricingConfig);
  }, [editSubPlan, pricingConfig]);

  const handleSelectPlanVariation = (planKey: string) => {
    setEditSubPlan(planKey);
    const info = resolvePlanInfo(planKey, pricingConfig);
    
    // Automatically calculate expiry date from today
    const d = new Date();
    if (info.key === 'lifetime') {
      d.setFullYear(d.getFullYear() + 10);
    } else {
      d.setDate(d.getDate() + (info.durationDays || 30));
    }
    setEditSubEndDate(d.toISOString().split('T')[0]);

    // Automatically synchronize allowed modules and feature flags based on Tier
    setEditAllowedModules(info.allowedModules);
    setEditAllowLiveQueue(Boolean(info.features.allowLiveQueue));
    setEditAllowHomeServerSync(Boolean(info.features.allowHomeServerSync));
    setEditAllowTechnicianAccounts(Boolean(info.features.allowTechnicianAccounts));
    setEditAllowBarcodeQrTags(info.features.allowBarcodeQrTags !== false);
    setEditAllowOutwardTaxInvoiceButton(info.features.allowOutwardTaxInvoiceButton !== false);
    setEditAllowGoogleDriveSync(Boolean(info.features.allowGoogleDriveSync));
  };

  const handleQuickExtendExpiry = (daysToAdd: number) => {
    const base = editSubEndDate ? new Date(editSubEndDate) : new Date();
    const current = isNaN(base.getTime()) ? new Date() : base;
    const startFrom = current.getTime() < Date.now() ? new Date() : current;
    startFrom.setDate(startFrom.getDate() + daysToAdd);
    setEditSubEndDate(startFrom.toISOString().split('T')[0]);
  };

  // Modular Feature Add-ons State for Master Admin Control
  const [editAllowLiveQueue, setEditAllowLiveQueue] = useState<boolean>(true);
  const [editAllowHomeServerSync, setEditAllowHomeServerSync] = useState<boolean>(true);
  const [editAllowBarcodeQrTags, setEditAllowBarcodeQrTags] = useState<boolean>(true);
  const [editAllowTechnicianAccounts, setEditAllowTechnicianAccounts] = useState<boolean>(true);
  const [editAllowOutwardTaxInvoiceButton, setEditAllowOutwardTaxInvoiceButton] = useState<boolean>(true);
  const [editAllowGoogleDriveSync, setEditAllowGoogleDriveSync] = useState<boolean>(true);
  const [editAllowedModules, setEditAllowedModules] = useState<string[]>([
    'dashboard', 'live_queue', 'inwards', 'outwards', 'billing', 'payments', 'inventory', 'expenses', 'reports', 'settings'
  ]);

  const handleOpenEditModal = (org: TenantOrg) => {
    const adminDetails = adminOrgDetails[org.id] || {};
    setEditingOrg(org);
    setEditName(org.name);
    setEditCode(org.code);
    setEditOwnerName(org.ownerName || '');
    setEditOwnerMobile(org.ownerMobile);
    setEditPin(adminDetails.pin !== undefined && adminDetails.pin !== null ? adminDetails.pin : (org.pin !== undefined && org.pin !== null ? org.pin : '1234'));
    setEditSecretKey(adminDetails.secretKey || org.secretKey || '');
    setEditStatus(org.status);
    
    const initialPlan = org.subscriptionPlan || (org.isTrial ? 'trial' : 'basic_30d');
    setEditSubPlan(initialPlan);
    const resolved = resolvePlanInfo(initialPlan, pricingConfig);
    setEditTierTab(resolved.tier === 'trial' || resolved.tier === 'lifetime' ? 'special' : resolved.tier);
    
    // Default or existing subscription end date
    if (org.subscriptionEndDate) {
      setEditSubEndDate(org.subscriptionEndDate.split('T')[0]);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + (resolved.durationDays || (org.isTrial ? 7 : 30)));
      setEditSubEndDate(d.toISOString().split('T')[0]);
    }

    const f = getTenantFeatures(org);
    setEditAllowLiveQueue(f.allowLiveQueue);
    setEditAllowHomeServerSync(f.allowHomeServerSync);
    setEditAllowBarcodeQrTags(f.allowBarcodeQrTags);
    setEditAllowTechnicianAccounts(f.allowTechnicianAccounts);
    setEditAllowOutwardTaxInvoiceButton(f.allowOutwardTaxInvoiceButton);
    setEditAllowGoogleDriveSync(f.allowGoogleDriveSync);
    setEditAllowedModules(f.allowedModules);
  };

  // Strict In-flight Operation State Tracking (prevents premature clicks, provides live saving spinners)
  const [togglingTenantId, setTogglingTenantId] = useState<string | null>(null);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [isSavingEditOrg, setIsSavingEditOrg] = useState<boolean>(false);

  const handleToggleStatus = async (orgId: string) => {
    if (togglingTenantId || deletingTenantId) return;
    setTogglingTenantId(orgId);
    try {
      await onToggleTenantStatus(orgId);
    } finally {
      setTogglingTenantId(null);
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (togglingTenantId || deletingTenantId) return;
    if (confirm(`Are you sure you want to PERMANENTLY DELETE organization account "${orgName}"? This action cannot be undone.`)) {
      setDeletingTenantId(orgId);
      try {
        await onDeleteTenant(orgId);
      } finally {
        setDeletingTenantId(null);
      }
    }
  };

  const handleSaveEditOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg || isSavingEditOrg) return;
    if (!editName.trim() || !editCode.trim() || !editOwnerMobile.trim()) {
      alert('Please fill in required organization fields (Name, Code, and Owner Mobile).');
      return;
    }

    let finalEndDate = editSubEndDate;
    if (editStatus === 'active') {
      const isPastOrEmpty = !finalEndDate || new Date(finalEndDate).getTime() < Date.now();
      if (isPastOrEmpty) {
        const planInfo = resolvePlanInfo(editSubPlan, pricingConfig);
        const d = new Date();
        if (planInfo.key === 'lifetime') {
          d.setFullYear(d.getFullYear() + 10);
        } else {
          d.setDate(d.getDate() + (planInfo.durationDays || 30));
        }
        finalEndDate = d.toISOString().split('T')[0];
      }
    }

    const isPlanTrial = editSubPlan === 'trial' || editSubPlan === 'free_trial';

    const updated: TenantOrg = {
      ...editingOrg,
      name: editName.trim(),
      code: editCode.trim().toUpperCase(),
      ownerName: editOwnerName.trim() || 'Org Admin',
      ownerMobile: editOwnerMobile.trim(),
      pin: editPin.trim(), // Can be blank ('') to enforce Microsoft Authenticator TOTP only
      secretKey: editSecretKey.trim() || generateBase32Secret(),
      status: editStatus,
      subscriptionPlan: editSubPlan,
      subscriptionEndDate: finalEndDate,
      isTrial: isPlanTrial,
      features: {
        allowLiveQueue: editAllowLiveQueue,
        allowHomeServerSync: editAllowHomeServerSync,
        allowBarcodeQrTags: editAllowBarcodeQrTags,
        allowWhatsAppMessaging: true, // Always allowed for all organizations
        allowTechnicianAccounts: editAllowTechnicianAccounts,
        allowOutwardTaxInvoiceButton: editAllowOutwardTaxInvoiceButton,
        allowGoogleDriveSync: editAllowGoogleDriveSync,
        allowedModules: editAllowedModules
      }
    };

    setIsSavingEditOrg(true);
    try {
      if (onUpdateTenant) {
        await onUpdateTenant(updated);
      }
      setEditingOrg(null);
    } catch (err) {
      console.error('Failed to update tenant:', err);
    } finally {
      setIsSavingEditOrg(false);
    }
  };

  // Share Access Credential Modal
  const [selectedShareOrg, setSelectedShareOrg] = useState<TenantOrg | null>(null);
  const [copiedCreds, setCopiedCreds] = useState<boolean>(false);

  // WhatsApp Subscription Expiry & Renewal Notice Modal
  const [selectedWhatsAppOrg, setSelectedWhatsAppOrg] = useState<TenantOrg | null>(null);

  // Broadcast Message State
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'urgent'>('info');
  const [broadcastSentSuccess, setBroadcastSentSuccess] = useState<boolean>(false);

  // Filtered orgs excluding internal system config containers (e.g. global_system_branding)
  const visibleTenants = useMemo(() => {
    return tenants.filter(t => t && t.id && t.id !== 'global_system_branding' && t.code !== 'GLOBAL_SYS');
  }, [tenants]);

  const filteredTenants = visibleTenants.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ownerMobile.includes(searchTerm) ||
      (t.ownerName && t.ownerName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'active') return matchesSearch && t.status === 'active';
    if (statusFilter === 'deactivated') return matchesSearch && t.status === 'deactivated';
    return matchesSearch;
  });

  const activeCount = visibleTenants.filter(t => t.status === 'active').length;
  const deactivatedCount = visibleTenants.filter(t => t.status === 'deactivated').length;

  const handleOpenRegisterModal = () => {
    setRegName('');
    setRegMobile('+91 ');
    setRegOwner('');
    setRegPin('1234');
    setRegStep(1);
    setShowRegisterModal(true);
  };

  const handleProceedTo2FASetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regMobile) return;
    const secret = generateBase32Secret(regName + regMobile);
    setRegSecretKey(secret);
    setRegStep(2);
  };

  const handleFinalizeRegistration = () => {
    if (!regName || !regMobile) return;
    
    // Calculate subscription dates based on selected trial/plan
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now);
    
    const planInfo = resolvePlanInfo(regSubscriptionType, pricingConfig);
    const isTrial = planInfo.key === 'trial' || regSubscriptionType === 'trial_7d';
    const trialDays = isTrial ? 7 : 0;
    
    if (planInfo.key === 'lifetime') {
      endDate.setFullYear(endDate.getFullYear() + 10);
    } else {
      endDate.setDate(endDate.getDate() + (planInfo.durationDays || (isTrial ? 7 : 30)));
    }

    const newOrg: TenantOrg = {
      id: `org-${Date.now()}`,
      name: regName,
      code: `${regName.substring(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      pin: regPin || '1234',
      ownerMobile: regMobile,
      ownerName: regOwner || 'Org Administrator',
      status: 'active',
      createdAt: startDate,
      secretKey: regSecretKey,
      subscriptionPlan: planInfo.key,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate.toISOString().split('T')[0],
      trialDays,
      isTrial,
      features: {
        allowLiveQueue: Boolean(planInfo.features.allowLiveQueue),
        allowHomeServerSync: Boolean(planInfo.features.allowHomeServerSync),
        allowBarcodeQrTags: planInfo.features.allowBarcodeQrTags !== false,
        allowWhatsAppMessaging: true,
        allowTechnicianAccounts: Boolean(planInfo.features.allowTechnicianAccounts),
        allowOutwardTaxInvoiceButton: planInfo.features.allowOutwardTaxInvoiceButton !== false,
        allowGoogleDriveSync: isTrial || planInfo.key === 'lifetime' || Boolean(planInfo.features.allowGoogleDriveSync),
        allowedModules: planInfo.allowedModules || [
          'dashboard', 'live_queue', 'inwards', 'outwards', 'billing', 'payments', 'inventory', 'expenses', 'reports', 'settings'
        ]
      }
    };

    onRegisterOrg(newOrg);
    setShowRegisterModal(false);
    setSelectedShareOrg(newOrg);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;

    onSendAnnouncement({
      title: broadcastTitle,
      message: broadcastMessage,
      targetTenantId: broadcastTarget,
      severity: broadcastSeverity
    });

    setBroadcastTitle('');
    setBroadcastMessage('');
    setBroadcastSentSuccess(true);
    setTimeout(() => setBroadcastSentSuccess(false), 3000);
  };

  const handleCopyAccessDetails = (org: TenantOrg) => {
    const adminDetails = adminOrgDetails[org.id] || {};
    const text = `🔑 *SAAS WORKSPACE ACCESS CREDENTIALS*
---------------------------------------
🏢 Organization: ${org.name}
🆔 Workspace Code: ${org.code}
📱 Owner Mobile: ${org.ownerMobile}
👤 Owner Name: ${org.ownerName || 'Admin'}
🔑 PIN: ${adminDetails.pin || org.pin || '1234'}
🔐 2FA Secret Key: ${adminDetails.secretKey || org.secretKey || 'Standard TOTP'}
---------------------------------------
Login Page: Access with registered mobile and PIN on the portal.`;

    navigator.clipboard.writeText(text);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-4 sm:p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Platform Master Admin Dashboard</h1>
            <span className="bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30 uppercase">
              Super Admin Level
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Control SaaS tenant organization accounts, manage active/deactivated access, broadcast system announcements, and register new organizations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={async () => {
              setIsSyncingServer(true);
              try {
                await fetchTenantsOnce(true);
              } catch (e) {}
              setIsSyncingServer(false);
            }}
            disabled={isSyncingServer}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3.5 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
            title="Fetch the freshest organization data directly from live server database"
          >
            <RefreshCw className={`w-4 h-4 text-teal-400 ${isSyncingServer ? 'animate-spin' : ''}`} />
            <span>{isSyncingServer ? 'Syncing...' : 'Live Server Sync'}</span>
          </button>

          <a
            href="/api/admin/download-sqlite?tenantId=org-admin"
            download="inoms_primary.db"
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3.5 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
            title="Download live SQLite database binary file (inoms_primary.db) directly from server disk"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Download inoms_primary.db</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setPurgeConfirmationText('');
              setPurgeResultMsg('');
              setShowPurgeModal(true);
            }}
            className="w-full sm:w-auto bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs px-3.5 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 border border-rose-500/50"
            title="Clean all organization records and reset to clean production state (Master Admin only)"
          >
            <Trash2 className="w-4 h-4 text-rose-200" /> Factory Reset / Clean DB
          </button>

          <button
            type="button"
            onClick={handleOpenRegisterModal}
            className="w-full sm:w-auto bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs px-4 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Register New Organization
          </button>
        </div>
      </div>

      {/* Top Sub-Navigation Tabs */}
      <div className="flex items-center bg-slate-200/80 p-1.5 rounded-2xl gap-1.5 sm:gap-2 text-xs font-bold w-full sm:w-fit overflow-x-auto scrollbar-none shadow-inner">
        <button
          type="button"
          onClick={() => setMasterTab('accounts')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
            masterTab === 'accounts'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Organizations & Workspaces</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full border border-slate-200">
            {visibleTenants.length}
          </span>
        </button>

        {/* Dedicated Direct UPI Renewal Requests Queue Tab */}
        <button
          type="button"
          onClick={() => setMasterTab('renewals')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
            masterTab === 'renewals'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold ring-2 ring-emerald-500/30'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Direct UPI Renewal Requests</span>
          {renewalRequests.filter(r => r.status === 'pending').length > 0 ? (
            <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-xs">
              {renewalRequests.filter(r => r.status === 'pending').length} PENDING
            </span>
          ) : (
            <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
              {renewalRequests.length} Total
            </span>
          )}
        </button>

        {/* Plan Price Set (Plans & UPI Config + Add-on Rates) */}
        <button
          type="button"
          onClick={() => setMasterTab('pricing')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
            masterTab === 'pricing'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold ring-2 ring-teal-500/30'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Plan Price Set</span>
          <span className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full border border-teal-200">
            Plans &amp; UPI
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMasterTab('billing')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
            masterTab === 'billing'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4 text-teal-600 shrink-0" />
          <span>SaaS Bill Generation & Invoices</span>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
            {saasInvoices.length} Bills
          </span>
        </button>
      </div>

      {/* Tab 1: Organizations & Workspaces */}
      {masterTab === 'accounts' && (
        <>
          {/* Overview Stat Cards with Subscription Health */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expiringSoonOrExpired = visibleTenants.filter(t => {
              if (t.id === 'org-admin' || t.code?.toUpperCase() === 'ADMIN-00' || t.ownerMobile?.includes('8149862034')) return false;
              if (!t.subscriptionEndDate) return false;
              const end = new Date(t.subscriptionEndDate);
              end.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays <= 7; // Expired or expiring within 7 days
            });

            const expiredCount = expiringSoonOrExpired.filter(t => {
              const end = new Date(t.subscriptionEndDate!);
              end.setHours(0, 0, 0, 0);
              return end.getTime() < today.getTime();
            }).length;

            const trialsCount = visibleTenants.filter(t => t.isTrial || t.subscriptionPlan === 'trial').length;

            const pendingRenewalsCount = renewalRequests.filter(r => r.status === 'pending').length;

            return (
              <div className="space-y-4">
                {/* DIRECT UPI RENEWAL PENDING BANNER */}
                {pendingRenewalsCount > 0 && (
                  <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-4 sm:p-5 rounded-2xl text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in border border-emerald-400/40">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs ring-2 ring-white/30 shrink-0">
                        <QrCode className="w-6 h-6 text-amber-300 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-black text-base flex items-center gap-2">
                          <span>Pending Direct UPI Renewal Approvals</span>
                          <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs">
                            {pendingRenewalsCount} REQUEST{pendingRenewalsCount > 1 ? 'S' : ''} WAITING
                          </span>
                        </h4>
                        <p className="text-xs text-white/90 mt-0.5">
                          Organizations have paid via direct UPI QR code and submitted 12-digit UTR references awaiting verification.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMasterTab('renewals')}
                      className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Open Approval Queue ({pendingRenewalsCount})</span>
                    </button>
                  </div>
                )}

                {/* Expiring / Expired Subscription Alert Bar if any */}
                {expiringSoonOrExpired.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 p-4 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                        <AlertCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm flex items-center gap-2">
                          <span>Subscription Expiry Alert</span>
                          <span className="bg-white/30 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {expiringSoonOrExpired.length} {expiringSoonOrExpired.length === 1 ? 'Org' : 'Orgs'} Requiring Attention
                          </span>
                        </h4>
                        <p className="text-xs text-white/90">
                          {expiredCount > 0 
                            ? `${expiredCount} organization subscription(s) have expired! Review access or renew their plans.` 
                            : `${expiringSoonOrExpired.length} organization subscription(s) / 7-day trials are expiring within 7 days.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {expiringSoonOrExpired.slice(0, 3).map(org => {
                        const end = new Date(org.subscriptionEndDate!);
                        end.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isExpired = diffDays < 0;

                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => handleOpenEditModal(org)}
                            className="bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-xl text-white font-bold flex items-center gap-1.5 transition cursor-pointer border border-white/30"
                          >
                            <span>{org.name}:</span>
                            <span className={isExpired ? 'underline decoration-rose-300 font-extrabold' : 'font-extrabold'}>
                              {isExpired ? `Expired (${Math.abs(diffDays)}d ago)` : diffDays === 0 ? 'Expires Today' : `${diffDays}d left`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Workspaces</p>
                      <h3 className="text-2xl font-black text-slate-900 mt-1">{visibleTenants.length}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Registered Orgs</p>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
                      <Building className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Accounts</p>
                      <h3 className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</h3>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Full Access</p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Direct UPI Pending Renewals Card */}
                  <div 
                    onClick={() => setMasterTab('renewals')}
                    className={`border rounded-2xl p-4 shadow-2xs flex items-center justify-between cursor-pointer transition ${
                      pendingRenewalsCount > 0 
                        ? 'bg-amber-50/60 border-amber-300 hover:border-amber-400 ring-2 ring-amber-400/20' 
                        : 'bg-white border-slate-200/80 hover:border-emerald-300'
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">UPI Renewals</p>
                      <h3 className="text-2xl font-black text-amber-800 mt-1">{pendingRenewalsCount}</h3>
                      <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                        {pendingRenewalsCount > 0 ? `${pendingRenewalsCount} Pending Approval` : 'Queue Cleared'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-2xl ${pendingRenewalsCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      <QrCode className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Expense Outflow Card */}
                  <div 
                    onClick={() => onNavigateToExpenses && onNavigateToExpenses()}
                    className="bg-white border border-slate-200/80 hover:border-amber-300 rounded-2xl p-4 shadow-2xs flex items-center justify-between cursor-pointer transition group"
                    title="Click to view and manage operational Expense Outflows"
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-amber-800">Expense Outflows</p>
                      <h3 className="text-2xl font-black text-slate-900 group-hover:text-amber-800 mt-1">
                        ₹{(expenses || []).filter(e => !e.isDeleted).reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString('en-IN')}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">{(expenses || []).filter(e => !e.isDeleted).length} Recorded Outflows</p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl group-hover:scale-110 transition">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">7-Day Free Trials</p>
                      <h3 className="text-2xl font-black text-teal-600 mt-1">{trialsCount}</h3>
                      <p className="text-[10px] text-teal-600 font-semibold mt-0.5">Trial Evaluation</p>
                    </div>
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expiring / Expired</p>
                      <h3 className={`text-2xl font-black mt-1 ${expiringSoonOrExpired.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {expiringSoonOrExpired.length}
                      </h3>
                      <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                        {expiredCount > 0 ? `${expiredCount} Expired` : 'Within 7 Days'}
                      </p>
                    </div>
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

      {/* Main Section: Organizations Directory & Control Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Table Filter Controls Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-teal-600" /> SaaS Organization Account Controls
            </h2>
            <p className="text-xs text-slate-500">Manage tenant accounts, activate or deactivate login permissions, and share access.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search org name, mobile, code..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
              {(['all', 'active', 'deactivated'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer ${
                    statusFilter === f
                      ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Organizations Card List (Phones & Small Tablets) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredTenants.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No matching organizations found.
            </div>
          ) : (
            filteredTenants.map(org => {
              const isMasterAdmin = org.id === 'org-admin' || org.code?.toUpperCase() === 'ADMIN-00' || org.ownerMobile?.includes('8149862034');
              const isActive = isMasterAdmin ? true : org.status === 'active';

              // Subscription & Status Theme Calculation
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              let subBadge = null;
              let statusTheme = {
                cardClass: 'border-l-4 border-l-slate-300 border-t border-r border-b border-slate-200 hover:bg-slate-50',
                subtleBorder: 'border-slate-200'
              };

              if (isMasterAdmin) {
                subBadge = (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200">
                    ♾️ Lifetime System
                  </span>
                );
                statusTheme = {
                  cardClass: 'border-l-4 border-l-teal-600 border-t border-r border-b border-teal-200 hover:bg-teal-50/40 bg-teal-50/10',
                  subtleBorder: 'border-teal-200'
                };
              } else if (!isActive) {
                subBadge = (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200">
                    Deactivated
                  </span>
                );
                statusTheme = {
                  cardClass: 'border-l-4 border-l-slate-400 border-t border-r border-b border-slate-200 hover:bg-slate-100/60 bg-slate-50/60',
                  subtleBorder: 'border-slate-200'
                };
              } else if (org.subscriptionEndDate) {
                const end = new Date(org.subscriptionEndDate);
                end.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isExpired = diffDays < 0;
                const isTrial = org.isTrial || org.subscriptionPlan === 'trial';
                const planDetails = resolvePlanInfo(org.subscriptionPlan, pricingConfig);

                if (isExpired) {
                  subBadge = (
                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-rose-300">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" /> Expired ({Math.abs(diffDays)}d ago) · {planDetails.tierLabel}
                    </span>
                  );
                  statusTheme = {
                    cardClass: 'border-l-4 border-l-rose-500 border-t border-r border-b border-rose-200 hover:bg-rose-50/60 bg-rose-50/20',
                    subtleBorder: 'border-rose-200'
                  };
                } else if (diffDays <= 7) {
                  subBadge = (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-amber-300 animate-pulse">
                      <Clock className="w-3 h-3 text-amber-700 shrink-0" /> {diffDays === 0 ? 'Expires Today' : `${diffDays}d left`} · {planDetails.tierLabel}
                    </span>
                  );
                  statusTheme = {
                    cardClass: 'border-l-4 border-l-amber-500 border-t border-r border-b border-amber-200 hover:bg-amber-50/60 bg-amber-50/20',
                    subtleBorder: 'border-amber-200'
                  };
                } else {
                  subBadge = (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${planDetails.tierBadgeClass}`}>
                      {planDetails.tierLabel} · {planDetails.durationLabel} ({diffDays}d left)
                    </span>
                  );
                  statusTheme = {
                    cardClass: isTrial
                      ? 'border-l-4 border-l-indigo-500 border-t border-r border-b border-indigo-200 hover:bg-indigo-50/60 bg-indigo-50/15'
                      : planDetails.tier === 'pro'
                      ? 'border-l-4 border-l-purple-500 border-t border-r border-b border-purple-200 hover:bg-purple-50/50 bg-white'
                      : planDetails.tier === 'business'
                      ? 'border-l-4 border-l-blue-500 border-t border-r border-b border-blue-200 hover:bg-blue-50/50 bg-white'
                      : 'border-l-4 border-l-emerald-500 border-t border-r border-b border-emerald-200 hover:bg-emerald-50/50 bg-white',
                    subtleBorder: isTrial ? 'border-indigo-200' : 'border-emerald-200'
                  };
                }
              } else {
                subBadge = (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200">
                    {org.createdAt || 'Standard'}
                  </span>
                );
              }

              return (
                <div key={org.id} className={`p-3.5 space-y-2.5 transition rounded-xl my-1.5 mx-2 ${statusTheme.cardClass}`}>
                  {/* Top: Avatar, Name, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs ${
                        isMasterAdmin ? 'bg-slate-900 ring-2 ring-teal-500/50' : isActive ? 'bg-teal-600' : 'bg-slate-400'
                      }`}>
                        {org.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate">{org.name}</span>
                          {isMasterAdmin && (
                            <span className="bg-teal-100 text-teal-800 font-extrabold text-[9px] px-1.5 py-0.2 rounded-full border border-teal-200 shrink-0">
                              Master Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>Owner: <strong className="text-slate-700">{org.ownerName || 'Admin'}</strong></span>
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-[9px]">
                            {org.code}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isMasterAdmin ? (
                        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold text-[9px]">
                          <ShieldCheck className="w-3 h-3 text-teal-600" /> Protected
                        </span>
                      ) : isActive ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[9px]">
                          <Lock className="w-3 h-3 text-rose-600" /> Deactivated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Details row */}
                  <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Mobile:</span>
                      {org.ownerMobile ? (
                        <a
                          href={`tel:${org.ownerMobile}`}
                          className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[10px]"
                        >
                          {org.ownerMobile}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">None</span>
                      )}
                    </div>

                    <div>{subBadge}</div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Generate SaaS Bill */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToSaasBilling) {
                            onNavigateToSaasBilling(org.id);
                          } else {
                            setPreSelectedBillingTenantId(org.id);
                            setMasterTab('billing');
                          }
                        }}
                        className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-200"
                        title="Generate SaaS Bill"
                      >
                        <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Bill</span>
                      </button>

                      {/* Share Credentials */}
                      <button
                        type="button"
                        onClick={() => setSelectedShareOrg(org)}
                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-slate-200"
                        title="View / Share Access Credentials"
                      >
                        <Share2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>Share</span>
                      </button>

                      {/* Edit Details */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(org)}
                        className="px-2 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-teal-200"
                        title="Edit Organization Details"
                      >
                        <Edit className="w-3.5 h-3.5 text-teal-600" />
                        <span>Edit</span>
                      </button>

                      {/* WhatsApp Expiry & Renewal Notice - Compact Icon Button */}
                      {!isMasterAdmin && (
                        <button
                          type="button"
                          onClick={() => setSelectedWhatsAppOrg(org)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition cursor-pointer flex items-center justify-center shadow-2xs"
                          title="Send Subscription Expiry / Renewal Notice via WhatsApp"
                        >
                          <WhatsAppSvgIcon className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}
                    </div>

                    {!isMasterAdmin && (
                      <div className="flex items-center gap-1.5">
                        {/* Toggle Active / Deactive */}
                        <button
                          type="button"
                          disabled={togglingTenantId === org.id || deletingTenantId === org.id}
                          onClick={() => handleToggleStatus(org.id)}
                          className={`p-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 border shadow-2xs ${
                            togglingTenantId === org.id
                              ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-wait'
                              : isActive
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                          }`}
                          title={isActive ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {togglingTenantId === org.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Delete Org / Account */}
                        <button
                          type="button"
                          disabled={togglingTenantId === org.id || deletingTenantId === org.id}
                          onClick={() => handleDeleteOrg(org.id, org.name)}
                          className={`p-1.5 rounded-lg transition cursor-pointer border text-xs font-bold ${
                            deletingTenantId === org.id
                              ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-wait'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          }`}
                          title="Delete Organization Account"
                        >
                          {deletingTenantId === org.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Organizations Table - Compact & Plan Status Colored */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3 whitespace-nowrap">Organization</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Org Code</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Owner Contact</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Plan & Expiry</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Account Status</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-slate-700">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No matching organizations found.
                  </td>
                </tr>
              ) : (
                filteredTenants.map(org => {
                  const isMasterAdmin = org.id === 'org-admin' || org.code?.toUpperCase() === 'ADMIN-00' || org.ownerMobile?.includes('8149862034');
                  const isActive = isMasterAdmin ? true : org.status === 'active';

                  // Subscription & Status Theme Calculation
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  let subBadge = null;
                  let rowBorderLeft = 'border-l-4 border-l-slate-300';
                  let rowBorderBottom = 'border-b border-slate-100';
                  let rowHoverBg = 'hover:bg-slate-50';
                  let rowBaseBg = 'bg-white';

                  if (isMasterAdmin) {
                    subBadge = (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200">
                        ♾️ Lifetime System
                      </span>
                    );
                    rowBorderLeft = 'border-l-4 border-l-teal-600';
                    rowBorderBottom = 'border-b border-teal-100/70';
                    rowHoverBg = 'hover:bg-teal-50/50';
                    rowBaseBg = 'bg-teal-50/10';
                  } else if (!isActive) {
                    rowBorderLeft = 'border-l-4 border-l-slate-400';
                    rowBorderBottom = 'border-b border-slate-200';
                    rowHoverBg = 'hover:bg-slate-100/70';
                    rowBaseBg = 'bg-slate-50/60';
                  } else if (org.subscriptionEndDate) {
                    const end = new Date(org.subscriptionEndDate);
                    end.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = diffDays < 0;
                    const isTrial = org.isTrial || org.subscriptionPlan === 'trial';
                    const planDetails = resolvePlanInfo(org.subscriptionPlan, pricingConfig);

                    if (isExpired) {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" /> Expired ({Math.abs(diffDays)}d ago) · {planDetails.tierLabel}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">{org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                      rowBorderLeft = 'border-l-4 border-l-rose-500';
                      rowBorderBottom = 'border-b border-rose-100';
                      rowHoverBg = 'hover:bg-rose-50/70';
                      rowBaseBg = 'bg-rose-50/15';
                    } else if (diffDays <= 7) {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700 shrink-0" /> {diffDays === 0 ? 'Expires Today' : `${diffDays}d left`} · {planDetails.tierLabel}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">{org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                      rowBorderLeft = 'border-l-4 border-l-amber-500';
                      rowBorderBottom = 'border-b border-amber-100';
                      rowHoverBg = 'hover:bg-amber-50/70';
                      rowBaseBg = 'bg-amber-50/15';
                    } else if (isTrial) {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-md text-[10px] font-bold border border-indigo-200">
                            🎁 7-Day Trial ({diffDays}d)
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">Until {org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                      rowBorderLeft = 'border-l-4 border-l-indigo-500';
                      rowBorderBottom = 'border-b border-indigo-100';
                      rowHoverBg = 'hover:bg-indigo-50/60';
                      rowBaseBg = 'bg-indigo-50/15';
                    } else {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${planDetails.tierBadgeClass}`}>
                            {planDetails.tierLabel} · {planDetails.durationLabel} ({diffDays}d)
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">Until {org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                      rowBorderLeft = planDetails.tier === 'pro'
                        ? 'border-l-4 border-l-purple-500'
                        : planDetails.tier === 'business'
                        ? 'border-l-4 border-l-blue-500'
                        : 'border-l-4 border-l-emerald-500';
                      rowBorderBottom = 'border-b border-slate-100';
                      rowHoverBg = 'hover:bg-slate-50';
                      rowBaseBg = 'bg-white';
                    }
                  } else {
                    subBadge = (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200">
                        {org.createdAt || 'Standard'}
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={org.id}
                      className={`${rowBaseBg} ${rowHoverBg} transition-colors duration-150 group`}
                    >
                      {/* Organization Name & Avatar */}
                      <td className={`py-2 px-3 whitespace-nowrap ${rowBorderLeft} ${rowBorderBottom}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px] shrink-0 shadow-2xs ${
                            isMasterAdmin ? 'bg-slate-900 ring-1 ring-teal-500/50' : isActive ? 'bg-teal-600' : 'bg-slate-400'
                          }`}>
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 truncate max-w-[200px]">
                              <span className="truncate">{org.name}</span>
                              {isMasterAdmin && (
                                <span className="bg-teal-100 text-teal-800 font-extrabold text-[9px] px-1.5 py-0.2 rounded-full border border-teal-200 shrink-0">
                                  Master
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              Owner: <span className="text-slate-600 font-medium">{org.ownerName || 'Admin'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Org Code */}
                      <td className={`py-2 px-2.5 whitespace-nowrap ${rowBorderBottom}`}>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-800 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                          {org.code}
                        </span>
                      </td>

                      {/* Owner Contact */}
                      <td className={`py-2 px-2.5 whitespace-nowrap font-mono text-xs font-semibold text-slate-800 ${rowBorderBottom}`}>
                        {org.ownerMobile ? (
                          <a
                            href={`tel:${org.ownerMobile}`}
                            className="hover:text-teal-700 transition"
                            title="Call Owner"
                          >
                            {org.ownerMobile}
                          </a>
                        ) : (
                          <span className="text-slate-400 font-normal italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Plan & Expiry */}
                      <td className={`py-2 px-2.5 whitespace-nowrap ${rowBorderBottom}`}>
                        {subBadge}
                      </td>

                      {/* Account Status */}
                      <td className={`py-2 px-2.5 whitespace-nowrap ${rowBorderBottom}`}>
                        {isMasterAdmin ? (
                          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-teal-600" /> Protected
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <Lock className="w-3 h-3 text-rose-600" /> Deactivated
                          </span>
                        )}
                      </td>

                      {/* Compact Icon Actions - No Horizontal Scroll on Big Screens */}
                      <td className={`py-2 px-3 whitespace-nowrap text-right ${rowBorderBottom}`}>
                        <div className="flex items-center justify-end gap-1">
                          
                          {/* Generate SaaS Bill */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToSaasBilling) {
                                onNavigateToSaasBilling(org.id);
                              } else {
                                setPreSelectedBillingTenantId(org.id);
                                setMasterTab('billing');
                              }
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer border border-emerald-200 shadow-2xs hover:scale-105 active:scale-95"
                            title="Generate SaaS Bill"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>

                          {/* Share Credentials */}
                          <button
                            type="button"
                            onClick={() => setSelectedShareOrg(org)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200 shadow-2xs hover:scale-105 active:scale-95"
                            title="View / Share Access Credentials"
                          >
                            <Share2 className="w-3.5 h-3.5 text-teal-600" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(org)}
                            className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg transition cursor-pointer border border-teal-200 shadow-2xs hover:scale-105 active:scale-95"
                            title="Edit Organization Details"
                          >
                            <Edit className="w-3.5 h-3.5 text-teal-600" />
                          </button>

                          {/* WhatsApp Expiry & Renewal Notice - Compact Icon Button */}
                          {!isMasterAdmin && (
                            <button
                              type="button"
                              onClick={() => setSelectedWhatsAppOrg(org)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                              title="Send Subscription Expiry / Renewal Notice via WhatsApp"
                            >
                              <WhatsAppSvgIcon className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}

                          {!isMasterAdmin && (
                            <>
                              {/* Toggle Active / Deactive */}
                              <button
                                type="button"
                                disabled={togglingTenantId === org.id || deletingTenantId === org.id}
                                onClick={() => handleToggleStatus(org.id)}
                                className={`p-1.5 rounded-lg transition cursor-pointer border shadow-2xs hover:scale-105 active:scale-95 ${
                                  togglingTenantId === org.id
                                    ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-wait'
                                    : isActive
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                }`}
                                title={isActive ? 'Deactivate Account' : 'Activate Account'}
                              >
                                {togglingTenantId === org.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Delete Org / Account */}
                              <button
                                type="button"
                                disabled={togglingTenantId === org.id || deletingTenantId === org.id}
                                onClick={() => handleDeleteOrg(org.id, org.name)}
                                className={`p-1.5 rounded-lg transition cursor-pointer border shadow-2xs hover:scale-105 active:scale-95 ${
                                  deletingTenantId === org.id
                                    ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-wait'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                }`}
                                title="Delete Organization Account"
                              >
                                {deletingTenantId === org.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Announcement System */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Broadcast Message Form */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Send Broadcast Announcement</h3>
              <p className="text-[11px] text-slate-500">Messages will display in organization notification headers.</p>
            </div>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Target Audience</label>
              <select
                value={broadcastTarget}
                onChange={e => setBroadcastTarget(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">📢 All Registered Organizations ({visibleTenants.length})</option>
                {visibleTenants.map(t => (
                  <option key={t.id} value={t.id}>🏢 {t.name} ({t.ownerMobile})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Message Severity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['info', 'warning', 'urgent'] as const).map(sev => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setBroadcastSeverity(sev)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border ${
                      broadcastSeverity === sev
                        ? sev === 'urgent'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : sev === 'warning'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Announcement Subject Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled System Upgrade"
                value={broadcastTitle}
                onChange={e => setBroadcastTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Message Body / Reminder Text</label>
              <textarea
                required
                rows={3}
                placeholder="Type your message details or reminder here..."
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-teal-400" /> Dispatch Announcement Broadcast
            </button>

            {broadcastSentSuccess && (
              <p className="text-xs text-emerald-600 font-bold text-center bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                ✓ Announcement broadcast sent successfully to organizations!
              </p>
            )}
          </form>
        </div>

        {/* Sent Announcements History List */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active System Announcements</h3>
                <p className="text-[11px] text-slate-500">Live broadcasts currently visible in organization workspaces.</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              Count: {announcements.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {announcements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs font-medium">No active broadcasts. Create one on the left.</p>
              </div>
            ) : (
              announcements.map(ann => {
                const isAll = ann.targetTenantId === 'all';
                const targetOrg = tenants.find(t => t.id === ann.targetTenantId);
                return (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 ${
                      ann.severity === 'urgent'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : ann.severity === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-teal-50/70 border-teal-200 text-teal-950'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          ann.severity === 'urgent'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : ann.severity === 'warning'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-teal-600 text-white border-teal-600'
                        }`}>
                          {ann.severity}
                        </span>
                        
                        <span className="text-[10px] bg-white/80 border border-slate-200/80 font-bold text-slate-700 px-2 py-0.5 rounded-full">
                          Target: {isAll ? '📢 All Organizations' : `🏢 ${targetOrg?.name || ann.targetTenantId}`}
                        </span>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {ann.createdAt}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 pt-0.5">{ann.title}</h4>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">{ann.message}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteAnnouncement(ann.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white/80 rounded-xl transition cursor-pointer shrink-0"
                      title="Remove Announcement Broadcast"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </>
  )}

  {/* Tab 2: Dedicated Direct UPI Renewal Requests Queue */}
  {masterTab === 'renewals' && (
    <DirectRenewalQueue
      tenants={tenants}
      renewalRequests={renewalRequests}
      onApproveRenewal={handleApproveRenewal}
      onRejectRenewal={handleRejectRenewal}
      onRefresh={() => {
        try {
          const saved = localStorage.getItem('inoms_subscription_renewal_requests_v1');
          if (saved) setRenewalRequests(JSON.parse(saved));
        } catch {}
      }}
    />
  )}

  {/* Tab 3: Plan Price Set (Subscription Plans, Master Admin UPI & Add-on Rates) */}
  {masterTab === 'pricing' && (
    <MasterAdminPricing
      pricingConfig={pricingConfig}
      onSavePricing={handleSavePricing}
    />
  )}

  {/* Tab 3: SaaS Bill Generation & Invoices */}
  {masterTab === 'billing' && (
    <MasterAdminBilling
      tenants={tenants}
      pricingConfig={pricingConfig}
      invoices={saasInvoices}
      onAddInvoice={handleAddSaasInvoice}
      onUpdateInvoice={handleUpdateSaasInvoice}
      onDeleteInvoice={handleDeleteSaasInvoice}
      preSelectedTenantId={preSelectedBillingTenantId}
      onClearPreSelectedTenant={() => setPreSelectedBillingTenantId(null)}
      renewalRequests={renewalRequests}
      onApproveRenewal={handleApproveRenewal}
      onRejectRenewal={handleRejectRenewal}
    />
  )}


      {/* Register Organization Modal (Master Admin Only) */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRegisterModal(false);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 cursor-default space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold">Step {regStep}/2</span>
                <h3 className="font-bold text-slate-900 text-sm">
                  {regStep === 1 ? 'Register New SaaS Organization Workspace' : 'Setup Microsoft Authenticator 2FA'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regStep === 1 ? (
              <form onSubmit={handleProceedTo2FASetup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Company / Organization Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Electronics Ltd"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Registered Owner Mobile Number</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 9876543210"
                      value={regMobile}
                      onChange={e => setRegMobile(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Owner / Administrator Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={regOwner}
                      onChange={e => setRegOwner(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Organization Login PIN (Optional)</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Leave blank for Authenticator 2FA Only"
                      value={regPin}
                      onChange={e => setRegPin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-[9.5px] text-slate-500 mt-1">Leave blank to enforce Microsoft Authenticator 6-digit code only</p>
                  </div>
                </div>

                {/* Subscription & 7-Day Free Trial Choice */}
                <div className="bg-teal-50/60 border border-teal-200/80 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-teal-900 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" /> Subscription Plan / Free Trial Setup
                    </span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                      7-Day Trial Default
                    </span>
                  </div>
                  
                  {/* Quick Select Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setRegSubscriptionType('trial')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                        regSubscriptionType === 'trial' || regSubscriptionType === 'trial_7d' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-extrabold text-[11px]">🎁 7-Day Trial</span>
                      <span className="text-[9px] opacity-80">Free Evaluation (₹0)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegSubscriptionType('basic_30d')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                        regSubscriptionType === 'basic_30d' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-extrabold text-[11px]">🟢 Basic 30d</span>
                      <span className="text-[9px] opacity-80">₹{resolvePlanInfo('basic_30d', pricingConfig).amount}/mo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegSubscriptionType('business_30d')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                        regSubscriptionType === 'business_30d' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-extrabold text-[11px]">🔵 Business 30d</span>
                      <span className="text-[9px] opacity-80">₹{resolvePlanInfo('business_30d', pricingConfig).amount}/mo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegSubscriptionType('pro_30d')}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                        regSubscriptionType === 'pro_30d' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-extrabold text-[11px]">🟣 Pro 30d</span>
                      <span className="text-[9px] opacity-80">₹{resolvePlanInfo('pro_30d', pricingConfig).amount}/mo</span>
                    </button>
                  </div>

                  {/* Or Select Any Specific Duration Variation Dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold text-teal-900 uppercase mb-1">
                      Or Select Specific Duration Variation:
                    </label>
                    <select
                      value={regSubscriptionType}
                      onChange={(e) => setRegSubscriptionType(e.target.value)}
                      className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    >
                      <optgroup label="🎁 Free Trial & Enterprise">
                        <option value="trial">🎁 7-Day Free Trial (7 Days · ₹0)</option>
                        <option value="lifetime">♾️ Lifetime License (Permanent · 10+ Years)</option>
                      </optgroup>
                      <optgroup label="🟢 INOMS Basic Variations">
                        {basicPlanVariations.map(p => (
                          <option key={p.key} value={p.key}>
                            🟢 {p.title} — ₹{p.amount.toLocaleString('en-IN')}{p.badge ? ` (${p.badge})` : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🔵 INOMS Business Variations">
                        {businessPlanVariations.map(p => (
                          <option key={p.key} value={p.key}>
                            🔵 {p.title} — ₹{p.amount.toLocaleString('en-IN')}{p.badge ? ` (${p.badge})` : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🟣 INOMS Pro Variations">
                        {proPlanVariations.map(p => (
                          <option key={p.key} value={p.key}>
                            🟣 {p.title} — ₹{p.amount.toLocaleString('en-IN')}{p.badge ? ` (${p.badge})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <p className="text-[10px] text-teal-800/80 font-medium">
                    {regSubscriptionType === 'trial' || regSubscriptionType === 'trial_7d'
                      ? 'Organization will get full trial access for 7 days. Master Admin will be alerted before expiry.'
                      : `Selected: ${resolvePlanInfo(regSubscriptionType, pricingConfig).title} — ${resolvePlanInfo(regSubscriptionType, pricingConfig).durationLabel} access.`}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 text-xs text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <QrCode className="w-4 h-4" /> Next: Setup Microsoft Authenticator 2FA →
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <MicrosoftAuthQR
                  orgName={regName}
                  ownerMobile={regMobile}
                  secretKey={regSecretKey}
                  title="Scan QR Code with Microsoft Authenticator"
                  subtitle="Scan this QR code using Microsoft Authenticator app on mobile phone before handing access credentials to the client."
                />

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="px-3 py-1.5 text-xs text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    ← Back to Details
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeRegistration}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Finalize Registration & View Share Credentials
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Access Credentials Modal */}
      {selectedShareOrg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedShareOrg(null);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-6 overflow-hidden animate-in zoom-in-95 duration-200 cursor-default space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Organization Access Passcard</h3>
                  <p className="text-[11px] text-slate-500">Share these access details with organization administrator.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShareOrg(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-teal-400 uppercase text-[10px] tracking-wider">SaaS Workspace Credentials</span>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 rounded-full">
                  {selectedShareOrg.code}
                </span>
              </div>

              <div className="space-y-1.5 text-slate-200">
                <p>🏢 Organization: <strong className="text-white font-sans">{selectedShareOrg.name}</strong></p>
                <p>📱 Owner Mobile: <strong className="text-teal-300">{selectedShareOrg.ownerMobile}</strong></p>
                <p>👤 Owner Name: <strong className="text-slate-100 font-sans">{selectedShareOrg.ownerName || 'Admin'}</strong></p>
                <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="space-y-0.5">
                    <p>🔑 Security PIN: <strong className="text-teal-300">{
                      showSensitiveKeys 
                        ? ((adminOrgDetails[selectedShareOrg.id]?.pin !== undefined ? adminOrgDetails[selectedShareOrg.id]?.pin : selectedShareOrg.pin) || 'None (Authenticator 2FA Only)') 
                        : '••••••••'
                    }</strong></p>
                    <p>🔐 2FA Secret Key: <strong className="text-amber-300">{
                      showSensitiveKeys 
                        ? ((adminOrgDetails[selectedShareOrg.id]?.secretKey !== undefined ? adminOrgDetails[selectedShareOrg.id]?.secretKey : selectedShareOrg.secretKey) || 'Standard TOTP') 
                        : '••••••••••••••••'
                    }</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSensitiveKeys(!showSensitiveKeys)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition border border-slate-700"
                  >
                    {showSensitiveKeys ? '🔒 Hide Keys' : '👁️ Reveal Keys'}
                  </button>
                </div>
              </div>
            </div>

            {/* Microsoft QR preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <MicrosoftAuthQR
                orgName={selectedShareOrg.name}
                ownerMobile={selectedShareOrg.ownerMobile}
                secretKey={selectedShareOrg.secretKey}
                title="Microsoft Authenticator QR Code"
                subtitle="The owner can scan this code in Microsoft Authenticator app."
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleCopyAccessDetails(selectedShareOrg)}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                  copiedCreds
                    ? 'bg-emerald-600 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                }`}
              >
                {copiedCreds ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCreds ? 'Copied Access Passcard!' : 'Copy Access Credentials'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedShareOrg;
                  setSelectedShareOrg(null);
                  setSelectedWhatsAppOrg(target);
                }}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                title="Send Subscription Expiry / Renewal Notice via WhatsApp"
              >
                <WhatsAppSvgIcon className="w-3.5 h-3.5 fill-current" />
                <span>WhatsApp Notice</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShareOrg(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {editingOrg && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={() => setEditingOrg(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Building className="w-4 h-4 text-teal-400" /> Edit Organization Details
                </h3>
                <p className="text-[11px] text-slate-400">Update organization info, owner mobile, PIN & 2FA keys</p>
              </div>
              <button onClick={() => setEditingOrg(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOrg} className="p-5 text-xs space-y-3">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Org Code *</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Access PIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Leave blank for Authenticator 2FA Only"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                  <p className="text-[9.5px] text-slate-400 mt-1">Leave blank to enforce Microsoft Authenticator 6-digit code only</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Owner Mobile *</label>
                  <input
                    type="text"
                    required
                    value={editOwnerMobile}
                    onChange={(e) => setEditOwnerMobile(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">2FA Secret Key (Authenticator)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editSecretKey}
                    onChange={(e) => setEditSecretKey(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setEditSecretKey(generateBase32Secret())}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Regenerate 2FA
                  </button>
                </div>
              </div>

              {/* Subscription Plan & Duration Variations Management */}
              <div className="pt-2 border-t border-slate-200 space-y-3.5">
                <div className="bg-teal-50/80 p-3 rounded-xl border border-teal-200/80 flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-xs text-teal-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <Clock className="w-4 h-4 text-teal-700" /> Subscription Plan & Pricing Matrix Variations
                    </h4>
                    <p className="text-[11px] text-teal-700 leading-relaxed">
                      Select from all 14 configured duration variations across Basic, Business, and Pro tiers, or assign Free Trial / Lifetime license.
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                    {allPlanVariations.length} Variations Active
                  </span>
                </div>

                {/* Tier Quick Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filter Tier:</span>
                  {[
                    { id: 'all', label: 'All Plans' },
                    { id: 'basic', label: '🟢 Basic (6)' },
                    { id: 'business', label: '🔵 Business (4)' },
                    { id: 'pro', label: '🟣 Pro (4)' },
                    { id: 'special', label: '🎁 Trial & Lifetime' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEditTierTab(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                        editTierTab === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Main Plan Selection Dropdown & Expiry Date Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                      Selected Plan Variation
                    </label>
                    <select
                      value={editSubPlan}
                      onChange={(e) => handleSelectPlanVariation(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 shadow-2xs"
                    >
                      {(editTierTab === 'all' || editTierTab === 'special') && (
                        <optgroup label="🎁 Free Trial & Special Licenses">
                          <option value="trial">🎁 7-Day Free Trial (7 Days · ₹0)</option>
                          <option value="lifetime">♾️ Lifetime License (Permanent · 10+ Years · All Features)</option>
                        </optgroup>
                      )}

                      {(editTierTab === 'all' || editTierTab === 'basic') && (
                        <optgroup label="🟢 INOMS Basic Tier (6 Duration Variations)">
                          {basicPlanVariations.map((p) => (
                            <option key={p.key} value={p.key}>
                              🟢 {p.title} — ₹{p.amount.toLocaleString('en-IN')}{p.badge ? ` (${p.badge})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {(editTierTab === 'all' || editTierTab === 'business') && (
                        <optgroup label="🔵 INOMS Business Tier (4 Duration Variations)">
                          {businessPlanVariations.map((p) => (
                            <option key={p.key} value={p.key}>
                              🔵 {p.title} — ₹{p.amount.toLocaleString('en-IN')}{p.badge ? ` (${p.badge})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {(editTierTab === 'all' || editTierTab === 'pro') && (
                        <optgroup label="🟣 INOMS Pro Tier (4 Duration Variations)">
                          {proPlanVariations.map((p) => (
                            <option key={p.key} value={p.key}>
                              🟣 {p.title} — ₹{p.amount.toLocaleString('en-IN')}{p.badge ? ` (${p.badge})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {editTierTab === 'all' && (
                        <optgroup label="⚙️ Legacy Plan Compatibility">
                          <option value="monthly">📅 Standard Monthly (30 Days)</option>
                          <option value="quarterly">📊 Quarterly (90 Days)</option>
                          <option value="annual">⭐ Annual (365 Days)</option>
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">
                      Subscription Expiry Date
                    </label>
                    <input
                      type="date"
                      value={editSubEndDate}
                      onChange={(e) => setEditSubEndDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Duration Matrix Quick-Select Chips (Shows variations for current tier) */}
                {(currentEditPlanInfo.tier === 'basic' || currentEditPlanInfo.tier === 'business' || currentEditPlanInfo.tier === 'pro') && (
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500">
                        {currentEditPlanInfo.tierLabel} Duration Variations ({
                          currentEditPlanInfo.tier === 'basic' ? basicPlanVariations.length :
                          currentEditPlanInfo.tier === 'business' ? businessPlanVariations.length :
                          proPlanVariations.length
                        } options):
                      </span>
                      <span className="text-[10px] text-teal-700 font-semibold">
                        Click any variation to apply duration & tier features
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                      {(currentEditPlanInfo.tier === 'basic' ? basicPlanVariations :
                        currentEditPlanInfo.tier === 'business' ? businessPlanVariations :
                        proPlanVariations
                      ).map((variation) => {
                        const isSelected = editSubPlan === variation.key;
                        return (
                          <button
                            key={variation.key}
                            type="button"
                            onClick={() => handleSelectPlanVariation(variation.key)}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-400/50'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:bg-teal-50/30'
                            }`}
                          >
                            <span className="font-extrabold text-[11px] leading-tight">
                              {variation.durationDays === 365 ? '1 Year' : `${variation.durationDays} Days`}
                            </span>
                            <span className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-teal-700 font-mono'}`}>
                              ₹{variation.amount.toLocaleString('en-IN')}
                            </span>
                            {variation.badge && (
                              <span className={`text-[8.5px] px-1 py-0.2 rounded font-extrabold truncate max-w-full ${
                                isSelected ? 'bg-teal-800 text-teal-100' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {variation.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Plan Snapshot Banner */}
                <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  currentEditPlanInfo.tier === 'trial'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : currentEditPlanInfo.tier === 'lifetime'
                    ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                    : currentEditPlanInfo.tier === 'pro'
                    ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                    : currentEditPlanInfo.tier === 'business'
                    ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${currentEditPlanInfo.tierBadgeClass}`}>
                        {currentEditPlanInfo.tierLabel}
                      </span>
                      <span className="font-extrabold text-xs text-slate-800">
                        {currentEditPlanInfo.title}
                      </span>
                      {currentEditPlanInfo.badge && (
                        <span className="text-[9.5px] bg-amber-200/90 text-amber-900 font-extrabold px-1.5 py-0.5 rounded">
                          {currentEditPlanInfo.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {currentEditPlanInfo.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Plan Price</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        {currentEditPlanInfo.amount === 0 ? 'Free' : `₹${currentEditPlanInfo.amount.toLocaleString('en-IN')}`}
                      </span>
                    </div>

                    <div className="border-l border-slate-200 pl-3 text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Duration</span>
                      <span className="text-xs font-extrabold text-slate-700">
                        {currentEditPlanInfo.durationLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Expiry Date Adjuster Buttons */}
                <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> Quick Extend / Offset Expiry Date:
                    </span>
                    {editSubEndDate && (
                      <span className="text-[10px] font-mono font-bold text-teal-700">
                        Expires: {editSubEndDate}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickExtendExpiry(7)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      +7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtendExpiry(15)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      +15 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtendExpiry(30)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      +30 Days (1 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtendExpiry(90)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      +90 Days (Quarter)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtendExpiry(180)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      +180 Days (Half-Year)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtendExpiry(365)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      +1 Year (365d)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 10);
                        setEditSubEndDate(d.toISOString().split('T')[0]);
                        setEditSubPlan('lifetime');
                      }}
                      className="px-2 py-1 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 text-[10px] font-bold text-purple-800 transition cursor-pointer ml-auto"
                    >
                      ♾️ Permanent (10 Years)
                    </button>
                  </div>
                </div>
              </div>

              {/* Master Admin Feature Access & Add-ons Control Section */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-teal-600" /> Organization Plan Feature Add-ons
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Master Admin controls for activating or disabling paid add-on features and services for this client organization.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Live Queue & Workbench Add-on Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">⚡ Live Repair Queue & Visual Workbench</span>
                      <span className="text-[10px] text-slate-500 block">Kanban board live repair status sync and technician ticket workflows</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowLiveQueue}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditAllowLiveQueue(checked);
                        setEditAllowedModules((modules) => checked
                          ? modules.includes('live_queue') ? modules : [...modules, 'live_queue']
                          : modules.filter((module) => module !== 'live_queue'));
                      }}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Workshop Wi-Fi Hub & Technician Sync Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">📶 Workshop Wi-Fi Hub & Technician Sync</span>
                      <span className="text-[10px] text-slate-500 block">Enable direct local Wi-Fi linking with technician devices & automated local/drive backups</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowHomeServerSync}
                      onChange={(e) => setEditAllowHomeServerSync(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Barcode & QR Tags Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">🏷️ Barcode & QR Tag Sheet Printing</span>
                      <span className="text-[10px] text-slate-500 block">Enable printing job card sticker tag sheets with barcodes & QR codes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowBarcodeQrTags}
                      onChange={(e) => setEditAllowBarcodeQrTags(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Technician Accounts Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">👥 Technician / Staff Sub-accounts</span>
                      <span className="text-[10px] text-slate-500 block">Allow organization to add and manage technician logins</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowTechnicianAccounts}
                      onChange={(e) => setEditAllowTechnicianAccounts(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Outward Tax Invoice Button Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">🧾 Outward Tax Invoice Generation ($ Button)</span>
                      <span className="text-[10px] text-slate-500 block">Show green Tax Invoice button on Outward job cards</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowOutwardTaxInvoiceButton}
                      onChange={(e) => setEditAllowOutwardTaxInvoiceButton(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Google Drive Cloud Hub & Multi-Device Sync Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">☁️ Google Drive Cloud Hub &amp; Multi-Device Sync</span>
                      <span className="text-[10px] text-slate-500 block">Included by default in 7-Day Free Trial &amp; INOMS Pro Plan (₹699/mo)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowGoogleDriveSync}
                      onChange={(e) => setEditAllowGoogleDriveSync(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Enabled Navigation Modules Section */}
                <div className="pt-2">
                  <label className="block font-extrabold text-slate-700 uppercase text-[11px] mb-1">
                    Enabled Navigation Modules for Organization
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">Uncheck modules that are not included in this organization's subscription plan.</p>
                  
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    {[
                      { id: 'dashboard', label: '📊 Dashboard' },
                      { id: 'live_queue', label: '⚡ Live Queue & Bench' },
                      { id: 'inwards', label: '📥 Inward Jobs' },
                      { id: 'outwards', label: '📤 Outward Jobs' },
                      { id: 'billing', label: '📄 Billing & Invoices' },
                      { id: 'payments', label: '💳 Payments & Cashbook' },
                      { id: 'clients', label: '👥 Clients & Ledger' },
                      { id: 'inventory', label: '📦 Inventory & Stock' },
                      { id: 'purchases', label: '🛒 Purchases & POs' },
                      { id: 'suppliers', label: '🏬 Suppliers Hub' },
                      { id: 'service_partners', label: '🔧 Service Partners' },
                      { id: 'expenses', label: '💸 Expenses' },
                      { id: 'reports', label: '📈 Reports & Analytics' },
                      { id: 'settings', label: '⚙️ System Settings' },
                    ].map((mod) => {
                      const isChecked = editAllowedModules.includes(mod.id);
                      return (
                        <label key={mod.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked) {
                                setEditAllowedModules((modules) => modules.includes(mod.id) ? modules : [...modules, mod.id]);
                              } else {
                                setEditAllowedModules((modules) => modules.filter((module) => module !== mod.id));
                              }
                              if (mod.id === 'live_queue') {
                                setEditAllowLiveQueue(checked);
                              }
                            }}
                            className="w-3.5 h-3.5 text-teal-600 rounded cursor-pointer"
                          />
                          <span>{mod.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => {
                    const nextVal = e.target.value as 'active' | 'deactivated';
                    setEditStatus(nextVal);
                    if (nextVal === 'active') {
                      const isPastOrEmpty = !editSubEndDate || new Date(editSubEndDate).getTime() < Date.now();
                      if (isPastOrEmpty) {
                        const d = new Date();
                        const days = editSubPlan === 'annual' ? 365 : editSubPlan === 'quarterly' ? 90 : editSubPlan === 'trial' ? 7 : 30;
                        d.setDate(d.getDate() + days);
                        setEditSubEndDate(d.toISOString().split('T')[0]);
                      }
                    }
                  }}
                  disabled={editingOrg.id === 'org-admin'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  <option value="active">Active Access</option>
                  <option value="deactivated">Account Deactivated</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditOrg}
                  className={`px-4 py-2 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-2 ${
                    isSavingEditOrg
                      ? 'bg-teal-700/70 cursor-wait'
                      : 'bg-teal-600 hover:bg-teal-700 cursor-pointer'
                  }`}
                >
                  {isSavingEditOrg ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Server...</span>
                    </>
                  ) : (
                    <span>Update Organization</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purge / Factory Reset Database Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-rose-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Factory Reset &amp; Purge Organizations</h3>
                  <p className="text-[10px] text-slate-400">Master System Admin Control</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-950 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Master System Admin (+91 8149862034) Is 100% Protected</span>
              </p>
              <p>
                This operation will permanently delete all demo and tenant organizations, their clients, job sheets, invoices, ledger entries, and disk data folders from the SQLite database and disk storage.
              </p>
              <p className="font-semibold text-rose-800">
                Once executed, only your Master System Admin account remains active.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeWipeMasterData}
                  onChange={e => setPurgeWipeMasterData(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 mt-0.5"
                />
                <div>
                  <p className="font-bold text-slate-800">Also Clear Master Admin Sample Operational Tables</p>
                  <p className="text-[11px] text-slate-500">Wipes sample invoices and demo clients so your system starts with 0 records.</p>
                </div>
              </label>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Type <span className="font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">PURGE</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="Type PURGE in all caps"
                  value={purgeConfirmationText}
                  onChange={e => setPurgeConfirmationText(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {purgeResultMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium text-xs">
                  {purgeResultMsg}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeConfirmationText.trim() !== 'PURGE' || isPurgingData}
                onClick={async () => {
                  setIsPurgingData(true);
                  try {
                    const res = await purgeAllDataApi(purgeWipeMasterData);
                    if (res.success) {
                      setPurgeResultMsg(res.message || 'Database successfully purged. Reloading...');
                      setTimeout(() => {
                        window.location.reload();
                      }, 1500);
                    } else {
                      alert(`Purge Error: ${res.error || 'Failed to purge data'}`);
                    }
                  } catch (err: any) {
                    alert(`Error: ${err?.message || 'Purge request failed'}`);
                  } finally {
                    setIsPurgingData(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPurgingData ? 'Purging All Data...' : 'Execute Complete Purge'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Subscription Expiry & Renewal Notice Modal */}
      {selectedWhatsAppOrg && (
        <WhatsAppRenewalNoticeModal
          tenant={selectedWhatsAppOrg}
          isOpen={Boolean(selectedWhatsAppOrg)}
          onClose={() => setSelectedWhatsAppOrg(null)}
          companyConfig={companyConfig}
          pricingConfig={pricingConfig}
        />
      )}

    </div>
  );
}
