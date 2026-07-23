import React, { useState } from 'react';

function IncomeCard({ 
  incomeList = [], 
  currencySymbol = '$', 
  onAddIncome, 
  onDeleteIncome 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!source.trim() || !amount) return;
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }
    onAddIncome(source, parsedAmount, date, notes);
    setSource('');
    setAmount('');
    setNotes('');
    setShowAddForm(false);
  };

  const totalIncome = incomeList.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            💵 Monthly Income
          </h3>
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success)', marginTop: '2px', display: 'block' }}>
            +{currencySymbol}{totalIncome.toFixed(2)}
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            padding: '3px 10px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: '600'
          }}
        >
          {showAddForm ? 'Close' : '+ Add'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
          <input
            type="text"
            placeholder="Income source (e.g. Salary)"
            className="input-field"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px' }}
            required
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder={`Amount (${currencySymbol})`}
              className="input-field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px', flex: 1 }}
              required
            />
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px', width: '120px' }}
              required
            />
          </div>
          <input
            type="text"
            placeholder="Notes (optional)"
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: '11px', fontWeight: '600' }}>
            Add Income
          </button>
        </form>
      )}

      {incomeList.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '2px 0' }}>
          No income logs registered this month. Log earnings to calculate exact financial surplus totals.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '2px' }}>
          {incomeList.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontSize: '11px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.source}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {new Date(item.date).toLocaleDateString(undefined, { dateStyle: 'short' })} {item.notes && `• ${item.notes}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                  +{currencySymbol}{item.amount.toFixed(0)}
                </span>
                <button
                  onClick={() => onDeleteIncome(item.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                  title="Delete log"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(IncomeCard);
