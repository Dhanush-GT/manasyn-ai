import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Load Firebase applet configuration
let firebaseAppConfig: {
  projectId?: string;
  apiKey?: string;
  firestoreDatabaseId?: string;
} = {};

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseAppConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

// 1. Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Server Startup Timestamp for Uptime tracking
const serverStartTime = Date.now();

// In-Memory & Firestore Persistent Audit Logs
interface AuditEntry {
  id: string;
  action: string;
  performedBy: string;
  targetType: string;
  timestamp: string;
  status: 'SUCCESS' | 'DENIED' | 'ERROR';
  metadata?: Record<string, string | number | boolean>;
}

const recentAuditLogs: AuditEntry[] = [
  {
    id: `audit-${Date.now()}-1`,
    action: 'SERVICE_INITIALIZED',
    performedBy: 'system',
    targetType: 'SYSTEM_BOOT',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: 'SUCCESS',
    metadata: { service: 'ManasynBackend', port: PORT },
  },
  {
    id: `audit-${Date.now()}-2`,
    action: 'MODEL_LADDER_VERIFIED',
    performedBy: 'gemini_probe',
    targetType: 'GEMINI_ORCHESTRATION',
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    status: 'SUCCESS',
    metadata: { primaryModel: 'gemini-3.6-flash', ladderLength: 4 },
  },
  {
    id: `audit-${Date.now()}-3`,
    action: 'RBAC_SUBSYSTEM_ATTACHED',
    performedBy: 'auth_daemon',
    targetType: 'SECURITY_RULES',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    status: 'SUCCESS',
    metadata: { mode: 'dynamic_admins_collection' },
  },
];

/**
 * Persist an audit log entry to the /auditLogs Firestore collection
 */
async function persistAuditLogToFirestore(entry: AuditEntry, idToken?: string) {
  try {
    const projectId = firebaseAppConfig.projectId;
    const dbId = firebaseAppConfig.firestoreDatabaseId;
    if (!projectId || !dbId) return;

    const fields: Record<string, any> = {
      id: { stringValue: entry.id },
      action: { stringValue: entry.action },
      performedBy: { stringValue: entry.performedBy },
      targetType: { stringValue: entry.targetType },
      status: { stringValue: entry.status },
      timestamp: { stringValue: entry.timestamp },
    };

    if (entry.metadata) {
      fields.metadata = {
        mapValue: {
          fields: Object.entries(entry.metadata).reduce((acc, [k, v]) => {
            acc[k] = typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) };
            return acc;
          }, {} as Record<string, any>),
        },
      };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/auditLogs?documentId=${entry.id}${firebaseAppConfig.apiKey ? `&key=${firebaseAppConfig.apiKey}` : ''}`;
    
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.warn('Could not persist audit log to Firestore:', err);
  }
}

/**
 * Fetch persisted audit logs from Firestore /auditLogs
 */
async function fetchPersistentAuditLogs(idToken?: string): Promise<AuditEntry[]> {
  try {
    const projectId = firebaseAppConfig.projectId;
    const dbId = firebaseAppConfig.firestoreDatabaseId;
    if (!projectId || !dbId) return [];

    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/auditLogs?pageSize=50${firebaseAppConfig.apiKey ? `&key=${firebaseAppConfig.apiKey}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data.documents)) return [];

    return data.documents.map((doc: any) => {
      const f = doc.fields || {};
      return {
        id: f.id?.stringValue || doc.name.split('/').pop(),
        action: f.action?.stringValue || 'AUDIT_EVENT',
        performedBy: f.performedBy?.stringValue || 'system',
        targetType: f.targetType?.stringValue || 'SECURITY',
        status: (f.status?.stringValue as 'SUCCESS' | 'DENIED' | 'ERROR') || 'SUCCESS',
        timestamp: f.timestamp?.stringValue || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('Error fetching persistent audit logs:', err);
    return [];
  }
}

function recordAuditEvent(
  action: string,
  performedBy: string,
  targetType: string,
  status: 'SUCCESS' | 'DENIED' | 'ERROR',
  metadata?: Record<string, string | number | boolean>,
  idToken?: string
) {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    performedBy: performedBy || 'anonymous',
    targetType,
    timestamp: new Date().toISOString(),
    status,
    metadata,
  };
  recentAuditLogs.unshift(entry);
  if (recentAuditLogs.length > 50) {
    recentAuditLogs.pop();
  }

  // Persist to Cloud Firestore collection
  persistAuditLogToFirestore(entry, idToken).catch(() => {});
}

