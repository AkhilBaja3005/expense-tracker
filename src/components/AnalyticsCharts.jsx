import React from 'react';
import { CATEGORIES } from '../utils/categorizer';

export default function AnalyticsCharts({ expenses, currencySymbol, selectedCategory, onSelectCategory }) {
  // Aggregate expenses by category
  const totals = {};
  let grandTotal = 0;

  // Initialize all categories with 0
  Object.keys(CATEGORIES).forEach((key) => {
    totals[key] = 0;
  });

  expenses.forEach((exp) => {
    const cat = exp.category || 'Others';
    const amount = parseFloat(exp.amount) || 0;
    if (totals[cat] !== undefined) {
      totals[cat] += amount;
    } else {
      totals['Others'] += amount;
    }
    grandTotal += amount;
  });

  if (grandTotal === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📊</div>
        <p>No expense data available for charts</p>
      </div>
    );
  }

  // Calculate angles and offsets for SVG circle
  const size = 160;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  const chartSegments = Object.entries(totals)
    .filter(([_, val]) => val > 0)
    .map(([key, val]) => {
      const percentage = val / grandTotal;
      const strokeLength = percentage * circumference;
      const strokeOffset = currentOffset;
      currentOffset -= strokeLength;

      return {
        key,
        value: val,
        percentage: (percentage * 100).toFixed(0),
        color: CATEGORIES[key]?.color || CATEGORIES.Others.color,
        icon: CATEGORIES[key]?.icon || CATEGORIES.Others.icon,
        name: CATEGORIES[key]?.name || CATEGORIES.Others.name,
        strokeLength,
        strokeOffset
      };
    });

  return (
    <div className="analytics-section">
      <div className="chart-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {chartSegments.map((seg) => {
            const isChosen = selectedCategory === seg.key;
            return (
              <circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isChosen ? "26" : "20"} // Highlight selected slice
                strokeDasharray={`${seg.strokeLength} ${circumference}`}
                strokeDashoffset={seg.strokeOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ 
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  opacity: selectedCategory && !isChosen ? 0.4 : 1
                }}
                onClick={() => onSelectCategory(isChosen ? 'All' : seg.key)}
              />
            );
          })}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - 12}
            fill="var(--bg-secondary)"
          />
          <text
            x="50%"
            y="48%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize="11"
          >
            Total spent
          </text>
          <text
            x="50%"
            y="62%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize="15"
            fontWeight="bold"
          >
            {currencySymbol}{grandTotal.toFixed(2)}
          </text>
        </svg>
      </div>

      <div className="legend-container">
        {chartSegments.map((seg) => (
          <div 
            key={seg.key} 
            className="legend-item"
            style={{ 
              cursor: 'pointer', 
              opacity: selectedCategory && selectedCategory !== seg.key ? 0.4 : 1,
              fontWeight: selectedCategory === seg.key ? 'bold' : 'normal'
            }}
            onClick={() => onSelectCategory(selectedCategory === seg.key ? 'All' : seg.key)}
          >
            <span className="legend-color" style={{ backgroundColor: seg.color }}></span>
            <span style={{ fontSize: '12px' }}>
              {seg.icon} {seg.name} ({seg.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
