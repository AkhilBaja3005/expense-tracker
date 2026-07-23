import React, { useState, useEffect, useRef } from 'react';

function ExpenseListItem({
  expense,
  currencySymbol,
  categoryInfo,
  isOverCategoryBudget,
  isSwiped,
  onSwipeOpen,
  onSwipeClose,
  onClick,
  onDelete
}) {
  const [localSwipeX, setLocalSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Sync swipe state with parent's directive
  useEffect(() => {
    if (!isSwiped) {
      setLocalSwipeX(0);
    } else {
      setLocalSwipeX(-74);
    }
  }, [isSwiped]);

  const handleTouchStart = (e) => {
    // If some other item was swiped, reset it by telling parent we're starting a swipe
    if (!isSwiped) {
      onSwipeClose();
    }
    touchStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const diff = touchStartX.current - e.touches[0].clientX;
    if (diff > 0) {
      // Dragging left: follow finger up to 84px
      const displacement = Math.min(diff, 84);
      setLocalSwipeX(-displacement);
    } else {
      // Dragging right: snap to 0
      setLocalSwipeX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Snap open if swiped more than 40px left
    if (localSwipeX <= -40) {
      setLocalSwipeX(-74);
      onSwipeOpen(expense.id);
    } else {
      setLocalSwipeX(0);
      onSwipeClose();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 'calc(100% + 74px)',
          transform: `translateX(${localSwipeX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0
        }}
      >
        {/* Foreground Transaction Card */}
        <div
          className="expense-item"
          style={{
            width: 'calc(100% - 74px)',
            flexShrink: 0
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (isSwiped) {
              onSwipeClose();
            } else {
              onClick(expense);
            }
          }}
        >
          <div className="expense-left">
            <div className="cat-icon-container" style={{ color: categoryInfo.color }}>
              {categoryInfo.icon}
            </div>
            <div className="expense-info">
              <span className="expense-desc" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {expense.description}
                {isOverCategoryBudget && (
                  <span
                    style={{
                      fontSize: '9px',
                      color: 'var(--danger)',
                      background: 'rgba(244, 63, 94, 0.08)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: '700',
                      letterSpacing: '0.2px'
                    }}
                    title="Category Budget Exceeded"
                  >
                    Limit Exceeded
                  </span>
                )}
              </span>
              <span className="expense-date">
                {new Date(expense.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
            </div>
          </div>
          <div className="expense-right">
            <span className="expense-amount" style={{ color: categoryInfo.color }}>
              -{currencySymbol}{expense.amount.toFixed(2)}
            </span>
            {(expense.notes || expense.isSubscription) && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: '4px', alignItems: 'center' }}>
                {expense.isSubscription && <span title="Recurring subscription">🔁</span>}
                {expense.notes}
              </span>
            )}
          </div>
        </div>

        {/* Red Swipe Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(expense.id);
          }}
          style={{
            width: '74px',
            background: 'var(--danger)',
            color: 'white',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}

export default React.memo(ExpenseListItem);