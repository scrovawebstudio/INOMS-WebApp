/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TenantOrg } from '../components/AuthModal';
import { CompanyConfig, AddonPricingConfig, INOMS_TIER_PLANS } from '../types';
import { getMasterAdminUpiConfig, loadMasterAdminPricingConfig } from './masterAdminConfig';

/**
 * Normalizes phone numbers to WhatsApp wa.me format (digits only, prepending 91 for standard 10-digit Indian numbers).
 */
export function cleanWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export interface SubscriptionStatusInfo {
  planLabel: string;
  validUntil: string;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isToday: boolean;
  statusText: string;
  badgeType: 'expired' | 'urgent' | 'warning' | 'active' | 'lifetime';
}

/**
 * Calculates current subscription state for a tenant organization.
 */
export function getOrganizationSubscriptionStatus(tenant: TenantOrg): SubscriptionStatusInfo {
  if (tenant.id === 'org-admin' || tenant.code?.toUpperCase() === 'ADMIN-00' || tenant.subscriptionPlan === 'lifetime') {
    return {
      planLabel: 'Lifetime Unlimited Access',
      validUntil: 'Never Expires',
      daysRemaining: 9999,
      isExpired: false,
      isExpiringSoon: false,
      isToday: false,
      statusText: 'Lifetime License',
      badgeType: 'lifetime'
    };
  }

  const rawPlan = ((tenant.subscriptionPlan || (tenant as any).plan || '') as string).toLowerCase().trim();
  const isTrial = Boolean(tenant.isTrial || rawPlan === 'trial' || rawPlan.includes('trial'));
  
  let planLabel = isTrial ? 'Free Trial' : 'Monthly Subscription';
  if (rawPlan.includes('pro')) planLabel = 'INOMS Pro Plan';
  else if (rawPlan.includes('business')) planLabel = 'INOMS Business Plan';
  else if (rawPlan.includes('basic')) planLabel = 'INOMS Basic Plan';
  else if (rawPlan.includes('standard')) planLabel = 'Standard Plan';
  else if (rawPlan.includes('quarter')) planLabel = 'Quarterly Subscription';
  else if (rawPlan.includes('annual') || rawPlan.includes('year')) planLabel = 'Annual Subscription';

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
    const now = new Date();
    endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  endDate.setHours(23, 59, 59, 999);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const validUntil = endDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const isDeactivated = tenant.status === 'deactivated';

  if (diffDays < 0 || isDeactivated) {
    const ago = Math.abs(diffDays);
    return {
      planLabel,
      validUntil,
      daysRemaining: diffDays,
      isExpired: true,
      isExpiringSoon: false,
      isToday: false,
      statusText: isDeactivated ? 'Deactivated / Expired' : ago === 1 ? 'Expired yesterday' : ago <= 60 ? `Expired (${ago} days ago)` : 'Expired',
      badgeType: 'expired'
    };
  }

  if (diffDays === 0) {
    return {
      planLabel,
      validUntil,
      daysRemaining: 0,
      isExpired: false,
      isExpiringSoon: true,
      isToday: true,
      statusText: 'Expires Today',
      badgeType: 'urgent'
    };
  }

  if (diffDays <= 7) {
    return {
      planLabel,
      validUntil,
      daysRemaining: diffDays,
      isExpired: false,
      isExpiringSoon: true,
      isToday: false,
      statusText: `Expiring in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      badgeType: 'warning'
    };
  }

  return {
    planLabel,
    validUntil,
    daysRemaining: diffDays,
    isExpired: false,
    isExpiringSoon: false,
    isToday: false,
    statusText: `Active (${diffDays} days left)`,
    badgeType: 'active'
  };
}

export type WhatsAppNoticeType = 'auto' | 'expired' | 'expiring' | 'advance';

export interface GenerateRenewalMessageOptions {
  tenant: TenantOrg;
  companyConfig?: Partial<CompanyConfig>;
  pricingConfig?: Partial<AddonPricingConfig>;
  noticeType?: WhatsAppNoticeType;
  customNote?: string;
}

/**
 * Builds the comprehensive WhatsApp renewal/expiry notice text, seamlessly integrating
 * dynamic plans, pricing, UPI info, and settings links (Website, Reviews, Social, Support).
 */
export function generateRenewalWhatsAppMessage(options: GenerateRenewalMessageOptions): {
  message: string;
  targetMobile: string;
  subInfo: SubscriptionStatusInfo;
  detectedNoticeType: 'expired' | 'expiring' | 'advance';
} {
  const { tenant, companyConfig, pricingConfig, noticeType = 'auto', customNote } = options;
  const subInfo = getOrganizationSubscriptionStatus(tenant);

  let effectiveNoticeType: 'expired' | 'expiring' | 'advance' = 'expiring';
  if (noticeType === 'auto') {
    if (subInfo.isExpired) {
      effectiveNoticeType = 'expired';
    } else if (subInfo.isExpiringSoon || subInfo.isToday) {
      effectiveNoticeType = 'expiring';
    } else {
      effectiveNoticeType = 'advance';
    }
  } else {
    effectiveNoticeType = noticeType;
  }

  const activePricing = pricingConfig || loadMasterAdminPricingConfig();
  const upiDetails = getMasterAdminUpiConfig(activePricing);

  // Read links and company details from Settings
  const website = companyConfig?.website?.trim();
  const whatsappChannel = companyConfig?.whatsappChannelUrl?.trim();
  const googleReview = companyConfig?.googleReviewUrl?.trim();
  const instagram = companyConfig?.instagramUrl?.trim();
  const facebook = companyConfig?.facebookUrl?.trim();
  const youtube = companyConfig?.youtubeUrl?.trim();
  const customReview = companyConfig?.customReviewUrl?.trim();
  const supportPhone = companyConfig?.phone?.trim() || activePricing.masterAdminMobile || '+91 8149862034';
  const supportEmail = companyConfig?.email?.trim();
  const officeAddress = companyConfig?.address?.trim();
  const appName = companyConfig?.appName?.trim() || companyConfig?.name?.trim() || 'INOMS Service ERP';

  // Master Admin UPI & Bank Details
  const upiId = companyConfig?.upiId?.trim() || activePricing.masterAdminUpi?.trim() || upiDetails.upiId || 'sujitgajare@okicici';
  const upiPayeeName = companyConfig?.bankAccountName?.trim() || activePricing.masterAdminName?.trim() || upiDetails.name || 'Master System Admin';
  const bankName = companyConfig?.bankName?.trim();
  const bankAccountNo = companyConfig?.bankAccountNo?.trim();
  const bankIfsc = companyConfig?.bankIfsc?.trim();

  // Construct message pieces
  let msg = ``;

  // 1. Title Banner
  if (effectiveNoticeType === 'expired') {
    msg += `⚠️ *IMPORTANT: YOUR INOMS SUBSCRIPTION HAS EXPIRED*\n`;
  } else if (effectiveNoticeType === 'expiring') {
    msg += `⏳ *SUBSCRIPTION RENEWAL REMINDER: INOMS SERVICE ERP*\n`;
  } else {
    msg += `✨ *SUBSCRIPTION RENEWAL NOTICE: INOMS SERVICE ERP*\n`;
  }

  // 2. Greeting & Organization Identification
  const ownerGreeting = tenant.ownerName?.trim() ? `Dear *${tenant.ownerName.trim()}*,` : `Hello Team *${tenant.name}*,`;
  msg += `\n${ownerGreeting}\n`;
  msg += `🏢 Organization: *${tenant.name}*\n`;
  msg += `🔑 Org Code: *${tenant.code}*\n`;

  // 3. Expiry / Status Explanation
  if (effectiveNoticeType === 'expired') {
    const ago = Math.abs(subInfo.daysRemaining);
    const agoStr = ago > 0 ? ` (${ago} day${ago === 1 ? '' : 's'} ago)` : '';
    msg += `\nYour *${subInfo.planLabel}* subscription expired on *${subInfo.validUntil}*${agoStr}. Your account access may be restricted or paused.\n\n`;
    msg += `To reactivate your workspace and continue using the software with zero disruption to your daily repair job sheets, billing, and customer records, please renew with any of the plans below.\n`;
  } else if (effectiveNoticeType === 'expiring') {
    const daysStr = subInfo.isToday 
      ? `*today* (${subInfo.validUntil})` 
      : `in *${subInfo.daysRemaining} day${subInfo.daysRemaining === 1 ? '' : 's'}* on *${subInfo.validUntil}*`;
    msg += `\nYour current *${subInfo.planLabel}* will expire ${daysStr}.\n\n`;
    msg += `To avoid any service interruption or temporary suspension of your workshop billing and job management, you can easily renew your subscription in advance.\n`;
  } else {
    msg += `\nYour *${subInfo.planLabel}* is currently active until *${subInfo.validUntil}* (${subInfo.daysRemaining} days remaining).\n\n`;
    msg += `You can extend or renew your subscription early to lock in your existing pricing and guarantee uninterrupted service for your workshop.\n`;
  }

  // 4. Subscription Plans
  msg += `\n📦 *AVAILABLE SUBSCRIPTION PLANS:*\n`;

  // Helper to extract or display tier pricing
  const basicTier = INOMS_TIER_PLANS.basic;
  const proTier = INOMS_TIER_PLANS.pro;
  const businessTier = INOMS_TIER_PLANS.business;

  msg += `\n🟢 *1. INOMS Basic Plan* (Essential Repair & Billing):\n`;
  msg += `   • 30 Days (1 Month): ₹${basicTier.durationOptions.find(d => d.days === 30)?.price || 399}\n`;
  msg += `   • 90 Days (3 Months): ₹${basicTier.durationOptions.find(d => d.days === 90)?.price || 999}\n`;
  msg += `   • 1 Year (365 Days): ₹${basicTier.durationOptions.find(d => d.days === 365)?.price || 2999} _(Save ₹1,789 / 37% Off)_\n`;

  msg += `\n🟣 *2. INOMS Pro Plan* (Live Kanban Queue & Partner Labs):\n`;
  msg += `   • 30 Days (1 Month): ₹${proTier.durationOptions.find(d => d.days === 30)?.price || 699}\n`;
  msg += `   • 90 Days (3 Months): ₹${proTier.durationOptions.find(d => d.days === 90)?.price || 1799}\n`;
  msg += `   • 1 Year (365 Days): ₹${proTier.durationOptions.find(d => d.days === 365)?.price || 5499} _(Save ₹2,889 / 34% Off)_\n`;

  msg += `\n💎 *3. INOMS Business Plan* (Full Inventory, Suppliers & Multi-Tech):\n`;
  msg += `   • 30 Days (1 Month): ₹${businessTier.durationOptions.find(d => d.days === 30)?.price || 1299}\n`;
  msg += `   • 90 Days (3 Months): ₹${businessTier.durationOptions.find(d => d.days === 90)?.price || 3499}\n`;
  msg += `   • 1 Year (365 Days): ₹${businessTier.durationOptions.find(d => d.days === 365)?.price || 9999}\n`;

  // 5. Payment Details
  msg += `\n💳 *HOW TO RENEW (DIRECT UPI / BANK):*\n`;
  msg += `• *UPI ID:* ${upiId}\n`;
  msg += `• *Account Name:* ${upiPayeeName}\n`;
  if (upiId) {
    msg += `• *Quick UPI Link:* upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiPayeeName)}&cu=INR\n`;
  }
  if (bankName && bankAccountNo) {
    msg += `• *Bank Transfer:*\n`;
    msg += `  - Bank: ${bankName}\n`;
    msg += `  - A/C No: ${bankAccountNo}\n`;
    if (bankIfsc) msg += `  - IFSC Code: ${bankIfsc}\n`;
  }

  // 6. Action After Payment
  msg += `\n⚡ *After Payment:* Please reply to this message with your *12-digit UPI UTR / Reference Number* or payment screenshot. We will verify and immediately reactivate/extend your organization's workspace.\n`;

  // 7. Custom Note (if provided)
  if (customNote && customNote.trim()) {
    msg += `\n📝 *Note from Master Administrator:*\n${customNote.trim()}\n`;
  }

  // 8. Settings Links and Stuff
  const hasAnyLink = website || whatsappChannel || googleReview || instagram || facebook || youtube || customReview || supportPhone || supportEmail;
  if (hasAnyLink) {
    msg += `\n🌐 *OFFICIAL LINKS & SUPPORT:*\n`;
    if (website) msg += `• Official Website: ${website}\n`;
    if (whatsappChannel) msg += `• WhatsApp Channel / Community: ${whatsappChannel}\n`;
    if (googleReview) msg += `• Google Reviews: ${googleReview}\n`;
    if (instagram) msg += `• Instagram: ${instagram}\n`;
    if (facebook) msg += `• Facebook: ${facebook}\n`;
    if (youtube) msg += `• YouTube: ${youtube}\n`;
    if (customReview) msg += `• Customer Feedback: ${customReview}\n`;
    if (supportPhone) msg += `• Support Helpline: ${supportPhone}\n`;
    if (supportEmail) msg += `• Support Email: ${supportEmail}\n`;
    if (officeAddress) msg += `• Office Address: ${officeAddress}\n`;
  }

  msg += `\nBest Regards,\n*${upiPayeeName}*\n${appName}`;

  const cleanMobile = cleanWhatsAppNumber(tenant.ownerMobile || '');

  return {
    message: msg,
    targetMobile: cleanMobile,
    subInfo,
    detectedNoticeType: effectiveNoticeType
  };
}
