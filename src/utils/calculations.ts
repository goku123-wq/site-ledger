import { ProjectSummary, Transaction, WorkerSummary } from '../types';

export function calculateProjectSummary(
  transactions: Transaction[],
  projectId: string
): ProjectSummary {
  let contractorReceived = 0;
  let workerPaid = 0;
  let materialSpent = 0;
  let transactionCount = 0;

  for (const tx of transactions) {
    if (tx.projectId !== projectId) continue;
    transactionCount++;
    if (tx.type === 'contractor_income') {
      contractorReceived += tx.amount;
    } else if (tx.type === 'worker_payment') {
      workerPaid += tx.amount;
    } else if (tx.type === 'material_purchase') {
      materialSpent += tx.amount;
    }
  }

  const totalExpenses = workerPaid + materialSpent;
  const netProfit = contractorReceived - totalExpenses;
  const profitMarginPct =
    contractorReceived > 0 ? (netProfit / contractorReceived) * 100 : 0;

  return {
    contractorReceived,
    workerPaid,
    materialSpent,
    totalExpenses,
    netProfit,
    profitMarginPct,
    transactionCount,
  };
}

export function calculateWorkerSummaries(
  transactions: Transaction[],
  projectId: string
): WorkerSummary[] {
  const map = new Map<string, WorkerSummary>();

  for (const tx of transactions) {
    if (tx.projectId !== projectId || tx.type !== 'worker_payment') continue;
    const key = tx.title.trim().toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        workerName: tx.title.trim(),
        totalPaid: tx.amount,
        paymentCount: 1,
        lastPaidDate: tx.date,
      });
    } else {
      existing.totalPaid += tx.amount;
      existing.paymentCount += 1;
      if (tx.date > existing.lastPaidDate) {
        existing.lastPaidDate = tx.date;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
}

export function getKnownWorkerNames(
  transactions: Transaction[],
  projectId: string
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const tx of transactions) {
    if (tx.projectId === projectId && tx.type === 'worker_payment') {
      const trimmed = tx.title.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !seen.has(lower)) {
        seen.add(lower);
        names.push(trimmed);
      }
    }
  }
  return names;
}

export function formatMoney(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
  }).format(abs);
  return amount < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

export function formatDateShort(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export function buildProjectCsv(
  projectName: string,
  transactions: Transaction[],
  summary: ProjectSummary
): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const lines: string[] = [
    ['Date', 'Type', 'Title / Worker / Item', 'Category', 'Payment Mode', 'Amount', 'Note']
      .map(escape)
      .join(','),
  ];

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  for (const tx of sorted) {
    const typeLabel =
      tx.type === 'contractor_income'
        ? 'Contractor Received'
        : tx.type === 'worker_payment'
          ? 'Worker Payment'
          : 'Material Purchase';
    lines.push(
      [
        tx.date,
        typeLabel,
        tx.title,
        tx.category ?? '',
        tx.paymentMode,
        String(tx.amount),
        tx.note ?? '',
      ]
        .map(escape)
        .join(',')
    );
  }

  lines.push('');
  lines.push(['Project Summary', projectName].map(escape).join(','));
  lines.push(['Contractor Received', String(summary.contractorReceived)].map(escape).join(','));
  lines.push(['Worker Payments', String(summary.workerPaid)].map(escape).join(','));
  lines.push(['Material Purchases', String(summary.materialSpent)].map(escape).join(','));
  lines.push(['Total Expenses', String(summary.totalExpenses)].map(escape).join(','));
  lines.push(['Net Profit', String(summary.netProfit)].map(escape).join(','));

  return lines.join('\n');
}

