import React from 'react';

export function BuybacksPage({ buybacks, stats, formatTime }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-title-section">
          <h1>Buyback History</h1>
          <p>All profits are used to buy back TRADOR</p>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Buybacks</span>
            <div className="stat-icon yellow">🔥</div>
          </div>
          <div className="stat-value">{stats.totalBuybacks}</div>
          <div className="stat-change">executions</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">SOL Spent</span>
            <div className="stat-icon green">💰</div>
          </div>
          <div className="stat-value green">{stats.totalBuybackSol?.toFixed(4)}</div>
          <div className="stat-change">total SOL → TRADOR</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Avg Buyback</span>
            <div className="stat-icon blue">📊</div>
          </div>
          <div className="stat-value">
            {stats.totalBuybacks > 0 
              ? (stats.totalBuybackSol / stats.totalBuybacks).toFixed(4) 
              : '0.0000'}
          </div>
          <div className="stat-change">SOL per buyback</div>
        </div>
      </div>

      {/* How it works */}
      <div className="trades-card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">How Buybacks Work</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>1. Bot Profits</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                When a trade closes in profit, the gains are tracked
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>2. Threshold Hit</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Once profit exceeds 0.1 SOL, buyback triggers
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔥</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>3. Auto Buyback</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                100% of profit buys TRADOR, never sold
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buyback List */}
      <div className="trades-card">
        <div className="card-header">
          <span className="card-title">Buyback Log</span>
          <span className="card-badge">{buybacks.length} entries</span>
        </div>
        {buybacks.length > 0 ? (
          <table className="trades-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Profit Source</th>
                <th>Time</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {buybacks.map((bb, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ 
                        width: 36, 
                        height: 36, 
                        borderRadius: 8, 
                        background: 'var(--green-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>🔥</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--green)' }}>
                          +{bb.solSpent?.toFixed(4)} SOL
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          → TRADOR
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{bb.profit?.toFixed(4) || bb.solSpent?.toFixed(4)} SOL profit</td>
                  <td>{formatTime(bb.timestamp)}</td>
                  <td>
                    {bb.sig ? (
                      <a 
                        href={`https://solscan.io/tx/${bb.sig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--blue)', textDecoration: 'none' }}
                      >
                        {bb.sig.slice(0, 8)}... →
                      </a>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-table">
            <div style={{ marginBottom: 8 }}>No buybacks yet</div>
            <div style={{ fontSize: 13 }}>Buybacks trigger when trading profits exceed 0.1 SOL</div>
          </div>
        )}
      </div>
    </div>
  );
}
