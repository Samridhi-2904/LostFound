export type UserRole = 'user' | 'staff' | 'admin';

export interface User {
  user_id: number;
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
  staff_profile?: {
    department?: string | null;
    office_location?: string | null;
    desk_phone?: string | null;
  } | null;
}

export type ReportType = 'lost' | 'found';
export type ModerationStatus = 'pending' | 'verified' | 'rejected';
export type LifecycleStatus = 'open' | 'matched' | 'claimed' | 'returned' | 'archived' | 'disposed';

export interface Category {
  category_id: number;
  category_name?: string;
  name?: string;
  description?: string | null;
  is_active: boolean;
}

export interface CustodyLocation {
  custody_location_id?: number;
  location_id?: number;
  name?: string;
  facility_name?: string;
  building?: string;
  description?: string | null;
  room_number?: string | null;
  is_active: boolean;
  restricted_details?: string | null;
}

export interface ItemImage {
  image_id: number;
  report_id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  is_primary: boolean;
  uploaded_at: string;
}

export interface ItemReport {
  report_id: number;
  case_reference: string;
  report_type: ReportType;
  title: string;
  item_name?: string;
  description: string;
  category_id: number;
  category_name?: string;
  category?: Category | null;
  date_incident: string;
  date_lost_found?: string;
  primary_colour?: string | null;
  colour?: string | null;
  brand?: string | null;
  model?: string | null;
  location_approximate: string;
  location?: string;
  contact_info_restricted?: string | null;
  moderation_status: ModerationStatus;
  lifecycle_status: LifecycleStatus;
  is_high_value: boolean;
  creator_user_id: number;
  created_at: string;
  updated_at?: string;
  images?: ItemImage[];
  // Found subtype specific
  custody_location_id?: number | null;
  custody_location?: CustodyLocation | null;
  storage_reference?: string | null;
  found_item?: any;
  found_item_staff?: any;
  // Lost subtype specific
  possible_locations?: string | null;
  reward_offered?: number | null;
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'more_information_requested' | 'cancelled';

export interface Claim {
  claim_id: number;
  report_id: number;
  claimant_user_id: number;
  claimant?: User | null;
  ownership_evidence?: string;
  claim_status: ClaimStatus;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewer_user_id?: number | null;
  review_notes?: string | null;
  report?: ItemReport;
}

export interface ReturnRecord {
  return_id: number;
  claim_id: number;
  report_id: number;
  recipient_confirmation: string;
  condition_of_item: string;
  notes?: string | null;
  returned_at: string;
  recorded_by_user_id: number;
}

export interface NotificationItem {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_report_id?: number | null;
  related_claim_id?: number | null;
}

export interface DashboardStats {
  lifecycle_counts: {
    open: number;
    matched: number;
    claimed: number;
    returned: number;
    archived: number;
    disposed: number;
  };
  reports: {
    total: number;
    lost: number;
    found: number;
    pending_moderation: number;
  };
  claims: {
    total: number;
    pending: number;
    approved: number;
  };
  returns: {
    total: number;
  };
  users: {
    total: number;
    standard_users: number;
    staff: number;
    admins: number;
  };
}

export interface SearchReportsParams {
  q?: string;
  report_type?: ReportType;
  category_id?: number;
  lifecycle_status?: LifecycleStatus;
  primary_colour?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
