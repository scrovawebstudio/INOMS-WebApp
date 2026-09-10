import React, { useState } from 'react';
import {
  ServicePartner,
  ServicePartnerPayment,
  RepairJob,
  SystemUser
} from '../types';
import {
  Wrench,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit,
  Trash2,
  DollarSign,
  Briefcase,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Truck,
  Building,
  UserCheck
} from 'lucide-react';
import ServicePartnerDetail from './ServicePartnerDetail';

interface ServicePartnersProps {
  servicePartners: ServicePartner[];
  jobs: RepairJob[];
  servicePartnerPayments: ServicePartnerPayment[];
  isStaff?: boolean;
  currentUser?: SystemUser | null;
  userRole?: string;
  onAddPartner: (partner: Omit<ServicePartner, 'id'>) => void;
  onUpdatePartner: (partner: ServicePartner) => void;
  onDeletePartner: (id: string) => void;
  onRecordPartnerPayment: (payment: Omit<ServicePartnerPayment, 'id'>) => void;
  onUpdateJob: (job: RepairJob) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function ServicePartners({
  servicePartners,
  jobs,
  servicePartnerPayments,
  isStaff = false,
  currentUser,
  userRole,
  onAddPartner,
  onUpdatePartner,
  onDeletePartner,
  onRecordPartnerPayment,
  onUpdateJob,
  onNavigateToJob
}: ServicePartnersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartnerForDetail, setSelectedPartnerForDetail] = useState<ServicePartner | null>(null);

  // Add / Edit Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ServicePartner | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternateNumber, setAlternateNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const handleOpenAddModal = () => {
    setEditingPartner(null);
    setName('');
    setCompanyName('');
    setContactPerson('');
    setMobile('');
    setAlternateNumber('');
    setEmail('');
    setAddress('');
    setGstin('');
    setPan('');
    setNotes('');
    setStatus('Active');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (partner: ServicePartner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPartner(partner);
    setName(partner.name);
    setCompanyName(partner.companyName || '');
    setContactPerson(partner.contactPerson || '');
    setMobile(partner.mobile);
    setAlternateNumber(partner.alternateNumber || '');
    setEmail(partner.email || '');
    setAddress(partner.address || '');
    setGstin(partner.gstin || '');
    setPan(partner.pan || '');
    setNotes(partner.notes || '');
    setStatus(partner.status || 'Active');
    setShowAddModal(true);
  };

