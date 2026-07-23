import React, { useState } from 'react';

function SavingsGoalsCard({ 
  goals = [], 
  currencySymbol = '$', 
  onAddGoal, 
  onAddContribution, 
  onDeleteGoal 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  const [activeAllocateId, setActiveAllocateId] = useState(null);
  const [allocateAmt, setAllocateAmt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;
    onAddGoal(name, parseFloat(targetAmount), deadline);
    setName('');
    setTargetAmount('');
    setDeadline('');
    setShowAddForm(false);
  };

  const handleAllocateSubmit = (goalId) => {
    if (!allocateAmt) return;
    onAddContribution(goalId, parseFloat(allocateAmt));
    setAllocateAmt('');
    setActiveAllocateId(null);
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
          🎯 Savings Goals
        </h3>
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
          {showAddForm ? 'Close' : '+ New Goal'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
          <input
            type="text"
            placeholder="Goal name (e.g. Vacation)"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px' }}
            required
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="number"
              placeholder={`Target Amount (${currencySymbol})`}
              className="input-field"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px', flex: 1 }}
              required
            />
            <input
              type="date"
              className="input-field"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px', width: '120px' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: '11px', fontWeight: '600' }}>
            Create Goal
          </button>
        </form>
      )}

      {goals.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '2px 0' }}>
          No savings goals configured. Plan your emergency funds or custom targets to start allocating money.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {goals.map(g => {
            const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
            const remaining = g.targetAmount - g.currentAmount;
            
            return (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.01)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{g.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>
                      {currencySymbol}{g.currentAmount.toFixed(0)} / {currencySymbol}{g.targetAmount.toFixed(0)}
                    </span>
                    <button
                      onClick={() => onDeleteGoal(g.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                      title="Delete goal"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="progress-container" style={{ height: '6px', margin: '2px 0' }}>
                  <div 
                    className="progress-bar" 
                    style={{ 
                      width: `${pct}%`,
                      background: pct >= 100 ? 'var(--success)' : 'var(--accent-primary)' 
                    }}
                  ></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>{pct.toFixed(0)}% Saved</span>
                  <span>{g.deadline ? `Target: ${new Date(g.deadline).toLocaleDateString(undefined, { dateStyle: 'short' })}` : 'No target date'}</span>
                </div>

                {activeAllocateId === g.id ? (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    <input
                      type="number"
                      placeholder="Amt to add"
                      className="input-field"
                      value={allocateAmt}
                      onChange={(e) => setAllocateAmt(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                      autoFocus
                    />
                    <button 
                      onClick={() => handleAllocateSubmit(g.id)}
                      className="btn btn-primary" 
                      style={{ padding: '4px 10px', fontSize: '10px' }}
                    >
                      Add
                    </button>
                    <button 
                      onClick={() => setActiveAllocateId(null)}
                      className="btn btn-secondary" 
                      style={{ padding: '4px 10px', fontSize: '10px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  remaining > 0 && (
                    <button
                      onClick={() => {
                        setActiveAllocateId(g.id);
                        setAllocateAmt('');
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--accent-primary)',
                        padding: '4px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: '600',
                        marginTop: '4px',
                        width: '100%',
                        textAlign: 'center'
                      }}
                    >
                      💰 Allocate Funds
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default React.memo(SavingsGoalsCard);
