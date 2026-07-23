import React, { useState } from 'react';
import { CATEGORIES } from '../utils/categorizer';

export default function BudgetModal({ currentBudget, categoryBudgets = {}, onSave, onClose, currencySymbol = '$' }) {
  const [budget, setBudget] = useState(currentBudget);
  const [catBudgets, setCatBudgets] = useState({ ...categoryBudgets });

  const handleCatBudgetChange = (catKey, value) => {
    setCatBudgets(prev => ({
      ...prev,
      [catKey]: value === '' ? '' : parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Clean up empty category budgets
    const cleanedCatBudgets = {};
    Object.entries(catBudgets).forEach(([key, val]) => {
      if (val !== '' && val > 0) {
        cleanedCatBudgets[key] = val;
      }
    });

    onSave(parseFloat(budget) || 0, cleanedCatBudgets);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Edit Monthly Budgets</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Overall Budget */}
          <div className="form-group">
            <label style={{ fontWeight: '600' }}>Overall Monthly Budget Limit ({currencySymbol})</label>
            <input
              type="number"
              className="input-field"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 1500"
              required
            />
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
          
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Category Budgets (Optional)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{cat.icon}</span> <span>{cat.name}</span>
                </span>
                <input
                  type="number"
                  placeholder="No limit"
                  className="input-field"
                  value={catBudgets[key] ?? ''}
                  onChange={(e) => handleCatBudgetChange(key, e.target.value)}
                  style={{ width: '100px', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
            ))}
          </div>

          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
