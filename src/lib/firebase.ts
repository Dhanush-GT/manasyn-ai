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
import type { 
  ReflectionEntry, 
  UserProfile, 
  WebhookConfig, 
  WebhookDeliveryLog, 
  Milestone, 
  MilestoneStatus, 
  FeedbackEntry, 
  FeedbackCategory, 
  FeedbackDiagnostics,
  SavedInsight, 
  LocationTag,
  UserPreferences 
} from '../types';

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
  category: FeedbackCategory = 'general',
  allowContact: boolean = true,
  diagnostics?: FeedbackDiagnostics | null
): Promise<string> {
  if (!userId) throw new Error('Authentication required to submit feedback');
  if (!message.trim()) throw new Error('Feedback message cannot be empty');

  const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const feedbackDoc: FeedbackEntry = {
    id: feedbackId,
    userId,
    userEmail: allowContact && userEmail ? userEmail : null,
    userName: allowContact && userName ? userName : null,
    allowContact,
    message: message.trim(),
    category,
    diagnostics: diagnostics || null,
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
 * Save user preferences to /users/{userId} document
 */
export async function saveUserPreferences(
  userId: string, 
  preferences: Partial<UserPreferences>
): Promise<void> {
  if (!userId) throw new Error('User ID is required to save preferences');
  const userPath = `users/${userId}`;
  const cleanPayload = stripUndefined({
    preferences,
    updatedAt: new Date().toISOString(),
  });

  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

/**
 * Get user preferences from /users/{userId}
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return (data.preferences as UserPreferences) || null;
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch user preferences:', error);
    return null;
  }
}

/**
 * Subscribe to user preferences from /users/{userId}
 */
export function subscribeUserPreferences(
  userId: string,
  onData: (prefs: UserPreferences | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData(null);
    return () => {};
  }

  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onData((data.preferences as UserPreferences) || null);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.warn('Preferences subscription notice:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Completely and irreversibly delete all account data for the specified user
 * Cleans up interactions, milestones, places, insights, webhooks, and the user profile document.
 */
export async function deleteUserAccountAndData(userId: string): Promise<void> {
  if (!userId) throw new Error('User ID is required to delete account data');

  // 1. Delete all reflections / interactions
  try {
    const interactionsSnap = await getDocs(collection(db, 'users', userId, 'interactions'));
    for (const d of interactionsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Error clearing reflections during account wipe:', err);
  }

  // 2. Delete all commitments / milestones
  try {
    const milestonesSnap = await getDocs(collection(db, 'users', userId, 'milestones'));
    for (const d of milestonesSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Error clearing commitments during account wipe:', err);
  }

  // 3. Delete all saved places
  try {
    const placesSnap = await getDocs(collection(db, 'users', userId, 'places'));
    for (const d of placesSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Error clearing places during account wipe:', err);
  }

  // 4. Delete all saved insights
  try {
    const insightsSnap = await getDocs(collection(db, 'users', userId, 'insights'));
    for (const d of insightsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Error clearing insights during account wipe:', err);
  }

  // 5. Delete all webhooks and subcollection delivery logs
  try {
    const webhooksSnap = await getDocs(collection(db, 'users', userId, 'webhooks'));
    for (const d of webhooksSnap.docs) {
      try {
        const logsSnap = await getDocs(collection(db, 'users', userId, 'webhooks', d.id, 'logs'));
        for (const logDoc of logsSnap.docs) {
          await deleteDoc(logDoc.ref);
        }
      } catch {}
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Error clearing webhooks during account wipe:', err);
  }

  // 6. Delete legacy webhookConfigs
  try {
    const configsSnap = await getDocs(collection(db, 'users', userId, 'webhookConfigs'));
    for (const d of configsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Error clearing legacy webhook configs during account wipe:', err);
  }

  // 7. Delete root user document
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn('Error clearing root user record:', err);
  }

  // 8. Wipe localStorage keys
  try {
    localStorage.removeItem('pref_default_intent');
    localStorage.removeItem('pref_reflection_tone');
    localStorage.removeItem('pref_voice_input');
    localStorage.removeItem('pref_time_format');
    localStorage.removeItem('pref_reminder_enabled');
    localStorage.removeItem('pref_reminder_time');
    localStorage.removeItem('pref_reminder_days');
    localStorage.removeItem('pref_reminder_timezone');
    localStorage.removeItem('theme_preference');
    localStorage.removeItem('theme');
  } catch (err) {
    console.warn('Error clearing local cache:', err);
  }

  // 9. Sign out from Firebase Auth
  await signOutUser();
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
 * Save or update a saved pattern insight for a user
 * Path: /users/{userId}/insights/{insightId}
 */
export async function saveInsight(userId: string, insight: SavedInsight): Promise<void> {
  if (!userId || !insight.id) throw new Error('User ID and Insight ID are required');
  const path = `users/${userId}/insights/${insight.id}`;
  const cleanPayload = stripUndefined({
    ...insight,
    userId,
    savedAt: insight.savedAt || new Date().toISOString(),
  });

  try {
    const ref = doc(db, 'users', userId, 'insights', insight.id);
    await setDoc(ref, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a saved insight for a user
 */
export async function deleteInsight(userId: string, insightId: string): Promise<void> {
  if (!userId || !insightId) return;
  const path = `users/${userId}/insights/${insightId}`;
  try {
    const ref = doc(db, 'users', userId, 'insights', insightId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to user's real-time saved insights
 */
export function subscribeUserInsights(
  userId: string,
  onData: (insights: SavedInsight[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/insights`;
  const ref = collection(db, 'users', userId, 'insights');
  const q = query(ref, orderBy('savedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedInsight[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as SavedInsight);
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
 * Save or update a place in the user's private places collection
 */
export async function saveUserPlace(userId: string, place: LocationTag): Promise<void> {
  if (!userId || !place) return;
  const placeId = place.id || `place-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/places/${placeId}`;
  const cleanPayload = stripUndefined({
    ...place,
    id: placeId,
    taggedAt: place.taggedAt || new Date().toISOString(),
  });

  try {
    const ref = doc(db, 'users', userId, 'places', placeId);
    await setDoc(ref, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a place from the user's private places collection
 */
export async function deleteUserPlace(userId: string, placeId: string): Promise<void> {
  if (!userId || !placeId) return;
  const path = `users/${userId}/places/${placeId}`;
  try {
    const ref = doc(db, 'users', userId, 'places', placeId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to user's real-time saved places
 */
export function subscribeUserPlaces(
  userId: string,
  onData: (places: LocationTag[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/places`;
  const ref = collection(db, 'users', userId, 'places');

  return onSnapshot(
    ref,
    (snapshot) => {
      const list: LocationTag[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as LocationTag);
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
 * Save or update a webhook integration configuration in the user's private webhooks collection
 */
export async function saveUserWebhook(userId: string, webhook: WebhookConfig): Promise<void> {
  if (!userId || !webhook) return;
  const webhookId = webhook.id || `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/webhooks/${webhookId}`;

  // Mask secret if provided to prevent cleartext exposure
  const maskedSecret = webhook.secret && webhook.secret.trim()
    ? `••••••••${webhook.secret.trim().slice(-4)}`
    : webhook.maskedSecret || undefined;

  const cleanPayload = stripUndefined({
    ...webhook,
    id: webhookId,
    userId,
    maskedSecret,
    consecutiveFailures: webhook.consecutiveFailures ?? 0,
    updatedAt: new Date().toISOString(),
  });

  try {
    const ref = doc(db, 'users', userId, 'webhooks', webhookId);
    await setDoc(ref, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a webhook integration from the user's collection
 */
export async function deleteUserWebhook(userId: string, webhookId: string): Promise<void> {
  if (!userId || !webhookId) return;
  const path = `users/${userId}/webhooks/${webhookId}`;
  try {
    const ref = doc(db, 'users', userId, 'webhooks', webhookId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to user's configured webhooks
 */
export function subscribeUserWebhooks(
  userId: string,
  onData: (webhooks: WebhookConfig[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/webhooks`;
  const ref = collection(db, 'users', userId, 'webhooks');

  return onSnapshot(
    ref,
    (snapshot) => {
      const list: WebhookConfig[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as WebhookConfig);
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
 * Record a delivery log entry for an executed webhook
 */
export async function recordWebhookDeliveryLog(
  userId: string,
  webhookId: string,
  log: WebhookDeliveryLog
): Promise<void> {
  if (!userId || !webhookId || !log) return;
  const logId = log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const path = `users/${userId}/webhooks/${webhookId}/logs/${logId}`;
  const cleanPayload = stripUndefined({
    ...log,
    id: logId,
    webhookId,
    timestamp: log.timestamp || new Date().toISOString(),
  });

  try {
    const ref = doc(db, 'users', userId, 'webhooks', webhookId, 'logs', logId);
    await setDoc(ref, cleanPayload);
  } catch (error) {
    console.warn('Could not record webhook delivery log in Firestore:', error);
  }
}

/**
 * Subscribe to delivery logs for a specific webhook
 */
export function subscribeWebhookLogs(
  userId: string,
  webhookId: string,
  onData: (logs: WebhookDeliveryLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId || !webhookId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/webhooks/${webhookId}/logs`;
  const ref = collection(db, 'users', userId, 'webhooks', webhookId, 'logs');
  const q = query(ref, orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WebhookDeliveryLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as WebhookDeliveryLog);
      });
      onData(list.slice(0, 30));
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
