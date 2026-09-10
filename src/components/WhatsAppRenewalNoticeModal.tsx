import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Building,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  ShieldCheck,
  RefreshCw,
  Globe,
  Share2,
  MessageCircle,
  CreditCard,
  Layers,
  ArrowRight
} from 'lucide-react';
import { TenantOrg } from './AuthModal';
import { CompanyConfig, AddonPricingConfig } from '../types';
import {
  generateRenewalWhatsAppMessage,
  cleanWhatsAppNumber,
  getOrganizationSubscriptionStatus,
  WhatsAppNoticeType
} from '../lib/whatsappRenewalNotice';

export const WhatsAppSvgIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface WhatsAppRenewalNoticeModalProps {
  tenant: TenantOrg | null;
  isOpen: boolean;
  onClose: () => void;
  companyConfig?: CompanyConfig;
  pricingConfig?: AddonPricingConfig;
}

export default function WhatsAppRenewalNoticeModal({
  tenant,
  isOpen,
  onClose,
  companyConfig,
  pricingConfig
}: WhatsAppRenewalNoticeModalProps) {
  if (!isOpen || !tenant) return null;

  // Derive master admin settings from props or storage
  const effectiveConfig = useMemo(() => {
    if (companyConfig && (companyConfig.website || companyConfig.upiId || companyConfig.phone)) {
      return companyConfig;
    }
    try {
      const savedAdmin = localStorage.getItem('company_config_org-admin');
      if (savedAdmin) return JSON.parse(savedAdmin);
    } catch {}
    return companyConfig || {};
  }, [companyConfig]);

  const [noticeType, setNoticeType] = useState<WhatsAppNoticeType>('auto');
  const [targetPhone, setTargetPhone] = useState<string>(() => tenant.ownerMobile || '');
  const [customNote, setCustomNote] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isEditedManually, setIsEditedManually] = useState<boolean>(false);

  // Compute status
  const subInfo = useMemo(() => {
    return getOrganizationSubscriptionStatus(tenant);
  }, [tenant]);

  // Re-generate default message when template, tenant, or note changes
  useEffect(() => {
    if (!isEditedManually) {
      const gen = generateRenewalWhatsAppMessage({
        tenant,
        companyConfig: effectiveConfig,
        pricingConfig,
        noticeType,
        customNote
      });
      setMessageText(gen.message);
    }
  }, [tenant, effectiveConfig, pricingConfig, noticeType, customNote, isEditedManually]);

  // Reset when a different tenant is opened
  useEffect(() => {
    setTargetPhone(tenant.ownerMobile || '');
    setNoticeType('auto');
    setIsEditedManually(false);
    setCustomNote('');
  }, [tenant.id]);

  const handleResetToDefault = () => {
    setIsEditedManually(false);
    const gen = generateRenewalWhatsAppMessage({
      tenant,
      companyConfig: effectiveConfig,
      pricingConfig,
      noticeType,
      customNote
    });
    setMessageText(gen.message);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  const handleSendWhatsApp = () => {
    const cleanNumber = cleanWhatsAppNumber(targetPhone);
    if (!cleanNumber) {
      alert('Please enter a valid owner mobile number to send this notice via WhatsApp.');
      return;
    }
    const encoded = encodeURIComponent(messageText);
    const url = `https://wa.me/${cleanNumber}?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Detected links list for badge indicators
  const detectedLinks = useMemo(() => {
    const links: { label: string; value: string; icon: string }[] = [];
    if (effectiveConfig.website) links.push({ label: 'Website', value: effectiveConfig.website, icon: '🌐' });
    if (effectiveConfig.whatsappChannelUrl) links.push({ label: 'WhatsApp Channel', value: effectiveConfig.whatsappChannelUrl, icon: '💬' });
    if (effectiveConfig.googleReviewUrl) links.push({ label: 'Google Review', value: effectiveConfig.googleReviewUrl, icon: '⭐' });
    if (effectiveConfig.instagramUrl) links.push({ label: 'Instagram', value: effectiveConfig.instagramUrl, icon: '📸' });
    if (effectiveConfig.facebookUrl) links.push({ label: 'Facebook', value: effectiveConfig.facebookUrl, icon: '📘' });
    if (effectiveConfig.youtubeUrl) links.push({ label: 'YouTube', value: effectiveConfig.youtubeUrl, icon: '🎥' });
    if (effectiveConfig.upiId) links.push({ label: 'UPI ID', value: effectiveConfig.upiId, icon: '💳' });
    if (effectiveConfig.phone) links.push({ label: 'Support Mobile', value: effectiveConfig.phone, icon: '📞' });
    return links;
  }, [effectiveConfig]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 px-5 py-4 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-2xl border border-white/15 text-emerald-300">
              <WhatsAppSvgIcon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Send WhatsApp Expiry &amp; Renewal Notice
              </h3>
              <p className="text-xs text-emerald-200/90 font-medium">
                Share subscription status, renewal pricing options, and your setting links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
          {/* Target Organization Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 text-sm">{tenant.name}</span>
                  <span className="text-[11px] font-mono bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md">
                    {tenant.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span>Owner: <strong className="text-slate-700">{tenant.ownerName || 'Admin'}</strong></span>
                  <span>•</span>
                  <span>Plan: <strong className="text-teal-700">{subInfo.planLabel}</strong></span>
                </p>
              </div>

              {/* Status Badge */}
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-2xs ${
                  subInfo.badgeType === 'expired'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : subInfo.badgeType === 'urgent'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : subInfo.badgeType === 'warning'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{subInfo.statusText}</span>
                  <span className="text-[10px] opacity-75 font-normal">({subInfo.validUntil})</span>
                </span>
              </div>
            </div>

            {/* Recipient WhatsApp Phone Input */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Recipient Mobile:</span>
              </label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={targetPhone}
                  onChange={e => setTargetPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                  wa.me: <strong className="text-emerald-700">{cleanWhatsAppNumber(targetPhone) || 'None'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Template Selection Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Notice Template Style:</span>
              {isEditedManually && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700 cursor-pointer flex items-center gap-1"
                  title="Restore original auto-generated template"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset to Auto Template</span>
                </button>
              )}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setNoticeType('auto');
                  setIsEditedManually(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1 ${
                  noticeType === 'auto'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80'
                }`}
              >
                <span>⚡ Auto-Detect</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNoticeType('expired');
                  setIsEditedManually(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1 ${
                  noticeType === 'expired'
                    ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span>🔴 Plan Expired</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNoticeType('expiring');
                  setIsEditedManually(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1 ${
                  noticeType === 'expiring'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span>⏳ Expiring Soon</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNoticeType('advance');
                  setIsEditedManually(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1 ${
                  noticeType === 'advance'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                }`}
              >
                <span>✨ Advance Renewal</span>
              </button>
            </div>
          </div>

          {/* Links & Info Attached From Settings Preview */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>Links &amp; Details Attached From Settings ({detectedLinks.length}):</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">Configured in Master Settings</span>
            </div>
            {detectedLinks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {detectedLinks.map((link, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-emerald-200 rounded-lg text-[11px] font-medium text-slate-700 shadow-2xs"
                    title={link.value}
                  >
                    <span>{link.icon}</span>
                    <strong>{link.label}:</strong>
                    <span className="text-slate-500 truncate max-w-[130px] font-mono text-[10px]">
                      {link.value}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                No custom links detected in Settings yet. You can add your Website, UPI, WhatsApp Channel, and Review URLs from the Settings tab.
              </p>
            )}
          </div>

          {/* WhatsApp Message Preview / Editor Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Message Text (Editable Before Sending):</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  {messageText.length} characters
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                  title="Copy formatted text"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              rows={11}
              value={messageText}
              onChange={e => {
                setMessageText(e.target.value);
                setIsEditedManually(true);
              }}
              placeholder="Notice message text will appear here..."
              className="w-full bg-slate-900 text-emerald-100 font-mono text-xs rounded-2xl p-3.5 border border-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-y selection:bg-emerald-600 selection:text-white"
            />
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3.5 bg-slate-100/80 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied to Clipboard' : 'Copy Notice'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
            >
              <WhatsAppSvgIcon className="w-4 h-4 fill-current" />
              <span>Send on WhatsApp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
