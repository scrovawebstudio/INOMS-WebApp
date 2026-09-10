import React, { useState } from 'react';
import {
  Supplier,
  Purchase,
  PurchaseReturn,
  PurchaseOrder,
  SupplierPayment,
  Product
} from '../types';
import {
  ArrowLeft,
  Store,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  Package,
  RotateCcw,
  ShoppingCart,
  Receipt,
  Plus,
  CreditCard,
  CheckCircle2,
  Calendar,
  Layers,
  AlertCircle
} from 'lucide-react';

interface SupplierDetailProps {
  supplier: Supplier;
  purchases: Purchase[];
  purchaseReturns: PurchaseReturn[];
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  products: Product[];
  onBack: () => void;
  onRecordPayment: (payment: Omit<SupplierPayment, 'id'>) => void;
  onNewPurchase: (supplierId: string) => void;
  onNewPurchaseOrder: (supplierId: string) => void;
  onNewPurchaseReturn: (supplierId: string) => void;
  onNavigateToProduct?: (productId: string) => void;
}

export default function SupplierDetail({
  supplier,
  purchases,
  purchaseReturns,
  purchaseOrders,
  supplierPayments,
  products,
  onBack,
  onRecordPayment,
  onNewPurchase,
  onNewPurchaseOrder,
  onNewPurchaseReturn,
  onNavigateToProduct
}: SupplierDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'products' | 'purchases' | 'returns' | 'orders' | 'payments'
  >('overview');

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Filter items specifically for this supplier
  const supplierPurchases = purchases.filter(
    (p) => p.supplierId === supplier.id && p.status !== 'Cancelled'
  );
  const supplierReturns = purchaseReturns.filter(
    (r) => r.supplierId === supplier.id && r.status !== 'Cancelled'
  );
  const supplierPOs = purchaseOrders.filter((po) => po.supplierId === supplier.id);
  const supplierPays = supplierPayments.filter((sp) => sp.supplierId === supplier.id);

  // Financial aggregates
  const totalPurchases = supplierPurchases.reduce((sum, p) => sum + p.grandTotal, 0);
  const totalReturns = supplierReturns.reduce((sum, r) => sum + r.grandTotal, 0);
  const totalPaid = supplierPays.reduce((sum, sp) => sum + sp.amount, 0);
  const outstandingPayable = Math.max(
    0,
    (supplier.openingBalance || 0) + totalPurchases - totalReturns - totalPaid
  );

  // Products sourced from this supplier (via purchases or default supplier)
  const productSourceMap = new Map<
    string,
    {
      product: Product;
      totalPurchasedQty: number;
      totalReturnedQty: number;
      lastPurchaseRate: number;
      lastPurchaseDate: string;
    }
  >();

  supplierPurchases.forEach((pur) => {
    const items = Array.isArray(pur.items) ? pur.items : [];
    items.forEach((item) => {
      const pid = item.productId || item.productName || 'unknown';
      const existing = productSourceMap.get(pid);
      const prod = products.find((p) => p.id === item.productId) || {
        id: pid,
        name: item.productName || 'Unnamed Product',
        category: (item as any).category || 'Spares',
        location: 'Main Store',
        hsnCode: '',
        price: (Number(item.rate) || 0) * 1.3,
        stock: 0,
        minQtyAlert: 2
      };

      const itemQty = Number(item.qty || (item as any).quantity) || 1;
      const itemRate = Number(item.rate ?? (item as any).unitCost ?? 0);

      if (!existing) {
        productSourceMap.set(pid, {
          product: prod,
          totalPurchasedQty: itemQty,
          totalReturnedQty: 0,
          lastPurchaseRate: itemRate,
          lastPurchaseDate: pur.date || ''
        });
      } else {
        existing.totalPurchasedQty += itemQty;
        if ((pur.date || '') >= existing.lastPurchaseDate) {
          existing.lastPurchaseRate = itemRate;
          existing.lastPurchaseDate = pur.date || '';
        }
      }
    });
  });

  supplierReturns.forEach((ret) => {
    const items = Array.isArray(ret.items) ? ret.items : [];
    items.forEach((item) => {
      const pid = item.productId || item.productName || 'unknown';
      const existing = productSourceMap.get(pid);
      if (existing) {
        existing.totalReturnedQty += Number(item.qty || (item as any).quantity) || 0;
      }
    });
  });

  const suppliedProductsList = Array.from(productSourceMap.values());

  // Lump-sum Multi-bill Payment state
  const [payAmount, setPayAmount] = useState<number>(outstandingPayable);
  const [payMode, setPayMode] = useState<'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque'>('UPI');
  const [payRefNo, setPayRefNo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>(() =>
    supplierPurchases.filter((p) => (p.balanceAmount || p.grandTotal) > 0).map((p) => p.id)
  );

  const toggleSelectPurchase = (pId: string) => {
    setSelectedPurchaseIds((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    );
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }

    // Auto allocate payment sequentially among selected outstanding purchases
    let remainingToAllocate = payAmount;
    const allocations: { purchaseId: string; purchaseNumber: string; allocatedAmount: number }[] = [];

    supplierPurchases
      .filter((p) => selectedPurchaseIds.includes(p.id))
      .forEach((p) => {
        const purchaseOutstanding = p.balanceAmount !== undefined ? p.balanceAmount : p.grandTotal;
        if (remainingToAllocate > 0 && purchaseOutstanding > 0) {
          const allocationForThis = Math.min(remainingToAllocate, purchaseOutstanding);
          allocations.push({
            purchaseId: p.id,
            purchaseNumber: p.id,
            allocatedAmount: allocationForThis
          });
          remainingToAllocate -= allocationForThis;
        }
      });

    onRecordPayment({
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: new Date().toISOString().split('T')[0],
      amount: payAmount,
      paymentMode: payMode,
      referenceNo: payRefNo,
      notes: payNotes,
      allocations,
      unallocatedAmount: remainingToAllocate > 0 ? remainingToAllocate : 0,
      createdAt: new Date().toISOString()
    });

    setShowPaymentModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="supplier-detail-view">
      {/* Top Header with Back Button and Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
            title="Back to Suppliers List"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                {supplier.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  supplier.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {supplier.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
              <span>{supplier.companyName || 'Supplier Profile'}</span>
              <span>•</span>
              <span className="font-mono font-bold text-slate-600">{supplier.id}</span>
              {supplier.gstin && (
                <>
                  <span>•</span>
                  <span className="font-mono text-slate-600">GST: {supplier.gstin}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setPayAmount(outstandingPayable);
              setShowPaymentModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <CreditCard className="w-4 h-4" />
            <span>Make Payment</span>
          </button>

          <button
            onClick={() => onNewPurchase(supplier.id)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>New Purchase</span>
          </button>

          <button
            onClick={() => onNewPurchaseReturn(supplier.id)}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Purchase Return</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Purchases</span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            ₹{totalPurchases.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {supplierPurchases.length} invoices recorded
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Purchase Returns</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
            ₹{totalReturns.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {supplierReturns.length} return transactions
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            ₹{totalPaid.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {supplierPays.length} payment receipts
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Outstanding Payable</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
            ₹{outstandingPayable.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-amber-700/80 font-semibold mt-1">
            {outstandingPayable === 0 ? '✓ Fully Settled' : 'Payable to Supplier'}
          </p>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Overview & Contacts', icon: Store },
          { id: 'products', label: `Supplied Products (${suppliedProductsList.length})`, icon: Package },
          { id: 'purchases', label: `Purchase History (${supplierPurchases.length})`, icon: ShoppingCart },
          { id: 'returns', label: `Purchase Returns (${supplierReturns.length})`, icon: RotateCcw },
          { id: 'orders', label: `Purchase Orders (${supplierPOs.length})`, icon: FileText },
          { id: 'payments', label: `Payments & Allocations (${supplierPays.length})`, icon: DollarSign }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-black transition flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Contact Info */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
              <Store className="w-4 h-4 text-teal-600" /> Supplier Profile &amp; Contact
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Contact Person</span>
                <span className="font-bold text-slate-800">{supplier.contactPerson || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Mobile Number</span>
                <span className="font-mono font-bold text-teal-700 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-teal-600" /> {supplier.mobile}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Alternate Number</span>
                <span className="font-mono text-slate-600">{supplier.alternateNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Email</span>
                <span className="text-slate-600 font-medium truncate block">{supplier.email || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Registered Address</span>
                <span className="text-slate-700 font-medium flex items-start gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  {supplier.address || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" /> Tax &amp; Opening Balances
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">GSTIN</span>
                <span className="font-mono font-black text-slate-800">{supplier.gstin || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">PAN</span>
                <span className="font-mono font-black text-slate-800">{supplier.pan || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Opening Balance</span>
                <span className="font-mono font-bold text-slate-700">
                  ₹{(supplier.openingBalance || 0).toLocaleString('en-IN')}.00
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Distinct Parts Supplied</span>
                <span className="font-mono font-black text-purple-700">{suppliedProductsList.length} items</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Internal Notes</span>
                <p className="text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                  {supplier.notes || 'No specific supplier notes registered.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Products Purchased from Supplier */}
      {activeSubTab === 'products' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-teal-600" /> Products Supplied by {supplier.name}
            </h3>
            <span className="text-xs font-bold text-slate-500 font-mono">
              {suppliedProductsList.length} parts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Total Purchased</th>
                  <th className="py-3 px-4 text-center">Total Returned</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-right">Last Purchase Rate</th>
                  <th className="py-3 px-4 text-right">Last Purchased Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {suppliedProductsList.length > 0 ? (
                  suppliedProductsList.map(({ product, totalPurchasedQty, totalReturnedQty, lastPurchaseRate, lastPurchaseDate }) => (
                    <tr key={product.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigateToProduct && onNavigateToProduct(product.id)}
                          className="font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer text-left"
                        >
                          {product.name}
                        </button>
                        <p className="text-[10px] text-slate-400 font-mono">{product.id}</p>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{product.category}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {totalPurchasedQty}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                        {totalReturnedQty}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                        ₹{lastPurchaseRate.toLocaleString('en-IN')}.00
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {lastPurchaseDate || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      No products purchased from this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Purchases History */}
      {activeSubTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" /> Purchase Invoices
            </h3>
            <button
              onClick={() => onNewPurchase(supplier.id)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Purchase</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Purchase No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier Bill Ref</th>
                  <th className="py-3 px-4">Items / Products</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {supplierPurchases.length > 0 ? (
                  supplierPurchases.map((pur) => {
                    const paid = pur.paidAmount || 0;
                    const balance = pur.balanceAmount !== undefined ? pur.balanceAmount : Math.max(0, pur.grandTotal - paid);
                    const status = balance === 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid';

                    return (
                      <tr key={pur.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-black text-slate-900">{pur.id}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{pur.date}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{pur.referenceNumber || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {pur.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700">
                                <span className="font-bold">{it.productName}</span> × {it.qty} @ ₹{it.rate}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          ₹{pur.grandTotal.toLocaleString('en-IN')}.00
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          ₹{paid.toLocaleString('en-IN')}.00
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          ₹{balance.toLocaleString('en-IN')}.00
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : status === 'Partially Paid'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                      No purchases logged for this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Purchase Returns */}
      {activeSubTab === 'returns' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" /> Purchase Returns to {supplier.name}
            </h3>
            <button
              onClick={() => onNewPurchaseReturn(supplier.id)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Return</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Return No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Original Purchase</th>
                  <th className="py-3 px-4">Returned Items</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Debit Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {supplierReturns.length > 0 ? (
                  supplierReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{ret.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{ret.date}</td>
                      <td className="py-3 px-4 font-mono text-blue-600">{ret.purchaseNumber || ret.purchaseId || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="text-[11px] text-slate-700">
                              <span className="font-bold">{it.productName}</span> × {it.qty}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 italic">{ret.reason}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                        ₹{ret.grandTotal.toLocaleString('en-IN')}.00
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase">
                          {ret.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      No purchase returns recorded for this supplier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Purchase Orders */}
      {activeSubTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" /> Purchase Orders (PO)
            </h3>
            <button
              onClick={() => onNewPurchaseOrder(supplier.id)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate PO</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Estimated Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {supplierPOs.length > 0 ? (
                  supplierPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{po.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{po.date}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{po.expectedDeliveryDate || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="text-[11px] text-slate-700">
                              <span className="font-bold">{it.productName}</span> × {it.qty}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        ₹{po.grandTotal.toLocaleString('en-IN')}.00
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            po.status === 'Received'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : po.status === 'Ordered'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                      No purchase orders raised with this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Payments & Allocations */}
      {activeSubTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Payment Receipts &amp; Bill Allocations
            </h3>
            <button
              onClick={() => {
                setPayAmount(outstandingPayable);
                setShowPaymentModal(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Ref / Transaction No</th>
                  <th className="py-3 px-4">Allocated Purchases</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Unallocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {supplierPays.length > 0 ? (
                  supplierPays.map((sp) => (
                    <tr key={sp.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{sp.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{sp.date}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{sp.paymentMode}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{sp.referenceNo || '—'}</td>
                      <td className="py-3 px-4">
                        {sp.allocations && sp.allocations.length > 0 ? (
                          <div className="space-y-0.5">
                            {sp.allocations.map((alloc, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700">
                                <span className="font-mono font-bold text-blue-600">{alloc.purchaseNumber}</span>: ₹
                                {alloc.allocatedAmount.toLocaleString('en-IN')}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Direct lump-sum</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                        ₹{sp.amount.toLocaleString('en-IN')}.00
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {sp.unallocatedAmount ? `₹${sp.unallocatedAmount.toLocaleString('en-IN')}.00` : '₹0.00'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      No payments made to this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lump-Sum Multi-Purchase Payment Modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPaymentModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Record Payment to {supplier.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Support lump-sum payments allocated across multiple outstanding purchases.
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Transaction / Cheque / UTR Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-884920491 or Cheque #102938"
                  value={payRefNo}
                  onChange={(e) => setPayRefNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              {/* Multi-Bill Selection & Auto Allocation Section */}
              <div className="space-y-2 border rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Allocate across Outstanding Purchases:</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Selected: {selectedPurchaseIds.length} bills
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {supplierPurchases.filter((p) => (p.balanceAmount || p.grandTotal) > 0).length > 0 ? (
                    supplierPurchases
                      .filter((p) => (p.balanceAmount || p.grandTotal) > 0)
                      .map((pur) => {
                        const bal = pur.balanceAmount !== undefined ? pur.balanceAmount : pur.grandTotal;
                        const isSelected = selectedPurchaseIds.includes(pur.id);
                        return (
                          <label
                            key={pur.id}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                              isSelected
                                ? 'bg-white border-emerald-400 shadow-xs'
                                : 'bg-slate-100 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPurchase(pur.id)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <span className="font-mono font-bold text-slate-800">{pur.id}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({pur.date})</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-black text-amber-700">₹{bal.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-400 block">Total: ₹{pur.grandTotal.toLocaleString('en-IN')}</span>
                            </div>
                          </label>
                        );
                      })
                  ) : (
                    <p className="text-center text-xs text-slate-400 py-3 italic">
                      No unpaid purchases. This payment will be logged as an advance / credit balance.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional notes or instructions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  Confirm &amp; Allocate Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