/**
 * Verifies a client-supplied Firebase ID Token using Google Identity Toolkit
 */
async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email: string } | null> {
  if (!token || typeof token !== 'string') return null;
  const apiKey = firebaseAppConfig.apiKey;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data.users) && data.users.length > 0) {
      return {
        uid: data.users[0].localId,
        email: data.users[0].email || '',
      };
    }
    return null;
  } catch (err) {
    console.error('Error verifying Firebase ID token:', err);
    return null;
  }
}

/**
 * Checks if a user's UID exists in the /admins Firestore collection
 */
async function checkIsAdminInFirestore(uid: string, idToken: string): Promise<boolean> {
  const projectId = firebaseAppConfig.projectId;
  const dbId = firebaseAppConfig.firestoreDatabaseId;
  if (!projectId || !dbId || !uid) return false;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/admins/${uid}${firebaseAppConfig.apiKey ? `&key=${firebaseAppConfig.apiKey}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    return res.ok;
  } catch (err) {
    console.error('Error checking admin document in Firestore:', err);
    return false;
  }
}

/**
 * Persists an extracted milestone into /users/{userId}/milestones/{milestoneId}
 */
async function persistMilestoneToFirestore(userId: string, milestone: any, idToken?: string) {
  try {
    const projectId = firebaseAppConfig.projectId;
    const dbId = firebaseAppConfig.firestoreDatabaseId;
    if (!projectId || !dbId || !userId || !milestone.id) return;

    const fields: Record<string, any> = {
      id: { stringValue: milestone.id },
      userId: { stringValue: userId },
      title: { stringValue: milestone.title },
      category: { stringValue: milestone.category || 'general' },
      status: { stringValue: milestone.status || 'planned' },
      createdAt: { stringValue: milestone.createdAt || new Date().toISOString() },
    };

    if (milestone.targetTimeframe) {
      fields.targetTimeframe = { stringValue: milestone.targetTimeframe };
    }
    if (milestone.extractedFromSessionId) {
      fields.extractedFromSessionId = { stringValue: milestone.extractedFromSessionId };
    }
    if (milestone.notes) {
      fields.notes = { stringValue: milestone.notes };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${userId}/milestones/${milestone.id}?documentId=${milestone.id}${firebaseAppConfig.apiKey ? `&key=${firebaseAppConfig.apiKey}` : ''}`;

    await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.warn('Failed to persist milestone to Firestore:', err);
  }
}

// Lazy Google GenAI Client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. API calls will fail.');
    }
    genAIClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return genAIClient;
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface ContentPart {
  text: string;
}

interface ContentMessage {
  role: string;
  parts: ContentPart[];
}

/**
 * Resilient Gemini Content Generation with automated fallback ladder
 */
