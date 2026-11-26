import React, { useRef, useState } from 'react';
import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { FirebaseConfig } from '../types';
import {
  getEnvFirebaseConfig,
  normalizeTeamCode,
  parseFirebaseConfigInput,
} from '../utils/firebaseSync';

interface SettingsModalProps {
  currency: string;
  teamCode?: string;
  firebaseConfig?: FirebaseConfig;
  syncStatus: 'offline' | 'connecting' | 'synced' | 'error';
  syncError?: string;
  onChangeCurrency: (currency: string) => void;
  onConnectCloud: (teamCode: string, config: FirebaseConfig) => void;
  onDisconnectCloud: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => void;
  onLoadDemo: () => void;
  onClose: () => void;
}

const CURRENCIES = ['₹', '$', '€', '£', 'AED', 'SAR'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currency,
  teamCode,
  firebaseConfig,
  syncStatus,
  syncError,
  onChangeCurrency,
  onConnectCloud,
  onDisconnectCloud,
  onExportCsv,
  onExportJson,
  onImportJson,
  onLoadDemo,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const envConfig = getEnvFirebaseConfig();
  const activeConfig = firebaseConfig ?? envConfig;

  const [codeInput, setCodeInput] = useState(
    teamCode || `TEAM-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [configInput, setConfigInput] = useState(
    firebaseConfig ? JSON.stringify(firebaseConfig, null, 2) : ''
  );
  const [cloudFormError, setCloudFormError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const handleConnect = () => {
    const normalized = normalizeTeamCode(codeInput);
    if (!normalized || normalized.length < 3) {
      setCloudFormError('Enter a Team Code (at least 3 letters/numbers).');
      return;
    }

    let resolvedConfig = envConfig;
    if (configInput.trim()) {
      const parsed = parseFirebaseConfigInput(configInput);
      if (!parsed) {
        setCloudFormError(
          'Invalid Firebase config. Paste the firebaseConfig object or JSON with apiKey, projectId, and appId.'
        );
        return;
      }
      resolvedConfig = parsed;
    } else if (!resolvedConfig) {
      setCloudFormError('Paste your Firebase Web App config first.');
      return;
    }

    setCloudFormError('');
    onConnectCloud(normalized, resolvedConfig);
  };

  const handleCopyInviteLink = async () => {
    if (!teamCode || !activeConfig) return;
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams();
    params.set('team', teamCode);
    if (!envConfig) {
      params.set('fb', btoa(JSON.stringify(activeConfig)));
    }
    const url = `${base}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copy this WhatsApp invite link:', url);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Settings & Team Sync</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="card" style={{ background: '#f8fafc' }}>
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncStatus === 'synced' ? (
                <Cloud size={16} color="#059669" />
              ) : (
                <CloudOff size={16} color="#64748b" />
              )}
              Multi-User Firebase Sync
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  syncStatus === 'synced'
                    ? '#059669'
                    : syncStatus === 'error'
                      ? '#dc2626'
                      : '#64748b',
              }}
            >
              {syncStatus === 'synced'
                ? `Live (${teamCode})`
                : syncStatus === 'connecting'
                  ? 'Connecting...'
                  : syncStatus === 'error'
                    ? 'Error'
                    : 'Local Only'}
            </span>
          </div>

          {syncError && (
            <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>
              {syncError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="field-group">
              <label className="field-label">Shared Team Code</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., RAMESH-SITE"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              />
            </div>

            {!envConfig && (
              <div className="field-group">
                <label className="field-label">
                  Firebase Config (paste from Firebase Console)
                </label>
                <textarea
                  className="input"
                  rows={4}
                  style={{ fontSize: 12, fontFamily: 'monospace' }}
                  placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  "appId": "..."\n}'}
                  value={configInput}
                  onChange={(e) => setConfigInput(e.target.value)}
                />
              </div>
            )}

            {cloudFormError && (
              <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
                {cloudFormError}
              </div>
            )}

            <button type="button" className="btn-primary" onClick={handleConnect}>
              {teamCode ? 'Update & Sync Team' : 'Enable Live Team Sync'}
            </button>

            {teamCode && activeConfig && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopyInviteLink}
                >
                  {copied ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                  {copied ? 'Invite Link Copied!' : 'Copy WhatsApp Team Invite Link'}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={onDisconnectCloud}
                >
                  Disconnect Cloud Sync
                </button>
              </>
            )}
          </div>
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
          <label className="field-label">Reports & Data Backup</label>
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
