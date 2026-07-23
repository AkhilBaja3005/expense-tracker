import React, { useState } from 'react';
import { CATEGORIES } from '../utils/categorizer';

function BudgetModal({ 
  currentBudget, 
  categoryBudgets = {}, 
  onSave, 
  onClose, 
  currencySymbol = '$',
  isPushSupported = false,
  isPushEnabled = false,
  onTogglePush,
  onResetCache
}) {
  const [budget, setBudget] = useState(currentBudget);
  const [catBudgets, setCatBudgets] = useState({ ...categoryBudgets });

  const [customRules, setCustomRules] = useState(() => {
    try {
      const data = localStorage.getItem('expenser_custom_categorization');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  });

  const handleCatBudgetChange = (catKey, value) => {
    setCatBudgets(prev => ({
      ...prev,
      [catKey]: value === '' ? '' : parseFloat(value) || 0
    }));
  };

  const handleDeleteRule = (keyword) => {
    const updated = { ...customRules };
    delete updated[keyword];
    setCustomRules(updated);
    localStorage.setItem('expenser_custom_categorization', JSON.stringify(updated));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
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
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px' }}>App Settings & Budgets</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Overall Budget */}
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Overall Monthly Budget Limit ({currencySymbol})</label>
            <input
              type="number"
              className="input-field"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 1500"
              required
            />
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--glass-border)', margin: '2px 0' }} />
          
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Category Budgets (Optional)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{cat.icon}</span> <span>{cat.name}</span>
                </span>
                <input
                  type="number"
                  placeholder="No limit"
                  className="input-field"
                  value={catBudgets[key] ?? ''}
                  onChange={(e) => handleCatBudgetChange(key, e.target.value)}
                  style={{ width: '90px', padding: '5px 8px', fontSize: '12px' }}
                />
              </div>
            ))}
          </div>

          {/* AI Rules Manager */}
          {Object.keys(customRules).length > 0 && (
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                🤖 Auto-Categorization Rules
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '90px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(customRules).map(([keyword, catKey]) => (
                  <div key={keyword} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: '4px', fontSize: '11px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                      "{keyword}" ➔ {CATEGORIES[catKey]?.icon} {catKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(keyword)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '12px' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Push Notifications Toggle */}
          {isPushSupported && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>🔔 Daily Reminders</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Get push alerts at 9AM & 9PM</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPushEnabled}
                  onChange={onTogglePush}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: isPushEnabled ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                  transition: '.2s',
                  borderRadius: '20px'
                }}>
                  <span style={{
                    position: 'absolute',
                    height: '14px', width: '14px',
                    left: isPushEnabled ? '20px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '.2s',
                    borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>
          )}

          {/* System Force Sync Reset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>⚙️ System Recovery</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Warning: This will clear your local storage cache, discard offline changes, and force-pull your fresh transaction logs from Supabase cloud. Continue?")) {
                  onResetCache();
                }
              }}
              style={{
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                color: 'var(--danger)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%'
              }}
            >
              🔄 Clear Cache & Force Cloud Sync
            </button>
          </div>

          <div className="btn-group" style={{ marginTop: '4px' }}>
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

export default React.memo(BudgetModal);
