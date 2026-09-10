import React, { useState, useEffect } from 'react';
import {
  Purchase,
  PurchaseReturn,
  PurchaseOrder,
  Supplier,
  Product,
  SystemUser
} from '../types';
import {
  ShoppingCart,
  Plus,
  Search,
  RotateCcw,
  FileText,
  Ban,
  Filter,
  DollarSign,
  Calendar,
  Layers,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Trash2,
  Edit,
  Pencil,
  Tag,
  Building,
  Store,
  X
} from 'lucide-react';

interface PurchasesHubProps {
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  purchaseReturns: PurchaseReturn[];
  suppliers: Supplier[];
  products: Product[];
  isStaff?: boolean;
  currentUser?: SystemUser | null;
  userRole?: string;
  onAddPurchase: (purchase: Omit<Purchase, 'id'>) => void;
  onUpdatePurchase: (purchase: Purchase) => void;
  onDeletePurchase?: (id: string) => void;
  onCancelPurchase: (id: string, reason: string) => void;
  onAddPurchaseOrder: (po: Omit<PurchaseOrder, 'id'>) => void;
  onUpdatePurchaseOrder: (po: PurchaseOrder) => void;
  onReceivePurchaseOrder?: (poId: string) => void;
  onDeletePurchaseOrder?: (id: string) => void;
  onAddPurchaseReturn: (ret: Omit<PurchaseReturn, 'id'>) => void;
  onUpdatePurchaseReturn?: (ret: PurchaseReturn) => void;
  onDeletePurchaseReturn?: (id: string) => void;
  onNavigateToSupplier?: (supplierId: string) => void;
  onAddSupplier?: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | undefined> | Supplier | undefined | void;
  initialSupplierId?: string | null;
  initialOpenModal?: 'purchase' | 'order' | 'return' | null;
  onClearInitialModal?: () => void;
}

