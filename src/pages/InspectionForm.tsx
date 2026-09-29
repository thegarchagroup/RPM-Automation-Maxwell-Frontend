import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { Section, InspectionItemResult, InspectionItem } from '../types';
import { MAXWELL_SECTIONS, QUICK_DEFECT_TAGS } from '../data/templateData';
import { generateInspectionPdf, getInspectionPdfBlob } from '../services/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { SignatureSelector } from '../components/SignatureSelector';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import {
  Check,
  X,
  FileDown,
  Printer,
  CheckCircle2,
  Cloud,
  UploadCloud,
  RefreshCw,
  Send,
  Sparkles,
  Edit3,
  AlertTriangle,
  ExternalLink,
  FolderCheck,
} from 'lucide-react';

const STORAGE_KEY = 'maxwell_active_inspection';

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  return dateStr;
};

export const InspectionForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Sections
  const sections: Section[] = MAXWELL_SECTIONS;

  // URL Query param overrides
  const urlRoom = searchParams.get('room');
  const urlType = searchParams.get('type');

  // Header & Sign-off State
  const [roomNumber, setRoomNumber] = useState<string>(urlRoom || '101');
  const [roomType, setRoomType] = useState<string>(urlType || 'Deluxe');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('2nd Quarter (May - August)');

  // Sign-off names & signatures
  const [maintenanceCarriedBy, setMaintenanceCarriedBy] = useState<string>(
    user?.role === 'inspector' || !user?.role ? user?.full_name || 'John Tan' : 'John Tan'
  );
  const [maintenanceSignatureUrl, setMaintenanceSignatureUrl] = useState<string | null>(null);

  const [inspectedBy, setInspectedBy] = useState<string>(
    user?.role === 'supervisor' ? user.full_name : ''
  );
  const [inspectedBySignatureUrl, setInspectedBySignatureUrl] = useState<string | null>(null);

  const [overallRemark, setOverallRemark] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Validation / Duplicate warning alert state
  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);

  // Dropbox Upload State
  const [isSavingDropbox, setIsSavingDropbox] = useState<boolean>(false);
  const [dropboxStatus, setDropboxStatus] = useState<{
    success: boolean;
    message: string;
    path?: string;
    share_url?: string;
  } | null>(null);

  // Items State (checklist_item_id -> InspectionItem)
  const [itemsMap, setItemsMap] = useState<Record<number, InspectionItem>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Autosave timeout ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.roomNumber && !urlRoom) setRoomNumber(data.roomNumber);
        if (data.roomType && !urlType) setRoomType(data.roomType);
        if (data.selectedDate) setSelectedDate(data.selectedDate);
        if (data.selectedQuarter) setSelectedQuarter(data.selectedQuarter);
        if (data.maintenanceCarriedBy) setMaintenanceCarriedBy(data.maintenanceCarriedBy);
        if (data.maintenanceSignatureUrl || data.selectedSignatureUrl) {
          setMaintenanceSignatureUrl(data.maintenanceSignatureUrl || data.selectedSignatureUrl);
        }
        if (data.inspectedBy) setInspectedBy(data.inspectedBy);
        if (data.inspectedBySignatureUrl) setInspectedBySignatureUrl(data.inspectedBySignatureUrl);
        if (data.overallRemark) setOverallRemark(data.overallRemark);
        if (data.itemsMap) setItemsMap(data.itemsMap);
        if (data.isSubmitted) setIsSubmitted(data.isSubmitted);
        if (data.submittedAt) setSubmittedAt(data.submittedAt);
      }
    } catch (e) {
      console.warn('Error loading inspection from storage', e);
    }
  }, [urlRoom, urlType]);

  // Save to localStorage
  const saveInspectionState = (override?: Partial<{
    roomNumber: string;
    roomType: string;
    selectedDate: string;
    selectedQuarter: string;
    maintenanceCarriedBy: string;
    maintenanceSignatureUrl: string | null;
    inspectedBy: string;
    inspectedBySignatureUrl: string | null;
    overallRemark: string;
    itemsMap: Record<number, InspectionItem>;
    isSubmitted: boolean;
    submittedAt: string | null;
  }>) => {
    setIsSaving(true);
    const stateToSave = {
      roomNumber,
      roomType,
      selectedDate,
      selectedQuarter,
      maintenanceCarriedBy,
      maintenanceSignatureUrl,
      inspectedBy,
      inspectedBySignatureUrl,
      overallRemark,
      itemsMap,
      isSubmitted,
      submittedAt,
      ...override,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      setLastSaved(new Date());
    } catch (e) {
      console.warn('Error saving inspection to storage', e);
    } finally {
      setTimeout(() => setIsSaving(false), 250);
    }
  };

  const triggerAutosave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveInspectionState();
    }, 400);
  };

  // Handle individual checklist item result
  const handleItemResult = (
    checklistItemId: number,
    result: InspectionItemResult,
    remark?: string
  ) => {
    setItemsMap((prev) => {
      const existing = prev[checklistItemId];
      const updatedRemark = remark !== undefined ? remark : existing?.remark || null;

      const updatedItem: InspectionItem = {
        id: checklistItemId,
        inspection_id: 1,
        checklist_item_id: checklistItemId,
        result,
        remark: updatedRemark,
        photo_url: null,
      };

      const newMap = {
        ...prev,
        [checklistItemId]: updatedItem,
      };

      saveInspectionState({ itemsMap: newMap });
      return newMap;
    });
  };

  // Quick Pass all items in a section
  const handlePassSection = (section: Section) => {
    setItemsMap((prev) => {
      const newMap = { ...prev };
      section.items.forEach((item) => {
        if (!newMap[item.id] || !newMap[item.id].result) {
          newMap[item.id] = {
            id: item.id,
            inspection_id: 1,
            checklist_item_id: item.id,
            result: 'pass',
            remark: null,
            photo_url: null,
          };
        }
      });
      saveInspectionState({ itemsMap: newMap });
      return newMap;
    });
  };

  // Reset / Clear Form for new room
  const handleResetForm = () => {
    if (
      window.confirm(
        'Start a new inspection? Current form answers will be reset for a new room inspection.'
      )
    ) {
      setItemsMap({});
      setOverallRemark('');
      setSelectedDate(getTodayDateString());
      setIsSubmitted(false);
      setSubmittedAt(null);
      setDuplicateAlert(null);
      localStorage.removeItem(STORAGE_KEY);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Check duplicate inspection in this quarter before submitting
  const checkAlreadyInspectedThisQuarter = async (room: string, quarter: string, date: string): Promise<boolean> => {
    try {
      const year = parseInt(date.split('-')[0], 10) || 2026;
      const records = await api.getRpmRecords({ year, quarter });
      
      if (!records || records.length === 0) return false;

      const cleanTarget = room.toLowerCase().replace(/room\s*/i, '').trim();

      const matched = records.find((r) => {
        const rClean = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
        return rClean === cleanTarget || r.room_or_area.toLowerCase() === room.toLowerCase().trim();
      });

      if (matched && matched.inspection_status === 'Done') {
        return true;
      }
    } catch (e) {
      console.warn('Duplicate check offline or backend sync fallback', e);
    }
    return false;
  };

  // Submit Inspection with Mandatory Validations & Duplicate Check
  const handleSubmit = async () => {
    setDuplicateAlert(null);

    // 1. Mandatory Validations
    if (!selectedDate) {
      alert('⚠️ Mandatory Field Missing: Please select an Inspection Date.');
      document.getElementById('manual-date-input')?.focus();
      return;
    }

    if (!selectedQuarter) {
      alert('⚠️ Mandatory Field Missing: Please select the Inspection Quarter.');
      document.getElementById('quarter-select-input')?.focus();
      return;
    }

    if (!maintenanceCarriedBy.trim()) {
      alert('⚠️ Mandatory Field Missing: Please enter the name under "Maintenance carried By".');
      document.getElementById('maintenance-carried-by-input')?.focus();
      return;
    }

    if (!maintenanceSignatureUrl) {
      alert('⚠️ Mandatory Field Missing: Maintenance Signature is required. Please upload or select a signature image under "Maintenance carried By".');
      const footerEl = document.getElementById('form-footer');
      if (footerEl) footerEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 2. Duplicate Inspection Check: Don't let it submit if room is inspected this quarter!
    setIsCheckingDuplicate(true);
    const isDuplicate = await checkAlreadyInspectedThisQuarter(roomNumber, selectedQuarter, selectedDate);
    setIsCheckingDuplicate(false);

    if (isDuplicate) {
      const msg = `Room ${roomNumber} has ALREADY been inspected for ${selectedQuarter}. Duplicate inspection submissions for the same quarter are blocked.`;
      setDuplicateAlert(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Complete Submission
    const nowStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setIsSubmitted(true);
    setSubmittedAt(nowStr);
    saveInspectionState({ isSubmitted: true, submittedAt: nowStr });

    // Sync inspection report to FastAPI backend
    api.submitInspection({
      room_number: roomNumber,
      room_type: roomType,
      inspection_date: formatDisplayDate(selectedDate),
      status: 'submitted',
      maintenance_carried_by: maintenanceCarriedBy,
      inspected_by: inspectedBy || undefined,
      signature_url: maintenanceSignatureUrl,
      overall_remark: overallRemark,
      items: Object.values(itemsMap).map((it) => ({
        checklist_item_id: it.checklist_item_id,
        result: it.result || 'PASS',
        remark: it.remark,
      })),
    }).catch((err) => {
      console.warn('Backend inspection sync note:', err);
    });

    // Also update RPM record in schedule table to Done
    try {
      const year = parseInt(selectedDate.split('-')[0], 10) || 2026;
      const records = await api.getRpmRecords({ year, quarter: selectedQuarter });
      const cleanTarget = roomNumber.toLowerCase().replace(/room\s*/i, '').trim();
      const matched = records?.find((r) => {
        const rClean = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
        return rClean === cleanTarget || r.room_or_area.toLowerCase() === roomNumber.toLowerCase().trim();
      });

      if (matched) {
        await api.updateRpmRecord(matched.id, {
          inspection_status: 'Done',
          eng_date: selectedDate,
        });
      }
    } catch (e) {
      console.warn('RPM schedule update sync note', e);
    }

    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
      });
    } catch (e) { }

    const actionsEl = document.getElementById('submission-actions');
    if (actionsEl) {
      actionsEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    const formattedDate = formatDisplayDate(selectedDate);

    generateInspectionPdf({
      roomNumber,
      roomType,
      inspectionDate: formattedDate,
      quarter: selectedQuarter,
      status: isSubmitted ? 'submitted' : 'in_progress',
      sections,
      itemsMap,
      overallRemark,
      maintenanceCarriedBy: maintenanceCarriedBy || user?.full_name || 'Maintenance Staff',
      signatureUrl: maintenanceSignatureUrl,
      inspectedByName: inspectedBy || undefined,
      inspectedBySignatureUrl: inspectedBySignatureUrl || null,
      inspectedAt: inspectedBy ? formattedDate : undefined,
    });
  };

  // Save / Upload PDF to Dropbox
  const handleSaveToDropbox = async () => {
    setIsSavingDropbox(true);
    setDropboxStatus(null);
    try {
      const formattedDate = formatDisplayDate(selectedDate);
      const { blob, filename } = getInspectionPdfBlob({
        roomNumber,
        roomType,
        inspectionDate: formattedDate,
        quarter: selectedQuarter,
        status: isSubmitted ? 'submitted' : 'in_progress',
        sections,
        itemsMap,
        overallRemark,
        maintenanceCarriedBy: maintenanceCarriedBy || user?.full_name || 'Maintenance Staff',
        signatureUrl: maintenanceSignatureUrl,
        inspectedByName: inspectedBy || undefined,
        inspectedBySignatureUrl: inspectedBySignatureUrl || null,
        inspectedAt: inspectedBy ? formattedDate : undefined,
      });

      const year = parseInt(selectedDate.split('-')[0], 10) || 2026;
      const res = await api.uploadPdfToDropbox(blob, filename, {
        room_number: roomNumber,
        quarter: selectedQuarter,
        year,
      });

      setDropboxStatus({
        success: true,
        message: `Successfully saved to Dropbox: ${res.path}`,
        path: res.path,
        share_url: res.share_url,
      });
    } catch (err: any) {
      setDropboxStatus({
        success: false,
        message: err?.message || 'Failed to upload PDF report to Dropbox.',
      });
    } finally {
      setIsSavingDropbox(false);
    }
  };

  // Stats calculation
  const { totalCount, answeredCount, passCount, failCount, naCount } = useMemo(() => {
    let total = 0;
    let answered = 0;
    let pass = 0;
    let fail = 0;
    let na = 0;

    sections.forEach((sec) => {
      total += sec.items.length;
      sec.items.forEach((item) => {
        const ans = itemsMap[item.id];
        if (ans && ans.result) {
          answered++;
          if (ans.result === 'pass') pass++;
          else if (ans.result === 'fail') fail++;
          else if (ans.result === 'na') na++;
        }
      });
    });

    return { totalCount: total, answeredCount: answered, passCount: pass, failCount: fail, naCount: na };
  }, [sections, itemsMap]);

  const scrollToSection = (code: string) => {
    const el = document.getElementById(`section-${code}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const inspectionDateDisplay = formatDisplayDate(selectedDate);

  return (
    <div className="min-h-screen bg-slate-200/70 flex flex-col pb-32">
      <Navbar onResetForm={handleResetForm} />

      {/* Sticky Floating Section Navigator */}
      <div className="sticky top-16 z-30 bg-slate-900/95 backdrop-blur text-white shadow-md border-b border-slate-800 py-2.5 px-4 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            <span className="text-[11px] uppercase font-bold text-amber-400 mr-2 flex-shrink-0">
              Sections:
            </span>
            {sections.map((sec) => {
              const answeredSec = sec.items.filter((i) => itemsMap[i.id]?.result).length;
              const hasFail = sec.items.some((i) => itemsMap[i.id]?.result === 'fail');
              const isDone = answeredSec === sec.items.length && sec.items.length > 0;

              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.code)}
                  title={`${sec.code}. ${sec.title} (${answeredSec}/${sec.items.length})`}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition flex-shrink-0 cursor-pointer ${hasFail
                      ? 'bg-rose-500 text-white'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                >
                  {sec.code}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 text-xs">
            <div className="hidden sm:flex items-center gap-2 text-slate-300 font-medium">
              <span className="text-emerald-400 font-bold">{passCount} ✓</span>
              {failCount > 0 && <span className="text-rose-400 font-bold">{failCount} ✗</span>}
              {naCount > 0 && <span className="text-slate-400 font-medium">{naCount} NA</span>}
              <span className="text-slate-400">
                ({answeredCount}/{totalCount})
              </span>
            </div>
            {isSaving ? (
              <span className="text-amber-400 flex items-center gap-1 text-[11px] animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
              </span>
            ) : (
              <span
                className="text-emerald-400 flex items-center gap-1 text-[11px]"
                title={lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString()}` : 'Saved locally'}
              >
                <Cloud className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Sheet */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {/* Duplicate Inspection Warning Banner */}
        {duplicateAlert && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-900/90 border-2 border-rose-500 text-white flex items-start gap-3 shadow-xl animate-in fade-in slide-in-from-top-3">
            <AlertTriangle className="w-6 h-6 text-amber-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-extrabold text-sm sm:text-base text-rose-100 uppercase tracking-wide">
                Submission Blocked: Duplicate Inspection
              </div>
              <div className="text-xs sm:text-sm text-rose-200 mt-1 font-medium leading-relaxed">
                {duplicateAlert}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="py-1.5 px-3 rounded-lg text-xs font-bold bg-white text-rose-950 hover:bg-rose-50 transition cursor-pointer"
                >
                  View Schedule in Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateAlert(null)}
                  className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-950 text-rose-200 border border-rose-700 transition cursor-pointer"
                >
                  Dismiss Warning
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dropbox Upload Status Banner */}
        {dropboxStatus && (
          <div className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xl animate-in fade-in slide-in-from-top-2 ${
            dropboxStatus.success
              ? 'bg-blue-950/90 border-blue-500 text-blue-100'
              : 'bg-rose-950/90 border-rose-600 text-rose-100'
          }`}>
            <div className="flex items-center gap-3">
              {dropboxStatus.success ? (
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow">
                  <FolderCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-rose-700 flex items-center justify-center text-white shadow">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="font-bold text-sm text-white">
                  {dropboxStatus.success ? 'Saved to Dropbox' : 'Dropbox Upload Notice'}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  {dropboxStatus.message}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dropboxStatus.share_url && (
                <a
                  href={dropboxStatus.share_url}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-3 rounded-lg text-xs font-bold bg-blue-500 hover:bg-blue-400 text-white flex items-center gap-1 shadow transition"
                >
                  <span>Open in Dropbox</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setDropboxStatus(null)}
                className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Status Callout Banner */}
        {isSubmitted && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-base text-white">
                  Inspection Officially Submitted!
                </div>
                <div className="text-xs text-emerald-200">
                  Room {roomNumber} ({roomType}) checklist is finalized for {selectedQuarter}. Download report or save to Dropbox below.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="py-2 px-3.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow transition cursor-pointer"
                title="Download local PDF"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={handleSaveToDropbox}
                disabled={isSavingDropbox}
                className="py-2 px-3.5 rounded-xl text-xs font-bold bg-[#0061FE] hover:bg-[#0052d9] text-white flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                title="Save PDF directly to Dropbox Cloud"
              >
                {isSavingDropbox ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <UploadCloud className="w-4 h-4 text-white" />
                )}
                <span>{isSavingDropbox ? 'Saving...' : 'Save to Dropbox'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 flex items-center gap-1 transition cursor-pointer"
                title="Unlock editing"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-xl border border-slate-300 p-6 sm:p-10 text-slate-900">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-brand tracking-wider text-slate-900 uppercase">
              ROOM PREVENTIVE MAINTENANCE
            </h1>
            <div className="text-xs text-slate-500 tracking-widest uppercase font-semibold mt-1">
              The Maxwell &bull; Room Preventive Maintenance Checklist Form
            </div>
          </div>

          {/* Form Header Fields: Type & Room */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Type:
              </label>
              <input
                type="text"
                disabled={isSubmitted}
                value={roomType}
                onChange={(e) => {
                  setRoomType(e.target.value);
                  triggerAutosave();
                }}
                placeholder="e.g. Deluxe, Suite..."
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Number:
              </label>
              <input
                type="text"
                disabled={isSubmitted}
                value={roomNumber}
                onChange={(e) => {
                  setRoomNumber(e.target.value);
                  triggerAutosave();
                }}
                placeholder="e.g. 101, 102..."
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Form Sections (A through K) */}
          <div className="space-y-8">
            {sections.map((section) => {
              return (
                <div
                  key={section.id}
                  id={`section-${section.code}`}
                  className="scroll-mt-32"
                >
                  {/* Section Title Header */}
                  <div className="flex items-center justify-between bg-slate-100/90 px-4 py-2.5 rounded-lg border-l-4 border-slate-900 mb-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                      {section.code}. {section.title}
                    </h2>
                    {!isSubmitted && (
                      <button
                        type="button"
                        onClick={() => handlePassSection(section)}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 flex items-center gap-1 transition cursor-pointer print:hidden"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Pass Section</span>
                      </button>
                    )}
                  </div>

                  {/* Section Table Matching Checklist */}
                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-slate-700 font-bold uppercase text-[11px]">
                          <th className="py-2 px-3 w-12 text-center border-r border-slate-300">#</th>
                          <th className="py-2 px-4 border-r border-slate-300">Checklist Item</th>
                          <th className="py-2 px-3 w-36 text-center border-r border-slate-300">
                            <div className="flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              <span className="text-slate-400 font-normal">/</span>
                              <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                            </div>
                          </th>
                          <th className="py-2 px-4 w-64">Remarks / Defect Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {section.items.map((item) => {
                          const ans = itemsMap[item.id];
                          const res = ans?.result;
                          const rem = ans?.remark || '';
                          const isFail = res === 'fail';

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${isFail
                                  ? 'bg-rose-50/60'
                                  : res === 'pass'
                                    ? 'hover:bg-slate-50'
                                    : 'hover:bg-slate-50'
                                }`}
                            >
                              {/* # column */}
                              <td className="py-2 px-3 font-bold text-center text-slate-600 border-r border-slate-200 align-top">
                                {item.item_no}
                              </td>

                              {/* Item Description */}
                              <td className="py-2 px-4 text-slate-900 border-r border-slate-200 align-top font-medium leading-relaxed">
                                {item.description}
                              </td>

                              {/* Pass / Defect Button Toggle */}
                              <td className="py-2 px-3 border-r border-slate-200 align-top text-center">
                                <div className="inline-flex items-center rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                                  {/* PASS */}
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => handleItemResult(item.id, 'pass')}
                                    title="Pass (No Defects)"
                                    className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-0.5 transition cursor-pointer ${res === 'pass'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-emerald-700 hover:bg-white'
                                      }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Pass</span>
                                  </button>

                                  {/* DEFECT / FAIL */}
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => handleItemResult(item.id, 'fail')}
                                    title="Defect / Fail"
                                    className={`px-2 py-1 text-xs font-bold rounded-md flex items-center gap-0.5 transition cursor-pointer ${res === 'fail'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-rose-700 hover:bg-white'
                                      }`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Defect</span>
                                  </button>

                                  {/* N/A */}
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => handleItemResult(item.id, 'na')}
                                    title="Not Applicable"
                                    className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${res === 'na'
                                        ? 'bg-slate-700 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                                      }`}
                                  >
                                    NA
                                  </button>
                                </div>
                              </td>

                              {/* Remarks & Quick Tags */}
                              <td className="py-2 px-4 align-top">
                                <input
                                  type="text"
                                  disabled={isSubmitted}
                                  value={rem}
                                  onChange={(e) => handleItemResult(item.id, res || 'fail', e.target.value)}
                                  placeholder={isFail ? 'Describe defect details...' : 'Optional remarks...'}
                                  className={`w-full text-xs px-2.5 py-1.5 rounded border focus:outline-none focus:ring-1 ${isFail
                                      ? 'border-rose-300 bg-rose-50/40 text-rose-900 placeholder:text-rose-400 focus:ring-rose-500'
                                      : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-slate-800'
                                    }`}
                                />

                                {/* Quick Defect Suggestion Pills */}
                                {isFail && !rem && !isSubmitted && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {((QUICK_DEFECT_TAGS as unknown as Record<string, string[]>)[item.description] || [
                                      'Needs cleaning',
                                      'Loose fixture',
                                      'Damaged',
                                      'Chemical wash required',
                                    ]).map((tag: string, tIdx: number) => (
                                      <button
                                        key={tIdx}
                                        type="button"
                                        onClick={() => handleItemResult(item.id, 'fail', tag)}
                                        className="text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-medium transition cursor-pointer"
                                      >
                                        + {tag}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Remarks Box */}
          <div className="mt-8 pt-6 border-t-2 border-slate-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Overall Remarks & Notes:
            </label>
            <textarea
              rows={3}
              disabled={isSubmitted}
              value={overallRemark}
              onChange={(e) => {
                setOverallRemark(e.target.value);
                triggerAutosave();
              }}
              placeholder="Any additional observations or maintenance follow-ups for this room..."
              className="w-full text-xs sm:text-sm p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 transition disabled:bg-slate-50"
            />
          </div>

          {/* Form Footer: 1) Date & Quarter (Mandatory), 2) Maintenance Carried By (Mandatory), 3) Inspected By (Optional) */}
          <div id="form-footer" className="mt-8 pt-6 border-t-2 border-slate-900">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CARD 1: Date & Quarter Selection (Mandatory) */}
              <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex flex-col justify-between space-y-4">
                <div>
                  {/* Date Picker */}
                  <div className="mb-4">
                    <label htmlFor="manual-date-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Date: <span className="text-rose-600">*</span></span>
                      <span className="text-[10px] font-semibold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Mandatory</span>
                    </label>
                    <div className="relative">
                      <input
                        id="manual-date-input"
                        type="date"
                        disabled={isSubmitted}
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          triggerAutosave();
                        }}
                        className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 cursor-pointer shadow-sm"
                      />
                    </div>
                    <div className="text-xs font-medium text-slate-600 mt-1.5">
                      Selected: <span className="font-bold text-slate-900">{inspectionDateDisplay}</span>
                    </div>
                  </div>

                  {/* Quarter Selection (Bottom of Date) */}
                  <div className="pt-3 border-t border-slate-200">
                    <label htmlFor="quarter-select-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Schedule Quarter: <span className="text-rose-600">*</span></span>
                      <span className="text-[10px] font-semibold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Mandatory</span>
                    </label>
                    <select
                      id="quarter-select-input"
                      disabled={isSubmitted}
                      value={selectedQuarter}
                      onChange={(e) => {
                        setSelectedQuarter(e.target.value);
                        triggerAutosave();
                      }}
                      className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 cursor-pointer shadow-sm"
                    >
                      <option value="2nd Quarter (May - August)">2nd Quarter (May - August)</option>
                      <option value="1st Quarter (Jan - April)">1st Quarter (Jan - April)</option>
                      <option value="3rd Quarter (Sep - Dec)">3rd Quarter (Sep - Dec)</option>
                      <option value="4th Quarter (Oct - Dec)">4th Quarter (Oct - Dec)</option>
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  Manual inspection date & quarter schedule
                </div>
              </div>

              {/* CARD 2: Maintenance carried By (Mandatory: Name & Signature Image) */}
              <div className="p-4 rounded-xl border-2 border-slate-300 bg-white flex flex-col justify-between space-y-3">
                <div>
                  <label htmlFor="maintenance-carried-by-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Maintenance carried By: <span className="text-rose-600">*</span></span>
                    <span className="text-[10px] font-semibold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Mandatory</span>
                  </label>
                  <input
                    id="maintenance-carried-by-input"
                    type="text"
                    disabled={isSubmitted}
                    value={maintenanceCarriedBy}
                    onChange={(e) => {
                      setMaintenanceCarriedBy(e.target.value);
                      triggerAutosave();
                    }}
                    placeholder="Enter technician name..."
                    className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 mb-2.5 shadow-sm"
                  />

                  {/* Display selected signature */}
                  {maintenanceSignatureUrl ? (
                    <div className="p-2.5 border-2 border-emerald-400 rounded-xl bg-emerald-50/30 my-2 flex flex-col items-center justify-center min-h-[60px]">
                      <img
                        src={maintenanceSignatureUrl}
                        alt="Maintenance Signature"
                        className="max-h-12 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-14 border-2 border-dashed border-rose-300 rounded-xl bg-rose-50/40 flex items-center justify-center text-xs font-medium text-rose-600 my-2">
                      ⚠️ Signature Image Required
                    </div>
                  )}
                </div>

                {!isSubmitted ? (
                  <div className="mt-1 print:hidden">
                    <SignatureSelector
                      label="Maintenance Signature Picture *"
                      storageKey="maxwell_maintenance_signatures"
                      selectedSignatureUrl={maintenanceSignatureUrl}
                      onSelectSignature={(url) => {
                        setMaintenanceSignatureUrl(url);
                        saveInspectionState({ maintenanceSignatureUrl: url });
                      }}
                      autoSelectFirst={true}
                    />
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-emerald-700 font-semibold mt-1">
                    ✓ Attached Maintenance Signature
                  </div>
                )}
              </div>

              {/* CARD 3: Inspected By (NOT Mandatory: Name & Signature Optional) */}
              <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex flex-col justify-between space-y-3">
                <div>
                  <label htmlFor="inspected-by-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Inspected By:</span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase bg-slate-200 px-1.5 py-0.5 rounded">Optional</span>
                  </label>
                  <input
                    id="inspected-by-input"
                    type="text"
                    disabled={isSubmitted}
                    value={inspectedBy}
                    onChange={(e) => {
                      setInspectedBy(e.target.value);
                      triggerAutosave();
                    }}
                    placeholder="Inspector / Supervisor name (Optional)..."
                    className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 mb-2.5 shadow-sm"
                  />

                  {/* Display inspected by signature if uploaded */}
                  {inspectedBySignatureUrl ? (
                    <div className="p-2.5 border-2 border-slate-300 rounded-xl bg-white my-2 flex flex-col items-center justify-center min-h-[60px]">
                      <img
                        src={inspectedBySignatureUrl}
                        alt="Inspected By Signature"
                        className="max-h-12 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-14 border-2 border-dashed border-slate-200 rounded-xl bg-white/60 flex items-center justify-center text-xs text-slate-400 my-2">
                      (Optional sign-off signature)
                    </div>
                  )}
                </div>

                {!isSubmitted ? (
                  <div className="mt-1 print:hidden">
                    <SignatureSelector
                      label="Inspected By Signature Picture (Optional)"
                      storageKey="maxwell_inspected_signatures"
                      selectedSignatureUrl={inspectedBySignatureUrl}
                      onSelectSignature={(url) => {
                        setInspectedBySignatureUrl(url);
                        saveInspectionState({ inspectedBySignatureUrl: url });
                      }}
                      autoSelectFirst={false}
                    />
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-slate-600 font-medium mt-1">
                    {inspectedBy ? `✓ Inspected by ${inspectedBy}` : 'Official Inspection Sign-off'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submission and PDF Download Actions */}
          <div
            id="submission-actions"
            className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden"
          >
            <div className="text-xs text-slate-500">
              {isSubmitted ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> This inspection is officially submitted.
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Fill all items and attach required signature before submitting.</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isSubmitted ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="flex-1 sm:flex-initial py-3 px-5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-amber-400" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveToDropbox}
                    disabled={isSavingDropbox}
                    className="flex-1 sm:flex-initial py-3 px-5 rounded-xl text-sm font-bold bg-[#0061FE] hover:bg-[#0052d9] text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDropbox ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <UploadCloud className="w-4 h-4 text-white" />
                    )}
                    <span>{isSavingDropbox ? 'Saving to Dropbox...' : 'Save to Dropbox'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-3 px-4 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isCheckingDuplicate}
                  className="w-full sm:w-auto py-3.5 px-8 rounded-xl text-sm font-extrabold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  {isCheckingDuplicate ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>Checking Schedule...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-amber-400" />
                      <span>Submit Official Inspection</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