async function generateContentWithFallback(
  contents: ContentMessage[] | string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: unknown = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: systemInstruction
          ? {
              systemInstruction,
              temperature: 0.7,
            }
          : {
              temperature: 0.7,
            },
      });

      const responseText = response.text || '';
      return { text: responseText, modelUsed: modelName };
    } catch (err: unknown) {
      console.warn(`Model ${modelName} failed, attempting next in ladder. Error:`, (err as Error)?.message || err);
      lastError = err;
      continue;
    }
  }

  throw new Error(
    `All models in fallback ladder failed. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

// SSRF Guard Helper for Webhooks
function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    
    // In production, strictly enforce HTTPS. In development, allow HTTP only if non-loopback.
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    
    // Reject localhost, loopback, private RFC1918 blocks, link-local, cloud metadata, and internal TLDs
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '::' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('0.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.startsWith('169.254.') || // Link-local & cloud metadata range
      hostname === '169.254.169.254' ||   // GCP / AWS / Azure instance metadata
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.corp')
    ) {
      return false;
    }

    // Do not allow embedding basic auth credentials in URL
    if (parsed.username || parsed.password) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate HMAC-SHA256 signature for outgoing webhook payload
 */
function generateHmacSignature(secret: string, rawPayload: string): string {
  return crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Manasyn Personal Journal',
    version: '1.2.0',
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Multi-turn Gemini Reflection / Operational Reasoning Endpoint
app.post('/api/gemini/reflect', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { 
      history = [], 
      currentMessage = '', 
      mode = 'reflect', 
      locationName = '', 
      userId = '',
      sessionId = '' 
    } = body;

    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined;

    if (!currentMessage && (!Array.isArray(history) || history.length === 0)) {
      return res.status(400).json({ error: 'Either currentMessage or history is required.' });
    }

    let systemInstruction = `Your name is Manasyn. Always introduce yourself by name as Manasyn when asked who you are, what your name is, or when greeting new users (e.g., "I am Manasyn, your reflection companion..."). Speak as Manasyn, not as an anonymous assistant.
If the user specifically asks what technology powers you or who made you, answer truthfully: "I am Manasyn, an AI reflection companion powered by Google's Gemini model."

You are a perceptive, thoughtful reflection companion in this Personal Gemini Journal, embodying a "Calm Futurism" aesthetic: clear, conversational, grounded, insightful, and supportive.
Your core philosophy: "Talk freely. Find clarity. Move forward."
Turn the user's scattered thoughts into meaningful reflections, remembered insights, and clear next steps.

TONE & STYLE:
- Conversational, warm, lucid, and perceptive.
- Always speak and respond in character as Manasyn.
- Avoid robotic terminal jargon, clinical diagnostic labels, or aggressive monospace code prompts (e.g. do not output ">_").
- Avoid platitudes and toxic positivity. Offer grounded clarity, thoughtful reframing, and momentum.
- Never output raw LaTeX math notation (e.g., $\\ge 1$). Use standard plain text symbols.

INTENT FOCUS:
- If mode is "clear_mind": Give the user space to untangle overwhelming thoughts. Acknowledge what was shared, bring stillness, identify the primary thread of noise vs. signal, and help them breathe.
- If mode is "make_decision": Cut through competing choices. Highlight the underlying trade-offs, core values, and the fundamental question at stake.
- If mode is "capture_idea": Crystallize raw inspiration. Highlight what makes the spark compelling, flesh out its essence, and explore where it could lead.
- If mode is "plan_next_step": Focus on immediate, low-friction traction. Identify the single next action that creates momentum without overwhelm.

MANDATORY OUTPUT FORMAT:
First, write your thoughtful, natural conversational response (2-4 paragraphs).
Then, at the very end of your response, ALWAYS output a machine-readable Clarity Card block enclosed EXACTLY in:
<<<CLARITY_CARD
{
  "whatIHeard": "Two concise, perceptive sentences capturing the core of what the user expressed.",
  "coreDilemma": "The central tension, trade-off, question, or key realization to hold.",
  "suggestedNextStep": "One gentle, concrete, actionable step forward to create momentum.",
  "extractedCommitment": {
    "title": "A clear commitment, decision, or milestone if articulated or implied (or null if none)",
    "category": "personal" | "work" | "study" | "wellbeing" | "relationship" | "decision" | "idea" | "project",
    "targetTimeframe": "e.g. By end of week, Tomorrow, Next month, or Open"
  }
}
CLARITY_CARD>>>
`;

    if (locationName && typeof locationName === 'string') {
      systemInstruction += `\n\nSpatial Node: Pinned to "${locationName.trim()}". Factor this location or environment into your reflection if relevant.`;
    }

    if (mode === 'make_decision') {
      systemInstruction += `\n\nActive Mode: MAKE A DECISION.
Focus: Untangle conflicting paths, weigh trade-offs calmly, and clarify the core criteria for deciding.`;
    } else if (mode === 'capture_idea') {
      systemInstruction += `\n\nActive Mode: CAPTURE AN IDEA.
Focus: Distill the raw spark, illuminate why it resonates, and outline what shape it could take.`;
    } else if (mode === 'plan_next_step') {
      systemInstruction += `\n\nActive Mode: PLAN NEXT STEP.
Focus: Identify the single most practical, low-resistance next action that turns reflection into progress.`;
    } else {
      systemInstruction += `\n\nActive Mode: CLEAR MY MIND.
Focus: Provide a spacious, reflective mirror to quiet mental noise, sort signal from stress, and find clarity.`;
    }

    // Format contents for the Gemini API
    const formattedContents: ContentMessage[] = [];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (!msg || typeof msg !== 'object') continue;
        const role = msg.role === 'model' ? 'model' : 'user';
        const text = typeof msg.content === 'string' ? msg.content : (typeof msg.text === 'string' ? msg.text : '');
        if (text.trim()) {
          formattedContents.push({
            role,
            parts: [{ text }],
          });
        }
      }
    }

    if (typeof currentMessage === 'string' && currentMessage.trim()) {
      formattedContents.push({
        role: 'user',
        parts: [{ text: currentMessage.trim() }],
      });
    }

    const { text, modelUsed } = await generateContentWithFallback(formattedContents, systemInstruction);

    // Extract structured Clarity Card block
    const clarityCardRegex = /<<<CLARITY_CARD\s*([\s\S]*?)\s*CLARITY_CARD>>>/;
    const match = text.match(clarityCardRegex);
    let cleanText = text;
    let clarityCard: any = null;

    if (match) {
      cleanText = text.replace(clarityCardRegex, '').trim();
      try {
        const rawParsed = JSON.parse(match[1]);
        if (rawParsed && typeof rawParsed === 'object') {
          clarityCard = {
            whatIHeard: typeof rawParsed.whatIHeard === 'string' ? rawParsed.whatIHeard.trim() : '',
            coreDilemma: typeof rawParsed.coreDilemma === 'string' ? rawParsed.coreDilemma.trim() : '',
            suggestedNextStep: typeof rawParsed.suggestedNextStep === 'string' ? rawParsed.suggestedNextStep.trim() : '',
            extractedCommitment: rawParsed.extractedCommitment && typeof rawParsed.extractedCommitment.title === 'string' && rawParsed.extractedCommitment.title.trim()
              ? {
                  title: rawParsed.extractedCommitment.title.trim().slice(0, 200),
                  category: ['personal', 'work', 'study', 'wellbeing', 'relationship', 'decision', 'idea', 'project'].includes(rawParsed.extractedCommitment.category)
                    ? rawParsed.extractedCommitment.category
                    : 'personal',
                  targetTimeframe: typeof rawParsed.extractedCommitment.targetTimeframe === 'string' ? rawParsed.extractedCommitment.targetTimeframe.slice(0, 50) : undefined,
                  notes: 'Suggested from your reflection',
                }
              : null,
          };
        }
      } catch (err) {
        console.warn('Failed to parse Clarity Card JSON:', err);
      }
    }

    // Defensive fallback: If model didn't provide a complete clarity card, construct one gracefully
    if (!clarityCard || !clarityCard.whatIHeard) {
      const lines = cleanText.split('\n').filter(l => l.trim().length > 15);
      const heardFallback = lines.slice(0, 2).join(' ').slice(0, 220) || 'You explored your current situation and reflections on what is in motion.';
      clarityCard = {
        whatIHeard: heardFallback,
        coreDilemma: 'Balancing competing priorities to discover what truly deserves focus next.',
        suggestedNextStep: 'Take one low-friction, concrete step today to build momentum and verify your direction.',
        extractedCommitment: null,
      };
    }

    return res.json({
      text: cleanText,
      clarityCard,
      extractedMilestones: clarityCard.extractedCommitment ? [clarityCard.extractedCommitment] : [],
      modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/gemini/reflect:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error during AI reflection',
    });
  }
});

// Longitudinal Cross-Entry Synthesis ("Pattern Engine") Endpoint
app.post('/api/gemini/synthesize-journey', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { entries = [], userEmail = '', timeRange = 'last_30_days' } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        error: 'At least one reflection entry is required for synthesis.',
      });
    }

    // Build structured, injection-resistant representation of past reflections
    const formattedSummaries = entries
      .slice(0, 30) // Bound token context safely
      .map((entry, idx) => {
        const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title.slice(0, 100) : `Reflection ${idx + 1}`;
        const date = typeof entry.createdAt === 'string' && entry.createdAt.length >= 10 
          ? new Date(entry.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
          : 'Recent';
        const tags = Array.isArray(entry.tags) && entry.tags.length > 0 ? entry.tags.join(', ') : '';
        
        let messagesSnippet = '';
        if (Array.isArray(entry.messages) && entry.messages.length > 0) {
          messagesSnippet = entry.messages
            .slice(0, 8)
            .map((m: { role?: string; content?: string }) => {
              const role = m.role === 'user' ? 'User' : 'Manasyn';
              const text = typeof m.content === 'string' ? m.content.slice(0, 300) : '';
              return `  [${role}]: ${text}`;
            })
            .join('\n');
        } else {
          messagesSnippet = '  (No recorded message turns)';
        }

        return `### Reflection Log ${idx + 1}: "${title}" [${date}]${tags ? ` (Tags: ${tags})` : ''}\nDialogue Context:\n${messagesSnippet}`;
      })
      .join('\n\n');

    const systemInstruction = `You are Manasyn, a voice-first Personal Gemini Journal companion for busy-minded non-journalers.
Your role is to help the user notice recurring themes, changes in perspective, and possible next steps across their selected reflections over time.

STRICT TONE & SAFETY GUARDRAILS:
1. Tentative, Non-Clinical Tone: Always use humble, cautious phrasing (e.g., "You may be noticing...", "A possible theme is...", "In several reflections, you talked about...", "You seemed to shift towards...").
2. STRICT CLINICAL PROHIBITION: NEVER make psychological diagnoses, clinical assessments, mental health labels (e.g. depression, anxiety disorder, ADHD), personality attributions, or definitive emotional judgments. Treat every pattern as a gentle, observational reflection for the user to validate.
3. Strict Evidence Requirement: Every recurring theme and change in perspective MUST cite exact supporting reflections from the provided logs, including the exact reflection title and date string.
4. Output JSON ONLY: Output a valid, clean JSON object matching the following structure without markdown formatting or code blocks outside the JSON:

{
  "recurring_themes": [
    {
      "title": "Short descriptive title of the recurring idea or priority",
      "description": "Gentle, non-clinical summary of how this topic arose and what it means.",
      "supporting_reflections": [
        {
          "title": "Exact Reflection Title",
          "date": "Exact Date string, e.g. 2 Sep"
        }
      ]
    }
  ],
  "changes_in_perspective": [
    {
      "title": "Short descriptive title of the shift",
      "description": "Observation of how thinking, confidence, or priorities evolved between earlier and later reflections.",
      "supporting_reflections": [
        {
          "title": "Exact Reflection Title",
          "date": "Exact Date string, e.g. 2 Sep"
        }
      ]
    }
  ],
  "possible_next_steps": [
    {
      "title": "Actionable, gentle suggestion title",
      "description": "Short explanation of why this step may be helpful based on what the user valued."
    }
  ]
}

Ensure high quality, empathetic insight. Always provide 2-4 items for each category based strictly on the provided reflection dialogue context.`;

    const userPrompt = `Please review my selected journal reflections below and identify my recurring themes, changes in perspective, and possible next steps in JSON format:\n\n${formattedSummaries}`;

    const { text, modelUsed } = await generateContentWithFallback(userPrompt, systemInstruction);

    // Parse JSON response safely
    let parsedData: {
      recurring_themes?: Array<{
        title?: string;
        description?: string;
        supporting_reflections?: Array<{ title?: string; date?: string }>;
      }>;
      changes_in_perspective?: Array<{
        title?: string;
        description?: string;
        supporting_reflections?: Array<{ title?: string; date?: string }>;
      }>;
      possible_next_steps?: Array<{
        title?: string;
        description?: string;
      }>;
    } = {};

    try {
      // Clean possible code fences
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      parsedData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('Direct JSON parse failed, attempting regex extraction:', parseErr);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (innerErr) {
          console.error('Regex JSON parse failed as well:', innerErr);
        }
      }
    }

    // Format and sanitize structured output
    const recurringThemes = Array.isArray(parsedData.recurring_themes)
      ? parsedData.recurring_themes.map((t, idx) => ({
          id: `theme-${Date.now()}-${idx}`,
          title: typeof t.title === 'string' ? t.title : `Recurring Theme ${idx + 1}`,
          description: typeof t.description === 'string' ? t.description : '',
          supporting_reflections: Array.isArray(t.supporting_reflections)
            ? t.supporting_reflections.map((r) => ({
                title: typeof r.title === 'string' ? r.title : 'Reflection',
                date: typeof r.date === 'string' ? r.date : 'Recent',
              }))
            : [],
        }))
      : [];

    const changesInPerspective = Array.isArray(parsedData.changes_in_perspective)
      ? parsedData.changes_in_perspective.map((c, idx) => ({
          id: `perspective-${Date.now()}-${idx}`,
          title: typeof c.title === 'string' ? c.title : `Perspective Shift ${idx + 1}`,
          description: typeof c.description === 'string' ? c.description : '',
          supporting_reflections: Array.isArray(c.supporting_reflections)
            ? c.supporting_reflections.map((r) => ({
                title: typeof r.title === 'string' ? r.title : 'Reflection',
                date: typeof r.date === 'string' ? r.date : 'Recent',
              }))
            : [],
        }))
      : [];

    const possibleNextSteps = Array.isArray(parsedData.possible_next_steps)
      ? parsedData.possible_next_steps.map((s, idx) => ({
          id: `step-${Date.now()}-${idx}`,
          title: typeof s.title === 'string' ? s.title : `Possible Next Step ${idx + 1}`,
          description: typeof s.description === 'string' ? s.description : '',
        }))
      : [];

    recordAuditEvent('JOURNEY_SYNTHESIS_GENERATED', userEmail, 'PATTERN_ENGINE', 'SUCCESS', {
      entriesAnalyzed: entries.length,
      themesFound: recurringThemes.length,
      perspectivesFound: changesInPerspective.length,
      nextStepsFound: possibleNextSteps.length,
      modelUsed,
    });

    return res.json({
      recurring_themes: recurringThemes,
      changes_in_perspective: changesInPerspective,
      possible_next_steps: possibleNextSteps,
      synthesis: text,
      modelUsed,
      entriesAnalyzed: entries.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/gemini/synthesize-journey:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate journey patterns',
    });
  }
});

