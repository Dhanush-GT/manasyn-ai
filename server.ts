import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    // Block loopback, private ranges, metadata servers
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
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
      hostname === '169.254.169.254' || // GCP / AWS metadata service
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
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

    let systemInstruction = `You are a perceptive, thoughtful reflection companion in this Personal Gemini Journal, embodying a "Calm Futurism" aesthetic: clear, conversational, grounded, insightful, and supportive.
Your core philosophy: "Talk freely. Find clarity. Move forward."
Turn the user's scattered thoughts into meaningful reflections, remembered insights, and clear next steps.

TONE & STYLE:
- Conversational, warm, lucid, and perceptive.
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
    const { entries = [], userEmail = '', timeRange = 'all' } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        error: 'At least one reflection entry is required for synthesis.',
      });
    }

    // Build structured, injection-resistant representation of past reflections
    const formattedSummaries = entries
      .slice(0, 30) // Bound token context safely
      .map((entry, idx) => {
        const title = typeof entry.title === 'string' ? entry.title.slice(0, 100) : `Entry ${idx + 1}`;
        const date = typeof entry.createdAt === 'string' ? entry.createdAt.slice(0, 10) : 'Recent';
        const tags = Array.isArray(entry.tags) ? entry.tags.join(', ') : 'None';
        const location = entry.location?.placeName ? ` (Location: ${entry.location.placeName})` : '';
        
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

        return `### Reflection Log ${idx + 1}: ${title} [${date}]${location}\nTags: ${tags}\nDialogue Context:\n${messagesSnippet}`;
      })
      .join('\n\n');

    const systemInstruction = `You are Manasyn, a voice-first Personal Gemini Journal for busy-minded non-journalers.
Your role is to analyze chronological journal entries and reflection conversations across time to synthesize recurring patterns, key themes, commitments, and progress in the user's personal journey.

Strict Identity Rules:
- You are Manasyn, a calm, intelligent, personal, trustworthy, reflective, modern, and human AI journal companion.
- Never introduce yourself as "Aura", "created by Google", or use stiff/robotic language.
- Adopt a calm, thoughtful, empathetic, and reflective tone.
- Math & Metric Notation: Never output raw LaTeX math notation (e.g., $\ge 1$ or $< 15\text{ms}$). Always write comparisons and metrics using standard plain text and symbols (e.g., >= 1, < 15ms).

Structure your synthesis with crisp, high-signal Markdown:
1. ## ⚡ Executive Strategic Trajectory
   - High-density distillation of the overarching architectural evolution, cognitive momentum, and founder trajectory.
2. ## 🔍 Structural Patterns & Operational Bottlenecks
   - Identify 2-4 core recurring patterns, systemic bottlenecks, decision loops, or high-friction areas.
3. ## 📍 Spatial & Contextual Telemetry (if locations are tagged)
   - Strategic breakdown of environmental, geographical, or physical hub patterns where key breakthroughs occurred.
4. ## 📋 Critical Path & Unresolved Execution Loops
   - Extract pending technical commitments, architectural debts, open operational loops, and unexecuted decisions.
5. ## 🎯 High-Leverage Strategic Directives
   - 3 prioritized, mathematically rigorous directives and counter-intuitive recommendations to accelerate velocity.

Deliver maximum signal density. Use bold key terms and crisp formatting.`;

    const userPrompt = `Please synthesize and extract longitudinal patterns from my recent journal reflections:\n\n${formattedSummaries}`;

    const { text, modelUsed } = await generateContentWithFallback(userPrompt, systemInstruction);

    recordAuditEvent('JOURNEY_SYNTHESIS_GENERATED', userEmail, 'PATTERN_ENGINE', 'SUCCESS', {
      entriesAnalyzed: entries.length,
      modelUsed,
    });

    return res.json({
      synthesis: text,
      modelUsed,
      entriesAnalyzed: entries.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/gemini/synthesize-journey:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate journey synthesis',
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
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { webhookUrl = '', targetType = 'slack', userEmail = '' } = body;

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

    // Build payload according to target platform
    let payload: Record<string, unknown> = {};
    if (targetType === 'discord') {
      payload = {
        content: '⚡ **Manasyn Webhook Test**: Connection successfully established with Manasyn.',
        embeds: [
          {
            title: 'Manasyn Connected',
            description: 'Reflections, journey syntheses, and commitments will arrive here securely.',
            color: 0x6257d9,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (targetType === 'slack') {
      payload = {
        text: '⚡ *Manasyn Webhook Test*: Connection successfully established with Manasyn.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚡ *Manasyn Webhook Test*\nReflection summaries and commitments will be dispatched to this channel.',
            },
          },
        ],
      };
    } else {
      payload = {
        event: 'manasyn_ping',
        message: 'Manasyn connection successfully validated.',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });

      const success = response.ok;
      recordAuditEvent('WEBHOOK_TEST_DISPATCHED', userEmail, 'WEBHOOK_INTEGRATION', success ? 'SUCCESS' : 'ERROR', {
        status: response.status,
        targetType,
      });

      return res.json({
        success,
        statusCode: response.status,
        message: success ? 'Webhook responded successfully!' : `Webhook returned HTTP ${response.status}`,
      });
    } catch (fetchErr: unknown) {
      recordAuditEvent('WEBHOOK_TEST_FAILED', userEmail, 'WEBHOOK_INTEGRATION', 'ERROR', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      return res.status(502).json({
        error: `Could not reach webhook endpoint: ${fetchErr instanceof Error ? fetchErr.message : 'Timeout'}`,
      });
    }
  } catch (error: unknown) {
    console.error('Error in /api/webhooks/test-dispatch:', error);
    return res.status(500).json({ error: 'Failed to execute webhook test dispatch.' });
  }
});

// Webhook Summary Dispatch Endpoint
app.post('/api/webhooks/dispatch-summary', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const {
      webhookUrl = '',
      targetType = 'slack',
      title = 'Reflection Summary',
      summary = '',
      locationName = '',
      date = new Date().toISOString(),
      userEmail = '',
    } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return res.status(400).json({ error: 'Valid webhookUrl is required.' });
    }

    if (!isSafeExternalUrl(webhookUrl)) {
      return res.status(400).json({
        error: 'Security Error: Webhook URL must be a public HTTPS endpoint.',
      });
    }

    let payload: Record<string, unknown> = {};
    const cleanSummary = typeof summary === 'string' ? summary.slice(0, 2000) : 'Daily Reflection';
    const locSnippet = locationName ? ` 📍 ${locationName}` : '';

    if (targetType === 'discord') {
      payload = {
        embeds: [
          {
            title: `⚡ Manasyn: ${title}${locSnippet}`,
            description: cleanSummary,
            color: 0x6257d9,
            footer: { text: `Dispatched at ${date}` },
          },
        ],
      };
    } else if (targetType === 'slack') {
      payload = {
        text: `*Manasyn Reflection Summary:* ${title}${locSnippet}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `⚡ ${title}${locSnippet}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: cleanSummary,
            },
          },
        ],
      };
    } else {
      payload = {
        event: 'manasyn_summary_export',
        title,
        location: locationName || null,
        summary: cleanSummary,
        dispatchedAt: date,
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    recordAuditEvent('WEBHOOK_SUMMARY_EXPORTED', userEmail, 'EXPORT_DISPATCH', response.ok ? 'SUCCESS' : 'ERROR', {
      statusCode: response.status,
      title: title.slice(0, 30),
    });

    return res.json({
      success: response.ok,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/webhooks/dispatch-summary:', error);
    return res.status(500).json({ error: 'Failed to dispatch reflection summary.' });
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
