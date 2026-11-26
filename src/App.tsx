import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ChevronDown,
  Cloud,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  ListOrdered,
  Package,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import {
  AppState,
  FirebaseConfig,
  Project,
  Transaction,
  TransactionType,
} from './types';
import {
  buildProjectCsv,
  calculateProjectSummary,
  calculateWorkerSummaries,
  formatDateShort,
  formatMoney,
  getKnownWorkerNames,
} from './utils/calculations';
import { createDemoData, createId, loadState, saveState } from './utils/storage';
import {
  cloudDeleteProject,
  cloudDeleteTransaction,
  cloudUpsertProject,
  cloudUpsertTransaction,
  getEnvFirebaseConfig,
  normalizeTeamCode,
  pushLocalDataToCloud,
  subscribeToWorkspace,
} from './utils/firebaseSync';
import { TransactionModal } from './components/TransactionModal';
import { ProjectModal } from './components/ProjectModal';
import { SettingsModal } from './components/SettingsModal';

type Tab = 'overview' | 'ledger' | 'workers' | 'projects';

function readInviteFromUrl(): { teamCode?: string; firebaseConfig?: FirebaseConfig } {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawTeam = params.get('team');
    const rawFb = params.get('fb');
    const teamCode = rawTeam ? normalizeTeamCode(rawTeam) : undefined;
    let firebaseConfig: FirebaseConfig | undefined;
    if (rawFb) {
      const parsed = JSON.parse(atob(rawFb)) as FirebaseConfig;
      if (parsed.apiKey && parsed.projectId && parsed.appId) {
        firebaseConfig = parsed;
      }
    }
    return { teamCode: teamCode || undefined, firebaseConfig };
  } catch {
    return {};
  }
}

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const base = loadState();
    const invite = readInviteFromUrl();
    if (invite.teamCode) {
      return {
        ...base,
        settings: {
          ...base.settings,
          teamCode: invite.teamCode,
          firebaseConfig: invite.firebaseConfig ?? base.settings.firebaseConfig,
        },
      };
    }
    return base;
  });

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txInitialType, setTxInitialType] = useState<TransactionType>('worker_payment');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [syncStatus, setSyncStatus] = useState<
    'offline' | 'connecting' | 'synced' | 'error'
  >('offline');
  const [syncError, setSyncError] = useState<string | undefined>(undefined);

  const activeFirebaseConfig =
    state.settings.firebaseConfig ?? getEnvFirebaseConfig();
  const activeTeamCode = state.settings.teamCode;

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!activeTeamCode || !activeFirebaseConfig) {
      setSyncStatus('offline');
      setSyncError(undefined);
      return;
    }

    setSyncStatus('connecting');
    setSyncError(undefined);

    const unsubscribe = subscribeToWorkspace(
      activeFirebaseConfig,
      activeTeamCode,
      (cloudProjects) => {
        setSyncStatus('synced');
        setSyncError(undefined);
        if (cloudProjects.length > 0) {
          setState((prev) => ({
            ...prev,
            projects: cloudProjects,
            activeProjectId: cloudProjects.some((p) => p.id === prev.activeProjectId)
              ? prev.activeProjectId
              : cloudProjects[0].id,
          }));
        }
      },
      (cloudTransactions) => {
        setSyncStatus('synced');
        setSyncError(undefined);
        setState((prev) => ({
          ...prev,
          transactions: cloudTransactions,
        }));
      },
      (errMsg) => {
        setSyncStatus('error');
        setSyncError(errMsg);
      }
    );

    return () => unsubscribe();
  }, [activeTeamCode, activeFirebaseConfig]);

  const activeProject = useMemo(
    () =>
      state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0],
    [state.projects, state.activeProjectId]
  );

  const projectTransactions = useMemo(
    () =>
      state.transactions
        .filter((t) => t.projectId === activeProject.id)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
        ),
    [state.transactions, activeProject.id]
  );

  const summary = useMemo(
    () => calculateProjectSummary(state.transactions, activeProject.id),
    [state.transactions, activeProject.id]
  );

  const workerSummaries = useMemo(
    () => calculateWorkerSummaries(state.transactions, activeProject.id),
    [state.transactions, activeProject.id]
  );

  const knownWorkers = useMemo(
    () => getKnownWorkerNames(state.transactions, activeProject.id),
    [state.transactions, activeProject.id]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projectTransactions.filter((tx) => {
      if (ledgerFilter !== 'all' && tx.type !== ledgerFilter) return false;
      if (!q) return true;
      return (
        tx.title.toLowerCase().includes(q) ||
        (tx.note?.toLowerCase().includes(q) ?? false) ||
        (tx.category?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [projectTransactions, ledgerFilter, searchQuery]);

  const currency = state.settings.currency;

  const openNewTx = (type: TransactionType) => {
    setEditingTx(null);
    setTxInitialType(type);
    setTxModalOpen(true);
  };

  const handleSaveTx = (
    data: Omit<Transaction, 'id' | 'projectId' | 'createdAt'>,
    existingId?: string
  ) => {
    const targetTx: Transaction = existingId
      ? {
          ...(state.transactions.find((t) => t.id === existingId) as Transaction),
          ...data,
        }
      : {
          ...data,
          id: createId('tx'),
          projectId: activeProject.id,
          createdAt: new Date().toISOString(),
        };

    setState((prev) => ({
      ...prev,
      transactions: existingId
        ? prev.transactions.map((t) => (t.id === existingId ? targetTx : t))
        : [targetTx, ...prev.transactions],
    }));

    if (activeTeamCode && activeFirebaseConfig) {
      cloudUpsertTransaction(activeFirebaseConfig, activeTeamCode, targetTx).catch(
        (err) => setSyncError(String(err))
      );
    }

    setTxModalOpen(false);
    setEditingTx(null);
  };

  const handleDeleteTx = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));

    if (activeTeamCode && activeFirebaseConfig) {
      cloudDeleteTransaction(activeFirebaseConfig, activeTeamCode, id).catch((err) =>
        setSyncError(String(err))
      );
    }

    setTxModalOpen(false);
    setEditingTx(null);
  };

  const handleSaveProject = (
    data: { name: string; contractorName: string; status: 'active' | 'completed' },
    existingId?: string
  ) => {
    const targetProj: Project = existingId
      ? {
          ...(state.projects.find((p) => p.id === existingId) as Project),
          ...data,
        }
      : {
          id: createId('proj'),
          ...data,
          createdAt: new Date().toISOString(),
        };

    setState((prev) => ({
      ...prev,
      projects: existingId
        ? prev.projects.map((p) => (p.id === existingId ? targetProj : p))
        : [targetProj, ...prev.projects],
      activeProjectId: existingId ? prev.activeProjectId : targetProj.id,
    }));

    if (activeTeamCode && activeFirebaseConfig) {
      cloudUpsertProject(activeFirebaseConfig, activeTeamCode, targetProj).catch(
        (err) => setSyncError(String(err))
      );
    }

    setProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (id: string) => {
    const txIds = state.transactions
      .filter((t) => t.projectId === id)
      .map((t) => t.id);

    setState((prev) => {
      const remaining = prev.projects.filter((p) => p.id !== id);
      if (remaining.length === 0) return prev;
      return {
        ...prev,
        projects: remaining,
        transactions: prev.transactions.filter((t) => t.projectId !== id),
        activeProjectId:
          prev.activeProjectId === id ? remaining[0].id : prev.activeProjectId,
      };
    });

    if (activeTeamCode && activeFirebaseConfig) {
      cloudDeleteProject(activeFirebaseConfig, activeTeamCode, id, txIds).catch(
        (err) => setSyncError(String(err))
      );
    }

    setProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleConnectCloud = async (teamCode: string, config: FirebaseConfig) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        teamCode,
        firebaseConfig: config,
      },
    }));
    try {
      await pushLocalDataToCloud(
        config,
        teamCode,
        state.projects,
        state.transactions
      );
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDisconnectCloud = () => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        teamCode: undefined,
      },
    }));
    setSyncStatus('offline');
    setSyncError(undefined);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = buildProjectCsv(activeProject.name, projectTransactions, summary);
    const safeName = activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadFile(csv, `${safeName}_ledger.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    downloadFile(
      JSON.stringify(state, null, 2),
      `siteledger_backup_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
  };

  const handleImportJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        setState(parsed);
        if (activeTeamCode && activeFirebaseConfig) {
          pushLocalDataToCloud(
            activeFirebaseConfig,
            activeTeamCode,
            parsed.projects,
            parsed.transactions ?? []
          ).catch((err) => setSyncError(String(err)));
        }
        setSettingsOpen(false);
      }
    } catch {
      alert('Invalid backup file.');
    }
  };

  const totalBarBase = Math.max(summary.contractorReceived, summary.totalExpenses, 1);
  const workerPct = Math.min(100, (summary.workerPaid / totalBarBase) * 100);
  const materialPct = Math.min(100 - workerPct, (summary.materialSpent / totalBarBase) * 100);

  const renderTxIcon = (type: TransactionType) => {
    if (type === 'contractor_income') return <ArrowDownLeft size={18} />;
    if (type === 'worker_payment') return <HardHat size={18} />;
    return <Package size={18} />;
  };

  const renderTxRow = (tx: Transaction) => (
    <button
      key={tx.id}
      type="button"
      className="tx-item"
      onClick={() => {
        setEditingTx(tx);
        setTxModalOpen(true);
      }}
    >
      <div className={`tx-badge ${tx.type}`}>{renderTxIcon(tx.type)}</div>
      <div className="tx-main">
        <div className="tx-title">{tx.title}</div>
        <div className="tx-meta">
          {formatDateShort(tx.date)} · {tx.paymentMode}
          {tx.category ? ` · ${tx.category}` : ''}
          {tx.note ? ` · ${tx.note}` : ''}
        </div>
      </div>
      <div className={`tx-amount ${tx.type === 'contractor_income' ? 'plus' : 'minus'}`}>
        {tx.type === 'contractor_income' ? '+' : '-'}
        {formatMoney(tx.amount, currency)}
      </div>
    </button>
  );

  return (
    <div className="app-shell">
      <header className="top-header">
        <button
          type="button"
          className="project-selector-btn"
          onClick={() => setActiveTab('projects')}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="project-selector-title">{activeProject.name}</div>
            <div className="project-selector-sub">
              {syncStatus === 'synced'
                ? `Live Team: ${activeTeamCode}`
                : activeProject.contractorName
                  ? `Contractor: ${activeProject.contractorName}`
                  : 'Tap to switch or add project'}
            </div>
          </div>
          <ChevronDown size={18} />
        </button>

        {syncStatus === 'synced' && (
          <div
            title={`Synced to ${activeTeamCode}`}
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '6px 8px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Cloud size={14} />
            Live
          </div>
        )}

        <button
          type="button"
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="main-scroll">
        {activeTab === 'overview' && (
          <>
            <section
              className={`profit-card ${summary.netProfit >= 0 ? 'is-profit' : 'is-loss'}`}
            >
              <div className="profit-label-row">
                <span>{summary.netProfit >= 0 ? 'Project Net Profit' : 'Project Net Loss'}</span>
                {summary.contractorReceived > 0 && (
                  <span className="margin-pill">
                    {summary.profitMarginPct.toFixed(1)}% margin
                  </span>
                )}
              </div>
              <div className="profit-amount">{formatMoney(summary.netProfit, currency)}</div>
              <div className="profit-equation">
                <div>
                  <div className="eq-label">Contractor Given</div>
                  <div className="eq-val">
                    {formatMoney(summary.contractorReceived, currency)}
                  </div>
                </div>
                <div>
                  <div className="eq-label">Total Spent</div>
                  <div className="eq-val">{formatMoney(summary.totalExpenses, currency)}</div>
                </div>
              </div>
            </section>

            <section className="bucket-grid">
              <div className="bucket-card">
                <div className="bucket-icon income">
                  <ArrowDownLeft size={16} />
                </div>
                <div className="bucket-title">Contractor</div>
                <div className="bucket-value">
                  {formatMoney(summary.contractorReceived, currency)}
                </div>
              </div>
              <div className="bucket-card">
                <div className="bucket-icon worker">
                  <HardHat size={16} />
                </div>
                <div className="bucket-title">Workers</div>
                <div className="bucket-value">{formatMoney(summary.workerPaid, currency)}</div>
              </div>
              <div className="bucket-card">
                <div className="bucket-icon material">
                  <Package size={16} />
                </div>
                <div className="bucket-title">Purchases</div>
                <div className="bucket-value">
                  {formatMoney(summary.materialSpent, currency)}
                </div>
              </div>
            </section>

            <section className="quick-actions">
              <button
                type="button"
                className="quick-btn"
                onClick={() => openNewTx('contractor_income')}
              >
                <ArrowDownLeft size={18} color="#059669" />
                + Contractor
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => openNewTx('worker_payment')}
              >
                <HardHat size={18} color="#d97706" />
                + Worker
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => openNewTx('material_purchase')}
              >
                <Package size={18} color="#2563eb" />
                + Purchase
              </button>
            </section>

            <section className="card">
              <div className="section-header">
                <h3 className="section-title">Expense Breakdown</h3>
              </div>
              <div className="progress-track">
                <div className="progress-worker" style={{ width: `${workerPct}%` }} />
                <div className="progress-material" style={{ width: `${materialPct}%` }} />
              </div>
              <div className="legend-row">
                <span>
                  <span className="legend-dot" style={{ background: '#d97706' }} />
                  Workers: {formatMoney(summary.workerPaid, currency)}
                </span>
                <span>
                  <span className="legend-dot" style={{ background: '#2563eb' }} />
                  Things: {formatMoney(summary.materialSpent, currency)}
                </span>
              </div>
            </section>

            <section>
              <div className="section-header">
                <h3 className="section-title">Recent Entries</h3>
                {projectTransactions.length > 0 && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setActiveTab('ledger')}
                  >
                    See All ({projectTransactions.length})
                  </button>
                )}
              </div>
              {projectTransactions.length === 0 ? (
                <div className="card empty-state">
                  No payments recorded yet for <strong>{activeProject.name}</strong>. Tap one
                  of the buttons above or the <strong>+</strong> button to add your first entry.
                </div>
              ) : (
                <div className="tx-list">
                  {projectTransactions.slice(0, 5).map(renderTxRow)}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'ledger' && (
          <>
            <input
              type="search"
              className="search-input"
              placeholder="Search worker, item, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${ledgerFilter === 'all' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('all')}
              >
                All ({projectTransactions.length})
              </button>
              <button
                type="button"
                className={`chip ${ledgerFilter === 'contractor_income' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('contractor_income')}
              >
                Contractor
              </button>
              <button
                type="button"
                className={`chip ${ledgerFilter === 'worker_payment' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('worker_payment')}
              >
                Workers
              </button>
              <button
                type="button"
                className={`chip ${ledgerFilter === 'material_purchase' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('material_purchase')}
              >
                Purchases
              </button>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="card empty-state">No matching entries found.</div>
            ) : (
              <div className="tx-list">{filteredTransactions.map(renderTxRow)}</div>
            )}
          </>
        )}

        {activeTab === 'workers' && (
          <>
            <div className="section-header" style={{ marginBottom: 0 }}>
              <h3 className="section-title">Worker Totals ({workerSummaries.length})</h3>
              <button
                type="button"
                className="text-link"
                onClick={() => openNewTx('worker_payment')}
              >
                + Pay Worker
              </button>
            </div>
            {workerSummaries.length === 0 ? (
              <div className="card empty-state">
                No worker payments recorded yet for this project.
              </div>
            ) : (
              <div className="tx-list">
                {workerSummaries.map((w) => (
                  <div key={w.workerName} className="tx-item" style={{ cursor: 'default' }}>
                    <div className="tx-badge worker_payment">
                      <HardHat size={18} />
                    </div>
                    <div className="tx-main">
                      <div className="tx-title">{w.workerName}</div>
                      <div className="tx-meta">
                        {w.paymentCount} {w.paymentCount === 1 ? 'payment' : 'payments'} · Last{' '}
                        {formatDateShort(w.lastPaidDate)}
                      </div>
                    </div>
                    <div className="tx-amount minus">
                      {formatMoney(w.totalPaid, currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'projects' && (
          <>
            <div className="section-header" style={{ marginBottom: 0 }}>
              <h3 className="section-title">Your Projects ({state.projects.length})</h3>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setEditingProject(null);
                  setProjectModalOpen(true);
                }}
              >
                + New Project
              </button>
            </div>

            <div className="tx-list">
              {state.projects.map((proj) => {
                const pSum = calculateProjectSummary(state.transactions, proj.id);
                const isSelected = proj.id === activeProject.id;
                return (
                  <div
                    key={proj.id}
                    className="card"
                    style={{
                      borderColor: isSelected ? '#0f172a' : undefined,
                      borderWidth: isSelected ? 2 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => {
                          setState((prev) => ({ ...prev, activeProjectId: proj.id }));
                          setActiveTab('overview');
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 15 }}>
                          {proj.name}{' '}
                          {isSelected && (
                            <span
                              style={{
                                fontSize: 11,
                                background: '#0f172a',
                                color: '#fff',
                                padding: '2px 7px',
                                borderRadius: 999,
                                marginLeft: 4,
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {proj.contractorName || 'No contractor name'} · {proj.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setEditingProject(proj);
                          setProjectModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ color: '#64748b' }}>Received</div>
                        <div style={{ fontWeight: 700 }}>
                          {formatMoney(pSum.contractorReceived, currency)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b' }}>Spent</div>
                        <div style={{ fontWeight: 700 }}>
                          {formatMoney(pSum.totalExpenses, currency)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b' }}>Profit</div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: pSum.netProfit >= 0 ? '#059669' : '#dc2626',
                          }}
                        >
                          {formatMoney(pSum.netProfit, currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <button
        type="button"
        className="fab"
        onClick={() => openNewTx('worker_payment')}
        aria-label="Add payment"
      >
        <Plus size={26} />
      </button>

      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={20} />
          Overview
        </button>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <ListOrdered size={20} />
          Ledger
        </button>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'workers' ? 'active' : ''}`}
          onClick={() => setActiveTab('workers')}
        >
          <Users size={20} />
          Workers
        </button>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FolderKanban size={20} />
          Projects
        </button>
      </nav>

      {txModalOpen && (
        <TransactionModal
          initialType={txInitialType}
          editingTx={editingTx}
          knownWorkers={knownWorkers}
          currency={currency}
          onClose={() => {
            setTxModalOpen(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTx}
          onDelete={handleDeleteTx}
        />
      )}

      {projectModalOpen && (
        <ProjectModal
          editingProject={editingProject}
          canDelete={state.projects.length > 1}
          onClose={() => {
            setProjectModalOpen(false);
            setEditingProject(null);
          }}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          currency={currency}
          teamCode={activeTeamCode}
          firebaseConfig={state.settings.firebaseConfig}
          syncStatus={syncStatus}
          syncError={syncError}
          onChangeCurrency={(c) =>
            setState((prev) => ({
              ...prev,
              settings: { ...prev.settings, currency: c },
            }))
          }
          onConnectCloud={handleConnectCloud}
          onDisconnectCloud={handleDisconnectCloud}
          onExportCsv={handleExportCsv}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onLoadDemo={() => {
            const demo = createDemoData();
            setState((prev) => ({
              ...demo,
              settings: { ...prev.settings, currency: demo.settings.currency },
            }));
            if (activeTeamCode && activeFirebaseConfig) {
              pushLocalDataToCloud(
                activeFirebaseConfig,
                activeTeamCode,
                demo.projects,
                demo.transactions
              ).catch((err) => setSyncError(String(err)));
            }
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
