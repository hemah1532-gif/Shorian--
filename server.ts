import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'sheryan-store.json');

interface DonorRecord {
  id: string;
  name: string;
  age: number;
  bloodType: string;
  gender: 'male' | 'female';
  location: string;
  phone: string;
  lastDonationDate: string;
  donationHistory: string[];
  isAvailable: boolean;
  nextEligibleDate: string;
  aiEligibilityNote: string;
  createdAt: string;
  updatedAt: string;
}

interface BloodRequestRecord {
  id: string;
  requesterName: string;
  neededBloodType: string;
  location: string;
  urgency: 'normal' | 'urgent' | 'critical';
  notes: string;
  status: 'open' | 'fulfilled';
  matchedDonorIds: string[];
  aiSummary: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationRecord {
  id: string;
  requestId: string;
  donorId: string;
  donorName: string;
  donorBloodType: string;
  donorPhone: string;
  neededBloodType: string;
  location: string;
  urgency: 'normal' | 'urgent' | 'critical';
  requesterName: string;
  notes: string;
  status: 'pending' | 'accepted' | 'declined';
  replyNote: string;
  createdAt: string;
  respondedAt: string | null;
}

interface StoreData {
  donors: DonorRecord[];
  requests: BloodRequestRecord[];
  notifications: NotificationRecord[];
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial: StoreData = { donors: [], requests: [], notifications: [] };
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      donors: Array.isArray(parsed.donors) ? parsed.donors : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return { donors: [], requests: [], notifications: [] };
  }
}

