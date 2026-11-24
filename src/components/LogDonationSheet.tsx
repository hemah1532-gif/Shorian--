import React, { useEffect, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import type { Donor, Language } from '../types';
import { t } from '../i18n';
import { getTodayIso } from '../utils/eligibility';

interface LogDonationSheetProps {
  donor: Donor | null;
  lang: Language;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (donor: Donor, newDate: string) => Promise<void>;
}

export const LogDonationSheet: React.FC<LogDonationSheetProps> = ({
  donor,
  lang,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const copy = t(lang);
  const [date, setDate] = useState(getTodayIso());

  useEffect(() => {
    setDate(getTodayIso());
  }, [donor]);

  if (!donor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    await onConfirm(donor, date);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <CalendarPlus className="w-5 h-5 text-rose-700" />
            <h2 className="text-base font-semibold text-slate-900">
              {copy.logDonationTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.cancelBtn}
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-1">
            <p className="font-semibold text-slate-900">
              {donor.name} · <span className="font-mono-tabular text-rose-700">{donor.bloodType}</span>
            </p>
            <p className="text-slate-600 leading-relaxed">{copy.logDonationDesc}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {copy.newDonationDate} *
            </label>
            <input
              type="date"
              required
              max={getTodayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:border-rose-700"
            />
          </div>

          {donor.donationHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">
                {copy.donationHistoryTitle}
              </p>
              <div className="text-xs text-slate-500 font-mono-tabular flex flex-wrap gap-x-2 gap-y-1">
                {donor.donationHistory.slice(0, 6).map((d, idx) => (
                  <span key={`${d}-${idx}`}>
                    {d}
                    {idx < Math.min(donor.donationHistory.length, 6) - 1 ? ' ·' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {isSubmitting ? copy.savingBtn : copy.confirmDonationBtn}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              {copy.cancelBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
