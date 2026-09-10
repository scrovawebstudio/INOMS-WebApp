/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  TrendingDown,
  Percent,
  Receipt,
  Calendar,
  IndianRupee,
  FileSpreadsheet,
  Tag,
  ArrowUpDown,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Expense } from '../types';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense?: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

const QUICK_PRESETS = [
  'Staff Salary',
  'Staff Advance',
  'Shop Rent',
  'Electricity & Power',
  'Internet & Phone',
  'Tea & Refreshments',
  'Office Stationery',
  'Courier & Transport',
  'Tools & Equipment',
  'Repairs & Maintenance',
  'Marketing & Promo',
  'Miscellaneous'
];

export default function Expenses({
  expenses = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}: ExpensesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Form states
  const [expenseCat, setExpenseCat] = useState('');
  const [expenseAmt, setExpenseAmt] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expenseRemarks, setExpenseRemarks] = useState('');

  // Active expenses filter (excluding soft-deleted if any)
  const activeExpenses = useMemo(() => {
    return (expenses || []).filter(e => !e.isDeleted);
  }, [expenses]);

  // Computations
  const totalExpenses = useMemo(() => {
    return activeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [activeExpenses]);

  // Group by category percentages
  const catPercentages = useMemo(() => {
    const catTotals = activeExpenses.reduce((acc, curr) => {
      const cat = (curr.category || 'Uncategorized').trim().toUpperCase();
      acc[cat] = (acc[cat] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(catTotals).map(([cat, rawAmt]) => {
      const amt = Number(rawAmt) || 0;
      return {
        category: cat,
        amount: amt,
        percent: totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [activeExpenses, totalExpenses]);

  const handleOpenAdd = () => {
    setEditingExpenseId(null);
    setExpenseCat('');
    setExpenseAmt(0);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseRemarks('');
    setShowModal(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpenseCat(exp.category || '');
    setExpenseAmt(Number(exp.amount) || 0);
    setExpenseDate(exp.date || new Date().toISOString().split('T')[0]);
    setExpenseRemarks(exp.remarks || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCat = expenseCat.trim();
    if (!cleanCat) {
      alert('Please enter an expense name or category.');
      return;
    }
    if (expenseAmt <= 0) {
      alert('Expense amount must be greater than zero.');
      return;
    }

    if (editingExpenseId && onUpdateExpense) {
      onUpdateExpense({
        id: editingExpenseId,
        date: expenseDate || new Date().toISOString().split('T')[0],
        category: cleanCat,
        amount: expenseAmt,
        remarks: expenseRemarks.trim()
      });
    } else {
      onAddExpense({
        date: expenseDate || new Date().toISOString().split('T')[0],
        category: cleanCat,
        amount: expenseAmt,
        remarks: expenseRemarks.trim()
      });
    }

    setShowModal(false);
  };

  const filteredExpenses = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return activeExpenses;
    return activeExpenses.filter(e =>
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.remarks && e.remarks.toLowerCase().includes(q)) ||
      (e.date && e.date.toLowerCase().includes(q)) ||
      (e.amount && e.amount.toString().includes(q))
    );
  }, [activeExpenses, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-rose-600" />
            Expense Management
            <span className="text-xs font-semibold bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200/60">
              ₹{totalExpenses.toLocaleString('en-IN')} Total Outlays
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track day-to-day business outlays, staff payments, rent, utility bills, and operational expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            id="record-expense-btn"
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Main Grid: List and Category Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: List of expenses */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by expense, remarks, date or ₹..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              Showing <span className="font-bold text-slate-800">{filteredExpenses.length}</span> of {activeExpenses.length} entries
            </div>
          </div>

          <div className="overflow-x-auto grow">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-20 text-center">Action</th>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4">Expense / Category</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Amount Outlayed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70 transition group">
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Edit Expense"
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete Expense"
                            onClick={() => {
                              if (confirm(`Delete "${exp.category}" (₹${exp.amount}) entry?`)) {
                                onDeleteExpense(exp.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {exp.date}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                          <Tag className="w-3 h-3 text-slate-500" />
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                        {exp.remarks || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 text-sm whitespace-nowrap">
                        ₹{(Number(exp.amount) || 0).toLocaleString('en-IN')}.00
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 opacity-60" />
                      <p className="font-semibold text-slate-600">No expense records found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &ldquo;Record Expense&rdquo; above to log your first outlay</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Category Percentage Breakdown Progress bars */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5 flex flex-col">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Percent className="w-4 h-4 text-rose-500" />
              Category Breakdown
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">Operational budget allocation percentages.</p>
          </div>

          <div className="space-y-4 grow">
            {catPercentages.length > 0 ? (
              catPercentages.map((item, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span className="font-semibold">{item.category}</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹{item.amount.toLocaleString('en-IN')} <span className="text-slate-400 font-normal">({item.percent.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        i === 0
                          ? 'bg-rose-500'
                          : i === 1
                          ? 'bg-amber-500'
                          : i === 2
                          ? 'bg-teal-500'
                          : i === 3
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${item.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 italic text-xs">
                No expense data logged to display category percentages.
              </div>
            )}
          </div>

          {activeExpenses.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Total Recorded</span>
              <span className="font-mono text-rose-600 font-bold text-sm">₹{totalExpenses.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

      </div>

      {/* Record / Edit Expense Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  {editingExpenseId ? 'Edit Expense Outlay' : 'Record Business Expense'}
                </h2>
              </div>
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              
              {/* Expense Category / Name Input with Suggestions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                    Expense Name / Category <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Type custom or click preset</span>
                </div>
                
                <input
                  type="text"
                  required
                  placeholder="Type expense name (e.g. Staff Salary, Shop Rent, Electricity, Tea & Snacks)..."
                  value={expenseCat}
                  onChange={(e) => setExpenseCat(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  autoFocus
                />

                {/* Quick Presets / Suggestions */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Quick presets (click to fill):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {QUICK_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setExpenseCat(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                          expenseCat.toLowerCase() === preset.toLowerCase()
                            ? 'bg-teal-600 text-white font-bold shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 font-medium'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Amount and Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                    Amount Outlayed (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      placeholder="0.00"
                      value={expenseAmt === 0 ? '' : expenseAmt}
                      onChange={(e) => setExpenseAmt(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl pl-7 pr-3.5 py-2 font-mono text-sm font-bold text-rose-600 focus:outline-hidden focus:ring-2 focus:ring-rose-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                    Expense Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Remarks / Details */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid cash advance to assistant, monthly maintenance, bill receipt #104..."
                  value={expenseRemarks}
                  onChange={(e) => setExpenseRemarks(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-2xs resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl font-semibold transition cursor-pointer text-xs shadow-sm hover:shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingExpenseId ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
