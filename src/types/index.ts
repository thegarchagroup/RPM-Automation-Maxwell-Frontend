export type UserRole = 'inspector' | 'supervisor' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface Room {
  id: number;
  room_number: string;
  room_type: string;
  floor?: string;
  property_name: string;
  is_active: boolean;
  latest_inspection_status?: 'in_progress' | 'submitted' | 'verified' | null;
  latest_inspection_id?: number | null;
}

export interface ChecklistItem {
  id: number;
  section_id: number;
  item_no: number;
  description: string;
  sort_order: number;
}

export interface Section {
  id: number;
  template_id: number;
  code: string;
  title: string;
  sort_order: number;
  items: ChecklistItem[];
}

export interface Template {
  id: number;
  property_name: string;
  title: string;
  header_fields: string[];
  footer_fields: string[];
  version: number;
  is_active: boolean;
  sections: Section[];
}

export type InspectionItemResult = 'pass' | 'fail' | 'na';

export interface InspectionItem {
  id: number;
  inspection_id: number;
  checklist_item_id: number;
  result: InspectionItemResult | null;
  remark: string | null;
  photo_url: string | null;
  checklist_item?: ChecklistItem;
}

export type InspectionStatus = 'in_progress' | 'submitted' | 'verified';

export interface Inspection {
  id: number;
  room_id: number;
  template_id: number;
  inspector_id: number;
  status: InspectionStatus;
  started_at: string;
  submitted_at?: string | null;
  header_values: Record<string, any>;
  overall_remark?: string | null;
  signature_url?: string | null;
  verified_by_id?: number | null;
  verified_at?: string | null;
  pdf_url?: string | null;
  room?: Room;
  inspector_name?: string | null;
  verified_by_name?: string | null;
  items: InspectionItem[];
}
