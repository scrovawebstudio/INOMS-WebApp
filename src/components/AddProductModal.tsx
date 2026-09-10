/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Store, AlertTriangle, MapPin, Tag } from 'lucide-react';
import { Product, Category, LocationRack, Supplier } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<Product, 'id'>) => Product | Promise<Product | void> | void;
  editingProduct?: Product | null;
  onEditProduct?: (product: Product) => void;
  categories?: Category[];
  racks?: LocationRack[];
  suppliers?: Supplier[];
  onSuccess?: (createdProduct: Product) => void;
}

export default function AddProductModal({
  isOpen,
  onClose,
  onAddProduct,
  editingProduct,
  onEditProduct,
  categories = [],
  racks = [],
  suppliers = [],
  onSuccess
}: AddProductModalProps) {
  const [prodName, setProdName] = useState('');
  const [prodSerialNo, setProdSerialNo] = useState('');
  const [prodCategory, setProdCategory] = useState('Spares');
  const [prodLocation, setProdLocation] = useState('Shelf A1');
  const [prodSupplierId, setProdSupplierId] = useState('');
  const [prodVendorName, setProdVendorName] = useState('');
  const [prodVendorContact, setProdVendorContact] = useState('');
  const [prodPurchasePrice, setProdPurchasePrice] = useState<number>(0);
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodStock, setProdStock] = useState<number>(1);
  const [prodMinQty, setProdMinQty] = useState<number>(2);
  const [prodHsn, setProdHsn] = useState('');
  const [prodDesc, setProdDesc] = useState('');

  // Default fallback lists if not provided
  const categoryOptions = categories.length > 0
    ? categories
    : [{ id: 'cat-1', name: 'Spares' }, { id: 'cat-2', name: 'Accessories' }, { id: 'cat-3', name: 'Chips / IC' }, { id: 'cat-4', name: 'Display Panels' }];

  const rackOptions = racks.length > 0
    ? racks
    : [{ id: 'rack-1', name: 'Shelf A1' }, { id: 'rack-2', name: 'Shelf A2' }, { id: 'rack-3', name: 'Rack B1' }, { id: 'rack-4', name: 'Main Cabinet' }];

  useEffect(() => {
    if (editingProduct) {
      setProdName(editingProduct.name || '');
      setProdSerialNo(editingProduct.serialNo || '');
      setProdCategory(editingProduct.category || categoryOptions[0]?.name || 'Spares');
      setProdLocation(editingProduct.location || rackOptions[0]?.name || 'Shelf A1');
      setProdSupplierId(editingProduct.supplierId || '');
      setProdVendorName(editingProduct.vendorName || '');
      setProdVendorContact(editingProduct.vendorContact || '');
      setProdPurchasePrice(editingProduct.purchasePrice || 0);
      setProdPrice(editingProduct.price || 0);
      setProdStock(editingProduct.stock !== undefined ? editingProduct.stock : 1);
      setProdMinQty(editingProduct.minQtyAlert !== undefined ? editingProduct.minQtyAlert : 2);
      setProdHsn(editingProduct.hsnCode || '');
      setProdDesc(editingProduct.description || '');
    } else {
      setProdName('');
      setProdSerialNo('');
      setProdCategory(categoryOptions[0]?.name || 'Spares');
      setProdLocation(rackOptions[0]?.name || 'Shelf A1');
      setProdSupplierId('');
      setProdVendorName('');
      setProdVendorContact('');
      setProdPurchasePrice(0);
      setProdPrice(0);
      setProdStock(1);
      setProdMinQty(2);
      setProdHsn('');
      setProdDesc('');
    }
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      alert('Please enter a product or spare part name.');
      return;
    }

    if (editingProduct && onEditProduct) {
      const updatedProd: Product = {
        ...editingProduct,
        name: prodName.trim(),
        serialNo: prodSerialNo.trim() || undefined,
        category: prodCategory,
        location: prodLocation,
        supplierId: prodSupplierId || undefined,
        vendorName: prodVendorName.trim() || undefined,
        vendorContact: prodVendorContact.trim() || undefined,
        purchasePrice: Number(prodPurchasePrice) || 0,
        price: Number(prodPrice) || 0,
        stock: Number(prodStock) || 0,
        minQtyAlert: Number(prodMinQty) || 0,
        hsnCode: prodHsn.trim() || '',
        description: prodDesc.trim() || undefined
      };
      onEditProduct(updatedProd);
      if (onSuccess) onSuccess(updatedProd);
      onClose();
    } else {
      const newProductData: Omit<Product, 'id'> = {
        name: prodName.trim(),
        serialNo: prodSerialNo.trim() || undefined,
        category: prodCategory,
        location: prodLocation,
        supplierId: prodSupplierId || undefined,
        vendorName: prodVendorName.trim() || undefined,
        vendorContact: prodVendorContact.trim() || undefined,
        purchasePrice: Number(prodPurchasePrice) || 0,
        price: Number(prodPrice) || 0,
        stock: Number(prodStock) || 0,
        minQtyAlert: Number(prodMinQty) || 0,
        hsnCode: prodHsn.trim() || '',
        description: prodDesc.trim() || undefined
      };

      const result = await onAddProduct(newProductData);
      const created = (result as Product) || {
        id: `prod-${Date.now()}`,
        ...newProductData
      };

      if (onSuccess) onSuccess(created);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-slide-up cursor-default max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">
                {editingProduct ? 'Edit Product & Inventory Details' : 'Add New Product to Inventory'}
              </h2>
              <p className="text-[10px] text-slate-400">
                Stock will be added to inventory and can be instantly billed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="block font-bold text-slate-600 uppercase text-[10px]">
                Product / Part Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Asus Vivobook Charger 65W / 8GB DDR4 RAM"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block font-bold text-slate-600 uppercase text-[10px] flex items-center justify-between">
                <span>Serial Number / Item Barcode / Part No (Optional)</span>
                <span className="text-[9px] text-slate-400 font-normal">Unique tracking identifier</span>
              </label>
              <input
                type="text"
                placeholder="e.g. SN-88992211 or BAR-402910"
                value={prodSerialNo}
                onChange={(e) => setProdSerialNo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase text-[10px]">
                Category
              </label>
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase text-[10px]">
                Rack Location
              </label>
              <select
                value={prodLocation}
                onChange={(e) => setProdLocation(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                {rackOptions.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sourcing Supplier Selector */}
            <div className="sm:col-span-2 bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-teal-600" />
                Supplier / Vendor Sourcing Link (Optional)
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
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
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
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="block font-bold text-slate-500 uppercase text-[9px]">
                      Vendor Contact / Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9811002233"
                      value={prodVendorContact}
                      onChange={(e) => setProdVendorContact(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
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
                min={0}
                placeholder="0.00"
                value={prodPurchasePrice === 0 ? '' : prodPurchasePrice}
                onChange={(e) =>
                  setProdPurchasePrice(
                    e.target.value === '' ? 0 : Number(e.target.value)
                  )
                }
                className="w-full border border-blue-200 bg-blue-50/30 rounded-xl px-3 py-1.5 font-mono text-right font-bold text-blue-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[9px] text-slate-400 block">Organisation buy cost</span>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-emerald-700 uppercase text-[10px]">
                Selling Price / Bill Rate (₹) *
              </label>
              <input
                type="number"
                min={0}
                placeholder="0.00"
                value={prodPrice === 0 ? '' : prodPrice}
                onChange={(e) =>
                  setProdPrice(e.target.value === '' ? 0 : Number(e.target.value))
                }
                className="w-full border border-emerald-200 bg-emerald-50/30 rounded-xl px-3 py-1.5 font-mono text-right font-bold text-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[9px] text-slate-400 block">Customer bill rate</span>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase text-[10px]">
                HSN / SAC Code
              </label>
              <input
                type="text"
                placeholder="e.g. 84713010"
                value={prodHsn}
                onChange={(e) => setProdHsn(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase text-[10px]">
                Initial Stock Qty
              </label>
              <input
                type="number"
                min={0}
                placeholder="1"
                value={prodStock === 0 ? '' : prodStock}
                onChange={(e) =>
                  setProdStock(e.target.value === '' ? 0 : Number(e.target.value))
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-center font-bold text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block font-bold text-slate-600 uppercase text-[10px]">
                Min Alert Stock Qty
              </label>
              <input
                type="number"
                min={0}
                placeholder="2"
                value={prodMinQty === 0 ? '' : prodMinQty}
                onChange={(e) =>
                  setProdMinQty(e.target.value === '' ? 0 : Number(e.target.value))
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-center text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-600 uppercase text-[10px]">
              Description / Part Specs
            </label>
            <textarea
              placeholder="Additional part specs, compatibility notes or brand"
              rows={2}
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition cursor-pointer text-xs shadow-xs"
            >
              {editingProduct ? 'Save Changes' : 'Add to Inventory & Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
