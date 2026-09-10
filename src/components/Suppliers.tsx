import React, { useState } from 'react';
import {
  Supplier,
  Purchase,
  PurchaseReturn,
  PurchaseOrder,
  SupplierPayment,
  Product,
  SystemUser
} from '../types';
import {
  Store,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit,
  Trash2,
  DollarSign,
  TrendingUp,
  Package,
  RotateCcw,
  ShoppingCart,
  Receipt,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import SupplierDetail from './SupplierDetail';

interface SuppliersProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  purchaseReturns: PurchaseReturn[];
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  products: Product[];
  isStaff?: boolean;
  currentUser?: SystemUser | null;
  userRole?: string;
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onRecordSupplierPayment: (payment: Omit<SupplierPayment, 'id'>) => void;
  onNewPurchase: (supplierId?: string) => void;
  onNewPurchaseOrder: (supplierId?: string) => void;
  onNewPurchaseReturn: (supplierId?: string) => void;
  onNavigateToProduct?: (productId: string) => void;
}

export default function Suppliers({
  suppliers,
  purchases,
  purchaseReturns,
  purchaseOrders,
  supplierPayments,
  products,
  isStaff = false,
  currentUser,
  userRole,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onRecordSupplierPayment,
  onNewPurchase,
  onNewPurchaseOrder,
  onNewPurchaseReturn,
  onNavigateToProduct
}: SuppliersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierForDetail, setSelectedSupplierForDetail] = useState<Supplier | null>(null);

  // Add / Edit Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternateNumber, setAlternateNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setCompanyName('');
    setContactPerson('');
    setMobile('');
    setAlternateNumber('');
    setEmail('');
    setAddress('');
    setGstin('');
    setPan('');
    setOpeningBalance(0);
    setNotes('');
    setStatus('Active');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (sup: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSupplier(sup);
    setName(sup.name);
    setCompanyName(sup.companyName || '');
    setContactPerson(sup.contactPerson || '');
    setMobile(sup.mobile);
    setAlternateNumber(sup.alternateNumber || '');
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setGstin(sup.gstin || '');
    setPan(sup.pan || '');
    setOpeningBalance(sup.openingBalance || 0);
    setNotes(sup.notes || '');
    setStatus(sup.status || 'Active');
    setShowAddModal(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile) {
      alert('Please fill Supplier Name and Mobile Number');
      return;
    }

    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        name,
        companyName,
        contactPerson,
        mobile,
        alternateNumber,
        email,
        address,
        gstin,
        pan,
        openingBalance,
        notes,
        status,
        updatedAt: new Date().toISOString()
      });
    } else {
      onAddSupplier({
        name,
        companyName,
        contactPerson,
        mobile,
        alternateNumber,
        email,
        address,
        gstin,
        pan,
        openingBalance,
        notes,
        status,
        createdAt: new Date().toISOString()
      });
    }
    setShowAddModal(false);
  };

  // Financial Calculations per Supplier
  const getSupplierFinancials = (supplierId: string, opBal: number = 0) => {
    const sPurchases = purchases.filter((p) => p.supplierId === supplierId && p.status !== 'Cancelled');
    const sReturns = purchaseReturns.filter((r) => r.supplierId === supplierId && r.status !== 'Cancelled');
    const sPayments = supplierPayments.filter((sp) => sp.supplierId === supplierId);

    const totalPurchases = sPurchases.reduce((acc, p) => acc + p.grandTotal, 0);
    const totalReturns = sReturns.reduce((acc, r) => acc + r.grandTotal, 0);
    const totalPaid = sPayments.reduce((acc, sp) => acc + sp.amount, 0);
    const outstanding = Math.max(0, opBal + totalPurchases - totalReturns - totalPaid);

    return {
      totalPurchases,
      totalReturns,
      totalPaid,
      outstanding,
      purchaseCount: sPurchases.length
    };
  };

  // Filtered list
  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.companyName || '').toLowerCase().includes(term) ||
      s.mobile.includes(term) ||
      (s.gstin || '').toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term)
    );
  });

  // Global Aggregates across all suppliers
  const totalAllPurchases = purchases.filter((p) => p.status !== 'Cancelled').reduce((sum, p) => sum + p.grandTotal, 0);
  const totalAllReturns = purchaseReturns.filter((r) => r.status !== 'Cancelled').reduce((sum, r) => sum + r.grandTotal, 0);
  const totalAllPaid = supplierPayments.reduce((sum, sp) => sum + sp.amount, 0);
  const totalAllOutstanding = suppliers.reduce((sum, sup) => {
    const fin = getSupplierFinancials(sup.id, sup.openingBalance);
    return sum + fin.outstanding;
  }, 0);

  // If viewing details of a specific supplier
  if (selectedSupplierForDetail) {
    const currentSupplierObj = suppliers.find((s) => s.id === selectedSupplierForDetail.id) || selectedSupplierForDetail;
    return (
      <SupplierDetail
        supplier={currentSupplierObj}
        purchases={purchases}
        purchaseReturns={purchaseReturns}
        purchaseOrders={purchaseOrders}
        supplierPayments={supplierPayments}
        products={products}
        onBack={() => setSelectedSupplierForDetail(null)}
        onRecordPayment={onRecordSupplierPayment}
        onNewPurchase={onNewPurchase}
        onNewPurchaseOrder={onNewPurchaseOrder}
        onNewPurchaseReturn={onNewPurchaseReturn}
        onNavigateToProduct={onNavigateToProduct}
      />
    );
  }

  return (
    <div className="space-y-6" id="suppliers-management-root">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold border border-teal-100">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">
                Supplier &amp; Vendor Management
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage spare parts suppliers, purchases, returns, multi-bill payments &amp; ledger balances.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNewPurchase()}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <ShoppingCart className="w-4 h-4 text-slate-600" />
            <span>New Purchase</span>
          </button>

          {!isStaff && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Suppliers</span>
            <Store className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{suppliers.length}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Registered vendor accounts</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Purchases</span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700 font-mono">
            ₹{totalAllPurchases.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {purchases.length} lifetime bills
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Paid to Suppliers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono">
            ₹{totalAllPaid.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {supplierPayments.length} payment receipts
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Accounts Payable</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 font-mono">
            ₹{totalAllOutstanding.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-amber-700/80 font-semibold mt-0.5">Outstanding supplier dues</p>
        </div>
      </div>

      {/* Supplier List Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search & Filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by supplier, phone, GST, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="text-xs font-bold text-slate-500 font-mono">
            Showing {filteredSuppliers.length} of {suppliers.length} suppliers
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center">Action</th>
                <th className="py-3.5 px-4">Supplier Name</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">GSTIN / City</th>
                <th className="py-3.5 px-4 text-right">Total Purchases</th>
                <th className="py-3.5 px-4 text-right">Total Paid</th>
                <th className="py-3.5 px-4 text-right">Outstanding Payable</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((sup) => {
                  const fin = getSupplierFinancials(sup.id, sup.openingBalance);
                  return (
                    <tr
                      key={sup.id}
                      onClick={() => setSelectedSupplierForDetail(sup)}
                      className="hover:bg-teal-50/40 transition cursor-pointer group"
                    >
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => handleOpenEditModal(sup, e)}
                            title="Edit Supplier Details"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {!isStaff && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Are you sure you want to delete supplier "${sup.name}"?`
                                  )
                                ) {
                                  onDeleteSupplier(sup.id);
                                }
                              }}
                              title="Delete Supplier"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-teal-700 transition flex items-center gap-1.5">
                              <span>{sup.name}</span>
                              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{sup.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <p className="font-mono font-bold text-slate-800 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{sup.mobile}</span>
                          </p>
                          {sup.contactPerson && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              Attn: {sup.contactPerson}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <p className="font-mono text-slate-700 font-semibold">{sup.gstin || '—'}</p>
                          {sup.address && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[180px]" title={sup.address}>
                              {sup.address}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{fin.totalPurchases.toLocaleString('en-IN')}.00
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        ₹{fin.totalPaid.toLocaleString('en-IN')}.00
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-amber-700">
                        ₹{fin.outstanding.toLocaleString('en-IN')}.00
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            sup.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {sup.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 italic">
                    No suppliers found matching "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingSupplier ? `Edit Supplier (${editingSupplier.id})` : 'Add New Parts Supplier'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Register supplier details for purchasing, GST tracking and ledger statements.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier / Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABC Computers & Peripherals"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Company / Trade Legal Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABC Technologies Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Anil Sharma"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Primary Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9820011223"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alternate Phone / Landline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 022-28765432"
                    value={alternateNumber}
                    onChange={(e) => setAlternateNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="sales@supplier.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27AABCU9603R1ZM"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AABCU9603R"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Address &amp; Shop Location
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Shop/Office No, Street, Landmark, City, Pincode"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Specialization / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Primary source for screens & keyboards. 6 months warranty."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  {editingSupplier ? 'Save Supplier Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
