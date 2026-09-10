/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

// Default empty entities - clean slate without demo data
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_LEDGER: ClientLedgerEntry[] = [];
export const INITIAL_JOBS: RepairJob[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_EXPENSES: Expense[] = [];

// System Administrator Account
export const MASTER_ADMIN_USER: SystemUser = {
  id: 'u1',
  tenantId: 'org-admin',
  name: 'Master System Admin',
  mobile: '8149862034',
  email: 'admin@mastersystem.com',
  username: 'scrova',
  password: '1234',
  pin: '1234',
  role: 'Admin',
  permissions: {
    dashboard: true,
    operations: true,
    accounts: true,
    setup: true,
    reports: true
  }
};

export const INITIAL_ORG_USERS: SystemUser[] = [];
export const INITIAL_USERS: SystemUser[] = [MASTER_ADMIN_USER];
export const INITIAL_LOGS: ActivityLog[] = [];

// Standard System Presets (dropdown options for ease of use)
export const EQUIPMENT_TYPES: Equipment[] = [
  { id: 'eq1', name: 'DESKTOP' },
  { id: 'eq2', name: 'LAPTOP' },
  { id: 'eq3', name: 'MOTHERBOARD' },
  { id: 'eq4', name: 'PRINTER' }
];

export const COMMON_PROBLEMS: Problem[] = [
  { id: 'pb1', name: 'HINGE BROKEN' },
  { id: 'pb2', name: 'NO DISPLAY' },
  { id: 'pb3', name: 'NO POWER ON' }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'ADAPTER' },
  { id: 'cat2', name: 'BATTERY' },
  { id: 'cat3', name: 'KEYBOARD' },
  { id: 'cat4', name: 'MOTHERBOARD' },
  { id: 'cat5', name: 'SCREEN' }
];

export const INITIAL_RACKS: LocationRack[] = [
  { id: 'r1', name: 'Rack 1' },
  { id: 'r2', name: 'Rack 2' },
  { id: 'r3', name: 'Rack 3' }
];

export const SHOP_TERMS = [
  'Subject to local jurisdiction only.',
  'Goods once sold cannot be returned back.',
  'Repair warranties are valid for 30 days from invoice date.',
  'Device unclaimed for more than 90 days will be disposed of.'
];

// Procurement & Partner Repositories
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_SERVICE_PARTNERS: ServicePartner[] = [];
export const INITIAL_PURCHASES: Purchase[] = [];
export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];
export const INITIAL_PURCHASE_RETURNS: PurchaseReturn[] = [];
export const INITIAL_SUPPLIER_PAYMENTS: SupplierPayment[] = [];
export const INITIAL_SERVICE_PARTNER_PAYMENTS: ServicePartnerPayment[] = [];
export const INITIAL_INVENTORY_SERIALS: InventorySerial[] = [];
export const INITIAL_INVENTORY_TRANSACTIONS: InventoryTransaction[] = [];
