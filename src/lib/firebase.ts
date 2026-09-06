import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query, 
  orderBy, 
  onSnapshot,
  getDocFromServer,
  type Unsubscribe 
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { stripUndefined } from './sanitize';
import type { ReflectionEntry, UserProfile, WebhookConfig, Milestone, MilestoneStatus, FeedbackEntry, FeedbackCategory } from '../types';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfigJson.firestoreDatabaseId || undefined);

// Validate connection on boot
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (
      err?.code === 'unavailable' ||
      err?.code === 'permission-denied' ||
      (typeof err?.message === 'string' && (err.message.includes('offline') || err.message.includes('unavailable')))
    ) {
      console.info('Firestore client ready (operating with offline cache fallback).');
    } else {
      console.warn('Firebase connection check:', err?.message || String(error));
    }
  }
})();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Check if a user has admin rights by verifying /admins/{uid} in Firestore
 */
export async function verifyUserIsAdmin(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    return adminDoc.exists();
  } catch (err) {
    return false;
  }
}

/**
 * Legacy synchronous fallback for backward compatibility
 */
export function checkIsAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().includes('admin');
}

/**
 * Subscribe to Authentication state changes with Firestore RBAC resolution
 */
export function subscribeToAuth(callback: (user: UserProfile | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      let isAdmin = false;
      try {
        isAdmin = await verifyUserIsAdmin(user.uid);
      } catch {
        isAdmin = false;
      }

      callback({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        isAdmin,
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Save or update a reflection/interaction entry for a specific user
 * User Data Isolation path: /users/{userId}/interactions/{entryId}
 * Enforces requirement: A reflection document is ONLY persisted upon user sending their first message.
 */
export async function saveInteraction(userId: string, entry: ReflectionEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to persist interaction');
  if (!entry.id) throw new Error('Entry ID is required');

  // Hard stop: Never persist empty reflections to Firestore
  if (!entry.messages || entry.messages.length === 0) {
    return;
  }

  const cleanPayload = stripUndefined({
    ...entry,
    userId,
    updatedAt: new Date().toISOString(),
  });

  const entryPath = `users/${userId}/interactions/${entry.id}`;
  try {
    const entryRef = doc(db, 'users', userId, 'interactions', entry.id);
    await setDoc(entryRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, entryPath);
  }
}

/**
 * Delete a reflection/interaction entry for a specific user
 */
export async function deleteInteraction(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('User ID and Entry ID are required to delete');
  const entryPath = `users/${userId}/interactions/${entryId}`;
  try {
    const entryRef = doc(db, 'users', userId, 'interactions', entryId);
    await deleteDoc(entryRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, entryPath);
  }
}

/**
 * Subscribe to a user's real-time reflection history
 * Ignores empty (0-message) documents to ensure clean logs
 */
export function subscribeUserInteractions(
  userId: string,
  onData: (entries: ReflectionEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const interactionsPath = `users/${userId}/interactions`;
  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: ReflectionEntry[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as ReflectionEntry;
        // Filter out any empty reflections with 0 messages
        if (data.messages && data.messages.length > 0) {
          entries.push({
            ...data,
            id: docSnapshot.id,
          });
        }
      });
      onData(entries);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, interactionsPath);
      onError(err);
    }
  );
}

/**
 * Submit user feedback to /feedback Firestore collection
 */
export async function submitFeedback(
  userId: string,
  userEmail: string | null,
  userName: string | null,
  message: string,
  category: FeedbackCategory = 'general'
): Promise<string> {
  if (!userId) throw new Error('Authentication required to submit feedback');
  if (!message.trim()) throw new Error('Feedback message cannot be empty');

  const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const feedbackDoc: FeedbackEntry = {
    id: feedbackId,
    userId,
    userEmail: userEmail || null,
    userName: userName || null,
    message: message.trim(),
    category,
    createdAt: new Date().toISOString(),
  };

  const cleanPayload = stripUndefined(feedbackDoc);
  const feedbackRef = doc(db, 'feedback', feedbackId);
  try {
    await setDoc(feedbackRef, cleanPayload);
    return feedbackId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `feedback/${feedbackId}`);
    throw err;
  }
}

/**
 * Fetch all user feedback entries (Admin only)
 */
export async function getFeedbackEntries(): Promise<FeedbackEntry[]> {
  const feedbackRef = collection(db, 'feedback');
  const q = query(feedbackRef, orderBy('createdAt', 'desc'));
  try {
    const snapshot = await getDocs(q);
    const feedbackList: FeedbackEntry[] = [];
    snapshot.forEach((docSnap) => {
      feedbackList.push(docSnap.data() as FeedbackEntry);
    });
    return feedbackList;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'feedback');
    return [];
  }
}

/**
 * Save user webhook configuration
 */
