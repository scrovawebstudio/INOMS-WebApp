import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Building,
  Calendar,
  AlertCircle,
  Sparkles,
  Check,
  X,
  Search,
  ExternalLink,
  Phone,
  CreditCard,
  QrCode,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { TenantOrg } from './AuthModal';
import { SubscriptionRenewalRequest } from '../types';

const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface DirectRenewalQueueProps {
  tenants: TenantOrg[];
  renewalRequests: SubscriptionRenewalRequest[];
  onApproveRenewal: (request: SubscriptionRenewalRequest) => void;
  onRejectRenewal: (requestId: string) => void;
  onRefresh?: () => void;
}

export default function DirectRenewalQueue({
  tenants,
  renewalRequests,
  onApproveRenewal,
  onRejectRenewal,
  onRefresh
}: DirectRenewalQueueProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pendingRequests = renewalRequests.filter(r => r.status === 'pending');
  const approvedRequests = renewalRequests.filter(r => r.status === 'approved');
  const rejectedRequests = renewalRequests.filter(r => r.status === 'rejected');

  const filtered = renewalRequests.filter(req => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        req.tenantName?.toLowerCase().includes(q) ||
        req.tenantCode?.toLowerCase().includes(q) ||
        req.ownerMobile?.includes(q) ||
        req.utrNumber?.toLowerCase().includes(q) ||
        req.planTitle?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleApprove = (req: SubscriptionRenewalRequest) => {
    setApprovingId(req.id);
    setTimeout(() => {
      onApproveRenewal(req);
      setApprovingId(null);
    }, 400);
  };

  const handleOpenWhatsAppToOwner = (req: SubscriptionRenewalRequest) => {
    const rawMobile = req.ownerMobile.replace(/\D/g, '');
    const mobile10 = rawMobile.slice(-10);
    const text = encodeURIComponent(
      `Hello ${req.ownerName || 'Admin'},\n\n` +
      `✅ Your subscription renewal request for *${req.tenantName}* (${req.tenantCode}) has been verified and *ACTIVATED* successfully by Platform Master Admin!\n\n` +
      `📋 Plan: *${req.planTitle}*\n` +
      `💳 Amount: *₹${req.amount.toLocaleString('en-IN')}*\n` +
      `🔗 UTR No: *${req.utrNumber}*\n\n` +
      `Your organization workspace is fully active now. Thank you for choosing our Platform!`
    );
    window.open(`https://wa.me/91${mobile10}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 p-5 sm:p-7 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-teal-500/20">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-500/30">
              <QrCode className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Direct UPI Renewal Requests Queue
                </h2>
                {pendingRequests.length > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">
                    {pendingRequests.length} PENDING
                  </span>
                )}
              </div>
              <p className="text-xs text-teal-200/90 mt-0.5">
                Instant UPI payments submitted by organizations with 12-digit UTR references for quick 1-click verification &amp; reactivation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Queue</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div 
          onClick={() => setFilterStatus('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'pending'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-amber-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Approval</p>
              <h3 className="text-2xl font-black text-amber-800 mt-1">{pendingRequests.length}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-2 font-medium">Requires UTR verification</p>
        </div>

        <div 
          onClick={() => setFilterStatus('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-emerald-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approved &amp; Active</p>
              <h3 className="text-2xl font-black text-emerald-800 mt-1">{approvedRequests.length}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-800/80 mt-2 font-medium">Workspaces successfully renewed</p>
        </div>

        <div 
          onClick={() => setFilterStatus('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'rejected'
              ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/30 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-rose-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Rejected</p>
              <h3 className="text-2xl font-black text-rose-800 mt-1">{rejectedRequests.length}</h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200">
              <X className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-rose-800/80 mt-2 font-medium">Invalid or mismatched UTRs</p>
        </div>

        <div 
          onClick={() => setFilterStatus('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-teal-500/10 border-teal-500 ring-2 ring-teal-500/30 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-teal-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Total Renewal Volume</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                ₹{renewalRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl border border-slate-200">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">{renewalRequests.length} total direct requests</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Requests ({renewalRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'pending' ? 'bg-amber-500 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending</span>
            {pendingRequests.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${filterStatus === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('approved')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterStatus === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved ({approvedRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterStatus === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rejected ({rejectedRequests.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Org, Code, Mobile, UTR..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-teal-600"
          />
        </div>
      </div>

      {/* Main Request Cards / Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <QrCode className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Direct UPI Renewal Requests Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {filterStatus === 'pending'
              ? 'Great news! There are currently no pending subscription renewal approvals. All workspaces are up-to-date.'
              : 'When organizations pay via direct UPI QR code during login or settings, their UTR and proof will appear here for 1-click verification.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((req) => {
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';
            const tenantMatch = tenants.find(t => t.id === req.tenantId || t.code === req.tenantCode);

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/20'
                    : isApproved
                    ? 'border-emerald-200 bg-white'
                    : 'border-rose-200 bg-rose-50/10 opacity-75'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Org & Request Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-2 bg-slate-100 text-slate-800 rounded-xl font-mono text-xs font-black">
                        {req.tenantCode || 'WORKSPACE'}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        <span>{req.tenantName}</span>
                        {tenantMatch && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            tenantMatch.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            Current Status: {tenantMatch.status.toUpperCase()}
                          </span>
                        )}
                      </h4>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                        <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <div>
                          <span className="text-[9px] text-slate-400 block font-semibold">Contact / Mobile</span>
                          <span className="font-bold text-slate-800">{req.ownerMobile}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[9px] text-slate-400 block font-semibold">Plan &amp; Amount</span>
                          <span className="font-extrabold text-emerald-700">₹{req.amount.toLocaleString('en-IN')} ({req.planTitle})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-amber-50/70 px-2.5 py-1.5 rounded-xl border border-amber-200/80">
                        <QrCode className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <div>
                          <span className="text-[9px] text-amber-800 font-bold block uppercase tracking-wide">12-Digit UTR Number</span>
                          <span className="font-mono font-black text-slate-900 tracking-wide select-all text-[11px] bg-white px-1.5 py-0.2 rounded border border-amber-300">
                            {req.utrNumber}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div>
                          <span className="text-[9px] text-slate-400 block font-semibold">Submitted On</span>
                          <span className="font-bold text-slate-700">
                            {new Date(req.submittedAt || req.createdAt || Date.now()).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Selected Add-on Features Breakdown */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Included Plan Features &amp; Add-ons:</span>
                        </span>
                        {req.selectedAddonTitles && req.selectedAddonTitles.length > 0 ? (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            {req.selectedAddonTitles.length} Add-on{req.selectedAddonTitles.length > 1 ? 's' : ''} Selected (+₹{req.addonsAmount || 0})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Base Plan Only (No Add-ons)
                          </span>
                        )}
                      </div>

                      {req.selectedAddonTitles && req.selectedAddonTitles.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {req.selectedAddonTitles.map((title, idx) => (
                            <span
                              key={idx}
                              className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center gap-1 shadow-2xs"
                            >
                              <span className="text-[9px] text-teal-600">✓</span>
                              <span>{title}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Only standard core modules (Inwards, Outwards, Billing, Payments, Clients, Inventory, Expenses, Reports, Settings) will be enabled upon approval. Unselected add-ons remain locked.
                        </p>
                      )}
                    </div>

                    {req.notes && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200/60 italic">
                        &ldquo;{req.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(req)}
                          disabled={approvingId === req.id}
                          className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>{approvingId === req.id ? 'Activating...' : 'Approve & Activate Workspace'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onRejectRenewal(req.id)}
                          className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : isApproved ? (
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="text-right text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Activated on {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString('en-IN') : 'Completed'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppToOwner(req)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Send WhatsApp Confirmation to Owner"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
                          <span>Send WhatsApp Confirmation</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-right text-[11px] text-rose-800 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Request Rejected</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
