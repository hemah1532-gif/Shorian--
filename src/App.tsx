import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Droplets,
  HeartHandshake,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  AiMatchResponse,
  AppServerState,
  BloodRequest,
  BloodType,
  Donor,
  DonorNotification,
  Language,
  NotificationStatus,
  Urgency,
  UserRole,
} from './types';
import { t } from './i18n';
import {
  BLOOD_TYPES,
  calculateThreeMonthEligibility,
  createClientId,
  getTodayIso,
} from './utils/eligibility';
import {
  evaluateDonorEligibilityWithAi,
  matchDonorsWithAi,
} from './services/aiService';
import {
  bulkSeedServerDonors,
  createOrUpdateServerDonor,
  createServerRequest,
  deleteServerDonor,
  fetchServerState,
  patchServerDonor,
  patchServerRequest,
  respondToNotification,
  sendDonorNotifications,
} from './services/storeService';
import { DonorCard } from './components/DonorCard';
import { DonorFormModal, type DonorFormValues } from './components/DonorFormModal';
import { LogDonationSheet } from './components/LogDonationSheet';
import { BloodRequestPanel } from './components/BloodRequestPanel';
import { RoleOnboardingView } from './components/RoleOnboardingView';
import { DonorPortalView } from './components/DonorPortalView';

const LS_LANG_KEY = 'sheryan_lang_v1';
const LS_ROLE_KEY = 'sheryan_role_v1';
const LS_MY_DONOR_ID_KEY = 'sheryan_my_donor_id_v1';
const LS_HAS_SEEKER_KEY = 'sheryan_has_seeker_v1';
const HERO_IMAGE_URL = '/src/assets/images/blood_donation_care_1795541826520.jpg';

