import React, { useState, useEffect } from 'react';
import { getSyncQueue, deleteFromSyncQueue } from '../utils/storage';
import { CATEGORIES } from '../utils/categorizer';

function OfflineQueueModal({ onClose, onQueueChanged }) {
  const [queue, setQueue] = useState([]);

  const loadQueue = () => {
    setQueue(getSyncQueue());
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleRemove = (timestamp) => {
    if (window.confirm("Are you sure you want to discard this pending change? It will not be synced to the database.")) {
      deleteFromSyncQueue(timestamp);
      loadQueue();
      onQueueChanged();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>Pending Offline Syncs</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
          These changes were made while offline and will automatically upload once your internet connection stabilizes. You can discard any pending actions below.
        </p>

        {queue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            🎉 No pending syncs! All updates are uploaded.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
            {queue.map((task) => {
              const dateStr = new Date(task.timestamp).toLocaleTimeString(undefined, { timeStyle: 'short' });
              const isExpense = task.type === 'expense';
              const cat = isExpense ? (CATEGORIES[task.payload.category] || CATEGORIES.Others) : null;
              
              return (
                <div 
                  key={task.timestamp} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: 'rgba(255,255,255,0.03)', 
                    padding: '8px 12px', 
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '80%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                      <span style={{ 
                        fontSize: '9px', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        background: task.action === 'delete' ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                        color: task.action === 'delete' ? 'var(--danger)' : 'var(--success)',
                        textTransform: 'uppercase'
                      }}>
                        {task.action}
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {isExpense ? `${cat.icon} ${task.payload.description}` : 'Settings Update'}
                      </span>
                    </div>
                    {isExpense && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Amount: {task.payload.amount} • {dateStr}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(task.timestamp)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px'
                    }}
                    title="Discard change"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 16px', fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(OfflineQueueModal);
