/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Printer, Receipt, FileSpreadsheet, Building, Phone, Mail, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import { Client, RepairJob, Invoice, ClientLedgerEntry, Payment, CompanyConfig, getEffectiveBillAmount, computeClientFinancials } from '../types';

interface ClientLedgerPrintModalProps {
  client: Client;
  companyConfig: CompanyConfig;
  jobs?: RepairJob[];
  invoices?: Invoice[];
  payments?: Payment[];
  ledger?: ClientLedgerEntry[];
  ledgerLogs?: ClientLedgerEntry[];
  statementEntries?: Array<{
    id: string;
    date: string;
    type: string;
    refNo: string;
    debit: number;
    credit: number;
    computedRunningBal?: number;
    sourceObj?: any;
  }>;
  totalInvoiced?: number;
  totalInvoicesPaid?: number;
  totalAdvancesTaken?: number;
  totalLedgerDebits?: number;
  totalLedgerCredits?: number;
  openingBalance?: number;
  totalOutstanding?: number;
  fromDate?: string;
  toDate?: string;
  onClose: () => void;
}

export default function ClientLedgerPrintModal({
  client,
  companyConfig,
  jobs = [],
  invoices = [],
  payments = [],
  ledger = [],
  ledgerLogs,
  statementEntries: propStatementEntries,
  totalInvoiced: propTotalInvoiced,
  totalInvoicesPaid: propTotalInvoicesPaid,
  totalAdvancesTaken: propTotalAdvancesTaken,
  totalLedgerDebits: propTotalLedgerDebits,
  totalLedgerCredits: propTotalLedgerCredits,
  openingBalance: propOpeningBalance,
  totalOutstanding: propTotalOutstanding,
  fromDate: propFromDate,
  toDate: propToDate,
  onClose
}: ClientLedgerPrintModalProps) {
  const [filterFromDate, setFilterFromDate] = React.useState(propFromDate || '');
  const [filterToDate, setFilterToDate] = React.useState(propToDate || '');

  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const fin = React.useMemo(() => {
    return computeClientFinancials(client, jobs, invoices, payments, ledgerLogs || ledger);
  }, [client, jobs, invoices, payments, ledgerLogs, ledger]);

  const computedEntries = propStatementEntries && propStatementEntries.length > 0
    ? propStatementEntries
    : fin.statementEntries;

  // Apply date filter if set
  const filteredEntries = computedEntries.filter(e => {
    const d = e.date ? e.date.substring(0, 10) : '';
    if (filterFromDate && d && d < filterFromDate) return false;
    if (filterToDate && d && d > filterToDate) return false;
    return true;
  });

  const totalLedgerDebits = filteredEntries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
  const totalLedgerCredits = filteredEntries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
  const totalOutstanding = fin.netOutstanding;

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in cursor-pointer overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-6xl w-[96vw] my-4 overflow-hidden animate-slide-up cursor-default flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on print) */}
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white">Client Account Statement & Ledger</h3>
                <span className="text-[10px] font-mono bg-slate-800 text-teal-300 px-2 py-0.5 rounded-full border border-slate-700">
                  {client.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                {client.name} • {client.mobile}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase">From:</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="bg-transparent border-0 text-white text-xs focus:ring-0 cursor-pointer p-0"
              />
              <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">To:</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="bg-transparent border-0 text-white text-xs focus:ring-0 cursor-pointer p-0"
              />
              {(filterFromDate || filterToDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                  className="text-[10px] text-rose-400 hover:underline font-bold ml-1 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/80">
          <div className="printable-area bg-white p-6 sm:p-8 max-w-3xl mx-auto rounded-2xl shadow-sm border border-slate-200 text-xs text-slate-700 space-y-6">
            
            {/* Store & Organization Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                  {companyConfig.name || 'INOMS SERVICE HUB'}
                </h2>
                <p className="text-[11px] text-slate-600 mt-1 max-w-md">{companyConfig.address}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-1">
                  <span>Ph: <strong className="text-slate-800 font-mono">{companyConfig.phone}</strong></span>
                  {companyConfig.email && <span>Email: <strong className="text-slate-800">{companyConfig.email}</strong></span>}
                </div>
                {companyConfig.gstin && (
                  <p className="text-[11px] text-slate-700 font-bold mt-1">
                    GSTIN: <span className="font-mono font-black text-slate-900">{companyConfig.gstin}</span>
                  </p>
                )}
              </div>

              <div className="text-right space-y-1 shrink-0">
                <span className="bg-slate-900 text-white text-[11px] px-3.5 py-1.5 rounded-lg font-black tracking-widest block uppercase shadow-2xs">
                  CLIENT LEDGER
                </span>
                <p className="text-[11px] font-mono font-bold text-slate-700 pt-1">
                  Date: {currentDateStr}
                </p>
                {(filterFromDate || filterToDate) && (
                  <p className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                    Period: {filterFromDate || 'Start'} to {filterToDate || 'Present'}
                  </p>
                )}
              </div>
            </div>

            {/* Client Information & Key Financial Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Client Account Details
                </span>
                <h3 className="text-sm font-black text-slate-900">{client.name}</h3>
                <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                  <p>Mobile: <span className="font-mono font-bold text-slate-800">{client.mobile}</span></p>
                  {client.email && <p>Email: <span>{client.email}</span></p>}
                  {client.state && <p>State: <span>{client.state}</span></p>}
                  {client.address && <p>Address: <span className="text-slate-500">{client.address}</span></p>}
                  <p className="text-[10px] text-teal-700 font-semibold pt-1">
                    Client Type: <span className="uppercase font-bold">{client.type || 'Walk-in'}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                    Total Outstanding Balance
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-black font-mono ${
                      totalOutstanding > 0 ? 'text-rose-400' : totalOutstanding < 0 ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                      {totalOutstanding < 0 ? 'CR ' : totalOutstanding > 0 ? 'DR ' : ''}
                      ₹{Math.abs(totalOutstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1 font-medium">
                    {totalOutstanding > 0 ? 'Pending payment due from client' : totalOutstanding < 0 ? 'Advance credit balance with store' : 'All accounts settled & cleared (NIL)'}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Opening Balance</span>
                    <span className="font-bold text-teal-300">
                      {fin.openingBalance < 0 ? 'CR ' : fin.openingBalance > 0 ? 'DR ' : ''}
                      ₹{Math.abs(fin.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Total DR / CR</span>
                    <span className="font-bold text-slate-200">
                      DR: ₹{fin.totalDebits.toLocaleString('en-IN')} | CR: ₹{fin.totalCredits.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary Metric Row */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Invoiced / Billed</span>
                <span className="text-sm font-black text-slate-800 font-mono">
                  ₹{fin.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Payments Received</span>
                <span className="text-sm font-black text-teal-700 font-mono">
                  ₹{fin.totalPaymentsAndCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Opening Balance</span>
                <span className="text-sm font-black text-slate-800 font-mono">
                  {fin.openingBalance < 0 ? 'CR ' : fin.openingBalance > 0 ? 'DR ' : ''}
                  ₹{Math.abs(fin.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Detailed Transaction Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>Detailed Statement & Transaction History</span>
                <span className="text-[10px] text-slate-500 font-mono font-normal">({filteredEntries.length} entries)</span>
              </h4>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Particulars / Description</th>
                      <th className="py-2.5 px-3">Ref No</th>
                      <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-sans">
                    {filteredEntries.length > 0 ? (
                      filteredEntries.map((log, idx) => {
                        const bal = log.computedRunningBal !== undefined ? log.computedRunningBal : 0;
                        return (
                          <tr key={`print-log-${log.id || idx}`} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{log.date || '—'}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              <div>{log.type}</div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{log.refNo || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                              {log.debit > 0 ? `₹${log.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {log.credit > 0 ? `₹${log.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              <span className={bal > 0 ? 'text-rose-700' : bal < 0 ? 'text-emerald-700' : 'text-slate-700'}>
                                {bal < 0 ? 'CR ' : bal > 0 ? 'DR ' : ''}₹{Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No transactions or ledger entries recorded for this client.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer / Terms */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-500">
              <div>
                <p className="font-bold text-slate-700">Thank you for your business!</p>
                <p className="mt-0.5">Computer-generated statement. No physical signature required.</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-700 uppercase">For {companyConfig.name}</p>
                <div className="h-10"></div>
                <p className="border-t border-slate-300 pt-1 font-semibold">Authorized Signatory</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