export async function saveWebhookConfig(userId: string, config: WebhookConfig): Promise<void> {
  if (!userId || !config.id) throw new Error('User ID and Config ID are required');
  const configPath = `users/${userId}/webhookConfigs/${config.id}`;
  const cleanPayload = stripUndefined({
    ...config,
    userId,
  });

  try {
    const ref = doc(db, 'users', userId, 'webhookConfigs', config.id);
    await setDoc(ref, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, configPath);
  }
}

/**
 * Delete user webhook configuration
 */
export async function deleteWebhookConfig(userId: string, configId: string): Promise<void> {
  if (!userId || !configId) throw new Error('User ID and Config ID are required');
  const configPath = `users/${userId}/webhookConfigs/${configId}`;
  try {
    const ref = doc(db, 'users', userId, 'webhookConfigs', configId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, configPath);
  }
}

/**
 * Subscribe to user webhook configs
 */
export function subscribeWebhookConfigs(
  userId: string,
  onData: (configs: WebhookConfig[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/webhookConfigs`;
  const ref = collection(db, 'users', userId, 'webhookConfigs');

  return onSnapshot(
    ref,
    (snapshot) => {
      const configs: WebhookConfig[] = [];
      snapshot.forEach((docSnapshot) => {
        configs.push(docSnapshot.data() as WebhookConfig);
      });
      onData(configs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      onError(err);
    }
  );
}

/**
 * Checks whether a milestone is duplicate before creating
 * Compares userId, source reflection ID, and normalized title
 */
export function isDuplicateMilestone(
  existingMilestones: Milestone[],
  newDraft: { title: string; userId?: string; sourceReflectionId?: string; extractedFromSessionId?: string; targetTimeframe?: string }
): boolean {
  if (!existingMilestones || existingMilestones.length === 0) return false;
  const normalize = (str?: string) => (str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const newNormalizedTitle = normalize(newDraft.title);
  if (!newNormalizedTitle) return false;

  const sourceRefId = newDraft.sourceReflectionId || newDraft.extractedFromSessionId;

  return existingMilestones.some((m) => {
    if (newDraft.userId && m.userId && m.userId !== newDraft.userId) {
      return false;
    }
    const mNormalizedTitle = normalize(m.title);
    if (!mNormalizedTitle) return false;

    // If matching source reflection and identical normalized title
    if (
      sourceRefId &&
      m.extractedFromSessionId &&
      m.extractedFromSessionId === sourceRefId &&
      mNormalizedTitle === newNormalizedTitle
    ) {
      return true;
    }

    // Or if exact same normalized title
    if (mNormalizedTitle === newNormalizedTitle) {
      return true;
    }

    return false;
  });
}

/**
 * Save or update a milestone for a user
 * Path: /users/{userId}/milestones/{milestoneId}
 */
export async function saveMilestone(userId: string, milestone: Milestone): Promise<void> {
  if (!userId || !milestone.id) throw new Error('User ID and Milestone ID are required');
  const path = `users/${userId}/milestones/${milestone.id}`;
  const cleanPayload = stripUndefined({
    ...milestone,
    userId,
    updatedAt: new Date().toISOString(),
  });

  try {
    const ref = doc(db, 'users', userId, 'milestones', milestone.id);
    await setDoc(ref, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Update the status of a milestone
 */
export async function updateMilestoneStatus(
  userId: string,
  milestoneId: string,
  status: MilestoneStatus
): Promise<void> {
  if (!userId || !milestoneId) return;
  const path = `users/${userId}/milestones/${milestoneId}`;
  try {
    const ref = doc(db, 'users', userId, 'milestones', milestoneId);
    await setDoc(ref, { status, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete a milestone for a user
 */
export async function deleteMilestone(userId: string, milestoneId: string): Promise<void> {
  if (!userId || !milestoneId) return;
  const path = `users/${userId}/milestones/${milestoneId}`;
  try {
    const ref = doc(db, 'users', userId, 'milestones', milestoneId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to user's real-time milestones
 */
export function subscribeUserMilestones(
  userId: string,
  onData: (milestones: Milestone[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/milestones`;
  const ref = collection(db, 'users', userId, 'milestones');
  const q = query(ref, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Milestone[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Milestone);
      });
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      if (onError) onError(err);
    }
  );
}

/**
 * Injects relatable demo sessions & commitments tailored for student / creator persona.
 * Reflection Titles:
 *  1. "Deciding what to focus on this week"
 *  2. "An idea I don’t want to lose"
 *  3. "Why I’ve been feeling mentally overloaded"
 *  4. "Preparing for an important conversation"
 * Commitment Titles:
 *  1. "Set aside 30 minutes to outline my project"
 *  2. "Review my priorities on Friday"
 *  3. "Draft talking points before Tuesday's meeting"
 *  4. "Test the new concept prototype"
 */
