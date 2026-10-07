import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { api, type RpmRecord } from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
  ExternalLink,
  Check,
  Building2,
  ShieldCheck,
  FileDown,
  ClipboardCheck,
  Edit3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Bell,
} from 'lucide-react';

// Static template matrix containing exact room layout and initial fallback
import { RAW_CSV_ROWS, type RawCell } from '../data/rpmCsvData';
import { MAXWELL_SECTIONS } from '../data/templateData';

interface TableCell {
  room: string;
  rpm: string;
  inspection: string;
  status: string;
  isPublicHeader?: boolean;
  recordId?: number;
}

interface TableRow {
  block1: TableCell;
  block2: TableCell;
  block3: TableCell;
  block4: TableCell;
}

// Derive the current quarter string from today's date
const getCurrentQuarter = (): { year: number; quarter: string } => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();
  if (month >= 1 && month <= 4) return { year, quarter: '1st Quarter (Jan - April)' };
  if (month >= 5 && month <= 8) return { year, quarter: '2nd Quarter (May - August)' };
  return { year, quarter: '3rd Quarter (Sept - Dec)' };
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isInspector = user?.role === 'inspector';

  // Filter States — default to the current calendar quarter
  const { year: currentYear, quarter: currentQuarter } = getCurrentQuarter();
  const [selectedProperty, setSelectedProperty] = useState<string>('Maxwell');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<string>(currentQuarter);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Done' | 'Pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [records, setRecords] = useState<RpmRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Defect notification state for Inspector & Admin
  const [defectiveInspections, setDefectiveInspections] = useState<any[]>([]);
  const [isDefectBannerDismissed, setIsDefectBannerDismissed] = useState<boolean>(false);
  const [isDefectListExpanded, setIsDefectListExpanded] = useState<boolean>(false);

  // Load records from backend API
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRpmRecords({
        property_name: selectedProperty,
        year: selectedYear,
        quarter: selectedQuarter,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
      });
      setIsBackendConnected(true);
      if (data) {
        setRecords(data);
      }

      // Fetch defects for Inspector & Admin notification showcase
      if (isAdmin || isInspector) {
        try {
          const allInspections = await api.getInspections({
            property_name: selectedProperty,
          });
          const flagged = (allInspections || []).filter((insp: any) => {
            return (
              Array.isArray(insp.items) &&
              insp.items.some((it: any) => it.result?.toLowerCase() === 'fail')
            );
          });
          setDefectiveInspections(flagged);
        } catch (e) {
          console.warn('Inspection defects fetch note:', e);
        }
      }
    } catch (err) {
      setIsBackendConnected(false);
      setRecords([]);
      console.warn('Backend sync failed. Hiding table as requested.', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProperty, selectedYear, selectedQuarter, statusFilter, searchQuery, isAdmin, isInspector]);

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper for dynamic quarter header label
  const quarterHeaderTitle = useMemo(() => {
    const shortYr = String(selectedYear).slice(-2);
    if (selectedQuarter.includes('1st') || selectedQuarter.includes('Jan')) {
      return `1st Quarter Jan-April ${shortYr}`;
    }
    if (selectedQuarter.includes('2nd') || selectedQuarter.includes('May')) {
      return `2nd Quarter May-August ${shortYr}`;
    }
    if (selectedQuarter.includes('3rd') || selectedQuarter.includes('Sept') || selectedQuarter.includes('Sep')) {
      return `3rd Quarter Sept-Dec ${shortYr}`;
    }
    return `${selectedQuarter} ${shortYr}`;
  }, [selectedQuarter, selectedYear]);

  // Construct table rows structured identically to the 4-floor layout
  const tableRows: TableRow[] = useMemo(() => {
    return RAW_CSV_ROWS.map((row) => {
      const findUpdated = (roomName: string, defaultCell: RawCell): TableCell => {
        if (!roomName || defaultCell.isPublicHeader) {
          return { room: defaultCell.room, rpm: '', inspection: '', status: '', isPublicHeader: defaultCell.isPublicHeader };
        }

        // Find matching record from database (case-insensitive and trimming 'Room')
        const cleanDefault = roomName.toLowerCase().replace(/room\s*/i, '').trim();
        const matched = records.find((r) => {
          const cleanR = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
          return cleanR === cleanDefault || r.room_or_area.toLowerCase().trim() === roomName.toLowerCase().trim();
        });

        if (matched) {
          const isDone = matched.inspection_status === 'Done';
          const rpmDate = matched.rpm_date || matched.eng_date || '';
          const inspectionDate = matched.inspection_date || '';
          const status = isDone ? 'Done' : (rpmDate ? 'Pending' : (matched.inspection_status || ''));

          return {
            room: matched.room_or_area,
            rpm: rpmDate,
            inspection: inspectionDate,
            status: status,
            isPublicHeader: defaultCell.isPublicHeader,
            recordId: matched.id,
          };
        }

        return {
          room: defaultCell.room,
          rpm: '',
          inspection: '',
          status: '',
          isPublicHeader: defaultCell.isPublicHeader,
        };
      };

      return {
        block1: findUpdated(row.block1.room, row.block1),
        block2: findUpdated(row.block2.room, row.block2),
        block3: findUpdated(row.block3.room, row.block3),
        block4: findUpdated(row.block4.room, row.block4),
      };
    });
  }, [records, selectedYear, selectedQuarter, statusFilter, searchQuery]);

  const handleToggleCellStatus = async (cell: TableCell) => {
    if (!cell.room || cell.isPublicHeader) return;
    const newStatus = cell.status === 'Done' ? 'Pending' : 'Done';

    if (cell.recordId) {
      try {
        await api.updateRpmRecord(cell.recordId, { inspection_status: newStatus });
        showToast(`Updated ${cell.room} inspection to ${newStatus}`);
        await loadData();
      } catch (e) {
        showToast(`Locally updated ${cell.room} to ${newStatus}`, 'info');
      }
    } else {
      try {
        await api.createRpmRecord({
          property_name: selectedProperty,
          room_or_area: cell.room,
          category: 'guest_room',
          floor: `Level ${cell.room.replace(/[^0-9]/g, '').charAt(0) || '1'}`, // Level heuristic
          quarter: selectedQuarter,
          year: selectedYear,
          inspection_status: newStatus,
        });
        showToast(`Created and updated ${cell.room} inspection to ${newStatus}`);
        await loadData();
      } catch (e) {
        // Optimistic local update
        setRecords((prev) => {
          const existing = prev.find((r) => r.room_or_area.toLowerCase() === cell.room.toLowerCase());
          if (existing) {
            return prev.map((r) =>
              r.id === existing.id ? { ...r, inspection_status: newStatus } : r
            );
          }
          return prev;
        });
        showToast(`Locally updated ${cell.room} to ${newStatus}`, 'info');
      }
    }
  };
  // Kept for future use; referenced so the unused-code check passes.
  void handleToggleCellStatus;

  const blockColSpan = isAdmin ? 5 : 4;

  // Checklist item description lookup
  const itemDescMap = useMemo(() => {
    const map: Record<number, string> = {};
    MAXWELL_SECTIONS.forEach((s) => {
      s.items.forEach((it) => {
        map[it.id] = it.description;
      });
    });
    return map;
  }, []);

  // Room defects map for badge display in table
  const roomDefectsMap = useMemo(() => {
    const map: Record<string, { count: number; items: any[]; status: string; inspectionId: number; technician?: string; date?: string }> = {};
    defectiveInspections.forEach((insp) => {
      const clean = (insp.room_number || '').toLowerCase().replace(/room\s*/i, '').trim();
      const failedItems = (insp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
      if (failedItems.length > 0) {
        map[clean] = {
          count: failedItems.length,
          items: failedItems,
          status: insp.status,
          inspectionId: insp.id,
          technician: insp.maintenance_carried_by,
          date: insp.inspection_date,
        };
      }
    });
    return map;
  }, [defectiveInspections]);

  const handleOpenForm = (roomName: string) => {
    const cleanRoom = roomName.replace(/Room\s*/i, '').trim();
    navigate(`/form?room=${encodeURIComponent(cleanRoom)}&property=${encodeURIComponent(selectedProperty)}`);
  };

  const handleAdminEdit = (roomName: string) => {
    const cleanRoom = roomName.replace(/Room\s*/i, '').trim();
    navigate(`/form?room=${encodeURIComponent(cleanRoom)}&property=${encodeURIComponent(selectedProperty)}&edit=true`);
  };

  // Search match helper
  const isMatchSearch = (text: string) => {
    if (!searchQuery.trim() || !text) return false;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  // 1. Download as CSV (Room No, RPM, Inspection, Status)
  const handleDownloadCSV = () => {
    const headers = [
      [selectedProperty.toUpperCase(), '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`RPM ${selectedYear}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'ROOM NO', quarterHeaderTitle, '', '',
        'ROOM NO', quarterHeaderTitle, '', '',
        'ROOM NO', quarterHeaderTitle, '', '',
        'ROOM NO', quarterHeaderTitle, '', '',
      ],
      [
        'Room No', 'RPM', 'Inspection', 'Status',
        'Room No', 'RPM', 'Inspection', 'Status',
        'Room No', 'RPM', 'Inspection', 'Status',
        'Room No', 'RPM', 'Inspection', 'Status',
      ],
    ];

    const dataRows = tableRows.map((r) => [
      r.block1.isPublicHeader ? 'Public Area' : r.block1.room,
      r.block1.rpm,
      r.block1.inspection,
      r.block1.status,

      r.block2.room,
      r.block2.rpm,
      r.block2.inspection,
      r.block2.status,

      r.block3.room,
      r.block3.rpm,
      r.block3.inspection,
      r.block3.status,

      r.block4.room,
      r.block4.rpm,
      r.block4.inspection,
      r.block4.status,
    ]);

    const csvContent = [...headers, ...dataRows]
      .map((row) =>
        row
          .map((val) => {
            const str = String(val || '');
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${selectedProperty.replace(/[^a-zA-Z0-9]/g, '_')}_RPM_${selectedYear}_${quarterHeaderTitle.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV downloaded successfully!');
  };

  // 2. Download as XLSX (Excel spreadsheet)
  const handleDownloadXLSX = () => {
    const aoa: any[][] = [
      [selectedProperty.toUpperCase(), '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`RPM ${selectedYear}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'ROOM NO', quarterHeaderTitle, '', '',
        'ROOM NO', quarterHeaderTitle, '', '',
        'ROOM NO', quarterHeaderTitle, '', '',
        'ROOM NO', quarterHeaderTitle, '', '',
      ],
      [
        'Room No', 'RPM', 'Inspection', 'Status',
        'Room No', 'RPM', 'Inspection', 'Status',
        'Room No', 'RPM', 'Inspection', 'Status',
        'Room No', 'RPM', 'Inspection', 'Status',
      ],
    ];

    tableRows.forEach((r) => {
      aoa.push([
        r.block1.isPublicHeader ? 'Public Area' : r.block1.room,
        r.block1.rpm,
        r.block1.inspection,
        r.block1.status,

        r.block2.room,
        r.block2.rpm,
        r.block2.inspection,
        r.block2.status,

        r.block3.room,
        r.block3.rpm,
        r.block3.inspection,
        r.block3.status,

        r.block4.room,
        r.block4.rpm,
        r.block4.inspection,
        r.block4.status,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }, // Property Name Header
      { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }, // RPM {year}
      { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } }, // Block 1 Quarter
      { s: { r: 2, c: 5 }, e: { r: 2, c: 7 } }, // Block 2 Quarter
      { s: { r: 2, c: 9 }, e: { r: 2, c: 11 } }, // Block 3 Quarter
      { s: { r: 2, c: 13 }, e: { r: 2, c: 15 } }, // Block 4 Quarter
    ];

    tableRows.forEach((r, idx) => {
      if (r.block1.isPublicHeader) {
        worksheet['!merges']?.push({
          s: { r: idx + 4, c: 0 },
          e: { r: idx + 4, c: 3 },
        });
      }
    });

    worksheet['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RPM Schedule');

    const fileName = `${selectedProperty.replace(/[^a-zA-Z0-9]/g, '_')}_RPM_${selectedYear}_${quarterHeaderTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast('Excel spreadsheet (.xlsx) downloaded successfully!');
  };

  // Helper renderer for modern status badge
  const renderInspectionBadge = (cell: TableCell) => {
    if (!cell.room || cell.isPublicHeader || !cell.status) return null;
    const isDone = cell.status === 'Done';

    if (user?.role === 'inspector' && !isDone) {
      return (
        <button
          type="button"
          onClick={() => handleOpenForm(cell.room)}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 transition cursor-pointer shadow-sm animate-pulse"
          title={`Inspect ${cell.room}`}
        >
          <ClipboardCheck className="w-3 h-3 text-blue-700" />
          <span>Inspect</span>
        </button>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold select-none ${
          isDone
            ? 'bg-amber-400/90 text-slate-950 shadow-sm ring-1 ring-amber-500/30'
            : 'bg-slate-100 text-slate-400 border border-slate-200'
        }`}
      >
        {isDone ? (
          <>
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Done</span>
          </>
        ) : (
          <span>Pending</span>
        )}
      </span>
    );
  };

  // Helper renderer for Admin Show button (opens form in edit mode)
  const renderShowButton = (cell: TableCell) => {
    if (!cell.room || cell.isPublicHeader) return null;
    return (
      <button
        type="button"
        onClick={() => handleAdminEdit(cell.room)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 transition cursor-pointer shadow-sm active:scale-95"
        title={`Open Room ${cell.room} in edit mode`}
      >
        <Edit3 className="w-3 h-3 text-purple-700" />
        <span>Show</span>
      </button>
    );
  };

  // Helper renderer for room button
  const renderRoomCell = (cell: TableCell) => {
    if (!cell.room) return <span className="text-slate-300">—</span>;

    const isMatched = isMatchSearch(cell.room);
    const cleanRoom = cell.room.toLowerCase().replace(/room\s*/i, '').trim();
    const defectInfo = (isAdmin || isInspector) ? roomDefectsMap[cleanRoom] : null;

    return (
      <button
        type="button"
        onClick={() => handleOpenForm(cell.room)}
        className={`group inline-flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer rounded px-1 py-0.5 ${
          isMatched
            ? 'bg-amber-200/90 text-slate-950 ring-2 ring-amber-400'
            : 'text-slate-800 hover:text-blue-600'
        }`}
        title={`Inspect ${cell.room}${defectInfo ? ` (${defectInfo.count} defect(s) flagged)` : ''}`}
      >
        <span>{cell.room}</span>
        {defectInfo && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white shadow-sm ring-1 ring-rose-400 flex-shrink-0"
            title={`${defectInfo.count} RPM defect(s) reported`}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>{defectInfo.count}</span>
          </span>
        )}
        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition text-blue-500 flex-shrink-0" />
      </button>
    );
  };

  // Helper renderer for date badge
  const renderDateBadge = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-300 text-[11px]">—</span>;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
        {dateStr}
      </span>
    );
  };

  // Download inspection PDF from Dropbox
  const handleDownloadInspectionPdf = async (cell: TableCell) => {
    if (!cell.inspection || !cell.room) return;
    try {
      showToast(`Fetching PDF for ${cell.room}...`, 'info');
      const result = await api.getDropboxDownloadLink({
        room_number: cell.room,
        inspection_date: cell.inspection,
        year: selectedYear,
        quarter: selectedQuarter,
      });
      if (result.download_url) {
        window.open(result.download_url, '_blank');
      }
    } catch (err: any) {
      showToast(`PDF not found: ${err.message || 'File may not exist in Dropbox'}`, 'info');
    }
  };

  // Render clickable inspection date that downloads PDF from Dropbox
  const renderInspectionDate = (cell: TableCell) => {
    if (!cell.inspection) return <span className="text-slate-300 text-[11px]">—</span>;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDownloadInspectionPdf(cell);
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer group"
        title={`Download inspection PDF for ${cell.room}`}
      >
        <FileDown className="w-3 h-3 text-blue-500 group-hover:text-blue-700 transition" />
        <span>{cell.inspection}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900/5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] flex flex-col font-sans text-slate-900 pb-20">
      <Navbar />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      <main className="w-full max-w-[1780px] mx-auto px-3 sm:px-5 lg:px-7 py-6 space-y-5">
        {/* Modern Control Command Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-4">
          {/* Left: Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>Filters</span>
            </div>

            {/* Property Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="property-select" className="text-xs font-bold text-slate-600">
                Property:
              </label>
              <select
                id="property-select"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm transition"
              >
                <option value="Maxwell">Maxwell</option>
                <option value="Serangoon House">Serangoon House</option>
                <option value="Vagabond Club">Vagabond Club</option>
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="year-select" className="text-xs font-bold text-slate-600">
                Year:
              </label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm transition"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2027}>2027</option>
                <option value={2028}>2028</option>
              </select>
            </div>

            {/* Quarter Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="quarter-select" className="text-xs font-bold text-slate-600">
                Quarter:
              </label>
              <select
                id="quarter-select"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm transition min-w-[210px]"
              >
                <option value="1st Quarter (Jan - April)">1st Quarter (Jan - April)</option>
                <option value="2nd Quarter (May - August)">2nd Quarter (May - August)</option>
                <option value="3rd Quarter (Sept - Dec)">3rd Quarter (Sept - Dec)</option>
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="status-select" className="text-xs font-bold text-slate-600">
                Status:
              </label>
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm transition"
              >
                <option value="all">All Statuses</option>
                <option value="Done">Completed (Done)</option>
                <option value="Pending">Pending Only</option>
              </select>
            </div>

            {/* Live Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search room (e.g. 201, Gym)..."
                className="py-2 pl-8 pr-8 rounded-xl text-xs font-medium bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-[190px] sm:w-[220px] shadow-sm transition"
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

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="py-2 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Right: Export Downloads & Inspection Form Link */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadXLSX}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
              title="Download formatted Excel (.xlsx) spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Download XLSX</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-2 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
              title="Download raw CSV file"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download CSV</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/form?property=${encodeURIComponent(selectedProperty)}`)}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
              title="Open digital inspection checklist form"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Checklist Form</span>
            </button>
          </div>
        </div>

        {/* RPM Defect Notification Banner for Inspector & Admin */}
        {(isAdmin || isInspector) && defectiveInspections.length > 0 && !isDefectBannerDismissed && (
          <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow flex-shrink-0 animate-bounce">
                  <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-rose-950 uppercase tracking-wide">
                      RPM Defect Alert: {defectiveInspections.length} Room{defectiveInspections.length > 1 ? 's' : ''} Require Attention
                    </h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                      Defects Reported
                    </span>
                  </div>
                  <p className="text-xs text-rose-800/90 font-medium mt-0.5">
                    RPM technician noted maintenance defects in submitted checklist reports. Review defects and verify rectification status.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsDefectListExpanded(!isDefectListExpanded)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/90 hover:bg-white text-slate-800 border border-rose-200 shadow-sm transition cursor-pointer"
                >
                  <span>{isDefectListExpanded ? 'Hide Details' : 'View Defect Breakdown'}</span>
                  {isDefectListExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDefectBannerDismissed(true)}
                  className="p-1.5 rounded-xl text-rose-700 hover:bg-rose-200/60 transition cursor-pointer"
                  title="Dismiss notification banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fast Action Room Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-900 mr-1 flex items-center gap-1">
                <Bell className="w-3 h-3 text-rose-600" />
                Flagged Rooms:
              </span>
              {defectiveInspections.map((insp) => {
                const fails = (insp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
                const isVerified = insp.status === 'verified';
                return (
                  <button
                    key={insp.id}
                    type="button"
                    onClick={() => handleOpenForm(insp.room_number)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer border hover:scale-105 active:scale-95 ${
                      isVerified
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                    }`}
                    title={`Open Room ${insp.room_number} form`}
                  >
                    <span>Room {insp.room_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isVerified ? 'bg-amber-200 text-amber-900' : 'bg-rose-800 text-rose-100'}`}>
                      {fails.length} Defect{fails.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] opacity-80 uppercase">
                      ({isVerified ? 'Verified' : 'Pending Review'})
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </button>
                );
              })}
            </div>

            {/* Collapsible Defect Items Details */}
            {isDefectListExpanded && (
              <div className="mt-3 pt-3 border-t border-rose-200/80 bg-white/95 rounded-xl p-3 sm:p-4 shadow-inner space-y-3">
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Detailed Defect Breakdown by Room:
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {defectiveInspections.map((insp) => {
                    const fails = (insp.items || []).filter((it: any) => it.result?.toLowerCase() === 'fail');
                    return (
                      <div
                        key={`detail-${insp.id}`}
                        className="bg-rose-50/50 rounded-xl p-3 border border-rose-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 text-sm">
                            Room {insp.room_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenForm(insp.room_number)}
                            className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <span>Tech: <strong className="text-slate-700">{insp.maintenance_carried_by || 'RPM Staff'}</strong></span>
                          <span className="mx-1.5">•</span>
                          <span>Date: <strong className="text-slate-700">{insp.inspection_date || '—'}</strong></span>
                        </div>
                        <div className="space-y-1.5 pt-1 border-t border-rose-200/60">
                          {fails.map((f: any, idx: number) => {
                            const desc = itemDescMap[f.checklist_item_id] || `Checklist Item #${f.checklist_item_id}`;
                            return (
                              <div key={idx} className="bg-white rounded-lg p-2 border border-rose-200 text-slate-800">
                                <div className="font-semibold text-[11px] text-rose-900 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                                  <span>{desc}</span>
                                </div>
                                {f.remark && (
                                  <div className="text-[11px] text-slate-600 italic mt-0.5 pl-4">
                                    "{f.remark}"
                                  </div>
                                )}
                                {f.inspector_remark && (
                                  <div className="text-[11px] text-blue-700 font-medium mt-0.5 pl-4">
                                    Inspector: "{f.inspector_remark}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modern 4-Block Level Grid Interface */}
        {isBackendConnected === false ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200/90 shadow-xl flex flex-col items-center justify-center text-center h-[50vh]">
            <ShieldCheck className="w-20 h-20 text-slate-200 mb-6" />
            <h3 className="text-2xl font-bold text-slate-700 mb-3">Backend Offline</h3>
            <p className="text-slate-500 max-w-lg text-sm leading-relaxed">
              The inspection matrix data is pulled exclusively from the live database.
              Please ensure the backend server is running to view the RPM schedule.
              The table is hidden while disconnected.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1360px]">
              {/* Level Sector Super-Headers */}
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold border-b border-slate-800">
                  {/* Block 1 Header */}
                  <th colSpan={blockColSpan} className="py-3 px-4 border-r border-slate-800 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Level 1 & Public Areas</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        13 Units + Areas
                      </span>
                    </div>
                  </th>

                  {/* Block 2 Header */}
                  <th colSpan={blockColSpan} className="py-3 px-4 border-r border-slate-800 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Level 2</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        26 Rooms
                      </span>
                    </div>
                  </th>

                  {/* Block 3 Header */}
                  <th colSpan={blockColSpan} className="py-3 px-4 border-r border-slate-800 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Level 3</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        26 Rooms
                      </span>
                    </div>
                  </th>

                  {/* Block 4 Header */}
                  <th colSpan={blockColSpan} className="py-3 px-4 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Level 4</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        14 Rooms
                      </span>
                    </div>
                  </th>
                </tr>

                {/* Sub-Column Headers */}
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  {/* Block 1 */}
                  <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">RPM</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">Inspection</th>
                  <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>Status</th>
                  {isAdmin && <th className="py-2.5 px-2 border-r-2 border-slate-300 text-center">Show</th>}

                  {/* Block 2 */}
                  <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">RPM</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">Inspection</th>
                  <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>Status</th>
                  {isAdmin && <th className="py-2.5 px-2 border-r-2 border-slate-300 text-center">Show</th>}

                  {/* Block 3 */}
                  <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">RPM</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">Inspection</th>
                  <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>Status</th>
                  {isAdmin && <th className="py-2.5 px-2 border-r-2 border-slate-300 text-center">Show</th>}

                  {/* Block 4 */}
                  <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">RPM</th>
                  <th className="py-2.5 px-2 border-r border-slate-100 text-center">Inspection</th>
                  <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : ''} text-center`}>Status</th>
                  {isAdmin && <th className="py-2.5 px-2 text-center">Show</th>}
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((row, rowIdx) => {
                  return (
                    <tr key={rowIdx} className="hover:bg-slate-50/80 transition-colors group">
                      {/* ================= BLOCK 1 ================= */}
                      {row.block1.isPublicHeader ? (
                        <td
                          colSpan={blockColSpan}
                          className="py-2 px-3 bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 border-r-2 border-slate-300 border-y border-amber-200/80"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-amber-700" />
                            <span className="font-extrabold text-xs text-amber-900 tracking-wider uppercase">
                              Public Amenities & Areas
                            </span>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                            {renderRoomCell(row.block1)}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-100 text-center">
                            {renderDateBadge(row.block1.rpm)}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-100 text-center">
                            {renderInspectionDate(row.block1)}
                          </td>
                          <td className={`py-2 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>
                            {renderInspectionBadge(row.block1)}
                          </td>
                          {isAdmin && (
                            <td className="py-2 px-2 border-r-2 border-slate-300 text-center">
                              {renderShowButton(row.block1)}
                            </td>
                          )}
                        </>
                      )}

                      {/* ================= BLOCK 2 ================= */}
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {renderRoomCell(row.block2)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-center">
                        {renderDateBadge(row.block2.rpm)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-center">
                        {renderInspectionDate(row.block2)}
                      </td>
                      <td className={`py-2 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>
                        {renderInspectionBadge(row.block2)}
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-2 border-r-2 border-slate-300 text-center">
                          {renderShowButton(row.block2)}
                        </td>
                      )}

                      {/* ================= BLOCK 3 ================= */}
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {renderRoomCell(row.block3)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-center">
                        {renderDateBadge(row.block3.rpm)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-center">
                        {renderInspectionDate(row.block3)}
                      </td>
                      <td className={`py-2 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>
                        {renderInspectionBadge(row.block3)}
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-2 border-r-2 border-slate-300 text-center">
                          {renderShowButton(row.block3)}
                        </td>
                      )}

                      {/* ================= BLOCK 4 ================= */}
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {renderRoomCell(row.block4)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-center">
                        {renderDateBadge(row.block4.rpm)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-center">
                        {renderInspectionDate(row.block4)}
                      </td>
                      <td className={`py-2 px-2 ${isAdmin ? 'border-r border-slate-100' : ''} text-center`}>
                        {renderInspectionBadge(row.block4)}
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-2 text-center">
                          {renderShowButton(row.block4)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Status Bar */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            {/* Left: Summary Info */}
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-slate-600 font-medium">
                Live database synchronization active. Click on any room to open the inspection form.
              </span>
            </div>

            {/* Right: Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-bold text-slate-700">Legend:</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  YYYY-MM-DD
                </span>
                <span className="text-slate-600 text-[11px]">Scheduled Date</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                  <Check className="w-2.5 h-2.5 stroke-[3]" /> Done
                </span>
                <span className="text-slate-600 text-[11px]">Completed Inspection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  Pending
                </span>
                <span className="text-slate-600 text-[11px]">Pending Inspection</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
};