let store: StoreData = loadStore();
const sseClients = new Set<Response>();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function broadcastState() {
  const payload = `data: ${JSON.stringify({ type: 'state:updated', ...store })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface EligibilityPayload {
  donor?: {
    name?: string;
    age?: number;
    gender?: 'male' | 'female';
    bloodType?: string;
    lastDonationDate?: string;
  };
  today?: string;
  language?: 'ar' | 'en';
}

interface MatchDonorInput {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  bloodType: string;
  location: string;
  lastDonationDate: string;
  isAvailable: boolean;
  nextEligibleDate: string;
}

interface MatchPayload {
  request?: {
    requesterName?: string;
    neededBloodType?: string;
    location?: string;
    urgency?: 'normal' | 'urgent' | 'critical';
    notes?: string;
  };
  donors?: MatchDonorInput[];
  today?: string;
  language?: 'ar' | 'en';
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Real-time SSE stream for instant donor notifications & replies
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'state:init', ...store })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.get('/api/state', (_req: Request, res: Response) => {
  res.json(store);
});

app.post('/api/donors', (req: Request, res: Response) => {
  const donor = req.body as Partial<DonorRecord>;
  if (!donor?.id || !donor?.name || !donor?.bloodType || !donor?.location) {
    res.status(400).json({ error: 'Missing required donor fields.' });
    return;
  }
  const now = new Date().toISOString();
  const record: DonorRecord = {
    id: String(donor.id).slice(0, 128),
    name: String(donor.name).slice(0, 100),
    age: Number(donor.age) || 25,
    bloodType: String(donor.bloodType),
    gender: donor.gender === 'female' ? 'female' : 'male',
    location: String(donor.location).slice(0, 120),
    phone: String(donor.phone || '').slice(0, 30),
    lastDonationDate: String(donor.lastDonationDate || '').slice(0, 20),
    donationHistory: Array.isArray(donor.donationHistory)
      ? donor.donationHistory.slice(0, 50).map(String)
      : [],
    isAvailable: Boolean(donor.isAvailable),
    nextEligibleDate: String(donor.nextEligibleDate || ''),
    aiEligibilityNote: String(donor.aiEligibilityNote || '').slice(0, 500),
    createdAt: donor.createdAt || now,
    updatedAt: now,
  };

  const existingIdx = store.donors.findIndex((d) => d.id === record.id);
  if (existingIdx >= 0) {
    store.donors[existingIdx] = record;
  } else {
    store.donors.unshift(record);
  }
  saveStore();
  broadcastState();
  res.json(record);
});

app.patch('/api/donors/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = store.donors.findIndex((d) => d.id === id);
  if (idx < 0) {
    res.status(404).json({ error: 'Donor not found.' });
    return;
  }
  const patch = req.body as Partial<DonorRecord>;
  const updated: DonorRecord = {
    ...store.donors[idx],
    ...patch,
    id: store.donors[idx].id,
    updatedAt: new Date().toISOString(),
  };
  store.donors[idx] = updated;
  saveStore();
  broadcastState();
  res.json(updated);
});

app.delete('/api/donors/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  store.donors = store.donors.filter((d) => d.id !== id);
  store.notifications = store.notifications.filter((n) => n.donorId !== id);
  saveStore();
  broadcastState();
  res.json({ ok: true });
});

app.post('/api/donors/bulk', (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.donors) ? (req.body.donors as DonorRecord[]) : [];
  const now = new Date().toISOString();
  for (const item of items) {
    if (!item?.id || store.donors.some((d) => d.id === item.id)) continue;
    store.donors.push({ ...item, createdAt: now, updatedAt: now });
  }
  saveStore();
  broadcastState();
  res.json(store.donors);
});

app.post('/api/requests', (req: Request, res: Response) => {
  const reqData = req.body as Partial<BloodRequestRecord>;
  if (!reqData?.id || !reqData?.neededBloodType || !reqData?.location) {
    res.status(400).json({ error: 'Missing required blood request fields.' });
    return;
  }
  const now = new Date().toISOString();
  const record: BloodRequestRecord = {
    id: String(reqData.id).slice(0, 128),
    requesterName: String(reqData.requesterName || '').slice(0, 100),
    neededBloodType: String(reqData.neededBloodType),
    location: String(reqData.location).slice(0, 120),
    urgency:
      reqData.urgency === 'critical' || reqData.urgency === 'normal'
        ? reqData.urgency
        : 'urgent',
    notes: String(reqData.notes || '').slice(0, 400),
    status: reqData.status === 'fulfilled' ? 'fulfilled' : 'open',
    matchedDonorIds: Array.isArray(reqData.matchedDonorIds)
      ? reqData.matchedDonorIds.slice(0, 50).map(String)
      : [],
    aiSummary: String(reqData.aiSummary || '').slice(0, 1000),
    createdAt: now,
    updatedAt: now,
  };

  const existingIdx = store.requests.findIndex((r) => r.id === record.id);
  if (existingIdx >= 0) {
    store.requests[existingIdx] = record;
  } else {
    store.requests.unshift(record);
  }
  saveStore();
  broadcastState();
  res.json(record);
});

app.patch('/api/requests/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = store.requests.findIndex((r) => r.id === id);
  if (idx < 0) {
    res.status(404).json({ error: 'Request not found.' });
    return;
  }
  const patch = req.body as Partial<BloodRequestRecord>;
  store.requests[idx] = {
    ...store.requests[idx],
    ...patch,
    id: store.requests[idx].id,
    updatedAt: new Date().toISOString(),
  };
  saveStore();
  broadcastState();
  res.json(store.requests[idx]);
});

// Send notification(s) from Seeker to Available Donor(s)
app.post('/api/notifications', (req: Request, res: Response) => {
  const body = req.body as {
    requestId?: string;
    donorIds?: string[];
    neededBloodType?: string;
    location?: string;
    urgency?: 'normal' | 'urgent' | 'critical';
    requesterName?: string;
    notes?: string;
  };

  const donorIds = Array.isArray(body?.donorIds) ? body.donorIds : [];
  if (!body?.neededBloodType || !body?.location || donorIds.length === 0) {
    res.status(400).json({ error: 'donorIds, neededBloodType, and location are required.' });
    return;
  }

  const requestId = String(body.requestId || `req_${Date.now()}`);
  const now = new Date().toISOString();
  const created: NotificationRecord[] = [];

  for (const donorId of donorIds) {
    const donor = store.donors.find((d) => d.id === donorId);
    if (!donor) continue;

    // Idempotent check: avoid duplicate notification for same request + donor
    const alreadyExists = store.notifications.some(
      (n) => n.requestId === requestId && n.donorId === donorId
    );
    if (alreadyExists) continue;

    const notif: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      requestId,
      donorId: donor.id,
      donorName: donor.name,
      donorBloodType: donor.bloodType,
      donorPhone: donor.phone || '',
      neededBloodType: String(body.neededBloodType),
      location: String(body.location).slice(0, 120),
      urgency:
        body.urgency === 'critical' || body.urgency === 'normal'
          ? body.urgency
          : 'urgent',
      requesterName: String(body.requesterName || '').slice(0, 100),
      notes: String(body.notes || '').slice(0, 400),
      status: 'pending',
      replyNote: '',
      createdAt: now,
      respondedAt: null,
    };
    store.notifications.unshift(notif);
    created.push(notif);
  }

  saveStore();
  broadcastState();
  res.json({ created, notifications: store.notifications });
});

// Donor replies whether they are available or not
app.patch('/api/notifications/:id/respond', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, replyNote } = req.body as {
    status?: 'accepted' | 'declined';
    replyNote?: string;
  };

  if (status !== 'accepted' && status !== 'declined') {
    res.status(400).json({ error: 'Invalid response status.' });
    return;
  }

  const idx = store.notifications.findIndex((n) => n.id === id);
  if (idx < 0) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }

  store.notifications[idx] = {
    ...store.notifications[idx],
    status,
    replyNote: String(replyNote || '').slice(0, 250),
    respondedAt: new Date().toISOString(),
  };

  saveStore();
  broadcastState();
  res.json(store.notifications[idx]);
});

app.post('/api/ai/eligibility', async (req: Request, res: Response) => {
  try {
    const body = req.body as EligibilityPayload;
    const donor = body?.donor;
    if (!donor || !donor.name || !donor.bloodType) {
      res.status(400).json({ error: 'Missing required donor fields.' });
      return;
    }

    const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);
    const language = body.language === 'en' ? 'en' : 'ar';

    const ai = getAiClient();

    const prompt = [
      `Today's date: ${today}.`,
      `Donor profile:`,
      `- Name: ${donor.name}`,
      `- Age: ${donor.age ?? 'unknown'}`,
      `- Gender: ${donor.gender ?? 'unknown'}`,
      `- Blood Type: ${donor.bloodType}`,
      `- Last Donation Date (YYYY-MM-DD): ${donor.lastDonationDate || 'Never donated before'}`,
      ``,
      `Medical Rule: A donor is ONLY unavailable if they donated LESS than 3 months ago (today < lastDonationDate + 3 calendar months). Anyone who donated 3 months ago or more (today >= lastDonationDate + 3 months), or who has never donated before, is AVAILABLE (isAvailable = true).`,
      `Calculate nextEligibleDate (YYYY-MM-DD, exactly 3 calendar months after lastDonationDate, or "${today}" if already eligible), daysRemaining (0 if available), and write a short, helpful medical eligibility note in ${language === 'ar' ? 'Arabic' : 'English'} (max 220 characters) mentioning the 3-month rule and hydration/recovery advice.`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a clinical blood bank eligibility evaluator. Follow the 3-month donation interval rule strictly and return accurate JSON.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAvailable: { type: Type.BOOLEAN },
            nextEligibleDate: { type: Type.STRING },
            daysRemaining: { type: Type.INTEGER },
            note: { type: Type.STRING },
          },
          required: ['isAvailable', 'nextEligibleDate', 'daysRemaining', 'note'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI eligibility evaluation failed.';
    const status = message.includes('GEMINI_API_KEY') ? 500 : 502;
    res.status(status).json({ error: message });
  }
});

