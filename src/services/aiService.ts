import type {
  AiEligibilityResponse,
  AiMatchResponse,
  BloodType,
  Donor,
  Gender,
  Language,
  Urgency,
} from '../types';
import { getTodayIso } from '../utils/eligibility';

export async function evaluateDonorEligibilityWithAi(
  donor: {
    name: string;
    age: number;
    gender: Gender;
    bloodType: BloodType;
    lastDonationDate: string;
  },
  language: Language
): Promise<AiEligibilityResponse> {
  const res = await fetch('/api/ai/eligibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      donor,
      today: getTodayIso(),
      language,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to evaluate eligibility with AI');
  }
  return data as AiEligibilityResponse;
}

export async function matchDonorsWithAi(
  request: {
    requesterName: string;
    neededBloodType: BloodType;
    location: string;
    urgency: Urgency;
    notes: string;
  },
  donors: Donor[],
  language: Language
): Promise<AiMatchResponse> {
  const res = await fetch('/api/ai/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request,
      donors: donors.map((d) => ({
        id: d.id,
        name: d.name,
        age: d.age,
        gender: d.gender,
        bloodType: d.bloodType,
        location: d.location,
        lastDonationDate: d.lastDonationDate,
        isAvailable: d.isAvailable,
        nextEligibleDate: d.nextEligibleDate,
      })),
      today: getTodayIso(),
      language,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to match donors with AI');
  }
  return data as AiMatchResponse;
}
