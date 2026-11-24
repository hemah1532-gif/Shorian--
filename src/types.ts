export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type Gender = 'male' | 'female';

export type Language = 'ar' | 'en';

export type Urgency = 'normal' | 'urgent' | 'critical';

export type UserRole = 'donor' | 'seeker';

export type NotificationStatus = 'pending' | 'accepted' | 'declined';

export interface Donor {
  id: string;
  name: string;
  age: number;
  bloodType: BloodType;
  gender: Gender;
  location: string;
  phone: string;
  lastDonationDate: string; // YYYY-MM-DD or '' if never donated
  donationHistory: string[];
  isAvailable: boolean;
  nextEligibleDate: string;
  aiEligibilityNote: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BloodRequest {
  id: string;
  requesterName: string;
  neededBloodType: BloodType;
  location: string;
  urgency: Urgency;
  notes: string;
  status: 'open' | 'fulfilled';
  matchedDonorIds: string[];
  aiSummary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DonorNotification {
  id: string;
  requestId: string;
  donorId: string;
  donorName: string;
  donorBloodType: BloodType;
  donorPhone: string;
  neededBloodType: BloodType;
  location: string;
  urgency: Urgency;
  requesterName: string;
  notes: string;
  status: NotificationStatus;
  replyNote: string;
  createdAt: string;
  respondedAt: string | null;
}

export interface AiMatchItem {
  donorId: string;
  matchTier: 'exact' | 'compatible';
  locationMatch: 'same' | 'nearby' | 'different';
  score: number;
  reason: string;
}

export interface AiMatchResponse {
  summary: string;
  excludedUnavailableCount: number;
  matches: AiMatchItem[];
}

export interface AiEligibilityResponse {
  isAvailable: boolean;
  nextEligibleDate: string;
  daysRemaining: number;
  note: string;
}

export interface AppServerState {
  donors: Donor[];
  requests: BloodRequest[];
  notifications: DonorNotification[];
}
