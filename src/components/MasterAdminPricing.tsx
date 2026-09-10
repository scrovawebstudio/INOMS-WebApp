import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  QrCode,
  Tag,
  Calendar,
  CreditCard,
  Phone,
  ShieldCheck,
  Check,
  Zap,
  Layers,
  Info,
  CheckCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import {
  AddonPricingConfig,
  SubscriptionPlanConfig,
  DEFAULT_ADDON_PRICING,
  DEFAULT_SUBSCRIPTION_PLANS,
  INOMS_TIER_PLANS,
  InomsPlanTier
} from '../types';
import {
  loadMasterAdminPricingConfig,
  saveMasterAdminPricingConfig
} from '../lib/masterAdminConfig';

interface MasterAdminPricingProps {
  pricingConfig: AddonPricingConfig;
  onSavePricing: (config: AddonPricingConfig) => void;
  initialTab?: 'plans' | 'upi';
}

export default function MasterAdminPricing({
  pricingConfig: propPricingConfig,
  onSavePricing,
  initialTab = 'plans'
}: MasterAdminPricingProps) {
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'upi'>('plans');
  const [pricing, setPricing] = useState<AddonPricingConfig>(() => {
    return propPricingConfig || loadMasterAdminPricingConfig();
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state when props change
  useEffect(() => {
    if (propPricingConfig) {
      setPricing(propPricingConfig);
      if (propPricingConfig.subscriptionPlans && propPricingConfig.subscriptionPlans.length > 0) {
        setPlans(propPricingConfig.subscriptionPlans);
      }
    }
  }, [propPricingConfig]);

  // Master Admin UPI and Contact Settings State
  const [masterUpi, setMasterUpi] = useState<string>(pricing.masterAdminUpi || 'sujitgajare@okicici');
  const [masterName, setMasterName] = useState<string>(pricing.masterAdminName || 'Master System Admin');
  const [masterMobile, setMasterMobile] = useState<string>(pricing.masterAdminMobile || '+91 8149862034');

  // Plans List State
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(() => {
    return pricing.subscriptionPlans && pricing.subscriptionPlans.length > 0
      ? pricing.subscriptionPlans
      : DEFAULT_SUBSCRIPTION_PLANS;
  });

  // Price helper for finding plan price
  const getPrice = (key: string, defaultAmount: number): number => {
    const p = plans.find(plan => plan.key === key);
    return p ? p.amount : defaultAmount;
  };

  // Update a specific plan amount
  const setPrice = (key: string, amount: number, tier: InomsPlanTier, days: number, title: string) => {
    setPlans(prev => {
      const exists = prev.some(p => p.key === key);
      if (exists) {
        return prev.map(p => p.key === key ? { ...p, amount } : p);
      } else {
        return [
          ...prev,
          {
            key,
            tier,
            title,
            durationDays: days,
            durationLabel: `${days} Days`,
            amount,
            enabled: true
          }
        ];
      }
    });
  };

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const updatedConfig: AddonPricingConfig = {
      ...pricing,
      masterAdminUpi: masterUpi.trim(),
      masterAdminName: masterName.trim(),
      masterAdminMobile: masterMobile.trim(),
      subscriptionPlans: plans,
      basePlatformMonthly: getPrice('basic_30d', 399),
      basePlatformAnnual: getPrice('basic_365d', 2999)
    };

    setPricing(updatedConfig);
    saveMasterAdminPricingConfig(updatedConfig);
    onSavePricing(updatedConfig);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleApplyFinalInomsPreset = () => {
    setPlans(DEFAULT_SUBSCRIPTION_PLANS);

    const updatedConfig: AddonPricingConfig = {
      ...pricing,
      masterAdminUpi: masterUpi.trim(),
      masterAdminName: masterName.trim(),
      masterAdminMobile: masterMobile.trim(),
      subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS,
      basePlatformMonthly: 399,
      basePlatformAnnual: 2999
    };

    setPricing(updatedConfig);
    saveMasterAdminPricingConfig(updatedConfig);
    onSavePricing(updatedConfig);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all plans and pricing to standard system defaults?')) {
      setPricing(DEFAULT_ADDON_PRICING);
      setMasterUpi(DEFAULT_ADDON_PRICING.masterAdminUpi || 'sujitgajare@okicici');
      setMasterName(DEFAULT_ADDON_PRICING.masterAdminName || 'Master System Admin');
      setMasterMobile(DEFAULT_ADDON_PRICING.masterAdminMobile || '+91 8149862034');
      setPlans(DEFAULT_SUBSCRIPTION_PLANS);

      saveMasterAdminPricingConfig(DEFAULT_ADDON_PRICING);
      onSavePricing(DEFAULT_ADDON_PRICING);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Live UPI test QR code URL
  const testQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${masterUpi}&pn=${encodeURIComponent(masterName)}&cu=INR`)}`;

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-teal-600 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              INOMS 3-Tier Subscription Plans &amp; Pricing Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure pricing for the 3 official INOMS product tiers: <strong>Basic (₹399/mo)</strong>, <strong>Business (₹599/mo)</strong>, and <strong>Pro (₹699/mo)</strong> across all validity periods.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer border border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={() => handleSaveAll()}
            className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save All Settings
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 sm:p-4 rounded-2xl flex items-center gap-2.5 sm:gap-3 text-xs font-bold shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>✓ Pricing configuration &amp; UPI settings saved successfully! All organization renewal screens will use these rates immediately.</span>
        </div>
      )}

      {/* Internal Sub-Tabs */}
      <div className="flex items-center bg-slate-200/80 p-1.5 rounded-2xl gap-2 text-xs font-bold w-fit shadow-inner">
        <button
          type="button"
          onClick={() => setActiveSubTab('plans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
            activeSubTab === 'plans'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-teal-600" />
          <span>3-Tier Plans &amp; Validity Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('upi')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
            activeSubTab === 'upi'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-teal-600" />
          <span>Master Admin Direct Renewal UPI Settings</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 3-TIER PLANS & PRICING MATRIX */}
      {/* ========================================================================= */}
      {activeSubTab === 'plans' && (
        <div className="space-y-6">

          {/* Preset Apply Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-teal-500/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-mono font-black bg-teal-500/25 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/40">
                  Official INOMS Product Structure
                </span>
                <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  Basic (₹399) · Business (₹599) · Pro (₹699)
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Finalized Subscription Pricing Matrix
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Edit prices below for each plan duration. Click the button to sync with standard published pricing.
              </p>
            </div>

            <button
              type="button"
              onClick={handleApplyFinalInomsPreset}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition cursor-pointer shrink-0"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Load Final INOMS Pricing Preset</span>
            </button>
          </div>

          {/* Pricing Matrix Table Card */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-teal-600" />
                  <span>💰 Pricing Matrix Configuration Table</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Directly edit prices for every validity duration. Changes take effect on renewal screens upon saving.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 font-black">Plan Tier</th>
                    <th className="py-3.5 px-3">7 Days</th>
                    <th className="py-3.5 px-3">15 Days</th>
                    <th className="py-3.5 px-3">30 Days (1 Mo)</th>
                    <th className="py-3.5 px-3">90 Days (3 Mo)</th>
                    <th className="py-3.5 px-3">180 Days (6 Mo)</th>
                    <th className="py-3.5 px-3">1 Year (365 Days)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  
                  {/* Row 1: INOMS Basic */}
                  <tr className="hover:bg-emerald-50/40 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <div>
                          <span className="font-black text-slate-900 text-sm">INOMS Basic</span>
                          <span className="text-[10px] text-emerald-700 font-bold block">🟢 Main Product</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* 7d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('basic_7d', 99)}
                          onChange={e => setPrice('basic_7d', Number(e.target.value) || 0, 'basic', 7, 'INOMS Basic · 7 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 15d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('basic_15d', 179)}
                          onChange={e => setPrice('basic_15d', Number(e.target.value) || 0, 'basic', 15, 'INOMS Basic · 15 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 30d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('basic_30d', 399)}
                          onChange={e => setPrice('basic_30d', Number(e.target.value) || 0, 'basic', 30, 'INOMS Basic · 30 Days')}
                          className="w-full bg-white border-2 border-emerald-400 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-emerald-800 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 90d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('basic_90d', 999)}
                          onChange={e => setPrice('basic_90d', Number(e.target.value) || 0, 'basic', 90, 'INOMS Basic · 90 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 180d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('basic_180d', 1799)}
                          onChange={e => setPrice('basic_180d', Number(e.target.value) || 0, 'basic', 180, 'INOMS Basic · 180 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 365d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('basic_365d', 2999)}
                          onChange={e => setPrice('basic_365d', Number(e.target.value) || 0, 'basic', 365, 'INOMS Basic · 1 Year')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Row 2: INOMS Business */}
                  <tr className="hover:bg-blue-50/40 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                        <div>
                          <span className="font-black text-slate-900 text-sm">INOMS Business</span>
                          <span className="text-[10px] text-blue-700 font-bold block">🔵 Most Popular ⭐</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* 7d */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-center">
                      —
                    </td>

                    {/* 15d */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-center">
                      —
                    </td>

                    {/* 30d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('business_30d', 599)}
                          onChange={e => setPrice('business_30d', Number(e.target.value) || 0, 'business', 30, 'INOMS Business · 30 Days')}
                          className="w-full bg-white border-2 border-blue-400 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-blue-800 bg-blue-50/50 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 90d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('business_90d', 1499)}
                          onChange={e => setPrice('business_90d', Number(e.target.value) || 0, 'business', 90, 'INOMS Business · 90 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 180d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('business_180d', 2699)}
                          onChange={e => setPrice('business_180d', Number(e.target.value) || 0, 'business', 180, 'INOMS Business · 180 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 365d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('business_365d', 4499)}
                          onChange={e => setPrice('business_365d', Number(e.target.value) || 0, 'business', 365, 'INOMS Business · 1 Year')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Row 3: INOMS Pro */}
                  <tr className="hover:bg-purple-50/40 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                        <div>
                          <span className="font-black text-slate-900 text-sm">INOMS Pro</span>
                          <span className="text-[10px] text-purple-700 font-bold block">🟣 Ultimate Pro 🔥</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* 7d */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-center">
                      —
                    </td>

                    {/* 15d */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-center">
                      —
                    </td>

                    {/* 30d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('pro_30d', 699)}
                          onChange={e => setPrice('pro_30d', Number(e.target.value) || 0, 'pro', 30, 'INOMS Pro · 30 Days')}
                          className="w-full bg-white border-2 border-purple-400 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-purple-800 bg-purple-50/50 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 90d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('pro_90d', 1799)}
                          onChange={e => setPrice('pro_90d', Number(e.target.value) || 0, 'pro', 90, 'INOMS Pro · 90 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 180d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('pro_180d', 3199)}
                          onChange={e => setPrice('pro_180d', Number(e.target.value) || 0, 'pro', 180, 'INOMS Pro · 180 Days')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </td>

                    {/* 365d */}
                    <td className="py-3 px-3">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          value={getPrice('pro_365d', 5499)}
                          onChange={e => setPrice('pro_365d', Number(e.target.value) || 0, 'pro', 365, 'INOMS Pro · 1 Year')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* 3 Plan Feature Scope Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Card 1: Basic */}
            <div className="bg-white border-2 border-emerald-200 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    🟢 Main Product
                  </span>
                  <span className="text-sm font-black text-emerald-700 font-mono">₹399/mo</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">INOMS Basic</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Core repair workshop operations and billing.</p>
                </div>

                <div className="pt-2 space-y-1.5 text-xs text-slate-700">
                  <div className="font-bold text-[11px] text-slate-500 uppercase tracking-wider pb-1">Included Modules:</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Repair/Inward-Outward Management</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Customer Management &amp; Client Ledger</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Job Sheets &amp; Gate Passes</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>IMEI / Serial Number Tracking</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Payments &amp; Settlement Receipts</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Inventory &amp; Spare Parts Stock</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Billing &amp; GST Invoices Generator</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Warranty Records &amp; Expenses</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>Dashboard &amp; Reports</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>WhatsApp Customer Updates ✅</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" /> <span>QR / Barcode Device Tags ✅</span></div>
                </div>
              </div>
            </div>

            {/* Card 2: Business */}
            <div className="bg-white border-2 border-blue-200 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between relative">
              <span className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                ⭐ MOST POPULAR
              </span>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                    🔵 Business Plan
                  </span>
                  <span className="text-sm font-black text-blue-700 font-mono">₹599/mo</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">INOMS Business</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Purchases, vendors &amp; workbench queue.</p>
                </div>

                <div className="pt-2 space-y-1.5 text-xs text-slate-700">
                  <div className="font-bold text-[11px] text-blue-800 uppercase tracking-wider pb-1">Everything in Basic +</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-bold" /> <span>Purchase Management Hub</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-bold" /> <span>Purchase Orders (POs)</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-bold" /> <span>Supplier Management</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-bold" /> <span>Supplier Ledger &amp; Payables</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-bold" /> <span>Live Repair Kanban Queue</span></div>
                </div>
              </div>
            </div>

            {/* Card 3: Pro */}
            <div className="bg-white border-2 border-purple-200 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between relative">
              <span className="absolute -top-2.5 right-4 bg-purple-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                🔥 ULTIMATE
              </span>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                    🟣 Pro Suite
                  </span>
                  <span className="text-sm font-black text-purple-700 font-mono">₹699/mo</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">INOMS Pro</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Third-party service partner outsourcing &amp; challans.</p>
                </div>

                <div className="pt-2 space-y-1.5 text-xs text-slate-700">
                  <div className="font-bold text-[11px] text-purple-800 uppercase tracking-wider pb-1">Everything in Business +</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-600 shrink-0 font-bold" /> <span>External Service Partner Management</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-600 shrink-0 font-bold" /> <span>Job Outsourcing Challans &amp; Ledgers</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-600 shrink-0 font-bold" /> <span>Partner Ledgers &amp; Margin Tracking</span></div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-600 shrink-0 font-bold" /> <span>VIP Priority Support &amp; Upcoming Releases</span></div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER ADMIN UPI CONFIGURATION */}
      {/* ========================================================================= */}
      {activeSubTab === 'upi' && (
        <div className="space-y-6">
          
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-teal-600" />
                <span>Master Admin Direct Renewal UPI Account Configuration</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Organizations whose subscriptions expire will see this UPI address and live QR code to make direct renewal payments.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              
              {/* Form Inputs */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Master Admin UPI ID (VPA) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={masterUpi}
                      onChange={e => setMasterUpi(e.target.value)}
                      placeholder="e.g. sujitgajare@okicici or company@upi"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Direct UPI VPA ID where organizations send renewal payments.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Account / Payee Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={masterName}
                      onChange={e => setMasterName(e.target.value)}
                      placeholder="e.g. Master System Admin"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Master Support WhatsApp Mobile *
                    </label>
                    <input
                      type="text"
                      required
                      value={masterMobile}
                      onChange={e => setMasterMobile(e.target.value)}
                      placeholder="e.g. +91 8149862034"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveAll()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save UPI Account Settings</span>
                  </button>
                </div>
              </div>

              {/* Live QR Preview Box */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 text-center space-y-3 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                  Live QR Code Preview
                </span>
                <div className="bg-white p-2 rounded-xl inline-block shadow-md">
                  <img
                    src={testQrUrl}
                    alt="Master Admin UPI Test QR"
                    className="w-28 h-28 mx-auto"
                  />
                </div>
                <div className="text-[11px] font-mono text-slate-300 truncate">
                  {masterUpi || 'No UPI set'}
                </div>
                <p className="text-[10px] text-slate-400">
                  This QR code will be dynamically generated with exact payable amounts on client renewal screens.
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
