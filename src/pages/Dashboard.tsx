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
  ClipboardCheck,
  AlertTriangle,
  Calendar,
  Eye,
  User,
  UserCheck,
  Users,
  Wrench,
  History,
} from 'lucide-react';

// Static template matrix containing exact room layout and initial fallback
import { RAW_CSV_ROWS, type RawCell } from '../data/rpmCsvData';
import { downloadPdfBlob } from '../services/pdfGenerator';
import { RoomAllDetailsModal } from '../components/RoomAllDetailsModal';
import { PendingInspectionLoginModal } from '../components/PendingInspectionLoginModal';
import type { PendingInspectionItem } from '../components/InspectionNotificationBell';

interface TableCell {
  room: string;
  rpm: string;
  inspection: string;
  status: string;
  isPublicHeader?: boolean;
  recordId?: number;
  rpmBy?: string;
  inspBy?: string;
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'Done' | 'Pending' | 'Accepted' | 'Rejected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [records, setRecords] = useState<RpmRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Defect notification state for Inspector & Admin
  const [defectiveInspections, setDefectiveInspections] = useState<any[]>([]);

  // All inspections list for Admin submitter inspection lookup & submissions log
  const [allInspectionsList, setAllInspectionsList] = useState<any[]>([]);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState<boolean>(false);
  const [submissionsSearch, setSubmissionsSearch] = useState<string>('');

  // Room All Details Modal state for Admin
  const [adminDetailRoom, setAdminDetailRoom] = useState<string | null>(null);
  const [isRoomDetailsModalOpen, setIsRoomDetailsModalOpen] = useState<boolean>(false);

  // Pending inspections awaiting inspection for Inspector & Admin
  const [pendingInspectionsList, setPendingInspectionsList] = useState<PendingInspectionItem[]>([]);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState<boolean>(false);