app.post('/api/ai/match', async (req: Request, res: Response) => {
  try {
    const body = req.body as MatchPayload;
    const reqInfo = body?.request;
    const donors = Array.isArray(body?.donors) ? body.donors : [];

    if (!reqInfo?.neededBloodType || !reqInfo?.location) {
      res.status(400).json({ error: 'Needed blood type and location are required.' });
      return;
    }

    const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);
    const language = body.language === 'en' ? 'en' : 'ar';

    if (donors.length === 0) {
      res.json({
        summary:
          language === 'ar'
            ? 'لا يوجد متبرعون مسجلون في قاعدة البيانات حتى الآن للمقارنة.'
            : 'There are no registered donors in the database yet to compare.',
        excludedUnavailableCount: 0,
        matches: [],
      });
      return;
    }

    const ai = getAiClient();

    const prompt = [
      `Today's date: ${today}.`,
      `Blood Request:`,
      `- Needed Blood Type: ${reqInfo.neededBloodType}`,
      `- Needed Location: ${reqInfo.location}`,
      `- Urgency: ${reqInfo.urgency ?? 'normal'}`,
      `- Patient/Hospital Notes: ${reqInfo.notes || 'None'}`,
      ``,
      `Registered Donors Database (JSON):`,
      JSON.stringify(
        donors.map((d) => ({
          id: d.id,
          name: d.name,
          age: d.age,
          gender: d.gender,
          bloodType: d.bloodType,
          location: d.location,
          lastDonationDate: d.lastDonationDate || 'never',
        }))
      ),
      ``,
      `Instructions:`,
      `1. First, enforce the 3-month rule against today (${today}): ANY donor whose lastDonationDate was LESS than 3 calendar months ago (today < lastDonationDate + 3 months) is UNAVAILABLE and MUST NOT be included in matches. Anyone whose last donation was 3 months ago or more (or "never") is AVAILABLE. Count how many donors had matching or compatible blood type but were excluded because their last donation was less than 3 months ago (excludedUnavailableCount).`,
      `2. Among available donors (>= 3 months since lastDonationDate or "never"), find donors with EXACT bloodType match first, and medically compatible RBC donors second (e.g. O- can donate to anyone; O+ to positive types; A- to A-/A+/AB-/AB+; B- to B-/B+/AB-/AB+; A+ to A+/AB+; B+ to B+/AB+; AB- to AB-/AB+; AB+ only to AB+).`,
      `3. Compare the donor's location against "${reqInfo.location}" semantically across Arabic and English (e.g. Cairo = القاهرة, Giza = الجيزة, Alexandria = الإسكندرية, Nasr City = مدينة نصر). Rank exact blood type + same/nearby location highest (score 0-100).`,
      `4. Write "summary" and each match's "reason" concisely in ${language === 'ar' ? 'Arabic' : 'English'}.`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an AI blood bank matching coordinator. Enforce the 3-month donation interval strictly and rank eligible donors accurately by blood compatibility and location.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            excludedUnavailableCount: { type: Type.INTEGER },
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  donorId: { type: Type.STRING },
                  matchTier: { type: Type.STRING },
                  locationMatch: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
                required: ['donorId', 'matchTier', 'locationMatch', 'score', 'reason'],
              },
            },
          },
          required: ['summary', 'excludedUnavailableCount', 'matches'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI donor matching failed.';
    const status = message.includes('GEMINI_API_KEY') ? 500 : 502;
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sheryan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