  const handleSavePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile) {
      alert('Please fill Service Partner Name and Mobile Number');
      return;
    }

    if (editingPartner) {
      onUpdatePartner({
        ...editingPartner,
        name,
        companyName,
        contactPerson,
        mobile,
        alternateNumber,
        email,
        address,
        gstin,
        pan,
        notes,
        status,
        updatedAt: new Date().toISOString()
      });
    } else {
      onAddPartner({
        name,
        companyName,
        contactPerson,
        mobile,
        alternateNumber,
        email,
        address,
        gstin,
        pan,
        notes,
        status,
        createdAt: new Date().toISOString()
      });
    }
    setShowAddModal(false);
  };

  // Financial aggregates for a service partner
  const getPartnerFinancials = (partnerId: string, partnerName: string) => {
    const pJobs = jobs.filter(
      (j) =>
        j.servicePartnerId === partnerId ||
        j.repairType === 'EXTERNAL_PARTNER' && (j.externalVendorName || '').toLowerCase() === partnerName.toLowerCase()
    );

    const totalRepairCost = pJobs.reduce((sum, j) => sum + (j.servicePartnerCost || 0), 0);
    const totalPaidDirect = pJobs.reduce((sum, j) => sum + (j.servicePartnerPaid || 0), 0);
    const totalLumpSum = servicePartnerPayments
      .filter((p) => p.servicePartnerId === partnerId)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPaid = Math.max(totalPaidDirect, totalLumpSum);
    const outstanding = Math.max(0, totalRepairCost - totalPaid);

    const activeInRepairCount = pJobs.filter(
      (j) => j.partnerStatus === 'Sent to Partner' || j.partnerStatus === 'In Repair'
    ).length;

    return {
      totalJobs: pJobs.length,
      activeInRepairCount,
      totalRepairCost,
      totalPaid,
      outstanding
    };
  };

  // Filtered List
  const filteredPartners = servicePartners.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.companyName || '').toLowerCase().includes(term) ||
      p.mobile.includes(term) ||
      (p.gstin || '').toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term)
    );
  });

  // Global Totals
  const totalAllSentJobs = jobs.filter((j) => j.servicePartnerId || j.repairType === 'EXTERNAL_PARTNER').length;
  const totalAllRepairCosts = jobs.reduce((sum, j) => sum + (j.servicePartnerCost || 0), 0);
  const totalAllPartnerPayments = servicePartnerPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalAllOutstandingDues = servicePartners.reduce((sum, sp) => {
    const fin = getPartnerFinancials(sp.id, sp.name);
    return sum + fin.outstanding;
  }, 0);

  if (selectedPartnerForDetail) {
    const currentObj = servicePartners.find((sp) => sp.id === selectedPartnerForDetail.id) || selectedPartnerForDetail;
    return (
      <ServicePartnerDetail
        partner={currentObj}
        jobs={jobs}
        partnerPayments={servicePartnerPayments}
        onBack={() => setSelectedPartnerForDetail(null)}
        onRecordPayment={onRecordPartnerPayment}
        onUpdateJob={onUpdateJob}
        onNavigateToJob={onNavigateToJob}
      />
    );
  }

  return (
    <div className="space-y-6" id="service-partners-management-root">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold border border-purple-100">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">
                External Service Partners &amp; 3rd-Party Repair Labs
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Track devices sent to external repair vendors, BGA chip-level costs, challans &amp; partner payouts.
              </p>
            </div>
          </div>
        </div>

        {!isStaff && (
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service Partner</span>
          </button>
        )}
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Partners</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{servicePartners.length}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Authorized repair labs</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">External Jobs</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700 font-mono">{totalAllSentJobs}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total outsourced repairs</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Paid to Partners</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono">
            ₹{totalAllPartnerPayments.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {servicePartnerPayments.length} payment receipts
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Partner Dues Payable</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 font-mono">
            ₹{totalAllOutstandingDues.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-amber-700/80 font-semibold mt-0.5">Pending repair settlements</p>
        </div>
      </div>

      {/* Partners Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search partner, phone, GST, specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          <div className="text-xs font-bold text-slate-500 font-mono">
            Showing {filteredPartners.length} of {servicePartners.length} partners
          </div>
        </div>

        {/* Partners Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center">Action</th>
                <th className="py-3.5 px-4">Service Partner</th>
                <th className="py-3.5 px-4">Contact Phone</th>
                <th className="py-3.5 px-4 text-center">Jobs on Bench</th>
                <th className="py-3.5 px-4 text-right">Total Repair Cost</th>
                <th className="py-3.5 px-4 text-right">Total Paid</th>
                <th className="py-3.5 px-4 text-right">Outstanding Dues</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPartners.length > 0 ? (
                filteredPartners.map((partner) => {
                  const fin = getPartnerFinancials(partner.id, partner.name);
                  return (
                    <tr
                      key={partner.id}
                      onClick={() => setSelectedPartnerForDetail(partner)}
                      className="hover:bg-purple-50/40 transition cursor-pointer group"
                    >
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => handleOpenEditModal(partner, e)}
                            title="Edit Partner Profile"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {!isStaff && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Are you sure you want to delete partner "${partner.name}"?`
                                  )
                                ) {
                                  onDeletePartner(partner.id);
                                }
                              }}
                              title="Delete Partner"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-purple-700 transition flex items-center gap-1.5">
                            <span>{partner.name}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{partner.id}</p>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <p className="font-mono font-bold text-slate-800 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{partner.mobile}</span>
                          </p>
                          {partner.contactPerson && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              Attn: {partner.contactPerson}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            fin.activeInRepairCount > 0
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {fin.activeInRepairCount} in bench ({fin.totalJobs} total)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{fin.totalRepairCost.toLocaleString('en-IN')}.00
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        ₹{fin.totalPaid.toLocaleString('en-IN')}.00
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-amber-700">
                        ₹{fin.outstanding.toLocaleString('en-IN')}.00
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            partner.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {partner.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 italic">
                    No service partners found matching "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Partner Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingPartner ? `Edit Service Partner (${editingPartner.id})` : 'Register External Service Partner'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Add 3rd-party repair labs for chip-level, BGA rework, screen panel bonding &amp; tracking.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Service Partner / Lab Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. XYZ Laptop Chip-Level Services"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Company / Trade Legal Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. XYZ Technologies Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Person / Lead Tech
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh Raina"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Primary Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9892044556"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alternate Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 022-26543321"
                    value={alternateNumber}
                    onChange={(e) => setAlternateNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="repairs@partnerlab.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27XYZAB9876C1ZT"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. XYZAB9876C"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Workshop / Lab Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Floor, building, street, market area..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Specializations &amp; Capabilities
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Motherboard BGA rework, PCH replace, liquid damage, panel bonding..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  {editingPartner ? 'Save Partner Changes' : 'Register Service Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
