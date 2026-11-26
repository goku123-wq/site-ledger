import { AppState, Project, Transaction } from '../types';

const STORAGE_KEY = 'siteledger_app_state_v1';

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultState(): AppState {
  const defaultProject: Project = {
    id: 'proj_default',
    name: 'My First Project',
    contractorName: '',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  return {
    projects: [defaultProject],
    transactions: [],
    activeProjectId: defaultProject.id,
    settings: {
      currency: '₹',
    },
  };
}

export function createDemoData(): AppState {
  const p1: Project = {
    id: 'proj_demo_1',
    name: 'Villa Renovation',
    contractorName: 'Ramesh Builders',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  const p2: Project = {
    id: 'proj_demo_2',
    name: 'Shop Interior Work',
    contractorName: 'Metro Spaces',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const today = todayIso();
  const transactions: Transaction[] = [
    {
      id: createId('tx'),
      projectId: p1.id,
      type: 'contractor_income',
      amount: 85000,
      title: 'Advance Payment',
      paymentMode: 'Bank',
      date: today,
      note: '1st stage milestone from contractor',
      createdAt: new Date().toISOString(),
    },
    {
      id: createId('tx'),
      projectId: p1.id,
      type: 'material_purchase',
      amount: 18500,
      title: 'Cement & Steel Rods',
      category: 'Materials',
      paymentMode: 'UPI',
      date: today,
      note: 'Shree Hardware',
      createdAt: new Date().toISOString(),
    },
    {
      id: createId('tx'),
      projectId: p1.id,
      type: 'worker_payment',
      amount: 6000,
      title: 'Suresh',
      paymentMode: 'Cash',
      date: today,
      note: 'Weekly mason wages',
      createdAt: new Date().toISOString(),
    },
    {
      id: createId('tx'),
      projectId: p1.id,
      type: 'worker_payment',
      amount: 4500,
      title: 'Mahesh',
      paymentMode: 'UPI',
      date: today,
      note: 'Helper wages (5 days)',
      createdAt: new Date().toISOString(),
    },
    {
      id: createId('tx'),
      projectId: p1.id,
      type: 'material_purchase',
      amount: 2200,
      title: 'Auto Transport',
      category: 'Transport',
      paymentMode: 'Cash',
      date: today,
      createdAt: new Date().toISOString(),
    },
    {
      id: createId('tx'),
      projectId: p2.id,
      type: 'contractor_income',
      amount: 40000,
      title: 'Initial Advance',
      paymentMode: 'UPI',
      date: today,
      createdAt: new Date().toISOString(),
    },
    {
      id: createId('tx'),
      projectId: p2.id,
      type: 'material_purchase',
      amount: 12000,
      title: 'Plywood & Laminates',
      category: 'Materials',
      paymentMode: 'Bank',
      date: today,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    projects: [p1, p2],
    transactions,
    activeProjectId: p1.id,
    settings: {
      currency: '₹',
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed.projects || parsed.projects.length === 0) {
      return createDefaultState();
    }
    return {
      projects: parsed.projects,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      activeProjectId: parsed.activeProjectId ?? parsed.projects[0].id,
      settings: parsed.settings ?? { currency: '₹' },
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

