import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { FirebaseConfig, Project, Transaction } from '../types';

const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: 'AIzaSyBwwClMBkTuY2UwjKghztKypAEhfI14Yvs',
  authDomain: 'siteledger-17e91.firebaseapp.com',
  projectId: 'siteledger-17e91',
  storageBucket: 'siteledger-17e91.firebasestorage.app',
  messagingSenderId: '158376676691',
  appId: '1:158376676691:web:2aafaf903e0aaba904a5a6',
};

export function getEnvFirebaseConfig(): FirebaseConfig | undefined {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey || !projectId || !appId) return DEFAULT_FIREBASE_CONFIG;
  return {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId,
  };
}

export function normalizeTeamCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function parseFirebaseConfigInput(raw: string): FirebaseConfig | null {
  try {
    // Allow pasting either pure JSON or a JS object snippet from Firebase Console
    const cleaned = raw
      .trim()
      .replace(/^const\s+\w+\s*=\s*/, '')
      .replace(/;$/, '')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/'/g, '"');
    const parsed = JSON.parse(cleaned) as Partial<FirebaseConfig>;
    if (!parsed.apiKey || !parsed.projectId || !parsed.appId) {
      return null;
    }
    return {
      apiKey: parsed.apiKey,
      authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
      projectId: parsed.projectId,
      storageBucket: parsed.storageBucket,
      messagingSenderId: parsed.messagingSenderId,
      appId: parsed.appId,
    };
  } catch {
    return null;
  }
}

function getDb(config: FirebaseConfig): Firestore {
  const appName = `siteledger_${config.projectId}`;
  const existing = getApps().find((a: FirebaseApp) => a.name === appName);
  const app = existing ?? initializeApp(config, appName);
  return getFirestore(app);
}

export function subscribeToWorkspace(
  config: FirebaseConfig,
  teamCode: string,
  onProjects: (projects: Project[]) => void,
  onTransactions: (transactions: Transaction[]) => void,
  onError: (message: string) => void
): () => void {
  const db = getDb(config);
  const projectsRef = collection(db, 'workspaces', teamCode, 'projects');
  const txRef = collection(db, 'workspaces', teamCode, 'transactions');

  const unsubProjects = onSnapshot(
    projectsRef,
    (snap) => {
      const list: Project[] = [];
      snap.forEach((d) => list.push(d.data() as Project));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onProjects(list);
    },
    (err) => onError(err.message)
  );

  const unsubTx = onSnapshot(
    txRef,
    (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => list.push(d.data() as Transaction));
      onTransactions(list);
    },
    (err) => onError(err.message)
  );

  return () => {
    unsubProjects();
    unsubTx();
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean as T;
}

export async function cloudUpsertProject(
  config: FirebaseConfig,
  teamCode: string,
  project: Project
): Promise<void> {
  const db = getDb(config);
  await setDoc(
    doc(db, 'workspaces', teamCode, 'projects', project.id),
    stripUndefined(project as unknown as Record<string, unknown>)
  );
}

export async function cloudDeleteProject(
  config: FirebaseConfig,
  teamCode: string,
  projectId: string,
  txIds: string[]
): Promise<void> {
  const db = getDb(config);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'workspaces', teamCode, 'projects', projectId));
  for (const txId of txIds) {
    batch.delete(doc(db, 'workspaces', teamCode, 'transactions', txId));
  }
  await batch.commit();
}

export async function cloudUpsertTransaction(
  config: FirebaseConfig,
  teamCode: string,
  tx: Transaction
): Promise<void> {
  const db = getDb(config);
  await setDoc(
    doc(db, 'workspaces', teamCode, 'transactions', tx.id),
    stripUndefined(tx as unknown as Record<string, unknown>)
  );
}

export async function cloudDeleteTransaction(
  config: FirebaseConfig,
  teamCode: string,
  txId: string
): Promise<void> {
  const db = getDb(config);
  await deleteDoc(doc(db, 'workspaces', teamCode, 'transactions', txId));
}

export async function pushLocalDataToCloud(
  config: FirebaseConfig,
  teamCode: string,
  projects: Project[],
  transactions: Transaction[]
): Promise<void> {
  const db = getDb(config);
  const batch = writeBatch(db);
  for (const p of projects) {
    batch.set(
      doc(db, 'workspaces', teamCode, 'projects', p.id),
      stripUndefined(p as unknown as Record<string, unknown>)
    );
  }
  for (const t of transactions) {
    batch.set(
      doc(db, 'workspaces', teamCode, 'transactions', t.id),
      stripUndefined(t as unknown as Record<string, unknown>)
    );
  }
  await batch.commit();
}

