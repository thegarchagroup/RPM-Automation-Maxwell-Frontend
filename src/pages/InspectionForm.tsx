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
  AlertTriangle,
  ExternalLink,
  FolderCheck,
  Building2,
  Wrench,
  ClipboardCheck,
  ShieldCheck,
  Clock,
  Save,
} from 'lucide-react';

const STORAGE_KEY = 'maxwell_active_inspection';

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYearFromDateString = (dateStr: string): number => {
  if (!dateStr) return new Date().getFullYear();
  const match = dateStr.match(/\b(20\d\d)\b/);
  if (match) return parseInt(match[1], 10);
  return new Date().getFullYear();
};

const getQuarterFromDate = (dateStr: string): string => {
  if (!dateStr) return '1st Quarter (Jan - April)';
  const parts = dateStr.split('-');
  let month = 0;
  if (parts.length === 3) {
    month = parseInt(parts[1], 10);
  } else {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      month = d.getMonth() + 1;
    }
  }
  if (month >= 1 && month <= 4) return '1st Quarter (Jan - April)';
  if (month >= 5 && month <= 8) return '2nd Quarter (May - August)';
  if (month >= 9 && month <= 12) return '3rd Quarter (Sept - Dec)';
  return '1st Quarter (Jan - April)';
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

const formatDateForInput = (dateStr: string): string => {
  if (!dateStr) return getTodayDateString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return getTodayDateString();
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
  const urlProperty = searchParams.get('property');
  const urlInspectionId = searchParams.get('inspection_id');
  const isAdmin = user?.role === 'admin';

  // Backend tracking & Queue
  const [activeInspectionId, setActiveInspectionId] = useState<number | null>(
    urlInspectionId ? parseInt(urlInspectionId, 10) : null
  );
  const [, setSubmittedInspections] = useState<any[]>([]);

  // Header & Sign-off State
  const [selectedProperty, setSelectedProperty] = useState<string>(urlProperty || 'Maxwell');
  const [roomNumber, setRoomNumber] = useState<string>(urlRoom || '101');
  const [roomType, setRoomType] = useState<string>(urlType || 'Deluxe');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getQuarterFromDate(getTodayDateString()));

  // Sign-off names & signatures
  const [maintenanceCarriedBy, setMaintenanceCarriedBy] = useState<string>(
    user?.role === 'rpm' ? user.full_name || 'John Tan' : 'John Tan'
  );
  const [maintenanceSignatureUrl, setMaintenanceSignatureUrl] = useState<string | null>(null);

  const [inspectedBy, setInspectedBy] = useState<string>(
    user?.role === 'inspector' ? user.full_name || 'Inspector' : ''
  );
  const [inspectedBySignatureUrl, setInspectedBySignatureUrl] = useState<string | null>(null);

  // Remarks
  const [overallRemark, setOverallRemark] = useState<string>(''); // RPM Remark
  const [inspectorRemark, setInspectorRemark] = useState<string>(''); // Inspector Remark

  // Status flags
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

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

  // Load existing inspections list from backend for review queue
  const loadSubmittedInspections = async () => {
    try {
      const data = await api.getInspections();
      if (Array.isArray(data)) {
        setSubmittedInspections(data);
      }
    } catch (e) {
      console.warn('Could not load inspection list', e);
    }
  };

  useEffect(() => {
    loadSubmittedInspections();
  }, []);

  // Helper to load inspection from backend record into form state
  const loadInspectionIntoForm = (insp: any) => {
    setActiveInspectionId(insp.id);
    if (insp.property_name) setSelectedProperty(insp.property_name);
    if (insp.room_number) setRoomNumber(insp.room_number);
    if (insp.room_type) setRoomType(insp.room_type);
    if (insp.inspection_date) setSelectedDate(insp.inspection_date);
    if (insp.quarter) setSelectedQuarter(insp.quarter);
    if (insp.maintenance_carried_by) setMaintenanceCarriedBy(insp.maintenance_carried_by);
    if (insp.signature_url) setMaintenanceSignatureUrl(insp.signature_url);
    if (insp.overall_remark) setOverallRemark(insp.overall_remark);
    if (insp.inspector_remark) setInspectorRemark(insp.inspector_remark);
    if (insp.inspected_by) {
      setInspectedBy(insp.inspected_by);
    } else if (user?.role === 'inspector') {
      setInspectedBy(user.full_name || 'Inspector');
    }
    if (insp.inspected_by_signature_url) setInspectedBySignatureUrl(insp.inspected_by_signature_url);
    
    const submitted = insp.status === 'submitted' || insp.status === 'verified';
    const verified = insp.status === 'verified';
    setIsSubmitted(submitted);
    setIsVerified(verified);
    if (insp.submitted_at) setSubmittedAt(insp.submitted_at);
    if (insp.verified_at) setVerifiedAt(insp.verified_at);

    const newMap: Record<number, InspectionItem> = {};
    if (Array.isArray(insp.items)) {
      insp.items.forEach((it: any) => {
        newMap[it.checklist_item_id] = {
          id: it.checklist_item_id,
          inspection_id: insp.id,
          checklist_item_id: it.checklist_item_id,
          result: (it.result?.toLowerCase() as any) || 'pass',
          remark: it.remark || null,
          inspector_remark: it.inspector_remark || null,
          photo_url: it.photo_url || null,
        };
      });
    }
    setItemsMap(newMap);
    saveInspectionState({
      selectedProperty: insp.property_name || selectedProperty,
      roomNumber: insp.room_number || roomNumber,
      roomType: insp.room_type || roomType,
      selectedDate: insp.inspection_date || selectedDate,
      selectedQuarter: insp.quarter || selectedQuarter,
      maintenanceCarriedBy: insp.maintenance_carried_by || maintenanceCarriedBy,
      maintenanceSignatureUrl: insp.signature_url || maintenanceSignatureUrl,
      inspectedBy: insp.inspected_by || inspectedBy,
      inspectedBySignatureUrl: insp.inspected_by_signature_url || inspectedBySignatureUrl,
      overallRemark: insp.overall_remark || overallRemark,
      inspectorRemark: insp.inspector_remark || inspectorRemark,
      itemsMap: newMap,
      isSubmitted: submitted,
      submittedAt: insp.submitted_at || submittedAt,
      isVerified: verified,
      verifiedAt: insp.verified_at || verifiedAt,
      activeInspectionId: insp.id,
    });
  };

  // If inspection_id query param is present, load it
  useEffect(() => {
    if (urlInspectionId) {
      const id = parseInt(urlInspectionId, 10);
      if (id) {
        api.getInspection(id)
          .then((insp) => {
            if (insp) loadInspectionIntoForm(insp);
          })
          .catch((e) => console.warn('Could not load inspection by id', e));
      }
    }
  }, [urlInspectionId]);

  // If room param is present, load the inspection for this room
  useEffect(() => {
    if (urlRoom && !urlInspectionId) {
      api.getInspections({ room_number: urlRoom, property_name: selectedProperty })
        .then((list) => {
          if (list && list.length > 0) {
            loadInspectionIntoForm(list[0]);
          }
        })
        .catch(() => {});
    }
  }, [urlRoom, selectedProperty, urlInspectionId]);

  // Load saved state on mount if no URL params
  useEffect(() => {
    if (urlInspectionId) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.selectedProperty && !urlProperty) setSelectedProperty(data.selectedProperty);
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
        if (data.inspectorRemark) setInspectorRemark(data.inspectorRemark);
        if (data.itemsMap) setItemsMap(data.itemsMap);
        if (data.isSubmitted) setIsSubmitted(data.isSubmitted);
        if (data.submittedAt) setSubmittedAt(data.submittedAt);
        if (data.isVerified) setIsVerified(data.isVerified);
        if (data.verifiedAt) setVerifiedAt(data.verifiedAt);
        if (data.activeInspectionId) setActiveInspectionId(data.activeInspectionId);
      }
    } catch (e) {
      console.warn('Error loading inspection from storage', e);
    }
  }, [urlRoom, urlType, urlProperty, urlInspectionId]);

  // Save to localStorage
  const saveInspectionState = (override?: Partial<{
    selectedProperty: string;
    roomNumber: string;
    roomType: string;
    selectedDate: string;
    selectedQuarter: string;
    maintenanceCarriedBy: string;
    maintenanceSignatureUrl: string | null;
    inspectedBy: string;
    inspectedBySignatureUrl: string | null;
    overallRemark: string;
    inspectorRemark: string;
    itemsMap: Record<number, InspectionItem>;
    isSubmitted: boolean;
    submittedAt: string | null;
    isVerified: boolean;
    verifiedAt: string | null;
    activeInspectionId: number | null;
  }>) => {
    setIsSaving(true);
    const stateToSave = {
      selectedProperty,
      roomNumber,
      roomType,
      selectedDate,
      selectedQuarter,
      maintenanceCarriedBy,
      maintenanceSignatureUrl,
      inspectedBy,
      inspectedBySignatureUrl,
      overallRemark,
      inspectorRemark,
      itemsMap,
      isSubmitted,
      submittedAt,
      isVerified,
      verifiedAt,
      activeInspectionId,
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
    remark?: string,
    inspectorRemark?: string
  ) => {
    setItemsMap((prev) => {
      const existing = prev[checklistItemId];
      const updatedRemark = remark !== undefined ? remark : existing?.remark || null;
      const updatedInspectorRemark = inspectorRemark !== undefined ? inspectorRemark : existing?.inspector_remark || null;

      const updatedItem: InspectionItem = {
        id: checklistItemId,
        inspection_id: activeInspectionId || 1,
        checklist_item_id: checklistItemId,
        result,
        remark: updatedRemark,
        inspector_remark: updatedInspectorRemark,
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

  // Handle individual inspector checklist remark
  const handleInspectorItemRemark = (checklistItemId: number, remarkVal: string) => {
    setItemsMap((prev) => {
      const existing = prev[checklistItemId];
      const updatedItem: InspectionItem = {
        id: checklistItemId,
        inspection_id: activeInspectionId || 1,
        checklist_item_id: checklistItemId,
        result: existing?.result || 'pass',
        remark: existing?.remark || null,
        inspector_remark: remarkVal,
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
            inspection_id: activeInspectionId || 1,
            checklist_item_id: item.id,
            result: 'pass',
            remark: null,
            inspector_remark: null,
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

      if (matched && (matched.inspection_date || matched.inspection_status === 'Done')) {
        return true;
      }
    } catch (e) {
      console.warn('Duplicate check offline or backend sync fallback', e);
    }
    return false;
  };

  // 1. Submit by RPM User: Saves details in DB (status: 'submitted') and uploads RPM_{roomno}_{date}.pdf to Dropbox
  const handleRpmSubmit = async () => {
    setDuplicateAlert(null);

    // Mandatory Validations for RPM
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
      alert('⚠️ Mandatory Field Missing: Please enter technician name under "Maintenance carried By".');
      document.getElementById('maintenance-carried-by-input')?.focus();
      return;
    }

    if (!maintenanceSignatureUrl) {
      alert('⚠️ Mandatory Field Missing: Maintenance Signature is required. Please upload or select a signature.');
      const footerEl = document.getElementById('form-footer');
      if (footerEl) footerEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Duplicate Check for new submissions
    if (!activeInspectionId) {
      setIsCheckingDuplicate(true);
      const isDuplicate = await checkAlreadyInspectedThisQuarter(roomNumber, selectedQuarter, selectedDate);
      setIsCheckingDuplicate(false);

      if (isDuplicate) {
        const msg = `Room ${roomNumber} has ALREADY been submitted for ${selectedQuarter}. Duplicate inspection submissions for the same quarter are blocked.`;
        setDuplicateAlert(msg);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const nowStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setIsSubmitted(true);
    setSubmittedAt(nowStr);

    let savedId = activeInspectionId;
    // 1. Save or Update in DB
    try {
      const payload = {
        room_number: roomNumber,
        room_type: roomType,
        inspection_date: formatDisplayDate(selectedDate),
        property_name: selectedProperty,
        quarter: selectedQuarter,
        status: 'submitted',
        maintenance_carried_by: maintenanceCarriedBy,
        signature_url: maintenanceSignatureUrl,
        overall_remark: overallRemark,
        items: Object.values(itemsMap).map((it) => ({
          checklist_item_id: it.checklist_item_id,
          result: it.result || 'PASS',
          remark: it.remark,
          inspector_remark: it.inspector_remark || null,
        })),
      };

      if (activeInspectionId) {
        const res = await api.updateInspection(activeInspectionId, payload);
        savedId = res.id;
      } else {
        const res = await api.submitInspection(payload);
        savedId = res.id;
        setActiveInspectionId(res.id);
      }
    } catch (err: any) {
      console.warn('Backend inspection submit note:', err);
    }

    // 2. Sync RPM Schedule Record to Pending
    try {
      const year = getYearFromDateString(selectedDate);
      const records = await api.getRpmRecords({ year, quarter: selectedQuarter });
      const cleanTarget = roomNumber.toLowerCase().replace(/room\s*/i, '').trim();
      const matched = records?.find((r) => {
        const rClean = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
        return rClean === cleanTarget || r.room_or_area.toLowerCase() === roomNumber.toLowerCase().trim();
      });

      const formattedDate = formatDisplayDate(selectedDate);
      if (matched) {
        await api.updateRpmRecord(matched.id, {
          inspection_status: 'Pending',
          rpm_date: formattedDate,
        });
      } else {
        await api.createRpmRecord({
          property_name: selectedProperty,
          room_or_area: roomNumber.toLowerCase().includes('room') ? roomNumber : `Room ${roomNumber}`,
          category: 'guest_room',
          floor: `Level ${roomNumber.charAt(0)}`,
          quarter: selectedQuarter,
          year: year,
          inspection_status: 'Pending',
          rpm_date: formattedDate,
        });
      }
    } catch (e) {
      console.warn('RPM schedule update sync note', e);
    }

    // 3. Save RPM Document to Dropbox (RPM_roomno_date.pdf)
    setIsSavingDropbox(true);
    let rpmDropboxSuccess = false;
    let rpmFilename = '';
    try {
      const formattedDate = formatDisplayDate(selectedDate);
      const { blob, filename } = getInspectionPdfBlob({
        documentType: 'RPM',
        propertyName: selectedProperty,
        roomNumber,
        roomType,
        inspectionDate: formattedDate,
        quarter: selectedQuarter,
        status: 'submitted',
        sections,
        itemsMap,
        overallRemark,
        maintenanceCarriedBy,
        signatureUrl: maintenanceSignatureUrl,
      });
      rpmFilename = filename;

      const year = getYearFromDateString(selectedDate);
      const dbxRes = await api.uploadPdfToDropbox(blob, filename, {
        room_number: roomNumber,
        quarter: selectedQuarter,
        year,
      });

      setDropboxStatus({
        success: true,
        message: `RPM Document successfully uploaded to Dropbox: ${filename}`,
        path: dbxRes.path,
        share_url: dbxRes.share_url,
      });
      rpmDropboxSuccess = true;
    } catch (err: any) {
      console.warn('Dropbox auto-upload note:', err);
      setDropboxStatus({
        success: false,
        message: err?.message || 'Form saved in database. Dropbox auto-upload deferred.',
      });
    } finally {
      setIsSavingDropbox(false);
    }

    saveInspectionState({
      isSubmitted: true,
      submittedAt: nowStr,
      activeInspectionId: savedId,
    });
    loadSubmittedInspections();

    try {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    } catch (e) {}

    if (rpmDropboxSuccess) {
      alert(`✓ Form successfully submitted!\nDocument uploaded to Dropbox: ${rpmFilename}`);
    } else {
      alert(`✓ Form successfully submitted and saved to database.`);
    }

    const actionsEl = document.getElementById('submission-actions');
    if (actionsEl) actionsEl.scrollIntoView({ behavior: 'smooth' });
  };

  // 2. Submit by Inspector: Enters Inspector Name and Signature, updates status to 'verified', saves Inspection_{roomno}_{date}.pdf to Dropbox with remarks
  const handleInspectorSubmit = async () => {
    // Validations for Inspector
    if (!inspectedBy.trim()) {
      alert('⚠️ Mandatory Field Missing: Please enter Inspector Name.');
      document.getElementById('inspected-by-input')?.focus();
      return;
    }

    if (!inspectedBySignatureUrl) {
      alert('⚠️ Mandatory Field Missing: Inspector Signature is required. Please upload or select signature under "Inspected By".');
      const footerEl = document.getElementById('form-footer');
      if (footerEl) footerEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const nowStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setIsVerified(true);
    setVerifiedAt(nowStr);

    let savedId = activeInspectionId;
    // 1. Update in DB with verified status, inspector signature, and remarks
    try {
      const payload = {
        room_number: roomNumber,
        room_type: roomType,
        inspection_date: formatDisplayDate(selectedDate),
        property_name: selectedProperty,
        quarter: selectedQuarter,
        status: 'verified',
        inspected_by: inspectedBy,
        inspected_by_signature_url: inspectedBySignatureUrl,
        overall_remark: overallRemark,
        inspector_remark: inspectorRemark,
        items: Object.values(itemsMap).map((it) => ({
          checklist_item_id: it.checklist_item_id,
          result: it.result || 'PASS',
          remark: it.remark,
          inspector_remark: it.inspector_remark || null,
        })),
      };

      if (activeInspectionId) {
        const res = await api.updateInspection(activeInspectionId, payload);
        savedId = res.id;
      } else {
        const res = await api.submitInspection({
          ...payload,
          maintenance_carried_by: maintenanceCarriedBy,
          signature_url: maintenanceSignatureUrl,
        });
        savedId = res.id;
        setActiveInspectionId(res.id);
      }
    } catch (err) {
      console.warn('Backend inspector update note:', err);
    }

    // 2. Sync RPM Schedule Record to Done
    try {
      const year = getYearFromDateString(selectedDate);
      const records = await api.getRpmRecords({ year, quarter: selectedQuarter });
      const cleanTarget = roomNumber.toLowerCase().replace(/room\s*/i, '').trim();
      const matched = records?.find((r) => {
        const rClean = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
        return rClean === cleanTarget || r.room_or_area.toLowerCase() === roomNumber.toLowerCase().trim();
      });

      const formattedDate = formatDisplayDate(selectedDate);
      if (matched) {
        await api.updateRpmRecord(matched.id, {
          inspection_status: 'Done',
          inspection_date: formattedDate,
        });
      } else {
        await api.createRpmRecord({
          property_name: selectedProperty,
          room_or_area: roomNumber.toLowerCase().includes('room') ? roomNumber : `Room ${roomNumber}`,
          category: 'guest_room',
          floor: `Level ${roomNumber.charAt(0)}`,
          quarter: selectedQuarter,
          year: year,
          inspection_status: 'Done',
          inspection_date: formattedDate,
        });
      }
    } catch (e) {
      console.warn('RPM schedule update sync note', e);
    }

    // 3. Save Inspection Document to Dropbox (Inspection_roomno_date.pdf in landscape with checklist remarks)
    setIsSavingDropbox(true);
    let inspectorDropboxSuccess = false;
    let inspectorFilename = '';
    try {
      const formattedDate = formatDisplayDate(selectedDate);
      const { blob, filename } = getInspectionPdfBlob({
        documentType: 'Inspection',
        orientation: 'landscape',
        propertyName: selectedProperty,
        roomNumber,
        roomType,
        inspectionDate: formattedDate,
        quarter: selectedQuarter,
        status: 'verified',
        sections,
        itemsMap,
        overallRemark,
        inspectorRemark,
        maintenanceCarriedBy,
        signatureUrl: maintenanceSignatureUrl,
        inspectedByName: inspectedBy,
        inspectedBySignatureUrl,
        inspectedAt: nowStr,
      });
      inspectorFilename = filename;

      const year = getYearFromDateString(selectedDate);
      const dbxRes = await api.uploadPdfToDropbox(blob, filename, {
        room_number: roomNumber,
        quarter: selectedQuarter,
        year,
      });

      setDropboxStatus({
        success: true,
        message: `Inspection Document successfully uploaded to Dropbox: ${filename}`,
        path: dbxRes.path,
        share_url: dbxRes.share_url,
      });
      inspectorDropboxSuccess = true;
    } catch (err: any) {
      console.warn('Dropbox auto-upload note:', err);
      setDropboxStatus({
        success: false,
        message: err?.message || 'Verification saved in database. Dropbox auto-upload deferred.',
      });
    } finally {
      setIsSavingDropbox(false);
    }

    saveInspectionState({
      isVerified: true,
      verifiedAt: nowStr,
      activeInspectionId: savedId,
    });
    loadSubmittedInspections();

    try {
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 } });
    } catch (e) {}

    if (inspectorDropboxSuccess) {
      alert(`✓ Inspection verified!\nDocument uploaded to Dropbox: ${inspectorFilename}`);
    } else {
      alert(`✓ Inspection verified and saved to database.`);
    }

    const actionsEl = document.getElementById('submission-actions');
    if (actionsEl) actionsEl.scrollIntoView({ behavior: 'smooth' });
  };

  // 3. Admin Full Edit & Save with Dropbox File Replacement
  // "In admin login there will another column Show that will open the form in edit mode if submitted then replace the form if RPM is submitted but inpesctor not then Replace the RPM file if both submitted then replace the Inspection file"
  const handleAdminSave = async () => {
    setIsSavingDropbox(true);
    setDropboxStatus(null);
    try {
      const formattedDate = formatDisplayDate(selectedDate);
      const isVerifiedStatus = isVerified || (inspectedBy && inspectedBySignatureUrl);
      const targetStatus = isVerifiedStatus ? 'verified' : (isSubmitted ? 'submitted' : 'in_progress');

      const payload = {
        room_number: roomNumber,
        room_type: roomType,
        inspection_date: formattedDate,
        property_name: selectedProperty,
        quarter: selectedQuarter,
        status: targetStatus,
        maintenance_carried_by: maintenanceCarriedBy,
        signature_url: maintenanceSignatureUrl,
        inspected_by: inspectedBy || undefined,
        inspected_by_signature_url: inspectedBySignatureUrl || null,
        overall_remark: overallRemark,
        inspector_remark: inspectorRemark,
        items: Object.values(itemsMap).map((it) => ({
          checklist_item_id: it.checklist_item_id,
          result: it.result || 'PASS',
          remark: it.remark,
          inspector_remark: it.inspector_remark || null,
        })),
      };

      let savedId = activeInspectionId;
      if (activeInspectionId) {
        const res = await api.updateInspection(activeInspectionId, payload);
        savedId = res.id;
      } else {
        const res = await api.submitInspection(payload);
        savedId = res.id;
        setActiveInspectionId(res.id);
      }

      // Sync with RPM schedule table
      const year = getYearFromDateString(selectedDate);
      try {
        const records = await api.getRpmRecords({ year, quarter: selectedQuarter });
        const cleanTarget = roomNumber.toLowerCase().replace(/room\s*/i, '').trim();
        const matched = records?.find((r) => {
          const rClean = r.room_or_area.toLowerCase().replace(/room\s*/i, '').trim();
          return rClean === cleanTarget || r.room_or_area.toLowerCase() === roomNumber.toLowerCase().trim();
        });

        if (matched) {
          await api.updateRpmRecord(matched.id, {
            inspection_status: targetStatus === 'verified' ? 'Done' : (targetStatus === 'submitted' ? 'Pending' : matched.inspection_status),
            inspection_date: targetStatus === 'verified' ? formattedDate : matched.inspection_date,
            rpm_date: targetStatus === 'submitted' ? formattedDate : (matched.rpm_date || formattedDate),
          });
        }
      } catch (e) {
        console.warn('RPM table sync note:', e);
      }

      // Check Dropbox replacement:
      // If both submitted -> Replace Inspection file
      // If RPM submitted but inspector not -> Replace RPM file
      if (targetStatus === 'verified') {
        const { blob, filename } = getInspectionPdfBlob({
          documentType: 'Inspection',
          orientation: 'landscape',
          propertyName: selectedProperty,
          roomNumber,
          roomType,
          inspectionDate: formattedDate,
          quarter: selectedQuarter,
          status: 'verified',
          sections,
          itemsMap,
          overallRemark,
          inspectorRemark,
          maintenanceCarriedBy,
          signatureUrl: maintenanceSignatureUrl,
          inspectedByName: inspectedBy,
          inspectedBySignatureUrl,
          inspectedAt: verifiedAt || formattedDate,
        });

        const dbxRes = await api.uploadPdfToDropbox(blob, filename, {
          room_number: roomNumber,
          quarter: selectedQuarter,
          year,
        });

        setDropboxStatus({
          success: true,
          message: `Inspection Document (landscape with dual remarks) replaced in Dropbox: ${filename}`,
          path: dbxRes.path,
          share_url: dbxRes.share_url,
        });
        alert(`✓ Inspection form updated! Dropbox file replaced: ${filename}`);
      } else if (targetStatus === 'submitted') {
        const { blob, filename } = getInspectionPdfBlob({
          documentType: 'RPM',
          orientation: 'portrait',
          propertyName: selectedProperty,
          roomNumber,
          roomType,
          inspectionDate: formattedDate,
          quarter: selectedQuarter,
          status: 'submitted',
          sections,
          itemsMap,
          overallRemark,
          maintenanceCarriedBy,
          signatureUrl: maintenanceSignatureUrl,
        });

        const dbxRes = await api.uploadPdfToDropbox(blob, filename, {
          room_number: roomNumber,
          quarter: selectedQuarter,
          year,
        });

        setDropboxStatus({
          success: true,
          message: `RPM Document replaced in Dropbox: ${filename}`,
          path: dbxRes.path,
          share_url: dbxRes.share_url,
        });
        alert(`✓ RPM form updated! Dropbox file replaced: ${filename}`);
      } else {
        alert('✓ Form draft successfully updated in database by Admin.');
      }

      saveInspectionState({
        isSubmitted: targetStatus === 'submitted' || targetStatus === 'verified',
        isVerified: targetStatus === 'verified',
        activeInspectionId: savedId,
      });
      loadSubmittedInspections();
    } catch (err: any) {
      alert(`Admin update failed: ${err?.message || 'Check connection'}`);
    } finally {
      setIsSavingDropbox(false);
    }
  };

  // Download PDF helper: supports 'RPM' and 'Inspection'
  const handleDownloadPdf = (docType: 'RPM' | 'Inspection' = 'RPM') => {
    const formattedDate = formatDisplayDate(selectedDate);
    generateInspectionPdf({
      documentType: docType,
      orientation: docType === 'Inspection' ? 'landscape' : 'portrait',
      propertyName: selectedProperty,
      roomNumber,
      roomType,
      inspectionDate: formattedDate,
      quarter: selectedQuarter,
      status: isVerified ? 'verified' : (isSubmitted ? 'submitted' : 'in_progress'),
      sections,
      itemsMap,
      overallRemark,
      inspectorRemark,
      maintenanceCarriedBy: maintenanceCarriedBy || 'Maintenance Staff',
      signatureUrl: maintenanceSignatureUrl,
      inspectedByName: inspectedBy || undefined,
      inspectedBySignatureUrl: inspectedBySignatureUrl || null,
      inspectedAt: verifiedAt || (inspectedBy ? formattedDate : undefined),
    });
  };

  // Save PDF to Dropbox on demand: supports 'RPM' and 'Inspection'
  const handleSaveToDropbox = async (docType: 'RPM' | 'Inspection' = 'RPM') => {
    setIsSavingDropbox(true);
    setDropboxStatus(null);
    try {
      const formattedDate = formatDisplayDate(selectedDate);
      const { blob, filename } = getInspectionPdfBlob({
        documentType: docType,
        orientation: docType === 'Inspection' ? 'landscape' : 'portrait',
        propertyName: selectedProperty,
        roomNumber,
        roomType,
        inspectionDate: formattedDate,
        quarter: selectedQuarter,
        status: isVerified ? 'verified' : (isSubmitted ? 'submitted' : 'in_progress'),
        sections,
        itemsMap,
        overallRemark,
        inspectorRemark,
        maintenanceCarriedBy: maintenanceCarriedBy || 'Maintenance Staff',
        signatureUrl: maintenanceSignatureUrl,
        inspectedByName: inspectedBy || undefined,
        inspectedBySignatureUrl: inspectedBySignatureUrl || null,
        inspectedAt: verifiedAt || (inspectedBy ? formattedDate : undefined),
      });

      const year = parseInt(selectedDate.split('-')[0], 10) || 2026;
      const res = await api.uploadPdfToDropbox(blob, filename, {
        room_number: roomNumber,
        quarter: selectedQuarter,
        year,
      });

      setDropboxStatus({
        success: true,
        message: `Successfully saved ${docType} report to Dropbox: ${res.path}`,
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
        {/* Admin Edit & Document Replacement Access Toolbar */}
        {isAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-purple-950/90 border-2 border-purple-500 text-purple-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl print:hidden animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-700 flex items-center justify-center text-white shadow">
                <ShieldCheck className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Admin Edit & Replacement Access</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                    Room {roomNumber} • {isVerified ? 'Verified' : isSubmitted ? 'Submitted' : 'Draft'}
                  </span>
                </div>
                <div className="text-xs text-purple-200 mt-0.5">
                  Full edit access granted. Modifying and saving will replace the form in the database and update Dropbox files.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleAdminSave}
                disabled={isSavingDropbox}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95 disabled:opacity-60"
              >
                {isSavingDropbox ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSavingDropbox ? 'Replacing...' : 'Save & Replace Form'}</span>
              </button>
            </div>
          </div>
        )}

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
          <div className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xl animate-in fade-in slide-in-from-top-2 ${dropboxStatus.success
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

        <div className="bg-white rounded-xl shadow-xl border border-slate-300 p-6 sm:p-10 text-slate-900">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-brand tracking-wider text-slate-900 uppercase">
              ROOM PREVENTIVE MAINTENANCE
            </h1>

          </div>

          {/* Form Header Fields: Property, Type & Room */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Property:</span>
              </label>
              <select
                disabled={!isAdmin && (isSubmitted || isVerified || user?.role === 'inspector')}
                value={selectedProperty}
                onChange={(e) => {
                  setSelectedProperty(e.target.value);
                  triggerAutosave();
                }}
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 cursor-pointer shadow-sm"
              >
                <option value="Maxwell">Maxwell</option>
                <option value="Serangoon House">Serangoon House</option>
                <option value="Vagabond Club">Vagabond Club</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Type:
              </label>
              <input
                type="text"
                disabled={!isAdmin && (isSubmitted || isVerified || user?.role === 'inspector')}
                value={roomType}
                onChange={(e) => {
                  setRoomType(e.target.value);
                  triggerAutosave();
                }}
                placeholder="e.g. Deluxe, Suite..."
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Number:
              </label>
              <input
                type="text"
                disabled={!isAdmin && (isSubmitted || isVerified || user?.role === 'inspector')}
                value={roomNumber}
                onChange={(e) => {
                  setRoomNumber(e.target.value);
                  triggerAutosave();
                }}
                placeholder="e.g. 101, 102..."
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 shadow-sm"
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
                    {(!isSubmitted || isAdmin) && user?.role !== 'inspector' && (
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
                  <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[780px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-slate-700 font-bold uppercase text-[11px]">
                          <th className="py-2.5 px-3 w-10 text-center border-r border-slate-300">#</th>
                          <th className="py-2.5 px-4 border-r border-slate-300">Checklist Item</th>
                          <th className="py-2.5 px-3 w-36 text-center border-r border-slate-300">
                            <div className="flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              <span className="text-slate-400 font-normal">/</span>
                              <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                            </div>
                          </th>
                          <th className="py-2.5 px-3.5 w-60 border-r border-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                              <span>RPM Remarks</span>
                            </div>
                          </th>
                          <th className="py-2.5 px-3.5 w-60">
                            <div className="flex items-center gap-1.5">
                              <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Inspector Remarks</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {section.items.map((item) => {
                          const ans = itemsMap[item.id];
                          const res = ans?.result;
                          const rpmRem = ans?.remark || '';
                          const inspRem = ans?.inspector_remark || '';
                          const isFail = res === 'fail';

                          // Status-based disabled rules
                          const isResultDisabled = !isAdmin && (user?.role === 'inspector' || isSubmitted || isVerified);
                          const isRpmRemarkDisabled = !isAdmin && (user?.role === 'inspector' || isSubmitted || isVerified);
                          const isInspectorRemarkDisabled = !isAdmin && (user?.role === 'rpm' || isVerified);

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
                                    disabled={isResultDisabled}
                                    onClick={() => handleItemResult(item.id, 'pass')}
                                    title="Pass (No Defects)"
                                    className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-0.5 transition cursor-pointer disabled:cursor-not-allowed ${res === 'pass'
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
                                    disabled={isResultDisabled}
                                    onClick={() => handleItemResult(item.id, 'fail')}
                                    title="Defect / Fail"
                                    className={`px-2 py-1 text-xs font-bold rounded-md flex items-center gap-0.5 transition cursor-pointer disabled:cursor-not-allowed ${res === 'fail'
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
                                    disabled={isResultDisabled}
                                    onClick={() => handleItemResult(item.id, 'na')}
                                    title="Not Applicable"
                                    className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer disabled:cursor-not-allowed ${res === 'na'
                                      ? 'bg-slate-700 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                                      }`}
                                  >
                                    NA
                                  </button>
                                </div>
                              </td>

                              {/* RPM Remarks Column */}
                              <td className="py-2 px-3 border-r border-slate-200 align-top">
                                <input
                                  type="text"
                                  disabled={isRpmRemarkDisabled}
                                  value={rpmRem}
                                  onChange={(e) => handleItemResult(item.id, res || 'fail', e.target.value)}
                                  placeholder={
                                    isFail
                                      ? 'Describe defect details...'
                                      : user?.role === 'inspector'
                                        ? (rpmRem ? '' : 'No RPM remark')
                                        : 'Optional RPM remarks...'
                                  }
                                  className={`w-full text-xs px-2.5 py-1.5 rounded border focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-600 ${isFail
                                    ? 'border-rose-300 bg-rose-50/40 text-rose-900 placeholder:text-rose-400 focus:ring-rose-500'
                                    : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-slate-800'
                                    }`}
                                />

                                {/* Quick Defect Suggestion Pills for RPM */}
                                {isFail && !rpmRem && !isRpmRemarkDisabled && (
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

                              {/* Inspector Remarks Column */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  disabled={isInspectorRemarkDisabled}
                                  value={inspRem}
                                  onChange={(e) => handleInspectorItemRemark(item.id, e.target.value)}
                                  placeholder={
                                    user?.role === 'rpm'
                                      ? 'Pending inspector review'
                                      : 'Inspector remark / verification...'
                                  }
                                  className={`w-full text-xs px-2.5 py-1.5 rounded border focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-500 ${inspRem
                                    ? 'border-blue-300 bg-blue-50/30 text-blue-900 font-medium'
                                    : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-blue-600'
                                    }`}
                                />
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


          {/* Form Footer: 1) Date & Quarter (Mandatory), 2) Maintenance Carried By (Mandatory), 3) Inspected By */}
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
                        disabled={!isAdmin && ((user?.role === 'rpm' && isSubmitted) || isVerified)}
                        value={formatDateForInput(selectedDate)}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setSelectedDate(newDate);
                          setSelectedQuarter(getQuarterFromDate(newDate));
                          triggerAutosave();
                        }}
                        className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 cursor-pointer shadow-sm"
                      />
                    </div>
                    <div className="text-xs font-medium text-slate-600 mt-1.5">
                      Selected: <span className="font-bold text-slate-900">{inspectionDateDisplay}</span>
                    </div>
                  </div>

                  {/* Quarter Selection */}
                  <div className="pt-3 border-t border-slate-200">
                    <label htmlFor="quarter-select-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Schedule Quarter: <span className="text-rose-600">*</span></span>
                      <span className="text-[10px] font-semibold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Mandatory</span>
                    </label>
                    <select
                      id="quarter-select-input"
                      disabled={!isAdmin && ((user?.role === 'rpm' && isSubmitted) || isVerified)}
                      value={selectedQuarter}
                      onChange={(e) => {
                        setSelectedQuarter(e.target.value);
                        triggerAutosave();
                      }}
                      className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 cursor-pointer shadow-sm"
                    >
                      <option value="1st Quarter (Jan - April)">1st Quarter (Jan - April)</option>
                      <option value="2nd Quarter (May - August)">2nd Quarter (May - August)</option>
                      <option value="3rd Quarter (Sept - Dec)">3rd Quarter (Sept - Dec)</option>
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  Manual inspection date & quarter schedule
                </div>
              </div>

              {/* CARD 2: Maintenance carried By (RPM Role) */}
              <div className="p-4 rounded-xl border-2 border-slate-300 bg-white flex flex-col justify-between space-y-3">
                <div>
                  <label htmlFor="maintenance-carried-by-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Maintenance carried By: <span className="text-rose-600">*</span></span>
                    <span className="text-[10px] font-semibold text-emerald-700 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">RPM Technician</span>
                  </label>
                  <input
                    id="maintenance-carried-by-input"
                    type="text"
                    disabled={!isAdmin && (isSubmitted || isVerified || user?.role === 'inspector')}
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
                      ⚠️ Technician Signature Required
                    </div>
                  )}
                </div>

                {!isAdmin && (user?.role === 'inspector' || isSubmitted || isVerified) ? (
                  <div className="text-center text-[11px] text-emerald-700 font-semibold mt-1">
                    ✓ Attached Technician Signature
                  </div>
                ) : (
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
                )}
              </div>

              {/* CARD 3: Inspected By (Inspector Role) */}
              <div
                className={`p-4 rounded-xl border-2 flex flex-col justify-between space-y-3 ${
                  user?.role === 'inspector' ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <div>
                  <label htmlFor="inspected-by-input" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Inspected By: {user?.role === 'inspector' && <span className="text-rose-600">*</span>}</span>
                    <span className="text-[10px] font-semibold text-blue-700 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {user?.role === 'inspector' ? 'Mandatory' : 'Inspector'}
                    </span>
                  </label>
                  <input
                    id="inspected-by-input"
                    type="text"
                    disabled={!isAdmin && (user?.role === 'rpm' || isVerified)}
                    value={inspectedBy}
                    onChange={(e) => {
                      setInspectedBy(e.target.value);
                      triggerAutosave();
                    }}
                    placeholder={user?.role === 'rpm' ? 'To be inspected...' : 'Inspector name...'}
                    className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 mb-2.5 shadow-sm"
                  />

                  {/* Display inspected by signature */}
                  {inspectedBySignatureUrl ? (
                    <div className="p-2.5 border-2 border-blue-400 rounded-xl bg-white my-2 flex flex-col items-center justify-center min-h-[60px]">
                      <img
                        src={inspectedBySignatureUrl}
                        alt="Inspected By Signature"
                        className="max-h-12 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-14 border-2 border-dashed border-slate-300 rounded-xl bg-white/60 flex items-center justify-center text-xs text-slate-400 my-2">
                      {user?.role === 'inspector' ? '⚠️ Inspector Signature Required' : '(Pending Inspector sign-off)'}
                    </div>
                  )}
                </div>

                {isAdmin || (user?.role === 'inspector' && !isVerified) ? (
                  <div className="mt-1 print:hidden">
                    <SignatureSelector
                      label="Inspector Signature Picture *"
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
                  <div className="text-center text-[11px] text-slate-500 font-medium mt-1">
                    {inspectedBy ? `✓ Inspected by ${inspectedBy}` : 'Official Inspector Sign-off on verification'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submission and PDF Download Actions — Role-Based */}
          <div
            id="submission-actions"
            className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden"
          >
            <div className="text-xs text-slate-600">
              {isVerified ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Inspection Officially Verified by Inspector. Both RPM and Inspection documents recorded.</span>
                </span>
              ) : isSubmitted ? (
                <span className="text-blue-700 font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Submitted by RPM. Awaiting Inspector verification and sign-off.</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Complete checklist items and sign off to submit.</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* ADMIN ACTIONS */}
              {user?.role === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={handleAdminSave}
                    disabled={isSavingDropbox}
                    className="py-3 px-5 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-800 text-white flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDropbox ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                    )}
                    <span>{isSavingDropbox ? 'Replacing in Dropbox...' : 'Save & Replace Form (Admin)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf('RPM')}
                    className="py-3 px-3.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow cursor-pointer"
                    title="Download RPM_{room}_{date}.pdf"
                  >
                    <FileDown className="w-4 h-4 text-amber-400" />
                    <span>RPM PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf('Inspection')}
                    className="py-3 px-3.5 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow cursor-pointer"
                    title="Download Inspection_{room}_{date}.pdf (Dual Remarks)"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400" />
                    <span>Inspection PDF</span>
                  </button>
                </>
              )}

              {/* INSPECTOR ACTIONS */}
              {user?.role === 'inspector' && (
                <>
                  {!isVerified ? (
                    <button
                      type="button"
                      onClick={handleInspectorSubmit}
                      disabled={isSavingDropbox}
                      className="py-3.5 px-6 rounded-xl text-sm font-extrabold bg-blue-700 hover:bg-blue-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-700/20 transition cursor-pointer active:scale-95 disabled:opacity-60"
                    >
                      {isSavingDropbox ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Saving to Dropbox...</span>
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="w-4 h-4 text-amber-300" />
                          <span>Verify & Submit Inspection Sign-off</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf('Inspection')}
                        className="py-3 px-4 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow cursor-pointer"
                        title="Download Inspection_{room}_{date}.pdf"
                      >
                        <FileDown className="w-4 h-4 text-emerald-400" />
                        <span>Download Inspection PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf('RPM')}
                        className="py-3 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow cursor-pointer"
                        title="Download RPM_{room}_{date}.pdf"
                      >
                        <FileDown className="w-4 h-4 text-amber-400" />
                        <span>Download RPM PDF</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {/* RPM USER ACTIONS */}
              {(user?.role === 'rpm' || (!user?.role && user?.role !== 'admin' && user?.role !== 'inspector')) && (
                <>
                  {!isSubmitted ? (
                    <button
                      type="button"
                      onClick={handleRpmSubmit}
                      disabled={isCheckingDuplicate || isSavingDropbox}
                      className="w-full sm:w-auto py-3.5 px-8 rounded-xl text-sm font-extrabold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition cursor-pointer active:scale-95 disabled:opacity-60"
                    >
                      {isCheckingDuplicate || isSavingDropbox ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                          <span>Submitting & Saving to Dropbox...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-amber-400" />
                          <span>Submit Official RPM Form</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf('RPM')}
                        className="py-3 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow cursor-pointer"
                        title="Download RPM_{room}_{date}.pdf"
                      >
                        <FileDown className="w-4 h-4 text-amber-400" />
                        <span>Download RPM PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveToDropbox('RPM')}
                        disabled={isSavingDropbox}
                        className="py-3 px-4 rounded-xl text-xs font-bold bg-[#0061FE] hover:bg-[#0052d9] text-white flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Save RPM to Dropbox</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Print Button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-3.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
