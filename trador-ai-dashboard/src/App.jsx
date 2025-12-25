import { useState, useEffect } from 'react';

const API = '/api';

function App() {
  const [status, setStatus] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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
      <div style={styles.loadingContainer}>
        <div style={styles.loadingLogo}>TRADOR</div>
        <div style={styles.loadingText}>Initializing AI Systems...</div>
        <div style={styles.loadingBar}><div style={styles.loadingFill} /></div>
      </div>
    );
  }

  const confidenceColor = status?.confidence >= 85 ? '#00ff88' : 
                          status?.confidence >= 60 ? '#ffcc00' : '#ff4444';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'ai', label: 'AI Systems', icon: '🧠' },
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'trades', label: 'Trades', icon: '💹' },
    { id: 'docs', label: 'Whitepaper', icon: '📄' }
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>TRADOR</h1>
          <span style={styles.tagline}>AI-Powered Solana Trading</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statusBadge}>
            <span style={{ 
              width: 8, height: 8, borderRadius: '50%', 
              background: status?.running ? '#00ff88' : '#ff4444',
              animation: status?.running ? 'pulse 2s infinite' : 'none'
            }} />
            <span>{status?.running ? 'LIVE' : 'STOPPED'}</span>
          </div>
          <button onClick={toggleBot} style={{
            ...styles.btn,
            background: status?.running ? '#ff4444' : '#00ff88',
            color: '#000'
          }}>
            {status?.running ? 'Stop' : 'Start'}
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav style={styles.nav}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.navBtn,
              background: activeTab === tab.id ? '#1a1a2e' : 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #00ff88' : '2px solid transparent'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={styles.main}>
        {activeTab === 'overview' && (
          <OverviewTab status={status} positions={positions} trades={trades} 
                       setRiskProfile={setRiskProfile} confidenceColor={confidenceColor} />
        )}
        {activeTab === 'ai' && <AITab status={status} />}
        {activeTab === 'security' && <SecurityTab status={status} />}
        {activeTab === 'trades' && <TradesTab positions={positions} trades={trades} />}
        {activeTab === 'docs' && <DocsTab />}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>Data: {status?.isRealData ? '🟢 Real' : '🔴 Synthetic'} ({status?.dataSource})</span>
        <span>•</span>
        <span>{status?.dataPoints?.toLocaleString()} data points</span>
        <span>•</span>
        <span>Market: {(status?.marketRegime || 'neutral').toUpperCase()}</span>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ status, positions, trades, setRiskProfile, confidenceColor }) {
  return (
    <div style={styles.tabContent}>
      {/* Top Stats Row */}
      <div style={styles.statsRow}>
        <StatCard 
          title="AI Confidence" 
          value={`${status?.confidence || 0}%`}
          color={confidenceColor}
          subtitle={status?.canLiveTrade ? 'Ready for Live' : status?.canVirtualTrade ? 'Virtual Trading' : 'Learning'}
        />
        <StatCard 
          title="Data Points" 
          value={(status?.dataPoints || 0).toLocaleString()}
          color="#00ccff"
          subtitle={status?.dataSize || '0 MB'}
        />
        <StatCard 
          title="AI Accuracy" 
          value={`${(status?.aiAccuracy || 0).toFixed(1)}%`}
          color={status?.aiAccuracy >= 60 ? '#00ff88' : '#ffcc00'}
          subtitle={`${status?.aiPredictions || 0} predictions`}
        />
        <StatCard 
          title="Market Regime" 
          value={(status?.marketRegime || 'neutral').toUpperCase()}
          color={status?.marketRegime === 'bull' ? '#00ff88' : status?.marketRegime === 'bear' ? '#ff4444' : '#ffcc00'}
          subtitle={status?.isOptimalTime ? '✓ Optimal time' : '⚠ Suboptimal'}
        />
      </div>

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* Confidence Ring */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>System Status</h3>
          <div style={styles.ringContainer}>
            <svg viewBox="0 0 100 100" style={{ width: 180, height: 180 }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a2e" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke={confidenceColor} strokeWidth="8"
                strokeDasharray={`${(status?.confidence || 0) * 2.83} 283`}
                strokeLinecap="round" transform="rotate(-90 50 50)" />
            </svg>
            <div style={styles.ringValue}>
              <span style={{ fontSize: 42, fontWeight: 700, color: confidenceColor }}>{status?.confidence || 0}</span>
              <span style={{ fontSize: 14, color: '#888' }}>% confidence</span>
            </div>
          </div>
          <div style={styles.statusList}>
            <StatusItem label="Learning" active={status?.isLearning} />
            <StatusItem label="Virtual Trading" active={status?.canVirtualTrade} />
            <StatusItem label="Live Ready" active={status?.canLiveTrade} />
          </div>
        </div>

        {/* PnL Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Virtual PnL</h3>
          <div style={styles.pnlGrid}>
            <PnLItem label="Daily" value={status?.pnl?.daily} />
            <PnLItem label="Weekly" value={status?.pnl?.weekly} />
            <PnLItem label="Monthly" value={status?.pnl?.monthly} />
            <PnLItem label="All Time" value={status?.pnl?.allTime} />
          </div>
          <div style={styles.tradeStats}>
            <div><span style={{ color: '#00ff88' }}>{status?.stats?.virtualWins || 0}</span> wins</div>
            <div><span style={{ color: '#ff4444' }}>{status?.stats?.virtualLosses || 0}</span> losses</div>
            <div>
              <span style={{ color: '#00ccff' }}>
                {status?.stats?.totalVirtualTrades > 0 
                  ? ((status?.stats?.virtualWins / status?.stats?.totalVirtualTrades) * 100).toFixed(0) 
                  : 0}%
              </span> win rate
            </div>
          </div>
        </div>

        {/* Learning Stats */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Learning Progress</h3>
          <div style={styles.learningGrid}>
            <div style={styles.learningItem}>
              <div style={styles.learningValue}>{status?.trackedTokens || 0}</div>
              <div style={styles.learningLabel}>Tracking</div>
            </div>
            <div style={styles.learningItem}>
              <div style={{ ...styles.learningValue, color: '#00ff88' }}>{status?.stats?.pumps || 0}</div>
              <div style={styles.learningLabel}>Pumps</div>
            </div>
            <div style={styles.learningItem}>
              <div style={{ ...styles.learningValue, color: '#ff4444' }}>{status?.stats?.dumps || 0}</div>
              <div style={styles.learningLabel}>Dumps</div>
            </div>
            <div style={styles.learningItem}>
              <div style={styles.learningValue}>{status?.stats?.neutral || 0}</div>
              <div style={styles.learningLabel}>Neutral</div>
            </div>
          </div>
          {status?.topSignals?.length > 0 && (
            <div style={styles.topSignals}>
              <span style={{ color: '#888' }}>Top signals:</span> {status.topSignals.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Risk Profile */}
      <div style={styles.riskSection}>
        <h3 style={styles.sectionTitle}>Risk Profile</h3>
        <div style={styles.riskBtns}>
          {[
            { id: 'low', label: 'Conservative', desc: '2% position • 5% SL • 10% TP', color: '#00aa55' },
            { id: 'medium', label: 'Balanced', desc: '5% position • 10% SL • 25% TP', color: '#cc8800' },
            { id: 'high', label: 'Aggressive', desc: '10% position • 20% SL • 50% TP', color: '#cc3333' }
          ].map(p => (
            <button key={p.id} onClick={() => setRiskProfile(p.id)} style={{
              ...styles.riskBtn,
              background: status?.riskProfile === p.id ? p.color : '#1a1a2e',
              borderColor: p.color
            }}>
              <div style={styles.riskBtnLabel}>{p.label}</div>
              <div style={styles.riskBtnDesc}>{p.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// AI Systems Tab
function AITab({ status }) {
  return (
    <div style={styles.tabContent}>
      <div style={styles.grid}>
        {/* Multi-AI Engine */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🤖 Multi-AI Consensus</h3>
          <div style={styles.aiCount}>
            <span style={{ fontSize: 48, fontWeight: 700, color: '#00ccff' }}>{status?.aiModelsCount || 0}</span>
            <span style={{ color: '#888' }}>AI Models Active</span>
          </div>
          <div style={styles.aiList}>
            {['gemini', 'openai', 'claude', 'groq', 'perplexity'].map(ai => (
              <div key={ai} style={{
                ...styles.aiItem,
                opacity: status?.availableAIs?.includes(ai) ? 1 : 0.3
              }}>
                <span style={{ 
                  width: 8, height: 8, borderRadius: '50%',
                  background: status?.availableAIs?.includes(ai) ? '#00ff88' : '#444'
                }} />
                <span style={{ textTransform: 'capitalize' }}>{ai}</span>
              </div>
            ))}
          </div>
          <div style={styles.aiDesc}>
            Multiple AI models analyze each token in parallel. Consensus voting determines final signal.
            Agreement threshold: 60%+
          </div>
        </div>

        {/* Self-Learning AI */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🧠 Self-Learning AI</h3>
          <div style={styles.learnerStats}>
            <div style={styles.learnerStat}>
              <div style={{ fontSize: 32, fontWeight: 700, color: status?.aiAccuracy >= 60 ? '#00ff88' : '#ffcc00' }}>
                {(status?.aiAccuracy || 0).toFixed(1)}%
              </div>
              <div style={{ color: '#888' }}>Accuracy</div>
            </div>
            <div style={styles.learnerStat}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#00ccff' }}>
                {status?.aiPredictions || 0}
              </div>
              <div style={{ color: '#888' }}>Predictions</div>
            </div>
          </div>
          <div style={styles.aiDesc}>
            AI learns from every token outcome. Tracks 60+ signals per token.
            Auto-optimizes every 50 outcomes.
          </div>
          <div style={styles.recommendation}>
            {status?.aiRecommendation || 'Learning...'}
          </div>
        </div>

        {/* Alpha Engine */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📈 Alpha Engine</h3>
          <div style={{
            ...styles.regimeBadge,
            background: status?.marketRegime === 'bull' ? '#00aa55' : 
                       status?.marketRegime === 'bear' ? '#cc3333' : 
                       status?.marketRegime === 'volatile' ? '#cc8800' : '#555'
          }}>
            {(status?.marketRegime || 'neutral').toUpperCase()} MARKET
          </div>
          <div style={styles.alphaStats}>
            <div style={styles.alphaStat}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{status?.portfolioHeat?.heat?.toFixed(0) || 0}%</div>
              <div style={{ color: '#888', fontSize: 11 }}>Portfolio Heat</div>
            </div>
            <div style={styles.alphaStat}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{status?.smartMoneyTracked || 0}</div>
              <div style={{ color: '#888', fontSize: 11 }}>Smart Wallets</div>
            </div>
          </div>
          <div style={styles.aiDesc}>
            {status?.regimeRecommendation?.message || 'Analyzing market conditions...'}
          </div>
          <div style={{ 
            marginTop: 12, padding: '8px 12px', borderRadius: 6,
            background: status?.isOptimalTime ? 'rgba(0,255,136,0.1)' : 'rgba(255,136,0,0.1)',
            color: status?.isOptimalTime ? '#00ff88' : '#ff8800',
            fontSize: 12, textAlign: 'center'
          }}>
            {status?.isOptimalTime ? '✓ Optimal trading window' : '⚠ Suboptimal trading time'}
          </div>
        </div>

        {/* Social Intelligence */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📱 Social Intelligence</h3>
          <div style={styles.socialStats}>
            <div style={styles.socialStat}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#ff00ff' }}>{status?.viralTokens || 0}</div>
              <div style={{ color: '#888' }}>Viral Tokens</div>
            </div>
          </div>
          <div style={styles.narratives}>
            <span style={{ color: '#888' }}>Hot Narratives:</span>
            <div style={styles.narrativeTags}>
              {(status?.hotNarratives || ['None']).map((n, i) => (
                <span key={i} style={styles.narrativeTag}>{n}</span>
              ))}
            </div>
          </div>
          <div style={styles.aiDesc}>
            Tracks: AI, Animal, Meme, Political, Celebrity narratives.
            Detects viral potential, hype cycles, pump & dump patterns.
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Tab
function SecurityTab({ status }) {
  return (
    <div style={styles.tabContent}>
      <div style={styles.grid}>
        {/* Wallet Intelligence */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>👛 Wallet Intelligence</h3>
          <div style={styles.walletStats}>
            <WalletStat label="Known Wallets" value={status?.knownWallets || 0} color="#00ccff" />
            <WalletStat label="Clusters" value={status?.trackedClusters || 0} color="#00ccff" />
            <WalletStat label="Ruggers" value={status?.ruggerWallets || 0} color="#ff4444" />
            <WalletStat label="Profitable" value={status?.profitableWalletsTracked || 0} color="#00ff88" />
          </div>
          <div style={styles.walletFeatures}>
            <FeatureItem icon="🔍" text="Dev wallet detection" />
            <FeatureItem icon="🤖" text="Sniper bot identification" />
            <FeatureItem icon="🐋" text="Whale tracking" />
            <FeatureItem icon="🕵️" text="Insider detection" />
            <FeatureItem icon="🗺️" text="Cluster/bubble map analysis" />
          </div>
        </div>

        {/* Security Scanning */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🛡️ Security Scanning</h3>
          <div style={styles.securityFeatures}>
            <SecurityFeature label="RugCheck.xyz" desc="Automated rug detection" active />
            <SecurityFeature label="GoPlus Security" desc="Token security scanning" active />
            <SecurityFeature label="Mint Authority" desc="Can create more tokens" />
            <SecurityFeature label="Freeze Authority" desc="Can freeze transfers" />
            <SecurityFeature label="LP Lock Status" desc="Liquidity protection" />
            <SecurityFeature label="Honeypot Check" desc="Sell restrictions" />
          </div>
        </div>

        {/* Risk Assessment */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚠️ Risk Assessment</h3>
          <div style={styles.riskMatrix}>
            <RiskItem type="Dev Wallet" risk="High" action="Flag + reduce score" />
            <RiskItem type="Sniper Bot" risk="Medium" action="Track + caution" />
            <RiskItem type="Whale" risk="Variable" action="Track behavior" />
            <RiskItem type="Insider" risk="High" action="Flag + avoid" />
            <RiskItem type="Rugger" risk="Critical" action="Blacklist" />
            <RiskItem type="Profitable" risk="Low" action="Follow signals" />
          </div>
        </div>

        {/* Automated Checks */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>✅ Automated Checks</h3>
          <div style={styles.checkList}>
            <CheckItem text="Holder distribution analysis" />
            <CheckItem text="Top holder concentration" />
            <CheckItem text="Whale percentage tracking" />
            <CheckItem text="Creator holdings check" />
            <CheckItem text="Buy/sell tax detection" />
            <CheckItem text="Hidden owner detection" />
            <CheckItem text="Coordinated holding patterns" />
            <CheckItem text="Historical rugger matching" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Trades Tab
function TradesTab({ positions, trades }) {
  return (
    <div style={styles.tabContent}>
      {/* Active Positions */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Active Positions ({positions.length})</h3>
        {positions.length === 0 ? (
          <div style={styles.empty}>No active positions</div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span>Token</span>
              <span>Entry</span>
              <span>Current</span>
              <span>PnL</span>
              <span>Strategy</span>
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
                  <span style={{ color: pnl >= 0 ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                  </span>
                  <span style={styles.strategyBadge}>{p.strategy || 'swing'}</span>
                  <span>{mins}m</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Trades */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recent Virtual Trades</h3>
        {trades.length === 0 ? (
          <div style={styles.empty}>No trades yet - AI is learning</div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span>Token</span>
              <span>Entry</span>
              <span>Exit</span>
              <span>PnL</span>
              <span>Hold Time</span>
              <span>Reason</span>
            </div>
            {trades.slice(0, 30).map(t => (
              <div key={t.id} style={styles.tableRow}>
                <span>
                  <a href={`https://pump.fun/${t.mint}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {t.symbol}
                  </a>
                </span>
                <span>${t.entryPrice?.toFixed(8)}</span>
                <span>${t.exitPrice?.toFixed(8)}</span>
                <span style={{ color: t.pnlPercent >= 0 ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
                  {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent?.toFixed(2)}%
                </span>
                <span>{t.holdTimeMinutes?.toFixed(0)}m</span>
                <span style={styles.reasonBadge}>{t.exitReason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Docs/Whitepaper Tab
function DocsTab() {
  return (
    <div style={styles.tabContent}>
      <div style={styles.docsContainer}>
        <div style={styles.docsHeader}>
          <h2 style={styles.docsTitle}>TRADOR Whitepaper</h2>
          <p style={styles.docsSubtitle}>The Most Advanced Self-Learning AI Trading System for Solana Memecoins</p>
        </div>

        <DocSection title="Abstract">
          TRADOR represents a paradigm shift in memecoin trading by combining multiple artificial intelligence 
          models with deep on-chain analysis and social intelligence. The system learns from every trade outcome, 
          continuously improving its ability to identify profitable opportunities while avoiding scams and rugs.
        </DocSection>

        <DocSection title="Problem Statement">
          <ul style={styles.docsList}>
            <li><strong>High Rug Rate:</strong> 90%+ of new tokens are scams</li>
            <li><strong>Information Asymmetry:</strong> Insiders have significant advantages</li>
            <li><strong>Speed Requirements:</strong> Opportunities last minutes, not hours</li>
            <li><strong>Emotional Trading:</strong> FOMO leads to consistent losses</li>
          </ul>
        </DocSection>

        <DocSection title="Solution Architecture">
          <div style={styles.archDiagram}>
            <div style={styles.archLayer}>
              <div style={styles.archTitle}>Data Sources</div>
              <div style={styles.archItems}>
                <span>Birdeye API</span>
                <span>Helius RPC</span>
                <span>DexScreener</span>
              </div>
            </div>
            <div style={styles.archArrow}>↓</div>
            <div style={styles.archLayer}>
              <div style={styles.archTitle}>Trading Brain</div>
              <div style={styles.archItems}>
                <span>Analytics</span>
                <span>Learner AI</span>
                <span>Alpha Engine</span>
                <span>Wallet Intel</span>
              </div>
            </div>
            <div style={styles.archArrow}>↓</div>
            <div style={styles.archLayer}>
              <div style={styles.archTitle}>AI Consensus</div>
              <div style={styles.archItems}>
                <span>Gemini</span>
                <span>GPT-4</span>
                <span>Claude</span>
                <span>Groq</span>
                <span>Perplexity</span>
              </div>
            </div>
            <div style={styles.archArrow}>↓</div>
            <div style={styles.archLayer}>
              <div style={styles.archTitle}>Decision Engine</div>
              <div style={styles.archItems}>
                <span>Score Calculation</span>
                <span>Risk Assessment</span>
                <span>Trade Execution</span>
              </div>
            </div>
          </div>
        </DocSection>

        <DocSection title="Multi-AI Consensus">
          <p>TRADOR uses 5 AI models to reach consensus on trading decisions:</p>
          <table style={styles.docsTable}>
            <thead>
              <tr><th>AI Model</th><th>Purpose</th><th>Speed</th></tr>
            </thead>
            <tbody>
              <tr><td>Gemini 1.5</td><td>Primary analysis</td><td>Fast</td></tr>
              <tr><td>GPT-4</td><td>Deep reasoning</td><td>Medium</td></tr>
              <tr><td>Claude</td><td>Risk assessment</td><td>Medium</td></tr>
              <tr><td>Groq</td><td>Real-time decisions</td><td>Very Fast</td></tr>
              <tr><td>Perplexity</td><td>News/Alpha search</td><td>Medium</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}>
            All AIs analyze tokens in parallel. Each votes BUY/SELL/HOLD. 
            Final signal requires &gt;60% agreement with weighted confidence.
          </p>
        </DocSection>

        <DocSection title="Self-Learning System">
          <div style={styles.learningFlow}>
            <span>Token Tracked</span>
            <span>→</span>
            <span>30min Wait</span>
            <span>→</span>
            <span>Check Price</span>
            <span>→</span>
            <span>Classify Outcome</span>
            <span>→</span>
            <span>Adjust Weights</span>
          </div>
          <p style={{ marginTop: 12 }}>
            The AI tracks 60+ signals per token including price momentum, volume patterns, 
            holder distribution, whale activity, and security metrics. It learns which 
            combinations lead to pumps vs dumps.
          </p>
        </DocSection>

        <DocSection title="Security Features">
          <ul style={styles.docsList}>
            <li><strong>RugCheck Integration:</strong> Automated rug detection</li>
            <li><strong>GoPlus Security:</strong> Token security scanning</li>
            <li><strong>Wallet Intelligence:</strong> Dev wallet, sniper, whale detection</li>
            <li><strong>Cluster Analysis:</strong> Coordinated holding patterns</li>
            <li><strong>Blacklist System:</strong> Known rugger wallet tracking</li>
          </ul>
        </DocSection>

        <DocSection title="Technical Specifications">
          <ul style={styles.docsList}>
            <li><strong>Blockchain:</strong> Solana</li>
            <li><strong>Data Sources:</strong> Birdeye, Helius, DexScreener</li>
            <li><strong>AI Models:</strong> 5 (Gemini, GPT-4, Claude, Groq, Perplexity)</li>
            <li><strong>Analysis Points:</strong> 60+ per token</li>
            <li><strong>Scan Interval:</strong> 60 seconds</li>
            <li><strong>Learning Cycle:</strong> 30 minutes per token</li>
          </ul>
        </DocSection>

        <DocSection title="Roadmap">
          <div style={styles.roadmap}>
            <RoadmapPhase phase="1" title="Core System" status="complete" items={['Trading brain', 'Birdeye integration', 'Basic analytics', 'Virtual trading', 'Dashboard v1']} />
            <RoadmapPhase phase="2" title="AI Enhancement" status="complete" items={['Self-learning AI', 'Multi-AI consensus', 'Wallet intelligence', 'Security scanning', 'Social intelligence']} />
            <RoadmapPhase phase="3" title="Live Trading" status="progress" items={['Live trading integration', 'Telegram bot', 'Mobile app', 'Advanced backtesting']} />
            <RoadmapPhase phase="4" title="Token Launch" status="planned" items={['TRADOR token', 'Profit sharing', 'Copy trading', 'API access tiers']} />
          </div>
        </DocSection>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ title, value, color, subtitle }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statCardTitle}>{title}</div>
      <div style={{ ...styles.statCardValue, color }}>{value}</div>
      <div style={styles.statCardSub}>{subtitle}</div>
    </div>
  );
}

function StatusItem({ label, active }) {
  return (
    <div style={styles.statusItem}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#00ff88' : '#333' }} />
      <span style={{ color: active ? '#fff' : '#666' }}>{label}</span>
    </div>
  );
}

function PnLItem({ label, value }) {
  const v = value || 0;
  return (
    <div style={styles.pnlItem}>
      <div style={styles.pnlLabel}>{label}</div>
      <div style={{ ...styles.pnlValue, color: v >= 0 ? '#00ff88' : '#ff4444' }}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)}%
      </div>
    </div>
  );
}

function WalletStat({ label, value, color }) {
  return (
    <div style={styles.walletStat}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
    </div>
  );
}

function FeatureItem({ icon, text }) {
  return (
    <div style={styles.featureItem}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function SecurityFeature({ label, desc, active }) {
  return (
    <div style={styles.securityFeature}>
      <span style={{ color: active ? '#00ff88' : '#888' }}>{active ? '✓' : '○'}</span>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#666' }}>{desc}</div>
      </div>
    </div>
  );
}

function RiskItem({ type, risk, action }) {
  const riskColor = risk === 'Critical' ? '#ff4444' : risk === 'High' ? '#ff8800' : risk === 'Medium' ? '#ffcc00' : '#00ff88';
  return (
    <div style={styles.riskItem}>
      <span>{type}</span>
      <span style={{ color: riskColor, fontWeight: 600 }}>{risk}</span>
      <span style={{ color: '#888', fontSize: 11 }}>{action}</span>
    </div>
  );
}

function CheckItem({ text }) {
  return (
    <div style={styles.checkItem}>
      <span style={{ color: '#00ff88' }}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function DocSection({ title, children }) {
  return (
    <div style={styles.docSection}>
      <h3 style={styles.docSectionTitle}>{title}</h3>
      <div style={styles.docSectionContent}>{children}</div>
    </div>
  );
}

function RoadmapPhase({ phase, title, status, items }) {
  const statusColor = status === 'complete' ? '#00ff88' : status === 'progress' ? '#ffcc00' : '#666';
  const statusText = status === 'complete' ? '✓ Complete' : status === 'progress' ? '⏳ In Progress' : '○ Planned';
  return (
    <div style={styles.roadmapPhase}>
      <div style={styles.roadmapHeader}>
        <span style={styles.roadmapNum}>Phase {phase}</span>
        <span style={styles.roadmapTitle}>{title}</span>
        <span style={{ color: statusColor, fontSize: 11 }}>{statusText}</span>
      </div>
      <ul style={styles.roadmapItems}>
        {items.map((item, i) => (
          <li key={i} style={{ color: status === 'complete' ? '#00ff88' : '#888' }}>
            {status === 'complete' ? '✓' : '○'} {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Styles
const styles = {
  // Loading
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' },
  loadingLogo: { fontSize: 48, fontWeight: 800, background: 'linear-gradient(90deg, #00ff88, #00ccff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20 },
  loadingText: { color: '#888', marginBottom: 20 },
  loadingBar: { width: 200, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' },
  loadingFill: { width: '60%', height: '100%', background: 'linear-gradient(90deg, #00ff88, #00ccff)', animation: 'pulse 1s infinite' },
  
  // Layout
  container: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #1a1a2e' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  logo: { fontSize: 28, fontWeight: 800, background: 'linear-gradient(90deg, #00ff88, #00ccff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 },
  tagline: { color: '#666', fontSize: 13 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  statusBadge: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#1a1a2e', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  btn: { padding: '8px 20px', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  
  // Navigation
  nav: { display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid #1a1a2e', background: '#0d0d12' },
  navBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, transition: 'all 0.2s' },
  
  // Main
  main: { padding: 24, maxWidth: 1400, margin: '0 auto' },
  tabContent: {},
  
  // Stats Row
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  statCard: { background: '#12121a', borderRadius: 12, padding: 20, border: '1px solid #1a1a2e' },
  statCardTitle: { fontSize: 12, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  statCardValue: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  statCardSub: { fontSize: 12, color: '#666' },
  
  // Grid
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 },
  card: { background: '#12121a', borderRadius: 12, padding: 24, border: '1px solid #1a1a2e' },
  cardTitle: { fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1, margin: 0, marginBottom: 20 },
  
  // Confidence Ring
  ringContainer: { display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: 20 },
  ringValue: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', display: 'flex', flexDirection: 'column' },
  statusList: { display: 'flex', flexDirection: 'column', gap: 8 },
  statusItem: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 },
  
  // PnL
  pnlGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  pnlItem: { background: '#1a1a2e', borderRadius: 8, padding: 14, textAlign: 'center' },
  pnlLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  pnlValue: { fontSize: 20, fontWeight: 700 },
  tradeStats: { display: 'flex', justifyContent: 'space-around', fontSize: 13, color: '#888' },
  
  // Learning
  learningGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  learningItem: { background: '#1a1a2e', borderRadius: 8, padding: 12, textAlign: 'center' },
  learningValue: { fontSize: 24, fontWeight: 700, color: '#00ccff' },
  learningLabel: { fontSize: 10, color: '#666', marginTop: 4 },
  topSignals: { marginTop: 16, fontSize: 11, color: '#888', textAlign: 'center' },
  
  // Risk
  riskSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, color: '#fff', margin: 0, marginBottom: 16 },
  riskBtns: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  riskBtn: { padding: 16, border: '2px solid', borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', background: '#1a1a2e' },
  riskBtnLabel: { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 },
  riskBtnDesc: { fontSize: 11, color: '#888' },

  // AI Tab
  aiCount: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 },
  aiList: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  aiItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#1a1a2e', borderRadius: 20, fontSize: 12 },
  aiDesc: { fontSize: 12, color: '#666', lineHeight: 1.6 },
  learnerStats: { display: 'flex', justifyContent: 'space-around', marginBottom: 20 },
  learnerStat: { textAlign: 'center' },
  recommendation: { marginTop: 16, padding: 12, background: '#1a1a2e', borderRadius: 8, fontSize: 12, color: '#00ccff', textAlign: 'center' },
  regimeBadge: { textAlign: 'center', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 16 },
  alphaStats: { display: 'flex', justifyContent: 'space-around', marginBottom: 16 },
  alphaStat: { textAlign: 'center' },
  socialStats: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  socialStat: { textAlign: 'center' },
  narratives: { marginBottom: 16 },
  narrativeTags: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  narrativeTag: { padding: '4px 10px', background: 'rgba(255,0,255,0.2)', borderRadius: 12, fontSize: 11, color: '#ff00ff' },
  
  // Security Tab
  walletStats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  walletStat: { background: '#1a1a2e', borderRadius: 8, padding: 14, textAlign: 'center' },
  walletFeatures: { display: 'flex', flexDirection: 'column', gap: 10 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 },
  securityFeatures: { display: 'flex', flexDirection: 'column', gap: 12 },
  securityFeature: { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 },
  riskMatrix: { display: 'flex', flexDirection: 'column', gap: 10 },
  riskItem: { display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 10, padding: '10px 12px', background: '#1a1a2e', borderRadius: 6, fontSize: 12, alignItems: 'center' },
  checkList: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  
  // Trades Tab
  section: { marginBottom: 30 },
  empty: { padding: 60, textAlign: 'center', color: '#666', background: '#12121a', borderRadius: 12, fontSize: 14 },
  table: { background: '#12121a', borderRadius: 12, overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', background: '#1a1a2e', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #1a1a2e', fontSize: 13, alignItems: 'center' },
  link: { color: '#00ccff', textDecoration: 'none' },
  strategyBadge: { padding: '3px 8px', background: '#1a1a2e', borderRadius: 4, fontSize: 10, textTransform: 'uppercase', color: '#888' },
  reasonBadge: { padding: '3px 8px', background: '#1a1a2e', borderRadius: 4, fontSize: 10, textTransform: 'uppercase', color: '#888' },
  
  // Docs Tab
  docsContainer: { maxWidth: 900, margin: '0 auto' },
  docsHeader: { textAlign: 'center', marginBottom: 40 },
  docsTitle: { fontSize: 32, fontWeight: 700, background: 'linear-gradient(90deg, #00ff88, #00ccff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, marginBottom: 12 },
  docsSubtitle: { color: '#888', fontSize: 14, margin: 0 },
  docSection: { marginBottom: 32, background: '#12121a', borderRadius: 12, padding: 24, border: '1px solid #1a1a2e' },
  docSectionTitle: { fontSize: 18, fontWeight: 600, color: '#00ccff', margin: 0, marginBottom: 16 },
  docSectionContent: { fontSize: 14, color: '#ccc', lineHeight: 1.7 },
  docsList: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  docsTable: { width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 13 },
  archDiagram: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  archLayer: { background: '#1a1a2e', borderRadius: 8, padding: 16, width: '100%', textAlign: 'center' },
  archTitle: { fontSize: 12, color: '#888', marginBottom: 8, textTransform: 'uppercase' },
  archItems: { display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
  archArrow: { color: '#00ff88', fontSize: 20 },
  learningFlow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: 16, background: '#1a1a2e', borderRadius: 8, fontSize: 12 },
  roadmap: { display: 'flex', flexDirection: 'column', gap: 16 },
  roadmapPhase: { background: '#1a1a2e', borderRadius: 8, padding: 16 },
  roadmapHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  roadmapNum: { background: '#00ff88', color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 },
  roadmapTitle: { fontWeight: 600, flex: 1 },
  roadmapItems: { margin: 0, paddingLeft: 20, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 },
  
  // Footer
  footer: { display: 'flex', justifyContent: 'center', gap: 16, padding: '16px 24px', borderTop: '1px solid #1a1a2e', fontSize: 12, color: '#666' }
};

// Add table styles
styles.docsTable = {
  ...styles.docsTable,
  '& th': { textAlign: 'left', padding: '8px 12px', background: '#1a1a2e', color: '#888' },
  '& td': { padding: '8px 12px', borderBottom: '1px solid #1a1a2e' }
};

export default App;
