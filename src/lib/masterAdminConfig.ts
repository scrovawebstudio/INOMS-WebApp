import {
  AddonPricingConfig,
  DEFAULT_ADDON_PRICING,
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_FEATURE_ADDONS,
  FeatureAddonItem,
  SubscriptionPlanConfig,
  InomsPlanTier,
  InomsTierPlan,
  INOMS_TIER_PLANS
} from '../types';

export const MASTER_ADMIN_PRICING_STORAGE_KEY = 'master_admin_addon_pricing_v1';
export const MASTER_ADMIN_RENEWALS_STORAGE_KEY = 'inoms_subscription_renewal_requests_v1';

export interface MasterAdminUpiDetails {
  upiId: string;
  name: string;
  mobile: string;
}

/**
 * Retrieves the tier configuration based on plan string or tier key.
 */
export function getTierPlan(tier: string = 'basic'): InomsTierPlan {
  const normalized = tier.toLowerCase();
  if (normalized.includes('pro')) return INOMS_TIER_PLANS.pro;
  if (normalized.includes('business')) return INOMS_TIER_PLANS.business;
  return INOMS_TIER_PLANS.basic;
}

/**
 * Returns the allowed modules for a given tier.
 */
export function getTierAllowedModules(tier: string = 'basic'): string[] {
  return getTierPlan(tier).allowedModules;
}

/**
 * Returns feature flags for a given tier.
 */
export function getTierFeatures(tier: string = 'basic') {
  return getTierPlan(tier).features;
}

/**
 * Retrieves the configured Master Admin UPI ID, Account Name, and WhatsApp Support Mobile.
 * Prioritizes:
 * 1. Explicitly passed `pricingConfig`
 * 2. Saved `master_admin_addon_pricing_v1` in localStorage
 * 3. Saved `company_config_org-admin` in localStorage (Master Admin Settings)
 * 4. Fallback defaults
 */
export function getMasterAdminUpiConfig(pricingConfig?: Partial<AddonPricingConfig>): MasterAdminUpiDetails {
  if (pricingConfig?.masterAdminUpi?.trim()) {
    return {
      upiId: pricingConfig.masterAdminUpi.trim(),
      name: pricingConfig.masterAdminName?.trim() || 'Master System Admin',
      mobile: (pricingConfig.masterAdminMobile?.replace(/\D/g, '') || '918149862034')
    };
  }

  try {
    const saved = localStorage.getItem(MASTER_ADMIN_PRICING_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.masterAdminUpi?.trim()) {
        return {
          upiId: parsed.masterAdminUpi.trim(),
          name: parsed.masterAdminName?.trim() || 'Master System Admin',
          mobile: (parsed.masterAdminMobile?.replace(/\D/g, '') || '918149862034')
        };
      }
    }
  } catch {}

  try {
    const adminCompany = localStorage.getItem('company_config_org-admin');
    if (adminCompany) {
      const parsed = JSON.parse(adminCompany);
      if (parsed.upiId?.trim()) {
        return {
          upiId: parsed.upiId.trim(),
          name: parsed.bankAccountName?.trim() || parsed.name?.trim() || 'Master System Admin',
          mobile: (parsed.phone?.replace(/\D/g, '') || '918149862034')
        };
      }
    }
  } catch {}

  return {
    upiId: DEFAULT_ADDON_PRICING.masterAdminUpi || 'sujitgajare@okicici',
    name: DEFAULT_ADDON_PRICING.masterAdminName || 'Master System Admin',
    mobile: '918149862034'
  };
}

/**
 * Loads the full pricing and plans configuration, ensuring fallback to default plans and dynamic addons.
 */
export function loadMasterAdminPricingConfig(): AddonPricingConfig {
  try {
    const saved = localStorage.getItem(MASTER_ADMIN_PRICING_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_ADDON_PRICING,
        ...parsed,
        allAddonsBundleMonthly: parsed.allAddonsBundleMonthly ?? DEFAULT_ADDON_PRICING.allAddonsBundleMonthly ?? 999,
        allAddonsBundleAnnual: parsed.allAddonsBundleAnnual ?? DEFAULT_ADDON_PRICING.allAddonsBundleAnnual ?? 9990,
        basePlatformMonthly: parsed.basePlatformMonthly ?? DEFAULT_ADDON_PRICING.basePlatformMonthly ?? 499,
        basePlatformAnnual: parsed.basePlatformAnnual ?? DEFAULT_ADDON_PRICING.basePlatformAnnual ?? 4990,
        subscriptionPlans: parsed.subscriptionPlans && parsed.subscriptionPlans.length > 0
          ? parsed.subscriptionPlans
          : DEFAULT_SUBSCRIPTION_PLANS,
        featureAddons: parsed.featureAddons && parsed.featureAddons.length > 0
          ? parsed.featureAddons
          : DEFAULT_FEATURE_ADDONS,
        customAddons: parsed.customAddons || []
      };
    }
  } catch {}

  return DEFAULT_ADDON_PRICING;
}

/**
 * Saves the updated pricing configuration to localStorage and notifies listeners.
 */
export function saveMasterAdminPricingConfig(config: AddonPricingConfig): void {
  try {
    localStorage.setItem(MASTER_ADMIN_PRICING_STORAGE_KEY, JSON.stringify(config));
    
    // Also sync UPI ID to Master Admin company config if present
    const adminCompanyStr = localStorage.getItem('company_config_org-admin');
    if (adminCompanyStr) {
      const adminCompany = JSON.parse(adminCompanyStr);
      adminCompany.upiId = config.masterAdminUpi || adminCompany.upiId;
      localStorage.setItem('company_config_org-admin', JSON.stringify(adminCompany));
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('master_pricing_updated', { detail: config }));
  } catch (e) {
    console.error('Failed to save master admin pricing config:', e);
  }
}

