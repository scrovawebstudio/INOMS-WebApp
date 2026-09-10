import React, { useState } from 'react';
import {
  AlertTriangle,
  Monitor,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Edit2,
  Check,
  X,
  Smartphone,
  Tablet,
  Laptop
} from 'lucide-react';
import { DeviceSessionInfo, setCustomDeviceName, getDeviceName } from '../lib/sessionGuard';

interface ActiveSessionConflictModalProps {
  isOpen: boolean;
  tenantName: string;
  activeDevice: DeviceSessionInfo | null;
  myDeviceName: string;
  onTakeOver: () => void;
  onStayReadOnly: () => void;
  onSwitchOrgOrLogout: () => void;
  onClose?: () => void;
}

export const ActiveSessionConflictModal: React.FC<ActiveSessionConflictModalProps> = ({
  isOpen,
  tenantName,
  activeDevice,
  myDeviceName,
  onTakeOver,
  onStayReadOnly,
  onSwitchOrgOrLogout,
  onClose
}) => {
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState(myDeviceName);
  const [isTakingOver, setIsTakingOver] = useState(false);

  if (!isOpen || !activeDevice) return null;

  const handleClose = onClose || onStayReadOnly;

  const handleSaveDeviceName = () => {
    if (deviceNameInput.trim()) {
      setCustomDeviceName(deviceNameInput.trim());
      setIsEditingDeviceName(false);
    }
  };

  const getDeviceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('phone') || lower.includes('mobile')) return Smartphone;
    if (lower.includes('tablet') || lower.includes('tab') || lower.includes('ipad')) return Tablet;
    if (lower.includes('laptop') || lower.includes('macbook')) return Laptop;
    return Monitor;
  };

  const RemoteIcon = getDeviceIcon(activeDevice.deviceName);
  const MyIcon = getDeviceIcon(myDeviceName);

  const secondsAgo = Math.max(1, Math.floor((Date.now() - activeDevice.lastHeartbeat) / 1000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative bg-white border border-amber-300 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Amber Warning Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 p-6 text-white text-left relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
            <AlertTriangle className="w-36 h-36" />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full border border-white/20">
                  Active Session Concurrency Guard
                </span>
                <h3 className="text-lg sm:text-xl font-black leading-tight mt-1">
                  Organisation Already Open on Another Device
                </h3>
                <p className="text-xs text-amber-100 font-medium mt-0.5">
                  <span className="font-bold text-white">"{tenantName}"</span> is currently active on another terminal.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition cursor-pointer border border-white/20"
              title="Close and stay in Safe Read-Only mode"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-slate-800 text-left">
          {/* Comparison Cards: Current Active Terminal vs This Device */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Remote Active Terminal Card */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                    Active Terminal (In Use)
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                </div>
                
                <div className="flex items-center gap-2.5 mt-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 border border-amber-300/60 shrink-0">
                    <RemoteIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 truncate" title={activeDevice.deviceName}>
                      {activeDevice.deviceName}
                    </h4>
                    <p className="text-[10.5px] text-slate-600 font-medium truncate">
                      User: {activeDevice.userName || 'Logged in user'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-amber-900/80 font-bold bg-amber-100/60 px-2.5 py-1 rounded-xl border border-amber-200/60 flex items-center justify-between">
                <span>Active heartbeat:</span>
                <span className="font-mono">{secondsAgo}s ago</span>
              </div>
            </div>

            {/* This Device Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                    This Terminal
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">New Session</span>
                </div>

                <div className="flex items-center gap-2.5 mt-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 border border-teal-200 shrink-0">
                    <MyIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditingDeviceName ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          type="text"
                          value={deviceNameInput}
                          onChange={(e) => setDeviceNameInput(e.target.value)}
                          className="w-full text-xs font-bold px-2 py-0.5 border border-teal-400 rounded-lg focus:outline-hidden"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveDeviceName}
                          className="p-1 bg-teal-600 text-white rounded-md hover:bg-teal-700 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setIsEditingDeviceName(false)}
                          className="p-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-slate-900 truncate" title={myDeviceName}>
                          {myDeviceName}
                        </h4>
                        <button
                          onClick={() => setIsEditingDeviceName(true)}
                          className="p-0.5 text-slate-400 hover:text-teal-600 transition cursor-pointer"
                          title="Rename this device"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-[10.5px] text-teal-700 font-bold">
                      Safe Read-Only Protected
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-medium">
                Writes paused to prevent collisions
              </p>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-[11.5px] text-slate-700 leading-relaxed space-y-1">
            <p className="font-extrabold text-amber-950 flex items-center gap-1.5">
              <span>Why is this safety guard active?</span>
            </p>
            <p className="text-slate-600">
              When the same organisation is operated on 2 devices at the same time, saving on both devices can overwrite invoices, create duplicate job tracking numbers, or cause stock count mismatches.
            </p>
          </div>

          {/* Action Choices */}
          <div className="space-y-2.5 pt-1">
            {/* Primary Option 1: Stay in Safe Read-Only Mode */}
            <button
              type="button"
              onClick={onStayReadOnly}
              className="w-full p-3.5 bg-emerald-50 hover:bg-emerald-100/80 border-2 border-emerald-500/80 hover:border-emerald-600 rounded-2xl transition flex items-center justify-between gap-3 text-left cursor-pointer group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-950 group-hover:text-emerald-900">
                      Stay in Safe Read-Only Mode (Recommended)
                    </span>
                    <span className="text-[9px] bg-emerald-200 text-emerald-900 font-black px-2 py-0.2 rounded-full uppercase">
                      Safe
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 font-medium mt-0.5">
                    Browse jobs, inspect inventory, view customer records &amp; reports without risk of overwriting data.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: Take Over Active Terminal */}
            <button
              type="button"
              disabled={isTakingOver}
              onClick={async () => {
                setIsTakingOver(true);
                await onTakeOver();
                setIsTakingOver(false);
              }}
              className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition flex items-center justify-between gap-3 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <RefreshCw className={`w-5 h-5 ${isTakingOver ? 'animate-spin text-teal-300' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 group-hover:text-slate-950">
                      Take Over as Active Terminal
                    </span>
                    <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded-full border border-rose-200">
                      Logs Out Other Device
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Make this device the primary terminal. The other device will be automatically logged out.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: Switch Organisation or Log Out */}
            <button
              type="button"
              onClick={onSwitchOrgOrLogout}
              className="w-full p-3 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-2xl transition flex items-center justify-center gap-2 text-slate-600 hover:text-rose-700 font-bold text-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit / Log out of this Organisation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