type SeekerTab = 'donors' | 'match';
type AvailabilityFilter = 'all' | 'available' | 'unavailable';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(LS_LANG_KEY);
    return saved === 'en' ? 'en' : 'ar';
  });
  const copy = t(lang);

  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem(LS_ROLE_KEY);
    return saved === 'donor' || saved === 'seeker' ? saved : null;
  });
  const [myDonorId, setMyDonorId] = useState<string | null>(() =>
    localStorage.getItem(LS_MY_DONOR_ID_KEY)
  );
  const [hasRegisteredSeeker, setHasRegisteredSeeker] = useState<boolean>(() =>
    localStorage.getItem(LS_HAS_SEEKER_KEY) === '1'
  );
  const [showRoleEntry, setShowRoleEntry] = useState<boolean>(() => {
    const saved = localStorage.getItem(LS_ROLE_KEY);
    return saved !== 'donor' && saved !== 'seeker';
  });

  const [seekerTab, setSeekerTab] = useState<SeekerTab>('match');

  const [donors, setDonors] = useState<Donor[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [notifications, setNotifications] = useState<DonorNotification[]>([]);

  // Filters (Seeker Donors tab)
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodFilter, setBloodFilter] = useState<BloodType | 'all'>('all');
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>('all');

  // Modals & sheets
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [logDonationDonor, setLogDonationDonor] = useState<Donor | null>(null);

  // Async states
  const [isSavingDonor, setIsSavingDonor] = useState(false);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<BloodRequest | null>(null);
  const [activeMatchResult, setActiveMatchResult] =
    useState<AiMatchResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Sync document direction & language
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(LS_LANG_KEY, lang);
  }, [lang]);

  // Persist user role and donor identity locally across sessions
  useEffect(() => {
    if (userRole) {
      localStorage.setItem(LS_ROLE_KEY, userRole);
    }
  }, [userRole]);

  useEffect(() => {
    if (myDonorId) {
      localStorage.setItem(LS_MY_DONOR_ID_KEY, myDonorId);
    }
  }, [myDonorId]);

  // Load state & subscribe to real-time SSE updates from Express server
  useEffect(() => {
    let active = true;
    fetchServerState()
      .then((state) => {
        if (!active) return;
        setDonors(state.donors || []);
        setRequests(state.requests || []);
        setNotifications(state.notifications || []);
      })
      .catch((err) => {
        console.error('Initial state fetch failed:', err);
      });

    const evtSource = new EventSource('/api/events');
    evtSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          type?: string;
        } & Partial<AppServerState>;
        if (
          parsed.type === 'state:init' ||
          parsed.type === 'state:updated'
        ) {
          if (Array.isArray(parsed.donors)) setDonors(parsed.donors);
          if (Array.isArray(parsed.requests)) setRequests(parsed.requests);
          if (Array.isArray(parsed.notifications)) {
            setNotifications(parsed.notifications);
          }
        }
      } catch {
        // Ignore malformed SSE heartbeats
      }
    };

    return () => {
      active = false;
      evtSource.close();
    };
  }, []);

  // Save or update donor + evaluate < 3 months rule via Gemini AI
  const handleSaveDonor = async (
    values: DonorFormValues,
    markAsMyProfile = false
  ) => {
    setIsSavingDonor(true);
    setAiError(null);
    try {
      const localCheck = calculateThreeMonthEligibility(values.lastDonationDate);
      let isAvailable = localCheck.isAvailable;
      let nextEligibleDate = localCheck.nextEligibleDate;
      let aiNote = '';

      try {
        const aiRes = await evaluateDonorEligibilityWithAi(
          {
            name: values.name,
            age: values.age,
            gender: values.gender,
            bloodType: values.bloodType,
            lastDonationDate: values.lastDonationDate,
          },
          lang
        );
        isAvailable = localCheck.isAvailable && Boolean(aiRes.isAvailable);
        nextEligibleDate = aiRes.nextEligibleDate || localCheck.nextEligibleDate;
        aiNote = (aiRes.note || '').slice(0, 500);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'AI eligibility error');
      }

      if (editingDonor) {
        const history = editingDonor.donationHistory.slice();
        if (
          values.lastDonationDate &&
          !history.includes(values.lastDonationDate)
        ) {
          history.unshift(values.lastDonationDate);
        }

        const updated: Donor = {
          ...editingDonor,
          name: values.name,
          age: values.age,
          bloodType: values.bloodType,
          gender: values.gender,
          location: values.location,
          phone: values.phone,
          lastDonationDate: values.lastDonationDate,
          donationHistory: history.slice(0, 50),
          isAvailable,
          nextEligibleDate,
          aiEligibilityNote: aiNote || editingDonor.aiEligibilityNote,
        };

        await createOrUpdateServerDonor(updated);
      } else {
        const newId = createClientId('donor');
        const history = values.lastDonationDate ? [values.lastDonationDate] : [];
        const newDonor: Donor = {
          id: newId,
          name: values.name,
          age: values.age,
          bloodType: values.bloodType,
          gender: values.gender,
          location: values.location,
          phone: values.phone,
          lastDonationDate: values.lastDonationDate,
          donationHistory: history,
          isAvailable,
          nextEligibleDate,
          aiEligibilityNote: aiNote,
        };

        await createOrUpdateServerDonor(newDonor);
        if (markAsMyProfile) {
          setMyDonorId(newId);
        }
      }

      setIsDonorModalOpen(false);
      setEditingDonor(null);
    } finally {
      setIsSavingDonor(false);
    }
  };

  // Log a new donation date -> recalculate < 3 months rule via AI
  const handleConfirmNewDonation = async (donor: Donor, newDate: string) => {
    setIsSavingDonor(true);
    setAiError(null);
    try {
      const localCheck = calculateThreeMonthEligibility(newDate);
      let isAvailable = localCheck.isAvailable;
      let nextEligibleDate = localCheck.nextEligibleDate;
      let aiNote = donor.aiEligibilityNote;

      try {
        const aiRes = await evaluateDonorEligibilityWithAi(
          {
            name: donor.name,
            age: donor.age,
            gender: donor.gender,
            bloodType: donor.bloodType,
            lastDonationDate: newDate,
          },
          lang
        );
        isAvailable = localCheck.isAvailable && Boolean(aiRes.isAvailable);
        nextEligibleDate = aiRes.nextEligibleDate || localCheck.nextEligibleDate;
        aiNote = (aiRes.note || '').slice(0, 500);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'AI eligibility error');
      }

      const updatedHistory = [
        newDate,
        ...donor.donationHistory.filter((d) => d !== newDate),
      ]
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 50);

      const mostRecent = updatedHistory[0] || newDate;
      const finalLocal = calculateThreeMonthEligibility(mostRecent);

      await patchServerDonor(donor.id, {
        lastDonationDate: mostRecent,
        donationHistory: updatedHistory,
        isAvailable: finalLocal.isAvailable && isAvailable,
        nextEligibleDate:
          mostRecent === newDate
            ? nextEligibleDate
            : finalLocal.nextEligibleDate,
        aiEligibilityNote: aiNote,
      });

      setLogDonationDonor(null);
    } finally {
      setIsSavingDonor(false);
    }
  };

  const handleRecheckAi = async (donor: Donor) => {
    setRecheckingId(donor.id);
    setAiError(null);
    try {
      const localCheck = calculateThreeMonthEligibility(donor.lastDonationDate);
      const aiRes = await evaluateDonorEligibilityWithAi(
        {
          name: donor.name,
          age: donor.age,
          gender: donor.gender,
          bloodType: donor.bloodType,
          lastDonationDate: donor.lastDonationDate,
        },
        lang
      );
      const isAvailable = localCheck.isAvailable && Boolean(aiRes.isAvailable);
      const nextEligibleDate = aiRes.nextEligibleDate || localCheck.nextEligibleDate;
      const aiNote = (aiRes.note || '').slice(0, 500);

      await patchServerDonor(donor.id, {
        isAvailable,
        nextEligibleDate,
        aiEligibilityNote: aiNote,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI recheck failed');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleDeleteDonor = async (donor: Donor) => {
    await deleteServerDonor(donor.id);
    if (myDonorId === donor.id) {
      setMyDonorId(null);
      localStorage.removeItem(LS_MY_DONOR_ID_KEY);
    }
  };

  // Blood Request + AI Matching
  const handleSubmitMatch = async (payload: {
    requesterName: string;
    neededBloodType: BloodType;
    location: string;
    urgency: Urgency;
    notes: string;
  }) => {
    setIsMatching(true);
    setAiError(null);
    try {
      const normalizedDonors = donors.map((d) => {
        const calc = calculateThreeMonthEligibility(d.lastDonationDate);
        return {
          ...d,
          isAvailable: calc.isAvailable,
          nextEligibleDate: calc.nextEligibleDate,
        };
      });

      const matchRes = await matchDonorsWithAi(payload, normalizedDonors, lang);
      setActiveMatchResult(matchRes);

      const newReqId = createClientId('req');
      const matchedIds = matchRes.matches.map((m) => m.donorId).slice(0, 50);
      const newReq: BloodRequest = {
        id: newReqId,
        requesterName: payload.requesterName,
        neededBloodType: payload.neededBloodType,
        location: payload.location,
        urgency: payload.urgency,
        notes: payload.notes,
        status: 'open',
        matchedDonorIds: matchedIds,
        aiSummary: (matchRes.summary || '').slice(0, 1000),
      };

      const savedReq = await createServerRequest(newReq);
      setActiveRequest(savedReq);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI matching failed');
    } finally {
      setIsMatching(false);
    }
  };

  const handleMarkFulfilled = async (req: BloodRequest) => {
    await patchServerRequest(req.id, { status: 'fulfilled' });
  };

  const handleRematch = async (req: BloodRequest) => {
    setIsMatching(true);
    setAiError(null);
    try {
      const normalizedDonors = donors.map((d) => {
        const calc = calculateThreeMonthEligibility(d.lastDonationDate);
        return {
          ...d,
          isAvailable: calc.isAvailable,
          nextEligibleDate: calc.nextEligibleDate,
        };
      });
      const matchRes = await matchDonorsWithAi(
        {
          requesterName: req.requesterName,
          neededBloodType: req.neededBloodType,
          location: req.location,
          urgency: req.urgency,
          notes: req.notes,
        },
        normalizedDonors,
        lang
      );
      setActiveRequest(req);
      setActiveMatchResult(matchRes);

      if (req.status !== 'fulfilled') {
        await patchServerRequest(req.id, {
          matchedDonorIds: matchRes.matches.map((m) => m.donorId).slice(0, 50),
          aiSummary: (matchRes.summary || '').slice(0, 1000),
        });
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI rematch failed');
    } finally {
      setIsMatching(false);
    }
  };

  // Seeker sends notification(s) to available donor(s)
  const handleSendNotifications = async (
    request: BloodRequest,
    donorIds: string[]
  ) => {
    setIsSendingNotif(true);
    setAiError(null);
    try {
      await sendDonorNotifications({
        requestId: request.id,
        donorIds,
        neededBloodType: request.neededBloodType,
        location: request.location,
        urgency: request.urgency,
        requesterName: request.requesterName,
        notes: request.notes,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setIsSendingNotif(false);
    }
  };

  // Seeker notifies a donor directly from the Donors Directory tab
  const handleNotifyFromDonorCard = async (donor: Donor) => {
    setIsSendingNotif(true);
    setAiError(null);
    try {
      let targetReq = activeRequest || requests.find((r) => r.status === 'open') || null;
      if (!targetReq) {
        const quickReq: BloodRequest = {
          id: createClientId('req'),
          requesterName: lang === 'ar' ? 'طلب تبرع مباشر' : 'Direct Donor Request',
          neededBloodType: donor.bloodType,
          location: donor.location,
          urgency: 'urgent',
          notes: '',
          status: 'open',
          matchedDonorIds: [donor.id],
          aiSummary: '',
        };
        targetReq = await createServerRequest(quickReq);
        setActiveRequest(targetReq);
      }

      await sendDonorNotifications({
        requestId: targetReq.id,
        donorIds: [donor.id],
        neededBloodType: targetReq.neededBloodType,
        location: targetReq.location,
        urgency: targetReq.urgency,
        requesterName: targetReq.requesterName,
        notes: targetReq.notes,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setIsSendingNotif(false);
    }
  };

  // Donor replies Available or Unavailable
  const handleRespondNotification = async (
    notificationId: string,
    status: Exclude<NotificationStatus, 'pending'>,
    replyNote: string
  ) => {
    setRespondingId(notificationId);
    try {
      await respondToNotification(notificationId, status, replyNote);
    } finally {
      setRespondingId(null);
    }
  };

  const handleLoadSampleDonors = async () => {
    const today = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(today.getTime() - n * 86400000);
      return d.toISOString().slice(0, 10);
    };

    const samples: Donor[] = [
      {
        id: createClientId('donor'),
        name: lang === 'ar' ? 'أحمد محمود حسن' : 'Ahmed Mahmoud Hassan',
        age: 29,
        bloodType: 'O+',
        gender: 'male',
        location: lang === 'ar' ? 'القاهرة - مدينة نصر' : 'Cairo - Nasr City',
        phone: '01012345678',
        lastDonationDate: daysAgo(125),
        donationHistory: [daysAgo(125), daysAgo(260)],
        isAvailable: true,
        nextEligibleDate: getTodayIso(),
        aiEligibilityNote:
          lang === 'ar'
            ? 'مر أكثر من 3 شهور على آخر تبرع، المتبرع متاح وجاهز للتبرع.'
            : 'More than 3 months have passed since last donation. Ready to donate.',
      },
      {
        id: createClientId('donor'),
        name: lang === 'ar' ? 'سارة إبراهيم عادل' : 'Sara Ibrahim Adel',
        age: 26,
        bloodType: 'A+',
        gender: 'female',
        location: lang === 'ar' ? 'الجيزة - الدقي' : 'Giza - Dokki',
        phone: '01123456789',
        lastDonationDate: daysAgo(40),
        donationHistory: [daysAgo(40)],
        isAvailable: false,
        nextEligibleDate: calculateThreeMonthEligibility(daysAgo(40)).nextEligibleDate,
        aiEligibilityNote:
          lang === 'ar'
            ? 'غير متاحة حالياً لأن آخر تبرع كان قبل 40 يوماً فقط (أقل من 3 شهور).'
            : 'Currently resting: last donation was 40 days ago (under 3-month interval).',
      },
      {
        id: createClientId('donor'),
        name: lang === 'ar' ? 'يوسف خالد منصور' : 'Youssef Khaled Mansour',
        age: 34,
        bloodType: 'O-',
        gender: 'male',
        location: lang === 'ar' ? 'القاهرة - المعادي' : 'Cairo - Maadi',
        phone: '01234567890',
        lastDonationDate: daysAgo(150),
        donationHistory: [daysAgo(150)],
        isAvailable: true,
        nextEligibleDate: getTodayIso(),
        aiEligibilityNote:
          lang === 'ar'
            ? 'فصيلة معطي عام متاحة بعد مرور 5 أشهر على آخر تبرع.'
            : 'Universal O- donor available after 5 months since last donation.',
      },
      {
        id: createClientId('donor'),
        name: lang === 'ar' ? 'نور الهدى طارق' : 'Nour El-Hoda Tarek',
        age: 24,
        bloodType: 'B+',
        gender: 'female',
        location: lang === 'ar' ? 'الإسكندرية - سموحة' : 'Alexandria - Smouha',
        phone: '01512345678',
        lastDonationDate: '',
        donationHistory: [],
        isAvailable: true,
        nextEligibleDate: getTodayIso(),
        aiEligibilityNote:
          lang === 'ar'
            ? 'لم يسبق التبرع مسبقاً، المتبرعة متاحة للفحص والتبرع.'
            : 'No prior donations recorded; eligible for standard screening and donation.',
      },
    ];

    await bulkSeedServerDonors(samples);
  };

  // Derived metrics & views
  const stats = useMemo(() => {
    let available = 0;
    let resting = 0;
    for (const d of donors) {
      if (calculateThreeMonthEligibility(d.lastDonationDate).isAvailable) {
        available += 1;
      } else {
        resting += 1;
      }
    }
    const openRequests = requests.filter((r) => r.status === 'open').length;
    return { total: donors.length, available, resting, openRequests };
  }, [donors, requests]);

  const myDonor = useMemo(() => {
    if (!myDonorId) return donors[0] || null;
    return donors.find((d) => d.id === myDonorId) || donors[0] || null;
  }, [donors, myDonorId]);

  const myPendingNotificationsCount = useMemo(() => {
    if (!myDonor) return 0;
    return notifications.filter(
      (n) => n.donorId === myDonor.id && n.status === 'pending'
    ).length;
  }, [notifications, myDonor]);

  const filteredDonors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return donors.filter((d) => {
      if (bloodFilter !== 'all' && d.bloodType !== bloodFilter) return false;
      const isAvail = calculateThreeMonthEligibility(d.lastDonationDate).isAvailable;
      if (availabilityFilter === 'available' && !isAvail) return false;
      if (availabilityFilter === 'unavailable' && isAvail) return false;
      if (q) {
        const hay = `${d.name} ${d.location} ${d.bloodType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [donors, searchQuery, bloodFilter, availabilityFilter]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 pb-20 lg:pb-12">
      {/* Sticky Top Bar (No Google Sync, Donors tab strictly hidden for Donors) */}
      <header className="sticky top-0 z-30 h-[52px] lg:h-16 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (userRole) setShowRoleEntry(false);
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Droplets className="w-5 h-5 text-rose-700 shrink-0" />
            <span>{copy.brandName}</span>
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            {userRole === 'donor' && (
              <button
                type="button"
                onClick={() => setShowRoleEntry(false)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  !showRoleEntry
                    ? 'text-slate-900 border-rose-700'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {copy.navMyDonorHome}
                {myPendingNotificationsCount > 0
                  ? ` (${myPendingNotificationsCount})`
                  : ''}
              </button>
            )}

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
              className="py-1 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.langSwitch}
            </button>
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Language Switch */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
              className="lg:hidden min-h-[40px] px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              {copy.langSwitch}
            </button>

            <button
              type="button"
              onClick={() => setShowRoleEntry(true)}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{copy.ctaSwitchRole}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 space-y-6">
        {showRoleEntry || !userRole ? (
          <RoleOnboardingView
            lang={lang}
            hasExistingDonorProfile={Boolean(myDonorId && donors.some((d) => d.id === myDonorId))}
            hasRegisteredSeeker={hasRegisteredSeeker}
            isSubmittingDonor={isSavingDonor}
            isMatchingSeeker={isMatching}
            onRegisterDonor={async (values) => {
              await handleSaveDonor(values, true);
              setUserRole('donor');
              setShowRoleEntry(false);
            }}
            onSubmitSeekerRequest={async (payload) => {
              localStorage.setItem(LS_HAS_SEEKER_KEY, '1');
              setHasRegisteredSeeker(true);
              setUserRole('seeker');
              setSeekerTab('match');
              setShowRoleEntry(false);
              await handleSubmitMatch(payload);
            }}
            onContinueAsDonor={() => {
              setUserRole('donor');
              setShowRoleEntry(false);
            }}
            onContinueAsSeeker={() => {
              setUserRole('seeker');
              setShowRoleEntry(false);
            }}
          />
        ) : (
          <>
            {/* Hero Split + KPI Strip */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-5">
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-rose-700">
                      {copy.brandTagline}
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug text-balance max-w-2xl">
                      {userRole === 'seeker'
                        ? copy.heroHeadlineSeeker
                        : copy.heroHeadlineDonor}
                    </h1>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                      {userRole === 'seeker'
                        ? copy.heroSubtitleSeeker
                        : copy.heroSubtitleDonor}
                    </p>
                  </div>

                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <strong className="text-slate-700 font-medium">
                      {copy.memoryBannerTitle}:{' '}
                    </strong>
                    <span>{copy.memoryBannerDesc}</span>
                  </div>
                </div>

                <div className="lg:col-span-5 relative min-h-[180px] lg:min-h-full bg-slate-100">
                  {!heroImgFailed ? (
                    <img
                      src={HERO_IMAGE_URL}
                      alt={copy.brandTagline}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-48 lg:h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 lg:h-full bg-gradient-to-br from-rose-50 via-slate-100 to-rose-100 flex items-center justify-center p-6 text-center">
                      <div className="space-y-2">
                        <Droplets className="w-8 h-8 text-rose-700 mx-auto" />
                        <p className="text-sm font-medium text-slate-700">
                          {copy.brandName} · {copy.brandTagline}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* KPI Strip (Donors count shown only to Seeker; Donor sees their own notifications & status) */}
              {userRole === 'seeker' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-200 divide-y lg:divide-y-0 divide-x divide-slate-200 rtl:divide-x-reverse">
                  <div className="p-4 sm:px-6">
                    <span className="text-xs text-slate-500 block">
                      {copy.kpiTotalDonors}
                    </span>
                    <span className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1 block">
                      {stats.total}
                    </span>
                  </div>
                  <div className="p-4 sm:px-6">
                    <span className="text-xs text-slate-500 block">
                      {copy.kpiAvailableNow}
                    </span>
                    <span className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1 block">
                      {stats.available}
                    </span>
                  </div>
                  <div className="p-4 sm:px-6">
                    <span className="text-xs text-slate-500 block">
                      {copy.kpiResting}
                    </span>
                    <span className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1 block">
                      {stats.resting}
                    </span>
                  </div>
                  <div className="p-4 sm:px-6">
                    <span className="text-xs text-slate-500 block">
                      {copy.kpiOpenRequests}
                    </span>
                    <span className="text-2xl font-bold text-rose-700 font-mono-tabular mt-1 block">
                      {stats.openRequests}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Seeker Workspace Switcher (placed in workspace below header) */}
            {userRole === 'seeker' && (
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSeekerTab('match')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                      seekerTab === 'match'
                        ? 'bg-rose-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HeartHandshake className="w-4 h-4 shrink-0" />
                    <span>{copy.navRequest}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeekerTab('donors')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                      seekerTab === 'donors'
                        ? 'bg-rose-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{copy.navDonors}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Global AI error notice if any */}
            {aiError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800 flex items-center justify-between gap-3">
                <span>
                  {copy.aiErrorBanner} {aiError}
                </span>
                <button
                  type="button"
                  onClick={() => setAiError(null)}
                  className="text-rose-900 font-medium underline shrink-0"
                >
                  {copy.cancelBtn}
                </button>
              </div>
            )}

            {/* DONOR ROLE VIEW: Only their profile + incoming notifications (no public donors list!) */}
            {userRole === 'donor' && (
              <DonorPortalView
                myDonor={myDonor}
                notifications={notifications}
                lang={lang}
                isRechecking={myDonor ? recheckingId === myDonor.id : false}
                respondingId={respondingId}
                onRegisterNow={() => setShowRoleEntry(true)}
                onEditProfile={(d) => {
                  setEditingDonor(d);
                  setIsDonorModalOpen(true);
                }}
                onLogDonation={(d) => setLogDonationDonor(d)}
                onRecheckAi={handleRecheckAi}
                onRespondNotification={handleRespondNotification}
              />
            )}

            {/* SEEKER ROLE VIEW: Request/Match Tab + Donors Directory Tab */}
            {userRole === 'seeker' && seekerTab === 'match' && (
              <BloodRequestPanel
                donors={donors}
                requests={requests}
                notifications={notifications}
                lang={lang}
                isMatching={isMatching}
                isSendingNotif={isSendingNotif}
                activeRequest={activeRequest}
                activeMatchResult={activeMatchResult}
                aiError={aiError}
                onSubmitMatch={handleSubmitMatch}
                onSendNotifications={handleSendNotifications}
                onMarkFulfilled={handleMarkFulfilled}
                onRematch={handleRematch}
              />
            )}

            {userRole === 'seeker' && seekerTab === 'donors' && (
              <section className="space-y-4">
                {/* Search & Filters Bar + Add Donor button */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={copy.searchPlaceholder}
                        className="w-full min-h-[44px] ps-10 pe-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-700"
                      />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                      {(
                        [
                          ['all', copy.filterAll],
                          ['available', copy.filterAvailable],
                          ['unavailable', copy.filterUnavailable],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAvailabilityFilter(key)}
                          className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            availabilityFilter === key
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingDonor(null);
                        setIsDonorModalOpen(true);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{copy.addDonorManualBtn}</span>
                    </button>
                  </div>

                  {/* Blood Type Filter Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setBloodFilter('all')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        bloodFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {copy.allBloodTypes}
                    </button>
                    {BLOOD_TYPES.map((bt) => (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setBloodFilter(bt)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono-tabular font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          bloodFilter === bt
                            ? 'bg-rose-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Donors Grid or Empty State */}
                {donors.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {copy.emptyDonorsTitle}
                      </h2>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {copy.emptyDonorsDesc}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDonor(null);
                          setIsDonorModalOpen(true);
                        }}
                        className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{copy.addDonorManualBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadSampleDonors}
                        className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-100 text-slate-800 text-sm font-medium hover:bg-slate-200 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-rose-700" />
                        <span>{copy.loadSampleDonors}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDonors.map((donor) => {
                      const latestNotif = notifications.find(
                        (n) => n.donorId === donor.id
                      );
                      return (
                        <DonorCard
                          key={donor.id}
                          donor={donor}
                          latestNotification={latestNotif}
                          lang={lang}
                          isRechecking={recheckingId === donor.id}
                          isNotifying={isSendingNotif}
                          onNotifyDonor={handleNotifyFromDonorCard}
                          onLogDonation={(d) => setLogDonationDonor(d)}
                          onEdit={(d) => {
                            setEditingDonor(d);
                            setIsDonorModalOpen(true);
                          }}
                          onDelete={handleDeleteDonor}
                          onRecheckAi={handleRecheckAi}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Mobile Thumb-Zone Bottom Tab Bar (Role-aware, 60px high) */}
      {!showRoleEntry && userRole === 'seeker' && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-3 items-center"
        >
          <button
            type="button"
            onClick={() => setSeekerTab('match')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              seekerTab === 'match' ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            <HeartHandshake className="w-5 h-5" />
            <span className="truncate max-w-[90px]">{copy.navRequest}</span>
          </button>

          <button
            type="button"
            onClick={() => setSeekerTab('donors')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              seekerTab === 'donors' ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="truncate max-w-[90px]">{copy.navDonors}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRoleEntry(true)}
            className="h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-600"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="truncate max-w-[90px]">{copy.ctaSwitchRole}</span>
          </button>
        </nav>
      )}

      {!showRoleEntry && userRole === 'donor' && (
        <nav
          aria-label="Mobile Donor Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-2 items-center"
        >
          <button
            type="button"
            onClick={() => setShowRoleEntry(false)}
            className="h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-rose-700"
          >
            <Bell className="w-5 h-5" />
            <span className="truncate max-w-[140px]">
              {copy.navMyDonorHome}
              {myPendingNotificationsCount > 0
                ? ` (${myPendingNotificationsCount})`
                : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowRoleEntry(true)}
            className="h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-600"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="truncate max-w-[140px]">{copy.ctaSwitchRole}</span>
          </button>
        </nav>
      )}

      {/* Modals & Sheets */}
      <DonorFormModal
        isOpen={isDonorModalOpen}
        editingDonor={editingDonor}
        lang={lang}
        isSubmitting={isSavingDonor}
        onClose={() => {
          setIsDonorModalOpen(false);
          setEditingDonor(null);
        }}
        onSubmit={(values) => handleSaveDonor(values, userRole === 'donor')}
      />

      <LogDonationSheet
        donor={logDonationDonor}
        lang={lang}
        isSubmitting={isSavingDonor}
        onClose={() => setLogDonationDonor(null)}
        onConfirm={handleConfirmNewDonation}
      />
    </div>
  );
}
