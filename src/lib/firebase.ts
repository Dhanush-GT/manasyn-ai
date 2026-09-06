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
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore client is in offline mode or initializing.');
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
 * Injects 2 rich operational demo sessions & 2 strategic milestones
 * for new users with 0 interactions so the graphs, spatial map, and matrices render immediately.
 */
export async function injectDemoSandboxSessions(userId: string): Promise<void> {
  if (!userId) return;

  const demoEntry1: ReflectionEntry = {
    id: `demo-grpc-${Date.now()}`,
    userId,
    title: 'High-Throughput gRPC Microservices Gateway Architecture',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    tags: ['infra', 'scaling', 'k8s', 'grpc'],
    isPinned: true,
    location: {
      placeName: 'Mountain View Systems Cluster',
      formattedAddress: 'Silicon Valley, CA, USA',
      latitude: 37.3861,
      longitude: -122.0839,
      taggedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    messages: [
      {
        id: 'msg-demo-1a',
        role: 'user',
        content: 'We are re-architecting our ingress proxy layer to support 10k RPS with sub-10ms p99 latency across multi-region Kubernetes clusters. Current bottleneck is Redis caching serialization and connection pool starvation.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        mode: 'reflect',
      },
      {
        id: 'msg-demo-1b',
        role: 'model',
        content: `### 1. Ingress Architecture Deconstruction\n\n* **Connection Pooling:** Shift from ephemeral TCP handshakes to long-lived HTTP/2 multiplexed gRPC connections with keep-alive pings every 30s.\n* **Local Envoy Sidecars:** Deploy Envoy sidecars on each pod with localized L4/L7 circuit breaking and active health checking.\n* **Cache Pipeline:** Replace naive Redis JSON serialization with FlatBuffers or Protocol Buffers binary wire format to achieve zero-copy deserialization.\n\n### Strategic Execution Targets\n- Target p99 latency: <= 8.5ms at peak load\n- Implement eBPF socket tracing for kernel-level TCP queue monitoring\n- Target Milestone: Production readiness before Q3 2026.`,
        timestamp: new Date(Date.now() - 3600000 * 23).toISOString(),
        mode: 'reflect',
      },
    ],
  };

  const demoEntry2: ReflectionEntry = {
    id: `demo-zk-${Date.now() + 1}`,
    userId,
    title: 'Distributed Event-Driven Ledger & Zero-Knowledge State Sync',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    tags: ['architecture', 'security', 'distributed', 'zk-proofs'],
    isPinned: false,
    location: {
      placeName: 'Zurich Cryptography Lab',
      formattedAddress: 'Zurich, Switzerland',
      latitude: 47.3769,
      longitude: 8.5417,
      taggedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
    messages: [
      {
        id: 'msg-demo-2a',
        role: 'user',
        content: 'Need a verifiable audit ledger for our state mutations without leaking sensitive payload data across multi-tenant boundaries. Evaluating recursive SNARKs vs merkle mountain ranges.',
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        mode: 'brainstorm',
      },
      {
        id: 'msg-demo-2b',
        role: 'model',
        content: `### Architectural Trade-Off Analysis\n\n1. **Merkle Mountain Ranges (MMR):** Extremely lightweight append-only log verification with O(log n) inclusion proofs. Ideal for rapid high-throughput ingestion.\n2. **Recursive SNARKs (Halo2 / Plonky2):** Enables constant-size verification regardless of session volume, delivering absolute cryptographic privacy.\n\n### Recommendation\nHybrid topology: Ingest through an MMR pipeline, batch roll-ups into periodic STARK/SNARK proofs verified on-chain every 1,000 blocks.`,
        timestamp: new Date(Date.now() - 3600000 * 47).toISOString(),
        mode: 'brainstorm',
      },
    ],
  };

  await saveInteraction(userId, demoEntry1);
  await saveInteraction(userId, demoEntry2);

  const demoMilestone1: Milestone = {
    id: `ms-grpc-${Date.now()}`,
    userId,
    title: 'Scale gRPC gateway to 10k RPS with sub-10ms p99 latency',
    category: 'infrastructure',
    targetTimeframe: 'Q3 2026',
    status: 'in_progress',
    extractedFromSessionId: demoEntry1.id,
    notes: 'Transition to binary Protocol Buffers & eBPF telemetry monitoring',
    createdAt: new Date().toISOString(),
  };

  const demoMilestone2: Milestone = {
    id: `ms-zk-${Date.now() + 1}`,
    userId,
    title: 'Deploy Zero-Knowledge verifiable audit ledger to production',
    category: 'architecture',
    targetTimeframe: 'Q4 2026',
    status: 'planned',
    extractedFromSessionId: demoEntry2.id,
    notes: 'Hybrid MMR ingestion with periodic batch SNARK verification',
    createdAt: new Date().toISOString(),
  };

  await saveMilestone(userId, demoMilestone1);
  await saveMilestone(userId, demoMilestone2);
}
