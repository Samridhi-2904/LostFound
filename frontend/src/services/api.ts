import type {
  User,
  ItemReport,
  Category,
  CustodyLocation,
  Claim,
  ReturnRecord,
  NotificationItem,
  DashboardStats,
  SearchReportsParams,
  PaginatedResponse,
  UserRole
} from '../types';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Token storage helpers
const TOKEN_KEY = 'findit_access_token';
const LAST_ACTIVITY_KEY = 'findit_last_activity';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (NFR-03)

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  // Inactivity check
  const lastActiveStr = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (lastActiveStr) {
    const elapsed = Date.now() - parseInt(lastActiveStr, 10);
    if (elapsed > INACTIVITY_TIMEOUT_MS) {
      clearStoredToken();
      return null;
    }
  }

  // Record active heartbeat
  recordActivity();
  return token;
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  recordActivity();
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function recordActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

// Activity listeners to maintain session validity during interaction
if (typeof window !== 'undefined') {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach((ev) => {
    window.addEventListener(ev, () => {
      if (localStorage.getItem(TOKEN_KEY)) {
        recordActivity();
      }
    }, { passive: true });
  });
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    // Dispatch custom event so context can sync
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(401, 'Session expired or invalid. Please sign in again.');
  }

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred.';
    let errData = null;
    try {
      errData = await response.json();
      if (typeof errData.detail === 'string') {
        errorDetail = errData.detail;
      } else if (Array.isArray(errData.detail)) {
        errorDetail = errData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      }
    } catch {
      errorDetail = response.statusText || `Request failed with status ${response.status}`;
    }
    throw new ApiError(response.status, errorDetail, errData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth Endpoints
export const authApi = {
  async register(data: { email: string; password: string; full_name: string; phone_number?: string }): Promise<User> {
    return request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone_number || undefined,
      }),
    });
  },

  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const res = await request<{ access_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.access_token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearStoredToken();
    }
  },

  async getCurrentUser(): Promise<User> {
    return request<User>('/auth/me');
  },

  async updateProfile(data: { full_name?: string; phone_number?: string; password?: string }): Promise<User> {
    return request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// Category Endpoints
export const categoryApi = {
  async getCategories(): Promise<Category[]> {
    const list = await request<Category[]>('/categories');
    return list.map((c) => ({
      ...c,
      name: c.category_name || c.name || '',
      category_name: c.category_name || c.name || '',
    }));
  },
  async getAdminCategories(): Promise<Category[]> {
    const list = await request<Category[]>('/admin/categories');
    return list.map((c) => ({
      ...c,
      name: c.category_name || c.name || '',
      category_name: c.category_name || c.name || '',
    }));
  },
  async createCategory(data: { name?: string; category_name?: string; description?: string }): Promise<Category> {
    const payload = {
      category_name: data.category_name || data.name || '',
      description: data.description,
    };
    const c = await request<Category>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { ...c, name: c.category_name || c.name, category_name: c.category_name || c.name };
  },
  async updateCategory(id: number, data: { name?: string; category_name?: string; description?: string; is_active?: boolean }): Promise<Category> {
    const payload: any = {
      description: data.description,
      is_active: data.is_active,
    };
    if (data.category_name || data.name) {
      payload.category_name = data.category_name || data.name;
    }
    const c = await request<Category>(`/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return { ...c, name: c.category_name || c.name, category_name: c.category_name || c.name };
  },
};

// Custody Location Endpoints
export const custodyApi = {
  async getPublicLocations(): Promise<CustodyLocation[]> {
    return request<CustodyLocation[]>('/custody-locations');
  },
  async getAdminLocations(): Promise<CustodyLocation[]> {
    return request<CustodyLocation[]>('/admin/custody-locations');
  },
  async createLocation(data: { name?: string; facility_name?: string; building?: string; room_number?: string; description?: string; restricted_details?: string }): Promise<CustodyLocation> {
    const locName = data.name || data.facility_name || 'Main Campus Custody';
    const locDesc = data.description || (data.building ? `${data.building} ${data.room_number || ''}`.trim() : 'Campus storage location');
    return request<CustodyLocation>('/admin/custody-locations', {
      method: 'POST',
      body: JSON.stringify({
        name: locName,
        description: locDesc,
        restricted_details: data.restricted_details || 'Restricted staff locker area',
      }),
    });
  },
};

// Reports Endpoints
// Normalizer: maps backend field names to frontend ItemReport shape
function normalizeReport(raw: any): ItemReport {
  return {
    ...raw,
    title: raw.title || raw.item_name || 'Untitled',
    description: raw.description || '',
    location_approximate: raw.location_approximate || raw.location || '',
    date_incident: raw.date_incident || raw.date_lost_found || raw.date_reported || '',
    primary_colour: raw.primary_colour || raw.colour || null,
    brand: raw.brand || null,
    model: raw.model || null,
    is_high_value: raw.is_high_value ?? false,
    images: raw.images || [],
    updated_at: raw.updated_at || raw.created_at || '',
    category: raw.category || (raw.category_name ? { category_id: raw.category_id, name: raw.category_name, category_name: raw.category_name, is_active: true } : null),
    // found subtype
    custody_location_id: raw.custody_location_id || raw.found_item?.custody_location_id || null,
    custody_location: raw.custody_location || (raw.found_item?.custody_location_name ? { name: raw.found_item.custody_location_name, facility_name: raw.found_item.custody_location_name, is_active: true } : null),
    storage_reference: raw.storage_reference || null,
    // lost subtype
    possible_locations: raw.possible_locations || raw.lost_item?.last_seen_location || null,
    reward_offered: raw.reward_offered ?? raw.lost_item?.reward_offered ?? null,
  };
}

function serializeReportPayload(data: any): any {
  if (!data) return data;
  const payload: any = {};

  if (data.report_type) payload.report_type = data.report_type;
  if (data.category_id !== undefined && data.category_id !== '') {
    payload.category_id = Number(data.category_id);
  }

  const title = data.item_name || data.title;
  if (title) payload.item_name = title;

  if (data.description !== undefined) payload.description = data.description;

  const dateVal = data.date_lost_found || data.date_incident;
  if (dateVal) {
    try {
      payload.date_lost_found = new Date(dateVal).toISOString();
    } catch {
      payload.date_lost_found = dateVal;
    }
  }

  const loc = data.location || data.location_approximate;
  if (loc) payload.location = loc;

  const col = data.colour || data.primary_colour;
  if (col) payload.colour = col;

  if (data.brand) payload.brand = data.brand;

  let marks = data.distinguishing_marks;
  if (data.model) {
    marks = marks ? `${marks} [Model: ${data.model}]` : `Model: ${data.model}`;
  }
  if (marks) payload.distinguishing_marks = marks;

  if (data.contact_preference) payload.contact_preference = data.contact_preference;
  if (data.contact_info_restricted) payload.contact_info_restricted = data.contact_info_restricted;

  // Subtypes
  const lastSeen = data.last_seen_location || data.possible_locations;
  if (lastSeen) payload.last_seen_location = lastSeen;

  if (data.reward_offered !== undefined && data.reward_offered !== null && data.reward_offered !== '') {
    payload.reward_offered = String(data.reward_offered).startsWith('$')
      ? String(data.reward_offered)
      : `$${data.reward_offered}`;
  }

  const foundLoc = data.found_location || loc;
  if (data.report_type === 'found' && foundLoc) {
    payload.found_location = foundLoc;
  }

  if (data.custody_location_id) payload.custody_location_id = Number(data.custody_location_id);
  if (data.storage_reference) payload.storage_reference = data.storage_reference;

  return payload;
}

export const reportApi = {
  async searchReports(params: SearchReportsParams = {}): Promise<PaginatedResponse<ItemReport>> {
    const search = new URLSearchParams();
    if (params.q) search.append('q', params.q);
    if (params.report_type) search.append('report_type', params.report_type);
    if (params.category_id) search.append('category_id', params.category_id.toString());
    if (params.lifecycle_status) search.append('lifecycle_status', params.lifecycle_status);
    if (params.primary_colour) search.append('primary_colour', params.primary_colour);
    if (params.location) search.append('location', params.location);
    if (params.date_from) search.append('date_from', params.date_from);
    if (params.date_to) search.append('date_to', params.date_to);
    if (params.page) search.append('page', params.page.toString());
    if (params.page_size) search.append('page_size', params.page_size.toString());
    search.append('envelope', 'true');

    const res = await request<PaginatedResponse<any>>(`/reports?${search.toString()}`);
    return {
      ...res,
      items: (res.items || []).map(normalizeReport),
    };
  },

  async getReport(id: number): Promise<ItemReport> {
    const raw = await request<any>(`/reports/${id}`);
    return normalizeReport(raw);
  },

  async getMyReports(): Promise<ItemReport[]> {
    const list = await request<any[]>('/reports/me');
    return (list || []).map(normalizeReport);
  },

  async createReport(data: any): Promise<ItemReport> {
    const serialized = serializeReportPayload(data);
    const raw = await request<any>('/reports', {
      method: 'POST',
      body: JSON.stringify(serialized),
    });
    return normalizeReport(raw);
  },

  async updateReport(id: number, data: any): Promise<ItemReport> {
    const serialized = serializeReportPayload(data);
    const raw = await request<any>(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(serialized),
    });
    return normalizeReport(raw);
  },

  async closeReport(id: number): Promise<ItemReport> {
    const raw = await request<any>(`/reports/${id}/close`, {
      method: 'POST',
    });
    return normalizeReport(raw);
  },

  async deleteReport(id: number, reason?: string): Promise<{ message: string }> {
    const url = reason ? `/reports/${id}?reason=${encodeURIComponent(reason)}` : `/reports/${id}`;
    return request<{ message: string }>(url, {
      method: 'DELETE',
    });
  },

  async getReportHistory(id: number): Promise<any[]> {
    return request<any[]>(`/reports/${id}/history`);
  },

  async uploadImage(reportId: number, file: File, isPrimary: boolean = false): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_primary', isPrimary.toString());

    return request<any>(`/reports/${reportId}/images`, {
      method: 'POST',
      body: formData,
    });
  },

  async getReportImages(reportId: number): Promise<any[]> {
    return request<any[]>(`/reports/${reportId}/images`);
  },

  async getReportMatches(_reportId?: number): Promise<any[]> {
    return request<any[]>('/matches/me');
  },

  async deleteImage(imageId: number): Promise<void> {
    return request<void>(`/images/${imageId}`, {
      method: 'DELETE',
    });
  },
};

// Staff Moderation & Queues
export const staffApi = {
  async getPendingReports(): Promise<ItemReport[]> {
    const list = await request<any[]>('/staff/reports/pending');
    return list.map(normalizeReport);
  },
  async verifyReport(id: number, notes?: string): Promise<ItemReport> {
    const raw = await request<any>(`/staff/reports/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ reason: notes || 'Verified by staff moderation.' }),
    });
    return normalizeReport(raw);
  },
  async rejectReport(id: number, reason: string): Promise<ItemReport> {
    const raw = await request<any>(`/staff/reports/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return normalizeReport(raw);
  },
  async getStaffClaims(status?: string): Promise<Claim[]> {
    const q = status ? `?claim_status=${status}` : '';
    return request<Claim[]>(`/staff/claims${q}`);
  },
  async reviewClaim(claimId: number, decision: 'approve' | 'reject' | 'request-info', reviewNotes: string): Promise<Claim> {
    return request<Claim>(`/staff/claims/${claimId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, review_notes: reviewNotes }),
    });
  },
  async recordReturn(claimId: number, data: { recipient_confirmation: string; condition_of_item: string; notes?: string }): Promise<ReturnRecord> {
    return request<ReturnRecord>(`/staff/claims/${claimId}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async transferCustody(reportId: number, data: { new_custody_location_id: number; storage_reference?: string; reason?: string }): Promise<ItemReport> {
    return request<ItemReport>(`/staff/reports/${reportId}/custody-transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async archiveReport(reportId: number, reason: string): Promise<ItemReport> {
    return request<ItemReport>(`/staff/reports/${reportId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason, confirm: true }),
    });
  },
  async disposeReport(reportId: number, reason: string): Promise<ItemReport> {
    return request<ItemReport>(`/staff/reports/${reportId}/dispose`, {
      method: 'POST',
      body: JSON.stringify({ reason, confirm: true }),
    });
  },
  async reviewMatch(matchId: number): Promise<any> {
    return request<any>(`/staff/matches/${matchId}/review`, {
      method: 'POST',
    });
  },
  async dismissMatch(matchId: number): Promise<any> {
    return request<any>(`/staff/matches/${matchId}/dismiss`, {
      method: 'POST',
    });
  },
};

// Claims Endpoints
export const claimApi = {
  async submitClaim(reportId: number, ownershipEvidence: string): Promise<Claim> {
    return request<Claim>(`/reports/${reportId}/claims`, {
      method: 'POST',
      body: JSON.stringify({ ownership_evidence: ownershipEvidence }),
    });
  },
  async getMyClaims(): Promise<Claim[]> {
    return request<Claim[]>('/claims/me');
  },
  async getClaim(claimId: number): Promise<Claim> {
    return request<Claim>(`/claims/${claimId}`);
  },
  async respondMoreInfo(claimId: number, additionalEvidence: string): Promise<Claim> {
    return request<Claim>(`/claims/${claimId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ additional_evidence: additionalEvidence }),
    });
  },
  async cancelClaim(claimId: number): Promise<Claim> {
    return request<Claim>(`/claims/${claimId}/cancel`, {
      method: 'POST',
    });
  },
  async getReturnRecord(claimId: number): Promise<ReturnRecord> {
    return request<ReturnRecord>(`/claims/${claimId}/return`);
  },
};

