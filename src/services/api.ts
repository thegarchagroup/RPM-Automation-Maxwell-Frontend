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
  rpm_date?: string | null;
  ac_servicing: string | null;
  housekeeping: string | null;
  inspection_status: string; // "Done" | "Pending" | "In Progress"
  inspection_date?: string | null;
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
    property_name?: string;
    floor?: string;
    category?: string;
    status?: string;
    search?: string;
    year?: number;
    quarter?: string;
  }): Promise<RpmRecord[]> {
    const query = new URLSearchParams();
    if (filters?.property_name && filters.property_name !== 'all') query.append('property_name', filters.property_name);
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

  // Create an RPM record
  async createRpmRecord(data: Partial<RpmRecord>): Promise<RpmRecord> {
    const res = await fetch(`${API_BASE}/rpm/records`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to create RPM record (${res.status})`);
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

  // Submit official inspection report
  async submitInspection(data: {
    room_number: string;
    room_type: string;
    inspection_date: string;
    property_name?: string;
    quarter?: string;
    status: string;
    maintenance_carried_by?: string;
    inspected_by?: string;
    signature_url?: string | null;
    inspected_by_signature_url?: string | null;
    overall_remark?: string;
    inspector_remark?: string;
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

  // Update inspection report (Inspector verification or Admin edits)
  async updateInspection(
    id: number,
    data: {
      room_number?: string;
      room_type?: string;
      inspection_date?: string;
      property_name?: string;
      quarter?: string;
      status?: string;
      maintenance_carried_by?: string;
      inspected_by?: string;
      signature_url?: string | null;
      inspected_by_signature_url?: string | null;
      overall_remark?: string;
      inspector_remark?: string;
      items?: Array<{ checklist_item_id: number; result: string; remark?: string | null }>;
    }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/inspections/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to update inspection (${res.status})`);
    }
    return res.json();
  },

  // List inspections
  async getInspections(filters?: {
    room_number?: string;
    property_name?: string;
    quarter?: string;
    status?: string;
  }): Promise<any[]> {
    const query = new URLSearchParams();
    if (filters?.room_number) query.append('room_number', filters.room_number);
    if (filters?.property_name) query.append('property_name', filters.property_name);
    if (filters?.quarter) query.append('quarter', filters.quarter);
    if (filters?.status) query.append('status', filters.status);

    const res = await fetch(`${API_BASE}/inspections/?${query.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch inspections (${res.status})`);
    }
    return res.json();
  },

  // Get single inspection by id
  async getInspection(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/inspections/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch inspection (${res.status})`);
    }
    return res.json();
  },

  // Admin User Management: List users
  async getUsers(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch users (${res.status})`);
    }
    return res.json();
  },

  // Admin User Management: Create new user
  async createUser(data: {
    email: string;
    full_name: string;
    role: string;
    password?: string;
    is_active?: boolean;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...data,
        password: data.password || 'password123',
        is_active: data.is_active !== undefined ? data.is_active : true,
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to create user (${res.status})`);
    }
    return res.json();
  },

  // Admin User Management: Update user
  async updateUser(
    userId: number,
    data: {
      email?: string;
      full_name?: string;
      role?: string;
      password?: string;
      is_active?: boolean;
    }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to update user (${res.status})`);
    }
    return res.json();
  },

  // Admin User Management: Delete user
  async deleteUser(userId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to delete user (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Get Maxwell template with all sections and items
  async getTemplate(): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/maxwell`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch checklist template (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Update template metadata
  async updateTemplate(data: {
    title?: string;
    property_name?: string;
    header_fields?: string[];
    footer_fields?: string[];
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/maxwell`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to update template (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Reset template to default
  async resetTemplate(): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/maxwell/reset`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to reset template (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Add Section
  async addSection(data: { code: string; title: string; sort_order?: number }): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/maxwell/sections`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to add section (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Update Section
  async updateSection(
    sectionId: number,
    data: { code?: string; title?: string; sort_order?: number }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/sections/${sectionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to update section (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Delete Section
  async deleteSection(sectionId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/sections/${sectionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to delete section (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Add Checklist Item
  async addChecklistItem(
    sectionId: number,
    data: { item_no?: number; description: string; sort_order?: number }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/sections/${sectionId}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to add checklist item (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Update Checklist Item
  async updateChecklistItem(
    itemId: number,
    data: { item_no?: number; description?: string; sort_order?: number }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/items/${itemId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to update checklist item (${res.status})`);
    }
    return res.json();
  },

  // Form Structure: Delete Checklist Item
  async deleteChecklistItem(itemId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/items/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to delete checklist item (${res.status})`);
    }
    return res.json();
  },

  // Backend Authentication Login
  async login(credentials: { role?: string; email?: string; password?: string } | string): Promise<{ access_token: string; user: any }> {
    const payload = typeof credentials === 'string' ? { email: credentials, password: '' } : credentials;
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || `Login failed (${res.status})`);
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
    metadata?: { room_number?: string; quarter?: string; year?: number; document_type?: string; status?: string }
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
    if (metadata?.document_type) formData.append('document_type', metadata.document_type);
    if (metadata?.status) formData.append('status', metadata.status);
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

  // Get a temporary download link for an inspection PDF from Dropbox
  async getDropboxDownloadLink(params: {
    room_number: string;
    inspection_date: string;
    year: number;
    quarter?: string;
    document_type?: string;
  }): Promise<{ success: boolean; download_url: string; filename: string; path: string }> {
    const query = new URLSearchParams();
    query.append('room_number', params.room_number);
    query.append('inspection_date', params.inspection_date);
    query.append('year', String(params.year));
    if (params.quarter) query.append('quarter', params.quarter);
    if (params.document_type) query.append('document_type', params.document_type);

    const res = await fetch(`${API_BASE}/dropbox/download-link?${query.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to get download link (${res.status})`);
    }
    return res.json();
  },

  // Download inspection PDF directly from Dropbox via backend proxy
  async downloadDropboxPdf(params: {
    room_number: string;
    inspection_date: string;
    year: number;
    quarter?: string;
    document_type?: string;
  }): Promise<{ blob: Blob; filename: string }> {
    const query = new URLSearchParams();
    query.append('room_number', params.room_number);
    query.append('inspection_date', params.inspection_date);
    query.append('year', String(params.year));
    if (params.quarter) query.append('quarter', params.quarter);
    if (params.document_type) query.append('document_type', params.document_type);

    const res = await fetch(`${API_BASE}/dropbox/download?${query.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.detail || `Failed to download PDF (${res.status})`);
    }

    let filename = `${params.document_type || 'Report'}_${params.room_number}.pdf`;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await res.blob();
    return { blob, filename };
  },
};