export async function injectDemoSandboxSessions(userId: string): Promise<void> {
  if (!userId) return;

  const now = Date.now();

  const demoEntry1: ReflectionEntry = {
    id: `demo-ref-1-${now}`,
    userId,
    title: 'Deciding what to focus on this week',
    createdAt: new Date(now - 3600000 * 24).toISOString(),
    updatedAt: new Date(now - 3600000 * 20).toISOString(),
    tags: ['priorities', 'focus', 'weekly-planning'],
    isPinned: true,
    location: {
      placeName: 'Library Quiet Room',
      formattedAddress: 'Campus Library, 2nd Floor',
      latitude: 37.7749,
      longitude: -122.4194,
      taggedAt: new Date(now - 3600000 * 24).toISOString(),
    },
    messages: [
      {
        id: 'msg-demo-1a',
        role: 'user',
        content: 'I have three different assignments due next week and a new creative project I really want to start. I feel pulled in multiple directions and don’t know what deserves my primary energy.',
        timestamp: new Date(now - 3600000 * 24).toISOString(),
        mode: 'make_decision',
      },
      {
        id: 'msg-demo-1b',
        role: 'model',
        content: 'When multiple priorities compete for your attention, the anxiety usually comes from trying to hold everything in active working memory at once.\n\nLet’s separate the non-negotiable commitments from the creative exploration. Protecting just 30 focused minutes for the project outline will relieve the itch to start without derailing your core deadlines.',
        timestamp: new Date(now - 3600000 * 23).toISOString(),
        mode: 'make_decision',
        clarityCard: {
          whatIHeard: 'You are juggling academic deadlines with a compelling creative project and feeling fragmented by competing priorities.',
          coreDilemma: 'Balancing non-negotiable requirements with creative curiosity without losing momentum on either.',
          suggestedNextStep: 'Block a dedicated window before Friday to complete your project outline.',
          extractedCommitment: {
            title: 'Outline my project idea before Friday',
            category: 'project',
            targetTimeframe: 'Friday afternoon',
          },
          commitmentConfirmed: true,
          confirmedMilestoneId: `demo-ms-1-${now}`,
        },
      },
    ],
  };

  const demoEntry2: ReflectionEntry = {
    id: `demo-ref-2-${now}`,
    userId,
    title: 'Talking through a team decision',
    createdAt: new Date(now - 3600000 * 48).toISOString(),
    updatedAt: new Date(now - 3600000 * 40).toISOString(),
    tags: ['work', 'collaboration', 'alignment'],
    isPinned: false,
    location: {
      placeName: 'Botanical Garden Bench',
      formattedAddress: 'City Botanical Gardens',
      latitude: 37.7694,
      longitude: -122.4662,
      taggedAt: new Date(now - 3600000 * 48).toISOString(),
    },
    messages: [
      {
        id: 'msg-demo-2a',
        role: 'user',
        content: 'I need to sync with my teammate about dividing the work for our upcoming launch. I want to make sure we’re fully aligned on responsibilities.',
        timestamp: new Date(now - 3600000 * 48).toISOString(),
        mode: 'make_decision',
      },
      {
        id: 'msg-demo-2b',
        role: 'model',
        content: 'Clear alignment early prevents misunderstandings later.\n\nSet aside 15 minutes before the meeting to write down the core deliverables and talk through the decision directly with them.',
        timestamp: new Date(now - 3600000 * 47).toISOString(),
        mode: 'make_decision',
        clarityCard: {
          whatIHeard: 'You want to establish mutual clarity and ownership with your teammate on upcoming project milestones.',
          coreDilemma: 'Ensuring seamless collaboration without making assumptions on who owns what.',
          suggestedNextStep: 'Have a short dedicated sync with your teammate to finalize the decision together.',
          extractedCommitment: {
            title: 'Talk to my teammate about the decision',
            category: 'work',
            targetTimeframe: 'Tuesday morning',
          },
          commitmentConfirmed: true,
          confirmedMilestoneId: `demo-ms-2-${now}`,
        },
      },
    ],
  };

  const demoEntry3: ReflectionEntry = {
    id: `demo-ref-3-${now}`,
    userId,
    title: 'Why I’ve been feeling mentally overloaded',
    createdAt: new Date(now - 3600000 * 72).toISOString(),
    updatedAt: new Date(now - 3600000 * 68).toISOString(),
    tags: ['wellbeing', 'clarity', 'personal'],
    isPinned: false,
    messages: [
      {
        id: 'msg-demo-3a',
        role: 'user',
        content: 'I’ve been saying yes to too many side requests and feel like I’m constantly context-switching. My headspace feels constantly crowded.',
        timestamp: new Date(now - 3600000 * 72).toISOString(),
        mode: 'clear_mind',
      },
      {
        id: 'msg-demo-3b',
        role: 'model',
        content: 'Context switching is one of the heaviest cognitive taxes we pay. When everything feels urgent, nothing is truly prioritized.\n\nSetting a weekly recurring review anchor on Friday afternoon gives your mind permission to release open loops over the weekend.',
        timestamp: new Date(now - 3600000 * 71).toISOString(),
        mode: 'clear_mind',
        clarityCard: {
          whatIHeard: 'Excessive context switching and taking on too many side commitments has created persistent mental fatigue.',
          coreDilemma: 'Saying yes to short-term requests at the expense of sustained cognitive energy.',
          suggestedNextStep: 'Establish a Friday reflection ritual to review and reset weekly priorities.',
          extractedCommitment: {
            title: 'Review my priorities at the end of the week',
            category: 'personal',
            targetTimeframe: 'Friday 4:00 PM',
          },
          commitmentConfirmed: true,
          confirmedMilestoneId: `demo-ms-3-${now}`,
        },
      },
    ],
  };

  const demoEntry4: ReflectionEntry = {
    id: `demo-ref-4-${now}`,
    userId,
    title: 'Creating space to rest and reset',
    createdAt: new Date(now - 3600000 * 96).toISOString(),
    updatedAt: new Date(now - 3600000 * 90).toISOString(),
    tags: ['wellbeing', 'rest', 'boundaries'],
    isPinned: false,
    messages: [
      {
        id: 'msg-demo-4a',
        role: 'user',
        content: 'I have been working late every single night this week. I realize I need to set a firm boundary to protect my evenings and recharge.',
        timestamp: new Date(now - 3600000 * 96).toISOString(),
        mode: 'plan_next_step',
      },
      {
        id: 'msg-demo-4b',
        role: 'model',
        content: 'Rest is not a reward for finished work—it is the foundation that makes sustainable work possible.\n\nChoose one specific evening this week to close your laptop completely by 6:30 PM.',
        timestamp: new Date(now - 3600000 * 95).toISOString(),
        mode: 'plan_next_step',
        clarityCard: {
          whatIHeard: 'You recognize that uninterrupted late-night work is draining your battery and want a deliberate evening to disconnect.',
          coreDilemma: 'Overcoming the urge to squeeze in extra work at the cost of personal rejuvenation.',
          suggestedNextStep: 'Pick one evening this week to disconnect completely without guilt.',
          extractedCommitment: {
            title: 'Set aside one evening without work',
            category: 'wellbeing',
            targetTimeframe: 'Thursday evening',
          },
          commitmentConfirmed: true,
          confirmedMilestoneId: `demo-ms-4-${now}`,
        },
      },
    ],
  };

  // Save the 4 student / creator reflections
  await saveInteraction(userId, demoEntry1);
  await saveInteraction(userId, demoEntry2);
  await saveInteraction(userId, demoEntry3);
  await saveInteraction(userId, demoEntry4);

  // Save the 4 corresponding commitments
  const demoMilestone1: Milestone = {
    id: `demo-ms-1-${now}`,
    userId,
    title: 'Outline my project idea before Friday',
    category: 'project',
    targetTimeframe: 'Friday afternoon',
    status: 'in_progress',
    extractedFromSessionId: demoEntry1.id,
    notes: 'You saved this from a reflection',
    createdAt: new Date(now - 3600000 * 20).toISOString(),
  };

  const demoMilestone2: Milestone = {
    id: `demo-ms-2-${now}`,
    userId,
    title: 'Talk to my teammate about the decision',
    category: 'work',
    targetTimeframe: 'Tuesday morning',
    status: 'planned',
    extractedFromSessionId: demoEntry2.id,
    notes: 'You saved this from a reflection',
    createdAt: new Date(now - 3600000 * 40).toISOString(),
  };

  const demoMilestone3: Milestone = {
    id: `demo-ms-3-${now}`,
    userId,
    title: 'Review my priorities at the end of the week',
    category: 'personal',
    targetTimeframe: 'Friday 4:00 PM',
    status: 'planned',
    extractedFromSessionId: demoEntry3.id,
    notes: 'You saved this from a reflection',
    createdAt: new Date(now - 3600000 * 68).toISOString(),
  };

  const demoMilestone4: Milestone = {
    id: `demo-ms-4-${now}`,
    userId,
    title: 'Set aside one evening without work',
    category: 'wellbeing',
    targetTimeframe: 'Thursday evening',
    status: 'achieved',
    extractedFromSessionId: demoEntry4.id,
    notes: 'You saved this from a reflection',
    createdAt: new Date(now - 3600000 * 90).toISOString(),
  };

  await saveMilestone(userId, demoMilestone1);
  await saveMilestone(userId, demoMilestone2);
  await saveMilestone(userId, demoMilestone3);
  await saveMilestone(userId, demoMilestone4);
}
