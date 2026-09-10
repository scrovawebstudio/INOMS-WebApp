/**
 * INOMS Google Drive Distributed Multi-Device Merge & Conflict Resolution Engine
 * 
 * Provides:
 * 1. Normalized parsing of snapshots (supporting both root and data-nested structures,
 *    and both camelCase and snake_case entity names).
 * 2. CRDT-inspired union-by-ID merge with timestamp-based conflict resolution.
 * 3. Zero-data safety guard: prevents empty/newly initialized devices from wiping cloud records.
 */

import { RepairJob } from '../types';

export interface NormalizedOrganizationData {
  clients: any[];
  ledger: any[];
  jobs: any[];
  payments: any[];
  invoices: any[];
  products: any[];
  expenses: any[];
  users: any[];
  logs: any[];
  categories: any[];
  racks: any[];
  equipments: any[];
  problems: any[];
  suppliers: any[];
  servicePartners: any[];
  purchases: any[];
  purchaseOrders: any[];
  purchaseReturns: any[];
  supplierPayments: any[];
  servicePartnerPayments: any[];
  inventorySerials: any[];
  inventoryTransactions: any[];
  companyConfig?: any;
}

/**
 * Extract timestamp from an item safely
 */
export function getItemTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const val = item.updatedAt || item.modifiedAt || item.updated_at || item.createdAt || item.date || item.inwardDate || item.timestamp;
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize any snapshot or backup payload into a standard structured bundle
 */
export function normalizeSnapshotData(raw: any): NormalizedOrganizationData {
  if (!raw) {
    return {
      clients: [], ledger: [], jobs: [], payments: [], invoices: [], products: [], expenses: [],
      users: [], logs: [], categories: [], racks: [], equipments: [], problems: [], suppliers: [],
      servicePartners: [], purchases: [], purchaseOrders: [], purchaseReturns: [],
      supplierPayments: [], servicePartnerPayments: [], inventorySerials: [], inventoryTransactions: []
    };
  }

  const data = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) ? raw.data : raw;

  return {
    clients: Array.isArray(data.clients) ? data.clients : [],
    ledger: Array.isArray(data.ledger) ? data.ledger : [],
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    payments: Array.isArray(data.payments) ? data.payments : [],
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    products: Array.isArray(data.products) ? data.products : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    users: Array.isArray(data.users) ? data.users : [],
    logs: Array.isArray(data.logs) ? data.logs : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    racks: Array.isArray(data.racks) ? data.racks : [],
    equipments: Array.isArray(data.equipments) ? data.equipments : [],
    problems: Array.isArray(data.problems) ? data.problems : [],
    suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
    servicePartners: Array.isArray(data.servicePartners)
      ? data.servicePartners
      : Array.isArray(data.service_partners)
      ? data.service_partners
      : [],
    purchases: Array.isArray(data.purchases) ? data.purchases : [],
    purchaseOrders: Array.isArray(data.purchaseOrders)
      ? data.purchaseOrders
      : Array.isArray(data.purchase_orders)
      ? data.purchase_orders
      : [],
    purchaseReturns: Array.isArray(data.purchaseReturns)
      ? data.purchaseReturns
      : Array.isArray(data.purchase_returns)
      ? data.purchase_returns
      : [],
    supplierPayments: Array.isArray(data.supplierPayments)
      ? data.supplierPayments
      : Array.isArray(data.supplier_payments)
      ? data.supplier_payments
      : [],
    servicePartnerPayments: Array.isArray(data.servicePartnerPayments)
      ? data.servicePartnerPayments
      : Array.isArray(data.service_partner_payments)
      ? data.service_partner_payments
      : [],
    inventorySerials: Array.isArray(data.inventorySerials)
      ? data.inventorySerials
      : Array.isArray(data.inventory_serials)
      ? data.inventory_serials
      : [],
    inventoryTransactions: Array.isArray(data.inventoryTransactions)
      ? data.inventoryTransactions
      : Array.isArray(data.inventory_transactions)
      ? data.inventory_transactions
      : [],
    companyConfig: data.companyConfig && typeof data.companyConfig === 'object' ? data.companyConfig : undefined
  };
}

/**
 * Merge two arrays of items by ID with timestamp conflict resolution
 */
