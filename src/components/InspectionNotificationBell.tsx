import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Building2, Calendar, ClipboardCheck, Wrench, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export interface PendingInspectionItem {
  key: string;
  inspectionId?: number;
  roomNumber: string;
  propertyName: string;
  quarter: string;
  year: number;
  rpmDate?: string;
  technician?: string;
}

export const InspectionNotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<PendingInspectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchPendingInspections = async () => {
    try {
      setLoading(true);
      const pendingList: PendingInspectionItem[] = [];
      const seenKeys = new Set<string>();

      // 1. Fetch from inspections endpoint with status 'submitted' across all properties
      const inspections = await api.getInspections({ status: 'submitted' }, true).catch(() => []);
      if (Array.isArray(inspections)) {
        inspections.forEach((insp: any) => {
          const room = String(insp.room_number || '').trim();
          const cleanRoom = room.replace(/room\s*/i, '').trim();
          const prop = insp.property_name || 'Maxwell';
          const quarter = insp.quarter || 'Current Quarter';
          const matchYear = String(insp.inspection_date || '').match(/\b(20\d\d)\b/);
          const year = matchYear ? parseInt(matchYear[1], 10) : 2026;
          const key = `${prop.toLowerCase().trim()}__${cleanRoom.toLowerCase().trim()}`;

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            pendingList.push({
              key,
              inspectionId: insp.id,
              roomNumber: cleanRoom,
              propertyName: prop,
              quarter,
              year,
              rpmDate: insp.inspection_date,
              technician: insp.maintenance_carried_by || 'RPM Technician',
            });
          }
        });
      }

      // 2. Fetch from RPM schedule records with status 'Pending' where rpm_date is non-empty
      const rpmRecords = await api.getRpmRecords({ status: 'Pending' }, true).catch(() => []);
      if (Array.isArray(rpmRecords)) {
        rpmRecords.forEach((r: any) => {
          if ((r.rpm_date || r.eng_date) && !r.inspection_date) {
            const cleanRoom = String(r.room_or_area || '').toLowerCase().replace(/room\s*/i, '').trim();
            const prop = r.property_name || 'Maxwell';
            const quarter = r.quarter || 'Current Quarter';
            const year = r.year || 2026;
            const key = `${prop.toLowerCase().trim()}__${cleanRoom.toLowerCase().trim()}`;

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              pendingList.push({
                key,
                roomNumber: cleanRoom,
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

      setItems(pendingList);
    } catch (err) {
      console.warn('Failed to load pending inspections notification:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingInspections();
    const interval = setInterval(fetchPendingInspections, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectRoom = (item: PendingInspectionItem) => {
    setIsOpen(false);
    navigate(`/form?room=${encodeURIComponent(item.roomNumber)}&property=${encodeURIComponent(item.propertyName)}`);
  };

  const propertyCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.propertyName] = (acc[item.propertyName] || 0) + 1;
    return acc;
  }, {});

  const filteredItems = selectedPropertyFilter === 'all'
    ? items
    : items.filter((it) => it.propertyName.toLowerCase() === selectedPropertyFilter.toLowerCase());

  const getPropertyBadgeStyle = (propName: string) => {
    const p = propName.toLowerCase();
    if (p.includes('serangoon')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (p.includes('vagabond')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    }
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchPendingInspections();
        }}
        className={`relative p-2 rounded-xl transition-all cursor-pointer ${
          isOpen
            ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400'
            : items.length > 0
            ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        }`}
        title={`${items.length} Room(s) awaiting Inspector verification`}
      >
        <Bell className="w-5 h-5" />
        {items.length > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black shadow-md border-2 border-white">
              {items.length}
            </span>
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] rounded-full bg-rose-400 animate-ping opacity-75" />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-wider uppercase">Pending Inspections</h4>
                <p className="text-[10px] text-slate-300">
                  {items.length} room{items.length !== 1 ? 's' : ''} awaiting inspector sign-off
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchPendingInspections}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Property Filter Tabs */}
          {items.length > 0 && Object.keys(propertyCounts).length > 1 && (
            <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedPropertyFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedPropertyFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                All ({items.length})
              </button>
              {Object.entries(propertyCounts).map(([prop, count]) => (
                <button
                  key={prop}
                  type="button"
                  onClick={() => setSelectedPropertyFilter(prop)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedPropertyFilter === prop
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {prop.replace('House', '').replace('Club', '').trim()} ({count})
                </button>
              ))}
            </div>
          )}

          {/* Room Items List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h5 className="font-bold text-xs text-slate-800">All Rooms Inspected</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  There are no submitted forms awaiting inspection for this filter.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleSelectRoom(item)}
                  className="p-3 hover:bg-amber-50/50 transition cursor-pointer group flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900 group-hover:text-blue-700 transition">
                        Room {item.roomNumber}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPropertyBadgeStyle(item.propertyName)}`}>
                        <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                        <span>{item.propertyName}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{item.technician || 'Technician'}</span>
                      </span>
                      {item.rpmDate && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>{item.rpmDate}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition">
                    <span className="hidden sm:inline">Inspect</span>
                    <ChevronRight className="w-4 h-4 text-blue-500" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            <span className="text-[10px] text-slate-500">
              Click any room to open checklist and sign-off
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
