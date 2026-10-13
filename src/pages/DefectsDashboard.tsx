import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  Filter,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import maxwellInspectionData from '../data/Maxwell_Inspection_List.json';
import { downloadPdfBlob } from '../services/pdfGenerator';

// Helper to extract 4-digit year from date string, timestamp, or number
const extractYear = (val: any): number | null => {
  if (!val || val === '—') return null;
  if (typeof val === 'number' && val >= 2000 && val <= 2100) return val;
  const match = String(val).match(/\b(20\d{2})\b/);
  if (match) return Number(match[1]);
  const subMatch = String(val).match(/(20\d{2})/);
  if (subMatch) return Number(subMatch[1]);
  const parsed = new Date(val);
  if (!isNaN(parsed.getFullYear()) && parsed.getFullYear() >= 2000) {
    return parsed.getFullYear();
  }
  return null;
};

export const DefectsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role === 'rpm') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Filters State
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Section Tab State: 'active' | 'completed' | 'all'
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  // Fix resolution remarks and loading per item: { [itemId]: remark }
  const [fixRemarks, setFixRemarks] = useState<Record<number, string>>({});
  const [fixingItemId, setFixingItemId] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin';
  const canFix = isAdmin || user?.role === 'inspector';

  const [inspections, setInspections] = useState<any[]>([]);
  const [rpmRecords, setRpmRecords] = useState<any[]>([]);
  const [expandedRoomIds, setExpandedRoomIds] = useState<Set<number>>(new Set());
  const [selectedModalRoom, setSelectedModalRoom] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [templateSections, setTemplateSections] = useState<any[]>(
    (maxwellInspectionData.sections as any[]) || []
  );
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Load inspection template
  useEffect(() => {
    api.getTemplate()
      .then((data) => {
        if (data?.sections) setTemplateSections(data.sections);
      })
      .catch(() => {});
  }, []);

  // Property Badge Style Helper
  const getPropertyBadgeStyle = (propName: string) => {
    const p = (propName || '').toLowerCase();
    if (p.includes('serangoon')) {
      return 'bg-emerald-50 text-emerald-900 border-emerald-300';
    }
    if (p.includes('vagabond')) {
      return 'bg-indigo-50 text-indigo-900 border-indigo-300';
    }
    return 'bg-amber-50 text-amber-950 border-amber-300';
  };

  // Item description & section name lookup
  const itemLookup = useMemo(() => {
    const map: Record<number, { description: string; sectionName: string; itemNo: string }> = {};
    templateSections.forEach((section) => {
      section.items?.forEach((item: any) => {
        map[item.id] = {
          description: item.description,
          sectionName: section.title || section.name || 'General',
          itemNo: item.item_no || String(item.id),
        };
      });
    });
    return map;
  }, [templateSections]);

  // Fetch inspections with defects and rpm schedule records from backend
  const loadDefectsData = async (forceFresh = false) => {
    setIsLoading(true);
    try {
      // 1. Fetch only inspections with defects (instant if cached, tiny payload from DB)
      const inspPromise = api.getInspections(
        {
          property_name: selectedProperty !== 'all' ? selectedProperty : undefined,
          has_defects: true,
        },
        forceFresh
      );

      // 2. Fetch RPM schedule records in parallel (or from cache)
      const rpmPromise = api.getRpmRecords(
        {
          property_name: selectedProperty !== 'all' ? selectedProperty : undefined,
        },
        forceFresh
      ).catch(() => []);

      // Unblock UI immediately once defective inspections arrive
      const inspData = await inspPromise;
      setInspections(inspData || []);
      setIsLoading(false);

      // Populate RPM records when available
      const rpmData = await rpmPromise;
      setRpmRecords(rpmData || []);
    } catch (err: any) {
      console.warn('Failed to load inspections for defects dashboard:', err);
      showToast('Could not load inspection data from server.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDefectsData();
  }, [selectedProperty]);

  // Extract only inspections that have defects (at least one FAIL item)
  const defectiveRooms = useMemo(() => {
    return inspections
      .filter((insp: any) => {
        return (
          Array.isArray(insp.items) &&
          insp.items.some((it: any) => it.result?.toLowerCase() === 'fail')
        );
      })
      .map((insp: any) => {
        const failedItems = (insp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
        const cleanRoom = (insp.room_number || '').replace(/room\s*/i, '').trim();
        const floorDigit = cleanRoom.charAt(0);
        const floor = floorDigit ? `Level ${floorDigit}` : 'Level 1';

        const inspYear = extractYear(insp.inspection_date) || extractYear(insp.created_at) || extractYear(insp.started_at);
        const roomProp = (insp.property_name || 'Maxwell').toLowerCase().trim();
        const matchedRpm =
          rpmRecords.find((r: any) => {
            const rClean = (r.room_or_area || '').toLowerCase().replace(/room\s*/i, '').trim();
            if (rClean !== cleanRoom.toLowerCase()) return false;
            if (r.property_name && r.property_name.toLowerCase().trim() !== roomProp) return false;
            if (inspYear && r.year) {
              return Number(r.year) === inspYear;
            }
            return true;
          }) ||
          rpmRecords.find((r: any) => {
            const rClean = (r.room_or_area || '').toLowerCase().replace(/room\s*/i, '').trim();
            if (rClean !== cleanRoom.toLowerCase()) return false;
            if (r.property_name && r.property_name.toLowerCase().trim() !== roomProp) return false;
            return true;
          });

        const rpmDate = matchedRpm?.rpm_date || insp.inspection_date || '—';
        const techName = insp.maintenance_carried_by || matchedRpm?.maintenance_carried_by || 'RPM Technician';
        const isVerified = insp.status === 'verified' || insp.status === 'accepted';
        const inspectionDate = matchedRpm?.inspection_date || (isVerified ? insp.inspection_date : null);
        const inspectorName = insp.inspected_by || matchedRpm?.inspected_by || (isVerified ? 'Inspector' : null);

        const roomYear =
          inspYear ||
          (matchedRpm?.year ? Number(matchedRpm.year) : null) ||
          extractYear(matchedRpm?.rpm_date) ||
          extractYear(matchedRpm?.inspection_date) ||
          extractYear(insp.quarter) ||
          currentYear;

        const fixedCount = failedItems.filter((it: any) => Boolean(it.is_fixed)).length;
        const totalDefects = failedItems.length;
        const isCompleted = (totalDefects > 0 && fixedCount === totalDefects) || insp.defects_status === 'completed';
        const openDefects = Math.max(0, totalDefects - fixedCount);

        return {
          ...insp,
          cleanRoom,
          floor,
          year: roomYear,
          failedItems,
          failCount: totalDefects,
          openDefects,
          fixedCount,
          isCompleted,
          rpmDate,
          techName,
          inspectionDate,
          inspectorName,
        };
      });
  }, [inspections, rpmRecords, currentYear]);

  // Dynamic available years list based on data and current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]);
    defectiveRooms.forEach((r) => {
      if (r.year) yearsSet.add(r.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [currentYear, defectiveRooms]);

  // Tab counts with respect to selected filters
  const activeDefectsCount = useMemo(() => {
    return defectiveRooms.filter((r) => {
      if (selectedYear !== 'all' && r.year !== Number(selectedYear)) return false;
      return !r.isCompleted;
    }).length;
  }, [defectiveRooms, selectedYear]);

  const completedIssuesCount = useMemo(() => {
    return defectiveRooms.filter((r) => {
      if (selectedYear !== 'all' && r.year !== Number(selectedYear)) return false;
      return r.isCompleted;
    }).length;
  }, [defectiveRooms, selectedYear]);

  const allRecordsCount = useMemo(() => {
    return defectiveRooms.filter((r) => {
      if (selectedYear !== 'all' && r.year !== Number(selectedYear)) return false;
      return true;
    }).length;
  }, [defectiveRooms, selectedYear]);

  // Apply filters to defective rooms
  const filteredRooms = useMemo(() => {
    return defectiveRooms.filter((room) => {
      // Tab filter: Active Defects vs Completed Issues
      if (activeTab === 'active' && room.isCompleted) {
        return false;
      }
      if (activeTab === 'completed' && !room.isCompleted) {
        return false;
      }

      // Property filter
      if (selectedProperty !== 'all') {
        const p = (room.property_name || 'Maxwell').toLowerCase().trim();
        if (p !== selectedProperty.toLowerCase().trim()) {
          return false;
        }
      }

      // Year filter
      if (selectedYear !== 'all' && room.year !== Number(selectedYear)) {
        return false;
      }

      // Quarter filter
      if (selectedQuarter !== 'all' && room.quarter && !room.quarter.includes(selectedQuarter)) {
        return false;
      }
      // Floor filter
      if (selectedFloor !== 'all' && room.floor !== selectedFloor) {
        return false;
      }
      // Status filter: Pending vs Completed
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && room.isCompleted) return false;
        if (statusFilter === 'completed' && !room.isCompleted) return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const propMatch = (room.property_name || '').toLowerCase().includes(q);
        const roomMatch = (room.room_number || '').toLowerCase().includes(q);
        const techMatch = (room.techName || '').toLowerCase().includes(q);
        const inspMatch = (room.inspectorName || '').toLowerCase().includes(q);
        const remarkMatch =
          (room.overall_remark || '').toLowerCase().includes(q) ||
          (room.inspector_remark || '').toLowerCase().includes(q);
        const itemMatch = room.failedItems.some((it: any) => {
          const info = itemLookup[it.checklist_item_id];
          return (
            (info?.description || '').toLowerCase().includes(q) ||
            (info?.sectionName || '').toLowerCase().includes(q) ||
            (it.remark || '').toLowerCase().includes(q) ||
            (it.inspector_remark || '').toLowerCase().includes(q)
          );
        });
        if (!propMatch && !roomMatch && !techMatch && !inspMatch && !remarkMatch && !itemMatch) {
          return false;
        }
      }
      return true;
    });
  }, [defectiveRooms, activeTab, selectedYear, selectedQuarter, selectedFloor, statusFilter, searchQuery, itemLookup]);

  // Expand / Collapse toggles
  const toggleRowExpand = (id: number) => {
    setExpandedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllRows = () => {
    if (expandedRoomIds.size === filteredRooms.length) {
      setExpandedRoomIds(new Set());
    } else {
      setExpandedRoomIds(new Set(filteredRooms.map((r) => r.id)));
    }
  };

  // Fix resolution action handlers
  const handleToggleFix = async (inspectionId: number, itemId: number, isFixed: boolean) => {
    setFixingItemId(itemId);
    try {
      const typedRemark = fixRemarks[itemId]?.trim();
      const remark = typedRemark || (isFixed ? 'Fixed and verified by Admin' : '');

      const updatedInsp = await api.fixDefectItem(inspectionId, itemId, {
        is_fixed: isFixed,
        fixed_remark: remark,
        fixed_by: user?.full_name || 'Admin',
      });

      // Update state
      setInspections((prev) =>
        prev.map((insp) => (insp.id === inspectionId ? updatedInsp : insp))
      );

      // Keep selectedModalRoom in sync if open
      if (selectedModalRoom && selectedModalRoom.id === inspectionId) {
        const failedItems = (updatedInsp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
        const fixedCount = failedItems.filter((it: any) => it.is_fixed).length;
        const isCompleted = failedItems.length > 0 && fixedCount === failedItems.length;
        setSelectedModalRoom((prev: any) => ({
          ...prev,
          items: updatedInsp.items,
          failedItems,
          fixedCount,
          isCompleted,
        }));
      }

      // Check if all issues in this inspection are now fixed
      const failed = (updatedInsp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
      const allFixed = failed.length > 0 && failed.every((it: any) => it.is_fixed);

      if (isFixed && allFixed) {
        showToast(`All issues for Room ${updatedInsp.room_number} are now FIXED and moved to Completed Issues! 🎉`, 'success');
      } else if (isFixed) {
        showToast(`Issue marked as Fixed for Room ${updatedInsp.room_number}.`, 'success');
      } else {
        showToast(`Issue reopened for Room ${updatedInsp.room_number}.`, 'info');
      }
    } catch (err: any) {
      console.error('Failed to update defect item fix status:', err);
      showToast(err?.message || 'Failed to update issue fix status.', 'error');
    } finally {
      setFixingItemId(null);
    }
  };

  // Handle fixing all issues in a room at once
  const handleFixAllInRoom = async (inspectionId: number, roomNumber: string) => {
    const remark = window.prompt(
      `Enter resolution remark for all issues in Room ${roomNumber}:`,
      'All maintenance defects repaired and verified'
    );
    if (remark === null) return; // user cancelled

    setIsLoading(true);
    try {
      const updatedInsp = await api.fixAllDefects(inspectionId, {
        fixed_remark: remark.trim() || 'All defects resolved by Admin',
        fixed_by: user?.full_name || 'Admin',
      });

      setInspections((prev) =>
        prev.map((insp) => (insp.id === inspectionId ? updatedInsp : insp))
      );

      if (selectedModalRoom && selectedModalRoom.id === inspectionId) {
        const failedItems = (updatedInsp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
        const fixedCount = failedItems.filter((it: any) => it.is_fixed).length;
        const isCompleted = failedItems.length > 0 && fixedCount === failedItems.length;
        setSelectedModalRoom((prev: any) => ({
          ...prev,
          items: updatedInsp.items,
          failedItems,
          fixedCount,
          isCompleted,
        }));
      }

      showToast(`All issues in Room ${roomNumber} marked as fixed and moved to Completed Issues!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to fix all issues.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Action handlers
  const handleOpenForm = (roomNumber: string, propertyName?: string) => {
    const clean = roomNumber.replace(/Room\s*/i, '').trim();
    const prop = propertyName || (selectedProperty !== 'all' ? selectedProperty : 'Maxwell');
    navigate(`/form?room=${encodeURIComponent(clean)}&property=${encodeURIComponent(prop)}`);
  };

  const handleDownloadPdf = async (
    roomNumber: string,
    date: string,
    docType: 'RPM' | 'Inspection' = 'Inspection',
    property?: string
  ) => {
    try {
      showToast(`Fetching ${docType} PDF for Room ${roomNumber}...`, 'info');
      const cleanRoom = roomNumber.replace(/Room\s*/i, '').trim();
      const year = date ? new Date(date).getFullYear() || 2026 : 2026;
      const effectiveProperty = property || (selectedProperty !== 'all' ? selectedProperty : undefined);

      const { blob, filename } = await api.downloadDropboxPdf({
        room_number: cleanRoom,
        inspection_date: date,
        year,
        quarter: selectedQuarter !== 'all' ? selectedQuarter : '1st',
        document_type: docType,
        property_name: effectiveProperty,
      });

      downloadPdfBlob(blob, filename);
      showToast(`Downloaded ${filename} successfully!`, 'success');
    } catch (err: any) {
      console.warn('PDF download failed:', err);
      showToast(`Could not find ${docType} PDF for Room ${roomNumber} in Dropbox.`, 'error');
    }
  };

  // Export all defect records to XLSX
  const handleExportXLSX = () => {
    if (filteredRooms.length === 0) {
      showToast('No defect records to export with current filters.', 'info');
      return;
    }

    const rows: (string | number)[][] = [
      [
        'Property',
        'Quarter',
        'Room No',
        'Level',
        'Status',
        'RPM Date',
        'RPM Technician',
        'Inspection Date',
        'Inspector',
        'Defect Item #',
        'Section',
        'Defect Description',
        'Technician Remark',
        'Inspector Remark',
      ],
    ];

    filteredRooms.forEach((room) => {
      room.failedItems.forEach((f: any) => {
        const info = itemLookup[f.checklist_item_id];
        rows.push([
          room.property_name || 'Maxwell',
          room.quarter || selectedQuarter,
          room.cleanRoom,
          room.floor,
          room.isCompleted ? 'COMPLETED' : 'PENDING',
          room.rpmDate || '—',
          room.techName || 'RPM Staff',
          room.inspectionDate || '—',
          room.inspectorName || 'Pending',
          info?.itemNo || f.checklist_item_id,
          info?.sectionName || 'General',
          info?.description || `Checklist Item #${f.checklist_item_id}`,
          f.remark || '—',
          f.inspector_remark || '—',
        ]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Defects Report');
    const fileNamePrefix = selectedProperty === 'all' ? 'All_Properties' : selectedProperty;
    XLSX.writeFile(workbook, `${fileNamePrefix}_Defects_Report_${selectedYear !== 'all' ? selectedYear : currentYear}.xlsx`);
    showToast('Defects report exported to Excel successfully!');
  };

  return (
    <div className="min-h-screen bg-slate-900/5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] flex flex-col font-sans text-slate-900 pb-20">
      <Navbar />

      {/* Floating Notification Toast */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
          notification.type === 'error'
            ? 'bg-rose-950/95 border-rose-700'
            : 'bg-slate-900/95 border-slate-700'
        }`}>
          {notification.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-amber-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      <main className="w-full max-w-[1780px] mx-auto px-3 sm:px-5 lg:px-7 py-6 space-y-5">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 p-5 rounded-2xl text-white shadow-xl border border-rose-900/40">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex-shrink-0"
              title="Return to Main Schedule Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                  Defects Center
                </span>
                <span className="text-xs text-rose-300 font-semibold">• Live Maintenance Audit</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-rose-400 stroke-[2.5]" />
                <span>Defected Rooms Dashboard</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportXLSX}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              title="Export all defect records to Excel spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Export Defects</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-amber-300" />
              <span>Main Dashboard</span>
            </button>
          </div>
        </div>

        {/* Filter Command Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-rose-600" />
              <span>Defect Filters</span>
            </div>

            {/* Property */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="defects-property" className="text-xs font-bold text-slate-600">Property:</label>
              <select
                id="defects-property"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm transition"
              >
                <option value="all">All Properties</option>
                <option value="Maxwell">Maxwell</option>
                <option value="Serangoon House">Serangoon House</option>
                <option value="Vagabond Club">Vagabond Club</option>
              </select>
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="defects-year" className="text-xs font-bold text-slate-600">Year:</label>
              <select
                id="defects-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm transition"
              >
                <option value="all">All Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="defects-quarter" className="text-xs font-bold text-slate-600">Quarter:</label>
              <select
                id="defects-quarter"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm transition"
              >
                <option value="all">All Quarters</option>
                <option value="1st">1st Quarter (Jan - April)</option>
                <option value="2nd">2nd Quarter (May - August)</option>
                <option value="3rd">3rd Quarter (Sept - Dec)</option>
              </select>
            </div>

            {/* Floor / Level Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="defects-floor" className="text-xs font-bold text-slate-600">Level:</label>
              <select
                id="defects-floor"
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm transition"
              >
                <option value="all">All Levels</option>
                <option value="Level 1">Level 1</option>
                <option value="Level 2">Level 2</option>
                <option value="Level 3">Level 3</option>
                <option value="Level 4">Level 4</option>
              </select>
            </div>

            {/* Status Filter: Pending vs Completed */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="defects-status" className="text-xs font-bold text-slate-600">Status:</label>
              <select
                id="defects-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm transition"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Live Search */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search room, defect, or staff..."
                className="py-2 pl-8 pr-8 rounded-xl text-xs font-medium bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 w-[200px] sm:w-[240px] shadow-sm transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => loadDefectsData(true)}
              disabled={isLoading}
              className="py-2 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
              title="Refresh defect records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-bold self-end xl:self-auto">
            Showing {filteredRooms.length} of {allRecordsCount} defected room{allRecordsCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Section Navigation Tabs: Active Defects vs Completed Issues */}
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'active'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${activeTab === 'active' ? 'text-white' : 'text-rose-600'}`} />
              <span>Active Defects</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {activeDefectsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <CheckCheck className={`w-4 h-4 ${activeTab === 'completed' ? 'text-white' : 'text-emerald-600'}`} />
              <span>Completed Issues</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {completedIssuesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>All Records</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {allRecordsCount}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-bold px-2 flex items-center gap-1.5">
            {activeTab === 'active' && (
              <span className="text-rose-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Showing rooms with open / pending defects requiring fix</span>
              </span>
            )}
            {activeTab === 'completed' && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Showing rooms where all defects have been fully resolved</span>
              </span>
            )}
            {activeTab === 'all' && (
              <span className="text-slate-600 font-semibold">Showing all room defect records</span>
            )}
          </div>
        </div>

        {/* Defect Rooms Table Structure */}
        {filteredRooms.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200/90 shadow-xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-2">
              {activeTab === 'completed' ? 'No Completed Issues Yet' : 'No Active Defects Found'}
            </h3>
            <p className="text-slate-500 max-w-md text-xs leading-relaxed">
              {activeTab === 'completed'
                ? 'When all defect issues in a room are marked as Fixed with a remark, the room will automatically move to this Completed Issues section.'
                : searchQuery || selectedFloor !== 'all' || statusFilter !== 'all' || selectedQuarter !== 'all' || selectedYear !== 'all'
                  ? 'No defect reports match the current filter criteria. Try resetting your search or filter options.'
                  : `All submitted room checklist inspections for ${selectedProperty} are clean with zero open defects.`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden">
            <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
              activeTab === 'completed' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold uppercase text-[11px] tracking-wider ${
                  activeTab === 'completed' ? 'text-emerald-950' : 'text-slate-700'
                }`}>
                  {activeTab === 'completed' ? 'Completed Issues Archive' : 'Defected Rooms Matrix'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${
                  activeTab === 'completed'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''}
                </span>
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  {activeTab === 'completed'
                    ? '• All defects in these rooms are fully fixed and verified'
                    : '• Click any row to expand/collapse full defect checklist details and fix issues'}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAllRows}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
              >
                {expandedRoomIds.size === filteredRooms.length ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                    <span>Collapse All</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>Expand All</span>
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-700 select-none">
                    <th className="py-3.5 px-3 w-10 text-center">#</th>
                    <th className="py-3.5 px-4 w-32">Room No</th>
                    <th className="py-3.5 px-4 w-36">Property</th>
                    <th className="py-3.5 px-4 min-w-[190px]">RPM Date & Name</th>
                    <th className="py-3.5 px-4 min-w-[190px]">Inspection Date & Name</th>
                    <th className="py-3.5 px-4 w-28">Level</th>
                    <th className="py-3.5 px-4 w-40 text-center">Defects / Progress</th>
                    <th className="py-3.5 px-4 w-36 text-center">Status</th>
                    <th className="py-3.5 px-4 min-w-[210px] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRooms.map((room) => {
                    const isExpanded = expandedRoomIds.has(room.id);

                    return (
                      <React.Fragment key={room.id}>
                        <tr
                          onClick={() => toggleRowExpand(room.id)}
                          className={`cursor-pointer transition-colors border-b select-none ${
                            room.isCompleted
                              ? isExpanded
                                ? 'bg-emerald-50/70 hover:bg-emerald-50/80 border-emerald-200'
                                : 'bg-emerald-50/30 hover:bg-emerald-50/50 border-emerald-100'
                              : isExpanded
                                ? 'bg-rose-50/40 hover:bg-rose-50/60 border-slate-200'
                                : 'hover:bg-slate-50/90 bg-white border-slate-200'
                          }`}
                        >
                          {/* Chevron Toggle */}
                          <td className="py-3.5 px-3 text-center text-slate-400">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(room.id);
                              }}
                              className={`p-1 rounded-md transition ${
                                room.isCompleted ? 'hover:bg-emerald-100 text-emerald-700' : 'hover:bg-slate-200 text-slate-600'
                              }`}
                              title={isExpanded ? 'Collapse defect details' : 'Click to view full defect details'}
                            >
                              {isExpanded ? (
                                <ChevronUp className={`w-4 h-4 stroke-[2.5] ${room.isCompleted ? 'text-emerald-700' : 'text-rose-600'}`} />
                              ) : (
                                <ChevronDown className={`w-4 h-4 stroke-[2.5] ${room.isCompleted ? 'text-emerald-600' : 'text-slate-500'}`} />
                              )}
                            </button>
                          </td>

                          {/* Room No */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                room.isCompleted
                                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-700'
                                  : 'bg-rose-100 border border-rose-300 text-rose-700'
                              }`}>
                                {room.isCompleted ? (
                                  <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                                )}
                              </div>
                              <div>
                                <div className={`font-black text-sm ${room.isCompleted ? 'text-emerald-950' : 'text-slate-900'}`}>
                                  Room {room.cleanRoom}
                                </div>
                                <div className={`text-[10px] font-bold uppercase tracking-tight ${
                                  room.isCompleted ? 'text-emerald-700' : 'text-slate-500'
                                }`}>
                                  {room.isCompleted ? 'Resolved • ' : ''}{room.quarter || selectedQuarter}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Property Name */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs ${getPropertyBadgeStyle(
                                room.property_name || 'Maxwell'
                              )}`}
                            >
                              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{room.property_name || 'Maxwell'}</span>
                            </span>
                          </td>

                          {/* RPM Date & Name */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{room.rpmDate || '—'}</span>
                              </div>
                              <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                                  <Wrench className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                                  <span>{room.techName || 'RPM Technician'}</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Inspection Date & Name */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{room.inspectionDate || '—'}</span>
                              </div>
                              <div>
                                {room.inspectorName ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-violet-100 text-violet-950 border border-violet-300">
                                    <UserCheck className="w-3 h-3 text-violet-700 flex-shrink-0" />
                                    <span>{room.inspectorName}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>Pending Inspection</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Level */}
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {room.floor}
                            </span>
                          </td>

                          {/* Defects & Fix Progress */}
                          <td className="py-3.5 px-4 text-center">
                            {room.isCompleted ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                  <span>0 Defects (All Fixed)</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-tight">
                                  {room.failCount} of {room.failCount} Resolved
                                </span>
                              </div>
                            ) : room.fixedCount > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                                  <span>{room.openDefects} Defect{room.openDefects !== 1 ? 's' : ''} Left</span>
                                </span>
                                <span className="text-[10px] text-amber-700 font-bold">
                                  {room.fixedCount} of {room.failCount} Fixed
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 shadow-sm">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                                  <span>{room.openDefects} Defect{room.openDefects !== 1 ? 's' : ''}</span>
                                </span>
                                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-tight">
                                  Pending Fix
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Status: Pending when unfixed, Completed when fixed */}
                          <td className="py-3.5 px-4 text-center">
                            {room.isCompleted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border shadow-2xs bg-emerald-100 text-emerald-800 border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border shadow-2xs bg-amber-100 text-amber-900 border-amber-300">
                                <Clock className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Actions: Inspect & PDF Download Buttons */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Inspect Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenForm(room.room_number, room.property_name)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow transition cursor-pointer active:scale-95"
                                title={`Inspect or verify Room ${room.cleanRoom}`}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>

                              {/* PDF Download Buttons */}
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(room.room_number, room.inspection_date, 'RPM', room.property_name)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition cursor-pointer active:scale-95"
                                title="Download RPM Form PDF from Dropbox"
                              >
                                <FileDown className="w-3 h-3 text-amber-400" />
                                <span>RPM</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(room.room_number, room.inspection_date, 'Inspection', room.property_name)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow-sm transition cursor-pointer active:scale-95"
                                title="Download Inspection PDF from Dropbox"
                              >
                                <FileDown className="w-3 h-3 text-emerald-400" />
                                <span>Insp</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Full Defect Details Row */}
                        {isExpanded && (
                          <tr className={`${room.isCompleted ? 'bg-emerald-50/30 border-b-2 border-emerald-300' : 'bg-rose-50/20 border-b-2 border-slate-300'} animate-in fade-in duration-200`}>
                            <td colSpan={9} className="p-4 sm:p-6">
                              <div className={`bg-white rounded-2xl border ${room.isCompleted ? 'border-emerald-300 shadow-emerald-100/50' : 'border-rose-200'} shadow-md p-4 sm:p-5 space-y-4`}>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg ${room.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center font-bold`}>
                                      {room.isCompleted ? (
                                        <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                                      ) : (
                                        <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                                      )}
                                    </div>
                                    <div>
                                      <h4 className="font-black text-sm text-slate-900">
                                        Room {room.cleanRoom} — {room.isCompleted ? 'All Defect Checklist Items Resolved' : 'Full Defect Checklist Breakdown'}
                                      </h4>
                                      <p className={`text-[11px] font-medium ${room.isCompleted ? 'text-emerald-700' : 'text-slate-500'}`}>
                                        {room.property_name || selectedProperty} • {room.floor} • {room.quarter || selectedQuarter} • {room.isCompleted ? `All ${room.failCount} defect items marked as fixed` : `${room.openDefects} open defect${room.openDefects !== 1 ? 's' : ''} (${room.fixedCount} fixed)`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {room.isCompleted ? (
                                      <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                                        <CheckCheck className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                                        <span>All Issues Resolved</span>
                                      </span>
                                    ) : canFix ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFixAllInRoom(room.id, room.cleanRoom);
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                                        title="Mark all defects in this room as fixed at once"
                                      >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                        <span>Fix All ({room.failCount - room.fixedCount} Open)</span>
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedModalRoom(room);
                                      }}
                                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Full Screen Dialog</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Failed Items Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {room.failedItems.map((item: any, itemIdx: number) => {
                                    const info = itemLookup[item.checklist_item_id];
                                    return (
                                      <div
                                        key={itemIdx}
                                        className={`rounded-2xl p-4 border transition-all ${
                                          item.is_fixed
                                            ? 'bg-emerald-50/40 border-emerald-300 shadow-sm'
                                            : 'bg-rose-50/30 border-rose-200 shadow-sm'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="space-y-0.5">
                                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-800">
                                              {info?.sectionName || 'Checklist Item'}
                                            </span>
                                            <div className="font-extrabold text-slate-900 text-xs mt-1">
                                              {info?.description || `Checklist Item #${item.checklist_item_id}`}
                                            </div>
                                          </div>
                                          {item.is_fixed ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white flex-shrink-0 flex items-center gap-1 shadow-sm">
                                              <CheckCheck className="w-3 h-3" />
                                              <span>FIXED</span>
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white flex-shrink-0">
                                              FAIL
                                            </span>
                                          )}
                                        </div>

                                        {/* RPM Technician Remark */}
                                        {item.remark && (
                                          <div className="bg-white rounded-lg p-2.5 border border-rose-200 text-slate-800 text-[11px] space-y-0.5">
                                            <div className="font-bold text-emerald-800 flex items-center gap-1 text-[10px] uppercase">
                                              <Wrench className="w-3 h-3 text-emerald-600" />
                                              <span>Technician Remark:</span>
                                            </div>
                                            <p className="italic text-slate-700 pl-4">"{item.remark}"</p>
                                          </div>
                                        )}

                                        {/* Inspector Remark */}
                                        {item.inspector_remark && (
                                          <div className="bg-blue-50/80 rounded-lg p-2.5 border border-blue-200 text-slate-800 text-[11px] space-y-0.5">
                                            <div className="font-bold text-violet-900 flex items-center gap-1 text-[10px] uppercase">
                                              <UserCheck className="w-3 h-3 text-violet-600" />
                                              <span>Inspector Note:</span>
                                            </div>
                                            <p className="text-violet-950 pl-4 font-medium">"{item.inspector_remark}"</p>
                                          </div>
                                        )}

                                        {/* Defect Photo */}
                                        {item.photo_url && (
                                          <div className="pt-1">
                                            <a
                                              href={item.photo_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline"
                                            >
                                              <span>View Flagged Defect Photo</span>
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          </div>
                                        )}

                                        {/* Defect Fix & Remark Action Box */}
                                        <div className="mt-3 pt-3 border-t border-slate-200/90" onClick={(e) => e.stopPropagation()}>
                                          {item.is_fixed ? (
                                            <div className="bg-emerald-100/70 border border-emerald-300 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                              <div className="space-y-0.5">
                                                <div className="flex items-center gap-1 text-xs font-black text-emerald-950">
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                                                  <span>Resolved {item.fixed_by ? `by ${item.fixed_by}` : ''}</span>
                                                </div>
                                                {item.fixed_remark && (
                                                  <div className="text-[11px] text-emerald-900 font-medium pl-4 italic">
                                                    Remark: "{item.fixed_remark}"
                                                  </div>
                                                )}
                                              </div>
                                              {canFix && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleFix(room.id, item.id, false)}
                                                  disabled={fixingItemId === item.id}
                                                  className="self-start sm:self-auto px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95 flex-shrink-0"
                                                  title="Reopen issue if further maintenance is needed"
                                                >
                                                  <RotateCcw className="w-3 h-3" />
                                                  <span>Reopen</span>
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="bg-white/95 border border-slate-300 rounded-xl p-2.5 space-y-2">
                                              <div className="flex items-center justify-between gap-2">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                                  <MessageSquare className="w-3 h-3 text-rose-600" />
                                                  <span>Resolution Remark & Fix</span>
                                                </label>
                                              </div>
                                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <input
                                                  type="text"
                                                  value={fixRemarks[item.id] ?? ''}
                                                  onChange={(e) =>
                                                    setFixRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                  }
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      e.preventDefault();
                                                      handleToggleFix(room.id, item.id, true);
                                                    }
                                                  }}
                                                  placeholder="Enter repair remark (e.g. Repaired, Replaced)..."
                                                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleFix(room.id, item.id, true)}
                                                  disabled={fixingItemId === item.id}
                                                  className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50 flex-shrink-0"
                                                  title="Mark this defect as fixed"
                                                >
                                                  {fixingItemId === item.id ? (
                                                    <>
                                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                                      <span>Saving...</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                      <span>Fixed</span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Overall Remarks */}
                                {(room.overall_remark || room.inspector_remark) && (
                                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-4 text-xs text-slate-600">
                                    {room.overall_remark && (
                                      <div>
                                        <strong className="text-slate-800">Technician Overall:</strong> {room.overall_remark}
                                      </div>
                                    )}
                                    {room.inspector_remark && (
                                      <div>
                                        <strong className="text-violet-900">Inspector Overall:</strong> {room.inspector_remark}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Dialog for Full Room Defect Details */}
        {selectedModalRoom && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
            onClick={() => setSelectedModalRoom(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={`p-5 text-white flex items-center justify-between ${
                selectedModalRoom.isCompleted
                  ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950'
                  : 'bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                    selectedModalRoom.isCompleted ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}>
                    {selectedModalRoom.isCompleted ? (
                      <CheckCheck className="w-5 h-5 text-white stroke-[2.5]" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-white stroke-[2.5]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold">
                        Room {selectedModalRoom.cleanRoom} — {selectedModalRoom.isCompleted ? 'All Defects Resolved' : 'Defect Details'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        selectedModalRoom.isCompleted
                          ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                          : 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                      }`}>
                        {selectedModalRoom.isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-xs text-rose-200 font-medium">
                      {selectedModalRoom.property_name || selectedProperty} • {selectedModalRoom.floor} • {selectedModalRoom.quarter || selectedQuarter} •{' '}
                      {selectedModalRoom.isCompleted
                        ? `0 Defects Remaining (All ${selectedModalRoom.failCount} Fixed)`
                        : `${selectedModalRoom.openDefects ?? (selectedModalRoom.failCount - selectedModalRoom.fixedCount)} Defects Left (${selectedModalRoom.fixedCount} Fixed)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedModalRoom(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                {/* RPM & Inspector Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">RPM Maintenance</div>
                    <div className="font-semibold text-slate-800">Date: {selectedModalRoom.rpmDate || '—'}</div>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                        <Wrench className="w-3 h-3 text-emerald-700" />
                        <span>{selectedModalRoom.techName || 'RPM Technician'}</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">Inspector Verification</div>
                    <div className="font-semibold text-slate-800">Date: {selectedModalRoom.inspectionDate || '—'}</div>
                    <div className="mt-1">
                      {selectedModalRoom.inspectorName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-violet-100 text-violet-950 border border-violet-300">
                          <UserCheck className="w-3 h-3 text-violet-700" />
                          <span>{selectedModalRoom.inspectorName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Pending Inspection</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Failed items list */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      selectedModalRoom.isCompleted ? 'text-emerald-950' : 'text-rose-950'
                    }`}>
                      {selectedModalRoom.isCompleted ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span>
                        {selectedModalRoom.isCompleted
                          ? `Resolved Checklist Items (${selectedModalRoom.failedItems.length} Fixed)`
                          : `Defective Checklist Items (${selectedModalRoom.openDefects ?? (selectedModalRoom.failCount - selectedModalRoom.fixedCount)} Remaining)`}
                      </span>
                    </h4>
                    {selectedModalRoom.isCompleted ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <CheckCheck className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        <span>All Issues Resolved</span>
                      </span>
                    ) : canFix ? (
                      <button
                        type="button"
                        onClick={() => handleFixAllInRoom(selectedModalRoom.id, selectedModalRoom.cleanRoom)}
                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Fix All ({selectedModalRoom.failCount - selectedModalRoom.fixedCount} Open)</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {selectedModalRoom.failedItems.map((item: any, iIdx: number) => {
                      const info = itemLookup[item.checklist_item_id];
                      const isItemFixed = Boolean(item.is_fixed);
                      return (
                        <div
                          key={iIdx}
                          className={`rounded-2xl p-4 border transition-all text-xs space-y-2 ${
                            isItemFixed
                              ? 'bg-emerald-50/40 border-emerald-300 shadow-sm'
                              : 'bg-rose-50/40 border-rose-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-800">
                                {info?.sectionName || 'Checklist Item'}
                              </span>
                              <div className="font-extrabold text-slate-900 text-xs mt-1">
                                {info?.description || `Checklist Item #${item.checklist_item_id}`}
                              </div>
                            </div>
                            {isItemFixed ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white flex-shrink-0 flex items-center gap-1 shadow-sm">
                                <CheckCheck className="w-3 h-3" />
                                <span>FIXED</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white flex-shrink-0">
                                FAIL
                              </span>
                            )}
                          </div>

                          {/* RPM Technician Remark */}
                          {item.remark && (
                            <div className="bg-white rounded-xl p-2.5 border border-slate-200 text-slate-800 text-[11px] space-y-0.5">
                              <div className="font-bold text-emerald-800 flex items-center gap-1 text-[10px] uppercase">
                                <Wrench className="w-3 h-3 text-emerald-600" />
                                <span>Technician Remark:</span>
                              </div>
                              <p className="italic text-slate-700 pl-4">"{item.remark}"</p>
                            </div>
                          )}

                          {/* Inspector Remark */}
                          {item.inspector_remark && (
                            <div className="bg-blue-50/80 rounded-xl p-2.5 border border-blue-200 text-slate-800 text-[11px] space-y-0.5">
                              <div className="font-bold text-violet-900 flex items-center gap-1 text-[10px] uppercase">
                                <UserCheck className="w-3 h-3 text-violet-600" />
                                <span>Inspector Note:</span>
                              </div>
                              <p className="text-violet-950 pl-4 font-medium">"{item.inspector_remark}"</p>
                            </div>
                          )}

                          {/* Defect Photo */}
                          {item.photo_url && (
                            <div className="pt-1">
                              <a
                                href={item.photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                <span>View Flagged Defect Photo</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {/* Defect Fix & Remark Action Box */}
                          <div className="mt-3 pt-3 border-t border-slate-200/90" onClick={(e) => e.stopPropagation()}>
                            {isItemFixed ? (
                              <div className="bg-emerald-100/70 border border-emerald-300 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-xs font-black text-emerald-950">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                                    <span>Resolved {item.fixed_by ? `by ${item.fixed_by}` : ''}</span>
                                  </div>
                                  {item.fixed_remark && (
                                    <div className="text-[11px] text-emerald-900 font-medium pl-4 italic">
                                      Remark: "{item.fixed_remark}"
                                    </div>
                                  )}
                                </div>
                                {canFix && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFix(selectedModalRoom.id, item.id, false)}
                                    disabled={fixingItemId === item.id}
                                    className="self-start sm:self-auto px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95 flex-shrink-0"
                                    title="Reopen issue if further maintenance is needed"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reopen</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="bg-white/95 border border-slate-300 rounded-xl p-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3 text-rose-600" />
                                    <span>Resolution Remark & Fix</span>
                                  </label>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <input
                                    type="text"
                                    value={fixRemarks[item.id] ?? ''}
                                    onChange={(e) =>
                                      setFixRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleToggleFix(selectedModalRoom.id, item.id, true);
                                      }
                                    }}
                                    placeholder="Enter repair remark (e.g. Repaired, Replaced)..."
                                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFix(selectedModalRoom.id, item.id, true)}
                                    disabled={fixingItemId === item.id}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50 flex-shrink-0"
                                    title="Mark this defect as fixed"
                                  >
                                    {fixingItemId === item.id ? (
                                      <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Fixed</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Overall Remarks in modal */}
                {(selectedModalRoom.overall_remark || selectedModalRoom.inspector_remark) && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    {selectedModalRoom.overall_remark && (
                      <div>
                        <strong className="text-slate-800">Technician Overall:</strong> {selectedModalRoom.overall_remark}
                      </div>
                    )}
                    {selectedModalRoom.inspector_remark && (
                      <div>
                        <strong className="text-violet-900">Inspector Overall:</strong> {selectedModalRoom.inspector_remark}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer actions */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(selectedModalRoom.room_number, selectedModalRoom.inspection_date, 'RPM', selectedModalRoom.property_name || selectedProperty)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-amber-400" />
                      <span>Download RPM PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(selectedModalRoom.room_number, selectedModalRoom.inspection_date, 'Inspection', selectedModalRoom.property_name || selectedProperty)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download Inspection PDF</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenForm(selectedModalRoom.room_number, selectedModalRoom.property_name)}
                    className="py-2 px-4 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Open & Inspect Room</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DefectsDashboard;