/**
 * Checks if a specific module/feature key is configured as an Add-on (not core).
 */
export function isModuleAnAddon(moduleKey: string, pricingConfig?: AddonPricingConfig): boolean {
  const cfg = pricingConfig || loadMasterAdminPricingConfig();
  const addons = cfg.featureAddons || DEFAULT_FEATURE_ADDONS;
  const match = addons.find(a => a.key === moduleKey || a.id === moduleKey);
  if (!match) return false;
  return match.enabled !== false && !match.isCore;
}

/**
 * Returns all active feature add-ons.
 */
export function getActiveFeatureAddons(pricingConfig?: AddonPricingConfig): FeatureAddonItem[] {
  const cfg = pricingConfig || loadMasterAdminPricingConfig();
  const list = cfg.featureAddons || DEFAULT_FEATURE_ADDONS;
  return list.filter(a => a.enabled !== false && !a.isCore);
}

export interface ResolvedPlanInfo {
  key: string;
  tier: 'basic' | 'business' | 'pro' | 'trial' | 'lifetime';
  tierLabel: string;
  tierBadgeClass: string;
  title: string;
  durationDays: number;
  durationLabel: string;
  amount: number;
  badge?: string;
  description?: string;
  allowedModules: string[];
  features: any;
}

/**
 * Returns all configured subscription plan variations (combining pricing matrix config with special trial and lifetime options).
 */
export function getAllSubscriptionPlanVariations(pricingConfig?: AddonPricingConfig): SubscriptionPlanConfig[] {
  const cfg = pricingConfig || loadMasterAdminPricingConfig();
  const basePlans = cfg.subscriptionPlans && cfg.subscriptionPlans.length > 0
    ? cfg.subscriptionPlans
    : DEFAULT_SUBSCRIPTION_PLANS;
  return basePlans;
}

/**
 * Resolves comprehensive metadata (tier, duration, price, modules, features, badges) for any plan key or legacy string.
 */
export function resolvePlanInfo(planKeyOrString?: string, pricingConfig?: AddonPricingConfig): ResolvedPlanInfo {
  const key = (planKeyOrString || 'basic_30d').toLowerCase().trim();
  const allPlans = getAllSubscriptionPlanVariations(pricingConfig);

  // 1. Special case: 7-Day Free Trial
  if (key === 'trial' || key === 'free_trial') {
    const basicTier = INOMS_TIER_PLANS.basic;
    return {
      key: 'trial',
      tier: 'trial',
      tierLabel: '🎁 Free Trial',
      tierBadgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      title: '7-Day Free Trial',
      durationDays: 7,
      durationLabel: '7 Days Trial',
      amount: 0,
      badge: 'Free Trial',
      description: 'Standard 7-day complimentary trial with core repair features',
      allowedModules: basicTier.allowedModules,
      features: basicTier.features
    };
  }

  // 2. Special case: Lifetime License
  if (key === 'lifetime' || key === 'permanent') {
    const proTier = INOMS_TIER_PLANS.pro;
    return {
      key: 'lifetime',
      tier: 'lifetime',
      tierLabel: '♾️ Lifetime License',
      tierBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      title: 'INOMS Lifetime License',
      durationDays: 3650,
      durationLabel: 'Permanent Access',
      amount: 0,
      badge: 'Lifetime',
      description: 'Permanent enterprise access with all modules & VIP features',
      allowedModules: proTier.allowedModules,
      features: {
        ...proTier.features,
        allowGoogleDriveSync: true,
        allowHomeServerSync: true,
        allowLiveQueue: true,
        allowTechnicianAccounts: true
      }
    };
  }

  // 3. Normalized plan search (e.g. basic_30d, business_90d, pro_365d)
  let matched = allPlans.find(p => p.key.toLowerCase() === key);

  // 4. Backwards compatibility for legacy plan strings
  if (!matched) {
    if (key === 'monthly') matched = allPlans.find(p => p.key === 'basic_30d');
    else if (key === 'quarterly') matched = allPlans.find(p => p.key === 'basic_90d');
    else if (key === 'annual') matched = allPlans.find(p => p.key === 'basic_365d');
    else if (key === 'basic') matched = allPlans.find(p => p.key === 'basic_30d');
    else if (key === 'business') matched = allPlans.find(p => p.key === 'business_30d');
    else if (key === 'pro') matched = allPlans.find(p => p.key === 'pro_30d');
  }

  // If still not matched, fallback to default basic_30d
  const plan = matched || allPlans.find(p => p.key === 'basic_30d') || DEFAULT_SUBSCRIPTION_PLANS[2];
  const tier = (plan.tier || 'basic') as 'basic' | 'business' | 'pro';
  const tierConfig = INOMS_TIER_PLANS[tier] || INOMS_TIER_PLANS.basic;

  const tierBadgeClass =
    tier === 'pro'
      ? 'bg-purple-100 text-purple-800 border-purple-300'
      : tier === 'business'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  const tierLabel =
    tier === 'pro'
      ? '🟣 INOMS Pro'
      : tier === 'business'
      ? '🔵 INOMS Business'
      : '🟢 INOMS Basic';

  return {
    key: plan.key,
    tier,
    tierLabel,
    tierBadgeClass,
    title: plan.title,
    durationDays: plan.durationDays,
    durationLabel: plan.durationLabel,
    amount: plan.amount,
    badge: plan.badge,
    description: plan.description,
    allowedModules: tierConfig.allowedModules,
    features: tierConfig.features
  };
}
