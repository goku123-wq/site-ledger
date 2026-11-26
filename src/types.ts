export type TransactionType = 'contractor_income' | 'worker_payment' | 'material_purchase';

export type PaymentMode = 'Cash' | 'UPI' | 'Bank' | 'Cheque';

export type PurchaseCategory = 'Materials' | 'Tools' | 'Transport' | 'Other';

export interface Project {
  id: string;
  name: string;
  contractorName: string;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface Transaction {
  id: string;
  projectId: string;
  type: TransactionType;
  amount: number;
  title: string; // Worker name, item/shop name, or payment description
  category?: PurchaseCategory;
  paymentMode: PaymentMode;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

export interface ProjectSummary {
  contractorReceived: number;
  workerPaid: number;
  materialSpent: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
  transactionCount: number;
}

export interface WorkerSummary {
  workerName: string;
  totalPaid: number;
  paymentCount: number;
  lastPaidDate: string;
}

export interface AppSettings {
  currency: string;
}

export interface AppState {
  projects: Project[];
  transactions: Transaction[];
  activeProjectId: string;
  settings: AppSettings;
}

