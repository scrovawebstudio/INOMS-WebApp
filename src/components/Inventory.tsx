/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Database,
  Layers,
  MapPin,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Store,
  Tag,
  DollarSign,
  ShoppingBag,
  Barcode,
  Eye
} from 'lucide-react';
import {
  Product,
  Category,
  LocationRack,
  SystemUser,
  Supplier,
  Purchase,
  PurchaseReturn,
  InventorySerial,
  InventoryTransaction,
  RepairJob
} from '../types';
import ProductDetail from './ProductDetail';

interface InventoryProps {
  products: Product[];
  categories: Category[];
  racks: LocationRack[];
  suppliers?: Supplier[];
  purchases?: Purchase[];
  purchaseReturns?: PurchaseReturn[];
  inventorySerials?: InventorySerial[];
  inventoryTransactions?: InventoryTransaction[];
  jobs?: RepairJob[];
  isStaff?: boolean;
  currentUser?: SystemUser | null;
  userRole?: string;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory?: (id: string) => void;
  onAddRack: (name: string) => void;
  onDeleteRack?: (id: string) => void;
  onNavigateToSupplier?: (supplierId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function Inventory({
  products,
  categories,
  racks,
  suppliers = [],
  purchases = [],
  purchaseReturns = [],
  inventorySerials = [],
  inventoryTransactions = [],
  jobs = [],
  isStaff = false,
  currentUser,
  userRole,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onAddCategory,
  onDeleteCategory,
  onAddRack,
  onDeleteRack,
  onNavigateToSupplier,
  onNavigateToJob
}: InventoryProps) {
  const isAdmin = userRole === 'Admin' || currentUser?.role === 'Admin';
  const canEditInventory =
    isAdmin ||
    currentUser?.permissions?.inventoryEditStock !== false ||
    currentUser?.permissions?.inventoryEdit !== false;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedRackFilter, setSelectedRackFilter] = useState('All');
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  // Modal triggers
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRackModal, setShowRackModal] = useState(false);

  // Form states
  const [newCatName, setNewCatName] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const catInputRef = useRef<HTMLInputElement>(null);
  const rackInputRef = useRef<HTMLInputElement>(null);

