import type {
  AppServerState,
  BloodRequest,
  Donor,
  DonorNotification,
  NotificationStatus,
} from '../types';

export async function fetchServerState(): Promise<AppServerState> {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error('Failed to load server state');
  return (await res.json()) as AppServerState;
}

export async function createOrUpdateServerDonor(donor: Donor): Promise<Donor> {
  const res = await fetch('/api/donors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donor),
  });
  if (!res.ok) throw new Error('Failed to save donor on server');
  return (await res.json()) as Donor;
}

export async function patchServerDonor(
  id: string,
  patch: Partial<Donor>
): Promise<Donor> {
  const res = await fetch(`/api/donors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update donor on server');
  return (await res.json()) as Donor;
}

export async function deleteServerDonor(id: string): Promise<void> {
  const res = await fetch(`/api/donors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete donor on server');
}

export async function bulkSeedServerDonors(donors: Donor[]): Promise<Donor[]> {
  const res = await fetch('/api/donors/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donors }),
  });
  if (!res.ok) throw new Error('Failed to save sample donors');
  return (await res.json()) as Donor[];
}

export async function createServerRequest(
  request: BloodRequest
): Promise<BloodRequest> {
  const res = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error('Failed to save blood request on server');
  return (await res.json()) as BloodRequest;
}

export async function patchServerRequest(
  id: string,
  patch: Partial<BloodRequest>
): Promise<BloodRequest> {
  const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update blood request');
  return (await res.json()) as BloodRequest;
}

export async function sendDonorNotifications(payload: {
  requestId: string;
  donorIds: string[];
  neededBloodType: string;
  location: string;
  urgency: 'normal' | 'urgent' | 'critical';
  requesterName: string;
  notes: string;
}): Promise<{ created: DonorNotification[]; notifications: DonorNotification[] }> {
  const res = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to send notifications');
  return (await res.json()) as {
    created: DonorNotification[];
    notifications: DonorNotification[];
  };
}

export async function respondToNotification(
  notificationId: string,
  status: Exclude<NotificationStatus, 'pending'>,
  replyNote = ''
): Promise<DonorNotification> {
  const res = await fetch(
    `/api/notifications/${encodeURIComponent(notificationId)}/respond`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, replyNote }),
    }
  );
  if (!res.ok) throw new Error('Failed to send reply');
  return (await res.json()) as DonorNotification;
}