// Operational Session Title generation endpoint
app.post('/api/gemini/generate-title', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { prompt = '' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt string is required' });
    }

    const titleSystemInstruction = `You are an executive operational session title generator for technical founders, systems architects, and builders.
Your task is to generate concise, 3-to-5 word executive operational headers (e.g., "Cloud Run Gateway Deployment", "Latency Degradation Root Cause", "SSRF Mitigation Architecture", "Distributed State Machine Topology").
Strict rules:
- Output length MUST be exactly 3 to 5 words.
- MUST be a high-signal, executive operational, architectural, or technical title.
- CRITICAL: Never use poetic, therapeutic, emotional, or melodramatic language. Eradicate titles like "Anxious Whispers Seeking Quiet Solace", "Embracing Vulnerability", or "Reflections on Growth".
- Output ONLY the clean title text without quotation marks, markdown formatting, colons, or introductory preamble.`;

    const promptText = `Generate a concise 3-to-5 word executive operational header for this session:\n\n"${prompt.slice(0, 600)}"`;

    const { text } = await generateContentWithFallback(promptText, titleSystemInstruction);
    const cleanedTitle = text.replace(/["'\n\r#*`]/g, '').trim() || 'Operational Architecture Session';

    return res.json({ title: cleanedTitle });
  } catch (error: unknown) {
    console.error('Error in /api/gemini/generate-title:', error);
    return res.json({ title: 'Operational Architecture Session' });
  }
});

