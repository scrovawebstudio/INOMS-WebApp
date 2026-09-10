/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClientType = 'Walk-in' | 'Dealer';

export interface Client {
  id: string;
  tenantId?: string;
  name: string;
  type: ClientType;
  mobile: string;
  phone?: string;
  contactPerson?: string;
  email: string;
  address: string;
  state: string;
  openingBalance?: number;
  outstandingBalance: number;
}

export interface ClientLedgerEntry {
  id: string;
  tenantId?: string;
  clientId: string;
  date: string;
  type: string;
  refNo: string;
  debit: number;
  credit: number;
  balance: number;
}

export type JobStatus =
  | 'Device Received'
  | 'Received'
  | 'Work in Progress'
  | 'In Progress'
  | 'Approval Pending'
  | 'Device Ready'
  | 'Ready'
  | 'Device Not repairable'
  | 'Not Repaired'
  | 'Product Out'
  | 'Pending'
  | 'Completed'
  | 'Complete & Ready'
  | 'Delivered'
  | 'Outwarded';

export interface Problem {
  id: string;
  tenantId?: string;
  name: string;
}

export interface Equipment {
  id: string;
  tenantId?: string;
  name: string;
}

export interface Category {
  id: string;
  tenantId?: string;
  name: string;
}

export interface LocationRack {
  id: string;
  tenantId?: string;
  name: string;
}

export interface RepairJob {
  id: string; // Job ID (e.g. ALG/2026/101)
  tenantId?: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  date: string;
  createdAt?: string;
  createdDate?: string;
  updatedAt?: string;
  inDate?: string;
  inwardDate?: string;
  outDate?: string;
  equipment: string;
  productName: string;
  productModel: string;
  serialNo: string;
  ramHDD?: string;
  ramHdd?: string;
  componentSpecs?: { [key: string]: string };
  problems: string[]; // List of selected problem names
  problemDescription: string;
  componentsChecklist: { [key: string]: boolean };
  additionalDetails: string;
  images: string[];
  estimateAmount: number;
  remarks: string;
  assignedTechnician: string;
  status: JobStatus;
  outwardedDate?: string;
  finalBillAmount?: number;
  actionTaken?: string;
  deliveryStatus?: string;
  deliveryType?: string;
  courierName?: string;
  trackingNo?: string;
  deliveredToName?: string;
  deliveredBy?: string;
  isReturnCase?: boolean;
  advanceAmount?: number;
  advancePaymentMode?: string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Not Repaired';
  repairOutcome?: 'Repaired' | 'Not Repaired';
  advanceRefunded?: boolean;
  advanceRefundMode?: string;
  rackLocation?: string;
  // External Repair / Service Partner Integration
  repairType?: 'Internal' | 'External Service Partner' | 'EXTERNAL_PARTNER';
  servicePartnerId?: string;
  servicePartnerName?: string;
  externalVendorName?: string;
  servicePartnerCost?: number;
  servicePartnerPaid?: number;
  brand?: string;
  model?: string;
  serialNumber?: string;
  problem?: string;
  diagnosis?: string;
  sentToPartnerDate?: string;
  partnerChallanNumber?: string;
  partnerSentDate?: string;
  partnerExpectedReturnDate?: string;
  partnerActualReturnDate?: string;
  partnerRefNo?: string;
  partnerWorkDescription?: string;
  partnerEstimatedCost?: number;
  partnerFinalCost?: number;
  partnerStatus?:
    | 'Not Sent'
    | 'Sent to Service Partner'
    | 'Sent to Partner'
    | 'With Service Partner'
    | 'In Repair'
    | 'Repair Completed'
    | 'Returned From Service Partner'
    | 'Received from Partner'
    | 'Under Internal Testing'
    | 'Ready for Client'
    | 'Delivered'
    | 'Settled'
    | 'Cancelled';
  partnerPaymentStatus?: 'Paid' | 'Partially Paid' | 'Unpaid';
  partnerRemarks?: string;
  internalRemarks?: string;
  partsUsed?: any[];
}

export interface Payment {
  id: string;
  tenantId?: string;
  date: string;
  clientId: string;
  clientName: string;
  amount: number;
  mode: string; // UPI, Cash, Bank Transfer
  refNo?: string;
  remarks?: string;
  invoiceId?: string;
  linkedJobId?: string;
  linkedJobIds?: string[];
  allocations?: { jobId: string; amount: number }[];
}

export interface InvoiceItem {
  id: string;
  productName: string;
  serialNo: string;
  qty: number;
  rate: number;
  total: number;
}

export interface Invoice {
  id: string; // Invoice No (e.g. ALG/2026/BILL/457)
  tenantId?: string;
  date: string;
  time?: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientAddress?: string;
  clientState?: string;
  clientGstin?: string;
  linkedJobId?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  deliveryCharges: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: string;
  isPaid?: boolean;
  deductedAdvance?: number;
}

