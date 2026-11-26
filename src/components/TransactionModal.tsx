import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  PaymentMode,
  PurchaseCategory,
  Transaction,
  TransactionType,
} from '../types';
import { todayIso } from '../utils/storage';

interface TransactionModalProps {
  initialType?: TransactionType;
  editingTx?: Transaction | null;
  knownWorkers: string[];
  currency: string;
  onClose: () => void;
  onSave: (data: Omit<Transaction, 'id' | 'projectId' | 'createdAt'>, existingId?: string) => void;
  onDelete?: (id: string) => void;
}

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank', 'Cheque'];
const PURCHASE_CATEGORIES: PurchaseCategory[] = ['Materials', 'Tools', 'Transport', 'Other'];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  initialType = 'worker_payment',
  editingTx,
  knownWorkers,
  currency,
  onClose,
  onSave,
  onDelete,
}) => {
  const [type, setType] = useState<TransactionType>(editingTx?.type ?? initialType);
  const [amount, setAmount] = useState<string>(editingTx ? String(editingTx.amount) : '');
  const [title, setTitle] = useState<string>(editingTx?.title ?? '');
  const [category, setCategory] = useState<PurchaseCategory>(
    editingTx?.category ?? 'Materials'
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    editingTx?.paymentMode ?? 'Cash'
  );
  const [date, setDate] = useState<string>(editingTx?.date ?? todayIso());
  const [note, setNote] = useState<string>(editingTx?.note ?? '');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    const fallbackTitle =
      type === 'contractor_income'
        ? 'Contractor Payment'
        : type === 'worker_payment'
          ? 'Worker'
          : 'Material Purchase';

    onSave(
      {
        type,
        amount: Math.round(numericAmount * 100) / 100,
        title: title.trim() || fallbackTitle,
        category: type === 'material_purchase' ? category : undefined,
        paymentMode,
        date,
        note: note.trim() || undefined,
      },
      editingTx?.id
    );
  };

  const titleLabel =
    type === 'contractor_income'
      ? 'Payment Description'
      : type === 'worker_payment'
        ? 'Worker Name'
        : 'Item / Shop Name';

  const titlePlaceholder =
    type === 'contractor_income'
      ? 'e.g., Advance, Stage 2 Bill'
      : type === 'worker_payment'
        ? 'e.g., Suresh, Raju'
        : 'e.g., Cement, Pipes, Hardware';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingTx ? 'Edit Entry' : 'Add Payment Entry'}
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn ${type === 'contractor_income' ? 'active contractor_income' : ''}`}
              onClick={() => setType('contractor_income')}
            >
              + Contractor
            </button>
            <button
              type="button"
              className={`seg-btn ${type === 'worker_payment' ? 'active worker_payment' : ''}`}
              onClick={() => setType('worker_payment')}
            >
              - Worker
            </button>
            <button
              type="button"
              className={`seg-btn ${type === 'material_purchase' ? 'active material_purchase' : ''}`}
              onClick={() => setType('material_purchase')}
            >
              - Purchase
            </button>
          </div>

          <div className="field-group">
            <label className="field-label">Amount ({currency})</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className="input amount-input"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              autoFocus
            />
          </div>

          <div className="field-group">
            <label className="field-label">{titleLabel}</label>
            <input
              type="text"
              className="input"
              placeholder={titlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {type === 'worker_payment' && knownWorkers.length > 0 && (
              <div className="pill-grid">
                {knownWorkers.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`chip ${title.trim().toLowerCase() === w.toLowerCase() ? 'active' : ''}`}
                    onClick={() => setTitle(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>

          {type === 'material_purchase' && (
            <div className="field-group">
              <label className="field-label">Category</label>
              <div className="pill-grid">
                {PURCHASE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`chip ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="row-2">
            <div className="field-group">
              <label className="field-label">Date</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Payment Mode</label>
              <select
                className="input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Note (Optional)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., 5 bags cement, 3 days labor"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{error}</div>
          )}

          <button type="submit" className="btn-primary">
            {editingTx ? 'Save Changes' : 'Save Entry'}
          </button>

          {editingTx && onDelete && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => onDelete(editingTx.id)}
            >
              <Trash2 size={16} /> Delete Entry
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

