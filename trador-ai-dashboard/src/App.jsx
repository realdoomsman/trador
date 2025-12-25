import { useState, useEffect } from 'react';

const API = '/api';

function App() {
  const [status, setStatus] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statusRes, positionsRes, tradesRes] = await Promise.all([
        fetch(`${API}/status`).then(r => r.json()),
        fetch(`${API}/positions`).then(r => r.json()),
        fetch(`${API}/trades`).then(r => r.json())
      ]);
      setStatus(statusRes);
      setPositions(positionsRes);
      setTrades(tradesRes);
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const setRiskProfile = async (profile) => {
    await fetch(`${API}/risk-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile })
    });
    fetchData();
  };

  const toggleBot = async () => {
    const endpoint = status?.running ? '/api/stop' : '/api/start';
    await fetch(endpoint, { method: 'POST' });
    fetchData();
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading TRADOR AI...</div>
      </div>
    );
  }

  const confidenceColor = status?.confidence >= 85 ? '#00ff88' : 
                          status?.confidence >= 60 ? '#ffcc00' : '#ff4444';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>TRADOR AI</h1>
        <div style={styles.headerRight}>
          <span style={{ color: status?.running ? '#00ff88' : '#ff4444' }}>
            {status?.running ? 'RUNNING' : 'STOPPED'}
          </span>
          <button onClick={toggleBot} style={styles.toggleBtn}>
            {status?.running ? 'Stop' : 'Start'}
          </button>
        </div>
      </header>

      <div style={styles.grid}>
        {/* Confidence Meter */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>AI Confidence</h2>
          <div style={styles.confidenceContainer}>
            <div style={styles.confidenceRing}>
              <svg viewBox="0 0 100 100" style={{ width: 160, height: 160 }}>
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a2e" strokeWidth="8" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" 
                  stroke={confidenceColor} strokeWidth="8"
                  strokeDasharray={`${(status?.confidence || 0) * 2.83} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div style={styles.confidenceValue}>
                <span style={{ fontSize: 36, color: confidenceColor }}>{status?.confidence || 0}</span>
                <span style={{ fontSize: 16, color: '#888' }}>%</span>
              </div>
            </div>
          </div>
          <div style={styles.confidenceStatus}>
            {status?.canLiveTrade ? 'Ready for Live Trading' :
             status?.canVirtualTrade ? 'Virtual Trading Active' : 'Learning Mode'}
          </div>
        </div>

        {/* Learning Data */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Learning Data</h2>
          <div style={{
            ...styles.dataSourceBadge,
            background: status?.isRealData ? '#00aa55' : '#cc3333'
          }}>
            {status?.isRealData ? 'REAL DATA' : 'SYNTHETIC DATA'} 
            {status?.dataSource && ` (${status.dataSource})`}
          </div>
          <div style={styles.dataStats}>
            <div style={styles.dataStat}>
              <div style={styles.dataValue}>{status?.dataSize || '0 MB'}</div>
              <div style={styles.dataLabel}>Data Size</div>
            </div>
            <div style={styles.dataStat}>
              <div style={styles.dataValue}>{(status?.dataPoints || 0).toLocaleString()}</div>
              <div style={styles.dataLabel}>Data Points</div>
            </div>
          </div>
          <div style={styles.progressBar}>
            <div style={{ 
              ...styles.progressFill, 
              width: `${Math.min(100, (status?.dataPoints || 0) / 50)}%`,
              background: status?.canVirtualTrade ? '#00ff88' : '#ffcc00'
            }} />
          </div>
          <div style={styles.progressLabel}>
            {status?.canVirtualTrade ? 'Sufficient data for trading' : 
             `${5000 - (status?.dataPoints || 0)} more points needed`}
          </div>
        </div>

        {/* PnL Stats */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Virtual Trading PnL</h2>
          <div style={styles.pnlGrid}>
            <div style={styles.pnlItem}>
              <div style={styles.pnlLabel}>Daily</div>
              <div style={{ ...styles.pnlValue, color: (status?.pnl?.daily || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                {(status?.pnl?.daily || 0) >= 0 ? '+' : ''}{(status?.pnl?.daily || 0).toFixed(2)}%
              </div>
            </div>
            <div style={styles.pnlItem}>
              <div style={styles.pnlLabel}>Weekly</div>
              <div style={{ ...styles.pnlValue, color: (status?.pnl?.weekly || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                {(status?.pnl?.weekly || 0) >= 0 ? '+' : ''}{(status?.pnl?.weekly || 0).toFixed(2)}%
              </div>
            </div>
            <div style={styles.pnlItem}>
              <div style={styles.pnlLabel}>Monthly</div>
              <div style={{ ...styles.pnlValue, color: (status?.pnl?.monthly || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                {(status?.pnl?.monthly || 0) >= 0 ? '+' : ''}{(status?.pnl?.monthly || 0).toFixed(2)}%
              </div>
            </div>
            <div style={styles.pnlItem}>
              <div style={styles.pnlLabel}>All Time</div>
              <div style={{ ...styles.pnlValue, color: (status?.pnl?.allTime || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                {(status?.pnl?.allTime || 0) >= 0 ? '+' : ''}{(status?.pnl?.allTime || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Trading Stats */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Learning Stats</h2>
          <div style={styles.statsGrid}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{status?.trackedTokens || 0}</div>
              <div style={styles.statLabel}>Tracking</div>
            </div>
            <div style={styles.statItem}>
              <div style={{ ...styles.statValue, color: '#00ff88' }}>{status?.stats?.pumps || 0}</div>
              <div style={styles.statLabel}>Pumps</div>
            </div>
            <div style={styles.statItem}>
              <div style={{ ...styles.statValue, color: '#ff4444' }}>{status?.stats?.dumps || 0}</div>
              <div style={styles.statLabel}>Dumps</div>
            </div>
            <div style={styles.statItem}>
              <div style={{ 
                ...styles.statValue, 
                color: (status?.aiAccuracy || 0) >= 60 ? '#00ff88' : (status?.aiAccuracy || 0) >= 50 ? '#ffcc00' : '#ff4444' 
              }}>
                {(status?.aiAccuracy || 0).toFixed(1)}%
              </div>
              <div style={styles.statLabel}>AI Accuracy</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#888', textAlign: 'center' }}>
            {status?.aiPredictions || 0} predictions | {status?.aiRecommendation || 'Learning...'}
          </div>
          {status?.topSignals?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#666', textAlign: 'center' }}>
              Top signals: {status.topSignals.slice(0, 3).join(', ')}
            </div>
          )}
        </div>

        {/* Alpha Engine */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Alpha Engine</h2>
          <div style={{
            ...styles.regimeBadge,
            background: status?.marketRegime === 'bull' ? '#00aa55' : 
                       status?.marketRegime === 'bear' ? '#cc3333' : 
                       status?.marketRegime === 'volatile' ? '#cc8800' : '#555'
          }}>
            {(status?.marketRegime || 'neutral').toUpperCase()} MARKET
          </div>
          <div style={styles.alphaGrid}>
            <div style={styles.alphaItem}>
              <div style={styles.alphaValue}>{status?.portfolioHeat?.heat?.toFixed(0) || 0}%</div>
              <div style={styles.alphaLabel}>Portfolio Heat</div>
            </div>
            <div style={styles.alphaItem}>
              <div style={styles.alphaValue}>{status?.smartMoneyTracked || 0}</div>
              <div style={styles.alphaLabel}>Smart Wallets</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#888', textAlign: 'center' }}>
            {status?.regimeRecommendation?.message || 'Analyzing market...'}
          </div>
          <div style={{ 
            marginTop: 8, 
            fontSize: 10, 
            color: status?.isOptimalTime ? '#00ff88' : '#ff8800',
            textAlign: 'center'
          }}>
            {status?.isOptimalTime ? '✓ Optimal trading time' : '⚠ Suboptimal trading time'}
          </div>
        </div>

        {/* Wallet Intelligence */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Wallet Intelligence</h2>
          <div style={styles.walletGrid}>
            <div style={styles.walletItem}>
              <div style={styles.walletValue}>{status?.knownWallets || 0}</div>
              <div style={styles.walletLabel}>Known Wallets</div>
            </div>
            <div style={styles.walletItem}>
              <div style={styles.walletValue}>{status?.trackedClusters || 0}</div>
              <div style={styles.walletLabel}>Clusters</div>
            </div>
            <div style={styles.walletItem}>
              <div style={{ ...styles.walletValue, color: '#ff4444' }}>{status?.ruggerWallets || 0}</div>
              <div style={styles.walletLabel}>Ruggers</div>
            </div>
            <div style={styles.walletItem}>
              <div style={{ ...styles.walletValue, color: '#00ff88' }}>{status?.profitableWalletsTracked || 0}</div>
              <div style={styles.walletLabel}>Profitable</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
            Tracking dev wallets, snipers, whales, insiders
          </div>
        </div>

        {/* Multi-AI Engine */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Multi-AI Engine</h2>
          <div style={styles.aiGrid}>
            <div style={styles.aiItem}>
              <div style={{ ...styles.aiValue, color: status?.aiModelsCount > 0 ? '#00ff88' : '#666' }}>
                {status?.aiModelsCount || 0}
              </div>
              <div style={styles.aiLabel}>AI Models</div>
            </div>
            <div style={styles.aiItem}>
              <div style={styles.aiValue}>
                {status?.availableAIs?.length > 0 ? status.availableAIs.join(', ') : 'None'}
              </div>
              <div style={styles.aiLabel}>Available</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
            {status?.aiModelsCount > 1 ? 'Multi-AI consensus active' : 'Add API keys for more AIs'}
          </div>
          <div style={{ marginTop: 6, fontSize: 9, color: '#555', textAlign: 'center' }}>
            Supports: Gemini, OpenAI, Claude, Groq, Perplexity
          </div>
        </div>
      </div>

      {/* Virtual Trading Stats */}
      <div style={styles.card2}>
        <h2 style={styles.cardTitle}>Virtual Trading</h2>
        <div style={styles.statsRow}>
          <div style={styles.statItem2}>
            <div style={styles.statValue}>{status?.stats?.totalVirtualTrades || 0}</div>
            <div style={styles.statLabel}>Trades</div>
          </div>
          <div style={styles.statItem2}>
            <div style={{ ...styles.statValue, color: '#00ff88' }}>{status?.stats?.virtualWins || 0}</div>
            <div style={styles.statLabel}>Wins</div>
          </div>
          <div style={styles.statItem2}>
            <div style={{ ...styles.statValue, color: '#ff4444' }}>{status?.stats?.virtualLosses || 0}</div>
            <div style={styles.statLabel}>Losses</div>
          </div>
          <div style={styles.statItem2}>
            <div style={styles.statValue}>
              {status?.stats?.totalVirtualTrades > 0 
                ? ((status?.stats?.virtualWins / status?.stats?.totalVirtualTrades) * 100).toFixed(0) 
                : 0}%
            </div>
            <div style={styles.statLabel}>Win Rate</div>
          </div>
        </div>
      </div>

      {/* Risk Profile Selector */}
      <div style={styles.riskSection}>
        <h2 style={styles.sectionTitle}>Risk Profile</h2>
        <div style={styles.riskButtons}>
          {['low', 'medium', 'high'].map(profile => (
            <button
              key={profile}
              onClick={() => setRiskProfile(profile)}
              style={{
                ...styles.riskBtn,
                background: status?.riskProfile === profile ? 
                  (profile === 'low' ? '#00aa55' : profile === 'medium' ? '#cc8800' : '#cc3333') : '#1a1a2e',
                borderColor: profile === 'low' ? '#00aa55' : profile === 'medium' ? '#cc8800' : '#cc3333'
              }}
            >
              <div style={styles.riskBtnTitle}>{profile.toUpperCase()}</div>
              <div style={styles.riskBtnDesc}>
                {profile === 'low' && '2% position, 5% SL, 10% TP'}
                {profile === 'medium' && '5% position, 10% SL, 25% TP'}
                {profile === 'high' && '10% position, 20% SL, 50% TP'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Positions */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Active Positions ({positions.length})</h2>
        {positions.length === 0 ? (
          <div style={styles.empty}>No active positions</div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span>Token</span>
              <span>Entry</span>
              <span>Current</span>
              <span>PnL</span>
              <span>Time</span>
            </div>
            {positions.map(p => {
              const pnl = ((p.currentPrice - p.entryPrice) / p.entryPrice * 100) || 0;
              const mins = Math.floor((Date.now() - p.entryTime) / 60000);
              return (
                <div key={p.id} style={styles.tableRow}>
                  <span>
                    <a href={`https://pump.fun/${p.mint}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
                      {p.symbol}
                    </a>
                  </span>
                  <span>${p.entryPrice?.toFixed(8)}</span>
                  <span>${p.currentPrice?.toFixed(8) || '-'}</span>
                  <span style={{ color: pnl >= 0 ? '#00ff88' : '#ff4444' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                  </span>
                  <span>{mins}m</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Trades */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Recent Virtual Trades</h2>
        {trades.length === 0 ? (
          <div style={styles.empty}>No trades yet</div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span>Token</span>
              <span>Entry</span>
              <span>Exit</span>
              <span>PnL</span>
              <span>Reason</span>
            </div>
            {trades.slice(0, 20).map(t => (
              <div key={t.id} style={styles.tableRow}>
                <span>
                  <a href={`https://pump.fun/${t.mint}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {t.symbol}
                  </a>
                </span>
                <span>${t.entryPrice?.toFixed(8)}</span>
                <span>${t.exitPrice?.toFixed(8)}</span>
                <span style={{ color: t.pnlPercent >= 0 ? '#00ff88' : '#ff4444' }}>
                  {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent?.toFixed(2)}%
                </span>
                <span style={styles.reason}>{t.exitReason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: 1200, margin: '0 auto', padding: 20 },
  loading: { textAlign: 'center', padding: 100, fontSize: 18, color: '#888' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingBottom: 20, borderBottom: '1px solid #1a1a2e' },
  title: { fontSize: 28, fontWeight: 700, background: 'linear-gradient(90deg, #00ff88, #00ccff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  toggleBtn: { padding: '8px 20px', background: '#1a1a2e', border: '1px solid #333', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 30 },
  card: { background: '#12121a', borderRadius: 12, padding: 24, border: '1px solid #1a1a2e' },
  cardTitle: { fontSize: 14, color: '#888', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 },
  confidenceContainer: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  confidenceRing: { position: 'relative' },
  confidenceValue: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' },
  confidenceStatus: { textAlign: 'center', fontSize: 13, color: '#888' },
  dataStats: { display: 'flex', justifyContent: 'space-around', marginBottom: 20 },
  dataStat: { textAlign: 'center' },
  dataValue: { fontSize: 24, fontWeight: 700, color: '#00ccff' },
  dataLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  dataSourceBadge: { textAlign: 'center', padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 16, color: '#fff' },
  progressBar: { height: 8, background: '#1a1a2e', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  progressLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  pnlGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  pnlItem: { textAlign: 'center', padding: 12, background: '#1a1a2e', borderRadius: 8 },
  pnlLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  pnlValue: { fontSize: 20, fontWeight: 700 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  statItem: { textAlign: 'center', padding: 12, background: '#1a1a2e', borderRadius: 8 },
  statValue: { fontSize: 24, fontWeight: 700 },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  card2: { background: '#12121a', borderRadius: 12, padding: 20, border: '1px solid #1a1a2e', marginBottom: 30 },
  statsRow: { display: 'flex', justifyContent: 'space-around' },
  statItem2: { textAlign: 'center' },
  riskSection: { marginBottom: 30 },
  sectionTitle: { fontSize: 16, marginBottom: 16, color: '#fff' },
  riskButtons: { display: 'flex', gap: 12 },
  riskBtn: { flex: 1, padding: 16, border: '2px solid', borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' },
  riskBtnTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 },
  riskBtnDesc: { fontSize: 11, color: '#888' },
  section: { marginBottom: 30 },
  empty: { padding: 40, textAlign: 'center', color: '#666', background: '#12121a', borderRadius: 8 },
  table: { background: '#12121a', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 16px', background: '#1a1a2e', fontSize: 12, color: '#888', textTransform: 'uppercase' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: '1px solid #1a1a2e', fontSize: 13 },
  link: { color: '#00ccff', textDecoration: 'none' },
  reason: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  // Alpha engine styles
  regimeBadge: { textAlign: 'center', padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 16, color: '#fff' },
  alphaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  alphaItem: { textAlign: 'center', padding: 12, background: '#1a1a2e', borderRadius: 8 },
  alphaValue: { fontSize: 20, fontWeight: 700, color: '#00ccff' },
  alphaLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  // Wallet intelligence styles
  walletGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  walletItem: { textAlign: 'center', padding: 10, background: '#1a1a2e', borderRadius: 6 },
  walletValue: { fontSize: 18, fontWeight: 700, color: '#00ccff' },
  walletLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  // Multi-AI styles
  aiGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 },
  aiItem: { textAlign: 'center', padding: 10, background: '#1a1a2e', borderRadius: 6 },
  aiValue: { fontSize: 14, fontWeight: 700, color: '#00ccff' },
  aiLabel: { fontSize: 10, color: '#666', marginTop: 2 }
};

export default App;
