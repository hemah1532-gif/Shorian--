import React, { useState } from 'react';
import {
  Bell,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Sparkles,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type { Donor, DonorNotification, Language, NotificationStatus } from '../types';
import { t } from '../i18n';
import { calculateThreeMonthEligibility } from '../utils/eligibility';

interface DonorPortalViewProps {
  myDonor: Donor | null;
  notifications: DonorNotification[];
  lang: Language;
  isRechecking: boolean;
  respondingId: string | null;
  onRegisterNow: () => void;
  onEditProfile: (donor: Donor) => void;
  onLogDonation: (donor: Donor) => void;
  onRecheckAi: (donor: Donor) => void;
  onRespondNotification: (
    notificationId: string,
    status: Exclude<NotificationStatus, 'pending'>,
    replyNote: string
  ) => Promise<void>;
}

export const DonorPortalView: React.FC<DonorPortalViewProps> = ({
  myDonor,
  notifications,
  lang,
  isRechecking,
  respondingId,
  onRegisterNow,
  onEditProfile,
  onLogDonation,
  onRecheckAi,
  onRespondNotification,
}) => {
  const copy = t(lang);
  const [replyNotes, setReplyNotes] = useState<Record<string, string>>({});

  if (!myDonor) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
          <UserPlus className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.noDonorProfileTitle}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {copy.noDonorProfileDesc}
          </p>
        </div>
        <button
          type="button"
          onClick={onRegisterNow}
          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 transition-colors"
        >
          {copy.roleDonorCta}
        </button>
      </section>
    );
  }

  const liveCalc = calculateThreeMonthEligibility(myDonor.lastDonationDate);
  const isAvailable = liveCalc.isAvailable;
  const myNotifications = notifications.filter((n) => n.donorId === myDonor.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: My Donor Profile Card */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-rose-700 text-white flex items-center justify-center font-mono-tabular text-xl font-bold shrink-0">
              {myDonor.bloodType}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{copy.myProfileBanner}</p>
              <h2 className="text-lg font-bold text-slate-900 truncate mt-0.5">
                {myDonor.name}
              </h2>
              <p className="text-xs text-slate-500 mt-1 flex items-center flex-wrap gap-x-1.5">
                <span className="font-mono-tabular">
                  {myDonor.age} {copy.donorAge}
                </span>
                <span aria-hidden="true">·</span>
                <span>{myDonor.gender === 'male' ? copy.male : copy.female}</span>
                <span aria-hidden="true">·</span>
                <span>{myDonor.location}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEditProfile(myDonor)}
            aria-label={copy.editDonor}
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`rounded-xl px-4 py-3 border text-xs flex items-start gap-2.5 ${
            isAvailable
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
              : 'bg-amber-50/80 border-amber-200/80 text-amber-950'
          }`}
        >
          {isAvailable ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <p className="font-semibold">
              {isAvailable ? copy.statusAvailable : copy.statusUnavailable}
            </p>
            {!isAvailable && (
              <p className="text-[11px] opacity-90 font-mono-tabular">
                {copy.daysRemaining}: {liveCalc.daysRemaining} {copy.daysUnit} ·{' '}
                {copy.nextEligible}: {myDonor.nextEligibleDate || liveCalc.nextEligibleDate}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div>
            <span className="text-slate-500 block">{copy.lastDonation}</span>
            <span className="font-mono-tabular font-medium text-slate-900 mt-0.5 block">
              {myDonor.lastDonationDate || copy.neverDonated}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">{copy.donationsCount}</span>
            <span className="font-mono-tabular font-medium text-slate-900 mt-0.5 block">
              {myDonor.donationHistory.length}
            </span>
          </div>
        </div>

        {myDonor.aiEligibilityNote && (
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
            <span className="font-medium text-slate-800">{copy.aiNoteLabel}: </span>
            <span>{myDonor.aiEligibilityNote}</span>
          </div>
        )}

        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLogDonation(myDonor)}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-700 text-white text-xs sm:text-sm font-medium hover:bg-rose-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4 shrink-0" />
            <span>{copy.addNewDonation}</span>
          </button>

          <button
            type="button"
            onClick={() => onRecheckAi(myDonor)}
            disabled={isRechecking}
            title={copy.recheckAi}
            aria-label={copy.recheckAi}
            className="min-h-[48px] min-w-[48px] rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* Right: Incoming Blood Request Notifications Inbox */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-rose-700" />
            <span>{copy.notificationsInboxTitle}</span>
          </h3>
          <span className="text-xs font-mono-tabular text-slate-500">
            {myNotifications.length}
          </span>
        </div>

        {myNotifications.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-6 text-center text-xs sm:text-sm text-slate-600 leading-relaxed">
            {copy.notificationsInboxEmpty}
          </div>
        ) : (
          <div className="space-y-3">
            {myNotifications.map((notif) => {
              const isBusy = respondingId === notif.id;
              return (
                <article
                  key={notif.id}
                  className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-[#F8F9FA]/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono-tabular font-bold text-sm text-rose-700">
                          {copy.notifNeededFor}: {notif.neededBloodType}
                        </span>
                        <span className="text-xs text-slate-500">
                          ·{' '}
                          {notif.urgency === 'critical'
                            ? copy.urgencyCritical
                            : notif.urgency === 'urgent'
                              ? copy.urgencyUrgent
                              : copy.urgencyNormal}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {notif.requesterName || notif.location}
                      </p>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {copy.notifLocation}: {notif.location}
                        </span>
                      </p>
                      {notif.notes && (
                        <p className="text-xs text-slate-600 pt-1">{notif.notes}</p>
                      )}
                    </div>
                  </div>

                  {notif.status === 'pending' ? (
                    <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
                      <input
                        type="text"
                        maxLength={250}
                        value={replyNotes[notif.id] || ''}
                        onChange={(e) =>
                          setReplyNotes((prev) => ({
                            ...prev,
                            [notif.id]: e.target.value,
                          }))
                        }
                        placeholder={copy.notifReplyNotePlaceholder}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            onRespondNotification(
                              notif.id,
                              'accepted',
                              replyNotes[notif.id] || ''
                            )
                          }
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{copy.notifAcceptBtn}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            onRespondNotification(
                              notif.id,
                              'declined',
                              replyNotes[notif.id] || ''
                            )
                          }
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4 text-slate-500" />
                          <span>{copy.notifDeclineBtn}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-xl px-3.5 py-2.5 border text-xs flex items-center justify-between gap-2 ${
                        notif.status === 'accepted'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {notif.status === 'accepted' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span>
                          {notif.status === 'accepted'
                            ? copy.notifYouRepliedAccepted
                            : copy.notifYouRepliedDeclined}
                          {notif.replyNote ? ` · ${notif.replyNote}` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
