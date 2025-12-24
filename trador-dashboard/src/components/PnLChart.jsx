import React from 'react';

export function PnLChart({ trades }) {
  if (!trades || trades.length === 0) return null;
  
  // Calculate cumulative PnL
  let cumulative = 0;
  const data = trades.slice().reverse().map(t => {
    cumulative += t.pnlSol || 0;
    return { pnl: cumulative, time: t.exitTime };
  });
  
  if (data.length < 2) return null;
  
  const maxPnl = Math.max(...data.map(d => d.pnl), 0);
  const minPnl = Math.min(...data.map(d => d.pnl), 0);
  const range = maxPnl - minPnl || 1;
  
  const width = 100;
  const height = 60;
  const padding = 2;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.pnl - minPnl) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  
  const zeroY = height - padding - ((0 - minPnl) / range) * (height - padding * 2);
  const isPositive = cumulative >= 0;
  
  return (
    <div className="pnl-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Zero line */}
        <line 
          x1={padding} 
          y1={zeroY} 
          x2={width - padding} 
          y2={zeroY} 
          stroke="var(--border-light)" 
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
        
        {/* Area fill */}
        <polygon
          points={`${padding},${zeroY} ${points} ${width - padding},${zeroY}`}
          fill={isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? 'var(--green)' : 'var(--red)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