  const [prodName, setProdName] = useState('');
  const [prodSerialNo, setProdSerialNo] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodLocation, setProdLocation] = useState('');
  const [prodHsn, setProdHsn] = useState('');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodPurchasePrice, setProdPurchasePrice] = useState<number>(0);
  const [prodSupplierId, setProdSupplierId] = useState('');
  const [prodVendorName, setProdVendorName] = useState('');
  const [prodVendorContact, setProdVendorContact] = useState('');
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodMinQty, setProdMinQty] = useState<number>(2);
  const [prodDesc, setProdDesc] = useState('');
  const [prodSerialTracking, setProdSerialTracking] = useState(true);

  // Computations
  const totalStockValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const totalPurchaseValue = products.reduce(
    (acc, p) => acc + (p.purchasePrice || 0) * p.stock,
    0
  );
  const lowStockItemsCount = products.filter((p) => p.stock <= p.minQtyAlert).length;

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSerialNo('');
    setProdCategory(categories[0]?.name || 'ADAPTER');
    setProdLocation(racks[0]?.name || 'Rack 1');
    setProdHsn('');
    setProdPrice(0);
    setProdPurchasePrice(0);
    setProdSupplierId(suppliers[0]?.id || '');
    setProdVendorName(suppliers[0]?.name || '');
    setProdVendorContact(suppliers[0]?.mobile || '');
    setProdStock(0);
    setProdMinQty(2);
    setProdDesc('');
    setProdSerialTracking(true);
    setShowAddProduct(true);
  };

  const handleOpenEditProduct = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdSerialNo(prod.serialNo || '');
    setProdCategory(prod.category);
    setProdLocation(prod.location);
    setProdHsn(prod.hsnCode);
    setProdPrice(prod.price);
    setProdPurchasePrice(prod.purchasePrice || 0);
    setProdSupplierId(prod.supplierId || '');
    setProdVendorName(prod.vendorName || '');
    setProdVendorContact(prod.vendorContact || '');
    setProdStock(prod.stock);
    setProdMinQty(prod.minQtyAlert);
    setProdDesc(prod.description || '');
    setProdSerialTracking(prod.serialTrackingEnabled !== false);
    setShowAddProduct(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName) return;

    const matchedSup = suppliers.find((s) => s.id === prodSupplierId);
    const vendorNameFinal = matchedSup ? matchedSup.name : prodVendorName;
    const vendorContactFinal = matchedSup ? matchedSup.mobile : prodVendorContact;

    if (editingProduct) {
      onEditProduct({
        ...editingProduct,
        name: prodName,
        serialNo: prodSerialNo.trim() || undefined,
        category: prodCategory,
        location: prodLocation,
        hsnCode: prodHsn,
        price: prodPrice,
        purchasePrice: prodPurchasePrice,
        supplierId: prodSupplierId || undefined,
        vendorName: vendorNameFinal,
        vendorContact: vendorContactFinal,
        stock: prodStock,
        minQtyAlert: prodMinQty,
        description: prodDesc,
        serialTrackingEnabled: prodSerialTracking
      });
    } else {
      onAddProduct({
        name: prodName,
        serialNo: prodSerialNo.trim() || undefined,
        category: prodCategory,
        location: prodLocation,
        hsnCode: prodHsn,
        price: prodPrice,
        purchasePrice: prodPurchasePrice,
        supplierId: prodSupplierId || undefined,
        vendorName: vendorNameFinal,
        vendorContact: vendorContactFinal,
        stock: prodStock,
        minQtyAlert: prodMinQty,
        description: prodDesc,
        serialTrackingEnabled: prodSerialTracking
      });
    }
    setShowAddProduct(false);
  };

  const filteredProducts = products.filter((p) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(searchLower) ||
      (p.serialNo && p.serialNo.toLowerCase().includes(searchLower)) ||
      (p.hsnCode && p.hsnCode.toLowerCase().includes(searchLower)) ||
      (p.vendorName && p.vendorName.toLowerCase().includes(searchLower)) ||
      (p.vendorContact && p.vendorContact.toLowerCase().includes(searchLower)) ||
      (p.category && p.category.toLowerCase().includes(searchLower)) ||
      (p.location && p.location.toLowerCase().includes(searchLower));
    const matchesCategory =
      selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
    const matchesRack = selectedRackFilter === 'All' || p.location === selectedRackFilter;
    return matchesSearch && matchesCategory && matchesRack;
  });

  // If user selected a product for complete history drilldown
  if (selectedProductForDetail) {
    const currentProd =
      products.find((p) => p.id === selectedProductForDetail.id) ||
      selectedProductForDetail;
    return (
      <ProductDetail
        product={currentProd}
        suppliers={suppliers}
        purchases={purchases}
        purchaseReturns={purchaseReturns}
        inventorySerials={inventorySerials}
        inventoryTransactions={inventoryTransactions}
        jobs={jobs}
        onBack={() => setSelectedProductForDetail(null)}
        onNavigateToSupplier={onNavigateToSupplier}
        onNavigateToJob={onNavigateToJob}
      />
    );
  }

  return (
    <div className="space-y-6" id="inventory-management-root">
      {/* Header controls block */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Products &amp; Stock Room{' '}
            <span className="text-xs font-semibold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">
              {products.length} Spares Listed
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track parts levels, configure supplier sourcing, track serial numbers and view warehouse movements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStaff ? (
            <div className="text-xs font-bold text-teal-800 bg-teal-50 px-3.5 py-2 rounded-xl border border-teal-200 flex items-center gap-1.5">
              <span>👁️ Staff Access: Inventory Catalog View-Only</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Manage Categories
              </button>
              <button
                onClick={() => setShowRackModal(true)}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                Manage Locations
              </button>
              <button
                onClick={handleOpenAddProduct}
                id="add-product-btn"
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Product / Part
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stock metrics tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stock-metrics">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Total Listed Spares
            </span>
            <span className="text-xl font-extrabold text-slate-800 font-mono">
              {products.length} Items
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Low Stock Alert
            </span>
            <span
              className={`text-xl font-extrabold font-mono ${
                lowStockItemsCount > 0 ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {lowStockItemsCount} Alert{lowStockItemsCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isStaff ? (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 sm:col-span-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Configured Storage Bins
              </span>
              <span className="text-xl font-extrabold text-slate-800 font-mono">
                {racks.length} Locations
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Total Purchase Cost
                </span>
                <span className="text-xl font-extrabold text-blue-700 font-mono">
                  ₹{totalPurchaseValue.toLocaleString('en-IN')}.00
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Stock Selling Value
                </span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono">
                  ₹{totalStockValue.toLocaleString('en-IN')}.00
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search spare part, HSN, vendor, rack..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 font-semibold text-slate-600"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedRackFilter}
              onChange={(e) => setSelectedRackFilter(e.target.value)}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 font-semibold text-slate-600"
            >
              <option value="All">All Locations</option>
              {racks.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock List table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center">Action</th>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Supplier / Vendor</th>
                <th className="py-3.5 px-4">HSN Code</th>
                <th className="py-3.5 px-4">Rack Bin</th>
                {!isStaff && (
                  <>
                    <th className="py-3.5 px-4 text-right">Purchase Cost</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                  </>
                )}
                <th className="py-3.5 px-4 text-center">Stock Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((prod) => {
                  const isLow = prod.stock <= prod.minQtyAlert;
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => setSelectedProductForDetail(prod)}
                      className="hover:bg-teal-50/40 transition cursor-pointer group"
                    >
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedProductForDetail(prod)}
                            title="View Serial Numbers & History"
                            className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isStaff && (
                            <>
                              <button
                                onClick={(e) => handleOpenEditProduct(prod, e)}
                                title="Edit Stock details"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete ${prod.name} from inventory catalog?`)) {
                                    onDeleteProduct(prod.id);
                                  }
                                }}
                                title="Delete Product"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-teal-700 transition flex items-center gap-1">
                            <span>{prod.name}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono">{prod.id}</span>
                            {prod.serialNo && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-mono text-[9px] font-bold">
                                SN: {prod.serialNo}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-600">{prod.category}</td>

                      <td className="py-3 px-4">
                        {prod.vendorName ? (
                          <div>
                            <p className="font-bold text-slate-700 flex items-center gap-1">
                              <Store className="w-3 h-3 text-teal-600 shrink-0" />
                              <span>{prod.vendorName}</span>
                            </p>
                            {prod.vendorContact && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                {prod.vendorContact}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500">
                        {prod.hsnCode || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 font-bold border border-slate-100 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {prod.location}
                        </span>
                      </td>

                      {!isStaff && (
                        <>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                            ₹{(prod.purchasePrice || 0).toLocaleString('en-IN')}.00
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            ₹{prod.price.toLocaleString('en-IN')}.00
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold font-mono px-2.5 py-0.5 rounded-full text-xs ${
                            isLow
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          {prod.stock}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isStaff ? 7 : 9} className="text-center py-8 text-slate-400 italic">
                    No products found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddProduct && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddProduct(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-slide-up cursor-default max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-teal-600" />
                {editingProduct
                  ? 'Edit Product & Purchase Details'
                  : 'Add New Product & Sourcing'}
              </h2>
              <button
                onClick={() => setShowAddProduct(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">
                    Product / Part Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asus Vivobook Charger 65W"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase text-[10px] flex items-center justify-between">
                    <span>Serial Number / Item Barcode / Part No</span>
                    <span className="text-[9px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-88992211 or BAR-402910"
                    value={prodSerialNo}
                    onChange={(e) => setProdSerialNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">
                    Category
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">
                    Rack Location
                  </label>
                  <select
                    value={prodLocation}
                    onChange={(e) => setProdLocation(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700"
                  >
                    {racks.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sourcing Supplier Selector */}
                <div className="sm:col-span-2 bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-teal-600" />
                    Supplier / Vendor Sourcing Link
                  </span>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase text-[9px] mb-1">
                      Choose Registered Supplier
                    </label>
                    <select
                      value={prodSupplierId}
                      onChange={(e) => {
                        setProdSupplierId(e.target.value);
                        const s = suppliers.find((sup) => sup.id === e.target.value);
                        if (s) {
                          setProdVendorName(s.name);
                          setProdVendorContact(s.mobile);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="">-- Or enter custom vendor below --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!prodSupplierId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="space-y-0.5">
                        <label className="block font-bold text-slate-500 uppercase text-[9px]">
                          Custom Vendor Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CompuWorld / Wholesale Spares"
                          value={prodVendorName}
                          onChange={(e) => setProdVendorName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="block font-bold text-slate-500 uppercase text-[9px]">
                          Vendor Contact / Invoice Ref
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 9811002233 / PO #2026-10"
                          value={prodVendorContact}
                          onChange={(e) => setProdVendorContact(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-700"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Pricing Section */}
                <div className="space-y-1">
                  <label className="block font-bold text-blue-700 uppercase text-[10px]">
                    Purchase Cost (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={prodPurchasePrice === 0 ? '' : prodPurchasePrice}
                    onChange={(e) =>
                      setProdPurchasePrice(
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                    className="w-full border border-blue-200 bg-blue-50/30 rounded-xl px-3 py-1.5 font-mono text-right font-bold text-blue-800"
                  />
                  <span className="text-[9px] text-slate-400 block">Organisation buy cost</span>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-emerald-700 uppercase text-[10px]">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={prodPrice === 0 ? '' : prodPrice}
                    onChange={(e) =>
                      setProdPrice(e.target.value === '' ? 0 : Number(e.target.value))
                    }
                    className="w-full border border-emerald-200 bg-emerald-50/30 rounded-xl px-3 py-1.5 font-mono text-right font-bold text-emerald-800"
                  />
                  <span className="text-[9px] text-slate-400 block">Customer bill rate</span>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 84713010"
                    value={prodHsn}
                    onChange={(e) => setProdHsn(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">
                    Starting Stock
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={prodStock === 0 ? '' : prodStock}
                    onChange={(e) =>
                      setProdStock(e.target.value === '' ? 0 : Number(e.target.value))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-center font-bold"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">
                    Min Alert Stock Qty
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={prodMinQty === 0 ? '' : prodMinQty}
                    onChange={(e) =>
                      setProdMinQty(e.target.value === '' ? 0 : Number(e.target.value))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">
                  Description / Notes
                </label>
                <textarea
                  placeholder="Additional specifications"
                  rows={1}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition cursor-pointer text-xs"
                >
                  Save Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCategoryModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Manage Stock Categories</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newCatName.trim()) {
                    onAddCategory(newCatName.trim());
                    setNewCatName('');
                    setTimeout(() => catInputRef.current?.focus(), 0);
                  }
                }}
                className="flex gap-2 items-center"
              >
                <input
                  ref={catInputRef}
                  type="text"
                  placeholder="New category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2"
                />
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Add
                </button>
              </form>

              <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {categories.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 capitalize">{c.name}</td>
                        <td className="p-3 text-right">
                          {onDeleteCategory && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete category "${c.name}"?`)) {
                                  onDeleteCategory(c.id);
                                }
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Management Modal */}
      {showRackModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRackModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Manage Rack Locations</h2>
              <button
                onClick={() => setShowRackModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newRackName.trim()) {
                    onAddRack(newRackName.trim());
                    setNewRackName('');
                    setTimeout(() => rackInputRef.current?.focus(), 0);
                  }
                }}
                className="flex gap-2 items-center"
              >
                <input
                  ref={rackInputRef}
                  type="text"
                  placeholder="e.g. Rack 4"
                  value={newRackName}
                  onChange={(e) => setNewRackName(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2"
                />
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Add
                </button>
              </form>

              <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {racks.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">{r.name}</td>
                        <td className="p-3 text-right">
                          {onDeleteRack && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete rack location "${r.name}"?`)) {
                                  onDeleteRack(r.id);
                                }
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                              title="Delete Location Rack"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