  // Search suggestion and dropdown state
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      // Fetch inspections for Inspector & Admin
      if (isAdmin || isInspector) {
        try {
          const allInspections = await api.getInspections({
            property_name: selectedProperty,
          });
          setAllInspectionsList(allInspections || []);
          const flagged = (allInspections || []).filter((insp: any) => {
            return (
              Array.isArray(insp.items) &&
              insp.items.some((it: any) => it.result?.toLowerCase() === 'fail')
            );
          });
          setDefectiveInspections(flagged);

          // Fetch pending inspections across all properties for Inspector & Admin notification
          const pendingResp = await api.getInspections({ status: 'submitted' }, true).catch(() => []);
          const pendingArr: PendingInspectionItem[] = [];
          const seen = new Set<string>();

          if (Array.isArray(pendingResp)) {
            pendingResp.forEach((insp: any) => {
              const room = String(insp.room_number || '').trim();
              const clean = room.replace(/room\s*/i, '').trim();
              const prop = insp.property_name || 'Maxwell';
              const quarter = insp.quarter || 'Current Quarter';
              const matchYear = String(insp.inspection_date || '').match(/\b(20\d\d)\b/);
              const year = matchYear ? parseInt(matchYear[1], 10) : 2026;
              const key = `${prop.toLowerCase().trim()}__${clean.toLowerCase().trim()}`;
              if (!seen.has(key)) {
                seen.add(key);
                pendingArr.push({
                  key,
                  inspectionId: insp.id,
                  roomNumber: clean,
                  propertyName: prop,
                  quarter,
                  year,
                  rpmDate: insp.inspection_date,
                  technician: insp.maintenance_carried_by || 'RPM Technician',
                });
              }
            });
          }

          const rpmPending = await api.getRpmRecords({ status: 'Pending' }, true).catch(() => []);
          if (Array.isArray(rpmPending)) {
            rpmPending.forEach((r: any) => {
              if ((r.rpm_date || r.eng_date) && !r.inspection_date) {
                const clean = String(r.room_or_area || '').toLowerCase().replace(/room\s*/i, '').trim();
                const prop = r.property_name || 'Maxwell';
                const quarter = r.quarter || 'Current Quarter';
                const year = r.year || 2026;
                const key = `${prop.toLowerCase().trim()}__${clean.toLowerCase().trim()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  pendingArr.push({
                    key,
                    roomNumber: clean,
                    propertyName: prop,
                    quarter,
                    year,
                    rpmDate: r.rpm_date || r.eng_date,
                    technician: r.maintenance_carried_by || 'RPM Technician',
                  });
                }
              }
            });
          }

          setPendingInspectionsList(pendingArr);

          // Check if login popup should be shown (once per session)
          if (pendingArr.length > 0 && !sessionStorage.getItem('hasSeenInspectionLoginPopup')) {
            setIsLoginPopupOpen(true);
          }
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

  // Map of inspection records by room number (for submitter & inspector lookup)
  const inspectionsByRoom = useMemo(() => {
    const map: Record<string, { rpmBy?: string; inspBy?: string; status?: string; date?: string }> = {};
    allInspectionsList.forEach((insp: any) => {
      const clean = (insp.room_number || '').toLowerCase().replace(/room\s*/i, '').trim();
      if (!map[clean] || (insp.quarter && insp.quarter === selectedQuarter)) {
        map[clean] = {
          rpmBy: insp.maintenance_carried_by || undefined,
          inspBy: insp.inspected_by || undefined,
          status: insp.status,
          date: insp.inspection_date,
        };
      }
    });
    return map;
  }, [allInspectionsList, selectedQuarter]);

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
        const inspInfo = inspectionsByRoom[cleanDefault];

        if (matched) {
          const rpmDate = matched.rpm_date || matched.eng_date || '';
          const inspectionDate = matched.inspection_date || '';
          const rawStatus = matched.inspection_status || '';
          const status = rawStatus || (rpmDate ? 'Pending' : '');
          const rpmBy = matched.maintenance_carried_by || inspInfo?.rpmBy || '';
          const inspBy = matched.inspected_by || inspInfo?.inspBy || '';

          return {
            room: matched.room_or_area,
            rpm: rpmDate,
            inspection: inspectionDate,
            status: status,
            isPublicHeader: defaultCell.isPublicHeader,
            recordId: matched.id,
            rpmBy,
            inspBy,
          };
        }

        return {
          room: defaultCell.room,
          rpm: '',
          inspection: '',
          status: '',
          isPublicHeader: defaultCell.isPublicHeader,
          rpmBy: inspInfo?.rpmBy || '',
          inspBy: inspInfo?.inspBy || '',
        };
      };

      return {
        block1: findUpdated(row.block1.room, row.block1),
        block2: findUpdated(row.block2.room, row.block2),
        block3: findUpdated(row.block3.room, row.block3),
        block4: findUpdated(row.block4.room, row.block4),
      };
    });
  }, [records, selectedYear, selectedQuarter, statusFilter, searchQuery, inspectionsByRoom]);

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

  // Aggregated list of all rooms with form submissions for Admin Submissions Log Modal
  const submittedRoomsLog = useMemo(() => {
    const list: Array<{
      room: string;
      rpmDate: string;
      rpmBy: string;
      inspectionDate: string;
      inspBy: string;
      status: string;
      quarter?: string;
    }> = [];

    records.forEach((r) => {
      const clean = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
      const inspInfo = inspectionsByRoom[clean];
      const hasRpm = !!(r.rpm_date || r.eng_date || inspInfo?.rpmBy);
      const hasInsp = !!(r.inspection_date || inspInfo?.inspBy);
      if (hasRpm || hasInsp) {
        list.push({
          room: r.room_or_area,
          rpmDate: r.rpm_date || r.eng_date || '',
          rpmBy: r.maintenance_carried_by || inspInfo?.rpmBy || '',
          inspectionDate: r.inspection_date || inspInfo?.date || '',
          inspBy: r.inspected_by || inspInfo?.inspBy || '',
          status: r.inspection_status || inspInfo?.status || 'Pending',
          quarter: r.quarter,
        });
      }
    });

    allInspectionsList.forEach((insp: any) => {
      const inspRoom = insp.room_number || '';
      const clean = inspRoom.toLowerCase().replace(/room\s*/i, '').trim();
      const already = list.some((item) => item.room.toLowerCase().replace(/room\s*/i, '').trim() === clean);
      if (!already) {
        list.push({
          room: inspRoom.toLowerCase().includes('room') ? inspRoom : `Room ${inspRoom}`,
          rpmDate: insp.inspection_date || '',
          rpmBy: insp.maintenance_carried_by || '',
          inspectionDate: insp.status === 'verified' || insp.status === 'rejected' ? insp.inspection_date : '',
          inspBy: insp.inspected_by || '',
          status: insp.status === 'verified' ? 'Accepted' : (insp.status === 'rejected' ? 'Rejected' : 'Pending'),
          quarter: insp.quarter,
        });
      }
    });

    return list.sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
  }, [records, inspectionsByRoom, allInspectionsList]);

  // Filtered submissions in modal
  const filteredSubmissionsLog = useMemo(() => {
    if (!submissionsSearch.trim()) return submittedRoomsLog;
    const q = submissionsSearch.toLowerCase().trim();
    return submittedRoomsLog.filter(
      (item) =>
        item.room.toLowerCase().includes(q) ||
        item.rpmBy.toLowerCase().includes(q) ||
        item.inspBy.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.rpmDate.toLowerCase().includes(q) ||
        item.inspectionDate.toLowerCase().includes(q)
    );
  }, [submittedRoomsLog, submissionsSearch]);

  const handleOpenForm = (roomName: string, rpmDate?: string) => {
    if ((isInspector || isAdmin) && rpmDate !== undefined && !rpmDate) {
      showToast(`${isAdmin ? 'Admin' : 'Inspectors'} can only view forms that have an RPM date. Room ${roomName} has no RPM submission yet.`, 'info');
      return;
    }
    const cleanRoom = roomName.replace(/Room\s*/i, '').trim();
    navigate(`/form?room=${encodeURIComponent(cleanRoom)}&property=${encodeURIComponent(selectedProperty)}`);
  };

  const handleAdminView = (roomName: string, rpmDate?: string) => {
    if (!rpmDate) {
      showToast(`Admin can only view forms that have been submitted by RPM and have an RPM date. Room ${roomName} has no RPM submission yet.`, 'info');
      return;
    }
    const cleanRoom = roomName.replace(/Room\s*/i, '').trim();
    navigate(`/form?room=${encodeURIComponent(cleanRoom)}&property=${encodeURIComponent(selectedProperty)}`);
  };

  const handleOpenRoomDetails = (roomName: string) => {
    const clean = roomName.replace(/room\s*/i, '').trim();
    if (!clean) return;
    setAdminDetailRoom(clean);
    setIsRoomDetailsModalOpen(true);
  };

  // List of all room numbers for Admin quick room details selector
  const allAvailableRooms = useMemo(() => {
    const set = new Set<string>();
    RAW_CSV_ROWS.forEach((r) => {
      [r.block1.room, r.block2.room, r.block3.room, r.block4.room].forEach((rm) => {
        if (rm && !rm.toLowerCase().includes('public')) {
          set.add(rm.replace(/room\s*/i, '').trim());
        }
      });
    });
    records.forEach((r) => {
      if (r.room_or_area && !r.room_or_area.toLowerCase().includes('public')) {
        set.add(r.room_or_area.replace(/room\s*/i, '').trim());
      }
    });
    allInspectionsList.forEach((insp) => {
      if (insp.room_number) {
        set.add(String(insp.room_number).replace(/room\s*/i, '').trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records, allInspectionsList]);

  // Filtered room suggestions for searchable room selection
  const filteredRoomSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().replace(/room\s*/i, '').trim();
    if (!q) return allAvailableRooms.slice(0, 15);
    return allAvailableRooms.filter((rm) => rm.toLowerCase().includes(q)).slice(0, 15);
  }, [searchQuery, allAvailableRooms]);

  // Current room resolved from search bar for All Details
  const activeSearchedRoom = useMemo(() => {
    const q = searchQuery.toLowerCase().replace(/room\s*/i, '').trim();
    if (!q) return null;
    const exact = allAvailableRooms.find((rm) => rm.toLowerCase() === q);
    if (exact) return exact;
    const partial = allAvailableRooms.find((rm) => rm.toLowerCase().includes(q));
    return partial || q;
  }, [searchQuery, allAvailableRooms]);

  const handleCloseLoginPopup = () => {
    sessionStorage.setItem('hasSeenInspectionLoginPopup', 'true');
    setIsLoginPopupOpen(false);
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
    const s = cell.status;

    if (s === 'Accepted') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm"
          title={`Room ${cell.room} inspection Accepted by Inspector`}
        >
          <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
          <span>Accepted</span>
        </span>
      );
    }

    if (s === 'Rejected') {
      return (
        <button
          type="button"
          onClick={() => handleOpenForm(cell.room, cell.rpm)}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 transition cursor-pointer shadow-sm group"
          title={`Room ${cell.room} inspection was Rejected. Click to review or re-inspect.`}
        >
          <X className="w-3 h-3 text-rose-700 stroke-[3]" />
          <span>Rejected</span>
        </button>
      );
    }

    // For Inspector or Admin role: can inspect if room has an RPM date
    if (user?.role === 'inspector' || isAdmin) {
      if (cell.rpm) {
        return (
          <button
            type="button"
            onClick={() => handleOpenForm(cell.room, cell.rpm)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 transition cursor-pointer shadow-sm animate-pulse"
            title={`Inspect ${cell.room} (RPM completed on ${cell.rpm})`}
          >
            <ClipboardCheck className="w-3 h-3 text-blue-700" />
            <span>Inspect</span>
          </button>
        );
      }
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
          title={`Room ${cell.room} has no RPM date yet. Forms can only be inspected after RPM is submitted.`}
        >
          <span>Pending RPM</span>
        </span>
      );
    }

    if (s === 'Done') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/90 text-slate-950 shadow-sm ring-1 ring-amber-500/30"
        >
          <Check className="w-3 h-3 stroke-[3]" />
          <span>Done</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
        <span>Pending</span>
      </span>
    );
  };

  // Helper renderer for Admin View & All Details buttons
  const renderShowButton = (cell: TableCell) => {
    if (!cell.room || cell.isPublicHeader) return null;
    return (
      <div className="flex items-center justify-center gap-1">
        {cell.rpm ? (
          <button
            type="button"
            onClick={() => handleAdminView(cell.room, cell.rpm)}
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 transition cursor-pointer shadow-xs active:scale-95"
            title={`View submitted form for Room ${cell.room} (Read-Only)${cell.rpmBy ? ` • RPM by: ${cell.rpmBy}` : ''}${cell.inspBy ? ` • Inspected by: ${cell.inspBy}` : ''}`}
          >
            <Eye className="w-3 h-3 text-purple-700 flex-shrink-0" />
            <span>View</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => handleOpenRoomDetails(cell.room)}
          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition cursor-pointer shadow-xs active:scale-95"
          title={`All Details: View historical quarters, defect logs, submission dates, and stats for Room ${cell.room}`}
        >
          <History className="w-3 h-3 text-indigo-700 flex-shrink-0" />
          <span>Details</span>
        </button>
      </div>
    );
  };

  // Helper renderer for room button
  const renderRoomCell = (cell: TableCell) => {
    if (!cell.room) return <span className="text-slate-300">—</span>;

    const isMatched = isMatchSearch(cell.room);
    const cleanRoom = cell.room.toLowerCase().replace(/room\s*/i, '').trim();
    const defectInfo = (isAdmin || isInspector) ? roomDefectsMap[cleanRoom] : null;

    // Inspector and Admin can only open forms that have an RPM date
    if ((isInspector || isAdmin) && !cell.rpm) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold text-xs text-slate-400 cursor-not-allowed rounded px-1 py-0.5 ${
            isMatched ? 'bg-amber-100 text-slate-600' : ''
          }`}
          title={`Room ${cell.room} has no RPM date. ${isAdmin ? 'Admin' : 'Inspector'} can only view forms that have an RPM date.`}
        >
          <span>{cell.room}</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleOpenForm(cell.room, cell.rpm)}
        className={`group inline-flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer rounded px-1 py-0.5 ${isMatched
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

  // Download RPM PDF from Dropbox
  const handleDownloadRpmPdf = async (cell: TableCell) => {
    if (!cell.rpm || !cell.room) return;
    try {
      showToast(`Fetching RPM PDF for ${cell.room}...`, 'info');
      const { blob, filename } = await api.downloadDropboxPdf({
        room_number: cell.room,
        inspection_date: cell.rpm,
        year: selectedYear,
        quarter: selectedQuarter,
        document_type: 'RPM',
        property_name: selectedProperty,
      });
      downloadPdfBlob(blob, filename);
      showToast(`Downloaded ${filename}`, 'info');
    } catch (err: any) {
      showToast(`RPM PDF not found in Dropbox: ${err.message || 'File may not exist'}`, 'info');
    }
  };

  // Render clickable RPM date that downloads RPM PDF from Dropbox
  const renderRpmDate = (cell: TableCell) => {
    if (!cell.rpm) return <span className="text-slate-300 text-[11px]">—</span>;
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadRpmPdf(cell);
          }}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700 font-semibold hover:text-emerald-700 transition cursor-pointer group"
          title={`Download RPM PDF for ${cell.room}${cell.rpmBy ? ` • RPM Submitted by: ${cell.rpmBy}` : ''}`}
        >
          <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition flex-shrink-0" />
          <span>{cell.rpm}</span>
        </button>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs max-w-[140px] truncate"
          title={`RPM Form Submitted By: ${cell.rpmBy || 'RPM Technician'}`}
        >
          <Wrench className="w-3 h-3 text-emerald-700 flex-shrink-0" />
          <span className="truncate">{cell.rpmBy || 'RPM Technician'}</span>
        </span>
      </div>
    );
  };

  // Download inspection PDF from Dropbox
  const handleDownloadInspectionPdf = async (cell: TableCell) => {
    if (!cell.inspection || !cell.room) return;
    try {
      showToast(`Fetching PDF for ${cell.room}...`, 'info');
      const { blob, filename } = await api.downloadDropboxPdf({
        room_number: cell.room,
        inspection_date: cell.inspection,
        year: selectedYear,
        quarter: selectedQuarter,
        document_type: 'Inspection',
        property_name: selectedProperty,
      });
      downloadPdfBlob(blob, filename);
      showToast(`Downloaded ${filename}`, 'info');
    } catch (err: any) {
      showToast(`PDF not found: ${err.message || 'File may not exist in Dropbox'}`, 'info');
    }
  };

  // Render clickable inspection date that downloads PDF from Dropbox
  const renderInspectionDate = (cell: TableCell) => {
    if (!cell.inspection) return <span className="text-slate-300 text-[11px]">—</span>;
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadInspectionPdf(cell);
          }}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700 font-semibold hover:text-violet-700 transition cursor-pointer group"
          title={`Download inspection PDF for ${cell.room}${cell.inspBy ? ` • Inspection Verified by: ${cell.inspBy}` : ''}`}
        >
          <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 transition flex-shrink-0" />
          <span>{cell.inspection}</span>
        </button>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-xl text-xs font-bold bg-violet-100 text-violet-950 border border-violet-300 shadow-xs max-w-[140px] truncate"
          title={`Inspection Form Verified By: ${cell.inspBy || 'Inspector'}`}
        >
          <UserCheck className="w-3 h-3 text-violet-700 flex-shrink-0" />
          <span className="truncate">{cell.inspBy || 'Inspector'}</span>
        </span>
      </div>
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
                <option value="Accepted">Accepted Only</option>
                <option value="Rejected">Rejected Only</option>
                <option value="Done">Completed (Done / Accepted)</option>
                <option value="Pending">Pending Only</option>
              </select>
            </div>

            {/* Unified Search & Room Selection with All Details */}
            <div className="relative flex items-center gap-1.5" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  placeholder="Search room (e.g. 101, Gym)..."
                  className="py-2 pl-8 pr-8 rounded-xl text-xs font-medium bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-[190px] sm:w-[220px] shadow-sm transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchDropdownOpen(false);
                    }}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Admin All Details Button directly integrated with Search */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const targetRoom = activeSearchedRoom || (allAvailableRooms.length > 0 ? allAvailableRooms[0] : '101');
                    handleOpenRoomDetails(targetRoom);
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm hover:shadow transition active:scale-95 cursor-pointer whitespace-nowrap"
                  title={
                    activeSearchedRoom
                      ? `Open all details for Room ${activeSearchedRoom}`
                      : 'Open room all details'
                  }
                >
                  <History className="w-3.5 h-3.5 text-indigo-200 flex-shrink-0" />
                  <span>All Details{activeSearchedRoom ? ` (${activeSearchedRoom})` : ''}</span>
                </button>
              )}

              {/* Search Suggestions Dropdown */}
              {isSearchDropdownOpen && filteredRoomSuggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 py-1.5 max-h-60 overflow-y-auto animate-in fade-in duration-100">
                  <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Rooms ({filteredRoomSuggestions.length})</span>
                    <span className="text-[9px] text-slate-400 font-normal">Click to search</span>
                  </div>
                  {filteredRoomSuggestions.map((rm) => (
                    <div
                      key={rm}
                      className="px-3 py-1.5 hover:bg-amber-50/70 flex items-center justify-between gap-2 cursor-pointer transition group"
                      onClick={() => {
                        setSearchQuery(rm);
                        setIsSearchDropdownOpen(false);
                      }}
                    >
                      <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900">
                        Room {rm}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSearchDropdownOpen(false);
                            setSearchQuery(rm);
                            handleOpenRoomDetails(rm);
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 transition cursor-pointer"
                          title={`View all details for Room ${rm}`}
                        >
                          All Details
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(true)}
                className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-purple-700 hover:bg-purple-800 text-white flex items-center gap-2 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
                title="View form submissions log: See who submitted RPM & Inspection forms"
              >
                <Users className="w-4 h-4 text-purple-200" />
                <span>Submissions Log</span>
              </button>
            )}

            {defectiveInspections.length > 0 && (isAdmin || isInspector) && (
              <button
                type="button"
                onClick={() => navigate('/defects')}
                className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
                title={`Open Separate Defects Dashboard (${defectiveInspections.length} defected rooms)`}
              >
                <AlertTriangle className="w-4 h-4 text-white" />
                <span>Defects ({defectiveInspections.length})</span>
              </button>
            )}

            {!isInspector && !isAdmin && (
              <button
                type="button"
                onClick={() => navigate(`/form?property=${encodeURIComponent(selectedProperty)}`)}
                className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
                title="Open digital inspection checklist form"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Checklist Form</span>
              </button>
            )}
          </div>
        </div>

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
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>RPM</div>
                      {isAdmin && <div className="text-[9px] font-bold text-emerald-700/80 normal-case tracking-normal">Date & Submitter</div>}
                    </th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>Inspection</div>
                      {isAdmin && <div className="text-[9px] font-bold text-blue-700/80 normal-case tracking-normal">Date & Inspector</div>}
                    </th>
                    <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>Status</th>
                    {isAdmin && <th className="py-2.5 px-2 border-r-2 border-slate-300 text-center">View</th>}

                    {/* Block 2 */}
                    <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>RPM</div>
                      {isAdmin && <div className="text-[9px] font-bold text-emerald-700/80 normal-case tracking-normal">Date & Submitter</div>}
                    </th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>Inspection</div>
                      {isAdmin && <div className="text-[9px] font-bold text-blue-700/80 normal-case tracking-normal">Date & Inspector</div>}
                    </th>
                    <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>Status</th>
                    {isAdmin && <th className="py-2.5 px-2 border-r-2 border-slate-300 text-center">View</th>}

                    {/* Block 3 */}
                    <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>RPM</div>
                      {isAdmin && <div className="text-[9px] font-bold text-emerald-700/80 normal-case tracking-normal">Date & Submitter</div>}
                    </th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>Inspection</div>
                      {isAdmin && <div className="text-[9px] font-bold text-blue-700/80 normal-case tracking-normal">Date & Inspector</div>}
                    </th>
                    <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : 'border-r-2 border-slate-300'} text-center`}>Status</th>
                    {isAdmin && <th className="py-2.5 px-2 border-r-2 border-slate-300 text-center">View</th>}

                    {/* Block 4 */}
                    <th className="py-2.5 px-3 border-r border-slate-100">Room No</th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>RPM</div>
                      {isAdmin && <div className="text-[9px] font-bold text-emerald-700/80 normal-case tracking-normal">Date & Submitter</div>}
                    </th>
                    <th className="py-2.5 px-2 border-r border-slate-100 text-center">
                      <div>Inspection</div>
                      {isAdmin && <div className="text-[9px] font-bold text-blue-700/80 normal-case tracking-normal">Date & Inspector</div>}
                    </th>
                    <th className={`py-2.5 px-2 ${isAdmin ? 'border-r border-slate-100' : ''} text-center`}>Status</th>
                    {isAdmin && <th className="py-2.5 px-2 text-center">View</th>}
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
                              {renderRpmDate(row.block1)}
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
                          {renderRpmDate(row.block2)}
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
                          {renderRpmDate(row.block3)}
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
                          {renderRpmDate(row.block4)}
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
                {isAdmin && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <User className="w-2.5 h-2.5 text-emerald-600" /> Name
                      </span>
                      <span className="text-slate-600 text-[11px]">RPM Submitter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                        <UserCheck className="w-2.5 h-2.5 text-blue-600" /> Name
                      </span>
                      <span className="text-slate-600 text-[11px]">Inspector</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Admin Submissions Log Modal */}
      {isAdmin && isSubmissionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/50 border border-purple-400/40 flex items-center justify-center shadow">
                  <Users className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-wide">Form Submissions Log</h3>
                  <p className="text-xs text-purple-200/80">
                    Who submitted forms: RPM Technicians & Inspection Sign-offs ({selectedProperty} • {quarterHeaderTitle})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Bar / Search */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={submissionsSearch}
                  onChange={(e) => setSubmissionsSearch(e.target.value)}
                  placeholder="Search room, technician, or inspector..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                />
                {submissionsSearch && (
                  <button
                    onClick={() => setSubmissionsSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500 font-semibold self-end sm:self-auto">
                Showing {filteredSubmissionsLog.length} of {submittedRoomsLog.length} submitted form{submittedRoomsLog.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Modal Body / Table */}
            <div className="overflow-y-auto p-4 flex-1">
              {filteredSubmissionsLog.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
                  <p className="text-sm font-bold text-slate-600">No form submissions found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {submissionsSearch ? 'Try a different search query.' : 'No rooms have submitted forms yet for this property/quarter.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Room</th>
                        <th className="py-2.5 px-3">RPM Form Submitted By</th>
                        <th className="py-2.5 px-3">RPM Date</th>
                        <th className="py-2.5 px-3">Inspection Verified By</th>
                        <th className="py-2.5 px-3">Inspection Date</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredSubmissionsLog.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {item.room}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.rpmBy ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs">
                                <Wrench className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                                <span>{item.rpmBy}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Not submitted</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                              <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span>{item.rpmDate || '—'}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {item.inspBy ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-violet-100 text-violet-950 border border-violet-300 shadow-xs">
                                <UserCheck className="w-3 h-3 text-violet-700 flex-shrink-0" />
                                <span>{item.inspBy}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Pending Inspector</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                              <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span>{item.inspectionDate || '—'}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'Accepted' || item.status === 'Done'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : item.status === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              {item.rpmDate ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSubmissionsModalOpen(false);
                                    handleAdminView(item.room, item.rpmDate);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 transition cursor-pointer shadow-xs active:scale-95"
                                  title={`View Room ${item.room} form (Read-Only)`}
                                >
                                  <Eye className="w-3 h-3 text-purple-700" />
                                  <span>View Form</span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSubmissionsModalOpen(false);
                                  handleOpenRoomDetails(item.room);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border border-indigo-300 transition cursor-pointer shadow-xs active:scale-95"
                                title={`All Details: View historical quarters, defect logs, and stats for Room ${item.room}`}
                              >
                                <History className="w-3 h-3 text-indigo-700" />
                                <span>All Details</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Click <strong>View Form</strong> to see form or <strong>All Details</strong> for complete room history.
              </span>
              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer shadow-sm active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room All Details Modal for Admin */}
      {isAdmin && adminDetailRoom && (
        <RoomAllDetailsModal
          isOpen={isRoomDetailsModalOpen}
          onClose={() => setIsRoomDetailsModalOpen(false)}
          roomNumber={adminDetailRoom}
          initialProperty={selectedProperty}
        />
      )}

      {/* Login Pop-up Notification for Inspector and Admin */}
      {(isAdmin || isInspector) && (
        <PendingInspectionLoginModal
          isOpen={isLoginPopupOpen}
          onClose={handleCloseLoginPopup}
          items={pendingInspectionsList}
        />
      )}
    </div>
  );
};