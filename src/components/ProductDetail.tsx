import React, { useState } from 'react';
import {
  Product,
  Supplier,
  Purchase,
  PurchaseReturn,
  InventorySerial,
  InventoryTransaction,
  RepairJob
} from '../types';
import {
  ArrowLeft,
  Package,
  Store,
  MapPin,
  Tag,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  History,
  Barcode,
  ShoppingCart,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  Plus,
  Filter,
  Wrench
} from 'lucide-react';

interface ProductDetailProps {
  product: Product;
  suppliers: Supplier[];
  purchases: Purchase[];
  purchaseReturns: PurchaseReturn[];
  inventorySerials: InventorySerial[];
  inventoryTransactions: InventoryTransaction[];
  jobs: RepairJob[];
  onBack: () => void;
  onNavigateToSupplier?: (supplierId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function ProductDetail({
  product,
  suppliers,
  purchases,
  purchaseReturns,
  inventorySerials,
  inventoryTransactions,
  jobs,
  onBack,
  onNavigateToSupplier,
  onNavigateToJob
}: ProductDetailProps) {
  const [activeTab, setActiveTab] = useState<'serials' | 'history' | 'purchases' | 'jobUsage'>('serials');
  const [serialSearch, setSerialSearch] = useState('');

  // Find supplier
  const supplierObj = suppliers.find(
    (s) =>
      s.id === product.supplierId ||
      (product.vendorName && s.name.toLowerCase() === product.vendorName.toLowerCase())
  );

  // Filter serial numbers registered for this product
  const productSerials = inventorySerials.filter((s) => s.productId === product.id);
  const filteredSerials = productSerials.filter(
    (s) =>
      s.serialNumber.toLowerCase().includes(serialSearch.toLowerCase()) ||
      (s.assignedJobId || '').toLowerCase().includes(serialSearch.toLowerCase()) ||
      s.currentStatus.toLowerCase().includes(serialSearch.toLowerCase())
  );

  // Filter transactions
  const productTx = inventoryTransactions.filter((tx) => tx.productId === product.id);

  // Filter purchases that contained this product
  const productPurchases = purchases.filter((pur) =>
    pur.items.some((it) => it.productId === product.id)
  );

  // Jobs that used this spare part
  const jobsUsingPart = jobs.filter((j) =>
    j.partsUsed && j.partsUsed.some((pt) => pt.productId === product.id || pt.productName.toLowerCase() === product.name.toLowerCase())
  );

  const totalInwardQty = productPurchases.reduce((sum, pur) => {
    const item = pur.items.find((it) => it.productId === product.id);
    return sum + (item ? item.qty : 0);
  }, 0);

  const totalStockValue = product.stock * (product.purchasePrice || 0);

  return (
    <div className="space-y-6 animate-fade-in" id="product-detail-view">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
            title="Back to Inventory"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                {product.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wider">
                {product.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
              <span className="font-mono text-slate-600 font-bold">{product.id}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> Rack: {product.location}
              </span>
              {product.hsnCode && (
                <>
                  <span>•</span>
                  <span className="font-mono text-slate-600">HSN: {product.hsnCode}</span>
                </>
              )}
              {product.serialNo && (
                <>
                  <span>•</span>
                  <span className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                    SN: {product.serialNo}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {supplierObj && (
            <button
              onClick={() => onNavigateToSupplier && onNavigateToSupplier(supplierObj.id)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <Store className="w-3.5 h-3.5 text-teal-600" />
              <span>Supplier: {supplierObj.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Product Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available Stock</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {product.stock} <span className="text-xs font-semibold text-slate-400">units</span>
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            Min alert threshold: {product.minQtyAlert}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Purchase Price</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700 font-mono">
            ₹{(product.purchasePrice || 0).toLocaleString('en-IN')}.00
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Average buy cost</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Customer Selling Rate</span>
            <Tag className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono">
            ₹{product.price.toLocaleString('en-IN')}.00
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Retail billing price</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/30 shadow-xs">
          <div className="flex items-center justify-between text-purple-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total In Stock Value</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-700 font-mono">
            ₹{totalStockValue.toLocaleString('en-IN')}.00
          </p>
          <p className="text-[10px] text-purple-700/80 font-semibold mt-0.5">Valuation at cost</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'serials', label: `Tracked Serial Numbers (${productSerials.length})`, icon: Barcode },
          { id: 'history', label: `Stock In/Out Movements (${productTx.length})`, icon: History },
          { id: 'purchases', label: `Purchase Bills (${productPurchases.length})`, icon: ShoppingCart },
          { id: 'jobUsage', label: `Job Card Usage (${jobsUsingPart.length})`, icon: Wrench }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

      {/* Tab 1: Serial Numbers */}
      {activeTab === 'serials' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search serial number, status, Job ID..."
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {filteredSerials.length} serials listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Purchase Bill</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Assigned Job Card</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSerials.length > 0 ? (
                  filteredSerials.map((ser) => (
                    <tr key={ser.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-black text-slate-900 flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-teal-600" />
                        <span>{ser.serialNumber}</span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {ser.supplierName || '—'}
                      </td>

                      <td className="py-3 px-4 font-mono text-blue-600">
                        {ser.purchaseId || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            ser.currentStatus === 'In Stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ser.currentStatus === 'Used in Repair'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : ser.currentStatus === 'Returned to Supplier'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ser.currentStatus}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {ser.assignedJobId ? (
                          <button
                            onClick={() => onNavigateToJob && onNavigateToJob(ser.assignedJobId!)}
                            className="font-mono font-black text-teal-700 hover:underline cursor-pointer"
                          >
                            {ser.assignedJobId}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">{ser.currentLocation || product.location}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{ser.updatedAt}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      No serial numbers logged for this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Stock In/Out Movements */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" /> Stock Movement Log
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Direction</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Party / Vendor</th>
                  <th className="py-3 px-4">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {productTx.length > 0 ? (
                  productTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-slate-600">{tx.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{tx.type}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${
                            tx.direction === 'IN'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {tx.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-slate-900">
                        {tx.quantity}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-600">{tx.referenceId}</td>
                      <td className="py-3 px-4 text-slate-700">{tx.supplierOrPartner || '—'}</td>
                      <td className="py-3 px-4 text-slate-500">{tx.user || 'System'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      No stock movement transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Purchases Containing this product */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" /> Inward Purchase Invoices
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Purchase ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Purchased Qty</th>
                  <th className="py-3 px-4 text-right">Unit Rate</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {productPurchases.length > 0 ? (
                  productPurchases.map((pur) => {
                    const item = pur.items.find((it) => it.productId === product.id);
                    if (!item) return null;

                    return (
                      <tr key={pur.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-black text-slate-900">{pur.id}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{pur.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{pur.supplierName}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {item.qty}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                          ₹{item.rate.toLocaleString('en-IN')}.00
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          ₹{item.total.toLocaleString('en-IN')}.00
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                      No purchase records for this item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Jobs using this part */}
      {activeTab === 'jobUsage' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-purple-600" /> Job Cards where Part was Fitted
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Job No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Device Model</th>
                  <th className="py-3 px-4 text-center">Qty Consumed</th>
                  <th className="py-3 px-4 text-right">Part Charge to Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {jobsUsingPart.length > 0 ? (
                  jobsUsingPart.map((job) => {
                    const pt = job.partsUsed?.find(
                      (p) => p.productId === product.id || p.productName.toLowerCase() === product.name.toLowerCase()
                    );

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-black text-teal-700">
                          <button
                            onClick={() => onNavigateToJob && onNavigateToJob(job.id)}
                            className="hover:underline cursor-pointer"
                          >
                            {job.id}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{job.clientName}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {job.brand} {job.model}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{pt?.qty || 1}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          ₹{((pt?.unitPrice || product.price) * (pt?.qty || 1)).toLocaleString('en-IN')}.00
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 italic">
                      No repair jobs have consumed this spare part yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
