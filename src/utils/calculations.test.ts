import { describe, expect, it } from 'vitest';
import {
  buildProjectCsv,
  calculateProjectSummary,
  calculateWorkerSummaries,
  formatMoney,
  getKnownWorkerNames,
} from './calculations';
import { Transaction } from '../types';

const sampleTransactions: Transaction[] = [
  {
    id: '1',
    projectId: 'p1',
    type: 'contractor_income',
    amount: 100000,
    title: 'Stage 1',
    paymentMode: 'Bank',
    date: '2026-11-20',
    createdAt: '2026-11-20T10:00:00Z',
  },
  {
    id: '2',
    projectId: 'p1',
    type: 'worker_payment',
    amount: 15000,
    title: 'Raju',
    paymentMode: 'Cash',
    date: '2026-11-21',
    createdAt: '2026-11-21T10:00:00Z',
  },
  {
    id: '3',
    projectId: 'p1',
    type: 'worker_payment',
    amount: 5000,
    title: 'raju',
    paymentMode: 'UPI',
    date: '2026-11-25',
    createdAt: '2026-11-25T10:00:00Z',
  },
  {
    id: '4',
    projectId: 'p1',
    type: 'material_purchase',
    amount: 30000,
    title: 'Cement',
    category: 'Materials',
    paymentMode: 'UPI',
    date: '2026-11-22',
    createdAt: '2026-11-22T10:00:00Z',
  },
  {
    id: '5',
    projectId: 'p2',
    type: 'contractor_income',
    amount: 50000,
    title: 'Other project',
    paymentMode: 'Cash',
    date: '2026-11-22',
    createdAt: '2026-11-22T10:00:00Z',
  },
];

describe('calculateProjectSummary', () => {
  it('calculates income, worker payments, material purchases, and net profit for a project', () => {
    const summary = calculateProjectSummary(sampleTransactions, 'p1');
    expect(summary.contractorReceived).toBe(100000);
    expect(summary.workerPaid).toBe(20000);
    expect(summary.materialSpent).toBe(30000);
    expect(summary.totalExpenses).toBe(50000);
    expect(summary.netProfit).toBe(50000);
    expect(summary.profitMarginPct).toBe(50);
    expect(summary.transactionCount).toBe(4);
  });

  it('handles negative profit (loss) correctly', () => {
    const lossTxs: Transaction[] = [
      {
        id: 'a',
        projectId: 'p3',
        type: 'contractor_income',
        amount: 10000,
        title: 'Advance',
        paymentMode: 'Cash',
        date: '2026-11-20',
        createdAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'b',
        projectId: 'p3',
        type: 'material_purchase',
        amount: 14000,
        title: 'Tiles',
        paymentMode: 'UPI',
        date: '2026-11-21',
        createdAt: '2026-11-21T10:00:00Z',
      },
    ];
    const summary = calculateProjectSummary(lossTxs, 'p3');
    expect(summary.netProfit).toBe(-4000);
    expect(summary.profitMarginPct).toBe(-40);
  });
});

describe('calculateWorkerSummaries', () => {
  it('groups worker payments case-insensitively and tracks last paid date', () => {
    const workers = calculateWorkerSummaries(sampleTransactions, 'p1');
    expect(workers).toHaveLength(1);
    expect(workers[0].totalPaid).toBe(20000);
    expect(workers[0].paymentCount).toBe(2);
    expect(workers[0].lastPaidDate).toBe('2026-11-25');
  });

  it('returns unique known worker names', () => {
    expect(getKnownWorkerNames(sampleTransactions, 'p1')).toEqual(['Raju']);
  });
});

describe('formatMoney & buildProjectCsv', () => {
  it('formats positive and negative amounts', () => {
    expect(formatMoney(15000, '₹')).toBe('₹15,000');
    expect(formatMoney(-4000, '₹')).toBe('-₹4,000');
  });

  it('exports CSV with summary rows', () => {
    const p1Txs = sampleTransactions.filter((t) => t.projectId === 'p1');
    const summary = calculateProjectSummary(sampleTransactions, 'p1');
    const csv = buildProjectCsv('Villa', p1Txs, summary);
    expect(csv).toContain('"Contractor Received","100000"');
    expect(csv).toContain('"Net Profit","50000"');
  });
});