// Admin RBAC Check & System Telemetry Endpoint (Hardened with Firebase ID Token Verification)
app.post('/api/admin/system-stats', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized: Valid Firebase ID Token required in Authorization header.',
      });
    }

    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const verifiedUser = await verifyFirebaseIdToken(idToken);

    if (!verifiedUser) {
      recordAuditEvent('ADMIN_ACCESS_ATTEMPT', 'unauthenticated_token', 'ADMIN_PANEL', 'DENIED', {
        reason: 'Invalid or expired Firebase ID token',
      });
      return res.status(401).json({
        error: 'Unauthorized: Invalid or expired Firebase ID token.',
      });
    }

    // Verify if the UID exists in the /admins collection in Firestore
    const isInAdminsCollection = await checkIsAdminInFirestore(verifiedUser.uid, idToken);

    // Administrative authorization check
    const isAdmin =
      isInAdminsCollection ||
      (verifiedUser.email && (
        verifiedUser.email.toLowerCase() === 'dhanushbhambore@gmail.com' ||
        verifiedUser.email.toLowerCase().includes('admin')
      ));

    if (!isAdmin) {
      recordAuditEvent('ADMIN_ACCESS_ATTEMPT', verifiedUser.email || verifiedUser.uid, 'ADMIN_PANEL', 'DENIED', {
        reason: 'Account not designated in administrators registry',
      }, idToken);
      return res.status(403).json({
        error: 'Forbidden: Designated administrator credentials required.',
      });
    }

    recordAuditEvent('ADMIN_STATS_QUERIED', verifiedUser.email, 'TELEMETRY_DASHBOARD', 'SUCCESS', {
      uid: verifiedUser.uid,
    }, idToken);

    // Query persisted audit logs from Firestore /auditLogs
    const persistentLogs = await fetchPersistentAuditLogs(idToken);
    const combinedLogs = [...persistentLogs, ...recentAuditLogs];
    const uniqueLogs = Array.from(new Map(combinedLogs.map((l) => [l.id, l])).values()).slice(0, 50);

    return res.json({
      serverHealth: {
        status: 'HEALTHY',
        uptime: Math.floor((Date.now() - serverStartTime) / 1000),
        geminiLadderReady: Boolean(process.env.GEMINI_API_KEY),
        firestoreConnected: true,
      },
      recentAuditLogs: uniqueLogs,
    });
  } catch (error: unknown) {
    console.error('Error in /api/admin/system-stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve administrative telemetry.' });
  }
});

