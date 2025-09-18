export type UserType = 'general' | 'creator' | 'factory' | 'organizer';

export interface User {
  id: string;
  email: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  is_creator: boolean;
  is_factory: boolean;
  is_verified: boolean;
  phone?: string;
  user_type: UserType;
  notification_settings?: Record<string, any>;
  privacy_settings?: Record<string, any>;
  created_at: string;
}

export interface FactoryProfile {
  id: string;
  user_id: string;
  company_name: string;
  company_address?: string;
  contact_person?: string;
  business_license?: string;
  production_capacity?: number;
  specialties?: string[];
  min_order_quantity?: number;
  lead_time_days?: number;
  quality_certifications?: string[];
  equipment_list?: string[];
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizerProfile {
  id: string;
  user_id: string;
  organization_name: string;
  organization_type?: string;
  website_url?: string;
  social_media?: Record<string, any>;
  past_events?: string[];
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithProfiles extends User {
  factory_profile?: FactoryProfile;
  organizer_profile?: OrganizerProfile;
}

// Helper type guards
export const isCreator = (user: User): boolean => user.user_type === 'creator';
export const isFactory = (user: User): boolean => user.user_type === 'factory';
export const isOrganizer = (user: User): boolean => user.user_type === 'organizer';
export const isGeneral = (user: User): boolean => user.user_type === 'general';

// Dashboard route mappings
export const DASHBOARD_ROUTES: Record<UserType, string> = {
  general: '/',
  creator: '/creator/dashboard',
  factory: '/factory/dashboard',
  organizer: '/organizer/dashboard'
} as const;