export default function PurchasesHub({
  purchases,
  purchaseOrders,
  purchaseReturns,
  suppliers,
  products,
  isStaff = false,
  currentUser,
  userRole,
  onAddPurchase,
  onUpdatePurchase,
  onDeletePurchase,
  onCancelPurchase,
  onAddPurchaseOrder,
  onUpdatePurchaseOrder,
  onReceivePurchaseOrder,
  onDeletePurchaseOrder,
  onAddPurchaseReturn,
  onUpdatePurchaseReturn,
  onDeletePurchaseReturn,
  onNavigateToSupplier,
  onAddSupplier,
  initialSupplierId,
  initialOpenModal,
  onClearInitialModal
}: PurchasesHubProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'orders' | 'returns'>('purchases');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Quick Add Supplier state
  const [showQuickAddSupplierModal, setShowQuickAddSupplierModal] = useState(false);
  const [quickSupTarget, setQuickSupTarget] = useState<'purchase' | 'order'>('purchase');
  const [quickSupName, setQuickSupName] = useState('');
  const [quickSupMobile, setQuickSupMobile] = useState('');
  const [quickSupContactPerson, setQuickSupContactPerson] = useState('');
  const [quickSupGstin, setQuickSupGstin] = useState('');
  const [quickSupAddress, setQuickSupAddress] = useState('');
  const [quickSupOpeningBal, setQuickSupOpeningBal] = useState<number>(0);
  const [isSavingQuickSup, setIsSavingQuickSup] = useState(false);

  // Modals
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
  const [showNewPOModal, setShowNewPOModal] = useState(false);
  const [showNewReturnModal, setShowNewReturnModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  // Edit states
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [editingReturn, setEditingReturn] = useState<PurchaseReturn | null>(null);

  const createBlankPurchaseItem = () => ({
    productId: '',
    productName: '',
    category: 'General',
    qty: 1,
    rate: 0,
    taxPercent: 18,
    serialsInput: ''
  });

  const createBlankPOItem = () => ({
    productId: '',
    productName: '',
    category: 'General',
    qty: 1,
    rate: 0,
    taxPercent: 18
  });

  const createBlankReturnItem = () => ({
    productId: '',
    productName: '',
    category: 'General',
    qty: 1,
    rate: 0,
    taxPercent: 18,
    serialsInput: ''
  });

  // New Purchase Form State
  const [purSupplierId, setPurSupplierId] = useState(suppliers[0]?.id || '');
  const [purDate, setPurDate] = useState(new Date().toISOString().split('T')[0]);
  const [purRefNo, setPurRefNo] = useState('');
  const [purPoRef, setPurPoRef] = useState('');
  const [purNotes, setPurNotes] = useState('');
  const [purPaidAmount, setPurPaidAmount] = useState<number>(0);
  const [purItems, setPurItems] = useState<
    {
      productId: string;
      productName: string;
      category: string;
      qty: number;
      rate: number;
      taxPercent: number;
      serialsInput: string;
    }[]
  >([createBlankPurchaseItem()]);

  // New Purchase Order Form State
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || '');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poExpDelivery, setPoExpDelivery] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<
    {
      productId: string;
      productName: string;
      category: string;
      qty: number;
      rate: number;
      taxPercent: number;
    }[]
  >([createBlankPOItem()]);

  // New Purchase Return Form State
  const [retSupplierId, setRetSupplierId] = useState(suppliers[0]?.id || '');
  const [retPurchaseId, setRetPurchaseId] = useState('');
  const [retDate, setRetDate] = useState(new Date().toISOString().split('T')[0]);
  const [retReason, setRetReason] = useState('Defective / Dead on Arrival');
  const [retNotes, setRetNotes] = useState('');
  const [retItems, setRetItems] = useState<
    {
      productId: string;
      productName: string;
      category: string;
      qty: number;
      rate: number;
      taxPercent: number;
      serialsInput: string;
    }[]
  >([createBlankReturnItem()]);

  // Listen for initial supplier / modal requested from Supplier page
  useEffect(() => {
    if (initialSupplierId) {
      setPurSupplierId(initialSupplierId);
      setPoSupplierId(initialSupplierId);
      setRetSupplierId(initialSupplierId);
      if (initialOpenModal === 'purchase') {
        handleOpenNewPurchase(initialSupplierId);
      } else if (initialOpenModal === 'order') {
        handleOpenNewPO(initialSupplierId);
      } else if (initialOpenModal === 'return') {
        handleOpenNewReturn(initialSupplierId);
      }
      onClearInitialModal?.();
    }
  }, [initialSupplierId, initialOpenModal]);

  const handleOpenNewPurchase = (supId?: string) => {
    setEditingPurchase(null);
    setPurSupplierId(supId || suppliers[0]?.id || '');
    setPurDate(new Date().toISOString().split('T')[0]);
    setPurRefNo('');
    setPurPoRef('');
    setPurNotes('');
    setPurPaidAmount(0);
    setPurItems([createBlankPurchaseItem()]);
    setShowNewPurchaseModal(true);
  };

  const handleOpenEditPurchase = (pur: Purchase) => {
    setEditingPurchase(pur);
    setPurSupplierId(pur.supplierId);
    setPurDate(pur.date);
    setPurRefNo(pur.referenceNumber || '');
    setPurPoRef(pur.purchaseOrderRef || '');
    setPurNotes(pur.notes || '');
    setPurPaidAmount(pur.paidAmount || 0);
    setPurItems(
      pur.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        category: it.category || 'General',
        qty: it.qty,
        rate: it.rate,
        taxPercent: it.taxPercent || 18,
        serialsInput: (it.serialNumbers || []).join(', ')
      }))
    );
    setShowNewPurchaseModal(true);
  };

  const handleOpenNewPO = (supId?: string) => {
    setEditingPO(null);
    setPoSupplierId(supId || suppliers[0]?.id || '');
    setPoDate(new Date().toISOString().split('T')[0]);
    setPoExpDelivery('');
    setPoNotes('');
    setPoItems([createBlankPOItem()]);
    setShowNewPOModal(true);
  };

  const handleOpenEditPO = (po: PurchaseOrder) => {
    setEditingPO(po);
    setPoSupplierId(po.supplierId);
    setPoDate(po.date);
    setPoExpDelivery(po.expectedDeliveryDate || '');
    setPoNotes(po.notes || '');
    setPoItems(
      po.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        category: it.category || 'General',
        qty: it.qty,
        rate: it.rate,
        taxPercent: it.taxPercent || 18
      }))
    );
    setShowNewPOModal(true);
  };

  const handleConvertPOToPurchase = (po: PurchaseOrder) => {
    setEditingPurchase(null);
    setPurSupplierId(po.supplierId);
    setPurDate(new Date().toISOString().split('T')[0]);
    setPurRefNo('');
    setPurPoRef(po.id);
    setPurNotes(po.notes ? `Converted from PO #${po.id}. ${po.notes}` : `Converted from PO #${po.id}`);
    setPurPaidAmount(0);
    if (po.items && po.items.length > 0) {
      setPurItems(
        po.items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          category: it.category || 'General',
          qty: it.qty || (it as any).quantity || 1,
          rate: it.rate || (it as any).unitPrice || (it as any).estimatedUnitPrice || 0,
          taxPercent: it.taxPercent !== undefined ? it.taxPercent : 18,
          serialsInput: ''
        }))
      );
    }
    setActiveTab('purchases');
    setShowNewPurchaseModal(true);
  };

  const handleOpenNewReturn = (supId?: string) => {
    setEditingReturn(null);
    setRetSupplierId(supId || suppliers[0]?.id || '');
    setRetPurchaseId('');
    setRetDate(new Date().toISOString().split('T')[0]);
    setRetReason('Defective / Dead on Arrival');
    setRetNotes('');
    setRetItems([createBlankReturnItem()]);
    setShowNewReturnModal(true);
  };

  const handleOpenEditReturn = (ret: PurchaseReturn) => {
    setEditingReturn(ret);
    setRetSupplierId(ret.supplierId);
    setRetPurchaseId(ret.purchaseNumber || ret.purchaseId || '');
    setRetDate(ret.date);
    setRetReason(ret.reason || 'Defective / Dead on Arrival');
    setRetNotes(ret.notes || '');
    setRetItems(
      ret.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        category: it.category || 'General',
        qty: it.qty,
        rate: it.rate ?? it.unitCost ?? 0,
        taxPercent: it.taxPercent || 18,
        serialsInput: (it.serialNumbers || []).join(', ')
      }))
    );
    setShowNewReturnModal(true);
  };

  // Calculations for New Purchase Form
  const purSubtotal = purItems.reduce((sum, it) => sum + it.qty * it.rate, 0);
  const purTaxAmount = purItems.reduce(
    (sum, it) => sum + (it.qty * it.rate * (it.taxPercent || 0)) / 100,
    0
  );
  const purGrandTotal = purSubtotal + purTaxAmount;

  // Add Item to Purchase Form
  const handleAddPurchaseItemRow = () => {
    setPurItems([
      ...purItems,
      createBlankPurchaseItem()
    ]);
  };

  const handleUpdatePurchaseItemRow = (
    index: number,
    field: string,
    value: any
  ) => {
    const updated = [...purItems];
    if (field === 'productName') {
      updated[index].productName = value;
      const matched = products.find(
        (prod) => prod.name.toLowerCase() === value.trim().toLowerCase()
      );
      if (matched) {
        updated[index].productId = matched.id;
        updated[index].category = matched.category || updated[index].category;
        if (!updated[index].rate || updated[index].rate === 0) {
          updated[index].rate = matched.purchasePrice || matched.costPrice || 0;
        }
      } else {
        updated[index].productId = `temp-pur-${Date.now()}-${index}`;
      }
    } else if (field === 'productId') {
      const p = products.find((prod) => prod.id === value);
      if (p) {
        updated[index].productId = p.id;
        updated[index].productName = p.name;
        updated[index].category = p.category;
        updated[index].rate = p.purchasePrice || p.costPrice || 0;
      } else {
        updated[index].productId = value;
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    setPurItems(updated);
  };

  const handleRemovePurchaseItemRow = (index: number) => {
    if (purItems.length === 1) return;
    setPurItems(purItems.filter((_, idx) => idx !== index));
  };

  // PO Items Handlers & Calculations
  const poSubtotal = poItems.reduce((sum, it) => sum + (it.qty || 1) * (it.rate || 0), 0);
  const poTaxAmount = poItems.reduce(
    (sum, it) => sum + ((it.qty || 1) * (it.rate || 0) * (it.taxPercent || 0)) / 100,
    0
  );
  const poGrandTotal = poSubtotal + poTaxAmount;

  const handleAddPOItemRow = () => {
    setPoItems([
      ...poItems,
      createBlankPOItem()
    ]);
  };

  const handleUpdatePOItemRow = (
    index: number,
    field: string,
    value: any
  ) => {
    const updated = [...poItems];
    if (field === 'productName') {
      updated[index].productName = value;
      const matched = products.find(
        (prod) => prod.name.toLowerCase() === value.trim().toLowerCase()
      );
      if (matched) {
        updated[index].productId = matched.id;
        updated[index].category = matched.category || updated[index].category;
        if (!updated[index].rate || updated[index].rate === 0) {
          updated[index].rate = matched.purchasePrice || matched.costPrice || 0;
        }
      } else {
        updated[index].productId = `temp-po-${Date.now()}-${index}`;
      }
    } else if (field === 'productId') {
      const p = products.find((prod) => prod.id === value);
      if (p) {
        updated[index].productId = p.id;
        updated[index].productName = p.name;
        updated[index].category = p.category;
        updated[index].rate = p.purchasePrice || p.costPrice || 0;
      } else {
        updated[index].productId = value;
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    setPoItems(updated);
  };

  const handleRemovePOItemRow = (index: number) => {
    if (poItems.length === 1) return;
    setPoItems(poItems.filter((_, idx) => idx !== index));
  };

  // Quick Add Supplier Handler
  const handleQuickAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupName.trim()) {
      alert('Please enter supplier name');
      return;
    }
    try {
      setIsSavingQuickSup(true);
      if (onAddSupplier) {
        const res = await onAddSupplier({
          name: quickSupName.trim(),
          mobile: quickSupMobile.trim(),
          contactPerson: quickSupContactPerson.trim(),
          gstin: quickSupGstin.trim(),
          address: quickSupAddress.trim(),
          openingBalance: Number(quickSupOpeningBal || 0),
          balance: Number(quickSupOpeningBal || 0),
          email: '',
          notes: 'Added from Purchases Hub',
          status: 'Active'
        });
        if (res && (res as any).id) {
          const newId = (res as any).id;
          if (quickSupTarget === 'purchase') {
            setPurSupplierId(newId);
          } else {
            setPoSupplierId(newId);
          }
        }
      }
      setShowQuickAddSupplierModal(false);
      setQuickSupName('');
      setQuickSupMobile('');
      setQuickSupContactPerson('');
      setQuickSupGstin('');
      setQuickSupAddress('');
      setQuickSupOpeningBal(0);
    } catch (err: any) {
      console.error('Failed to quick add supplier:', err);
    } finally {
      setIsSavingQuickSup(false);
    }
  };

  // Submit New or Edited Purchase
  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === purSupplierId);
    if (!sup) {
      alert('Please select a valid supplier');
      return;
    }

    const items = purItems.map((it, idx) => {
      const serialList = it.serialsInput
        ? it.serialsInput
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const itemSub = it.qty * it.rate;
      const itemTax = (itemSub * (it.taxPercent || 0)) / 100;
      return {
        id: `pit-${idx + 1}-${Date.now()}`,
        productId: it.productId || `prod-${Date.now()}-${idx}`,
        productName: it.productName.trim() || 'Item',
        category: it.category || 'General',
        qty: it.qty,
        rate: it.rate,
        discount: 0,
        taxPercent: it.taxPercent,
        taxAmount: itemTax,
        total: itemSub + itemTax,
        serialNumbers: serialList
      };
    });

    const balanceAmount = Math.max(0, purGrandTotal - purPaidAmount);
    const paymentStatus =
      balanceAmount === 0 ? 'Paid' : purPaidAmount > 0 ? 'Partially Paid' : 'Unpaid';

    if (editingPurchase) {
      onUpdatePurchase({
        ...editingPurchase,
        supplierId: sup.id,
        supplierName: sup.name,
        purchaseOrderRef: purPoRef || undefined,
        date: purDate,
        items,
        subtotal: purSubtotal,
        discount: 0,
        taxPercent: 18,
        taxAmount: purTaxAmount,
        grandTotal: purGrandTotal,
        paidAmount: purPaidAmount,
        balanceAmount,
        paymentStatus,
        referenceNumber: purRefNo,
        notes: purNotes
      });
      setEditingPurchase(null);
      setShowNewPurchaseModal(false);
      return;
    }

    onAddPurchase({
      supplierId: sup.id,
      supplierName: sup.name,
      purchaseOrderRef: purPoRef || undefined,
      date: purDate,
      items,
      subtotal: purSubtotal,
      discount: 0,
      taxPercent: 18,
      taxAmount: purTaxAmount,
      grandTotal: purGrandTotal,
      paidAmount: purPaidAmount,
      balanceAmount,
      paymentStatus,
      referenceNumber: purRefNo,
      notes: purNotes,
      status: 'Active',
      createdAt: new Date().toISOString()
    });

    setShowNewPurchaseModal(false);
  };

  // Submit New or Edited Purchase Order
  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poSupplierId);
    if (!sup) {
      alert('Please select a valid supplier');
      return;
    }

    const items = poItems.map((it, idx) => {
      const itemSub = it.qty * it.rate;
      const itemTax = (itemSub * (it.taxPercent || 0)) / 100;
      return {
        id: `poi-${idx + 1}-${Date.now()}`,
        productId: it.productId || `prod-po-${Date.now()}-${idx}`,
        productName: it.productName.trim() || 'Item',
        category: it.category || 'General',
        qty: it.qty,
        rate: it.rate,
        discount: 0,
        taxPercent: it.taxPercent || 18,
        taxAmount: itemTax,
        total: itemSub + itemTax
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.qty * it.rate, 0);
    const taxAmount = items.reduce((sum, it) => sum + (it.taxAmount || 0), 0);
    const grandTotal = subtotal + taxAmount;

    if (editingPO) {
      onUpdatePurchaseOrder({
        ...editingPO,
        supplierId: sup.id,
        supplierName: sup.name,
        date: poDate,
        expectedDeliveryDate: poExpDelivery || undefined,
        items,
        subtotal,
        discount: 0,
        taxPercent: 18,
        taxAmount,
        grandTotal,
        notes: poNotes
      });
      setEditingPO(null);
      setShowNewPOModal(false);
      return;
    }

    onAddPurchaseOrder({
      supplierId: sup.id,
      supplierName: sup.name,
      date: poDate,
      expectedDeliveryDate: poExpDelivery || undefined,
      items,
      subtotal,
      discount: 0,
      taxPercent: 18,
      taxAmount,
      grandTotal,
      status: 'Ordered',
      notes: poNotes,
      createdAt: new Date().toISOString()
    });

    setShowNewPOModal(false);
  };

  // Submit New or Edited Purchase Return
  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === retSupplierId);
    if (!sup) {
      alert('Please select a valid supplier');
      return;
    }

    const items = retItems.map((it, idx) => {
      const serialList = it.serialsInput
        ? it.serialsInput
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const itemSub = it.qty * it.rate;
      const itemTax = (itemSub * (it.taxPercent || 0)) / 100;
      return {
        id: `rit-${idx + 1}-${Date.now()}`,
        productId: it.productId || `prod-ret-${Date.now()}-${idx}`,
        productName: it.productName.trim() || 'Item',
        category: it.category || 'General',
        qty: it.qty,
        rate: it.rate,
        taxPercent: it.taxPercent || 18,
        taxAmount: itemTax,
        total: itemSub + itemTax,
        serialNumbers: serialList
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.qty * it.rate, 0);
    const taxAmount = items.reduce((sum, it) => sum + (it.taxAmount || 0), 0);
    const grandTotal = subtotal + taxAmount;

    if (editingReturn) {
      if (onUpdatePurchaseReturn) {
        onUpdatePurchaseReturn({
          ...editingReturn,
          purchaseId: retPurchaseId || undefined,
          purchaseNumber: retPurchaseId || undefined,
          supplierId: sup.id,
          supplierName: sup.name,
          date: retDate,
          items,
          subtotal,
          taxAmount,
          grandTotal,
          reason: retReason,
          notes: retNotes
        });
      }
      setEditingReturn(null);
      setShowNewReturnModal(false);
      return;
    }

    onAddPurchaseReturn({
      purchaseId: retPurchaseId || undefined,
      purchaseNumber: retPurchaseId || undefined,
      supplierId: sup.id,
      supplierName: sup.name,
      date: retDate,
      items,
      subtotal,
      taxAmount,
      grandTotal,
      reason: retReason,
      notes: retNotes,
      status: 'Processed',
      createdAt: new Date().toISOString()
    });

    setShowNewReturnModal(false);
  };

  // Filtered Purchases
  const filteredPurchases = purchases.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.id.toLowerCase().includes(term) ||
      p.supplierName.toLowerCase().includes(term) ||
      (p.referenceNumber || '').toLowerCase().includes(term);
    const matchesSup = supplierFilter === 'All' || p.supplierId === supplierFilter;
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Cancelled' ? p.status === 'Cancelled' : p.paymentStatus === statusFilter && p.status !== 'Cancelled');
    return matchesSearch && matchesSup && matchesStatus;
  });

  return (
    <div className="space-y-6" id="purchases-hub-root">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold border border-blue-100">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 leading-tight">
              Purchasing, Inward Stock &amp; Returns Hub
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage Vendor Invoices, Purchase Orders, Debit Notes / Returns &amp; Serial numbers inward.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenNewPO()}
            className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Generate PO</span>
          </button>

          <button
            onClick={() => handleOpenNewReturn()}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Purchase Return</span>
          </button>

          {!isStaff && (
            <button
              onClick={() => handleOpenNewPurchase()}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Record Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'purchases', label: `Purchase Invoices (${purchases.length})`, icon: ShoppingCart },
          { id: 'orders', label: `Purchase Orders (${purchaseOrders.length})`, icon: FileText },
          { id: 'returns', label: `Purchase Returns / Debit Notes (${purchaseReturns.length})`, icon: RotateCcw }
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

      {/* Tab 1: Purchases List */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search invoice, vendor, bill ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700"
              >
                <option value="All">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="text-xs font-mono font-bold text-slate-500">
              Showing {filteredPurchases.length} of {purchases.length} invoices
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Purchase ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Supplier Bill Ref</th>
                  <th className="py-3 px-4">Items / Spares</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((pur) => {
                    const isCancelled = pur.status === 'Cancelled';
                    return (
                      <tr
                        key={pur.id}
                        className={`hover:bg-slate-50/70 transition ${
                          isCancelled ? 'bg-rose-50/40 opacity-70' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewingPurchase(pur)}
                              title="View Purchase Details"
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!isStaff && (
                              <button
                                onClick={() => handleOpenEditPurchase(pur)}
                                title="Edit Purchase Bill"
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isStaff && onDeletePurchase && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to permanently delete purchase "${pur.id}"? This will revert stock and supplier balance.`)) {
                                    onDeletePurchase(pur.id);
                                  }
                                }}
                                title="Delete Purchase Bill"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isCancelled && !isStaff && (
                              <button
                                onClick={() => {
                                  const reason = prompt(
                                    `Enter reason for cancelling purchase "${pur.id}":`
                                  );
                                  if (reason) {
                                    onCancelPurchase(pur.id, reason);
                                  }
                                }}
                                title="Cancel Purchase Bill & Revert Stock"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono font-black text-slate-900">{pur.id}</div>
                          {pur.purchaseOrderRef && (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold" title="Inwarded against PO">
                              <FileText className="w-3 h-3 text-indigo-500" /> PO: {pur.purchaseOrderRef}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{pur.date}</td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() =>
                              onNavigateToSupplier && onNavigateToSupplier(pur.supplierId)
                            }
                            className="font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer text-left"
                          >
                            {pur.supplierName}
                          </button>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-500">
                          {pur.referenceNumber || '—'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {pur.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700">
                                <span className="font-bold">{it.productName}</span> × {it.qty}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          ₹{pur.grandTotal.toLocaleString('en-IN')}.00
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          ₹{(pur.paidAmount || 0).toLocaleString('en-IN')}.00
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          ₹{(pur.balanceAmount || 0).toLocaleString('en-IN')}.00
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isCancelled ? (
                            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[10px] font-extrabold uppercase">
                              Cancelled
                            </span>
                          ) : (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                pur.paymentStatus === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : pur.paymentStatus === 'Partially Paid'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {pur.paymentStatus || 'Unpaid'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-slate-400 italic">
                      No purchase invoices match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Purchase Orders */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" /> Raised Purchase Orders
            </h3>
            <button
              onClick={() => setShowNewPOModal(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate PO</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Estimated Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {purchaseOrders.length > 0 ? (
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditPO(po)}
                            title="Edit Purchase Order"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleConvertPOToPurchase(po)}
                            title="Convert to Purchase Bill & Inward"
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition cursor-pointer"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          {po.status !== 'Received' && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Receive Purchase Order "${po.id}" and inward ${po.items.length} product(s) into inventory stock now?`
                                  )
                                ) {
                                  if (onReceivePurchaseOrder) {
                                    onReceivePurchaseOrder(po.id);
                                  } else {
                                    onUpdatePurchaseOrder({ ...po, status: 'Received' });
                                  }
                                }
                              }}
                              title="Quick Inward / Mark Received"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeletePurchaseOrder && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete purchase order "${po.id}"?`)) {
                                  onDeletePurchaseOrder(po.id);
                                }
                              }}
                              title="Delete Purchase Order"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{po.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{po.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{po.supplierName}</td>
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
                    <td colSpan={8} className="text-center py-10 text-slate-400 italic">
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Purchase Returns */}
      {activeTab === 'returns' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" /> Purchase Returns &amp; Debit Notes
            </h3>
            <button
              onClick={() => handleOpenNewReturn()}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Purchase Return</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Return ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Returned Items</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Debit Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {purchaseReturns.length > 0 ? (
                  purchaseReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditReturn(ret)}
                            title="Edit Purchase Return"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {onDeletePurchaseReturn && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete purchase return "${ret.id}"? This will revert stock and debit balance.`)) {
                                  onDeletePurchaseReturn(ret.id);
                                }
                              }}
                              title="Delete Purchase Return"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{ret.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{ret.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{ret.supplierName}</td>
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
                    <td colSpan={8} className="text-center py-10 text-slate-400 italic">
                      No purchase returns recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Record New Purchase */}
      {showNewPurchaseModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewPurchaseModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden p-6 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-teal-600" /> {editingPurchase ? 'Edit Supplier Purchase Bill' : 'Record Supplier Purchase Bill'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {editingPurchase ? 'Update purchase details, quantities, unit rates, and supplier bill numbers.' : 'Inward stock, link supplier, assign serial numbers & compute taxes automatically.'}
                </p>
              </div>
              <button
                onClick={() => setShowNewPurchaseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Select Supplier *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSupTarget('purchase');
                        setShowQuickAddSupplierModal(true);
                      }}
                      className="text-[10px] text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  <select
                    value={purSupplierId}
                    onChange={(e) => setPurSupplierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Link Purchase Order (PO)
                  </label>
                  <select
                    value={purPoRef}
                    onChange={(e) => {
                      const selectedPoId = e.target.value;
                      setPurPoRef(selectedPoId);
                      if (selectedPoId) {
                        const foundPO = purchaseOrders.find((p) => p.id === selectedPoId);
                        if (foundPO) {
                          setPurSupplierId(foundPO.supplierId);
                          if (foundPO.items && foundPO.items.length > 0) {
                            setPurItems(
                              foundPO.items.map((it) => ({
                                productId: it.productId,
                                productName: it.productName,
                                category: it.category || 'General',
                                qty: it.qty || (it as any).quantity || 1,
                                rate: it.rate || (it as any).unitPrice || (it as any).estimatedUnitPrice || 0,
                                taxPercent: it.taxPercent !== undefined ? it.taxPercent : 18,
                                serialsInput: ''
                              }))
                            );
                          }
                          if (foundPO.notes) {
                            setPurNotes((prev) =>
                              prev
                                ? `${prev} (From PO #${selectedPoId})`
                                : `Inwarded from PO #${selectedPoId}. ${foundPO.notes}`
                            );
                          }
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">-- Direct Bill / No PO --</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.id} - {po.supplierName} (₹{po.grandTotal.toLocaleString('en-IN')}) [{po.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={purDate}
                    onChange={(e) => setPurDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Bill / Invoice No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-ABC-9841"
                    value={purRefNo}
                    onChange={(e) => setPurRefNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {purPoRef && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 font-medium">
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Linked to <strong>PO #{purPoRef}</strong>. Recording this bill will automatically mark the PO as <strong>Received</strong> and inward items into Inventory Stock.
                  </span>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Purchased Items &amp; Serial Numbers
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPurchaseItemRow}
                    className="px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border border-teal-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {purItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-4">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase">
                              Product / Spare Part *
                            </label>
                            <span className="text-[9px] text-teal-600 font-semibold">Type new or select</span>
                          </div>
                          <input
                            type="text"
                            list={`pur-item-datalist-${idx}`}
                            required
                            placeholder="Type product name or select..."
                            value={item.productName}
                            onChange={(e) =>
                              handleUpdatePurchaseItemRow(idx, 'productName', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 focus:border-teal-500 focus:outline-none"
                          />
                          <datalist id={`pur-item-datalist-${idx}`}>
                            {products.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.category ? `${p.name} (${p.category}) - Stock: ${p.stock}` : p.name}
                              </option>
                            ))}
                          </datalist>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Category
                          </label>
                          <input
                            type="text"
                            placeholder="Spare Parts"
                            value={item.category}
                            onChange={(e) =>
                              handleUpdatePurchaseItemRow(idx, 'category', e.target.value)
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              handleUpdatePurchaseItemRow(idx, 'qty', Number(e.target.value))
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Unit Cost (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={(e) =>
                              handleUpdatePurchaseItemRow(idx, 'rate', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            GST %
                          </label>
                          <select
                            value={item.taxPercent}
                            onChange={(e) =>
                              handleUpdatePurchaseItemRow(idx, 'taxPercent', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseItemRow(idx)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Serial Numbers Input for this item */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Serial Numbers (Optional - separate by commas or new lines)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SN-DEL-001, SN-DEL-002, SN-DEL-003"
                          value={item.serialsInput}
                          onChange={(e) =>
                            handleUpdatePurchaseItemRow(idx, 'serialsInput', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals & Payment Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={purPaidAmount}
                    onChange={(e) => setPurPaidAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-700"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Balance of ₹{(purGrandTotal - purPaidAmount).toLocaleString('en-IN')} will be added to supplier ledger.
                  </p>
                </div>

                <div className="space-y-1 text-xs text-right">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">₹{purSubtotal.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tax (GST):</span>
                    <span className="font-mono font-bold">₹{purTaxAmount.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t">
                    <span>Grand Total:</span>
                    <span className="font-mono text-teal-700">₹{purGrandTotal.toLocaleString('en-IN')}.00</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewPurchaseModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  {editingPurchase ? 'Save & Update Bill' : 'Save & Inward Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Generate PO Modal */}
      {showNewPOModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewPOModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" /> {editingPO ? 'Edit Purchase Order (PO)' : 'Create Purchase Order (PO)'}
              </h3>
              <button
                onClick={() => setShowNewPOModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Supplier *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSupTarget('order');
                        setShowQuickAddSupplierModal(true);
                      }}
                      className="text-[10px] text-purple-700 hover:text-purple-800 font-bold flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Supplier</span>
                    </button>
                  </div>
                  <select
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    PO Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpDelivery}
                    onChange={(e) => setPoExpDelivery(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* PO Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    PO Line Items
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPOItemRow}
                    className="px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border border-purple-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-4">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase">
                              Product / Spare Item *
                            </label>
                            <span className="text-[9px] text-purple-600 font-semibold">Type new or select</span>
                          </div>
                          <input
                            type="text"
                            list={`po-item-datalist-${idx}`}
                            required
                            placeholder="Type product name or select..."
                            value={item.productName}
                            onChange={(e) =>
                              handleUpdatePOItemRow(idx, 'productName', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 focus:border-purple-500 focus:outline-none"
                          />
                          <datalist id={`po-item-datalist-${idx}`}>
                            {products.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.category ? `${p.name} (${p.category}) - Stock: ${p.stock}` : p.name}
                              </option>
                            ))}
                          </datalist>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Category
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Spare Parts"
                            value={item.category}
                            onChange={(e) =>
                              handleUpdatePOItemRow(idx, 'category', e.target.value)
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              handleUpdatePOItemRow(idx, 'qty', Number(e.target.value))
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Est. Rate (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={(e) =>
                              handleUpdatePOItemRow(idx, 'rate', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            GST %
                          </label>
                          <select
                            value={item.taxPercent}
                            onChange={(e) =>
                              handleUpdatePOItemRow(idx, 'taxPercent', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemovePOItemRow(idx)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PO Totals Summary */}
                <div className="bg-slate-100/70 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Items: </span>
                    <span className="font-bold text-slate-800">{poItems.length}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-500">Subtotal: </span>
                      <span className="font-mono font-bold text-slate-700">₹{poSubtotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">GST: </span>
                      <span className="font-mono font-bold text-slate-700">₹{poTaxAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-purple-700 font-black font-mono text-sm">
                      Total: ₹{poGrandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PO Instructions &amp; Delivery Notes
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Terms, delivery address or warranty conditions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewPOModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  {editingPO ? 'Update Purchase Order' : 'Create & Issue PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Purchase Return Modal */}
      {showNewReturnModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewReturnModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" /> {editingReturn ? 'Edit Purchase Return / Debit Note' : 'Record Purchase Return / Debit Note'}
              </h3>
              <button
                onClick={() => setShowNewReturnModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier *
                  </label>
                  <select
                    value={retSupplierId}
                    onChange={(e) => setRetSupplierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Return Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={retDate}
                    onChange={(e) => setRetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product to Return
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <select
                      value={retItems[0]?.productId}
                      onChange={(e) => {
                        const p = products.find((prod) => prod.id === e.target.value);
                        if (p) {
                          setRetItems([
                            {
                              productId: p.id,
                              productName: p.name,
                              category: p.category,
                              qty: retItems[0]?.qty || 1,
                              rate: p.purchasePrice || 0,
                              taxPercent: 18,
                              serialsInput: ''
                            }
                          ]);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={retItems[0]?.qty}
                      onChange={(e) => {
                        const updated = [...retItems];
                        updated[0].qty = Number(e.target.value);
                        setRetItems(updated);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      placeholder="Rate"
                      value={retItems[0]?.rate}
                      onChange={(e) => {
                        const updated = [...retItems];
                        updated[0].rate = Number(e.target.value);
                        setRetItems(updated);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Return
                </label>
                <select
                  value={retReason}
                  onChange={(e) => setRetReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold"
                >
                  <option value="Defective / Dead on Arrival">Defective / Dead on Arrival</option>
                  <option value="Incorrect Model Sent">Incorrect Model Sent</option>
                  <option value="Excess Quantity Returned">Excess Quantity Returned</option>
                  <option value="Warranty Replacement Claim">Warranty Replacement Claim</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewReturnModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  {editingReturn ? 'Update Return Record' : 'Process Return & Debit Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: View Purchase Details */}
      {viewingPurchase && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingPurchase(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-teal-600" /> Purchase Bill: {viewingPurchase.id}
                </h3>
                <p className="text-xs text-slate-500 font-medium font-mono">
                  Date: {viewingPurchase.date} | Ref: {viewingPurchase.referenceNumber || '—'}
                </p>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="p-3 bg-slate-50 rounded-xl border flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Supplier</span>
                  <span className="font-bold text-slate-800">{viewingPurchase.supplierName || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Payment Status</span>
                  <span className="font-bold text-emerald-700">{viewingPurchase.paymentStatus || 'Unpaid'}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(viewingPurchase.items) && viewingPurchase.items.length > 0 ? (
                      viewingPurchase.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <p className="font-bold text-slate-800">{item.productName || 'Unnamed Product'}</p>
                            {(() => {
                              const serials = Array.isArray(item.serialNumbers)
                                ? item.serialNumbers
                                : typeof item.serialNumbers === 'string' && (item.serialNumbers as string).trim().length > 0
                                ? (item.serialNumbers as string).split(',').map((s: string) => s.trim()).filter(Boolean)
                                : [];
                              return serials.length > 0 ? (
                                <p className="text-[10px] text-teal-700 font-mono mt-0.5">
                                  Serials: {serials.join(', ')}
                                </p>
                              ) : null;
                            })()}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">{item.qty || item.quantity || 1}</td>
                          <td className="p-2.5 text-right font-mono">₹{(Number(item.rate ?? item.unitCost ?? item.unitPrice ?? 0)).toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            ₹{(Number(item.total ?? ((item.qty || item.quantity || 1) * (item.rate ?? item.unitCost ?? 0)))).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                          No items listed on this purchase bill.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs text-right bg-slate-50 p-3 rounded-xl border">
                <div className="flex justify-between text-slate-500">
                  <span>Grand Total:</span>
                  <span className="font-mono font-black text-slate-900">
                    ₹{(Number(viewingPurchase.grandTotal) || 0).toLocaleString('en-IN')}.00
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Amount Paid:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    ₹{(Number(viewingPurchase.paidAmount) || 0).toLocaleString('en-IN')}.00
                  </span>
                </div>
                <div className="flex justify-between text-slate-700 font-bold border-t pt-1">
                  <span>Balance Due:</span>
                  <span className="font-mono text-amber-700">
                    ₹{(Number(viewingPurchase.balanceAmount) || 0).toLocaleString('en-IN')}.00
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t shrink-0">
              <button
                onClick={() => setViewingPurchase(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD SUPPLIER MODAL */}
      {showQuickAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Quick Add Supplier</h3>
                <p className="text-[11px] text-slate-500">
                  {quickSupTarget === 'purchase' ? 'Record new supplier for Purchase Bill' : 'Record new supplier for Purchase Order'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddSupplierModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSupplierSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Apex Electronics Ltd"
                  value={quickSupName}
                  onChange={(e) => setQuickSupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={quickSupMobile}
                    onChange={(e) => setQuickSupMobile(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={quickSupContactPerson}
                    onChange={(e) => setQuickSupContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="GSTIN Number"
                    value={quickSupGstin}
                    onChange={(e) => setQuickSupGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold uppercase focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={quickSupOpeningBal === 0 ? '' : quickSupOpeningBal}
                    onChange={(e) => setQuickSupOpeningBal(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Address / City
                </label>
                <textarea
                  rows={2}
                  placeholder="Address or city..."
                  value={quickSupAddress}
                  onChange={(e) => setQuickSupAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddSupplierModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickSup || !quickSupName.trim()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingQuickSup ? 'Saving...' : 'Save & Select Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