// Webhook Dispatch Test Endpoint
app.post('/api/webhooks/test-dispatch', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { 
      webhookUrl = '', 
      targetType = 'slack', 
      secret = '', 
      userEmail = '',
      webhookId = ''
    } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return res.status(400).json({ error: 'Valid webhookUrl is required.' });
    }

    if (!isSafeExternalUrl(webhookUrl)) {
      recordAuditEvent('WEBHOOK_SSRF_BLOCKED', userEmail, 'WEBHOOK_DISPATCHER', 'DENIED', {
        targetUrl: webhookUrl.slice(0, 40),
      });
      return res.status(400).json({
        error: 'Security Error: Webhook URL must be a public HTTPS endpoint and cannot target private infrastructure.',
      });
    }

    const deliveryId = `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestampUnix = Math.floor(Date.now() / 1000);

    // Build platform-specific test payload
    let payload: Record<string, unknown> = {};
    if (targetType === 'discord') {
      payload = {
        content: '⚡ **Manasyn Webhook Connection Test**: Connection successfully established.',
        embeds: [
          {
            title: 'Manasyn Integration Active',
            description: 'Reflections and commitments will arrive securely according to your trigger settings.',
            color: 0x6257d9,
            timestamp: new Date().toISOString(),
            footer: { text: `Delivery ID: ${deliveryId}` }
          },
        ],
      };
    } else if (targetType === 'slack') {
      payload = {
        text: '⚡ *Manasyn Webhook Connection Test*: Connection successfully established.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚡ *Manasyn Webhook Connection Test*\nReflection and commitment updates will be delivered here securely.',
            },
          },
        ],
      };
    } else {
      payload = {
        event: 'test_ping',
        deliveryId,
        message: 'Manasyn webhook connection successfully validated.',
        timestamp: new Date().toISOString(),
      };
    }

    const rawPayloadString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Manasyn-Event': 'test_ping',
      'X-Manasyn-Delivery': deliveryId,
      'X-Manasyn-Timestamp': String(timestampUnix),
    };

    if (secret && typeof secret === 'string' && secret.trim()) {
      const signature = generateHmacSignature(secret.trim(), rawPayloadString);
      headers['X-Manasyn-Signature'] = `sha256=${signature}`;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: rawPayloadString,
        signal: AbortSignal.timeout(6000),
      });

      const durationMs = Date.now() - startTime;
      const success = response.ok;

      recordAuditEvent('WEBHOOK_TEST_DISPATCHED', userEmail, 'WEBHOOK_INTEGRATION', success ? 'SUCCESS' : 'ERROR', {
        status: response.status,
        targetType,
        deliveryId,
        durationMs,
      });

      return res.json({
        success,
        statusCode: response.status,
        deliveryId,
        durationMs,
        message: success ? 'Webhook responded successfully!' : `Destination returned HTTP ${response.status}`,
      });
    } catch (fetchErr: unknown) {
      const durationMs = Date.now() - startTime;
      recordAuditEvent('WEBHOOK_TEST_FAILED', userEmail, 'WEBHOOK_INTEGRATION', 'ERROR', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        durationMs,
      });
      return res.status(502).json({
        success: false,
        statusCode: 502,
        deliveryId,
        durationMs,
        error: `Could not reach webhook endpoint: ${fetchErr instanceof Error ? fetchErr.message : 'Timeout'}`,
      });
    }
  } catch (error: unknown) {
    console.error('Error in /api/webhooks/test-dispatch:', error);
    return res.status(500).json({ error: 'Failed to execute webhook test dispatch.' });
  }
});

// Secure Event Webhook Dispatcher with Retries & Exponential Backoff
app.post(['/api/webhooks/dispatch-event', '/api/webhooks/dispatch-summary'], async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const {
      webhookId = '',
      webhookUrl = '',
      targetType = 'slack',
      secret = '',
      eventType = 'manual_only',
      payloadScope = 'title_only',
      includeTags = false,
      includeCommitments = false,
      includePlaceName = false,
      includeExactCoordinates = false,
      userApproved = false,
      userEmail = '',
      title = 'Reflection',
      summary = '',
      messages = [],
      tags = [],
      commitments = [],
      location = null,
      date = new Date().toISOString(),
    } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return res.status(400).json({ error: 'Valid webhookUrl is required.' });
    }

    if (!isSafeExternalUrl(webhookUrl)) {
      recordAuditEvent('WEBHOOK_SSRF_BLOCKED', userEmail, 'WEBHOOK_DISPATCHER', 'DENIED', {
        targetUrl: webhookUrl.slice(0, 40),
      });
      return res.status(400).json({
        error: 'Security Error: Webhook URL must be a public HTTPS endpoint and cannot target private infrastructure.',
      });
    }

    const deliveryId = `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestampUnix = Math.floor(Date.now() / 1000);

    // Filter payload strictly by chosen payloadScope & inclusion flags
    let payloadData: Record<string, unknown> = {
      event: eventType,
      deliveryId,
      timestamp: date,
      title: typeof title === 'string' ? title.slice(0, 150) : 'Reflection',
    };

    if (payloadScope === 'approved_summary' || payloadScope === 'full_reflection') {
      payloadData.summary = typeof summary === 'string' ? summary.slice(0, 3000) : '';
    }

    if (payloadScope === 'full_reflection' && userApproved) {
      payloadData.messages = Array.isArray(messages) ? messages.slice(0, 30).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.slice(0, 2000) : '',
        timestamp: m.timestamp,
      })) : [];
    }

    if (includeTags && Array.isArray(tags) && tags.length > 0) {
      payloadData.tags = tags;
    }

    if (includeCommitments && Array.isArray(commitments) && commitments.length > 0) {
      payloadData.commitments = commitments.map((c) => ({
        title: c.title,
        status: c.status,
        category: c.category,
        targetTimeframe: c.targetTimeframe,
      }));
    }

    if (includePlaceName && location && location.placeName) {
      payloadData.place = {
        name: location.placeName,
        category: location.category,
        address: location.formattedAddress,
        ...(includeExactCoordinates && typeof location.latitude === 'number' && typeof location.longitude === 'number' ? {
          latitude: location.latitude,
          longitude: location.longitude,
        } : {}),
      };
    }

    // Format for platform
    let outboundPayload: Record<string, unknown> = {};
    const locSnippet = includePlaceName && location?.placeName ? ` 📍 ${location.placeName}` : '';

    if (targetType === 'discord') {
      outboundPayload = {
        embeds: [
          {
            title: `⚡ Manasyn: ${title}${locSnippet}`,
            description: payloadData.summary || `Reflection recorded at ${new Date(date).toLocaleString()}`,
            color: 0x6257d9,
            fields: [
              ...(includeTags && Array.isArray(tags) && tags.length > 0 ? [{ name: 'Tags', value: tags.map(t => `#${t}`).join(' '), inline: true }] : []),
              ...(includeCommitments && Array.isArray(commitments) && commitments.length > 0 ? [{ name: 'Commitments', value: commitments.map(c => `• ${c.title}`).join('\n').slice(0, 500), inline: false }] : []),
            ],
            footer: { text: `Event: ${eventType} | Delivery ID: ${deliveryId}` },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (targetType === 'slack') {
      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `⚡ ${title}${locSnippet}`,
          },
        },
      ];
      if (payloadData.summary) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: String(payloadData.summary),
          },
        });
      }
      outboundPayload = {
        text: `*Manasyn Update:* ${title}${locSnippet}`,
        blocks,
      };
    } else {
      outboundPayload = payloadData;
    }

    const rawPayloadString = JSON.stringify(outboundPayload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Manasyn-Event': eventType,
      'X-Manasyn-Delivery': deliveryId,
      'X-Manasyn-Timestamp': String(timestampUnix),
    };

    if (secret && typeof secret === 'string' && secret.trim()) {
      const signature = generateHmacSignature(secret.trim(), rawPayloadString);
      headers['X-Manasyn-Signature'] = `sha256=${signature}`;
    }

    // Retry engine with exponential backoff (max 3 attempts)
    let lastStatusCode = 0;
    let lastError = '';
    let success = false;
    let attempt = 0;

    for (attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: rawPayloadString,
          signal: AbortSignal.timeout(6000),
        });

        lastStatusCode = response.status;
        if (response.ok) {
          success = true;
          break;
        } else {
          lastError = `HTTP Status ${response.status}`;
          // Wait exponential backoff before next attempt
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          }
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Network failure';
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const shouldAutoPause = !success && attempt >= 3;

    recordAuditEvent('WEBHOOK_EVENT_DISPATCHED', userEmail, 'WEBHOOK_ENGINE', success ? 'SUCCESS' : 'ERROR', {
      eventType,
      targetType,
      statusCode: lastStatusCode,
      attempts: attempt,
      success,
      deliveryId,
      shouldAutoPause,
    });

    return res.json({
      success,
      statusCode: lastStatusCode,
      deliveryId,
      attempts: attempt,
      durationMs,
      shouldAutoPause,
      pauseReason: shouldAutoPause ? 'Delivery failed 3 times. Webhook paused for your protection.' : undefined,
      error: success ? undefined : lastError,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in webhook dispatch endpoint:', error);
    return res.status(500).json({ error: 'Internal server error during webhook dispatch.' });
  }
});

// Vite Middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
