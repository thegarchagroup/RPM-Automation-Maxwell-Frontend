const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface RpmRecord {
  id: number;
  property_name: string;
  year: number;
  quarter: string;
  floor: string;
  category: string;
  room_or_area: string;
  eng_date: string | null;
  ac_servicing: string | null;
  housekeeping: string | null;
  inspection_status: string; // "Done" | "Pending" | "In Progress"
  remarks?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FloorStats {
  floor: string;
  total: number;
  completed: number;
  pending: number;
  completion_rate: number;
}

export interface DashboardStats {
  property_name: string;
  quarter: string;
  year: number;
  total_units: number;
  total_rooms: number;
  total_public_areas: number;
  completed_count: number;
  pending_count: number;
  overall_completion_rate: number;
  floor_stats: FloorStats[];
  recent_completed: RpmRecord[];
}

export interface FloorMatrixResponse {
  property_name: string;
  quarter: string;
  year: number;
  floors: Record<string, RpmRecord[]>;
}

// Headers helper
function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Dashboard Stats
  async getDashboardStats(params?: {
    property_name?: string;
    quarter?: string;
    year?: number;
  }): Promise<DashboardStats> {
    const query = new URLSearchParams();
    if (params?.property_name) query.append('property_name', params.property_name);
    if (params?.quarter) query.append('quarter', params.quarter);
    if (params?.year) query.append('year', String(params.year));

    const res = await fetch(`${API_BASE}/rpm/dashboard-stats?${query.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard stats (${res.status})`);
    }
    return res.json();
  },

  // Floor Matrix for 4-column side-by-side view
  async getFloorMatrix(): Promise<FloorMatrixResponse> {
    const res = await fetch(`${API_BASE}/rpm/matrix`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch floor matrix (${res.status})`);
    }
    return res.json();
  },

  // Filterable list of RPM records
  async getRpmRecords(filters?: {
    floor?: string;
    category?: string;
    status?: string;
    search?: string;
    year?: number;
    quarter?: string;
  }): Promise<RpmRecord[]> {
    const query = new URLSearchParams();
    if (filters?.floor && filters.floor !== 'all') query.append('floor', filters.floor);
    if (filters?.category && filters.category !== 'all') query.append('category', filters.category);
    if (filters?.status && filters.status !== 'all') query.append('status', filters.status);
    if (filters?.search) query.append('search', filters.search);
    if (filters?.year) query.append('year', String(filters.year));
    if (filters?.quarter) query.append('quarter', filters.quarter);

    const res = await fetch(`${API_BASE}/rpm/records?${query.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch RPM records (${res.status})`);
    }
    return res.json();
  },

  // Update an RPM record (e.g. toggle Done/Pending or change dates)
  async updateRpmRecord(id: number, data: Partial<RpmRecord>): Promise<RpmRecord> {
    const res = await fetch(`${API_BASE}/rpm/records/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to update RPM record (${res.status})`);
    }
    return res.json();
  },

  // Reseed data from CSV file
  async reseedRpmData(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/rpm/seed`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to reseed database (${res.status})`);
    }
    return res.json();
  },

  // Submit official inspection report
  async submitInspection(data: {
    room_number: string;
    room_type: string;
    inspection_date: string;
    status: string;
    maintenance_carried_by?: string;
    inspected_by?: string;
    signature_url?: string | null;
    overall_remark?: string;
    items: Array<{ checklist_item_id: number; result: string; remark?: string | null }>;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/inspections/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to submit inspection to backend (${res.status})`);
    }
    return res.json();
  },

  // Backend Authentication Login
  async login(email: string): Promise<{ access_token: string; user: any }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      throw new Error(`Login failed (${res.status})`);
    }
    return res.json();
  },

  // Dropbox Cloud Storage Integration
  async getDropboxStatus(): Promise<{
    configured: boolean;
    app_key_present: boolean;
    has_token: boolean;
    target_folder: string;
  }> {
    const res = await fetch(`${API_BASE}/dropbox/status`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to check Dropbox status (${res.status})`);
    }
    return res.json();
  },

  async uploadPdfToDropbox(
    file: Blob,
    filename: string,
    metadata?: { room_number?: string; quarter?: string; year?: number }
  ): Promise<{
    success: boolean;
    message: string;
    path: string;
    size: number;
    share_url?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file, filename);
    if (metadata?.room_number) formData.append('room_number', metadata.room_number);
    if (metadata?.quarter) formData.append('quarter', metadata.quarter);
    if (metadata?.year) formData.append('year', String(metadata.year));
    if (filename) formData.append('filename', filename);

    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/dropbox/upload-pdf`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Dropbox upload failed (${res.status})`);
    }
    return res.json();
  },
};