export interface Product {
  id: string;
  tenantId?: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  unit?: string;
  location?: string;
  hsnCode?: string;
  price: number; // Selling price
  purchasePrice?: number; // Cost / Purchase price for organisation
  costPrice?: number; // Alias for purchase/cost price
  sellingPrice?: number; // Alias for selling price
  gstRate?: number;
  vendorName?: string; // Legacy supplier name
  vendorContact?: string; // Legacy supplier contact
  supplierId?: string; // Primary/Default Supplier ID
  supplierName?: string; // Primary/Default Supplier Name
  stock: number;
  stockQty?: number;
  minQtyAlert?: number;
  minStockAlert?: number;
  serialTrackingEnabled?: boolean;
  description?: string;
  status?: 'Active' | 'Inactive';
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  tenantId?: string;
  date: string;
  category: string; // Staff Payment, Rent, Utilities, Courier, Misc
  amount: number;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface UserPermissions {
  // Navigation & High-Level Access
  dashboard?: boolean;
  operations?: boolean;
  clientLedger?: boolean;
  billingInvoice?: boolean;
  billing?: boolean;
  payments?: boolean;
  inventoryEdit?: boolean;
  inventory?: boolean;
  accounts?: boolean;
  reports?: boolean;
  setup?: boolean;

  // Granular Operational Access Controls
  inwardView?: boolean;
  inwardCreate?: boolean;
  inwardEdit?: boolean;

  outwardView?: boolean;
  outwardEdit?: boolean;

  billingView?: boolean;
  billingCreate?: boolean;
  billingEdit?: boolean;

  paymentsView?: boolean;
  paymentsCreate?: boolean;

  clientView?: boolean;
  clientCreateEdit?: boolean;

  inventoryView?: boolean;
  inventoryEditStock?: boolean;

  expensesView?: boolean;
  expensesCreateEdit?: boolean;

  reportsView?: boolean;

  [key: string]: boolean | undefined;
}

export interface SystemUser {
  id: string;
  tenantId?: string;
  name: string;
  mobile: string;
  email: string;
  username: string;
  password?: string;
  pin?: string;
  role: 'Admin' | 'Front Desk' | 'Technician' | 'HR';
  permissions: UserPermissions;
  isDeactivated?: boolean;
  status?: 'Active' | 'Deactivated';
}

export interface ActivityLog {
  id: string;
  tenantId?: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface TenantThemePalette {
  buttonBg: string;       // Primary / Action Buttons Color
  buttonText: string;     // Button Text Color
  sidebarBg: string;      // Left Navigation Sidebar Background
  sidebarText: string;    // Sidebar Text Color
  appBg: string;          // Main Workspace Background Color
  fontAccent: string;     // Accent / Highlight Font Color
  topHeaderBg: string;    // Top Bar Header Background
}

export const DEFAULT_THEME_PALETTE: TenantThemePalette = {
  buttonBg: '#0d9488',
  buttonText: '#ffffff',
  sidebarBg: '#0f172a',
  sidebarText: '#94a3b8',
  appBg: '#f8fafc',
  fontAccent: '#0f766e',
  topHeaderBg: '#ffffff'
};

export interface CompanyConfig {
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  gstin: string;
  logoUrl?: string;
  signatureUrl?: string;
  upiId?: string;
  upiQrUrl?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  syncMode: 'offline' | 'wifi' | 'lan';
  cloudSyncEnabled?: boolean;
  lanHostIp: string;
  driveConnected: boolean;
  driveAccountEmail?: string;
  driveAccessToken?: string;
  driveFolderPath?: string;
  lastDriveBackupTime?: string;
  autoBackupTimes: string[];
  localBackupEnabled?: boolean;
  localBackupPath?: string;
  localBackupScheduleTime?: string;
  localBackupFrequency?: 'on_change' | 'on_sync' | 'minutes' | 'hours' | 'custom' | 'manual' | 'daily' | 'mins_30' | 'hourly_1' | 'hourly_2' | 'hourly_3' | 'hourly_4' | 'hourly_5' | 'hourly_6' | 'hourly_12';
  localBackupInterval?: number;
  localBackupScheduleTimes?: string[];
  lastLocalBackupTime?: string;
  themePalette?: TenantThemePalette;
  appName?: string;
  appTagline?: string;
  appLogoUrl?: string;
  googleReviewUrl?: string;
  whatsappChannelUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  customReviewUrl?: string;
}

export const getEffectiveBillAmount = (job: Partial<RepairJob>): number => {
  if (job.repairOutcome === 'Not Repaired') {
    return 0;
  }
  if (job.finalBillAmount !== undefined && job.finalBillAmount !== null) {
    return job.finalBillAmount;
  }
  return job.estimateAmount || 0;
};

export function sortJobsByLatest(jobsList: RepairJob[]): RepairJob[] {
  return [...jobsList].sort((a, b) => {
    const getEffectiveTime = (j: RepairJob): number => {
      if (j.updatedAt) {
        const t = new Date(j.updatedAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (j.createdAt) {
        const t = new Date(j.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (j.date) {
        const t = new Date(j.date).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };

    const timeA = getEffectiveTime(a);
    const timeB = getEffectiveTime(b);

    if (timeA > 0 || timeB > 0) {
      if (timeA !== timeB) {
        return timeB - timeA;
      }
    }

    // Compare job ID numerical part descending

    const numA = parseInt(a.id.split('/').pop() || '0', 10);
    const numB = parseInt(b.id.split('/').pop() || '0', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numB - numA;
    }
    return b.id.localeCompare(a.id);
  });
}

export interface CustomAddonPricingItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  billingCycle: 'monthly' | 'annual' | 'one-time';
}

export type InomsPlanTier = 'basic' | 'business' | 'pro';

export interface PlanDurationOption {
  days: number;
  label: string;
  price: number;
  savingsBadge?: string;
  perMonthHint?: string;
}

export interface InomsTierPlan {
  id: InomsPlanTier;
  name: string;
  tagline: string;
  badge: string;
  monthlyPrice: number;
  isMainProduct?: boolean;
  isPopular?: boolean;
  color: {
    primary: string;
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  };
  durationOptions: PlanDurationOption[];
  allowedModules: string[];
  features: {
    allowBarcodeQrTags: boolean;
    allowWhatsAppMessaging: boolean;
    allowOutwardTaxInvoiceButton: boolean;
    allowLiveQueue: boolean;
    allowTechnicianAccounts: boolean;
    allowHomeServerSync: boolean;
    allowGoogleDriveSync: boolean;
  };
  includedFeatures: string[];
}

export const INOMS_TIER_PLANS: Record<InomsPlanTier, InomsTierPlan> = {
  basic: {
    id: 'basic',
    name: 'INOMS Basic',
    tagline: 'Core repair & shop management — Your essential operating system',
    badge: '🟢 Main Product',
    monthlyPrice: 399,
    isMainProduct: true,
    color: {
      primary: '#059669',
      bg: 'bg-emerald-50/70',
      border: 'border-emerald-200',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      badgeText: 'text-emerald-700'
    },
    durationOptions: [
      { days: 7, label: '7 Days', price: 99, perMonthHint: '₹99' },
      { days: 15, label: '15 Days', price: 179, perMonthHint: '₹179' },
      { days: 30, label: '30 Days (1 Month)', price: 399, perMonthHint: '₹399/mo' },
      { days: 90, label: '90 Days (3 Months)', price: 999, savingsBadge: 'Save ₹198', perMonthHint: '₹333/mo' },
      { days: 180, label: '180 Days (6 Months)', price: 1799, savingsBadge: 'Save ₹595', perMonthHint: '₹299/mo' },
      { days: 365, label: '1 Year (365 Days)', price: 2999, savingsBadge: 'Save ₹1,789 (37% Off)', perMonthHint: '₹249/mo' }
    ],
    allowedModules: [
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
    ],
    features: {
      allowBarcodeQrTags: true,
      allowWhatsAppMessaging: true,
      allowOutwardTaxInvoiceButton: true,
      allowLiveQueue: false,
      allowTechnicianAccounts: false,
      allowHomeServerSync: false,
      allowGoogleDriveSync: false
    },
    includedFeatures: [
      'Repair / Inward-Outward Management',
      'Customer Management & Client Ledger',
      'Job Sheets & Printable Delivery Passes',
      'IMEI / Serial Number Tracking',
      'Payments & Balance Settlement Receipts',
      'Inventory & Spare Parts Stock',
      'Billing & GST Invoices Generator',
      'Warranty Records & Operational Expenses',
      'Analytics Dashboard & Performance Reports',
      'WhatsApp Customer Updates ✅',
      'Thermal Barcode & QR Code Tag Sheets ✅'
    ]
  },
  business: {
    id: 'business',
    name: 'INOMS Business',
    tagline: 'Complete repair ERP with purchases, supplier ledger & live queue',
    badge: '🔵 Most Popular ⭐',
    monthlyPrice: 599,
    isPopular: true,
    color: {
      primary: '#2563eb',
      bg: 'bg-blue-50/70',
      border: 'border-blue-200',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
      badgeText: 'text-blue-700'
    },
    durationOptions: [
      { days: 30, label: '30 Days (1 Month)', price: 599, perMonthHint: '₹599/mo' },
      { days: 90, label: '90 Days (3 Months)', price: 1499, savingsBadge: 'Save ₹298', perMonthHint: '₹499/mo' },
      { days: 180, label: '180 Days (6 Months)', price: 2699, savingsBadge: 'Save ₹895', perMonthHint: '₹449/mo' },
      { days: 365, label: '1 Year (365 Days)', price: 4499, savingsBadge: 'Save ₹2,689 (37% Off)', perMonthHint: '₹374/mo' }
    ],
    allowedModules: [
      'dashboard',
      'live_queue',
      'inwards',
      'outwards',
      'billing',
      'payments',
      'clients',
      'inventory',
      'purchases',
      'suppliers',
      'expenses',
      'reports',
      'settings'
    ],
    features: {
      allowBarcodeQrTags: true,
      allowWhatsAppMessaging: true,
      allowOutwardTaxInvoiceButton: true,
      allowLiveQueue: true,
      allowTechnicianAccounts: false,
      allowHomeServerSync: false,
      allowGoogleDriveSync: false
    },
    includedFeatures: [
      '✨ Everything in INOMS Basic Plan +',
      'Live Repair Queue & Technician Kanban Workbench',
      'Purchase Management & Goods Inwarding Hub',
      'Purchase Orders (POs) & Vendor Invoices',
      'Supplier Management Directory',
      'Supplier Ledger & Bill-by-Bill Settlements'
    ]
  },
  pro: {
    id: 'pro',
    name: 'INOMS Pro',
    tagline: 'Full-scale workshop suite with Google Drive cloud sync, outsourcing & challans',
    badge: '🟣 Ultimate Pro 🔥',
    monthlyPrice: 699,
    color: {
      primary: '#7c3aed',
      bg: 'bg-purple-50/70',
      border: 'border-purple-200',
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
      badgeText: 'text-purple-700'
    },
    durationOptions: [
      { days: 30, label: '30 Days (1 Month)', price: 699, perMonthHint: '₹699/mo' },
      { days: 90, label: '90 Days (3 Months)', price: 1799, savingsBadge: 'Save ₹298', perMonthHint: '₹599/mo' },
      { days: 180, label: '180 Days (6 Months)', price: 3199, savingsBadge: 'Save ₹995', perMonthHint: '₹533/mo' },
      { days: 365, label: '1 Year (365 Days)', price: 5499, savingsBadge: 'Save ₹2,889 (34% Off)', perMonthHint: '₹458/mo' }
    ],
    allowedModules: [
      'dashboard',
      'live_queue',
      'inwards',
      'outwards',
      'billing',
      'payments',
      'clients',
      'inventory',
      'purchases',
      'suppliers',
      'service_partners',
      'expenses',
      'reports',
      'settings'
    ],
    features: {
      allowBarcodeQrTags: true,
      allowWhatsAppMessaging: true,
      allowOutwardTaxInvoiceButton: true,
      allowLiveQueue: true,
      allowTechnicianAccounts: false,
      allowHomeServerSync: false,
      allowGoogleDriveSync: true
    },
    includedFeatures: [
      '🔥 Everything in INOMS Business Plan +',
      'Google Drive Cloud Hub & Multi-Device Sync ☁️',
      'Direct Invoice PDF Auto-Save & Cloud Archiving 📄',
      'External Service Partner Management & Directory',
      'Third-Party Lab Outsourcing Challans & Gate Passes',
      'Partner Ledgers & Cost vs Client Margin Comparison',
      'Priority VIP Support & All Upcoming Feature Releases'
    ]
  }
};

export interface SubscriptionPlanConfig {
  key: string;
  tier?: InomsPlanTier;
  title: string;
  durationDays: number;
  durationLabel: string;
  amount: number;
  badge?: string;
  description?: string;
  enabled: boolean;
}

export interface FeatureAddonItem {
  id: string;
  key: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  isCore?: boolean;
  enabled: boolean;
  iconName?: string;
}

export interface AddonPricingConfig {
  masterAdminUpi?: string;
  masterAdminName?: string;
  masterAdminMobile?: string;
  subscriptionPlans?: SubscriptionPlanConfig[];
  featureAddons?: FeatureAddonItem[];
  basePlatformMonthly: number;
  basePlatformAnnual: number;
  allAddonsBundleMonthly?: number;
  allAddonsBundleAnnual?: number;
  liveRepairQueue: number;
  homeServerSync: number;
  barcodeQrTags: number;
  technicianAccounts: number;
  outwardTaxInvoice: number;
  customAddons: CustomAddonPricingItem[];
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  // Basic Tier Plans
  {
    key: 'basic_7d',
    tier: 'basic',
    title: 'INOMS Basic · 7 Days',
    durationDays: 7,
    durationLabel: '7 Days Access',
    amount: 99,
    badge: 'Quick Trial',
    description: 'Basic plan 7-day starter access',
    enabled: true
  },
  {
    key: 'basic_15d',
    tier: 'basic',
    title: 'INOMS Basic · 15 Days',
    durationDays: 15,
    durationLabel: '15 Days Access',
    amount: 179,
    badge: 'Half Month',
    description: 'Basic plan 15-day access',
    enabled: true
  },
  {
    key: 'basic_30d',
    tier: 'basic',
    title: 'INOMS Basic · 30 Days (1 Month)',
    durationDays: 30,
    durationLabel: '30 Days Full Access',
    amount: 399,
    badge: '🟢 Main Product',
    description: 'Core repair management, billing, inventory & WhatsApp (₹399/mo)',
    enabled: true
  },
  {
    key: 'basic_90d',
    tier: 'basic',
    title: 'INOMS Basic · 90 Days (Quarterly)',
    durationDays: 90,
    durationLabel: '90 Days Access',
    amount: 999,
    badge: 'Save ₹198',
    description: 'Basic quarterly access (₹333/mo)',
    enabled: true
  },
  {
    key: 'basic_180d',
    tier: 'basic',
    title: 'INOMS Basic · 180 Days (Half-Yearly)',
    durationDays: 180,
    durationLabel: '180 Days Access',
    amount: 1799,
    badge: 'Save ₹595',
    description: 'Basic 6 months access (₹299/mo)',
    enabled: true
  },
  {
    key: 'basic_365d',
    tier: 'basic',
    title: 'INOMS Basic · 1 Year (Annual)',
    durationDays: 365,
    durationLabel: '365 Days Access',
    amount: 2999,
    badge: '🎁 37% Off (Save ₹1,789)',
    description: 'Basic annual license — Only ₹249/month',
    enabled: true
  },

  // Business Tier Plans
  {
    key: 'business_30d',
    tier: 'business',
    title: 'INOMS Business · 30 Days (1 Month)',
    durationDays: 30,
    durationLabel: '30 Days Full Access',
    amount: 599,
    badge: '🔵 Most Popular ⭐',
    description: 'Basic + Purchases, Supplier Ledger & Live Queue (₹599/mo)',
    enabled: true
  },
  {
    key: 'business_90d',
    tier: 'business',
    title: 'INOMS Business · 90 Days (Quarterly)',
    durationDays: 90,
    durationLabel: '90 Days Access',
    amount: 1499,
    badge: 'Save ₹298',
    description: 'Business quarterly access (₹499/mo)',
    enabled: true
  },
  {
    key: 'business_180d',
    tier: 'business',
    title: 'INOMS Business · 180 Days (Half-Yearly)',
    durationDays: 180,
    durationLabel: '180 Days Access',
    amount: 2699,
    badge: 'Save ₹895',
    description: 'Business 6 months access (₹449/mo)',
    enabled: true
  },
  {
    key: 'business_365d',
    tier: 'business',
    title: 'INOMS Business · 1 Year (Annual)',
    durationDays: 365,
    durationLabel: '365 Days Access',
    amount: 4499,
    badge: '🎁 37% Off (Save ₹2,689)',
    description: 'Business annual license — Only ₹374/month',
    enabled: true
  },

  // Pro Tier Plans
  {
    key: 'pro_30d',
    tier: 'pro',
    title: 'INOMS Pro · 30 Days (1 Month)',
    durationDays: 30,
    durationLabel: '30 Days Full Access',
    amount: 699,
    badge: '🟣 Ultimate Pro 🔥',
    description: 'Business + Service Partner Outsourcing, Multi-Technician & LAN Sync (₹699/mo)',
    enabled: true
  },
  {
    key: 'pro_90d',
    tier: 'pro',
    title: 'INOMS Pro · 90 Days (Quarterly)',
    durationDays: 90,
    durationLabel: '90 Days Access',
    amount: 1799,
    badge: 'Save ₹298',
    description: 'Pro quarterly access (₹599/mo)',
    enabled: true
  },
  {
    key: 'pro_180d',
    tier: 'pro',
    title: 'INOMS Pro · 180 Days (Half-Yearly)',
    durationDays: 180,
    durationLabel: '180 Days Access',
    amount: 3199,
    badge: 'Save ₹995',
    description: 'Pro 6 months access (₹533/mo)',
    enabled: true
  },
  {
    key: 'pro_365d',
    tier: 'pro',
    title: 'INOMS Pro · 1 Year (Annual)',
    durationDays: 365,
    durationLabel: '365 Days Access',
    amount: 5499,
    badge: '🎁 34% Off (Save ₹2,889)',
    description: 'Pro annual license — Only ₹458/month with VIP support',
    enabled: true
  }
];

export const DEFAULT_FEATURE_ADDONS: FeatureAddonItem[] = [
  {
    id: 'addon-purchases',
    key: 'purchases',
    name: 'Purchases & Vendor Inwarding Hub',
    description: 'Vendor purchase orders, goods inwarding receipts, batch serial allocation & purchase return workflows.',
    monthlyPrice: 299,
    annualPrice: 2499,
    enabled: true
  },
  {
    id: 'addon-suppliers',
    key: 'suppliers',
    name: 'Suppliers Ledger & Payables Hub',
    description: 'Vendor directory, purchase invoices ledger, outstanding balance management & bill-by-bill settlement receipts.',
    monthlyPrice: 249,
    annualPrice: 1999,
    enabled: true
  },
  {
    id: 'addon-service-partners',
    key: 'service_partners',
    name: 'Service Partners Hub & Job Outsourcing',
    description: 'Track external repairs sent to third-party labs, partner challans, cost vs client bill tracking & partner ledgers.',
    monthlyPrice: 299,
    annualPrice: 2499,
    enabled: true
  },
  {
    id: 'addon-live-queue',
    key: 'live_queue',
    name: 'Live Repair Queue & Technician Workbench',
    description: 'Real-time drag-and-drop Kanban workbench for bench engineers with active live job status board.',
    monthlyPrice: 399,
    annualPrice: 2999,
    enabled: true
  },
  {
    id: 'addon-barcode-qr',
    key: 'barcodeQrTags',
    name: 'Thermal Barcode & QR Code Tag Generation',
    description: 'Thermal 50x25mm barcode stickers and 2D QR tracking codes for device labelling and fast scanning.',
    monthlyPrice: 299,
    annualPrice: 2499,
    enabled: true
  },
  {
    id: 'addon-home-server',
    key: 'homeServerSync',
    name: 'Home Server & High-Speed LAN Sync',
    description: 'Local area network sync bridge for zero-latency multi-counter billing and silent PC disk backups.',
    monthlyPrice: 499,
    annualPrice: 3999,
    enabled: true
  },
  {
    id: 'addon-technicians',
    key: 'technicianAccounts',
    name: 'Multi-Technician Staff Logins & RBAC',
    description: 'Multi-seat technician staff sub-accounts with individual login PINs and granular view/edit permissions.',
    monthlyPrice: 399,
    annualPrice: 2999,
    enabled: true
  },
  {
    id: 'addon-outward-invoice',
    key: 'outwardTaxInvoice',
    name: 'Outward GST Tax Invoice 1-Click Generator',
    description: 'Instant 1-Click GST tax invoice generation directly from the outward delivery gate pass.',
    monthlyPrice: 199,
    annualPrice: 1499,
    enabled: true
  }
];

export const DEFAULT_ADDON_PRICING: AddonPricingConfig = {
  masterAdminUpi: 'sujitgajare@okicici',
  masterAdminName: 'Master System Admin',
  masterAdminMobile: '+91 8149862034',
  subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS,
  featureAddons: DEFAULT_FEATURE_ADDONS,
  basePlatformMonthly: 499,
  basePlatformAnnual: 4990,
  allAddonsBundleMonthly: 999,
  allAddonsBundleAnnual: 9990,
  liveRepairQueue: 399,
  homeServerSync: 499,
  barcodeQrTags: 299,
  technicianAccounts: 399,
  outwardTaxInvoice: 199,
  customAddons: [
    {
      id: 'custom-priority-support',
      name: '24x7 Priority Technical Support',
      price: 299,
      description: 'Dedicated phone & remote desk technical assistance',
      billingCycle: 'monthly'
    }
  ]
};

export interface MasterAdminInvoiceItem {
  id: string;
  description: string;
  addonKey?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface MasterAdminInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  ownerMobile: string;
  ownerName: string;
  date: string;
  dueDate: string;
  billingPeriod: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annual' | 'One-Time';
  items: MasterAdminInvoiceItem[];
  subtotal: number;
  discount: number;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  paymentMode?: string;
  notes?: string;
  createdAt: string;
}

// ==========================================
// SUPPLIER MANAGEMENT ENTITIES
// ==========================================

export interface Supplier {
  id: string;
  tenantId?: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  phone?: string;
  alternateNumber?: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  openingBalance?: number;
  currentBalance?: number;
  balance?: number;
  paymentTerms?: string;
  bankDetails?: string;
  notes?: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  category?: string;
  sku?: string;
  qty: number;
  quantity?: number;
  rate?: number;
  estimatedUnitPrice?: number;
  unitPrice?: number;
  discount?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
}

export interface PurchaseOrder {
  id: string; // e.g. PO-2026-101
  tenantId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  expectedDeliveryDate?: string;
  expectedDate?: string;
  items: PurchaseOrderItem[];
  subtotal?: number;
  discount?: number;
  taxPercent?: number;
  taxAmount?: number;
  grandTotal: number;
  status: 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled' | 'Closed' | 'Approved';
  notes?: string;
  createdAt?: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  category?: string;
  sku?: string;
  qty: number;
  quantity?: number;
  rate?: number;
  unitPrice?: number;
  unitCost?: number;
  hsnCode?: string;
  discount?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
  serialNumbers?: string[];
  warrantyExpiry?: string;
}

export interface Purchase {
  id: string; // e.g. PUR-2026-001
  tenantId?: string;
  purchaseNumber?: string;
  purchaseOrderRef?: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNo?: string;
  billNumber?: string;
  date: string;
  purchaseDate?: string;
  items: PurchaseItem[];
  subtotal: number;
  discount?: number;
  taxPercent?: number;
  taxAmount?: number;
  grandTotal: number;
  paidAmount?: number;
  balanceAmount?: number;
  paymentStatus?: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Partial';
  referenceNumber?: string; // Bill / Invoice No from supplier
  status: 'Active' | 'Cancelled' | 'Received' | 'Draft';
  remarks?: string;
  notes?: string;
  createdAt?: string;
}

export interface PurchaseReturnItem {
  id: string;
  productId: string;
  productName: string;
  category?: string;
  qty: number;
  quantity?: number;
  rate?: number;
  unitCost?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
  serialNumbers?: string[];
}

export interface PurchaseReturn {
  id: string; // e.g. PR-2026-001
  tenantId?: string;
  purchaseId?: string;
  purchaseNumber?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseReturnItem[];
  subtotal?: number;
  discount?: number;
  taxPercent?: number;
  taxAmount?: number;
  grandTotal: number;
  reason: string;
  status: 'Completed' | 'Pending' | 'Cancelled' | 'Processed';
  notes?: string;
  createdAt?: string;
}

export interface SupplierPaymentAllocation {
  purchaseId: string;
  purchaseNumber?: string;
  purchaseInvoiceNo?: string;
  allocatedAmount: number;
}

export interface SupplierPayment {
  id: string;
  tenantId?: string;
  paymentNumber?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  paymentMode: 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Other' | string;
  referenceNo?: string;
  refNo?: string;
  notes?: string;
  allocations: SupplierPaymentAllocation[];
  unallocatedAmount?: number;
  createdAt?: string;
}

// ==========================================
// SERVICE PARTNER MANAGEMENT ENTITIES
// ==========================================

export interface ServicePartner {
  id: string;
  tenantId?: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  phone?: string;
  alternateNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  pan?: string;
  openingBalance?: number;
  currentBalance?: number;
  balance?: number;
  specializations?: string[];
  notes?: string;
  activeJobsCount?: number;
  completedJobsCount?: number;
  totalBilled?: number;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface ServicePartnerPaymentAllocation {
  jobId: string;
  jobNo: string;
  deviceDescription?: string;
  allocatedAmount?: number;
  amount?: number;
}

export interface ServicePartnerPayment {
  id: string;
  tenantId?: string;
  servicePartnerId?: string;
  servicePartnerName?: string;
  partnerId?: string;
  partnerName?: string;
  date: string;
  amount: number;
  paymentMode: 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Other' | string;
  referenceNo?: string;
  refNo?: string;
  notes?: string;
  allocations?: ServicePartnerPaymentAllocation[];
  unallocatedAmount?: number;
  createdAt?: string;
}

// ==========================================
// INVENTORY SERIAL & TRANSACTION LEDGER
// ==========================================

export type SerialStatus =
  | 'In Stock'
  | 'Allocated to Job'
  | 'Used in Repair'
  | 'With Service Partner'
  | 'Sold / Billed'
  | 'Returned to Supplier'
  | 'Defective';

export interface InventorySerial {
  id: string;
  tenantId?: string;
  productId: string;
  productName?: string;
  serialNumber: string;
  supplierId?: string;
  supplierName?: string;
  purchaseId?: string;
  purchaseDate?: string;
  currentStatus?: SerialStatus;
  status?: string;
  currentLocation?: string; // 'Main Store' | 'Bench' | 'Service Partner' | 'Client'
  linkedJobId?: string;
  linkedJobNumber?: string;
  linkedInvoiceId?: string;
  assignedJobId?: string;
  assignedJobNumber?: string;
  assignedClientId?: string;
  soldInvoiceId?: string;
  warrantyMonths?: number;
  warrantyExpiry?: string;
  purchaseRate?: number;
  costPrice?: number;
  updatedAt?: string;
  notes?: string;
}

export type InventoryTransactionType =
  | 'PURCHASE'
  | 'PURCHASE_RETURN'
  | 'SALE_BILLING'
  | 'JOB_CARD_USAGE'
  | 'STOCK_ADJUSTMENT'
  | 'PARTNER_OUTWARD'
  | 'PARTNER_INWARD'
  | 'Purchase'
  | 'Purchase Return'
  | 'PURCHASE_INWARD';

export interface InventoryTransaction {
  id: string;
  tenantId?: string;
  date: string;
  productId: string;
  productName: string;
  type: InventoryTransactionType;
  quantity: number;
  direction?: 'IN' | 'OUT';
  previousStock?: number;
  currentStock?: number;
  referenceId?: string;
  referenceNumber?: string;
  referenceType?: string;
  supplierOrPartner?: string;
  serialNumbers?: string[];
  unitCost?: number;
  notes?: string;
  user?: string;
  createdAt?: string;
}

export interface SubscriptionRenewalRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  ownerMobile: string;
  ownerName: string;
  plan: 'monthly' | 'quarterly' | 'annual' | 'lifetime' | string;
  planTitle: string;
  durationDays?: number;
  basePlanAmount?: number;
  addonsAmount?: number;
  selectedAddonKeys?: string[];
  selectedAddonTitles?: string[];
  amount: number;
  utrNumber: string;
  paymentMode: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ClientFinancialStatementEntry {
  id: string;
  date: string;
  type: string;
  refNo: string;
  debit: number;
  credit: number;
  computedRunningBal?: number;
  sourceObj?: any;
}

export interface ClientFinancialSummary {
  clientJobs: RepairJob[];
  clientInvoices: Invoice[];
  clientPayments: Payment[];
  clientLedgerLogs: ClientLedgerEntry[];
  uninvoicedJobs: RepairJob[];
  openingBalance: number;
  openingDebit: number;
  openingCredit: number;
  totalBilled: number;
  totalAdvances: number;
  totalPaymentsAndCredits: number;
  totalDebits: number;
  totalCredits: number;
  netOutstanding: number;
  statementEntries: ClientFinancialStatementEntry[];
}

export function computeClientFinancials(
  client: Client,
  jobs: RepairJob[] = [],
  invoices: Invoice[] = [],
  payments: Payment[] = [],
  ledgerLogs: ClientLedgerEntry[] = []
): ClientFinancialSummary {
  if (!client) {
    return {
      clientJobs: [],
      clientInvoices: [],
      clientPayments: [],
      clientLedgerLogs: [],
      uninvoicedJobs: [],
      openingBalance: 0,
      openingDebit: 0,
      openingCredit: 0,
      totalBilled: 0,
      totalAdvances: 0,
      totalPaymentsAndCredits: 0,
      totalDebits: 0,
      totalCredits: 0,
      netOutstanding: 0,
      statementEntries: []
    };
  }

  const isClientMatch = (item: { clientId?: string; clientMobile?: string; clientPhone?: string; clientName?: string; name?: string } | null | undefined) => {
    if (!item) return false;
    if (item.clientId && item.clientId === client.id) return true;
    const cleanItemMobile = (item.clientMobile || item.clientPhone || '').replace(/\D/g, '');
    const cleanTargetMobile = (client.mobile || '').replace(/\D/g, '');
    if (cleanItemMobile && cleanTargetMobile && cleanItemMobile.length >= 10 && cleanTargetMobile.length >= 10 && cleanItemMobile.slice(-10) === cleanTargetMobile.slice(-10)) {
      return true;
    }
    if (item.clientName && client.name && item.clientName.trim().toLowerCase() === client.name.trim().toLowerCase()) {
      return true;
    }
    return false;
  };

  const clientJobs = (jobs || []).filter(j => isClientMatch(j));
  const clientInvoices = (invoices || []).filter(inv => isClientMatch(inv));
  const clientPayments = (payments || []).filter(p => isClientMatch(p));
  const clientLedger = (ledgerLogs || []).filter(l => isClientMatch(l));

  const openingBalance = Number(client.openingBalance) || 0;
  const openingDebit = openingBalance > 0 ? openingBalance : 0;
  const openingCredit = openingBalance < 0 ? Math.abs(openingBalance) : 0;

  // Invoices: Grand total (Debits) and Payments against invoices (Credits)
  const invoicedGrandTotal = clientInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const invoicedPaidAmount = clientInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);

  // Set of job card IDs linked to invoices
  const invoicedJobIds = new Set(
    clientInvoices.flatMap(inv => [
      inv.linkedJobId,
      ...((inv as any).jobCardIds || [])
    ]).filter(Boolean)
  );

  const uninvoicedJobs = clientJobs.filter(j => !invoicedJobIds.has(j.id));

  let uninvoicedJobDebits = 0;
  let totalAdvances = 0;
  let uninvoicedJobPaidAmount = 0;

  clientJobs.forEach(job => {
    totalAdvances += (Number(job.advanceAmount) || 0);
  });

  uninvoicedJobs.forEach(job => {
    const isNotRepaired = job.status === 'Device Not repairable' || job.status === 'Not Repaired' || job.repairOutcome === 'Not Repaired';
    const effectiveBill = isNotRepaired ? 0 : getEffectiveBillAmount(job);
    const advance = Number(job.advanceAmount) || 0;

    uninvoicedJobDebits += effectiveBill;

    if (job.paymentStatus === 'Paid' && !isNotRepaired) {
      uninvoicedJobPaidAmount += Math.max(0, effectiveBill - advance);
    }
  });

  // Direct payments not linked to invoices or job clearings that were already counted
  let directPaymentsCredit = 0;
  clientPayments.forEach(p => {
    if (p.invoiceId) return;
    if (p.linkedJobId || (p.linkedJobIds && p.linkedJobIds.length > 0)) {
      return;
    }
    directPaymentsCredit += (Number(p.amount) || 0);
  });

  // Manual ledger journal entries (excluding duplicate synthesized ones)
  let manualJournalDebits = 0;
  let manualJournalCredits = 0;
  clientLedger.forEach(l => {
    if (l.refNo === 'OPENING' || l.type === 'Opening Balance') return;
    if (l.type?.includes('Invoice') || l.type?.includes('Job') || l.type?.includes('Lump-sum')) return;
    manualJournalDebits += (Number(l.debit) || 0);
    manualJournalCredits += (Number(l.credit) || 0);
  });

  const totalBilled = invoicedGrandTotal + uninvoicedJobDebits;
  const totalPaymentsAndCredits = invoicedPaidAmount + totalAdvances + uninvoicedJobPaidAmount + directPaymentsCredit + manualJournalCredits;

  const totalDebits = openingDebit + totalBilled + manualJournalDebits;
  const totalCredits = openingCredit + totalPaymentsAndCredits;
  const netOutstanding = totalDebits - totalCredits;

  // Build Chronological Statement Entries
  const rawEntries: ClientFinancialStatementEntry[] = [];

  if (openingBalance !== 0) {
    rawEntries.push({
      id: `open-${client.id}`,
      date: (client as any).createdAt ? (client as any).createdAt.substring(0, 10) : '2020-01-01',
      type: 'Opening Balance',
      refNo: 'OPENING',
      debit: openingDebit,
      credit: openingCredit,
      sourceObj: client
    });
  }

  clientInvoices.forEach(inv => {
    if (Number(inv.grandTotal) > 0) {
      rawEntries.push({
        id: `inv-${inv.id}`,
        date: inv.date || '',
        type: `Tax Invoice #${inv.id}`,
        refNo: `INV-${inv.id}`,
        debit: Number(inv.grandTotal) || 0,
        credit: 0,
        sourceObj: inv
      });
    }
    if (Number(inv.paidAmount) > 0) {
      rawEntries.push({
        id: `inv-pay-${inv.id}`,
        date: inv.date || '',
        type: `Payment Received on Inv #${inv.id} (${inv.paymentMode || 'Cash'})`,
        refNo: `INV-${inv.id}`,
        debit: 0,
        credit: Number(inv.paidAmount) || 0,
        sourceObj: inv
      });
    }
  });

  clientJobs.forEach(job => {
    const jobDate = job.date || (job.createdAt ? job.createdAt.substring(0, 10) : '');
    const isNotInvoiced = !invoicedJobIds.has(job.id);
    const isNotRepaired = job.status === 'Device Not repairable' || job.status === 'Not Repaired' || job.repairOutcome === 'Not Repaired';
    const billAmt = isNotRepaired ? 0 : getEffectiveBillAmount(job);
    const advance = Number(job.advanceAmount) || 0;

    if (advance > 0 && isNotInvoiced) {
      rawEntries.push({
        id: `job-adv-${job.id}`,
        date: jobDate,
        type: `Advance Received - Job #${job.id} (${job.advancePaymentMode || 'Cash'})`,
        refNo: `JC-${job.id}`,
        debit: 0,
        credit: advance,
        sourceObj: job
      });
    }

    if (isNotInvoiced) {
      if (isNotRepaired) {
        rawEntries.push({
          id: `job-notrep-${job.id}`,
          date: jobDate,
          type: `Job #${job.id} (${job.equipment || 'Device'}) - ${job.status}`,
          refNo: `JC-${job.id}`,
          debit: 0,
          credit: 0,
          sourceObj: job
        });
      } else if (billAmt > 0) {
        rawEntries.push({
          id: `job-bill-${job.id}`,
          date: job.outwardedDate || jobDate,
          type: `Repair Bill - Job #${job.id} (${job.equipment || 'Device'})`,
          refNo: `JC-${job.id}`,
          debit: billAmt,
          credit: 0,
          sourceObj: job
        });

        if (job.paymentStatus === 'Paid' && billAmt > advance) {
          rawEntries.push({
            id: `job-clr-${job.id}`,
            date: job.outwardedDate || jobDate,
            type: `Payment Cleared - Job #${job.id}`,
            refNo: `JC-${job.id}`,
            debit: 0,
            credit: billAmt - advance,
            sourceObj: job
          });
        }
      }
    }
  });

  clientPayments.forEach(p => {
    if (!p.invoiceId && !p.linkedJobId && (!p.linkedJobIds || p.linkedJobIds.length === 0)) {
      rawEntries.push({
        id: `pay-${p.id}`,
        date: p.date || '',
        type: `Payment Received (${p.mode})`,
        refNo: p.refNo || p.id,
        debit: p.amount < 0 ? Math.abs(p.amount) : 0,
        credit: p.amount > 0 ? p.amount : 0,
        sourceObj: p
      });
    }
  });

  clientLedger.forEach(l => {
    if (l.refNo === 'OPENING' || l.type === 'Opening Balance') return;
    if (l.type?.includes('Invoice') || l.type?.includes('Job') || l.type?.includes('Lump-sum')) return;
    rawEntries.push({
      id: l.id,
      date: l.date || '',
      type: l.type || 'Journal Entry',
      refNo: l.refNo || '—',
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      sourceObj: l
    });
  });

  // Sort chronological
  rawEntries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let running = 0;
  const statementEntries = rawEntries.map(e => {
    running += (e.debit - e.credit);
    return {
      ...e,
      computedRunningBal: running
    };
  });

  return {
    clientJobs,
    clientInvoices,
    clientPayments,
    clientLedgerLogs: clientLedger,
    uninvoicedJobs,
    openingBalance,
    openingDebit,
    openingCredit,
    totalBilled,
    totalAdvances,
    totalPaymentsAndCredits,
    totalDebits,
    totalCredits,
    netOutstanding,
    statementEntries
  };
}


