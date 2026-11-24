import type { BloodType } from '../types';

export const BLOOD_TYPES: BloodType[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

export interface LocalEligibilityInfo {
  isAvailable: boolean;
  daysSinceLastDonation: number | null;
  daysRemaining: number;
  nextEligibleDate: string;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addMonthsIso(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * Enforces the 3-month interval rule:
 * Donors whose last donation was LESS than 3 months ago are unavailable;
 * 3 months or more (or never donated) is available normally.
 */
export function calculateThreeMonthEligibility(
  lastDonationDate: string,
  todayStr: string = getTodayIso()
): LocalEligibilityInfo {
  if (!lastDonationDate || !/^\d{4}-\d{2}-\d{2}$/.test(lastDonationDate)) {
    return {
      isAvailable: true,
      daysSinceLastDonation: null,
      daysRemaining: 0,
      nextEligibleDate: todayStr,
    };
  }

  const lastMs = Date.parse(`${lastDonationDate}T00:00:00Z`);
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  const threeMonthsAfter = addMonthsIso(lastDonationDate, 3);
  const eligibleDateMs = Date.parse(`${threeMonthsAfter}T00:00:00Z`); // >= 3 months is available
  const nextEligibleDate = threeMonthsAfter;

  const daysSince = Math.max(0, Math.floor((todayMs - lastMs) / 86400000));
  const isAvailable = todayMs >= eligibleDateMs;
  const daysRemaining = isAvailable
    ? 0
    : Math.max(1, Math.ceil((eligibleDateMs - todayMs) / 86400000));

  return {
    isAvailable,
    daysSinceLastDonation: daysSince,
    daysRemaining,
    nextEligibleDate,
  };
}

/**
 * Standard RBC compatibility chart: maps recipient blood type to compatible donor types.
 */
export const COMPATIBLE_DONORS_MAP: Record<BloodType, BloodType[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

export function createClientId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}
