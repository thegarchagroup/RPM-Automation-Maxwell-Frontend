import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  UserCheck,
  AlertTriangle,
  FileDown,
  ExternalLink,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  CheckCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

interface RoomAllDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string;
  initialProperty?: string;
}

export const RoomAllDetailsModal: React.FC<RoomAllDetailsModalProps> = ({
  isOpen,
  onClose,
  roomNumber,
  initialProperty = 'Maxwell',
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [inspections, setInspections] = useState<any[]>([]);
  const [rpmRecords, setRpmRecords] = useState<any[]>([]);
  const [itemLookup, setItemLookup] = useState<Record<number, { itemNo: string; description: string; sectionName: string }>>({});
  
  const [propertyFilter, setPropertyFilter] = useState<string>(initialProperty || 'all');
  const [activeTab, setActiveTab] = useState<'submissions' | 'defects' | 'stats'>('submissions');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const cleanRoom = useMemo(() => {
    return (roomNumber || '').toLowerCase().replace(/room\s*/i, '').trim();
  }, [roomNumber]);

  useEffect(() => {
    if (!isOpen || !cleanRoom) return;

    setPropertyFilter(initialProperty || 'all');
    setSelectedYear('all');

    const loadAllRoomData = async () => {
      setLoading(true);
      try {
        // 1. Fetch template for checklist item names
        api.getTemplate().then((tpl) => {
          if (tpl?.sections) {
            const map: Record<number, { itemNo: string; description: string; sectionName: string }> = {};
            tpl.sections.forEach((sec: any) => {
              (sec.items || []).forEach((item: any) => {
                map[item.id] = {
                  itemNo: item.item_number || `#${item.id}`,
                  description: item.description,
                  sectionName: sec.name,
                };
              });
            });
            setItemLookup(map);
          }
        }).catch(() => {});

        // 2. Fetch all inspections for this room across all properties, quarters, and years
        const inspList = await api.getInspections({ room_number: cleanRoom }, true).catch(() => []);

        // 3. Fetch all RPM records for this room
        const rpmList = await api.getRpmRecords({ search: cleanRoom }, true).catch(() => []);

        setInspections(Array.isArray(inspList) ? inspList : []);
        setRpmRecords(Array.isArray(rpmList) ? rpmList : []);
      } catch (err) {
        console.warn('Error loading room history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAllRoomData();
  }, [isOpen, cleanRoom, initialProperty]);

  // Distinct properties found in the records for this room
  const availableProperties = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach((i) => {
      if (i.property_name) set.add(i.property_name);
    });
    rpmRecords.forEach((r) => {
      if (r.property_name) set.add(r.property_name);
    });
    if (initialProperty) set.add(initialProperty);
    return Array.from(set);
  }, [inspections, rpmRecords, initialProperty]);

  // Filter inspections by property and year
  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      // Room check
      const rClean = (i.room_number || '').toLowerCase().replace(/room\s*/i, '').trim();
      if (rClean !== cleanRoom) return false;

      // Property check
      if (propertyFilter !== 'all') {
        const pA = (i.property_name || '').toLowerCase();
        const pB = propertyFilter.toLowerCase();
        const match = pA === pB || pA.includes(pB) || pB.includes(pA);
        if (!match) return false;
      }

      // Year check
      if (selectedYear !== 'all') {
        const dateStr = i.inspection_date || '';
        const match = dateStr.includes(selectedYear);
        if (!match) return false;
      }

      return true;
    });
  }, [inspections, cleanRoom, propertyFilter, selectedYear]);

  // Filter RPM records by property and year
  const filteredRpmRecords = useMemo(() => {
    return rpmRecords.filter((r) => {
      const rClean = (r.room_or_area || '').toLowerCase().replace(/room\s*/i, '').trim();
      if (rClean !== cleanRoom) return false;

      if (propertyFilter !== 'all') {
        const pA = (r.property_name || '').toLowerCase();
        const pB = propertyFilter.toLowerCase();
        const match = pA === pB || pA.includes(pB) || pB.includes(pA);
        if (!match) return false;
      }

      if (selectedYear !== 'all') {
        if (r.year && String(r.year) !== selectedYear) return false;
      }

      return true;
    });
  }, [rpmRecords, cleanRoom, propertyFilter, selectedYear]);

  // Aggregate unified historical submissions (across all quarters and years)
  const unifiedSubmissions = useMemo(() => {
    const list: Array<{
      key: string;
      inspectionId?: number;
      rpmRecordId?: number;
      propertyName: string;
      quarter: string;
      year: number;
      rpmDate?: string;
      rpmBy?: string;
      inspectionDate?: string;
      inspBy?: string;
      status: string;
      overallRemark?: string;
      inspectorRemark?: string;
      failedItemsCount: number;
    }> = [];

    const processedKeys = new Set<string>();

    filteredInspections.forEach((insp) => {
      const prop = insp.property_name || 'Maxwell';
      const quarter = insp.quarter || 'Quarter';
      const dateStr = insp.inspection_date || '';
      const yearMatch = dateStr.match(/\b(20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
      const key = `${prop}_${quarter}_${year}`.toLowerCase();
      processedKeys.add(key);

      const failedCount = (insp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail').length;

      let status = 'Pending';
      if (insp.status === 'verified' || insp.status === 'accepted') status = 'Accepted';
      else if (insp.status === 'rejected') status = 'Rejected';
      else if (insp.status === 'submitted') status = 'Submitted';

      list.push({
        key,
        inspectionId: insp.id,
        propertyName: prop,
        quarter,
        year,
        rpmDate: insp.inspection_date,
        rpmBy: insp.maintenance_carried_by,
        inspectionDate: (status === 'Accepted' || status === 'Rejected') ? insp.inspection_date : undefined,
        inspBy: insp.inspected_by,
        status,
        overallRemark: insp.overall_remark,
        inspectorRemark: insp.inspector_remark,
        failedItemsCount: failedCount,
      });
    });

    filteredRpmRecords.forEach((r) => {
      const prop = r.property_name || 'Maxwell';
      const quarter = r.quarter || 'Quarter';
      const year = r.year || 2026;
      const key = `${prop}_${quarter}_${year}`.toLowerCase();

      if (!processedKeys.has(key) && (r.rpm_date || r.eng_date || r.inspection_date)) {
        processedKeys.add(key);
        list.push({
          key,
          rpmRecordId: r.id,
          propertyName: prop,
          quarter,
          year,
          rpmDate: r.rpm_date || r.eng_date,
          rpmBy: r.maintenance_carried_by,
          inspectionDate: r.inspection_date,
          inspBy: r.inspected_by,
          status: r.inspection_status || 'Pending',
          failedItemsCount: 0,
        });
      }
    });

    return list.sort((a, b) => b.year - a.year || b.quarter.localeCompare(a.quarter));
  }, [filteredInspections, filteredRpmRecords]);

  // Aggregate all defect records across all quarters and years
  const allDefects = useMemo(() => {
    const defects: Array<{
      key: string;
      inspectionId: number;
      propertyName: string;
      quarter: string;
      year: number;
      date: string;
      itemId: number;
      itemNo: string;
      description: string;
      sectionName: string;
      isFixed: boolean;
      fixedBy?: string;
      fixedRemark?: string;
      technicianRemark?: string;
      inspectorRemark?: string;
      photoUrl?: string;
    }> = [];

    filteredInspections.forEach((insp) => {
      const prop = insp.property_name || 'Maxwell';
      const quarter = insp.quarter || 'Quarter';
      const date = insp.inspection_date || '';
      const yearMatch = date.match(/\b(20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

      (insp.items || []).forEach((it: any) => {
        if (it.result?.toLowerCase() === 'fail') {
          const info = itemLookup[it.checklist_item_id] || {
            itemNo: `#${it.checklist_item_id}`,
            description: `Checklist Item #${it.checklist_item_id}`,
            sectionName: 'General',
          };

          defects.push({
            key: `${insp.id}_${it.id || it.checklist_item_id}`,
            inspectionId: insp.id,
            propertyName: prop,
            quarter,
            year,
            date,
            itemId: it.checklist_item_id,
            itemNo: info.itemNo,
            description: info.description,
            sectionName: info.sectionName,
            isFixed: Boolean(it.is_fixed),
            fixedBy: it.fixed_by,
            fixedRemark: it.fixed_remark,
            technicianRemark: it.remark,
            inspectorRemark: it.inspector_remark,
            photoUrl: it.photo_url,
          });
        }
      });
    });

    return defects;
  }, [filteredInspections, itemLookup]);

  // Overall Statistics for this Room
  const stats = useMemo(() => {
    const totalSubmissions = unifiedSubmissions.length;
    const acceptedCount = unifiedSubmissions.filter((s) => s.status === 'Accepted').length;
    const rejectedCount = unifiedSubmissions.filter((s) => s.status === 'Rejected').length;
    const pendingCount = unifiedSubmissions.filter((s) => s.status === 'Pending' || s.status === 'Submitted').length;
    const passRate = totalSubmissions > 0 ? Math.round((acceptedCount / totalSubmissions) * 100) : 0;

    const totalDefectsCount = allDefects.length;
    const fixedDefectsCount = allDefects.filter((d) => d.isFixed).length;
    const openDefectsCount = totalDefectsCount - fixedDefectsCount;

    return {
      totalSubmissions,
      acceptedCount,
      rejectedCount,
      pendingCount,
      passRate,
      totalDefectsCount,
      fixedDefectsCount,
      openDefectsCount,
    };
  }, [unifiedSubmissions, allDefects]);

  // Download PDF from Dropbox
  const handleDownloadDropbox = async (item: typeof unifiedSubmissions[0], docType: 'RPM' | 'Inspection') => {
    const dlKey = `${item.key}_${docType}`;
    setDownloadingType(dlKey);
    try {
      const dateToUse = docType === 'RPM' ? item.rpmDate : item.inspectionDate || item.rpmDate;
      const { blob, filename } = await api.downloadDropboxPdf({
        room_number: cleanRoom,
        inspection_date: dateToUse || '2026-01-01',
        year: item.year,
        quarter: item.quarter,
        document_type: docType,
        property_name: item.propertyName,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Could not download ${docType} PDF from Dropbox: ${err.message || 'File not found'}`);
    } finally {
      setDownloadingType(null);
    }
  };

  // Export full room history to Excel
  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Submissions
    const subRows = [
      ['ROOM HISTORY REPORT', `Room ${cleanRoom}`, propertyFilter.toUpperCase()],
      ['Total Inspections', stats.totalSubmissions, 'Pass Rate', `${stats.passRate}%`],
      ['Total Defects Flagged', stats.totalDefectsCount, 'Fixed Defects', stats.fixedDefectsCount],
      [],
      ['Property', 'Year', 'Quarter', 'RPM Date', 'Technician', 'Inspection Date', 'Inspector', 'Status', 'Defects Count', 'RPM Remark', 'Inspector Remark'],
      ...unifiedSubmissions.map((s) => [
        s.propertyName,
        s.year,
        s.quarter,
        s.rpmDate || '—',
        s.rpmBy || '—',
        s.inspectionDate || '—',
        s.inspBy || '—',
        s.status,
        s.failedItemsCount,
        s.overallRemark || '—',
        s.inspectorRemark || '—',
      ]),
    ];
    const wsSub = XLSX.utils.aoa_to_sheet(subRows);
    XLSX.utils.book_append_sheet(wb, wsSub, 'Submissions History');

    // Sheet 2: Defects
    const defRows = [
      ['Property', 'Year', 'Quarter', 'Date', 'Item #', 'Section', 'Description', 'Status', 'Technician Remark', 'Inspector Remark', 'Fixed By', 'Fixed Remark'],
      ...allDefects.map((d) => [
        d.propertyName,
        d.year,
        d.quarter,
        d.date,
        d.itemNo,
        d.sectionName,
        d.description,
        d.isFixed ? 'FIXED' : 'DEFECT',
        d.technicianRemark || '—',
        d.inspectorRemark || '—',
        d.fixedBy || '—',
        d.fixedRemark || '—',
      ]),
    ];
    const wsDef = XLSX.utils.aoa_to_sheet(defRows);
    XLSX.utils.book_append_sheet(wb, wsDef, 'Defects Breakdown');

    XLSX.writeFile(wb, `Room_${cleanRoom}_Complete_History_${new Date().getFullYear()}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg font-black text-lg">
              {cleanRoom}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-extrabold tracking-tight">
                  Room {cleanRoom} — Complete History & Details
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Admin Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Multi-quarter & multi-year historical submissions, defect logs, and inspection status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportXLSX}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer active:scale-95 shadow-sm"
              title="Download Excel spreadsheet of this room's complete history"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export History</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Property & Year Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Property Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-slate-500 uppercase text-[10px] mr-1">Hotel:</span>
            <button
              type="button"
              onClick={() => setPropertyFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                propertyFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All Hotels
            </button>
            {availableProperties.map((prop) => (
              <button
                key={prop}
                type="button"
                onClick={() => setPropertyFilter(prop)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  propertyFilter.toLowerCase() === prop.toLowerCase()
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Building2 className="w-3 h-3 text-amber-500" />
                <span>{prop}</span>
              </button>
            ))}
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-500 uppercase text-[10px]">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="py-1.5 px-3 rounded-xl bg-white border border-slate-300 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-xs"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="p-6 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase mb-1">
              <span>Inspections</span>
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.totalSubmissions}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">Forms across all quarters</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold uppercase mb-1">
              <span>Pass Rate</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950">{stats.passRate}%</div>
            <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
              {stats.acceptedCount} Accepted • {stats.rejectedCount} Rejected
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
            <div className="flex items-center justify-between text-rose-800 text-[11px] font-bold uppercase mb-1">
              <span>Defects Logged</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-950">{stats.totalDefectsCount}</div>
            <div className="text-[10px] text-rose-800 font-medium mt-0.5">
              {stats.openDefectsCount} Open • {stats.fixedDefectsCount} Fixed
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
            <div className="flex items-center justify-between text-indigo-800 text-[11px] font-bold uppercase mb-1">
              <span>Fixed Ratio</span>
              <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-950">
              {stats.totalDefectsCount > 0
                ? `${Math.round((stats.fixedDefectsCount / stats.totalDefectsCount) * 100)}%`
                : '100%'}
            </div>
            <div className="text-[10px] text-indigo-800 font-medium mt-0.5">
              Defects resolved by team
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'submissions'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Submission History ({unifiedSubmissions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('defects')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'defects'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Defects History ({allDefects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stats'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Defect Categories</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
              <p className="text-sm font-semibold">Gathering multi-quarter records...</p>
            </div>
          ) : activeTab === 'submissions' ? (
            /* ================= TAB 1: SUBMISSIONS TIMELINE ================= */
            unifiedSubmissions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <ShieldAlert className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <h5 className="font-bold text-slate-700 text-sm">No Submissions Found</h5>
                <p className="text-xs text-slate-400 mt-1">
                  Room {cleanRoom} has no recorded submissions matching the selected filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unifiedSubmissions.map((sub) => (
                  <div
                    key={sub.key}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900">
                          {sub.quarter} ({sub.year})
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-300">
                          {sub.propertyName}
                        </span>
                        {sub.status === 'Accepted' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Accepted</span>
                          </span>
                        )}
                        {sub.status === 'Rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Rejected</span>
                          </span>
                        )}
                        {sub.status === 'Submitted' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Awaiting Inspection</span>
                          </span>
                        )}
                        {sub.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Dropbox Downloads */}
                        <button
                          type="button"
                          onClick={() => handleDownloadDropbox(sub, 'RPM')}
                          disabled={downloadingType === `${sub.key}_RPM`}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 shadow-xs transition cursor-pointer"
                          title="Download RPM Document from Dropbox"
                        >
                          <FileDown className="w-3 h-3 text-amber-400" />
                          <span>RPM PDF</span>
                        </button>

                        {(sub.status === 'Accepted' || sub.status === 'Rejected') && (
                          <button
                            type="button"
                            onClick={() => handleDownloadDropbox(sub, 'Inspection')}
                            disabled={downloadingType === `${sub.key}_Inspection`}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white flex items-center gap-1 shadow-xs transition cursor-pointer"
                            title="Download Inspection Document from Dropbox"
                          >
                            <FileDown className="w-3 h-3 text-emerald-400" />
                            <span>Inspection PDF</span>
                          </button>
                        )}

                        {/* Open in form */}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/form?room=${encodeURIComponent(cleanRoom)}&property=${encodeURIComponent(sub.propertyName)}`);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                          title="Open Form in Checklist"
                        >
                          <ExternalLink className="w-3 h-3 text-purple-600" />
                          <span>View Form</span>
                        </button>
                      </div>
                    </div>

                    {/* Meta details grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl text-xs">
                      <div>
                        <div className="font-extrabold text-[10px] text-slate-500 uppercase">RPM Technician Submission</div>
                        <div className="mt-0.5 text-slate-800 font-semibold flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{sub.rpmBy || 'RPM Staff'}</span>
                          {sub.rpmDate && <span className="text-slate-400 font-normal">on {sub.rpmDate}</span>}
                        </div>
                        {sub.overallRemark && (
                          <div className="text-[11px] text-slate-600 italic mt-1 pl-5">
                            "{sub.overallRemark}"
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="font-extrabold text-[10px] text-slate-500 uppercase">Inspector Verification</div>
                        <div className="mt-0.5 text-slate-800 font-semibold flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{sub.inspBy || 'Pending Inspector'}</span>
                          {sub.inspectionDate && <span className="text-slate-400 font-normal">on {sub.inspectionDate}</span>}
                        </div>
                        {sub.inspectorRemark && (
                          <div className="text-[11px] text-violet-950 font-medium mt-1 pl-5">
                            "{sub.inspectorRemark}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'defects' ? (
            /* ================= TAB 2: DEFECTS BREAKDOWN ================= */
            allDefects.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                <h5 className="font-bold text-slate-700 text-sm">No Defects Reported</h5>
                <p className="text-xs text-slate-400 mt-1">
                  Room {cleanRoom} has maintained a clean record with zero defects flagged in the selected period.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allDefects.map((def) => (
                  <div
                    key={def.key}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200/90 text-slate-800">
                            {def.sectionName}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {def.description}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {def.propertyName} • {def.quarter} ({def.year}) {def.date ? `• Date: ${def.date}` : ''}
                        </div>
                      </div>

                      <div>
                        {def.isFixed ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                            <CheckCheck className="w-3 h-3" />
                            <span>FIXED</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                            <AlertTriangle className="w-3 h-3" />
                            <span>OPEN ISSUE</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remarks breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {def.technicianRemark && (
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 space-y-0.5">
                          <div className="font-extrabold text-[10px] uppercase text-emerald-800">
                            Technician Remark:
                          </div>
                          <p className="italic text-slate-700">"{def.technicianRemark}"</p>
                        </div>
                      )}

                      {def.inspectorRemark && (
                        <div className="p-2.5 bg-violet-50/70 rounded-xl border border-violet-200 text-violet-950 space-y-0.5">
                          <div className="font-extrabold text-[10px] uppercase text-violet-900">
                            Inspector Remark:
                          </div>
                          <p className="font-medium">"{def.inspectorRemark}"</p>
                        </div>
                      )}

                      {def.isFixed && (
                        <div className="col-span-full p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
                          <span>
                            <strong>Resolved</strong> {def.fixedBy ? `by ${def.fixedBy}` : ''}
                            {def.fixedRemark ? ` • "${def.fixedRemark}"` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {def.photoUrl && (
                      <div>
                        <a
                          href={def.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          <span>View Defect Photo Attachment</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ================= TAB 3: CATEGORY STATS ================= */
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 mb-3">
                  Defect Frequency by Checklist Section
                </h4>
                {allDefects.length === 0 ? (
                  <p className="text-xs text-slate-400">No defect records to aggregate.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      allDefects.reduce<Record<string, { total: number; fixed: number }>>((acc, d) => {
                        if (!acc[d.sectionName]) acc[d.sectionName] = { total: 0, fixed: 0 };
                        acc[d.sectionName].total += 1;
                        if (d.isFixed) acc[d.sectionName].fixed += 1;
                        return acc;
                      }, {})
                    ).map(([secName, data]) => {
                      const pct = Math.round((data.total / allDefects.length) * 100);
                      return (
                        <div key={secName} className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>{secName}</span>
                            <span className="text-slate-500 font-semibold">
                              {data.total} item{data.total !== 1 ? 's' : ''} ({data.fixed} fixed)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                            <div
                              className="bg-rose-500 h-2 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Viewing records for <strong>Room {cleanRoom}</strong> ({propertyFilter === 'all' ? 'All Hotels' : propertyFilter})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-sm active:scale-95"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};
