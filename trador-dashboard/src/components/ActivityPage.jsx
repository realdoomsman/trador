import React from 'react';

export function ActivityPage({ trades, formatTime }) {
  const formatReason = (reason) => {
    const map = {
      'TP': 'Take Profit',
      'SL': 'Stop Loss',
      'TRAIL': 'Trailing Stop',
      'TIMEOUT': 'Timeout',
      'TAKE PROFIT 🎯': 'Take Profit',
      'STOP LOSS 💀': 'Stop Loss',
      'TRAILING STOP': 'Trailing Stop',
      'TIMEOUT ⏰': 'Timeout'
    };
    return map[reason] || reason;
  };

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnlSol || 0), 0);
  const wins = trades.filter(t => t.pnlSol > 0).length;
  const losses = trades.filter(t => t.pnlSol <= 0).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-section">
          <h1>Trade History</h1>
          <p>Complete log of all executed trades</p>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Trades</span>
          </div>
          <div className="stat-value">{trades.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Wins / Losses</span>
          </div>
          <div className="stat-value">
            <span style={{ color: 'var(--green)' }}>{wins}</span>
            {' / '}
            <span style={{ color: 'var(--red)' }}>{losses}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Net P&L</span>
          </div>
          <div className={`stat-value ${totalPnl >= 0 ? 'green' : 'red'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(4)} SOL
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Win Rate</span>
          </div>
          <div className="stat-value">
            {trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* Full Table */}
      <div className="trades-card">
        <div className="card-header">
          <span className="card-title">All Trades</span>
          <span className="card-badge">{trades.length} entries</span>
        </div>
        {trades.length > 0 ? (
          <table className="trades-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Entry</th>
                <th>P&L</th>
                <th>Exit Reason</th>
                <th>Hold Time</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, i) => (
                <tr key={i}>
                  <td>
                    <div className="trade-token">
                      <div className="trade-token-icon">🪙</div>
                      <div>
                        <div className="trade-token-name">{trade.symbol}</div>
                        <div className="trade-token-tier">Tier {trade.tier}</div>
                      </div>
                    </div>
                  </td>
                  <td>{trade.solIn?.toFixed(4)} SOL</td>
                  <td>
                    <div className={`trade-pnl ${trade.pnlSol >= 0 ? 'positive' : 'negative'}`}>
                      {trade.pnlSol >= 0 ? '+' : ''}{trade.pnlSol?.toFixed(4)} SOL
                      <div className="trade-pnl-percent">
                        ({(trade.pnlPercent * 100).toFixed(1)}%)
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="trade-reason">{formatReason(trade.reason)}</span>
                  </td>
                  <td>{Math.floor((trade.holdTimeMs || 0) / 60000)}m</td>
                  <td>
                    <span className="trade-time">{formatTime(trade.exitTime)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-table">No trades recorded yet</div>
        )}
      </div>
    </div>
  );
}
