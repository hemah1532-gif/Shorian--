import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { BloodType, Donor, Gender, Language } from '../types';
import { t } from '../i18n';
import { BLOOD_TYPES, getTodayIso } from '../utils/eligibility';

export interface DonorFormValues {
  name: string;
  age: number;
  bloodType: BloodType;
  gender: Gender;
  location: string;
  phone: string;
  lastDonationDate: string;
}

interface DonorFormModalProps {
  isOpen: boolean;
  editingDonor: Donor | null;
  lang: Language;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: DonorFormValues) => Promise<void>;
}

export const DonorFormModal: React.FC<DonorFormModalProps> = ({
  isOpen,
  editingDonor,
  lang,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const copy = t(lang);
  const [name, setName] = useState('');
  const [age, setAge] = useState('25');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [gender, setGender] = useState<Gender>('male');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [neverDonated, setNeverDonated] = useState(false);
  const [lastDonationDate, setLastDonationDate] = useState(getTodayIso());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingDonor) {
      setName(editingDonor.name);
      setAge(String(editingDonor.age));
      setBloodType(editingDonor.bloodType);
      setGender(editingDonor.gender);
      setLocation(editingDonor.location);
      setPhone(editingDonor.phone || '');
      setNeverDonated(!editingDonor.lastDonationDate);
      setLastDonationDate(editingDonor.lastDonationDate || getTodayIso());
    } else {
      setName('');
      setAge('26');
      setBloodType('O+');
      setGender('male');
      setLocation('');
      setPhone('');
      setNeverDonated(false);
      setLastDonationDate(getTodayIso());
    }
    setFormError(null);
  }, [editingDonor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim().slice(0, 100);
    const parsedAge = parseInt(age, 10);
    const trimmedLocation = location.trim().slice(0, 120);
    const trimmedPhone = phone.trim().slice(0, 30);
    const cleanDate = neverDonated ? '' : lastDonationDate;

    if (
      trimmedName.length < 2 ||
      Number.isNaN(parsedAge) ||
      parsedAge < 16 ||
      parsedAge > 80 ||
      trimmedLocation.length < 2
    ) {
      setFormError(copy.validationError);
      return;
    }

    await onSubmit({
      name: trimmedName,
      age: parsedAge,
      bloodType,
      gender,
      location: trimmedLocation,
      phone: trimmedPhone,
      lastDonationDate: cleanDate,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donor-form-title"
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="donor-form-title" className="text-base font-semibold text-slate-900">
            {editingDonor ? copy.formEditTitle : copy.formAddTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.cancelBtn}
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {formError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
              {formError}
            </div>
          )}

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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {isSubmitting ? copy.savingBtn : copy.saveDonorBtn}
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