// Notifications Endpoints
export const notificationApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    return request<NotificationItem[]>('/notifications');
  },
  async markAsRead(id: number): Promise<NotificationItem> {
    return request<NotificationItem>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },
  async markAllAsRead(): Promise<{ success: boolean; count: number }> {
    return request<{ success: boolean; count: number }>('/notifications/read-all', {
      method: 'POST',
    });
  },
};

// Admin Endpoints
export const adminApi = {
  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/admin/dashboard');
  },
  async getUsers(role?: UserRole): Promise<User[]> {
    const q = role ? `?role=${role}` : '';
    return request<User[]>(`/admin/users${q}`);
  },
  async updateUserRole(userId: number, role: UserRole, department?: string, deskPhone?: string): Promise<User> {
    return request<User>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, department, desk_phone: deskPhone }),
    });
  },
  async updateUserStatus(userId: number, isActive: boolean): Promise<User> {
    return request<User>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },
  async getAuditLogs(params: { action?: string; entity_type?: string; limit?: number; offset?: number } = {}): Promise<any[]> {
    const search = new URLSearchParams();
    if (params.action) search.append('action', params.action);
    if (params.entity_type) search.append('entity_type', params.entity_type);
    if (params.limit) search.append('limit', params.limit.toString());
    if (params.offset) search.append('offset', params.offset.toString());
    return request<any[]>(`/admin/audit-logs?${search.toString()}`);
  },
};
