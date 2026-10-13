import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Calendar,
  ClipboardCheck,
  Wrench,
  ChevronRight,
  X,
} from 'lucide-react';
import type { PendingInspectionItem } from './InspectionNotificationBell';

interface PendingInspectionLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PendingInspectionItem[];
}

export const PendingInspectionLoginModal: React.FC<PendingInspectionLoginModalProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || items.length === 0) return null;

  const propertyCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.propertyName] = (acc[item.propertyName] || 0) + 1;
    return acc;
  }, {});

  const handleInspectRoom = (item: PendingInspectionItem) => {
    onClose();
    navigate(
      `/form?room=${encodeURIComponent(item.roomNumber)}&property=${encodeURIComponent(
        item.propertyName
      )}`
    );
  };

  const getPropertyBadgeStyle = (propName: string) => {
    const p = propName.toLowerCase();
    if (p.includes('serangoon')) {
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    }
    if (p.includes('vagabond')) {
      return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    }
    return 'bg-amber-100 text-amber-950 border-amber-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md flex-shrink-0">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[9px] font-black border border-white">
                {items.length}
              </span>
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Pending Inspections
              </h3>
              <p className="text-xs text-amber-200/80 font-medium">
                Rooms requiring verification sign-off
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Dismiss popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {!showDetails ? (
            /* Concise Pop-up view */
            <div className="space-y-5 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-snug">
                    {items.length === 1 ? '1 Room Needs' : `${items.length} Rooms Need`} Your Inspection
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    RPM technicians have submitted routine maintenance checklists that are awaiting
                    inspector sign-off across properties.
                  </p>
                </div>
              </div>

              {/* Property summary pills */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Breakdown By Property:
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(propertyCounts).map(([prop, count]) => (
                    <span
                      key={prop}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs ${getPropertyBadgeStyle(
                        prop
                      )}`}
                    >
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{prop}</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-white/70 text-slate-900 text-[10px] font-extrabold ml-0.5">
                        {count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                💡 You can also access these rooms anytime from the notification bell in the top navigation bar.
              </div>
            </div>
          ) : (
            /* Expanded Details view */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select a room to inspect:
                </span>
                <span className="text-xs font-black text-slate-800">
                  {items.length} awaiting
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {items.map((item) => (
                  <div
                    key={item.key}
                    onClick={() => handleInspectRoom(item)}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50/70 hover:bg-amber-50/50 transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">
                          Room {item.roomNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${getPropertyBadgeStyle(
                            item.propertyName
                          )}`}
                        >
                          {item.propertyName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-medium">
                        {item.technician && (
                          <span className="inline-flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-slate-400" />
                            <span>{item.technician}</span>
                          </span>
                        )}
                        {item.rpmDate && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{item.rpmDate}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 group-hover:bg-amber-400 flex items-center gap-1 shadow-2xs flex-shrink-0 transition"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {!showDetails ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <span>View Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
