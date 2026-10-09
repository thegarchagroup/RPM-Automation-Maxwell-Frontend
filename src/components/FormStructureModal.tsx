import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Section } from '../types';
import { AppModal } from './AppModal';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ListPlus,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface FormStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStructureUpdated?: () => void;
}

export const FormStructureModal: React.FC<FormStructureModalProps> = ({
  isOpen,
  onClose,
  onStructureUpdated,
}) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Section Editing State
  const [editSecCode, setEditSecCode] = useState<string>('');
  const [editSecTitle, setEditSecTitle] = useState<string>('');
  const [isEditingSec, setIsEditingSec] = useState<boolean>(false);

  // Add Section Modal/Form State
  const [showAddSec, setShowAddSec] = useState<boolean>(false);
  const [newSecCode, setNewSecCode] = useState<string>('');
  const [newSecTitle, setNewSecTitle] = useState<string>('');

  // Add Item State
  const [showAddItem, setShowAddItem] = useState<boolean>(false);
  const [newItemNo, setNewItemNo] = useState<number>(1);
  const [newItemDesc, setNewItemDesc] = useState<string>('');

  // Edit Item Inline State
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemNo, setEditItemNo] = useState<number>(1);
  const [editItemDesc, setEditItemDesc] = useState<string>('');

  // App Modal confirmation state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  const fetchTemplate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getTemplate();
      if (data) {
        const secs: Section[] = data.sections || [];
        setSections(secs);
        if (secs.length > 0) {
          if (!selectedSectionId || !secs.some((s) => s.id === selectedSectionId)) {
            setSelectedSectionId(secs[0].id);
          }
        } else {
          setSelectedSectionId(null);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load form template structure');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplate();
    }
  }, [isOpen]);

  const currentSection = sections.find((s) => s.id === selectedSectionId) || sections[0] || null;

  useEffect(() => {
    if (currentSection) {
      setEditSecCode(currentSection.code);
      setEditSecTitle(currentSection.title);
      setIsEditingSec(false);
      setShowAddItem(false);
      setEditingItemId(null);
      // Auto-compute next item number
      const maxNo = Math.max(...(currentSection.items?.map((it) => it.item_no) || [0]), 0);
      setNewItemNo(maxNo + 1);
      setNewItemDesc('');
    }
  }, [selectedSectionId, sections]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // 1. SAVE SECTION CODE / TITLE
  const handleSaveSection = async () => {
    if (!currentSection) return;
    if (!editSecCode.trim() || !editSecTitle.trim()) {
      setError('Section code and title cannot be blank');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await api.updateSection(currentSection.id, {
        code: editSecCode.trim().toUpperCase(),
        title: editSecTitle.trim(),
      });
      showToast(`Section ${editSecCode.toUpperCase()} updated successfully!`);
      setIsEditingSec(false);
      await fetchTemplate();
      onStructureUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to update section');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. ADD NEW SECTION
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecCode.trim() || !newSecTitle.trim()) {
      setError('Please provide section code and title');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const created = await api.addSection({
        code: newSecCode.trim().toUpperCase(),
        title: newSecTitle.trim(),
      });
      showToast(`New Section ${created.code} created!`);
      setNewSecCode('');
      setNewSecTitle('');
      setShowAddSec(false);
      await fetchTemplate();
      setSelectedSectionId(created.id);
      onStructureUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to add section');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. DELETE SECTION
  const handleDeleteSection = (sectionId: number, code: string) => {
    setConfirmAction({
      title: 'Delete Section?',
      message: `Are you sure you want to delete Section ${code}? All items in this section will also be permanently deleted.`,
      confirmText: 'Delete Section',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          await api.deleteSection(sectionId);
          showToast(`Section ${code} deleted.`);
          if (selectedSectionId === sectionId) {
            setSelectedSectionId(null);
          }
          await fetchTemplate();
          onStructureUpdated?.();
        } catch (err: any) {
          setError(err?.message || 'Failed to delete section');
        } finally {
          setIsSaving(false);
          setConfirmAction(null);
        }
      },
    });
  };

  // 4. ADD CHECKLIST ITEM
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSection) return;
    if (!newItemDesc.trim()) {
      setError('Checklist item description cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await api.addChecklistItem(currentSection.id, {
        item_no: Number(newItemNo) || 1,
        description: newItemDesc.trim(),
      });
      showToast('New checklist item added!');
      setNewItemDesc('');
      setShowAddItem(false);
      await fetchTemplate();
      onStructureUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to add checklist item');
    } finally {
      setIsSaving(false);
    }
  };

  // 5. UPDATE CHECKLIST ITEM
  const handleUpdateItem = async (itemId: number) => {
    if (!editItemDesc.trim()) {
      setError('Item description cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await api.updateChecklistItem(itemId, {
        item_no: Number(editItemNo) || 1,
        description: editItemDesc.trim(),
      });
      showToast('Item updated!');
      setEditingItemId(null);
      await fetchTemplate();
      onStructureUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  // 6. DELETE CHECKLIST ITEM
  const handleDeleteItem = (itemId: number, desc: string) => {
    setConfirmAction({
      title: 'Delete Checklist Item?',
      message: `Are you sure you want to delete checklist item "${desc}"?`,
      confirmText: 'Delete Item',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          await api.deleteChecklistItem(itemId);
          showToast('Item removed.');
          await fetchTemplate();
          onStructureUpdated?.();
        } catch (err: any) {
          setError(err?.message || 'Failed to delete item');
        } finally {
          setIsSaving(false);
          setConfirmAction(null);
        }
      },
    });
  };

  // 7. RESET TEMPLATE TO DEFAULT
  const handleResetTemplate = () => {
    setConfirmAction({
      title: 'Reset Checklist Template?',
      message: 'Are you sure you want to reset the form structure? This will restore all standard Maxwell checklist sections (A through K) to their default template definitions.',
      confirmText: 'Reset to Default',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          await api.resetTemplate();
          showToast('Form structure successfully reset to default Maxwell standard (A-K)!');
          await fetchTemplate();
          onStructureUpdated?.();
        } catch (err: any) {
          setError(err?.message || 'Failed to reset template');
        } finally {
          setIsSaving(false);
          setConfirmAction(null);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm flex justify-center items-center min-h-screen animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Form Structure Configuration</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Modify checklist sections, codes, descriptions, and line items. Changes apply dynamically to all RPM inspection checklists.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTemplate}
              disabled={isSaving || isLoading}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/40 transition cursor-pointer disabled:opacity-50"
              title="Reset to default standard Maxwell sections A through K"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standard (A-K)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-[420px]">
          {/* LEFT SIDEBAR: SECTIONS LIST */}
          <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-4 flex flex-col flex-shrink-0 overflow-y-auto max-h-[220px] md:max-h-none">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Sections ({sections.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddSec(true);
                  setNewSecCode('');
                  setNewSecTitle('');
                }}
                className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-amber-400" />
                <span>Add</span>
              </button>
            </div>

            {/* List of Section Tabs */}
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading structure...</span>
                </div>
              ) : sections.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No sections found.</div>
              ) : (
                sections.map((sec) => {
                  const isSelected = sec.id === currentSection?.id;
                  return (
                    <div
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-bold cursor-pointer transition border ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {sec.code}
                        </span>
                        <span className="truncate">{sec.title}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-500'
                        }`}
                        title={`${sec.items?.length || 0} checklist items`}
                      >
                        {sec.items?.length || 0}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANEL: SELECTED SECTION DETAILS & CHECKLIST ITEMS */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col bg-white">
            {currentSection ? (
              <div className="space-y-4">
                {/* Section Header Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 shadow-sm">
                  {isEditingSec ? (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Code
                          </label>
                          <input
                            type="text"
                            value={editSecCode}
                            onChange={(e) => setEditSecCode(e.target.value)}
                            placeholder="e.g. A"
                            maxLength={5}
                            className="w-full text-xs font-bold uppercase px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Section Title
                          </label>
                          <input
                            type="text"
                            value={editSecTitle}
                            onChange={(e) => setEditSecTitle(e.target.value)}
                            placeholder="e.g. MAIN ENTRANCE DOOR"
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditSecCode(currentSection.code);
                            setEditSecTitle(currentSection.title);
                            setIsEditingSec(false);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSection}
                          disabled={isSaving}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 transition cursor-pointer shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5 text-amber-400" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center text-sm font-black shadow-sm">
                          {currentSection.code}
                        </span>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">
                            {currentSection.title}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Section {currentSection.code} • {currentSection.items?.length || 0} inspection items
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingSec(true)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition flex items-center gap-1 cursor-pointer"
                          title="Rename section code or title"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Edit Section</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(currentSection.id, currentSection.code)}
                          disabled={isSaving}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                          title="Delete this section and its items"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Checklist Items Card Header */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4 text-slate-600" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Checklist Items in Section {currentSection.code}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddItem(true);
                      const maxNo = Math.max(...(currentSection.items?.map((it) => it.item_no) || [0]), 0);
                      setNewItemNo(maxNo + 1);
                      setNewItemDesc('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Checklist Item</span>
                  </button>
                </div>

                {/* Inline Add Item Form */}
                {showAddItem && (
                  <form
                    onSubmit={handleCreateItem}
                    className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2 animate-in fade-in duration-150"
                  >
                    <div className="text-[11px] font-bold text-blue-900">
                      Add New Line Item to Section {currentSection.code}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <div className="w-full sm:w-20">
                        <input
                          type="number"
                          required
                          min={1}
                          value={newItemNo}
                          onChange={(e) => setNewItemNo(parseInt(e.target.value, 10) || 1)}
                          placeholder="No."
                          className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div className="w-full flex-1">
                        <input
                          type="text"
                          required
                          placeholder="Description (e.g. Master switch / Key card slot)"
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAddItem(false)}
                          className="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer shadow-sm flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Item</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Table of Items */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Item #</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(!currentSection.items || currentSection.items.length === 0) ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            No checklist items in this section. Click "+ Add Checklist Item" above to create one.
                          </td>
                        </tr>
                      ) : (
                        currentSection.items.map((item) => {
                          const isEditingThis = editingItemId === item.id;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 transition">
                              {isEditingThis ? (
                                <>
                                  <td className="py-2 px-2 text-center">
                                    <input
                                      type="number"
                                      min={1}
                                      value={editItemNo}
                                      onChange={(e) => setEditItemNo(parseInt(e.target.value, 10) || 1)}
                                      className="w-12 text-center text-xs font-bold px-1 py-1 rounded border border-slate-300 bg-white"
                                    />
                                  </td>
                                  <td className="py-2 px-2">
                                    <input
                                      type="text"
                                      value={editItemDesc}
                                      onChange={(e) => setEditItemDesc(e.target.value)}
                                      className="w-full text-xs font-medium px-2 py-1 rounded border border-slate-300 bg-white"
                                    />
                                  </td>
                                  <td className="py-2 px-2 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItem(item.id)}
                                      disabled={isSaving}
                                      className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                      title="Save item"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingItemId(null)}
                                      className="p-1 rounded text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                                    {item.item_no}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                                    {item.description}
                                  </td>
                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditItemNo(item.item_no);
                                        setEditItemDesc(item.description);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer inline-flex items-center"
                                      title="Edit item description"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item.id, item.description)}
                                      disabled={isSaving}
                                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer inline-flex items-center ml-1"
                                      title="Delete item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <Layers className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No section selected</p>
                <p className="text-xs text-slate-400">Click a section on the left or add a new one.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Sub-Dialog: Add Section */}
        {showAddSec && (
          <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Add New Checklist Section</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddSec(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSection} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Section Code (e.g. L, M, E1) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="e.g. L"
                    value={newSecCode}
                    onChange={(e) => setNewSecCode(e.target.value)}
                    className="w-full text-xs font-bold uppercase px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Section Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BALCONY & EXTERIOR PATIO"
                    value={newSecTitle}
                    onChange={(e) => setNewSecTitle(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSec(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Creating...' : 'Create Section'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated structure is automatically used across all new inspection forms.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {confirmAction && (
        <AppModal
          isOpen={true}
          type="confirm"
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          cancelText="Cancel"
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};
