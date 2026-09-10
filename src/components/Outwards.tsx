/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Edit,
  FileText,
  X,
  Printer,
  Laptop,
  Trash2,
  Receipt,
  Clock,
  Calendar,
  Filter,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { RepairJob, Client, CompanyConfig, JobStatus, Invoice, Payment, SystemUser, Product, getEffectiveBillAmount, sortJobsByLatest } from '../types';
import { TenantFeatures, getTenantFeatures } from './AuthModal';
import LockedAddonModal, { AddonType } from './LockedAddonModal';
import { openWhatsAppForJob } from '../lib/whatsappUtils';

const WhatsAppIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface OutwardPartItem {
  productId?: string;
  productName: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface OutwardsProps {
  jobs: RepairJob[];
  clients: Client[];
  products?: Product[];
  invoices?: Invoice[];
  payments?: Payment[];
  companyConfig: CompanyConfig;
  userRole?: string;
  currentUser?: SystemUser | null;
  tenantFeatures?: TenantFeatures;
  initialJobIdToView?: string | null;
  onClearInitialJobIdToView?: () => void;
  onUpdateJob: (updatedJob: RepairJob) => void;
  onDeleteJob?: (id: string) => void;
  onGenerateInvoiceForJob?: (job: RepairJob) => void;
}

export default function Outwards({
  jobs,
  clients,
  products = [],
  invoices = [],
  payments = [],
  companyConfig,
  userRole,
  currentUser,
  tenantFeatures,
  initialJobIdToView,
  onClearInitialJobIdToView,
  onUpdateJob,
  onDeleteJob,
  onGenerateInvoiceForJob
}: OutwardsProps) {
  const features = getTenantFeatures(tenantFeatures);
  const isAdmin = userRole === 'Admin' || currentUser?.role === 'Admin';
  const perms = currentUser?.permissions;
  const canEditOutward = isAdmin || perms?.outwardEdit !== false;
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'paid' | 'unpaid' | 'not_repaired' | 'dispatched'>('all');
  
  // Edit Job Modal state
  const [editingJob, setEditingJob] = useState<RepairJob | null>(null);
  const [editStatus, setEditStatus] = useState<JobStatus>('Product Out');
  const [editOutwardDate, setEditOutwardDate] = useState<string>('');
  const [editEstimate, setEditEstimate] = useState<number>(0);
  const [editFinalBill, setEditFinalBill] = useState<number>(0);
  const [editServiceCharge, setEditServiceCharge] = useState<number>(0);
  const [editPartsUsed, setEditPartsUsed] = useState<OutwardPartItem[]>([]);
  const [editActionTaken, setEditActionTaken] = useState('');
  const [editDeliveryStatus, setEditDeliveryStatus] = useState('Handed Over');
  const [editCourierName, setEditCourierName] = useState('');
  const [editTrackingNo, setEditTrackingNo] = useState('');
  const [editIsReturnCase, setEditIsReturnCase] = useState(false);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Not Repaired' | ''>('');
  const [editPaymentMode, setEditPaymentMode] = useState<string>('UPI');
  const [editRepairOutcome, setEditRepairOutcome] = useState<'Repaired' | 'Not Repaired'>('Repaired');
  const [editAdvanceRefunded, setEditAdvanceRefunded] = useState<boolean>(false);
  const [editAdvanceRefundMode, setEditAdvanceRefundMode] = useState<string>('UPI');
  const [lockedAddon, setLockedAddon] = useState<AddonType | null>(null);

  const setQuickDateRange = (range: 'all' | 'today' | 'this_week' | 'this_month') => {
    setDateRange(range);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (range === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (range === 'this_week') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - (day === 0 ? 6 : day - 1);
      const monday = new Date(now.setDate(diffToMonday));
      const mondayStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      setFromDate(mondayStr);
      setToDate(todayStr);
    } else if (range === 'this_month') {
      const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      setFromDate(monthStart);
      setToDate(todayStr);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  const handleTriggerWhatsApp = (job: RepairJob) => {
    if (!features.allowWhatsAppMessaging) {
      setLockedAddon('whatsapp');
      return;
    }
    handleSendWhatsAppNotification(job);
  };

  const handleTriggerInvoice = (job: RepairJob) => {
    const isNotRepaired = job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired' || job.status === 'Device Not repairable' || job.status === 'Not Repaired';
    if (isNotRepaired) {
      alert('Billing / Tax Invoice is disabled for Not Repaired jobs.');
      return;
    }
    if (!features.allowOutwardTaxInvoiceButton) {
      setLockedAddon('outward_invoice');
      return;
    }
    onGenerateInvoiceForJob?.(job);
  };

  const formatDisplayDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '—', time: '—' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: '' };
      return {
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  const handleOpenEditModal = (job: RepairJob) => {
    const isNotRepairedJob = job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired';
    setEditingJob(job);
    setEditStatus(job.status);
    setEditOutwardDate(job.outwardedDate || new Date().toISOString());
    setEditEstimate(isNotRepairedJob ? 0 : (job.estimateAmount || 0));

    const initialParts: OutwardPartItem[] = Array.isArray(job.partsUsed)
      ? job.partsUsed.map((p: any) => ({
          productId: p.productId || '',
          productName: p.productName || '',
          qty: Number(p.qty || 1),
          unitPrice: Number(p.unitPrice || p.rate || 0),
          total: Number(p.total || (Number(p.qty || 1) * Number(p.unitPrice || p.rate || 0)))
        }))
      : [];
    setEditPartsUsed(initialParts);
    const partsSum = initialParts.reduce((acc, p) => acc + (p.qty * p.unitPrice), 0);
    const effFinalBill = isNotRepairedJob ? 0 : getEffectiveBillAmount(job);
    setEditFinalBill(effFinalBill);
    setEditServiceCharge(isNotRepairedJob ? 0 : Math.max(0, effFinalBill - partsSum));

    setEditActionTaken(job.actionTaken || (isNotRepairedJob ? 'Inspected - Device Not Repairable' : 'Inspected & Repaired'));
    setEditDeliveryStatus(job.deliveryStatus || 'Handed Over');
    setEditCourierName(job.courierName || '');
    setEditTrackingNo(job.trackingNo || '');
    setEditIsReturnCase(job.isReturnCase || false);
    setEditPaymentStatus(isNotRepairedJob ? 'Not Repaired' : (job.paymentStatus || ''));
    setEditPaymentMode(job.advancePaymentMode || 'UPI');
    setEditRepairOutcome(isNotRepairedJob ? 'Not Repaired' : (job.repairOutcome || 'Repaired'));
    setEditAdvanceRefunded(job.advanceRefunded || payments.some(payment => payment.refNo === `REFUND-${job.id}`));
    setEditAdvanceRefundMode(job.advanceRefundMode || 'UPI');
  };

  const calculatePartsSum = (parts: OutwardPartItem[]) => {
    return parts.reduce((acc, p) => acc + (Number(p.qty || 1) * Number(p.unitPrice || 0)), 0);
  };

  const handleAddPartRow = () => {
    const updated = [
      ...editPartsUsed,
      { productId: '', productName: '', qty: 1, unitPrice: 0, total: 0 }
    ];
    setEditPartsUsed(updated);
    const partsSum = calculatePartsSum(updated);
    setEditFinalBill(editServiceCharge + partsSum);
  };

  const handleRemovePartRow = (idx: number) => {
    const updated = editPartsUsed.filter((_, i) => i !== idx);
    setEditPartsUsed(updated);
    const partsSum = calculatePartsSum(updated);
    setEditFinalBill(editServiceCharge + partsSum);
  };

  const handleUpdatePartRow = (idx: number, field: keyof OutwardPartItem, val: any) => {
    const updated = [...editPartsUsed];
    const row = { ...updated[idx], [field]: val };
    if (field === 'productId') {
      const matched = products.find(p => p.id === val);
      if (matched) {
        row.productId = matched.id;
        row.productName = matched.name;
        row.unitPrice = Number(matched.sellingPrice || matched.price || 0);
      }
    }
    row.total = Number(row.qty || 1) * Number(row.unitPrice || 0);
    updated[idx] = row;
    setEditPartsUsed(updated);
    const partsSum = calculatePartsSum(updated);
    setEditFinalBill(editServiceCharge + partsSum);
  };

  const handleServiceChargeChange = (charge: number) => {
    setEditServiceCharge(charge);
    const partsSum = calculatePartsSum(editPartsUsed);
    setEditFinalBill(charge + partsSum);
  };

  const handleFinalBillChange = (finalAmt: number) => {
    setEditFinalBill(finalAmt);
    const partsSum = calculatePartsSum(editPartsUsed);
    setEditServiceCharge(Math.max(0, finalAmt - partsSum));
  };

  useEffect(() => {
    if (initialJobIdToView) {
      const match = jobs.find(j => j.id === initialJobIdToView || j.id.includes(initialJobIdToView) || (initialJobIdToView && j.id.toLowerCase() === initialJobIdToView.toLowerCase()));
      if (match) {
        handleOpenEditModal(match);
      }
      onClearInitialJobIdToView?.();
    }
  }, [initialJobIdToView, jobs, onClearInitialJobIdToView]);

  // Slip preview state
  const [previewJob, setPreviewJob] = useState<RepairJob | null>(null);

  // Filter outwards jobs (ONLY Product Out or legacy Outwarded status) - sorted by latest on top
  const outwardJobs = sortJobsByLatest(jobs.filter(j => j.status === 'Product Out' || j.status === 'Outwarded'));

  const filteredJobs = sortJobsByLatest(outwardJobs.filter(j => {
    // Search match
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term || (
      j.id.toLowerCase().includes(term) ||
      j.clientName.toLowerCase().includes(term) ||
      j.equipment.toLowerCase().includes(term) ||
      j.serialNo.toLowerCase().includes(term) ||
      (j.courierName && j.courierName.toLowerCase().includes(term))
    );

    if (!matchesSearch) return false;

    // Delivery & Payment Filter
    const isNotRepaired = j.repairOutcome === 'Not Repaired' || j.paymentStatus === 'Not Repaired' || j.status === 'Device Not repairable' || j.status === 'Not Repaired';
    if (deliveryFilter === 'paid' && (j.paymentStatus !== 'Paid' || isNotRepaired)) return false;
    if (deliveryFilter === 'unpaid' && (j.paymentStatus !== 'Unpaid' || isNotRepaired)) return false;
    if (deliveryFilter === 'not_repaired' && !isNotRepaired) return false;
    if (deliveryFilter === 'dispatched' && j.deliveryStatus !== 'Dispatched') return false;

    // Date range filter
    const jobDate = j.outwardedDate || j.createdDate;
    if (jobDate) {
      const jobDateStr = jobDate.substring(0, 10);
      if (fromDate && jobDateStr < fromDate) return false;
      if (toDate && jobDateStr > toDate) return false;
    }

    return true;
  }));

  const totalProductOut = outwardJobs.length;
  const totalOutwardValue = filteredJobs.reduce((sum, j) => sum + getEffectiveBillAmount(j), 0);
  const totalPaidOutward = filteredJobs.filter(j => j.paymentStatus === 'Paid' && j.repairOutcome !== 'Not Repaired').length;
  const totalUnpaidOutward = filteredJobs.filter(j => j.paymentStatus === 'Unpaid' && j.repairOutcome !== 'Not Repaired').length;
  const totalNotRepaired = filteredJobs.filter(j => j.repairOutcome === 'Not Repaired' || j.paymentStatus === 'Not Repaired').length;

  const handleSaveEditedJob = (sendWhatsApp: boolean = false) => {
    if (!editingJob) return;

    if (editStatus === 'Product Out' && !editPaymentStatus) {
      alert('Please select Payment Status (Paid, Unpaid, or Not Repaired). This selection is mandatory for outward items.');
      return;
    }

    if (editFinalBill < 0 || editEstimate < 0) {
      alert('Amounts cannot be negative.');
      return;
    }

    const resolvedPaymentStatus = editPaymentStatus || editingJob.paymentStatus || 'Unpaid';
    const isNotRepaired = editStatus === 'Product Out' && (editRepairOutcome === 'Not Repaired' || resolvedPaymentStatus === 'Not Repaired');
    const effectiveFinalBill = isNotRepaired ? 0 : editFinalBill;
    const effectiveEstimate = isNotRepaired ? 0 : editEstimate;

    const updated: RepairJob = {
      ...editingJob,
      status: editStatus,
      outwardedDate: editStatus === 'Product Out' ? (editOutwardDate || new Date().toISOString()) : undefined,
      estimateAmount: effectiveEstimate,
      finalBillAmount: effectiveFinalBill,
      partsUsed: isNotRepaired ? [] : editPartsUsed,
      actionTaken: editActionTaken || (isNotRepaired ? 'Inspected - Device Not Repairable' : 'Inspected & Repaired'),
      deliveryStatus: editDeliveryStatus,
      courierName: editDeliveryStatus === 'Dispatched' ? editCourierName : '',
      trackingNo: editDeliveryStatus === 'Dispatched' ? editTrackingNo : '',
      isReturnCase: editIsReturnCase,
      paymentStatus: isNotRepaired ? 'Not Repaired' : resolvedPaymentStatus,
      advancePaymentMode: editPaymentMode,
      repairOutcome: isNotRepaired ? 'Not Repaired' : editRepairOutcome,
      advanceRefunded: isNotRepaired ? editAdvanceRefunded : false,
      advanceRefundMode: editAdvanceRefundMode
    };

    onUpdateJob(updated);
    setEditingJob(null);

    if (sendWhatsApp) {
      if (!tenantFeatures?.allowWhatsAppMessaging) {
        setLockedAddon('whatsapp');
      } else {
        handleSendWhatsAppNotification(updated);
      }
    }
  };

  const getRefundableAmount = (job: RepairJob): number => {
    const linkedInvoice = invoices.find(invoice => invoice.linkedJobId === job.id);
    const invoicePaid = linkedInvoice?.paidAmount || 0;
    const linkedPayments = payments
      .filter(payment => payment.linkedJobId === job.id && payment.amount > 0)
      .reduce((total, payment) => total + payment.amount, 0);
    return Math.max(invoicePaid, linkedPayments, job.advanceAmount || 0);
  };

  const handleSendWhatsAppNotification = (job: RepairJob) => {
    openWhatsAppForJob(job, companyConfig);
  };

  return (
    <div className="space-y-6">
      {/* Header operations */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Outward & Delivered Jobs Hub
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
              {filteredJobs.length} Outward Jobs
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage Complete & Ready repair items, outward dispatches, billing amounts, and delivery updates.
          </p>
        </div>

        {/* Top Summary Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Product Out Items</span>
            <span className="text-sm font-black text-emerald-600">{totalProductOut}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outward (₹)</span>
            <span className="text-sm font-black text-slate-800 font-mono">₹{totalOutwardValue.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar with Report Hub Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Main Search & Preset Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Job ID, Client Name, Device Equipment, Serial No, or Courier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-teal-500 transition shadow-2xs"
              />
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => setQuickDateRange('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  dateRange === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setQuickDateRange('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  dateRange === 'today'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDateRange('this_week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  dateRange === 'this_week'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setQuickDateRange('this_month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  dateRange === 'this_month'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateRange('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  dateRange === 'custom'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Custom Date</span>
              </button>
            </div>
          </div>

          {/* Sub Row: Custom Date Pickers & Delivery Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/60">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setDeliveryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  deliveryFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('paid')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  deliveryFilter === 'paid' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
                }`}
              >
                ✓ Paid
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('unpaid')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  deliveryFilter === 'unpaid' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100'
                }`}
              >
                ✕ Unpaid
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('not_repaired')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  deliveryFilter === 'not_repaired' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100'
                }`}
              >
                Not Repaired
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('dispatched')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  deliveryFilter === 'dispatched' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 border border-purple-200/60 hover:bg-purple-100'
                }`}
              >
                Dispatched Courier
              </button>
            </div>

            {/* Custom Date Pickers */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 text-[10px] font-bold">FROM</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border-none p-0 text-xs font-mono text-slate-700 focus:ring-0"
                />
                <span className="text-slate-400 text-[10px] font-bold">TO</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border-none p-0 text-xs font-mono text-slate-700 focus:ring-0"
                />
              </div>
            )}

            {/* Clear All Filters */}
            {(searchTerm || dateRange !== 'all' || deliveryFilter !== 'all' || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setQuickDateRange('all');
                  setDeliveryFilter('all');
                }}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 self-end sm:self-auto cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Cards List View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => {
              const existingInv = (invoices || []).find(inv => inv.linkedJobId === job.id);
              const isNotRepaired = job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired' || job.status === 'Device Not repairable' || job.status === 'Not Repaired';
              return (
                <div key={job.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition">
                  {/* Top: Job ID, Date, Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          #{job.id}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                          {formatDisplayDateTime(job.outwardedDate || job.createdAt || job.date).date}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{job.clientName}</span>
                        {job.clientMobile && (
                          <a
                            href={`tel:${job.clientMobile}`}
                            className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200"
                          >
                            {job.clientMobile}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-black text-base text-emerald-600">
                        ₹{getEffectiveBillAmount(job).toLocaleString('en-IN')}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black ${
                          job.paymentStatus === 'Unpaid'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {job.paymentStatus === 'Unpaid' ? '✕ UNPAID' : `✓ PAID ${job.advancePaymentMode ? `(${job.advancePaymentMode})` : ''}`}
                      </span>
                    </div>
                  </div>

                  {/* Device Specs & Outcome */}
                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-800 font-semibold">
                      <span className="truncate">{job.productName || job.equipment || 'Device'}</span>
                      {job.repairOutcome === 'Not Repaired' ? (
                        <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                          ✕ NOT REPAIRED
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200 shrink-0">
                          ✓ REPAIRED
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      {job.serialNo && <span>S/N: <span className="font-mono text-slate-700">{job.serialNo}</span></span>}
                      {job.deliveryType && <span>Delivery: <span className="font-medium text-slate-700">{job.deliveryType}</span></span>}
                    </div>
                    {job.courierName && (
                      <div className="text-[10px] text-teal-700 font-mono">
                        Courier: {job.courierName} {job.trackingNo ? `(TRK: ${job.trackingNo})` : ''}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleTriggerWhatsApp(job)}
                        title="Send WhatsApp Update"
                        className={`p-2 rounded-xl transition cursor-pointer ${
                          features.allowWhatsAppMessaging
                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>

                      {isNotRepaired ? (
                        <button
                          disabled
                          title="Billing disabled: Device marked as Not Repaired / Unrepairable"
                          className="p-2 rounded-xl bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-60 flex items-center gap-1 text-xs font-bold"
                        >
                          <Receipt className="w-4 h-4 text-slate-300" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerInvoice(job)}
                          title={existingInv ? `Bill #${existingInv.id}` : "Generate Invoice"}
                          className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                            existingInv
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : "bg-purple-50 hover:bg-purple-100 text-purple-600"
                          }`}
                        >
                          <Receipt className="w-4 h-4" />
                          {existingInv && <span className="text-[10px]">#{existingInv.id}</span>}
                        </button>
                      )}

                      <button
                        onClick={() => setPreviewJob(job)}
                        title="View Outward / Inward Slip"
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      {onDeleteJob && (
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete Outward Job #${job.id}? This action cannot be undone.`)) {
                              onDeleteJob?.(job.id);
                            }
                          }}
                          title="Delete Outward Job"
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenEditModal(job)}
                      className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer shrink-0"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              No outward or complete & ready jobs found matching search criteria.
            </div>
          )}
        </div>

        {/* Desktop Jobs Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 whitespace-nowrap">Actions</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Outward Date & Time</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Job ID</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Client</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Product Name / Model</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Serial No</th>
                <th className="py-3.5 px-4 whitespace-nowrap">RAM / HDD</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Fault Description</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Payment</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Final Bill (₹)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Delivery Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTriggerWhatsApp(job)}
                          title={features.allowWhatsAppMessaging ? "Send WhatsApp Update to Client" : "WhatsApp Messaging (Add-on Locked)"}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            features.allowWhatsAppMessaging
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-400"
                          }`}
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                        </button>
                        {(() => {
                          const isNotRepaired = job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired' || job.status === 'Device Not repairable' || job.status === 'Not Repaired';
                          if (isNotRepaired) {
                            return (
                              <button
                                disabled
                                title="Billing disabled: Device marked as Not Repaired / Unrepairable"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-60 flex items-center gap-1 font-semibold text-[10px]"
                              >
                                <Receipt className="w-3.5 h-3.5 text-slate-300" />
                              </button>
                            );
                          }
                          const existingInv = (invoices || []).find(inv => inv.linkedJobId === job.id);
                          if (existingInv) {
                            return (
                              <button
                                onClick={() => handleTriggerInvoice(job)}
                                title={
                                  features.allowOutwardTaxInvoiceButton
                                    ? `Bill Already Generated (#${existingInv.id} on ${existingInv.date || 'earlier'}). Click to edit or update bill.`
                                    : `Bill #${existingInv.id} (Tax Invoice Add-on Locked)`
                                }
                                className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 font-bold text-[10px] ${
                                  features.allowOutwardTaxInvoiceButton
                                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-400 border border-slate-200"
                                }`}
                              >
                                <Receipt className={`w-3.5 h-3.5 ${features.allowOutwardTaxInvoiceButton ? "text-emerald-600" : "text-slate-400"}`} />
                                <span className="hidden xl:inline text-[9px]">Bill #{existingInv.id}</span>
                              </button>
                            );
                          }
                          return (
                            <button
                              onClick={() => handleTriggerInvoice(job)}
                              title={features.allowOutwardTaxInvoiceButton ? "Generate Tax Invoice / Bill for Job" : "Generate Tax Invoice (Add-on Locked)"}
                              className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 font-semibold text-[10px] ${
                                features.allowOutwardTaxInvoiceButton
                                  ? "bg-purple-50 hover:bg-purple-100 text-purple-600"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-400"
                              }`}
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => handleOpenEditModal(job)}
                          title="Edit Outward Job & Amounts"
                          className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPreviewJob(job)}
                          title="View Outward / Inward Slip"
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete Outward Job #${job.id}? This action cannot be undone.`)) {
                              onDeleteJob?.(job.id);
                            }
                          }}
                          title="Delete Outward Job"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-800">
                            {formatDisplayDateTime(job.outwardedDate || job.createdAt || job.date).date}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <span>Out: {formatDisplayDateTime(job.outwardedDate || job.createdAt || job.date).time || '10:30 AM'}</span>
                          </div>
                          {job.createdAt && (
                            <div className="text-[9px] text-slate-400 font-normal">
                              In: {formatDisplayDateTime(job.createdAt).date}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">#{job.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">{job.clientName}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 min-w-[150px]">
                      <div className="font-bold text-slate-800">{job.productName || 'Device'}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        {job.productModel && <span>{job.productModel}</span>}
                        {job.equipment && <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[9px] font-semibold">{job.equipment}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">{job.serialNo || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">{job.ramHdd || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-[220px]">
                      <div className="line-clamp-2" title={job.problemDescription || (job.problems && job.problems.join(', ')) || 'General Repair'}>
                        {job.problemDescription || (job.problems && job.problems.length > 0 ? job.problems.join(', ') : 'General Repair')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {job.status || 'Product Out'}
                        </span>
                        {job.repairOutcome === 'Not Repaired' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            ✕ NOT REPAIRED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            ✓ REPAIRED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                          ⚪ NOT REPAIRED
                        </span>
                      ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black ${
                          job.paymentStatus === 'Unpaid'
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {job.paymentStatus === 'Unpaid' ? '✕ UNPAID' : `✓ PAID ${job.advancePaymentMode ? `(${job.advancePaymentMode})` : ''}`}
                      </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm whitespace-nowrap">
                      ₹{getEffectiveBillAmount(job).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600 min-w-[160px]">
                      <div className="font-bold text-slate-700">{job.deliveryType || 'Handover / Counter'}</div>
                      {job.courierName && (
                        <div className="text-[10px] text-teal-700 font-mono">
                          {job.courierName} {job.trackingNo ? `(TRK: ${job.trackingNo})` : ''}
                        </div>
                      )}
                      {(job.deliveredToName || job.deliveredBy) && (
                        <div className="text-[10px] text-slate-500">
                          {job.deliveredToName ? `To: ${job.deliveredToName}` : ''} {job.deliveredBy ? `| By: ${job.deliveredBy}` : ''}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400 italic">
                    No outward or complete & ready jobs found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Outward Job & Amounts Modal */}
      {editingJob && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingJob(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full my-8 overflow-hidden flex flex-col animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Title with Prominent Top-Right Job Card Status (matching Inward) */}
            <div className="bg-slate-900 px-5 py-3 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Edit Outward Job & Amounts</h2>
                <p className="text-[11px] text-slate-400">Job Card ID: {editingJob.id} | Client: {editingJob.clientName}</p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                {/* PROMINENT TOP-RIGHT JOB CARD STATUS SELECTOR */}
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-teal-400 whitespace-nowrap flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                    JOB STATUS:
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => {
                      const newStat = e.target.value as JobStatus;
                      setEditStatus(newStat);
                      if (newStat !== 'Product Out') {
                        if (editRepairOutcome === 'Not Repaired') {
                          setEditRepairOutcome('Repaired');
                        }
                        if (editPaymentStatus === 'Not Repaired' || !editPaymentStatus) {
                          setEditPaymentStatus(editingJob.paymentStatus === 'Not Repaired' ? 'Unpaid' : (editingJob.paymentStatus || 'Unpaid'));
                        }
                        if (editFinalBill === 0 && (editingJob.finalBillAmount || editingJob.estimateAmount)) {
                          setEditFinalBill(editingJob.finalBillAmount || editingJob.estimateAmount || 0);
                        }
                      }
                    }}
                    className="bg-slate-900 text-white font-extrabold text-xs rounded-xl px-3 py-1 border-2 border-teal-500 hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 cursor-pointer shadow-sm"
                  >
                    <option value="Product Out" className="bg-slate-900 text-emerald-400 font-bold">Product Out (Outward)</option>
                    <option value="Device Ready" className="bg-slate-900 text-purple-400 font-bold">Device Ready</option>
                    <option value="Device Not repairable" className="bg-slate-900 text-rose-400 font-bold">Device Not repairable</option>
                    <option value="Approval Pending" className="bg-slate-900 text-orange-400 font-bold">Approval Pending</option>
                    <option value="Work in Progress" className="bg-slate-900 text-amber-400 font-bold">Work in Progress</option>
                    <option value="Device Received" className="bg-slate-900 text-blue-400 font-bold">Device Received</option>
                  </select>
                </div>

                <button
                  onClick={() => setEditingJob(null)}
                  className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 shrink-0"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-4 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Outward Date & Time</label>
                  <div className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>
                      {editOutwardDate
                        ? `${formatDisplayDateTime(editOutwardDate).date} ${formatDisplayDateTime(editOutwardDate).time}`
                        : 'Auto-recorded on save'}
                    </span>
                    <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold uppercase">
                      Auto
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px] flex items-center justify-between">
                    <span>Payment Status</span>
                    <span className="text-rose-500 font-extrabold text-[9px]">* Mandatory</span>
                  </label>
                  <select
                    required
                    value={editPaymentStatus}
                    onChange={(e) => {
                      const val = e.target.value as 'Paid' | 'Unpaid' | 'Not Repaired' | '';
                      setEditPaymentStatus(val);
                      if (val === 'Not Repaired') {
                        setEditRepairOutcome('Not Repaired');
                        setEditFinalBill(0);
                        setEditEstimate(0);
                      } else if (editRepairOutcome === 'Not Repaired' && (val === 'Paid' || val === 'Unpaid')) {
                        setEditRepairOutcome('Repaired');
                      }
                    }}
                    className={`w-full border-2 rounded-xl px-3 py-1.5 font-bold ${
                      editPaymentStatus === 'Unpaid'
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : editPaymentStatus === 'Paid'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : editPaymentStatus === 'Not Repaired'
                        ? 'border-slate-300 bg-slate-100 text-slate-700'
                        : 'border-amber-400 bg-amber-50 text-amber-800'
                    }`}
                  >
                    <option value="">-- Select Payment Status (Mandatory) --</option>
                    <option value="Paid">✓ Paid</option>
                    <option value="Unpaid">✕ Unpaid</option>
                    <option value="Not Repaired">⚪ Not Repaired</option>
                  </select>
                </div>

                {editPaymentStatus === 'Paid' && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block font-bold text-slate-500 uppercase text-[10px]">Payment Mode / Method</label>
                    <select
                      value={editPaymentMode}
                      onChange={(e) => setEditPaymentMode(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-bold text-slate-700"
                    >
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                )}

                {/* Repair Outcome Selection */}
                <div className="space-y-1 sm:col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider">Repair Outcome Status</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRepairOutcome('Repaired');
                        if (editPaymentStatus === 'Not Repaired') {
                          setEditPaymentStatus('');
                        }
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                        editRepairOutcome === 'Repaired'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>✓</span>
                      <span>Repaired & Serviced</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditRepairOutcome('Not Repaired');
                        setEditPaymentStatus('Not Repaired');
                        setEditFinalBill(0);
                        setEditEstimate(0);
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                        editRepairOutcome === 'Not Repaired'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>✕</span>
                      <span>Not Repaired / Unfixable</span>
                    </button>
                  </div>
                </div>

                {/* Refund handling for Not Repaired jobs */}
                {editRepairOutcome === 'Not Repaired' && (
                  <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                    {(() => {
                      const refundableAmount = getRefundableAmount(editingJob);
                      const hasRefund = editAdvanceRefunded;
                      return (
                        <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-amber-900 text-xs flex items-center gap-1">
                          ⚠️ Device Not Repaired
                          {refundableAmount > 0 ? (
                            <span className="text-rose-700 font-extrabold">| Amount to Return: ₹{refundableAmount.toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-600 font-normal">(No Payment Taken)</span>
                          )}
                        </span>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          Billing and fixes are disabled for unrepairable devices. Any advance or bill payment must be returned before marking the refund complete.
                        </p>
                      </div>

                      {refundableAmount > 0 ? (
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs shrink-0">
                          <input
                            type="checkbox"
                            checked={editAdvanceRefunded}
                            onChange={(e) => setEditAdvanceRefunded(e.target.checked)}
                            className="w-4 h-4 text-amber-600 rounded"
                          />
                          <span className="font-bold text-xs text-amber-900">{hasRefund ? `Mark ₹${refundableAmount.toLocaleString('en-IN')} Returned` : `Return ₹${refundableAmount.toLocaleString('en-IN')}`}</span>
                        </label>
                      ) : null}
                    </div>

                    {refundableAmount > 0 && editAdvanceRefunded && (
                      <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60 text-xs">
                        <label className="font-bold text-amber-900 uppercase text-[10px]">Refund Payment Mode:</label>
                        <select
                          value={editAdvanceRefundMode}
                          onChange={(e) => setEditAdvanceRefundMode(e.target.value)}
                          className="border border-amber-300 bg-white rounded-lg px-2.5 py-1 font-semibold text-slate-800"
                        >
                          <option value="UPI">UPI / GPay / PhonePe</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                        <span className="text-emerald-700 font-bold ml-auto text-[11px]">✓ Refund will be added to Payment History after save</span>
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Spare Parts & Replaced Components Section */}
                {editRepairOutcome !== 'Not Repaired' && (
                  <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <span>Spare Parts & Products Consumed in Repair</span>
                          {editPartsUsed.length > 0 && (
                            <span className="bg-teal-100 text-teal-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                              {editPartsUsed.length} item{editPartsUsed.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Add any spare parts or replaced components here. Their cost automatically calculates into the final bill and flows to the tax invoice.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPartRow}
                        className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Spare Part</span>
                      </button>
                    </div>

                    {editPartsUsed.length === 0 ? (
                      <div className="text-center py-3 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                        No spare parts added yet. Click <span className="font-bold text-teal-600">"+ Add Spare Part"</span> if any hardware/parts were replaced.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editPartsUsed.map((part, idx) => (
                          <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-12 sm:col-span-5">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Part / Product</label>
                              <div className="space-y-1">
                                <select
                                  value={part.productId || ''}
                                  onChange={(e) => handleUpdatePartRow(idx, 'productId', e.target.value)}
                                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 bg-white font-medium text-slate-800"
                                >
                                  <option value="">-- Choose from Catalog or Type below --</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} (Stock: {p.stock || p.stockQty || 0} | ₹{p.sellingPrice || p.price || 0})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Or custom spare part name..."
                                  value={part.productName}
                                  onChange={(e) => handleUpdatePartRow(idx, 'productName', e.target.value)}
                                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 font-medium text-slate-700"
                                />
                              </div>
                            </div>

                            <div className="col-span-4 sm:col-span-2">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Price (₹)</label>
                              <input
                                type="number"
                                min={0}
                                value={part.unitPrice === 0 ? '' : part.unitPrice}
                                onChange={(e) => handleUpdatePartRow(idx, 'unitPrice', e.target.value === '' ? 0 : Number(e.target.value))}
                                placeholder="0"
                                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 font-mono font-semibold"
                              />
                            </div>

                            <div className="col-span-3 sm:col-span-2">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Qty</label>
                              <input
                                type="number"
                                min={1}
                                value={part.qty}
                                onChange={(e) => handleUpdatePartRow(idx, 'qty', Math.max(1, Number(e.target.value || 1)))}
                                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 font-mono text-center font-semibold"
                              />
                            </div>

                            <div className="col-span-4 sm:col-span-2">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Total (₹)</label>
                              <div className="text-xs font-mono font-bold text-slate-800 py-1.5">
                                ₹{(part.qty * part.unitPrice).toLocaleString('en-IN')}
                              </div>
                            </div>

                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemovePartRow(idx)}
                                title="Remove Part"
                                className="text-rose-500 hover:text-rose-700 p-1 rounded-md transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Breakdown summary */}
                        <div className="bg-teal-50/50 p-2.5 rounded-lg border border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Base Labor / Service:</span>
                            <div className="flex items-center gap-1 font-mono">
                              <span>₹</span>
                              <input
                                type="number"
                                min={0}
                                value={editServiceCharge === 0 ? '' : editServiceCharge}
                                onChange={(e) => handleServiceChargeChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                placeholder="0"
                                className="w-24 bg-white border border-teal-300 rounded px-2 py-1 font-bold text-slate-800"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3 font-medium text-slate-600">
                            <span>Spare Parts: <strong className="font-mono text-slate-900">₹{calculatePartsSum(editPartsUsed).toLocaleString('en-IN')}</strong></span>
                            <span className="text-teal-700 font-extrabold text-xs sm:text-sm">Final Bill: <strong className="font-mono text-teal-800">₹{editFinalBill.toLocaleString('en-IN')}</strong></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1 sm:col-span-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Estimate Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={editEstimate === 0 ? '' : editEstimate}
                    onChange={(e) => setEditEstimate(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <label className="block font-bold text-teal-700 uppercase text-[10px] flex items-center justify-between">
                    <span>Final Bill Amount (₹)</span>
                    {editPartsUsed.length > 0 && (
                      <span className="text-teal-600 text-[9px] font-semibold">(Labor + Parts)</span>
                    )}
                    {editRepairOutcome === 'Not Repaired' && <span className="text-rose-600 text-[9px]">(₹0 - Not Repaired)</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={editRepairOutcome === 'Not Repaired'}
                    placeholder="0.00"
                    value={editRepairOutcome === 'Not Repaired' ? 0 : (editFinalBill === 0 ? '' : editFinalBill)}
                    onChange={(e) => handleFinalBillChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={`w-full border-2 rounded-xl px-3 py-1.5 font-mono font-black text-xs ${
                      editRepairOutcome === 'Not Repaired'
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-teal-500 bg-teal-50/20 text-slate-800'
                    }`}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Repair Action / Fix Taken</label>
                  <textarea
                    rows={1}
                    value={editActionTaken}
                    onChange={(e) => setEditActionTaken(e.target.value)}
                    placeholder="Describe repair work carried out..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Delivery Logistics Status</label>
                  <select
                    value={editDeliveryStatus}
                    onChange={(e) => setEditDeliveryStatus(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 font-semibold"
                  >
                    <option value="Handed Over">Direct Handover (Walk-in)</option>
                    <option value="Dispatched">Dispatched via Courier</option>
                    <option value="Pending">Pending Delivery</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Courier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. BlueDart / DTDC / SpeedPost"
                    value={editCourierName}
                    onChange={(e) => setEditCourierName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase">Tracking / Docket Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. AWB129384729"
                    value={editTrackingNo}
                    onChange={(e) => setEditTrackingNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 sm:col-span-2 pt-1">
                  <input
                    type="checkbox"
                    id="editIsReturnCase"
                    checked={editIsReturnCase}
                    onChange={(e) => setEditIsReturnCase(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="editIsReturnCase" className="font-bold text-slate-700 cursor-pointer">
                    Mark as Warranty Return / Free Service Case
                  </label>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedJob(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" /> Save & Send WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedJob(false)}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition cursor-pointer shadow-sm"
              >
                Save Outward Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Document Viewer Modal */}
      {previewJob && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewJob(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full my-8 overflow-hidden flex flex-col animate-slide-up cursor-default text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <span className="font-bold uppercase tracking-wider text-teal-400">Outward Slip Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (previewJob) {
                      handleTriggerWhatsApp(previewJob);
                    }
                  }}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-3 py-1 rounded-lg transition cursor-pointer"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-xs font-bold px-3 py-1 rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => setPreviewJob(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-100 space-y-4">
              <div className="printable-area bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-black text-slate-800 uppercase">{companyConfig.name}</h2>
                    <p className="text-[10px] text-slate-400">{companyConfig.address}</p>
                    <p className="text-[10px] text-slate-400">Phone: {companyConfig.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-900 text-white text-[9px] px-2.5 py-0.5 rounded font-black tracking-widest uppercase">Outward Slip</span>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">{previewJob.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px]">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Client Name</span>
                    <span className="font-bold text-slate-800">{previewJob.clientName}</span>
                    <span className="block font-mono text-slate-500">{previewJob.clientMobile}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Equipment / Serial</span>
                    <span className="font-bold text-slate-800">{previewJob.equipment} ({previewJob.productName || 'Device'})</span>
                    <span className="block font-mono text-slate-500">S/N: {previewJob.serialNo}</span>
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Repair Action / Fix:</span>
                    <span className="font-semibold text-slate-700">{previewJob.actionTaken || 'Inspected & Repaired'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Job Status:</span>
                    <span className="font-bold text-purple-700">{previewJob.status}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Estimate Amount:</span>
                    <span className="font-mono text-slate-700">₹{(previewJob.estimateAmount || 0).toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Final Payable Bill Amount:</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">₹{getEffectiveBillAmount(previewJob).toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivery Logistics:</span>
                    <span className="font-medium text-slate-700">{previewJob.deliveryStatus || 'Handed Over'} {previewJob.courierName ? `(${previewJob.courierName} - AWB: ${previewJob.trackingNo || 'N/A'})` : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Locked Add-on Feature Modal */}
      <LockedAddonModal
        isOpen={!!lockedAddon}
        onClose={() => setLockedAddon(null)}
        addonType={lockedAddon || 'whatsapp'}
        orgName={companyConfig.name}
      />
    </div>
  );
}
