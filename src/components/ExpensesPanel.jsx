import React from 'react';
import { CATEGORIES } from '../utils/categorizer';
import ExpenseListItem from './ExpenseListItem';

export default function ExpensesPanel({
  activeTab,
  onAddExpenseClick,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOptions,
  dateFilter,
  setDateFilter,
  dateFilters,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  categoryFilter,
  setCategoryFilter,
  filteredExpenses,
  expenses,
  onLoadDemoData,
  hasDemoData,
  onClearDemoData,
  categoryBudgets,
  getCategorySpending,
  currSymbol,
  swipedItemId,
  handleSwipeOpen,
  handleSwipeClose,
  handleListItemClick,
  handleListItemDelete
}) {
  return (
    <div className={`right-column ${activeTab === 'expenses' ? 'show-mobile' : 'hide-mobile'}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div className="section-title" style={{ marginBottom: '12px' }}>
          <span>Expenses List</span>
          <button
            onClick={onAddExpenseClick}
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              border: 'none',
              color: '#030712',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              display: 'none'
            }}
            className="desktop-add-btn"
          >
            + Add Expense
          </button>
          <style>{`
            @media (min-width: 768px) {
              .desktop-add-btn { display: block !important; }
            }
          `}</style>
        </div>

        {/* Search & Custom Advanced Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '10px 14px', fontSize: '14px' }}
          />

          {/* Sorter and Date Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field"
              style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}
            >
              {Object.entries(sortOptions).map(([key, label]) => (
                <option key={key} value={key} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field"
              style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}
            >
              {Object.entries(dateFilters).map(([key, label]) => (
                <option key={key} value={key} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Bounds */}
          {dateFilter === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px', fontSize: '11px' }}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px', fontSize: '11px' }}
              />
            </div>
          )}

          {/* Category filters */}
          <div className="filter-tabs-container" style={{ marginTop: '4px' }}>
            <button
              onClick={() => setCategoryFilter('All')}
              className={`filter-tab-btn ${categoryFilter === 'All' ? 'active' : ''}`}
            >
              All
            </button>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={`filter-tab-btn ${categoryFilter === key ? 'active' : ''}`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="empty-state glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '30px 20px', alignItems: 'center' }}>
            <div className="icon" style={{ fontSize: '32px' }}>💸</div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              {expenses.length === 0 ? "You haven't logged any expenses yet." : "No transactions match your filters."}
            </p>
            {expenses.length === 0 && (
              <button
                onClick={onLoadDemoData}
                style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                🧪 Load Sample Demo Data
              </button>
            )}
          </div>
        ) : (
          <>
            {hasDemoData && (
              <div style={{
                background: 'rgba(251, 146, 60, 0.08)',
                border: '1px solid rgba(251, 146, 60, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🧪</span> <span>Currently showing sample demo data.</span>
                </span>
                <button
                  onClick={onClearDemoData}
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    color: 'var(--danger)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px'
                  }}
                >
                  Clear Demo Data
                </button>
              </div>
            )}
            <div className="expense-list">
            {filteredExpenses.map((exp) => {
              const cat = CATEGORIES[exp.category] || CATEGORIES.Others;
              const catLimit = categoryBudgets[exp.category];
              const catSpent = getCategorySpending(exp.category);
              const isOverCategoryBudget = catLimit && catLimit > 0 && catSpent > catLimit;

              return (
                <ExpenseListItem
                  key={exp.id}
                  expense={exp}
                  currencySymbol={currSymbol}
                  categoryInfo={cat}
                  isOverCategoryBudget={isOverCategoryBudget}
                  isSwiped={swipedItemId === exp.id}
                  onSwipeOpen={handleSwipeOpen}
                  onSwipeClose={handleSwipeClose}
                  onClick={handleListItemClick}
                  onDelete={handleListItemDelete}
                  searchQuery={searchQuery}
                />
              );
            })}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
