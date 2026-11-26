import React, { useRef } from 'react';
import { Download, FileSpreadsheet, RotateCcw, Upload, X } from 'lucide-react';

interface SettingsModalProps {
  currency: string;
  onChangeCurrency: (currency: string) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => void;
  onLoadDemo: () => void;
  onClose: () => void;
}

const CURRENCIES = ['₹', '$', '€', '£', 'AED', 'SAR'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currency,
  onChangeCurrency,
  onExportCsv,
  onExportJson,
  onImportJson,
  onLoadDemo,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJson(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Settings & Backup</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="field-group">
          <label className="field-label">Currency Symbol</label>
          <div className="pill-grid">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${currency === c ? 'active' : ''}`}
                onClick={() => onChangeCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Reports & Data Backup (Offline)</label>
          <button type="button" className="btn-secondary" onClick={onExportCsv}>
            <FileSpreadsheet size={16} /> Export Current Project (CSV / Excel)
          </button>
          <button type="button" className="btn-secondary" onClick={onExportJson}>
            <Download size={16} /> Download Full Backup (JSON)
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} /> Restore Backup (JSON)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Sample Data</label>
          <button type="button" className="btn-secondary" onClick={onLoadDemo}>
            <RotateCcw size={16} /> Load Sample Projects & Entries
          </button>
        </div>
      </div>
    </div>
  );
};

