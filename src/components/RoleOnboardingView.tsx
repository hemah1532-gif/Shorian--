import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  HeartHandshake,
  Sparkles,
} from 'lucide-react';
import type { BloodType, Gender, Language, Urgency } from '../types';
import { t } from '../i18n';
import { BLOOD_TYPES, getTodayIso } from '../utils/eligibility';
import type { DonorFormValues } from './DonorFormModal';

type SelectedRole = 'choose' | 'donor' | 'seeker';

interface RoleOnboardingViewProps {
  lang: Language;
  hasExistingDonorProfile: boolean;
  hasRegisteredSeeker: boolean;
  isSubmittingDonor: boolean;
  isMatchingSeeker: boolean;
  onRegisterDonor: (values: DonorFormValues) => Promise<void>;
  onSubmitSeekerRequest: (payload: {
    requesterName: string;
    neededBloodType: BloodType;
    location: string;
    urgency: Urgency;
    notes: string;
  }) => Promise<void>;
  onContinueAsDonor: () => void;
  onContinueAsSeeker: () => void;
}

export const RoleOnboardingView: React.FC<RoleOnboardingViewProps> = ({
  lang,
  hasExistingDonorProfile,
  hasRegisteredSeeker,
  isSubmittingDonor,
  isMatchingSeeker,
  onRegisterDonor,
  onSubmitSeekerRequest,
  onContinueAsDonor,
  onContinueAsSeeker,
}) => {
  const copy = t(lang);
  const [role, setRole] = useState<SelectedRole>('choose');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Donor Questions State
  const [name, setName] = useState('');
  const [age, setAge] = useState('26');
  const [gender, setGender] = useState<Gender>('male');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [donorLocation, setDonorLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [neverDonated, setNeverDonated] = useState(false);
  const [lastDonationDate, setLastDonationDate] = useState(getTodayIso());

  // Seeker Questions State
  const [neededBloodType, setNeededBloodType] = useState<BloodType>('O+');
  const [seekerLocation, setSeekerLocation] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('urgent');
  const [requesterName, setRequesterName] = useState('');
  const [notes, setNotes] = useState('');

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  const handleDonorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedName = name.trim().slice(0, 100);
    const parsedAge = parseInt(age, 10);
    const trimmedLoc = donorLocation.trim().slice(0, 120);

    if (
      trimmedName.length < 2 ||
      Number.isNaN(parsedAge) ||
      parsedAge < 16 ||
      parsedAge > 80 ||
      trimmedLoc.length < 2
    ) {
      setErrorMsg(copy.validationError);
      return;
    }

    await onRegisterDonor({
      name: trimmedName,
      age: parsedAge,
      bloodType,
      gender,
      location: trimmedLoc,
      phone: phone.trim().slice(0, 30),
      lastDonationDate: neverDonated ? '' : lastDonationDate,
    });
  };

  const handleSeekerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedLoc = seekerLocation.trim().slice(0, 120);
    if (trimmedLoc.length < 2) {
      setErrorMsg(copy.validationError);
      return;
    }

    await onSubmitSeekerRequest({
      requesterName: requesterName.trim().slice(0, 100),
      neededBloodType,
      location: trimmedLoc,
      urgency,
      notes: notes.trim().slice(0, 400),
    });
  };

  if (role === 'choose') {
    return (
      <section className="max-w-4xl mx-auto py-4 sm:py-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              {copy.welcomeTitle}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {copy.welcomeSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Choice 1: Blood Donor */}
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setRole('donor');
              }}
              className="group text-start bg-[#F8F9FA] hover:bg-rose-50/50 border border-slate-200 hover:border-rose-300 rounded-2xl p-6 flex flex-col justify-between gap-5 transition-colors min-h-[180px]"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-rose-700 text-white flex items-center justify-center">
                  <Droplets className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {copy.roleDonorTitle}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {copy.roleDonorDesc}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium group-hover:bg-rose-800 transition-colors w-full">
                {copy.roleDonorCta}
              </span>
            </button>

            {/* Choice 2: Blood Seeker / Request Donor */}
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setRole('seeker');
              }}
              className="group text-start bg-[#F8F9FA] hover:bg-slate-100/80 border border-slate-200 hover:border-slate-400 rounded-2xl p-6 flex flex-col justify-between gap-5 transition-colors min-h-[180px]"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {copy.roleSeekerTitle}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {copy.roleSeekerDesc}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium group-hover:bg-slate-800 transition-colors w-full">
                {copy.roleSeekerCta}
              </span>
            </button>
          </div>

          {(hasExistingDonorProfile || hasRegisteredSeeker) && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4">
              {hasExistingDonorProfile && (
                <button
                  type="button"
                  onClick={onContinueAsDonor}
                  className="min-h-[44px] px-4 text-xs font-medium text-rose-700 hover:text-rose-800 underline underline-offset-4 transition-colors"
                >
                  {copy.roleContinueAsDonor}
                </button>
              )}
              {hasRegisteredSeeker && (
                <button
                  type="button"
                  onClick={onContinueAsSeeker}
                  className="min-h-[44px] px-4 text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 transition-colors"
                >
                  {copy.roleContinueAsSeeker}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (role === 'donor') {
    return (
      <section className="max-w-2xl mx-auto py-4 sm:py-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900">
                {copy.donorStepTitle}
              </h1>
              <p className="text-xs text-slate-600">{copy.donorStepSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setRole('choose');
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <BackIcon className="w-4 h-4" />
              <span>{copy.backToRoleBtn}</span>
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleDonorSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {copy.fieldName} *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copy.fieldNamePlaceholder}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {copy.fieldAge} *
                </label>
                <input
                  type="number"
                  required
                  min={16}
                  max={80}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:border-rose-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {copy.fieldGender} *
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      gender === 'male'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {copy.male}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      gender === 'female'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {copy.female}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {copy.fieldBloodType} *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_TYPES.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setBloodType(bt)}
                    className={`min-h-[44px] rounded-xl text-sm font-mono-tabular font-semibold border transition-colors ${
                      bloodType === bt
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
                {copy.fieldLocation} *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={donorLocation}
                onChange={(e) => setDonorLocation(e.target.value)}
                placeholder={copy.fieldLocationPlaceholder}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {copy.fieldPhone}
              </label>
              <input
                type="tel"
                maxLength={30}
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={copy.fieldPhonePlaceholder}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono-tabular placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">
                  {copy.fieldLastDonation}
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={neverDonated}
                    onChange={(e) => setNeverDonated(e.target.checked)}
                    className="w-4 h-4 accent-rose-700 rounded"
                  />
                  <span>{copy.fieldNeverDonated}</span>
                </label>
              </div>
              {!neverDonated && (
                <input
                  type="date"
                  max={getTodayIso()}
                  value={lastDonationDate}
                  onChange={(e) => setLastDonationDate(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:border-rose-700"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmittingDonor}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Sparkles className={`w-4 h-4 ${isSubmittingDonor ? 'animate-spin' : ''}`} />
              <span>{isSubmittingDonor ? copy.savingBtn : copy.saveDonorBtn}</span>
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-2xl mx-auto py-4 sm:py-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">
              {copy.seekerStepTitle}
            </h1>
            <p className="text-xs text-slate-600">{copy.seekerStepSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setRole('choose');
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            <BackIcon className="w-4 h-4" />
            <span>{copy.backToRoleBtn}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSeekerSubmit} className="space-y-4">
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
              value={seekerLocation}
              onChange={(e) => setSeekerLocation(e.target.value)}
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
            disabled={isMatchingSeeker}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles className={`w-4 h-4 ${isMatchingSeeker ? 'animate-spin' : ''}`} />
            <span>{isMatchingSeeker ? copy.matchingAiBtn : copy.runAiMatchBtn}</span>
          </button>
        </form>
      </div>
    </section>
  );
};
