import React, { useState } from 'react';

function CsvMapperModal({ headers, rows, onConfirm, onClose }) {
  const [mapping, setMapping] = useState({
    description: headers.findIndex(h => h.toLowerCase().includes('desc')) !== -1 ? headers.findIndex(h => h.toLowerCase().includes('desc')) : 0,
    amount: headers.findIndex(h => h.toLowerCase().includes('amt') || h.toLowerCase().includes('amount')) !== -1 ? headers.findIndex(h => h.toLowerCase().includes('amt') || h.toLowerCase().includes('amount')) : 1,
    category: headers.findIndex(h => h.toLowerCase().includes('cat')) !== -1 ? headers.findIndex(h => h.toLowerCase().includes('cat')) : -1,
    date: headers.findIndex(h => h.toLowerCase().includes('date')) !== -1 ? headers.findIndex(h => h.toLowerCase().includes('date')) : -1,
    notes: headers.findIndex(h => h.toLowerCase().includes('note')) !== -1 ? headers.findIndex(h => h.toLowerCase().includes('note')) : -1
  });

  const handleFieldChange = (field, idxStr) => {
    const idx = parseInt(idxStr);
    setMapping(prev => ({ ...prev, [field]: idx }));
  };

  const handleConfirm = () => {
    if (mapping.description === -1 || mapping.amount === -1) {
      alert("Please map at least the Description and Amount columns.");
      return;
    }
    onConfirm(mapping);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Map CSV Columns</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Align your CSV file's headers to correct expense fields for accurate transactions logging.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {[
            { key: 'description', label: 'Description * (Required)' },
            { key: 'amount', label: 'Amount * (Required)' },
            { key: 'category', label: 'Category (Optional)' },
            { key: 'date', label: 'Date (Optional)' },
            { key: 'notes', label: 'Notes (Optional)' }
          ].map(field => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>{field.label}</label>
              <select
                className="input-field"
                value={mapping[field.key]}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                <option value="-1">-- Unmapped --</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h} (Column {i+1})</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Row Previews */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>First Row Preview:</span>
          {rows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '11px' }}>
              <div><strong>Description:</strong> {mapping.description !== -1 ? rows[0][mapping.description] : 'N/A'}</div>
              <div><strong>Amount:</strong> {mapping.amount !== -1 ? rows[0][mapping.amount] : 'N/A'}</div>
              <div><strong>Category:</strong> {mapping.category !== -1 ? rows[0][mapping.category] : 'Others'}</div>
              <div><strong>Date:</strong> {mapping.date !== -1 ? rows[0][mapping.date] : 'Today'}</div>
              <div><strong>Notes:</strong> {mapping.notes !== -1 ? rows[0][mapping.notes] : 'N/A'}</div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No records preview.</div>
          )}
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Import All Records</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CsvMapperModal);
