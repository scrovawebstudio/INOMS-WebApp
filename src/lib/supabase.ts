/**
 * INOMS Supabase Cloud Client & Migration Engine
 * 
 * Provides cloud database integration, direct table querying, and live data migration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getLocalDB } from './localDb';
import { getDeletedTenantIds } from './storage';
import {
  INITIAL_CLIENTS,
  INITIAL_JOBS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_PRODUCTS,
  INITIAL_EXPENSES,
  INITIAL_CATEGORIES,
  INITIAL_RACKS,
  EQUIPMENT_TYPES,
  COMMON_PROBLEMS
} from '../data';

export const SUPABASE_URL_KEY = 'inoms_supabase_url';
export const SUPABASE_KEY_KEY = 'inoms_supabase_anon_key';
export const SUPABASE_CONNECTED_KEY = 'inoms_supabase_connected';

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  maskedKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  if (typeof window !== 'undefined') {
    url = (localStorage.getItem(SUPABASE_URL_KEY) || '').trim();
    anonKey = (localStorage.getItem(SUPABASE_KEY_KEY) || '').trim();
  }

  if (!url) {
    const metaEnv = (import.meta as any)?.env;
    url = (
      metaEnv?.VITE_SUPABASE_URL ||
      metaEnv?.VITE_SUPABASE_PROJECT_URL ||
      metaEnv?.SUPABASE_URL ||
      metaEnv?.SUPABASE_PROJECT_URL ||
      ''
    ).trim();
    anonKey = (
      anonKey ||
      metaEnv?.VITE_SUPABASE_ANON_KEY ||
      metaEnv?.VITE_ANON_KEY ||
      metaEnv?.SUPABASE_ANON_KEY ||
      metaEnv?.ANON_KEY ||
      ''
    ).trim();
  }

  const isConfigured = Boolean(url && anonKey && url.startsWith('http'));
  const maskedKey = anonKey ? `${anonKey.slice(0, 8)}...${anonKey.slice(-6)}` : '';

  return { url, anonKey, isConfigured, maskedKey };
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (cachedClient && lastUrl === url && lastKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastUrl = url;
    lastKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
  localStorage.setItem(SUPABASE_KEY_KEY, cleanKey);
  cachedClient = null;
  lastUrl = '';
  lastKey = '';
}

export function clearSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPABASE_URL_KEY);
  localStorage.removeItem(SUPABASE_KEY_KEY);
  localStorage.removeItem(SUPABASE_CONNECTED_KEY);
  cachedClient = null;
  lastUrl = '';
  lastKey = '';
}

/**
 * Automatically fetch Supabase configuration from Cloudflare Edge / Server /api/config
 * if not already set locally.
 */
export async function initSupabaseFromRemoteConfig(): Promise<void> {
  if (typeof window === 'undefined') return;
  const current = getSupabaseConfig();
  if (current.isConfigured) return;

  try {
    const res = await fetch('/api/config', {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.success && data.supabaseUrl && data.supabaseAnonKey) {
        saveSupabaseConfig(data.supabaseUrl, data.supabaseAnonKey);
        console.log('[Supabase] Auto-configured from Cloudflare / server environment variables');
      }
    }
  } catch (err) {
    // Offline or static fallback
  }
}

