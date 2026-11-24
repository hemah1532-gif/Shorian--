import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  MapPin,
  Phone,
  Search,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type {
  AiMatchResponse,
  BloodRequest,
  BloodType,
  Donor,
  DonorNotification,
  Language,
  Urgency,
} from '../types';
import { t } from '../i18n';
import { BLOOD_TYPES } from '../utils/eligibility';

interface BloodRequestPanelProps {
  donors: Donor[];
  requests: BloodRequest[];
  notifications: DonorNotification[];
  lang: Language;
  isMatching: boolean;
  isSendingNotif: boolean;
  activeRequest: BloodRequest | null;
  activeMatchResult: AiMatchResponse | null;
  aiError: string | null;
  onSubmitMatch: (payload: {
    requesterName: string;
    neededBloodType: BloodType;
    location: string;
    urgency: Urgency;
    notes: string;
  }) => Promise<void>;
  onSendNotifications: (
    request: BloodRequest,
    donorIds: string[]
  ) => Promise<void>;
  onMarkFulfilled: (req: BloodRequest) => Promise<void>;
  onRematch: (req: BloodRequest) => Promise<void>;
}

export const BloodRequestPanel: React.FC<BloodRequestPanelProps> = ({
  donors,
  requests,
  notifications,
  lang,
  isMatching,
  isSendingNotif,
  activeRequest,
  activeMatchResult,
  aiError,
  onSubmitMatch,
  onSendNotifications,
  onMarkFulfilled,
  onRematch,
}) => {
  const copy = t(lang);
  const [requesterName, setRequesterName] = useState('');
  const [neededBloodType, setNeededBloodType] = useState<BloodType>('O+');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('urgent');
  const [notes, setNotes] = useState('');
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationMsg(null);
    const trimmedLoc = location.trim().slice(0, 120);
    if (trimmedLoc.length < 2) {
      setValidationMsg(copy.validationError);
      return;
    }

    await onSubmitMatch({
      requesterName: requesterName.trim().slice(0, 100),
      neededBloodType,
      location: trimmedLoc,
      urgency,
      notes: notes.trim().slice(0, 400),
    });
  };

  const donorMap = new Map(donors.map((d) => [d.id, d]));

  const currentReq = activeRequest || requests[0] || null;
  const getNotifForDonor = (donorId: string) => {
    if (!currentReq) return undefined;
    return notifications.find(
      (n) => n.requestId === currentReq.id && n.donorId === donorId
    );
  };

  const unnotifiedMatchIds =
    activeMatchResult && currentReq
      ? activeMatchResult.matches
          .map((m) => m.donorId)
          .filter((id) => donorMap.has(id) && !getNotifForDonor(id))
      : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Request Form Column */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.requestSectionTitle}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {copy.requestSectionDesc}
          </p>
        </div>

        {validationMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
            {validationMsg}
          </div>
        )}

        {aiError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
            {copy.aiErrorBanner} {aiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {copy.neededBloodTypeLabel} *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setNeededBloodType(bt)}
                  className={`min-h-[44px] rounded-xl text-sm font-mono-tabular font-semibold border transition-colors ${
                    neededBloodType === bt
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {copy.neededLocationLabel} *
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={copy.neededLocationPlaceholder}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {copy.urgencyLabel}
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl min-h-[44px]">
              {(
                [
                  ['normal', copy.urgencyNormal],
                  ['urgent', copy.urgencyUrgent],
                  ['critical', copy.urgencyCritical],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUrgency(key)}
                  className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap px-2 ${
                    urgency === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {copy.requesterNameLabel}
            </label>
            <input
              type="text"
              maxLength={100}
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder={copy.requesterNamePlaceholder}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {copy.notesLabel}
            </label>
            <textarea
              rows={2}
              maxLength={400}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={copy.notesPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isMatching}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles className={`w-4 h-4 ${isMatching ? 'animate-spin' : ''}`} />
            <span>{isMatching ? copy.matchingAiBtn : copy.runAiMatchBtn}</span>
          </button>
        </form>
      </section>

      {/* AI Results + Live Notifications Tracker + Saved Requests */}
      <div className="lg:col-span-7 space-y-6">
        {activeMatchResult && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-rose-700" />
                <span>{copy.aiMatchResultsTitle}</span>
              </h3>
              {currentReq && unnotifiedMatchIds.length > 0 && (
                <button
                  type="button"
                  disabled={isSendingNotif}
                  onClick={() => onSendNotifications(currentReq, unnotifiedMatchIds)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{copy.notifyAllBtn}</span>
                </button>
              )}
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              {activeMatchResult.summary}
            </p>

            {activeMatchResult.excludedUnavailableCount > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 text-xs text-amber-950">
                {copy.excludedNotice}{' '}
                <strong className="font-mono-tabular">
                  {activeMatchResult.excludedUnavailableCount}
                </strong>
              </div>
            )}

            {activeMatchResult.matches.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 text-xs text-slate-600">
                {copy.noMatchesFound}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                {activeMatchResult.matches.map((item) => {
                  const donor = donorMap.get(item.donorId);
                  if (!donor) return null;
                  const sentNotif = getNotifForDonor(donor.id);

                  return (
                    <div
                      key={item.donorId}
                      className="p-4 bg-white flex flex-col gap-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 flex items-center justify-center shrink-0 font-mono-tabular font-bold text-base">
                            {donor.bloodType}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                              <span className="text-sm font-semibold text-slate-900">
                                {donor.name}
                              </span>
                              <span className="text-xs text-emerald-700 font-medium">
                                ·{' '}
                                {item.matchTier === 'exact'
                                  ? copy.exactMatchLabel
                                  : copy.compatibleMatchLabel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center flex-wrap gap-x-2">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {donor.location}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {item.locationMatch === 'same'
                                  ? copy.locationSame
                                  : item.locationMatch === 'nearby'
                                    ? copy.locationNearby
                                    : copy.locationDifferent}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {copy.matchScore}: {item.score}%
                              </span>
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {item.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {currentReq && !sentNotif && (
                            <button
                              type="button"
                              disabled={isSendingNotif}
                              onClick={() => onSendNotifications(currentReq, [donor.id])}
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>{copy.notifyDonorBtn}</span>
                            </button>
                          )}

                          {donor.phone && (
                            <a
                              href={`tel:${donor.phone}`}
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{copy.callDonor}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {sentNotif && (
                        <div
                          className={`rounded-xl px-3.5 py-2 border text-xs flex items-center justify-between gap-2 ${
                            sentNotif.status === 'accepted'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : sentNotif.status === 'declined'
                                ? 'bg-slate-100 border-slate-200 text-slate-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            {sentNotif.status === 'accepted' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            ) : sentNotif.status === 'declined' ? (
                              <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                              <Bell className="w-4 h-4 text-rose-700 shrink-0" />
                            )}
                            <span>
                              {sentNotif.status === 'accepted'
                                ? copy.notifiedAccepted
                                : sentNotif.status === 'declined'
                                  ? copy.notifiedDeclined
                                  : copy.notifiedPending}
                              {sentNotif.replyNote ? ` · ${sentNotif.replyNote}` : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Live Tracker of All Sent Notifications & Donor Replies */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-700" />
              <span>{copy.sentNotificationsTitle}</span>
            </h3>
            <span className="text-xs font-mono-tabular text-slate-500">
              {notifications.length}
            </span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500">{copy.noSentNotifications}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-tabular font-bold text-xs text-rose-700">
                        {notif.donorBloodType}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {notif.donorName}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {notif.location}
                      </span>
                    </div>
                    <p
                      className={`text-xs font-medium flex items-center gap-1.5 ${
                        notif.status === 'accepted'
                          ? 'text-emerald-700'
                          : notif.status === 'declined'
                            ? 'text-slate-600'
                            : 'text-amber-700'
                      }`}
                    >
                      {notif.status === 'accepted'
                        ? copy.notifiedAccepted
                        : notif.status === 'declined'
                          ? copy.notifiedDeclined
                          : copy.notifiedPending}
                      {notif.replyNote ? ` (${notif.replyNote})` : ''}
                    </p>
                  </div>

                  {notif.donorPhone && notif.status === 'accepted' && (
                    <a
                      href={`tel:${notif.donorPhone}`}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{copy.callDonor}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved Requests History */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            {copy.savedRequestsTitle}
          </h3>

          {requests.length === 0 ? (
            <p className="text-xs text-slate-500">{copy.noSavedRequests}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-tabular font-bold text-sm text-rose-700">
                        {req.neededBloodType}
                      </span>
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {req.requesterName || req.location}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {req.location} ·{' '}
                        {req.status === 'fulfilled'
                          ? copy.statusFulfilled
                          : copy.statusOpen}
                      </span>
                    </div>
                    {req.aiSummary && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {req.aiSummary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {req.status !== 'fulfilled' && (
                      <button
                        type="button"
                        onClick={() => onMarkFulfilled(req)}
                        className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{copy.markFulfilled}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRematch(req)}
                      disabled={isMatching}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{copy.rematchBtn}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
