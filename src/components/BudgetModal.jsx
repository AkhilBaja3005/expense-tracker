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
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem('expenser_theme_accent') || 'cyan');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('expenser_timezone') || 'UTC');

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

    localStorage.setItem('expenser_theme_accent', themeAccent);
    localStorage.setItem('expenser_timezone', timezone);

    // Apply CSS overrides
    let primary = '6, 182, 212';
    let glow = 'rgba(6, 182, 212, 0.15)';
    if (themeAccent === 'rose') {
      primary = '244, 63, 94';
      glow = 'rgba(244, 63, 94, 0.15)';
    } else if (themeAccent === 'emerald') {
      primary = '16, 185, 129';
      glow = 'rgba(16, 185, 129, 0.15)';
    } else if (themeAccent === 'amber') {
      primary = '245, 158, 11';
      glow = 'rgba(245, 158, 11, 0.15)';
    }
    document.documentElement.style.setProperty('--accent-primary', `rgb(${primary})`);
    document.documentElement.style.setProperty('--accent-glow', glow);

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
          {/* Color Accent Theme selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>🎨 Neon Accent Theme</span>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'cyan', color: '#06b6d4', name: 'Cyan' },
                { id: 'rose', color: '#f43f5e', name: 'Rose' },
                { id: 'emerald', color: '#10b981', name: 'Emerald' },
                { id: 'amber', color: '#f59e0b', name: 'Amber' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setThemeAccent(item.id)}
                  style={{
                    background: themeAccent === item.id ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    border: themeAccent === item.id ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    fontWeight: '600'
                  }}
                >
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>🌍 App Timezone</span>
            <select
              className="input-field"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '12px', marginTop: '4px' }}
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="GMT">GMT (Greenwich Mean Time)</option>
              <option value="IST">IST (Indian Standard Time)</option>
              <option value="EST">EST (Eastern Standard Time)</option>
              <option value="PST">PST (Pacific Standard Time)</option>
            </select>
          </div>

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
