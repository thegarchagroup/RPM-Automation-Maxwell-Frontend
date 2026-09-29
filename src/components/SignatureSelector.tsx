import React, { useState, useEffect, useRef } from 'react';
import { Upload, Check, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

interface SignatureSelectorProps {
  label?: string;
  storageKey?: string;
  selectedSignatureUrl: string | null;
  onSelectSignature: (url: string | null) => void;
  autoSelectFirst?: boolean;
}

// Built-in demo sample signatures (SVG vector data URIs)
const DEFAULT_SIGNATURES = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><path d="M 15 35 Q 40 10 50 40 T 70 20 Q 90 45 110 25 T 140 35 Q 160 15 185 30" fill="none" stroke="%231e293b" stroke-width="2.5" stroke-linecap="round"/><path d="M 40 45 Q 90 42 160 48" fill="none" stroke="%231e293b" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><path d="M 20 40 C 35 15, 45 50, 60 25 C 75 40, 95 10, 115 35 C 135 15, 155 45, 180 25" fill="none" stroke="%230f172a" stroke-width="2.5" stroke-linecap="round"/><path d="M 30 50 L 170 44" fill="none" stroke="%230f172a" stroke-width="2" stroke-linecap="round"/></svg>',
];

export const SignatureSelector: React.FC<SignatureSelectorProps> = ({
  label = 'Signature Picture',
  storageKey = 'maxwell_saved_signatures',
  selectedSignatureUrl,
  onSelectSignature,
  autoSelectFirst = false,
}) => {
  const [signatures, setSignatures] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // fallback
    }
    return autoSelectFirst ? DEFAULT_SIGNATURES : [];
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(signatures));
    } catch (e) {
      console.warn('Unable to persist signatures in localStorage', e);
    }
  }, [signatures, storageKey]);

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (autoSelectFirst && !selectedSignatureUrl && signatures.length > 0) {
        onSelectSignature(signatures[0]);
      }
    }
  }, [selectedSignatureUrl, signatures, onSelectSignature, autoSelectFirst]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSignatures((prev) => [result, ...prev]);
        onSelectSignature(result);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeSignature = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSignatures((prev) => {
      const deletedUrl = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (selectedSignatureUrl === deletedUrl) {
        onSelectSignature(null);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
      />

      {/* Signature Selector Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {label}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
          </div>
        </div>

        {/* Signature Gallery */}
        {signatures.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 rounded-xl p-3 text-center cursor-pointer transition"
          >
            <ImageIcon className="w-5 h-5 text-slate-400 mx-auto mb-1" />
            <div className="text-xs font-semibold text-slate-700">
              No signature uploaded
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Click to upload a signature image (PNG, JPG, WebP)
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {signatures.map((url, idx) => {
              const isSelected = selectedSignatureUrl === url;
              return (
                <div
                  key={idx}
                  onClick={() => onSelectSignature(isSelected ? null : url)}
                  className={`group relative p-2 rounded-xl border-2 cursor-pointer transition-all bg-white flex flex-col items-center justify-center min-h-[58px] ${isSelected
                      ? 'border-emerald-600 bg-emerald-50/20 shadow-sm ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  <img
                    src={url}
                    alt={`Signature ${idx + 1}`}
                    className="max-h-10 max-w-full object-contain"
                  />
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow text-[10px]">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                  
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => removeSignature(e, idx)}
                    title="Delete signature"
                    className="absolute bottom-1 right-1 p-0.5 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 border border-rose-200 rounded transition cursor-pointer z-10"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-rose-600" />
                  </button>

                  <span className="text-[9px] text-slate-400 mt-0.5 font-medium self-start pl-0.5">
                    Signature #{idx + 1}
                  </span>
                </div>
              );
            })}

            {/* Quick Upload Add Tile */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-2 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer min-h-[58px] transition"
            >
              <Plus className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-medium">Upload New</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Preview Callout */}
      {selectedSignatureUrl && (
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Active:</span>
            <img
              src={selectedSignatureUrl}
              alt="Selected Signature"
              className="max-h-7 max-w-[100px] object-contain border border-slate-200 rounded p-0.5 bg-white"
            />
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Attached
          </span>
        </div>
      )}
    </div>
  );
};
