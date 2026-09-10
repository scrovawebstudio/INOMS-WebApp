/**
 * INOMS Clean Capability & Plan Management System
 *
 * Enforces the three-tier plan architecture:
 * - BASIC: Web only. No local server, no Android, no technician LAN sync.
 * - BUSINESS: Web only + Business features. No local server, no Android, no technician LAN sync.
 * - PRO: Web + Android + Home/Office Server + Local Operational DB + Technician LAN Sync.
 */

import { isTenantTrialActive } from './orgUtils';

export type InomsPlanTier = 'basic' | 'business' | 'pro';

export type InomsCapability =
  | 'web_access'
  | 'business_features'
  | 'local_server'
  | 'android_app'
  | 'technician_lan_sync'
  | 'technician_accounts'
  | 'google_drive_backup'
  | 'partner_outsourcing'
  | 'custom_tax_invoices';

export interface PlanDefinition {
  tier: InomsPlanTier;
  displayName: string;
  badge: string;
  tagline: string;
  requiresLocalServer: boolean;
  supportsAndroid: boolean;
  supportsLanSync: boolean;
}

export const PLAN_DEFINITIONS: Record<InomsPlanTier, PlanDefinition> = {
  basic: {
    tier: 'basic',
    displayName: 'INOMS Basic',
    badge: '🟢 Basic',
    tagline: 'Cloud web repair management, billing, inventory & WhatsApp',
    requiresLocalServer: false,
    supportsAndroid: false,
    supportsLanSync: false
  },
  business: {
    tier: 'business',
    displayName: 'INOMS Business',
    badge: '🔵 Business',
    tagline: 'Comprehensive workshop management with purchases, suppliers & live queue',
    requiresLocalServer: false,
    supportsAndroid: false,
    supportsLanSync: false
  },
  pro: {
    tier: 'pro',
    displayName: 'INOMS Pro',
    badge: '🟣 Ultimate Pro',
    tagline: 'Full enterprise suite with Home/Office Local Server, Android app & LAN sync',
    requiresLocalServer: true,
    supportsAndroid: true,
    supportsLanSync: true
  }
};

/**
 * Resolves the normalized plan tier for a tenant organization.
 */
export function getTenantPlanTier(tenant?: any): InomsPlanTier {
  if (!tenant) return 'basic';

  // Master admin is always Pro
  if (
    tenant.id === 'org-admin' ||
    tenant.code?.toUpperCase() === 'ADMIN-00' ||
    tenant.ownerMobile?.includes('8149862034')
  ) {
    return 'pro';
  }

  const planStr = (tenant.subscriptionPlan || tenant.plan || tenant.planTier || tenant.tier || '').toString().toLowerCase().trim();
  const explicitTier = (tenant.tier || tenant.planTier || tenant.subscriptionTier || '').toString().toLowerCase().trim();

  if (
    planStr.includes('pro') ||
    planStr.includes('lifetime') ||
    planStr.includes('premium') ||
    explicitTier === 'pro'
  ) {
    return 'pro';
  }

  if (
    planStr.includes('business') ||
    planStr.includes('quarter') ||
    planStr.includes('annual') ||
    planStr.includes('yearly') ||
    explicitTier === 'business'
  ) {
    return 'business';
  }

  // Active 7-day trial users get Pro trial access to test full capabilities
  if (isTenantTrialActive(tenant)) {
    return 'pro';
  }

  return 'basic';
}

/**
 * Central capability evaluator.
 * Checks whether an organization is entitled to a specific functional capability.
 */
export function hasCapability(tenant: any, capability: InomsCapability): boolean {
  if (!tenant) return false;

  // Master Admin has all capabilities
  if (
    tenant.id === 'org-admin' ||
    tenant.code?.toUpperCase() === 'ADMIN-00' ||
    tenant.ownerMobile?.includes('8149862034')
  ) {
    return true;
  }

  // Deactivated tenants have no active capabilities
  if (tenant.status === 'deactivated' || tenant.status === 'suspended') {
    return false;
  }

  const tier = getTenantPlanTier(tenant);
  const features = tenant.features || {};

  switch (capability) {
    case 'web_access':
      return true; // All tiers have web access

    case 'business_features':
      // Business and Pro have purchase orders, suppliers, live queue
      return tier === 'business' || tier === 'pro';

    case 'local_server':
      // Local Home/Office Server is strictly isolated to PRO customers
      if (features.allowHomeServerSync === false) return false;
      return tier === 'pro' || features.allowHomeServerSync === true;

    case 'android_app':
      // Android application access is strictly isolated to PRO customers
      if (features.allowAndroidApp === false) return false;
      return tier === 'pro' || features.allowAndroidApp === true;

    case 'technician_lan_sync':
      // Technician LAN/Wi-Fi sync through the local server is strictly PRO
      if (features.allowTechnicianLANSync === false) return false;
      return tier === 'pro' || features.allowTechnicianLANSync === true;

    case 'technician_accounts':
      return tier === 'pro' || features.allowTechnicianAccounts === true;

    case 'google_drive_backup':
      return tier === 'pro' || features.allowGoogleDriveSync === true;

    case 'partner_outsourcing':
      return tier === 'pro';

    case 'custom_tax_invoices':
      return true;

    default:
      return false;
  }
}

/**
 * Quick helper for checking if Pro server features apply.
 */
export function isProTenant(tenant?: any): boolean {
  return hasCapability(tenant, 'local_server');
}
