import React, { useState } from 'react';
import {
  ServicePartner,
  ServicePartnerPayment,
  RepairJob,
  SystemUser
} from '../types';
import {
  ArrowLeft,
  Wrench,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  AlertCircle,
  Clock,
  Briefcase,
  Plus,
  CreditCard,
  Building,
  User,
  ShieldCheck,
  Send,
  Truck
} from 'lucide-react';

interface ServicePartnerDetailProps {
  partner: ServicePartner;
  jobs: RepairJob[];
  partnerPayments: ServicePartnerPayment[];
  onBack: () => void;
  onRecordPayment: (payment: Omit<ServicePartnerPayment, 'id'>) => void;
  onUpdateJob: (job: RepairJob) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function ServicePartnerDetail({
  partner,
  jobs,
  partnerPayments,
  onBack,
  onRecordPayment,
  onUpdateJob,
  onNavigateToJob
}: ServicePartnerDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'jobs' | 'payments'>('overview');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState<'All' | 'With Partner' | 'Received back' | 'Completed'>('All');

  // Filter repair jobs assigned or sent to this partner
  const partnerJobs = jobs.filter(
    (j) =>
      j.servicePartnerId === partner.id ||
      ((j.repairType === 'EXTERNAL_PARTNER' || j.repairType === 'External Service Partner') &&
        ((j.servicePartnerName && j.servicePartnerName.toLowerCase() === partner.name.toLowerCase()) ||
         (j.externalVendorName && j.externalVendorName.toLowerCase() === partner.name.toLowerCase())))
  );

  // Financial aggregates
  const totalRepairCharges = partnerJobs.reduce((sum, j) => sum + (j.servicePartnerCost || 0), 0);
  const totalPaidDirectOnJobs = partnerJobs.reduce((sum, j) => sum + (j.servicePartnerPaid || 0), 0);
  const totalLumpSumPayments = partnerPayments
    .filter((p) => p.servicePartnerId === partner.id)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaidToPartner = Math.max(totalPaidDirectOnJobs, totalLumpSumPayments);
  const outstandingPayable = Math.max(0, totalRepairCharges - totalPaidToPartner);

  const activeWithPartnerJobs = partnerJobs.filter(
    (j) => j.partnerStatus === 'Sent to Partner' || j.partnerStatus === 'In Repair' || (!j.partnerStatus && j.status === 'In Progress')
  );

  // Filtered jobs list
  const filteredJobs = partnerJobs.filter((j) => {
    if (jobStatusFilter === 'All') return true;
    if (jobStatusFilter === 'With Partner') {
      return j.partnerStatus === 'Sent to Partner' || j.partnerStatus === 'In Repair';
    }
    if (jobStatusFilter === 'Received back') {
      return j.partnerStatus === 'Received from Partner';
    }
    if (jobStatusFilter === 'Completed') {
      return j.partnerStatus === 'Settled' || j.status === 'Delivered';
    }
    return true;
  });

  // Payment Form States
  const [payAmount, setPayAmount] = useState<number>(outstandingPayable);
  const [payMode, setPayMode] = useState<'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque'>('UPI');
  const [payRefNo, setPayRefNo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(() =>
    partnerJobs.filter((j) => (j.servicePartnerCost || 0) > (j.servicePartnerPaid || 0)).map((j) => j.id)
  );

  const toggleSelectJob = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }

    let remaining = payAmount;
    const allocations: { jobId: string; jobNo: string; amount: number }[] = [];

    // Allocate payment sequentially to chosen repair jobs
    partnerJobs
      .filter((j) => selectedJobIds.includes(j.id))
      .forEach((j) => {
        const cost = j.servicePartnerCost || 0;
        const paid = j.servicePartnerPaid || 0;
        const due = Math.max(0, cost - paid);

        if (remaining > 0 && due > 0) {
          const allocateThis = Math.min(remaining, due);
          allocations.push({
            jobId: j.id,
            jobNo: j.id,
            amount: allocateThis
          });
          // Update job's direct servicePartnerPaid attribute
          onUpdateJob({
            ...j,
            servicePartnerPaid: paid + allocateThis,
            partnerStatus: paid + allocateThis >= cost ? 'Settled' : j.partnerStatus
          });
          remaining -= allocateThis;
        }
      });

    onRecordPayment({
      servicePartnerId: partner.id,
      servicePartnerName: partner.name,
      date: new Date().toISOString().split('T')[0],
      amount: payAmount,
      paymentMode: payMode,
      referenceNo: payRefNo,
      notes: payNotes,
      allocations,
      unallocatedAmount: remaining > 0 ? remaining : 0,
      createdAt: new Date().toISOString()
    });

    setShowPaymentModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="service-partner-detail-view">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
            title="Back to Service Partners List"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                {partner.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  partner.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {partner.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
              <span>{partner.companyName || 'External Repair Lab'}</span>
              <span>•</span>
              <span className="font-mono font-bold text-slate-600">{partner.id}</span>
              {partner.gstin && (
                <>
                  <span>•</span>
                  <span className="font-mono text-slate-600">GST: {partner.gstin}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setPayAmount(outstandingPayable);
              setShowPaymentModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pay Partner Dues</span>
          </button>
        </div>
      </div>

      {/* 4 Partner Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Sent Jobs</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {partnerJobs.length}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {activeWithPartnerJobs.length} active in bench/transit
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Repair Cost</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-700 font-mono">
            ₹{totalRepairCharges.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Vendor labor &amp; BGA rework costs
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            ₹{totalPaidToPartner.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">Disbursed to partner</p>
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
            {outstandingPayable === 0 ? '✓ Dues Clear' : 'Pending vendor settlement'}
          </p>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Overview & Contacts', icon: Wrench },
          { id: 'jobs', label: `Sent Repair Jobs (${partnerJobs.length})`, icon: Briefcase },
          { id: 'payments', label: `Partner Payments (${partnerPayments.filter((p) => p.servicePartnerId === partner.id).length})`, icon: DollarSign }
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

      {/* Tab 1: Overview */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-teal-600" /> Lab Details &amp; Contact
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Contact Person</span>
                <span className="font-bold text-slate-800">{partner.contactPerson || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Mobile Number</span>
                <span className="font-mono font-bold text-teal-700 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-teal-600" /> {partner.mobile}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Alternate Phone</span>
                <span className="font-mono text-slate-600">{partner.alternateNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Email</span>
                <span className="text-slate-600 font-medium truncate block">{partner.email || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Workshop Address</span>
                <span className="text-slate-700 font-medium flex items-start gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  {partner.address || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" /> Capabilities &amp; Notes
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">GSTIN</span>
                <span className="font-mono font-black text-slate-800">{partner.gstin || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">PAN</span>
                <span className="font-mono font-black text-slate-800">{partner.pan || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Specialization &amp; Scope</span>
                <p className="text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                  {partner.notes || 'Chip level motherboard, screen panel bonding & external specialized repairs.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sent Repair Jobs History */}
      {activeSubTab === 'jobs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" /> Repair Jobs Sent to {partner.name}
              </h3>
              <span className="text-xs font-bold text-slate-500 font-mono">
                ({filteredJobs.length} jobs)
              </span>
            </div>

            {/* Quick Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              {(['All', 'With Partner', 'Received back', 'Completed'] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  onClick={() => setJobStatusFilter(filterOpt)}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                    jobStatusFilter === filterOpt
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filterOpt}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Job No / Customer</th>
                  <th className="py-3 px-4">Equipment &amp; Serial</th>
                  <th className="py-3 px-4">Fault / Problem</th>
                  <th className="py-3 px-4">Sent Date / Ref</th>
                  <th className="py-3 px-4 text-center">Partner Status</th>
                  <th className="py-3 px-4 text-right">Partner Cost</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => {
                    const cost = job.servicePartnerCost || 0;
                    const paid = job.servicePartnerPaid || 0;
                    const balance = Math.max(0, cost - paid);

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onNavigateToJob && onNavigateToJob(job.id)}
                            className="font-mono font-black text-teal-700 hover:underline cursor-pointer block text-left"
                          >
                            {job.id}
                          </button>
                          <p className="text-[11px] font-bold text-slate-800">{job.clientName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{job.clientMobile}</p>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">
                            {job.brand} {job.model}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            SN: {job.serialNumber || '—'}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          <p className="text-slate-700 font-medium max-w-[180px] truncate" title={job.problem}>
                            {job.problem}
                          </p>
                          {job.diagnosis && (
                            <p className="text-[10px] text-teal-700 font-mono truncate max-w-[180px]">
                              Diag: {job.diagnosis}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-mono text-slate-700">{job.sentToPartnerDate || job.createdAt.split(' ')[0]}</p>
                          <p className="text-[10px] font-mono text-slate-400">
                            Challan: {job.partnerChallanNumber || '—'}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              job.partnerStatus === 'Received from Partner'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : job.partnerStatus === 'In Repair'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {job.partnerStatus || 'Sent to Partner'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          ₹{cost.toLocaleString('en-IN')}.00
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          ₹{paid.toLocaleString('en-IN')}.00
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          ₹{balance.toLocaleString('en-IN')}.00
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                      No repair jobs found under this status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Partner Payments */}
      {activeSubTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Payments Made to {partner.name}
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
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Ref / Transaction No</th>
                  <th className="py-3 px-4">Allocated Job Cards</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {partnerPayments.filter((p) => p.servicePartnerId === partner.id).length > 0 ? (
                  partnerPayments
                    .filter((p) => p.servicePartnerId === partner.id)
                    .map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-black text-slate-900">{pay.id}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{pay.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{pay.paymentMode}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{pay.referenceNo || '—'}</td>
                        <td className="py-3 px-4">
                          {pay.allocations && pay.allocations.length > 0 ? (
                            <div className="space-y-0.5">
                              {pay.allocations.map((a, idx) => (
                                <div key={idx} className="text-[11px] text-slate-700">
                                  <span className="font-mono font-bold text-blue-600">{a.jobNo}</span>: ₹
                                  {a.amount.toLocaleString('en-IN')}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Direct lump-sum</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                          ₹{pay.amount.toLocaleString('en-IN')}.00
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                      No payments recorded for this service partner yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lump-Sum Multi-Job Payment Modal */}
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
                  Pay Service Partner ({partner.name})
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Allocate repair costs across completed or received Job Cards.
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
                    Disbursed Amount (₹) *
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

              {/* Multi-Job Selection & Auto Allocation Section */}
              <div className="space-y-2 border rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Allocate across Outstanding Job Cards:</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Selected: {selectedJobIds.length} jobs
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {partnerJobs.filter((j) => (j.servicePartnerCost || 0) > (j.servicePartnerPaid || 0)).length > 0 ? (
                    partnerJobs
                      .filter((j) => (j.servicePartnerCost || 0) > (j.servicePartnerPaid || 0))
                      .map((j) => {
                        const cost = j.servicePartnerCost || 0;
                        const paid = j.servicePartnerPaid || 0;
                        const due = Math.max(0, cost - paid);
                        const isSelected = selectedJobIds.includes(j.id);

                        return (
                          <label
                            key={j.id}
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
                                onChange={() => toggleSelectJob(j.id)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <span className="font-mono font-bold text-slate-800">{j.id}</span>
                                <span className="text-[11px] text-slate-600 ml-1.5 font-semibold">
                                  {j.brand} {j.model}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-black text-amber-700">₹{due.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-400 block">Total: ₹{cost.toLocaleString('en-IN')}</span>
                            </div>
                          </label>
                        );
                      })
                  ) : (
                    <p className="text-center text-xs text-slate-400 py-3 italic">
                      No unpaid jobs for this service partner.
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
                  placeholder="Optional notes..."
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
                  Confirm &amp; Disburse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