export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; message: string; latencyMs?: number; tablesFound?: string[] }> {
  const url = (customUrl || getSupabaseConfig().url).trim().replace(/\/+$/, '');
  const key = (customKey || getSupabaseConfig().anonKey).trim();

  if (!url || !key) {
    return { success: false, message: 'Supabase URL and API Key are required.' };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { success: false, message: 'Supabase URL must start with https://' };
  }

  const startTime = Date.now();
  try {
    const testClient = createClient(url, key);
    // Test read on organizations table
    const { data, error } = await testClient
      .from('organizations')
      .select('id, name')
      .limit(5);

    const latencyMs = Date.now() - startTime;

    if (error) {
      // If table doesn't exist yet, we can check if credentials themselves are valid
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Connected to Supabase! (Database schema not yet applied. Please run supabase_schema.sql).',
          latencyMs
        };
      }
      return {
        success: false,
        message: `Supabase Error: ${error.message} (Code: ${error.code || 'unknown'})`,
        latencyMs
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(SUPABASE_CONNECTED_KEY, 'true');
    }

    return {
      success: true,
      message: `Successfully connected to Supabase (${latencyMs}ms)! Found ${data?.length || 0} organizations.`,
      latencyMs
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err?.message || 'Network error reaching Supabase'}`
    };
  }
}

// -------------------------------------------------------------------------
// CRUD HELPERS FOR SUPABASE
// -------------------------------------------------------------------------

export async function fetchOrganizationsFromSupabase(): Promise<any[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      ownerMobile: row.owner_mobile,
      ownerName: row.owner_name,
      status: row.status,
      secretKey: row.secret_key || '',
      pin: row.pin || '',
      subscriptionPlan: row.subscription_plan,
      subscriptionStartDate: row.subscription_start_date,
      subscriptionEndDate: row.subscription_end_date,
      trialDays: row.trial_days,
      isTrial: Boolean(row.is_trial),
      features: row.features_json || {},
      ...(row.data_json || {})
    }));
  } catch (err) {
    console.warn('[Supabase] fetchOrganizations error:', err);
    return [];
  }
}

export async function saveOrganizationToSupabase(org: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !org || !org.id) return false;

  try {
    const row = {
      id: String(org.id),
      name: org.name || 'Unnamed Org',
      code: org.code || '',
      owner_mobile: org.ownerMobile || '',
      owner_name: org.ownerName || '',
      status: org.status || 'active',
      secret_key: org.secretKey || '',
      pin: org.pin || '',
      subscription_plan: org.subscriptionPlan || 'trial',
      subscription_start_date: org.subscriptionStartDate || '',
      subscription_end_date: org.subscriptionEndDate || '',
      trial_days: org.trialDays || 7,
      is_trial: org.isTrial ? 1 : 0,
      features_json: org.features || {},
      data_json: org,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('organizations').upsert(row);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] saveOrganization error:', err);
    return false;
  }
}

export const syncTenantToSupabase = saveOrganizationToSupabase;
export const fetchTenantsFromSupabase = fetchOrganizationsFromSupabase;

export async function deleteOrganizationFromSupabase(orgId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !orgId) return false;

  try {
    const { error } = await client.from('organizations').delete().eq('id', orgId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteOrganization error:', err);
    return false;
  }
}

export const deleteTenantFromSupabase = deleteOrganizationFromSupabase;

export async function syncCompanyConfigToSupabase(tenantId: string, config: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !tenantId || !config) return false;

  try {
    const row = {
      tenant_id: String(tenantId),
      name: config.companyName || config.name || '',
      phone: config.phone || config.mobile || '',
      email: config.email || '',
      address: config.address || '',
      gstin: config.gstin || '',
      upi_id: config.upiId || '',
      config_json: config,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('tenant_configs').upsert(row);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] syncCompanyConfig error:', err);
    return false;
  }
}

export async function fetchCompanyConfigFromSupabase(tenantId: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client || !tenantId) return null;

  try {
    const { data, error } = await client
      .from('tenant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...(data.config_json || {}),
      companyName: data.name || (data.config_json?.companyName),
      phone: data.phone || (data.config_json?.phone),
      email: data.email || (data.config_json?.email),
      address: data.address || (data.config_json?.address),
      gstin: data.gstin || (data.config_json?.gstin),
      upiId: data.upi_id || (data.config_json?.upiId)
    };
  } catch (err) {
    console.warn('[Supabase] fetchCompanyConfig error:', err);
    return null;
  }
}

// -------------------------------------------------------------------------
// DIRECT COLLECTION CRUD FOR SUPABASE
// -------------------------------------------------------------------------

export async function syncCollectionToSupabase(
  tenantId: string,
  collectionName: string,
  items: any[],
  deletedIds?: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client || !tenantId) return { success: true };

  try {
    const safeTenantId = String(tenantId);

    // 1. Handle Deletions if requested
    if (Array.isArray(deletedIds) && deletedIds.length > 0) {
      const targetTable = getSupabaseTableForCollection(collectionName);
      if (targetTable && targetTable !== 'system_settings') {
        await client
          .from(targetTable)
          .delete()
          .eq('tenant_id', safeTenantId)
          .in('id', deletedIds);
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, count: 0 };
    }

    // 2. Normalization based on entity type
    const rows: any[] = [];

    switch (collectionName) {
      case 'clients':
        for (const c of items) {
          if (!c || !c.id) continue;
          rows.push({
            id: String(c.id),
            tenant_id: safeTenantId,
            name: c.name || 'Unnamed Client',
            type: c.type || 'Walk-in',
            mobile: c.mobile || '',
            phone: c.phone || '',
            email: c.email || '',
            contact_person: c.contactPerson || '',
            address: c.address || '',
            state: c.state || 'Maharashtra',
            city: c.city || '',
            gstin: c.gstin || '',
            opening_balance: Number(c.openingBalance || 0),
            outstanding_balance: Number(c.outstandingBalance || 0),
            notes: c.notes || '',
            data_json: c,
            updated_at: new Date().toISOString()
          });
        }
        break;

      case 'jobs':
        for (const j of items) {
          if (!j || !j.id) continue;
          rows.push({
            id: String(j.id),
            tenant_id: safeTenantId,
            client_id: j.clientId || '',
            client_name: j.clientName || '',
            client_mobile: j.clientMobile || '',
            date: j.date || j.inDate || '',
            in_date: j.inDate || j.date || '',
            out_date: j.outDate || j.outwardedDate || '',
            equipment: j.equipment || '',
            product_name: j.productName || '',
            product_model: j.productModel || '',
            serial_no: j.serialNo || '',
            ram_hdd: j.ramHDD || j.ramHdd || '',
            problems: Array.isArray(j.problems) ? j.problems : [],
            problem_description: j.problemDescription || '',
            components_checklist: j.componentsChecklist || {},
            estimate_amount: Number(j.estimateAmount || 0),
            advance_amount: Number(j.advanceAmount || 0),
            final_bill_amount: Number(j.finalBillAmount || 0),
            advance_payment_mode: j.advancePaymentMode || '',
            assigned_technician: j.assignedTechnician || '',
            status: j.status || 'Received',
            payment_status: j.paymentStatus || 'Unpaid',
            repair_outcome: j.repairOutcome || '',
            rack_location: j.rackLocation || '',
            repair_type: j.repairType || 'Internal',
            service_partner_name: j.servicePartnerName || '',
            remarks: j.remarks || '',
            data_json: j,
            updated_at: new Date().toISOString()
          });
        }
        break;

      case 'invoices':
        for (const inv of items) {
          if (!inv || !inv.id) continue;
          rows.push({
            id: String(inv.id),
            tenant_id: safeTenantId,
            invoice_no: inv.invoiceNo || inv.id || '',
            date: inv.date || '',
            time: inv.time || '',
            client_id: inv.clientId || '',
            client_name: inv.clientName || '',
            client_mobile: inv.clientMobile || '',
            client_address: inv.clientAddress || '',
            client_gstin: inv.clientGstin || '',
            linked_job_id: inv.linkedJobId || '',
            subtotal: Number(inv.subtotal || inv.total || 0),
            discount: Number(inv.discount || 0),
            tax: Number(inv.tax || 0),
            total: Number(inv.total || 0),
            paid_amount: Number(inv.paidAmount || 0),
            balance_due: Number(inv.balanceDue || 0),
            payment_mode: inv.paymentMode || '',
            status: inv.status || 'Unpaid',
            items: Array.isArray(inv.items) ? inv.items : [],
            data_json: inv,
            updated_at: new Date().toISOString()
          });
        }
        break;

      case 'payments':
        for (const p of items) {
          if (!p || !p.id) continue;
          rows.push({
            id: String(p.id),
            tenant_id: safeTenantId,
            date: p.date || '',
            client_id: p.clientId || '',
            client_name: p.clientName || '',
            amount: Number(p.amount || 0),
            mode: p.mode || 'Cash',
            ref_no: p.refNo || '',
            invoice_id: p.invoiceId || '',
            linked_job_id: p.linkedJobId || '',
            remarks: p.remarks || '',
            data_json: p,
            updated_at: new Date().toISOString()
          });
        }
        break;

      case 'products':
        for (const pr of items) {
          if (!pr || !pr.id) continue;
          rows.push({
            id: String(pr.id),
            tenant_id: safeTenantId,
            code: pr.code || pr.sku || '',
            name: pr.name || 'Unnamed Product',
            category: pr.category || '',
            description: pr.description || '',
            cost_price: Number(pr.costPrice || pr.purchaseRate || 0),
            selling_price: Number(pr.sellingPrice || pr.salePrice || pr.rate || 0),
            stock_quantity: Number(pr.stockQuantity || pr.stock || 0),
            min_stock_alert: Number(pr.minStockAlert || 5),
            unit: pr.unit || 'pcs',
            location: pr.location || '',
            data_json: pr,
            updated_at: new Date().toISOString()
          });
        }
        break;

      case 'expenses':
        for (const e of items) {
          if (!e || !e.id) continue;
          rows.push({
            id: String(e.id),
            tenant_id: safeTenantId,
            category: e.category || 'General',
            amount: Number(e.amount || 0),
            payment_mode: e.paymentMode || 'Cash',
            description: e.description || '',
            paid_to: e.paidTo || '',
            date: e.date || '',
            recorded_by: e.recordedBy || '',
            data_json: e,
            updated_at: new Date().toISOString()
          });
        }
        break;

      case 'categories':
        for (const c of items) {
          if (!c || !c.id) continue;
          rows.push({
            id: String(c.id),
            tenant_id: safeTenantId,
            name: c.name || '',
            type: c.type || 'Job',
            data_json: c
          });
        }
        break;

      case 'racks':
        for (const r of items) {
          if (!r || !r.id) continue;
          rows.push({
            id: String(r.id),
            tenant_id: safeTenantId,
            name: r.name || '',
            capacity: r.capacity || '',
            location: r.location || '',
            data_json: r
          });
        }
        break;

      case 'equipments':
        for (const eq of items) {
          if (!eq || !eq.id) continue;
          rows.push({
            id: String(eq.id),
            tenant_id: safeTenantId,
            name: eq.name || '',
            data_json: eq
          });
        }
        break;

      case 'problems':
        for (const pr of items) {
          if (!pr || !pr.id) continue;
          rows.push({
            id: String(pr.id),
            tenant_id: safeTenantId,
            title: pr.title || pr.name || '',
            description: pr.description || '',
            standard_cost: Number(pr.standardCost || 0),
            data_json: pr
          });
        }
        break;

      case 'users':
        for (const u of items) {
          if (!u || !u.id) continue;
          rows.push({
            id: String(u.id),
            tenant_id: safeTenantId,
            name: u.name || '',
            username: u.username || '',
            mobile: u.mobile || '',
            email: u.email || '',
            role: u.role || 'Technician',
            status: u.status || 'Active',
            is_deactivated: u.isDeactivated ? 1 : 0,
            permissions_json: u.permissions || {},
            updated_at: new Date().toISOString()
          });
        }
        break;

      default:
        // Generic collection fallback -> Store in system_settings
        await client.from('system_settings').upsert({
          key: `${collectionName}_${safeTenantId}`,
          value: items,
          updated_at: new Date().toISOString()
        });
        return { success: true, count: items.length };
    }

    const targetTable = getSupabaseTableForCollection(collectionName);
    if (!targetTable || rows.length === 0) return { success: true, count: 0 };

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await client.from(targetTable).upsert(batch, { onConflict: 'id' });
      if (error) {
        console.warn(`[Supabase] Error upserting into ${targetTable}:`, error.message);
      }
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    console.warn(`[Supabase] syncCollectionToSupabase error on ${collectionName}:`, err);
    return { success: false, error: err?.message };
  }
}

export async function fetchCollectionFromSupabase<T = any>(
  tenantId: string,
  collectionName: string
): Promise<T[] | null> {
  const client = getSupabaseClient();
  if (!client || !tenantId) return null;

  try {
    const targetTable = getSupabaseTableForCollection(collectionName);
    if (!targetTable) return null;

    if (targetTable === 'system_settings') {
      const { data, error } = await client
        .from('system_settings')
        .select('value')
        .eq('key', `${collectionName}_${tenantId}`)
        .maybeSingle();

      if (error || !data || !Array.isArray(data.value)) return null;
      return data.value as T[];
    }

    const { data, error } = await client
      .from(targetTable)
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !data) return null;

    return data.map((row: any) => {
      if (row.data_json && typeof row.data_json === 'object') {
        return {
          ...row.data_json,
          id: row.id,
          tenantId: row.tenant_id
        } as T;
      }
      return row as T;
    });
  } catch (err) {
    console.warn(`[Supabase] fetchCollection error for ${collectionName}:`, err);
    return null;
  }
}

function getSupabaseTableForCollection(collectionName: string): string | null {
  const tableMap: Record<string, string> = {
    clients: 'clients',
    jobs: 'jobs',
    invoices: 'invoices',
    payments: 'payments',
    products: 'products',
    expenses: 'expenses',
    categories: 'categories',
    racks: 'racks',
    equipments: 'equipments',
    problems: 'problems',
    users: 'users'
  };
  return tableMap[collectionName] || 'system_settings';
}

// -------------------------------------------------------------------------
// COMPREHENSIVE LIVE DATA MIGRATION ENGINE
// -------------------------------------------------------------------------

export interface MigrationProgress {
  stage: string;
  totalStages: number;
  currentStage: number;
  message: string;
  counts: Record<string, number>;
  error?: string;
}

export async function migrateAllLiveRunningDataToSupabase(
  onProgress?: (progress: MigrationProgress) => void
): Promise<{ success: boolean; counts: Record<string, number>; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is not configured. Please enter your Supabase URL & API Key first.');
  }

  const counts: Record<string, number> = {
    organizations: 0,
    companyConfigs: 0,
    clients: 0,
    jobs: 0,
    invoices: 0,
    payments: 0,
    products: 0,
    expenses: 0,
    categories: 0,
    racks: 0,
    equipments: 0,
    problems: 0
  };

  const notify = (stage: string, currentStage: number, message: string) => {
    if (onProgress) {
      onProgress({
        stage,
        totalStages: 10,
        currentStage,
        message,
        counts: { ...counts }
      });
    }
  };

  try {
    // 1. Collect and migrate organizations
    notify('Migrating Organizations', 1, 'Gathering organizations from local storage and app state...');
    const deletedTenants = getDeletedTenantIds();
    const orgsToMigrate: any[] = [];
    const seenOrgIds = new Set<string>();

    const rawTenants = localStorage.getItem('inoms_tenants_v3') || localStorage.getItem('tenants_v3');
    if (rawTenants) {
      try {
        const parsed = JSON.parse(rawTenants);
        if (Array.isArray(parsed)) {
          for (const org of parsed) {
            if (org && org.id && !deletedTenants.has(String(org.id)) && !seenOrgIds.has(String(org.id))) {
              seenOrgIds.add(String(org.id));
              orgsToMigrate.push(org);
            }
          }
        }
      } catch (e) {}
    }

    // Include default master admin
    if (!seenOrgIds.has('org-admin')) {
      orgsToMigrate.push({
        id: 'org-admin',
        name: 'Master System Admin',
        code: 'ADMIN-00',
        ownerMobile: '+91 8149862034',
        ownerName: 'Master System Admin',
        status: 'active',
        subscriptionPlan: 'lifetime'
      });
      seenOrgIds.add('org-admin');
    }

    if (orgsToMigrate.length > 0) {
      const rows = orgsToMigrate.map(org => ({
        id: String(org.id),
        name: org.name || 'Unnamed Org',
        code: org.code || '',
        owner_mobile: org.ownerMobile || '',
        owner_name: org.ownerName || '',
        status: org.status || 'active',
        secret_key: org.secretKey || '',
        pin: org.pin || '',
        subscription_plan: org.subscriptionPlan || 'trial',
        subscription_start_date: org.subscriptionStartDate || '',
        subscription_end_date: org.subscriptionEndDate || '',
        trial_days: org.trialDays || 7,
        is_trial: org.isTrial ? 1 : 0,
        features_json: org.features || {},
        data_json: org,
        updated_at: new Date().toISOString()
      }));

      const { error } = await client.from('organizations').upsert(rows);
      if (!error) {
        counts.organizations = rows.length;
      }
    }

    // 2. Migrate Company Configs
    notify('Migrating Company Configs', 2, 'Migrating organization branding & tax settings...');
    const configRows: any[] = [];
    for (const key of Object.keys(localStorage)) {
      if (!/^(inoms_)?company_config_/.test(key)) continue;
      const tenantId = key.replace(/^(inoms_)?company_config_/, '');
      if (deletedTenants.has(tenantId)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          configRows.push({
            tenant_id: tenantId,
            name: parsed.name || '',
            phone: parsed.phone || parsed.mobile || '',
            email: parsed.email || '',
            address: parsed.address || '',
            gstin: parsed.gstin || '',
            upi_id: parsed.upiId || '',
            config_json: parsed,
            updated_at: new Date().toISOString()
          });
        }
      } catch (e) {}
    }

    if (configRows.length > 0) {
      await client.from('tenant_configs').upsert(configRows);
      counts.companyConfigs = configRows.length;
    }

    // 3. Read IndexedDB & local entity stores
    notify('Reading Database Store', 3, 'Extracting records from local database...');
    let dbRecords: any[] = [];
    try {
      const db = await getLocalDB();
      const tx = db.transaction('entities', 'readonly');
      dbRecords = await tx.objectStore('entities').getAll();
    } catch (e) {
      console.warn('[Supabase Migration] Local IndexedDB unavailable:', e);
    }

    const defaultTenantId = orgsToMigrate[0]?.id || 'org-default';

    // Helper to extract entities
    const extractEntities = (entityName: string, fallbackData: any[]): any[] => {
      const fromDb = dbRecords
        .filter(r => r && r.entity === entityName && !r.deletedAt && r.data)
        .map(r => ({ tenantId: r.tenantId || defaultTenantId, ...r.data }));

      if (fromDb.length > 0) return fromDb;
      return fallbackData.map(item => ({ tenantId: defaultTenantId, ...item }));
    };

    // 4. Migrate Clients
    notify('Migrating Clients', 4, 'Uploading client customer directories...');
    const clientsList = extractEntities('clients', INITIAL_CLIENTS);
    if (clientsList.length > 0) {
      const clientRows = clientsList.map(c => ({
        id: String(c.id),
        tenant_id: String(c.tenantId || defaultTenantId),
        name: c.name || 'Unnamed Client',
        type: c.type || 'Walk-in',
        mobile: c.mobile || '',
        phone: c.phone || '',
        email: c.email || '',
        contact_person: c.contactPerson || '',
        address: c.address || '',
        state: c.state || 'Maharashtra',
        city: c.city || '',
        gstin: c.gstin || '',
        opening_balance: Number(c.openingBalance || 0),
        outstanding_balance: Number(c.outstandingBalance || 0),
        notes: c.notes || '',
        data_json: c,
        updated_at: new Date().toISOString()
      }));

      // Batch in chunks of 50
      for (let i = 0; i < clientRows.length; i += 50) {
        await client.from('clients').upsert(clientRows.slice(i, i + 50));
      }
      counts.clients = clientRows.length;
    }

    // 5. Migrate Jobs (Inwards / Outwards)
    notify('Migrating Repair Tickets', 5, 'Uploading inward & outward repair jobs...');
    const jobsList = extractEntities('jobs', INITIAL_JOBS);
    if (jobsList.length > 0) {
      const jobRows = jobsList.map(j => ({
        id: String(j.id),
        tenant_id: String(j.tenantId || defaultTenantId),
        client_id: j.clientId || '',
        client_name: j.clientName || '',
        client_mobile: j.clientMobile || '',
        date: j.date || j.inDate || '',
        in_date: j.inDate || j.date || '',
        out_date: j.outDate || j.outwardedDate || '',
        equipment: j.equipment || '',
        product_name: j.productName || '',
        product_model: j.productModel || '',
        serial_no: j.serialNo || '',
        ram_hdd: j.ramHDD || j.ramHdd || '',
        problems: Array.isArray(j.problems) ? j.problems : [],
        problem_description: j.problemDescription || '',
        components_checklist: j.componentsChecklist || {},
        estimate_amount: Number(j.estimateAmount || 0),
        advance_amount: Number(j.advanceAmount || 0),
        final_bill_amount: Number(j.finalBillAmount || 0),
        advance_payment_mode: j.advancePaymentMode || '',
        assigned_technician: j.assignedTechnician || '',
        status: j.status || 'Received',
        payment_status: j.paymentStatus || 'Unpaid',
        repair_outcome: j.repairOutcome || '',
        rack_location: j.rackLocation || '',
        repair_type: j.repairType || 'Internal',
        service_partner_name: j.servicePartnerName || '',
        remarks: j.remarks || '',
        data_json: j,
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < jobRows.length; i += 50) {
        await client.from('jobs').upsert(jobRows.slice(i, i + 50));
      }
      counts.jobs = jobRows.length;
    }

    // 6. Migrate Invoices
    notify('Migrating Invoices', 6, 'Uploading billing invoices...');
    const invoicesList = extractEntities('invoices', INITIAL_INVOICES);
    if (invoicesList.length > 0) {
      const invoiceRows = invoicesList.map(inv => ({
        id: String(inv.id),
        tenant_id: String(inv.tenantId || defaultTenantId),
        invoice_no: inv.invoiceNo || inv.id || '',
        date: inv.date || '',
        time: inv.time || '',
        client_id: inv.clientId || '',
        client_name: inv.clientName || '',
        client_mobile: inv.clientMobile || '',
        client_address: inv.clientAddress || '',
        client_gstin: inv.clientGstin || '',
        linked_job_id: inv.linkedJobId || '',
        subtotal: Number(inv.subtotal || inv.total || 0),
        discount: Number(inv.discount || 0),
        tax: Number(inv.tax || 0),
        total: Number(inv.total || 0),
        paid_amount: Number(inv.paidAmount || 0),
        balance_due: Number(inv.balanceDue || 0),
        payment_mode: inv.paymentMode || '',
        status: inv.status || 'Unpaid',
        items: Array.isArray(inv.items) ? inv.items : [],
        data_json: inv,
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < invoiceRows.length; i += 50) {
        await client.from('invoices').upsert(invoiceRows.slice(i, i + 50));
      }
      counts.invoices = invoiceRows.length;
    }

    // 7. Migrate Payments
    notify('Migrating Payments', 7, 'Uploading receipts and payment records...');
    const paymentsList = extractEntities('payments', INITIAL_PAYMENTS);
    if (paymentsList.length > 0) {
      const paymentRows = paymentsList.map(p => ({
        id: String(p.id),
        tenant_id: String(p.tenantId || defaultTenantId),
        date: p.date || '',
        client_id: p.clientId || '',
        client_name: p.clientName || '',
        amount: Number(p.amount || 0),
        mode: p.mode || 'Cash',
        ref_no: p.refNo || '',
        invoice_id: p.invoiceId || '',
        linked_job_id: p.linkedJobId || '',
        remarks: p.remarks || '',
        data_json: p,
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < paymentRows.length; i += 50) {
        await client.from('payments').upsert(paymentRows.slice(i, i + 50));
      }
      counts.payments = paymentRows.length;
    }

    // 8. Migrate Products / Inventory
    notify('Migrating Inventory', 8, 'Uploading spare parts and products catalog...');
    const productsList = extractEntities('products', INITIAL_PRODUCTS);
    if (productsList.length > 0) {
      const productRows = productsList.map(p => ({
        id: String(p.id),
        tenant_id: String(p.tenantId || defaultTenantId),
        code: p.code || p.sku || '',
        name: p.name || 'Unnamed Product',
        category: p.category || '',
        description: p.description || '',
        cost_price: Number(p.costPrice || p.purchaseRate || 0),
        selling_price: Number(p.sellingPrice || p.salePrice || p.rate || 0),
        stock_quantity: Number(p.stockQuantity || p.stock || 0),
        min_stock_alert: Number(p.minStockAlert || 5),
        unit: p.unit || 'pcs',
        location: p.location || '',
        data_json: p,
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < productRows.length; i += 50) {
        await client.from('products').upsert(productRows.slice(i, i + 50));
      }
      counts.products = productRows.length;
    }

    // 9. Migrate Expenses
    notify('Migrating Expenses', 9, 'Uploading workshop operational expenses...');
    const expensesList = extractEntities('expenses', INITIAL_EXPENSES);
    if (expensesList.length > 0) {
      const expenseRows = expensesList.map(e => ({
        id: String(e.id),
        tenant_id: String(e.tenantId || defaultTenantId),
        category: e.category || 'General',
        amount: Number(e.amount || 0),
        payment_mode: e.paymentMode || 'Cash',
        description: e.description || '',
        paid_to: e.paidTo || '',
        date: e.date || '',
        recorded_by: e.recordedBy || '',
        data_json: e,
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < expenseRows.length; i += 50) {
        await client.from('expenses').upsert(expenseRows.slice(i, i + 50));
      }
      counts.expenses = expenseRows.length;
    }

    // 10. Migrate Configuration Dictionaries (Categories, Racks, Equipments, Problems)
    notify('Migrating Dictionaries', 10, 'Finalizing equipment categories, rack locations, and problems...');
    
    // Categories
    const categoriesList = extractEntities('categories', INITIAL_CATEGORIES);
    if (categoriesList.length > 0) {
      const catRows = categoriesList.map(c => ({
        id: String(c.id),
        tenant_id: String(c.tenantId || defaultTenantId),
        name: c.name || '',
        type: c.type || 'Job',
        data_json: c
      }));
      await client.from('categories').upsert(catRows);
      counts.categories = catRows.length;
    }

    // Racks
    const racksList = extractEntities('racks', INITIAL_RACKS);
    if (racksList.length > 0) {
      const rackRows = racksList.map(r => ({
        id: String(r.id),
        tenant_id: String(r.tenantId || defaultTenantId),
        name: r.name || '',
        capacity: r.capacity || '',
        location: r.location || '',
        data_json: r
      }));
      await client.from('racks').upsert(rackRows);
      counts.racks = rackRows.length;
    }

    // Equipments
    if (Array.isArray(EQUIPMENT_TYPES)) {
      const eqRows = EQUIPMENT_TYPES.map((name, idx) => ({
        id: `eq_${idx + 1}`,
        tenant_id: defaultTenantId,
        name: String(name),
        data_json: { name }
      }));
      await client.from('equipments').upsert(eqRows);
      counts.equipments = eqRows.length;
    }

    // Problems
    if (Array.isArray(COMMON_PROBLEMS)) {
      const probRows = COMMON_PROBLEMS.map((title, idx) => ({
        id: `prob_${idx + 1}`,
        tenant_id: defaultTenantId,
        title: String(title),
        description: '',
        standard_cost: 0,
        data_json: { title }
      }));
      await client.from('problems').upsert(probRows);
      counts.problems = probRows.length;
    }

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      success: true,
      counts,
      message: `Migration completed successfully! Total ${totalRecords} records migrated into Supabase.`
    };
  } catch (err: any) {
    console.error('[Supabase Migration] Failed:', err);
    throw new Error(`Data migration failed: ${err?.message || 'Unknown database error'}`);
  }
}
