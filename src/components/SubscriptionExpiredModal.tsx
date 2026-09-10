import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Building,
  Calendar,
  Lock,
  ArrowRight,
  RefreshCw,
  CreditCard,
  QrCode,
  Layers,
  Tag,
  Zap,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { TenantOrg } from './AuthModal';
import {
  AddonPricingConfig,
  SubscriptionRenewalRequest,
  InomsPlanTier,
  INOMS_TIER_PLANS,
  InomsTierPlan
} from '../types';
import { getMasterAdminUpiConfig, loadMasterAdminPricingConfig } from '../lib/masterAdminConfig';

const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface SubscriptionExpiredModalProps {
  tenant: TenantOrg;
  pricingConfig?: AddonPricingConfig;
  onRenewRequested: (request: SubscriptionRenewalRequest) => void;
  onClose?: () => void;
}

export default function SubscriptionExpiredModal({
  tenant,
  pricingConfig: propPricingConfig,
  onRenewRequested,
  onClose
}: SubscriptionExpiredModalProps) {
  // Load dynamic configuration from Master Admin
  const activePricingConfig = useMemo(() => {
    return propPricingConfig || loadMasterAdminPricingConfig();
  }, [propPricingConfig]);

  const upiConfig = useMemo(() => {
    return getMasterAdminUpiConfig(activePricingConfig);
  }, [activePricingConfig]);

  // Determine initial tier based on tenant's current plan
  const initialTier: InomsPlanTier = useMemo(() => {
    const p = (tenant.subscriptionPlan || '').toLowerCase();
    if (p.includes('pro')) return 'pro';
    if (p.includes('business')) return 'business';
    return 'basic';
  }, [tenant.subscriptionPlan]);

  const [selectedTier, setSelectedTier] = useState<InomsPlanTier>(initialTier);
  const [selectedDays, setSelectedDays] = useState<number>(() => {
    return initialTier === 'basic' ? 30 : 30;
  });

  const [utrNumber, setUtrNumber] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRequest, setSubmittedRequest] = useState<SubscriptionRenewalRequest | null>(null);

  const currentTierPlan: InomsTierPlan = INOMS_TIER_PLANS[selectedTier] || INOMS_TIER_PLANS.basic;

  // When switching tiers, ensure selected duration is valid for that tier
  const handleSelectTier = (tier: InomsPlanTier) => {
    setSelectedTier(tier);
    const plan = INOMS_TIER_PLANS[tier];
    const hasCurrentDuration = plan.durationOptions.some(d => d.days === selectedDays);
    if (!hasCurrentDuration) {
      setSelectedDays(30);
    }
  };

  const selectedDurationOption = currentTierPlan.durationOptions.find(d => d.days === selectedDays) || currentTierPlan.durationOptions[0];
  const totalPayableAmount = selectedDurationOption.price;

  // Dynamic UPI payment URL for QR code & Direct UPI apps
  const upiPayUrl = `upi://pay?pa=${upiConfig.upiId}&pn=${encodeURIComponent(upiConfig.name)}&am=${totalPayableAmount}&cu=INR&tn=${encodeURIComponent(`Renewal ${tenant.name} (${currentTierPlan.name} ${selectedDurationOption.label})`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayUrl)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiConfig.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleNotifyMasterAdminWhatsApp = (reqData: SubscriptionRenewalRequest) => {
    let msg = `*🔔 INOMS SAAS - SUBSCRIPTION RENEWAL PAYMENT NOTIFICATION*\n\n`;
    msg += `Hello Master Admin,\nI have completed the direct UPI renewal payment for our organization. Kindly verify and reactivate our workspace access.\n\n`;
    msg += `🏢 *Organization:* ${reqData.tenantName} (${reqData.tenantCode})\n`;
    msg += `📱 *Owner Mobile:* ${reqData.ownerMobile}\n`;
    msg += `👤 *Contact Person:* ${reqData.ownerName}\n`;
    msg += `📦 *Subscription Plan:* ${reqData.planTitle}\n`;
    msg += `⏱️ *Duration:* ${reqData.durationDays} Days Access\n`;
    msg += `💰 *Total Amount Paid:* ₹${reqData.amount.toLocaleString('en-IN')}.00\n`;
    msg += `🧾 *UPI Reference / 12-Digit UTR:* ${reqData.utrNumber}\n`;
    msg += `💳 *Paid to Master UPI ID:* ${upiConfig.upiId} (${upiConfig.name})\n`;
    msg += `⏰ *Timestamp:* ${new Date().toLocaleString('en-IN')}\n\n`;
    if (reqData.notes) {
      msg += `📝 *Notes:* ${reqData.notes}\n\n`;
    }
    msg += `⚡ *Master Admin Action:* Open Master Admin Panel ➡️ "Direct UPI Renewal Requests" ➡️ Click "Approve & Activate Workspace".`;

    const encoded = encodeURIComponent(msg);
    const targetMobile = upiConfig.mobile.replace(/\D/g, '');
    window.open(`https://wa.me/${targetMobile}?text=${encoded}`, '_blank');
  };

  const handleSubmitRenewal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      alert('Please enter the 12-digit UPI UTR / Transaction Reference Number from your payment app.');
      return;
    }

    setIsSubmitting(true);

    const renewalReq: SubscriptionRenewalRequest = {
      id: `RENEW-${Date.now()}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantCode: tenant.code,
      ownerMobile: tenant.ownerMobile,
      ownerName: tenant.ownerName || 'Organization Admin',
      plan: selectedTier,
      planTitle: `${currentTierPlan.name} (${selectedDurationOption.label})`,
      durationDays: selectedDurationOption.days,
      basePlanAmount: totalPayableAmount,
      addonsAmount: 0,
      selectedAddonKeys: currentTierPlan.allowedModules,
      selectedAddonTitles: currentTierPlan.includedFeatures,
      amount: totalPayableAmount,
      utrNumber: utrNumber.trim(),
      paymentMode: 'UPI QR',
      notes: paymentNotes.trim(),
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    onRenewRequested(renewalReq);
    setSubmittedRequest(renewalReq);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto" id="subscription-expired-modal">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-fade-in my-auto max-h-[94vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-5 sm:p-6 relative shrink-0 border-b border-teal-500/30">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-teal-500/20 border border-teal-500/30 rounded-2xl backdrop-blur-xs text-teal-300">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-mono font-black bg-teal-500/25 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/40">
                  {tenant.subscriptionPlan === 'trial' || tenant.isTrial ? 'Trial Period Completed' : 'Subscription Renewal'}
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  Org: {tenant.name} ({tenant.code || tenant.id.slice(0, 6)})
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black mt-1 text-white">
                Choose Your INOMS Subscription Plan
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Select your preferred plan tier and validity period, make direct UPI payment, and enter your 12-digit UTR reference for instant workspace reactivation.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        {submittedRequest ? (
          /* Confirmation State */
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Renewal Request Submitted!</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                Your payment of <strong className="text-slate-900">₹{submittedRequest.amount.toLocaleString('en-IN')}</strong> for <strong>{submittedRequest.planTitle}</strong> (UTR: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-teal-800">{submittedRequest.utrNumber}</code>) has been submitted for verification.
              </p>
            </div>

            {/* High-Visibility WhatsApp Inform Button */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" /> Fast-Track Reactivation
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Instant Verification
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Click the button below to send your renewal confirmation directly to the Master Admin on WhatsApp (+{upiConfig.mobile}) for fast 1-click workspace reactivation!
              </p>
              
              <button
                type="button"
                onClick={() => handleNotifyMasterAdminWhatsApp(submittedRequest)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <WhatsAppIcon className="w-5 h-5" />
                <span>Notify Master Admin via WhatsApp for Instant Approval</span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Return to Login
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Payment & UTR Submission Form */
          <form onSubmit={handleSubmitRenewal} className="p-5 sm:p-6 space-y-6 overflow-y-auto">
            
            {/* Step 1: Select Tier Plan (3 Tiers) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>1. Choose Subscription Tier</span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">
                  Select your workshop operational tier
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Tier 1: Basic */}
                <div
                  onClick={() => handleSelectTier('basic')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedTier === 'basic'
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🟢 Main Product
                      </span>
                      {selectedTier === 'basic' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-2">INOMS Basic</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      Repair, Inward-Outward, Job Sheets, Billing, WhatsApp &amp; Barcode.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-100 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Starting from</span>
                    <span className="text-lg font-black text-emerald-700 font-mono">₹399<span className="text-xs font-normal text-slate-500">/mo</span></span>
                  </div>
                </div>

                {/* Tier 2: Business */}
                <div
                  onClick={() => handleSelectTier('business')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedTier === 'business'
                      ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <span className="absolute -top-2.5 right-3 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                    ⭐ POPULAR
                  </span>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                        🔵 Business Plan
                      </span>
                      {selectedTier === 'business' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-2">INOMS Business</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      Everything in Basic + Purchases, Supplier Ledger &amp; Live Queue.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-blue-100 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Starting from</span>
                    <span className="text-lg font-black text-blue-700 font-mono">₹599<span className="text-xs font-normal text-slate-500">/mo</span></span>
                  </div>
                </div>

                {/* Tier 3: Pro */}
                <div
                  onClick={() => handleSelectTier('pro')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedTier === 'pro'
                      ? 'border-purple-500 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20'
                      : 'border-slate-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <span className="absolute -top-2.5 right-3 bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                    🔥 ULTIMATE
                  </span>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                        🟣 Pro Suite
                      </span>
                      {selectedTier === 'pro' && (
                        <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-2">INOMS Pro</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      Everything in Business + Third-Party Service Partner Outsourcing &amp; Challans.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-purple-100 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Starting from</span>
                    <span className="text-lg font-black text-purple-700 font-mono">₹699<span className="text-xs font-normal text-slate-500">/mo</span></span>
                  </div>
                </div>

              </div>
            </div>

            {/* Step 2: Select Duration Option */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>2. Select Validity Duration ({currentTierPlan.name})</span>
                </label>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {currentTierPlan.durationOptions.length} Duration Options Available
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {currentTierPlan.durationOptions.map(opt => {
                  const isSelected = selectedDays === opt.days;
                  return (
                    <div
                      key={opt.days}
                      onClick={() => setSelectedDays(opt.days)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/60 shadow-sm ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:border-teal-300 bg-white'
                      }`}
                    >
                      {opt.savingsBadge && (
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-200 w-fit mb-1">
                          {opt.savingsBadge}
                        </span>
                      )}
                      <div>
                        <p className="text-xs font-black text-slate-900">{opt.label}</p>
                        <p className="text-base font-black text-teal-700 font-mono mt-1">
                          ₹{opt.price.toLocaleString('en-IN')}
                        </p>
                      </div>
                      {opt.perMonthHint && (
                        <p className="text-[10px] text-slate-500 mt-1 font-mono font-medium">
                          {opt.perMonthHint}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feature Inclusion Checklist for Selected Tier */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-teal-600" />
                  <span>Included in {currentTierPlan.name}:</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 font-mono">
                  {currentTierPlan.includedFeatures.length} Feature Modules Included
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {currentTierPlan.includedFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="text-emerald-600 font-bold text-sm">✓</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Direct UPI QR Code & Payment Details */}
            <div className="bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-3xl p-5 sm:p-6 space-y-5 border border-teal-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 text-teal-300 rounded-xl">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">3. Scan &amp; Pay via Any UPI App</h3>
                    <p className="text-[11px] text-teal-200/80">GPay, PhonePe, Paytm, BHIM, or any Banking App</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">Total Payable</span>
                  <div className="text-2xl font-black font-mono text-amber-300">
                    ₹{totalPayableAmount.toLocaleString('en-IN')}.00
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">
                
                {/* QR Code */}
                <div className="bg-white p-3 rounded-2xl shrink-0 shadow-lg border-2 border-white/20 text-center">
                  <img
                    src={qrCodeUrl}
                    alt="Master Admin UPI Payment QR"
                    className="w-36 h-36 mx-auto rounded-lg"
                  />
                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider block mt-1.5">
                    Scan to Pay ₹{totalPayableAmount}
                  </span>
                </div>

                {/* Account & Copy details */}
                <div className="space-y-3 flex-1 w-full text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-teal-300">Master Admin UPI ID</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-black/40 border border-white/15 px-3 py-1.5 rounded-xl font-mono text-sm font-black text-white tracking-wider flex-1 truncate">
                        {upiConfig.upiId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-400">Payee Name:</span>
                      <p className="font-bold text-white truncate">{upiConfig.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Master Support Mobile:</span>
                      <p className="font-bold text-white truncate">+{upiConfig.mobile}</p>
                    </div>
                  </div>

                  <a
                    href={upiPayUrl}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-2 px-3 rounded-xl border border-white/20 transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-teal-300" />
                    <span>Open UPI Payment App on this device</span>
                  </a>
                </div>

              </div>
            </div>

            {/* Step 4: Enter 12-Digit UTR Transaction ID */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-teal-600" />
                  <span>4. Enter 12-Digit UPI Transaction Reference (UTR / Txn ID) *</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  After completing payment in Google Pay / PhonePe / Paytm / BHIM, copy the 12-digit UTR reference number and paste it below.
                </p>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={utrNumber}
                  onChange={e => setUtrNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 523412345678 or UPI Transaction ID"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-black text-slate-900 tracking-wider outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 uppercase"
                />

                <input
                  type="text"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Optional remarks (e.g. Paid via PhonePe / GPay by Ramesh)"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto text-xs font-bold text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Cancel / Return
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !utrNumber.trim()}
                className="w-full sm:w-auto flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-lg shadow-teal-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Renewal for ₹{totalPayableAmount.toLocaleString('en-IN')}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
