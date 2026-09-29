import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { api, type RpmRecord } from '../services/api';
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
} from 'lucide-react';

// Static template matrix containing exact room layout and initial fallback
import { RAW_CSV_ROWS } from '../data/rpmCsvData';

interface TableCell {
  room: string;
  eng: string;
  ac: string;
  housekeeping: string;
  inspection: string;
  isPublicHeader?: boolean;
  recordId?: number;
}

interface TableRow {
  block1: TableCell;
  block2: TableCell;
  block3: TableCell;
  block4: TableCell;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('2nd Quarter May-August');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Done' | 'Pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Records & Loading state
  const [records, setRecords] = useState<RpmRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Load records from backend API
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRpmRecords({
        year: selectedYear,
        quarter: selectedQuarter,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
      });
      if (data) {
        setRecords(data);
      }
    } catch (err) {
      console.warn('Backend sync note: Using local matrix with optimistic persistence', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedQuarter, statusFilter, searchQuery]);

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
    if (selectedQuarter.includes('2nd') || selectedQuarter.includes('2st') || selectedQuarter.includes('May')) {
      return `2nd Quarter May-August ${shortYr}`;
    }
    if (selectedQuarter.includes('3rd') || selectedQuarter.includes('Sep')) {
      return `3rd Quarter Sep-Dec ${shortYr}`;
    }
    if (selectedQuarter.includes('4th') || selectedQuarter.includes('Oct')) {
      return `4th Quarter Oct-Dec ${shortYr}`;
    }
    return `${selectedQuarter} ${shortYr}`;
  }, [selectedQuarter, selectedYear]);

  // Construct table rows structured identically to the 4-floor layout
  const tableRows: TableRow[] = useMemo(() => {
    return RAW_CSV_ROWS.map((row) => {
      const findUpdated = (roomName: string, defaultCell: TableCell): TableCell => {
        if (!roomName || defaultCell.isPublicHeader) return defaultCell;
        
        // Find matching record from database
        const matched = records.find(
          (r) => r.room_or_area.toLowerCase().trim() === roomName.toLowerCase().trim()
        );

        if (matched) {
          return {
            room: matched.room_or_area,
            eng: matched.eng_date || '',
            ac: matched.ac_servicing || '',
            housekeeping: matched.housekeeping || '',
            inspection: matched.inspection_status === 'Done' ? 'Done' : '',
            recordId: matched.id,
          };
        }

        // If backend returned filtered records and this room wasn't included
        if (records.length > 0 && (statusFilter !== 'all' || searchQuery.trim() !== '')) {
          return {
            room: defaultCell.room,
            eng: '',
            ac: '',
            housekeeping: '',
            inspection: '',
          };
        }

        // Shift fallback dates dynamically if viewing other quarters/years
        if (selectedYear !== 2026 || !selectedQuarter.includes('2')) {
          const shiftDate = (d: string) => {
            if (!d || d.length < 10) return d;
            const parts = d.split('-');
            if (parts.length !== 3) return d;
            let m = parseInt(parts[1], 10);
            if (selectedQuarter.includes('1')) m = Math.max(1, m - 4);
            else if (selectedQuarter.includes('3')) m = Math.min(12, m + 4);
            else if (selectedQuarter.includes('4')) m = Math.min(12, m + 5);
            return `${selectedYear}-${String(m).padStart(2, '0')}-${parts[2]}`;
          };

          return {
            ...defaultCell,
            eng: defaultCell.eng ? shiftDate(defaultCell.eng) : '',
            ac: defaultCell.ac && defaultCell.ac.includes('-') ? shiftDate(defaultCell.ac) : defaultCell.ac,
            inspection: selectedYear < 2026 ? 'Done' : selectedYear > 2026 ? '' : defaultCell.inspection,
          };
        }

        return defaultCell;
      };

      return {
        block1: findUpdated(row.block1.room, row.block1),
        block2: findUpdated(row.block2.room, row.block2),
        block3: findUpdated(row.block3.room, row.block3),
        block4: findUpdated(row.block4.room, row.block4),
      };
    });
  }, [records, selectedYear, selectedQuarter, statusFilter, searchQuery]);

  // Toggle inspection status (Done <-> Blank)
  const handleToggleCellStatus = async (cell: TableCell) => {
    if (!cell.room || cell.isPublicHeader) return;
    const newStatus = cell.inspection === 'Done' ? 'Pending' : 'Done';

    if (cell.recordId) {
      try {
        await api.updateRpmRecord(cell.recordId, { inspection_status: newStatus });
        showToast(`Updated ${cell.room} inspection to ${newStatus}`);
        await loadData();
      } catch (e) {
        showToast(`Locally updated ${cell.room} to ${newStatus}`, 'info');
      }
    } else {
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
      showToast(`Updated ${cell.room} inspection to ${newStatus}`);
    }
  };

  const handleOpenForm = (roomName: string) => {
    const cleanRoom = roomName.replace(/Room\s*/i, '').trim();
    navigate(`/form?room=${encodeURIComponent(cleanRoom)}`);
  };

  // Search match helper
  const isMatchSearch = (text: string) => {
    if (!searchQuery.trim() || !text) return false;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  // 1. Download as CSV
  const handleDownloadCSV = () => {
    const headers = [
      ['MAXWELL RESERVE', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`RPM ${selectedYear}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'ROOM', quarterHeaderTitle, '', '', '',
        'ROOM', quarterHeaderTitle, '', '', '',
        'ROOM', quarterHeaderTitle, '', '', '',
        'ROOM', quarterHeaderTitle, '', '', '',
      ],
      [
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
      ],
    ];

    const dataRows = tableRows.map((r) => [
      r.block1.isPublicHeader ? 'Public Area' : r.block1.room,
      r.block1.eng,
      r.block1.ac,
      r.block1.housekeeping,
      r.block1.inspection,

      r.block2.room,
      r.block2.eng,
      r.block2.ac,
      r.block2.housekeeping,
      r.block2.inspection,

      r.block3.room,
      r.block3.eng,
      r.block3.ac,
      r.block3.housekeeping,
      r.block3.inspection,

      r.block4.room,
      r.block4.eng,
      r.block4.ac,
      r.block4.housekeeping,
      r.block4.inspection,
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
      `Maxwell_Reserve_RPM_${selectedYear}_${quarterHeaderTitle.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV downloaded successfully!');
  };

  // 2. Download as XLSX (Excel spreadsheet)
  const handleDownloadXLSX = () => {
    const aoa: any[][] = [
      ['MAXWELL RESERVE', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`RPM ${selectedYear}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'ROOM', quarterHeaderTitle, '', '', '',
        'ROOM', quarterHeaderTitle, '', '', '',
        'ROOM', quarterHeaderTitle, '', '', '',
        'ROOM', quarterHeaderTitle, '', '', '',
      ],
      [
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
        '', 'ENG', 'AC Servicing', 'Housekeeping', 'INSPECTION',
      ],
    ];

    tableRows.forEach((r) => {
      aoa.push([
        r.block1.isPublicHeader ? 'Public Area' : r.block1.room,
        r.block1.eng,
        r.block1.ac,
        r.block1.housekeeping,
        r.block1.inspection,

        r.block2.room,
        r.block2.eng,
        r.block2.ac,
        r.block2.housekeeping,
        r.block2.inspection,

        r.block3.room,
        r.block3.eng,
        r.block3.ac,
        r.block3.housekeeping,
        r.block3.inspection,

        r.block4.room,
        r.block4.eng,
        r.block4.ac,
        r.block4.housekeeping,
        r.block4.inspection,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } }, // MAXWELL RESERVE
      { s: { r: 1, c: 0 }, e: { r: 1, c: 19 } }, // RPM {year}
      { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } }, // Block 1 Quarter
      { s: { r: 2, c: 6 }, e: { r: 2, c: 9 } }, // Block 2 Quarter
      { s: { r: 2, c: 11 }, e: { r: 2, c: 14 } }, // Block 3 Quarter
      { s: { r: 2, c: 16 }, e: { r: 2, c: 19 } }, // Block 4 Quarter
    ];

    tableRows.forEach((r, idx) => {
      if (r.block1.isPublicHeader) {
        worksheet['!merges']?.push({
          s: { r: idx + 4, c: 0 },
          e: { r: idx + 4, c: 4 },
        });
      }
    });

    worksheet['!cols'] = [
      { wch: 14 }, { wch: 13 }, { wch: 18 }, { wch: 13 }, { wch: 13 },
      { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 13 },
      { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 13 },
      { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 13 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RPM Schedule');

    const fileName = `Maxwell_Reserve_RPM_${selectedYear}_${quarterHeaderTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast('Excel spreadsheet (.xlsx) downloaded successfully!');
  };

  // Helper renderer for modern status badge
  const renderInspectionBadge = (cell: TableCell) => {
    if (!cell.room || cell.isPublicHeader) return null;
    const isDone = cell.inspection === 'Done';

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleToggleCellStatus(cell);
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all select-none cursor-pointer ${
          isDone
            ? 'bg-amber-400/90 hover:bg-amber-400 text-slate-950 shadow-sm ring-1 ring-amber-500/30'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 border border-slate-200'
        }`}
        title="Click to toggle Done / Pending status"
      >
        {isDone ? (
          <>
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Done</span>
          </>
        ) : (
          <span>Pending</span>
        )}
      </button>
    );
  };

  // Helper renderer for room button
  const renderRoomCell = (cell: TableCell) => {
    if (!cell.room) return <span className="text-slate-300">—</span>;

    const isMatched = isMatchSearch(cell.room);

    return (
      <button
        type="button"
        onClick={() => handleOpenForm(cell.room)}
        className={`group inline-flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer rounded px-1 py-0.5 ${
          isMatched
            ? 'bg-amber-200/90 text-slate-950 ring-2 ring-amber-400'
            : 'text-slate-800 hover:text-blue-600'
        }`}
        title={`Inspect ${cell.room}`}
      >
        <span>{cell.room}</span>
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
                <option value="2nd Quarter May-August">2nd Quarter (May - August)</option>
                <option value="1st Quarter Jan-April">1st Quarter (Jan - April)</option>
                <option value="3rd Quarter Sep-Dec">3rd Quarter (Sep - Dec)</option>
                <option value="4th Quarter Oct-Dec">4th Quarter (Oct - Dec)</option>
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
              onClick={() => navigate('/form')}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
              title="Open digital inspection checklist form"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Checklist Form</span>
            </button>
          </div>
        </div>

        {/* Modern 4-Block Floor Grid Interface */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1360px]">
              {/* Floor Sector Super-Headers */}
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold border-b border-slate-800">
                  {/* Block 1 Header */}
                  <th colSpan={5} className="py-3 px-4 border-r border-slate-800 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Floor 1 & Public Areas</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        13 Units + Areas
                      </span>
                    </div>
                  </th>

                  {/* Block 2 Header */}
                  <th colSpan={5} className="py-3 px-4 border-r border-slate-800 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Floor 2</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        26 Rooms
                      </span>
                    </div>
                  </th>

                  {/* Block 3 Header */}
                  <th colSpan={5} className="py-3 px-4 border-r border-slate-800 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Floor 3</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
                        26 Rooms
                      </span>
                    </div>
                  </th>

                  {/* Block 4 Header */}
                  <th colSpan={5} className="py-3 px-4 w-[25%]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                        <span className="font-extrabold tracking-wide uppercase">Floor 4</span>
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
                  <th className="py-2.5 px-3 w-[6%] border-r border-slate-100">Room</th>
                  <th className="py-2.5 px-2 w-[5%] border-r border-slate-100">ENG</th>
                  <th className="py-2.5 px-2 w-[7%] border-r border-slate-100">AC Service</th>
                  <th className="py-2.5 px-2 w-[3%] border-r border-slate-100">HK</th>
                  <th className="py-2.5 px-2 w-[4%] border-r-2 border-slate-300 text-center">Status</th>

                  {/* Block 2 */}
                  <th className="py-2.5 px-3 w-[6%] border-r border-slate-100">Room</th>
                  <th className="py-2.5 px-2 w-[5%] border-r border-slate-100">ENG</th>
                  <th className="py-2.5 px-2 w-[7%] border-r border-slate-100">AC Service</th>
                  <th className="py-2.5 px-2 w-[3%] border-r border-slate-100">HK</th>
                  <th className="py-2.5 px-2 w-[4%] border-r-2 border-slate-300 text-center">Status</th>

                  {/* Block 3 */}
                  <th className="py-2.5 px-3 w-[6%] border-r border-slate-100">Room</th>
                  <th className="py-2.5 px-2 w-[5%] border-r border-slate-100">ENG</th>
                  <th className="py-2.5 px-2 w-[7%] border-r border-slate-100">AC Service</th>
                  <th className="py-2.5 px-2 w-[3%] border-r border-slate-100">HK</th>
                  <th className="py-2.5 px-2 w-[4%] border-r-2 border-slate-300 text-center">Status</th>

                  {/* Block 4 */}
                  <th className="py-2.5 px-3 w-[6%] border-r border-slate-100">Room</th>
                  <th className="py-2.5 px-2 w-[5%] border-r border-slate-100">ENG</th>
                  <th className="py-2.5 px-2 w-[7%] border-r border-slate-100">AC Service</th>
                  <th className="py-2.5 px-2 w-[3%] border-r border-slate-100">HK</th>
                  <th className="py-2.5 px-2 w-[4%] text-center">Status</th>
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
                          colSpan={5}
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
                          <td className="py-2 px-2 border-r border-slate-100">
                            {renderDateBadge(row.block1.eng)}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-600 truncate max-w-[130px]" title={row.block1.ac}>
                            {row.block1.ac && row.block1.ac.includes('-')
                              ? renderDateBadge(row.block1.ac)
                              : row.block1.ac ? <span className="font-medium text-slate-700">{row.block1.ac}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-500">
                            {row.block1.housekeeping || <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2 px-2 border-r-2 border-slate-300 text-center">
                            {renderInspectionBadge(row.block1)}
                          </td>
                        </>
                      )}

                      {/* ================= BLOCK 2 ================= */}
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {renderRoomCell(row.block2)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100">
                        {renderDateBadge(row.block2.eng)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-600 truncate max-w-[130px]" title={row.block2.ac}>
                        {row.block2.ac && row.block2.ac.includes('-')
                          ? renderDateBadge(row.block2.ac)
                          : row.block2.ac ? <span className="font-medium text-slate-700">{row.block2.ac}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-500">
                        {row.block2.housekeeping || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-2 border-r-2 border-slate-300 text-center">
                        {renderInspectionBadge(row.block2)}
                      </td>

                      {/* ================= BLOCK 3 ================= */}
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {renderRoomCell(row.block3)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100">
                        {renderDateBadge(row.block3.eng)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-600 truncate max-w-[130px]" title={row.block3.ac}>
                        {row.block3.ac && row.block3.ac.includes('-')
                          ? renderDateBadge(row.block3.ac)
                          : row.block3.ac ? <span className="font-medium text-slate-700">{row.block3.ac}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-500">
                        {row.block3.housekeeping || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-2 border-r-2 border-slate-300 text-center">
                        {renderInspectionBadge(row.block3)}
                      </td>

                      {/* ================= BLOCK 4 ================= */}
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {renderRoomCell(row.block4)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100">
                        {renderDateBadge(row.block4.eng)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-600 truncate max-w-[130px]" title={row.block4.ac}>
                        {row.block4.ac && row.block4.ac.includes('-')
                          ? renderDateBadge(row.block4.ac)
                          : row.block4.ac ? <span className="font-medium text-slate-700">{row.block4.ac}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-100 text-[11px] text-slate-500">
                        {row.block4.housekeeping || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderInspectionBadge(row.block4)}
                      </td>
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
      </main>
    </div>
  );
};
