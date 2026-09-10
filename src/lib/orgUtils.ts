/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dynamically computes an Organization / Company Prefix from the Company Name or Tenant Code.
 * E.g., "INOMS Tech Solutions" -> "ITS"
 *       "Apex Electronics" -> "AE"
 *       "Apex Computer Services" -> "ACS"
 */
export function getOrgPrefix(companyName: string, tenantCode?: string): string {
  if (tenantCode && tenantCode !== 'ADMIN-00' && tenantCode.includes('-')) {
    const codePrefix = tenantCode.split('-')[0].trim().toUpperCase();
    if (codePrefix && codePrefix.length >= 2) return codePrefix;
  }

  if (!companyName) return 'ERP';

  const cleanName = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const rawWords = cleanName.split(/\s+/).filter(Boolean);

  if (rawWords.length === 0) return 'ERP';

  // Filter out noise words if multi-word
  const stopWords = ['AND', 'THE', 'PVT', 'LTD', 'INC', 'CO', 'TECHNOLOGIES', 'ENTERPRISES'];
  let filtered = rawWords.filter(w => !stopWords.includes(w.toUpperCase()));
  if (filtered.length === 0) filtered = rawWords;

  if (filtered.length >= 3) {
    return (filtered[0][0] + filtered[1][0] + filtered[2][0]).toUpperCase();
  } else if (filtered.length === 2) {
    return (filtered[0][0] + filtered[1][0]).toUpperCase();
  } else if (filtered.length === 1) {
    const single = filtered[0];
    if (single.length >= 3) {
      return single.substring(0, 3).toUpperCase();
    }
    return single.toUpperCase();
  }

  return 'ERP';
}

/**
 * Checks if a tenant organization is currently in an active, non-expired free trial period.
 * 7-day free trial users are granted full Pro features (including Google Drive Cloud Sync) by default.
 * Once the free trial is finished, access reverts strictly to the paid plan tier (INOMS Pro required for Drive).
 */
export function isTenantTrialActive(tenant?: any): boolean {
  if (!tenant) {
    try {
      const saved = localStorage.getItem('inoms_active_tenant_v3') || localStorage.getItem('active_tenant_v3');
      if (saved) {
        tenant = JSON.parse(saved);
      }
    } catch (_) {}
  }
  if (!tenant) return false;

  // Deactivated tenants no longer have active trial privileges
  if (tenant.status === 'deactivated') return false;

  const rawPlan = ((tenant.subscriptionPlan || tenant.plan || '') as string).toLowerCase().trim();
  const isTrial = Boolean(tenant.isTrial || rawPlan === 'trial' || rawPlan.includes('trial'));

  if (!isTrial) return false;

  // Check expiration date
  let endDate: Date | null = null;
  const rawEndDate = tenant.subscriptionEndDate || tenant.validUntil || tenant.expiryDate || tenant.expiresAt;

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

  // If no explicit end date, calculate from createdAt + trialDays (default 7 days)
  if (!endDate && tenant.createdAt) {
    const created = new Date(tenant.createdAt);
    if (!isNaN(created.getTime())) {
      const days = Number(tenant.trialDays) || 7;
      endDate = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
    }
  }

  if (endDate && !isNaN(endDate.getTime())) {
    // End of that calendar day in local time
    endDate.setHours(23, 59, 59, 999);
    return endDate.getTime() >= Date.now();
  }

  // Fallback if marked as trial and not deactivated
  return true;
}

/**
 * Checks if a tenant organization has active INOMS Pro tier features.
 * INOMS Pro unlocks:
 * - Google Drive Cloud Hub & Multi-Device Real-Time Sync
 * - Google Drive Tax Invoice & Job Sheet Cloud PDF Archiving
 * - Service Partner Outsourcing Challans & Partner Ledgers
 *
 * NOTE: 7-Day Free Trial users receive full access by default.
 * Once the free trial finishes, access requires INOMS Pro subscription.
 */
export function isTenantProPlan(tenant?: any): boolean {
  if (!tenant) {
    try {
      const saved = localStorage.getItem('inoms_active_tenant_v3') || localStorage.getItem('active_tenant_v3');
      if (saved) {
        tenant = JSON.parse(saved);
      }
    } catch (_) {}
  }
  if (!tenant) return false;

  const planStr = (tenant.subscriptionPlan || tenant.plan || tenant.planTier || tenant.tier || '').toString().toLowerCase().trim();
  const explicitTier = (tenant.tier || tenant.planTier || tenant.subscriptionTier || '').toString().toLowerCase().trim();

  // Master System Admin organization or system owner phone or lifetime/pro plan always has Pro access
  if (
    tenant.id === 'org-admin' ||
    tenant.code?.toUpperCase() === 'ADMIN-00' ||
    tenant.ownerMobile?.includes('8149862034') ||
    planStr.includes('lifetime') ||
    planStr.includes('pro') ||
    planStr.includes('premium') ||
    planStr.includes('annual') ||
    planStr.includes('yearly') ||
    planStr.includes('quarter') ||
    explicitTier.includes('lifetime') ||
    explicitTier.includes('pro')
  ) {
    return true;
  }

  // 1. Active 7-Day Free Trial: Unlocks Google Drive & Pro features by default
  if (isTenantTrialActive(tenant)) {
    if (tenant.features?.allowGoogleDriveSync === false) {
      return false; // Explicit admin override
    }
    return true;
  }

  // 2. Explicit features flag granted by Master Admin
  if (tenant.features?.allowGoogleDriveSync === true) return true;

  // 3. Active Google Drive connection for this tenant
  try {
    if (tenant.id && (localStorage.getItem(`inoms_drive_session_${tenant.id}`) || localStorage.getItem(`nibban_drive_session_${tenant.id}`))) {
      return true;
    }
  } catch {}

  return false;
}

