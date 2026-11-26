import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Project } from '../types';

interface ProjectModalProps {
  editingProject?: Project | null;
  canDelete: boolean;
  onClose: () => void;
  onSave: (
    data: { name: string; contractorName: string; status: 'active' | 'completed' },
    existingId?: string
  ) => void;
  onDelete?: (id: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  editingProject,
  canDelete,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState(editingProject?.name ?? '');
  const [contractorName, setContractorName] = useState(
    editingProject?.contractorName ?? ''
  );
  const [status, setStatus] = useState<'active' | 'completed'>(
    editingProject?.status ?? 'active'
  );
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    onSave(
      {
        name: name.trim(),
        contractorName: contractorName.trim(),
        status,
      },
      editingProject?.id
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingProject ? 'Edit Project' : 'New Project'}
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field-group">
            <label className="field-label">Project Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Green Park House, Site B"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoFocus
            />
          </div>

          <div className="field-group">
            <label className="field-label">Contractor / Client Name (Optional)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Ramesh Builders"
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
            />
          </div>

          {editingProject && (
            <div className="field-group">
              <label className="field-label">Status</label>
              <div className="pill-grid">
                <button
                  type="button"
                  className={`chip ${status === 'active' ? 'active' : ''}`}
                  onClick={() => setStatus('active')}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`chip ${status === 'completed' ? 'active' : ''}`}
                  onClick={() => setStatus('completed')}
                >
                  Completed
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{error}</div>
          )}

          <button type="submit" className="btn-primary">
            {editingProject ? 'Save Project' : 'Create Project'}
          </button>

          {editingProject && canDelete && onDelete && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => onDelete(editingProject.id)}
            >
              <Trash2 size={16} /> Delete Project & Its Entries
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

