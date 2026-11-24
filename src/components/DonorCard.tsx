import React from 'react';
import {
  Bell,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { Donor, DonorNotification, Language } from '../types';
import { t } from '../i18n';
import { calculateThreeMonthEligibility } from '../utils/eligibility';

interface DonorCardProps {
  donor: Donor;
  latestNotification?: DonorNotification;
  lang: Language;
  isRechecking: boolean;
  isNotifying: boolean;
  onNotifyDonor: (donor: Donor) => void;
  onLogDonation: (donor: Donor) => void;
  onEdit: (donor: Donor) => void;
  onDelete: (donor: Donor) => void;
  onRecheckAi: (donor: Donor) => void;
}

export const DonorCard: React.FC<DonorCardProps> = ({
  donor,
  latestNotification,
  lang,
  isRechecking,
  isNotifying,
  onNotifyDonor,
  onLogDonation,
  onEdit,
  onDelete,
  onRecheckAi,
}) => {
  const copy = t(lang);
  const liveCalc = calculateThreeMonthEligibility(donor.lastDonationDate);
  const isAvailable = liveCalc.isAvailable;
  const nextEligible = donor.nextEligibleDate || liveCalc.nextEligibleDate;

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors hover:border-slate-300">
      <div className="space-y-3.5">
        {/* Top Row: Blood Type Square + Donor Name & Unboxed Metadata */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 flex items-center justify-center shrink-0 font-mono-tabular text-lg font-bold tracking-tight"
              aria-label={`${copy.fieldBloodType}: ${donor.bloodType}`}
            >
              {donor.bloodType}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">
                {donor.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                <span className="font-mono-tabular">
                  {donor.age} {copy.donorAge}
                </span>
                <span aria-hidden="true">·</span>
                <span>{donor.gender === 'male' ? copy.male : copy.female}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[180px]">{donor.location}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Explicit Status Row */}
        <div
          className={`rounded-xl px-3.5 py-2.5 border text-xs flex items-start gap-2.5 ${
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
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {isAvailable ? copy.statusAvailable : copy.statusUnavailable}
            </p>
            {!isAvailable && (
              <p className="text-[11px] opacity-90 mt-0.5 font-mono-tabular">
                {copy.daysRemaining}: {liveCalc.daysRemaining} {copy.daysUnit} ·{' '}
                {copy.nextEligible}: {nextEligible}
              </p>
            )}
          </div>
        </div>

        {/* Notification Reply Status if notified */}
        {latestNotification && (
          <div
            className={`rounded-xl px-3.5 py-2 border text-xs flex items-center gap-2 ${
              latestNotification.status === 'accepted'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : latestNotification.status === 'declined'
                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {latestNotification.status === 'accepted' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            ) : latestNotification.status === 'declined' ? (
              <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            )}
            <span className="truncate">
              {latestNotification.status === 'accepted'
                ? copy.notifiedAccepted
                : latestNotification.status === 'declined'
                  ? copy.notifiedDeclined
                  : copy.notifiedPending}
            </span>
          </div>
        )}

        {/* Unboxed Donation Metadata Row */}
        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
          <div>
            <span className="text-slate-500 block">{copy.lastDonation}</span>
            <span className="font-mono-tabular font-medium text-slate-900 mt-0.5 block">
              {donor.lastDonationDate || copy.neverDonated}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">{copy.donationsCount}</span>
            <span className="font-mono-tabular font-medium text-slate-900 mt-0.5 block">
              {donor.donationHistory.length}
            </span>
          </div>
        </div>

        {donor.phone && (
          <div className="flex items-center gap-2 text-xs text-slate-600 font-mono-tabular">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <a
              href={`tel:${donor.phone}`}
              className="hover:text-rose-700 transition-colors underline-offset-2 hover:underline"
              dir="ltr"
            >
              {donor.phone}
            </a>
          </div>
        )}

        {/* AI Eligibility Note */}
        {donor.aiEligibilityNote && (
          <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
            <span className="font-medium text-slate-800">{copy.aiNoteLabel}: </span>
            <span>{donor.aiEligibilityNote}</span>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        {isAvailable && (
          <button
            type="button"
            disabled={isNotifying}
            onClick={() => onNotifyDonor(donor)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>{copy.notifyDonorBtn}</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onLogDonation(donor)}
            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4 shrink-0" />
            <span className="truncate">{copy.addNewDonation}</span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onRecheckAi(donor)}
              disabled={isRechecking}
              title={copy.recheckAi}
              aria-label={copy.recheckAi}
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onEdit(donor)}
              title={copy.editDonor}
              aria-label={copy.editDonor}
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(donor)}
              title={copy.deleteDonor}
              aria-label={copy.deleteDonor}
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