export function mergeCollectionItems<T extends { id?: string | number }>(
  cloudItems: T[] = [],
  localItems: T[] = []
): T[] {
  const safeCloud = Array.isArray(cloudItems) ? cloudItems : [];
  const safeLocal = Array.isArray(localItems) ? localItems : [];

  if (safeCloud.length === 0) return safeLocal;
  if (safeLocal.length === 0) return safeCloud;

  const map = new Map<string | number, T>();

  // 1. Seed with cloud items
  safeCloud.forEach((item) => {
    if (item && item.id !== undefined && item.id !== null) {
      map.set(item.id, item);
    }
  });

  // 2. Union with local items
  safeLocal.forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    if (!map.has(item.id)) {
      // Local item not in cloud yet -> preserve it!
      map.set(item.id, item);
    } else {
      // Item exists in both: compare timestamps
      const cloudItem = map.get(item.id)!;
      const cloudTime = getItemTimestamp(cloudItem);
      const localTime = getItemTimestamp(item);

      // If local is equal or newer, take local
      if (localTime >= cloudTime) {
        map.set(item.id, item);
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Sort repair jobs with newest first
 */
function sortJobs(jobsList: any[]): any[] {
  return [...jobsList].sort((a, b) => {
    const timeA = getItemTimestamp(a);
    const timeB = getItemTimestamp(b);
    return timeB - timeA;
  });
}

/**
 * Full multi-device merge of cloud and local organizational data
 */
export function mergeOrganizationData(
  cloudRaw: any,
  localRaw: any
): { merged: NormalizedOrganizationData; changesFound: boolean; isCloudAuthoritative: boolean } {
  const cloud = normalizeSnapshotData(cloudRaw);
  const local = normalizeSnapshotData(localRaw);

  const countAllRecords = (d: NormalizedOrganizationData) =>
    d.jobs.length +
    d.clients.length +
    d.invoices.length +
    d.payments.length +
    d.products.length +
    d.expenses.length +
    d.ledger.length +
    d.users.length +
    d.categories.length +
    d.racks.length +
    d.equipments.length +
    d.problems.length +
    d.suppliers.length +
    d.servicePartners.length +
    d.purchases.length +
    d.purchaseOrders.length +
    d.purchaseReturns.length +
    d.supplierPayments.length +
    d.servicePartnerPayments.length +
    d.inventorySerials.length +
    d.inventoryTransactions.length;

  const cloudRecordCount = countAllRecords(cloud);
  const localRecordCount = countAllRecords(local);

  // Zero-Data Safety Guard: If local device is completely empty, cloud is 100% authoritative
  if (localRecordCount === 0 && cloudRecordCount > 0) {
    return {
      merged: cloud,
      changesFound: true,
      isCloudAuthoritative: true
    };
  }

  // If cloud is empty, local is 100% authoritative
  if (cloudRecordCount === 0 && localRecordCount > 0) {
    return {
      merged: local,
      changesFound: false,
      isCloudAuthoritative: false
    };
  }

  const mergedJobs = sortJobs(mergeCollectionItems(cloud.jobs, local.jobs));
  const mergedClients = mergeCollectionItems(cloud.clients, local.clients);
  const mergedInvoices = mergeCollectionItems(cloud.invoices, local.invoices);
  const mergedPayments = mergeCollectionItems(cloud.payments, local.payments);
  const mergedProducts = mergeCollectionItems(cloud.products, local.products);
  const mergedExpenses = mergeCollectionItems(cloud.expenses, local.expenses);
  const mergedLedger = mergeCollectionItems(cloud.ledger, local.ledger);
  const mergedUsers = mergeCollectionItems(cloud.users, local.users);
  const mergedLogs = mergeCollectionItems(cloud.logs, local.logs);
  const mergedCategories = mergeCollectionItems(cloud.categories, local.categories);
  const mergedRacks = mergeCollectionItems(cloud.racks, local.racks);
  const mergedEquipments = mergeCollectionItems(cloud.equipments, local.equipments);
  const mergedProblems = mergeCollectionItems(cloud.problems, local.problems);
  const mergedSuppliers = mergeCollectionItems(cloud.suppliers, local.suppliers);
  const mergedServicePartners = mergeCollectionItems(cloud.servicePartners, local.servicePartners);
  const mergedPurchases = mergeCollectionItems(cloud.purchases, local.purchases);
  const mergedPurchaseOrders = mergeCollectionItems(cloud.purchaseOrders, local.purchaseOrders);
  const mergedPurchaseReturns = mergeCollectionItems(cloud.purchaseReturns, local.purchaseReturns);
  const mergedSupplierPayments = mergeCollectionItems(cloud.supplierPayments, local.supplierPayments);
  const mergedServicePartnerPayments = mergeCollectionItems(cloud.servicePartnerPayments, local.servicePartnerPayments);
  const mergedInventorySerials = mergeCollectionItems(cloud.inventorySerials, local.inventorySerials);
  const mergedInventoryTransactions = mergeCollectionItems(cloud.inventoryTransactions, local.inventoryTransactions);

  const mergedConfig = {
    ...(cloud.companyConfig || {}),
    ...(local.companyConfig || {})
  };

  const totalMergedCount =
    mergedJobs.length +
    mergedClients.length +
    mergedInvoices.length +
    mergedPayments.length +
    mergedProducts.length +
    mergedExpenses.length +
    mergedLedger.length +
    mergedUsers.length +
    mergedCategories.length +
    mergedRacks.length +
    mergedEquipments.length +
    mergedProblems.length +
    mergedSuppliers.length +
    mergedServicePartners.length +
    mergedPurchases.length +
    mergedPurchaseOrders.length +
    mergedPurchaseReturns.length +
    mergedSupplierPayments.length +
    mergedServicePartnerPayments.length +
    mergedInventorySerials.length +
    mergedInventoryTransactions.length;

  const changesFound = totalMergedCount !== localRecordCount || totalMergedCount !== cloudRecordCount;

  return {
    merged: {
      clients: mergedClients,
      ledger: mergedLedger,
      jobs: mergedJobs,
      payments: mergedPayments,
      invoices: mergedInvoices,
      products: mergedProducts,
      expenses: mergedExpenses,
      users: mergedUsers,
      logs: mergedLogs,
      categories: mergedCategories,
      racks: mergedRacks,
      equipments: mergedEquipments,
      problems: mergedProblems,
      suppliers: mergedSuppliers,
      servicePartners: mergedServicePartners,
      purchases: mergedPurchases,
      purchaseOrders: mergedPurchaseOrders,
      purchaseReturns: mergedPurchaseReturns,
      supplierPayments: mergedSupplierPayments,
      servicePartnerPayments: mergedServicePartnerPayments,
      inventorySerials: mergedInventorySerials,
      inventoryTransactions: mergedInventoryTransactions,
      companyConfig: mergedConfig
    },
    changesFound,
    isCloudAuthoritative: false
  };
}
