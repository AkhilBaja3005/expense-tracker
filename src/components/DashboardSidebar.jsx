import React from 'react';
import { CATEGORIES } from '../utils/categorizer';
import AnalyticsCharts from './AnalyticsCharts';
import SavingsGoalsCard from './SavingsGoalsCard';
import IncomeCard from './IncomeCard';

const getSubscriptionCountdown = (billingDay) => {
  if (!billingDay) return null;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const todayMidnight = new Date(year, month, today.getDate());
  let billingDate = new Date(year, month, billingDay);

  if (billingDate < todayMidnight) {
    billingDate = new Date(year, month + 1, billingDay);
  }

  const diffTime = billingDate - todayMidnight;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'due today 🔔';
  }
  if (diffDays === 1) {
    return 'due tomorrow ⏰';
  }
  return `due in ${diffDays} days`;
};

const getProgressBarClass = (prog) => {
  if (prog >= 90) return 'progress-bar danger';
  if (prog >= 75) return 'progress-bar warning';
  return 'progress-bar';
};

export default function DashboardSidebar({
  activeTab,
  currSymbol,
  currency,
  totalSpent,
  budget,
  budgetProgress,
  healthScore,
  expenses,
  spentToday,
  spentThisWeek,
  spentThisMonth,
  safeDailyLimit,
  subscriptions,
  totalSubscriptionCost,
  categoryBudgets,
  getCategorySpending,
  setActiveBudgetModal,
  goals,
  incomeList,
  onAddIncome,
  onDeleteIncome,
  onAddSavingsGoal,
  onAddGoalContribution,
  onDeleteSavingsGoal,
  chartPeriod,
  setChartPeriod,
  chartExpenses,
  categoryFilter,
  setCategoryFilter,
  fetchAiInsights,
  isAiInsightsLoading,
  aiInsights,
  fetchAiForecast,
  isAiForecastLoading,
  aiForecast,
  handleExportCSV,
  handleImportCSV,
  handleExportPDF,
  sendTestNotification
}) {
  return (
    <div className={`left-column ${activeTab === 'dashboard' || activeTab === 'planning' || activeTab === 'analytics' ? 'show-mobile' : 'hide-mobile'}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* OVERVIEW SECTION */}
      <div className={activeTab === 'dashboard' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Overall Budget Status */}
        <div className="glass-card budget-summary">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Overall Limit</span>
          <button
            onClick={() => setActiveBudgetModal(true)}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '600',
              padding: '3px 8px',
              borderRadius: '12px'
            }}
          >
            Configure
          </button>
        </div>

        <div className="budget-row" style={{ marginTop: '-4px' }}>
          <span className="budget-amount">
            {currSymbol}{totalSpent.toFixed(2)} <span>/ {currSymbol}{budget.toFixed(2)}</span>
          </span>
        </div>

        <div className="progress-container">
          <div
            className={getProgressBarClass(budgetProgress)}
            style={{ width: `${budgetProgress}%` }}
          ></div>
        </div>

         <div className="stats-grid" style={{ marginBottom: '4px', gridTemplateColumns: 'repeat(3, 1fr)', display: 'grid' }}>
          <div className="stat-item">
            <span className="stat-label">Remaining</span>
            <span className="stat-val" style={{ color: budget - totalSpent >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '13px' }}>
              {currSymbol}{(budget - totalSpent).toFixed(0)}
            </span>
          </div>
          <div className="stat-item" style={{ alignItems: 'center' }}>
            <span className="stat-label">Health Score</span>
            <span className="stat-val" style={{
              color: healthScore >= 85 ? 'var(--success)' : (healthScore >= 50 ? 'var(--warning)' : 'var(--danger)'),
              fontWeight: '700',
              fontSize: '13px'
            }}>
              {healthScore}%
            </span>
          </div>
          <div className="stat-item" style={{ alignItems: 'flex-end' }}>
            <span className="stat-label">Trans.</span>
            <span className="stat-val" style={{ fontSize: '13px' }}>{expenses.length}</span>
          </div>
        </div>

        {/* Quick Period Overviews (Daily, Weekly, Monthly) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px 0', borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)', margin: '4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Today</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currSymbol}{spentToday.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>This Week</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currSymbol}{spentThisWeek.toFixed(0)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>This Month</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currSymbol}{spentThisMonth.toFixed(0)}</span>
          </div>
        </div>

        {/* Safe Daily Spending Limit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>💡 Safe Daily Spending Limit</span>
          <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>
            {currSymbol}{safeDailyLimit.toFixed(2)} / day
          </span>
        </div>

      </div>

      {/* Smart Subscriptions / Recurring Bills Card */}
      {subscriptions.length > 0 && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                🔁 Fixed Subscriptions
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Consumes {(budget > 0 ? (totalSubscriptionCost / budget) * 100 : 0).toFixed(1)}% of budget
              </span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-primary)' }}>
              {currSymbol}{totalSubscriptionCost.toFixed(2)}/mo
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
            {subscriptions.map(sub => {
              const cat = CATEGORIES[sub.category] || CATEGORIES.Others;
              const countdown = getSubscriptionCountdown(sub.billingDay);
              return (
                <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{cat.icon} {sub.description}</span>
                    {countdown && (
                      <span style={{
                        fontSize: '9px',
                        color: countdown.includes('today') || countdown.includes('tomorrow') ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: '600'
                      }}>
                        📅 Day {sub.billingDay} ({countdown})
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>-{currSymbol}{sub.amount.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Budgets Warnings list */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Category Budgets
          </h3>
          {Object.keys(categoryBudgets).length === 0 && (
            <button
              onClick={() => setActiveBudgetModal(true)}
              style={{
                background: 'var(--accent-glow)',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
                padding: '4px 10px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              + Set limits
            </button>
          )}
        </div>

        {Object.keys(categoryBudgets).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(categoryBudgets).map(([catKey, catLimit]) => {
              const catSpent = getCategorySpending(catKey);
              const catInfo = CATEGORIES[catKey] || CATEGORIES.Others;
              const catProg = Math.min((catSpent / catLimit) * 100, 100);

              return (
                <div key={catKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>{catInfo.icon} {catInfo.name}</span>
                    <span style={{ fontWeight: '500' }}>
                      {currSymbol}{catSpent.toFixed(0)} / {currSymbol}{catLimit.toFixed(0)}
                    </span>
                  </div>
                  <div className="progress-container" style={{ height: '5px' }}>
                    <div
                      className={getProgressBarClass(catProg)}
                      style={{ width: `${catProg}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            No category limits set. Set individual spending limits on Food, Dining, Shopping, etc., to monitor them closely.
          </p>
        )}
      </div>
    </div>

      {/* PLANNING SECTION */}
      <div className={activeTab === 'planning' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Budget Surplus Rollover Widget */}
        {budget > 0 && totalSpent < budget && (
          <div className="glass-card" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success)' }}>🎉 Budget Surplus Detected!</span>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>{currSymbol}{(budget - totalSpent).toFixed(0)} saved</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              You spent less than your monthly limit! Rollover this leftover surplus directly into your active Savings Goals.
            </p>
            {goals.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <select
                  id="surplus-target-goal"
                  className="input-field"
                  style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                >
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({currSymbol}{g.currentAmount}/{currSymbol}{g.targetAmount})</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const selectEl = document.getElementById('surplus-target-goal');
                    if (selectEl && selectEl.value) {
                      onAddGoalContribution(selectEl.value, budget - totalSpent);
                      alert("Successfully allocated surplus to your savings goal!");
                    }
                  }}
                  style={{
                    background: 'var(--success)',
                    border: 'none',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Allocate All
                </button>
              </div>
            ) : (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Create a savings goal below to allocate this surplus.</span>
            )}
          </div>
        )}

        {/* Monthly Income Tracker Card */}
        <IncomeCard
          incomeList={incomeList}
          currencySymbol={currSymbol}
          onAddIncome={onAddIncome}
          onDeleteIncome={onDeleteIncome}
        />

        {/* Savings Goals Target Tracker */}
        <SavingsGoalsCard
          goals={goals}
          currencySymbol={currSymbol}
          onAddGoal={onAddSavingsGoal}
          onAddContribution={onAddGoalContribution}
          onDeleteGoal={onDeleteSavingsGoal}
        />
      </div>

      {/* ANALYTICS SECTION */}
      <div className={activeTab === 'analytics' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Distribution chart & AI Savings Advisor */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Distribution ({currency})
          </h3>
          <button
            onClick={fetchAiInsights}
            disabled={isAiInsightsLoading}
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              padding: '4px 10px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            {isAiInsightsLoading ? '💡 Analyzing...' : '💡 AI Insights'}
          </button>
        </div>

        {/* Period Switcher Tabs */}
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
          {['today', 'week', 'month', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setChartPeriod(p)}
              style={{
                background: chartPeriod === p ? 'var(--accent-glow)' : 'none',
                border: '1px solid',
                borderColor: chartPeriod === p ? 'var(--accent-primary)' : 'var(--glass-border)',
                color: chartPeriod === p ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '600',
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>

        <AnalyticsCharts
          expenses={chartExpenses}
          currencySymbol={currSymbol}
          selectedCategory={categoryFilter}
          onSelectCategory={setCategoryFilter}
        />

        {/* AI Insights Display */}
        {aiInsights && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            maxHeight: '130px',
            overflowY: 'auto'
          }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Gemini Financial Advice:
            </strong>
            <div style={{ whiteSpace: 'pre-wrap' }}>{aiInsights}</div>
          </div>
        )}

        {/* AI Forecast & Projections */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>🔮 AI Spending Forecast</span>
            <button
              onClick={fetchAiForecast}
              disabled={isAiForecastLoading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                padding: 0
              }}
            >
              {isAiForecastLoading ? 'Predicting...' : (aiForecast ? '🔄 Refresh' : 'Get Projection')}
            </button>
          </div>

          {aiForecast && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              maxHeight: '110px',
              overflowY: 'auto'
            }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{aiForecast}</div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Backup Action card */}
    <div className={activeTab === 'dashboard' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            onClick={handleExportCSV}
            style={{
              flex: 1,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            📥 Export CSV
          </button>
          <label
            style={{
              flex: 1,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            📤 Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <button
          onClick={handleExportPDF}
          style={{
            width: '100%',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            padding: '10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '600'
          }}
        >
          📄 Export PDF Report
        </button>

        <button
          onClick={sendTestNotification}
          style={{
            width: '100%',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            color: 'var(--accent-primary)',
            padding: '10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '600'
          }}
        >
          🔔 Test Push Notification
        </button>
      </div>
    </div>
    </div>
  );
}
