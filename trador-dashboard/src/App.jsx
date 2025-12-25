import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'TRADOR', open: true, minimized: false, x: 20, y: 20, z: 10 },
    { id: 'stats', title: 'Live Stats', open: true, minimized: false, x: 480, y: 20, z: 9 },
    { id: 'feed', title: 'Live Feed', open: false, minimized: false, x: 50, y: 80, z: 8 },
    { id: 'experiment', title: 'The Experiment', open: false, minimized: false, x: 60, y: 40, z: 7 },
    { id: 'brain', title: 'AI Brain', open: false, minimized: false, x: 80, y: 60, z: 6 },
    { id: 'learning', title: 'Self-Learning', open: false, minimized: false, x: 100, y: 40, z: 5 },
    { id: 'trading', title: 'Trading System', open: false, minimized: false, x: 120, y: 60, z: 4 },
    { id: 'techstack', title: 'Tech Stack', open: false, minimized: false, x: 140, y: 40, z: 3 },
    { id: 'infrastructure', title: 'Infrastructure', open: false, minimized: false, x: 160, y: 60, z: 2 },
    { id: 'apis', title: 'Data Sources', open: false, minimized: false, x: 180, y: 80, z: 1 },
    { id: 'roadmap', title: 'Roadmap', open: false, minimized: false, x: 200, y: 40, z: 0 },
    { id: 'terminal', title: 'Terminal', open: false, minimized: false, x: 220, y: 60, z: -1 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [recentTokens, setRecentTokens] = useState([]);
  const [logs, setLogs] = useState(['[BOOT] TRADOR AI v1.0', '[INIT] Loading neural networks...', '[OK] 5 AI models connected']);
  const [maxZ, setMaxZ] = useState(11);
  const [time, setTime] = useState(new Date());
  const dragRef = useRef(null);

  useEffect(() => {
    fetchStats();
    fetchRecent();
    const interval = setInterval(fetchStats, 5000);
    const recentInterval = setInterval(fetchRecent, 3000);
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(recentInterval); clearInterval(clock); };
  }, []);

  const fetchRecent = async () => {
    try {
      const res = await fetch(`${API_URL}/api/recent`);
      if (res.ok) {
        const data = await res.json();
        setRecentTokens(data.slice(0, 20));
      }
    } catch (e) {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setAiStats(data);
        if (data.dataPoints > 0) {
          const msgs = [
            `[SCAN] Analyzed ${data.trackedTokens} tokens`,
            `[DATA] ${data.dataPoints} learning samples`,
            `[AI] Accuracy: ${data.aiAccuracy?.toFixed(1) || 0}%`,
            `[MKT] Regime: ${data.marketRegime || 'neutral'}`,
            `[NET] ${data.availableAIs?.length || 5} AIs online`,
          ];
          addLog(msgs[Math.floor(Math.random() * msgs.length)]);
        }
      }
    } catch (e) { 
      addLog('[ERR] Reconnecting...');
    }
  };

  const addLog = (msg) => setLogs(l => [...l.slice(-50), `${msg}`]);
  const bringToFront = (id) => { setMaxZ(z => z + 1); setWindows(w => w.map(win => win.id === id ? { ...win, z: maxZ + 1 } : win)); };
  const toggleWindow = (id) => { setWindows(w => w.map(win => win.id === id ? { ...win, open: !win.open, minimized: false } : win)); bringToFront(id); setStartMenuOpen(false); };
  const startDrag = (e, id) => { if (e.target.closest('.win-btn')) return; bringToFront(id); const win = windows.find(w => w.id === id); dragRef.current = { id, startX: e.clientX - win.x, startY: e.clientY - win.y }; };
  const onDrag = (e) => { if (!dragRef.current) return; const { id, startX, startY } = dragRef.current; setWindows(w => w.map(win => win.id === id ? { ...win, x: Math.max(0, e.clientX - startX), y: Math.max(0, e.clientY - startY) } : win)); };
  const endDrag = () => { dragRef.current = null; };

  const Win = ({ id, children, width = 420 }) => {
    const win = windows.find(w => w.id === id);
    if (!win?.open || win.minimized) return null;
    return (
      <div className="window" style={{ left: win.x, top: win.y, zIndex: win.z, width }} onMouseDown={() => bringToFront(id)}>
        <div className="win-title" onMouseDown={(e) => startDrag(e, id)}>
          <span>{win.title}</span>
          <div className="win-btns">
            <button className="win-btn min" onClick={() => setWindows(w => w.map(x => x.id === id ? { ...x, minimized: true } : x))}>_</button>
            <button className="win-btn close" onClick={() => setWindows(w => w.map(x => x.id === id ? { ...x, open: false } : x))}>X</button>
          </div>
        </div>
        <div className="win-body">{children}</div>
      </div>
    );
  };

  const totalOutcomes = (aiStats?.stats?.pumps || 0) + (aiStats?.stats?.dumps || 0) + (aiStats?.stats?.neutral || 0);
  const pumpRate = totalOutcomes > 0 ? ((aiStats?.stats?.pumps || 0) / totalOutcomes * 100).toFixed(0) : 0;
  const progress = Math.min(100, ((aiStats?.dataPoints || 0) / 100) * 100);

  return (
    <div className="desktop" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
      <div className="icons">
        {windows.map(w => (
          <div key={w.id} className="icon" onDoubleClick={() => toggleWindow(w.id)}>
            <div className="icon-img">{w.title === 'TRADOR' ? 'T' : w.title[0]}</div>
            <span>{w.title}</span>
          </div>
        ))}
      </div>

      <Win id="welcome" width={450}>
        <div className="welcome">
          <div className="logo-section">
            <div className="logo-main">TRADOR</div>
            <div className="logo-tag">Autonomous AI Trading System</div>
            <div className="logo-chain">Built on Solana</div>
          </div>
          
          <div className="hero-grid">
            <div className="hero-card">
              <div className="hc-val">{aiStats?.aiModelsCount || 5}</div>
              <div className="hc-lbl">AI Models</div>
            </div>
            <div className="hero-card">
              <div className="hc-val">60+</div>
              <div className="hc-lbl">Signals</div>
            </div>
            <div className="hero-card accent">
              <div className="hc-val">{aiStats?.dataPoints?.toLocaleString() || '0'}</div>
              <div className="hc-lbl">Data Points</div>
            </div>
          </div>

          <div className="status-box">
            <div className="sb-row">
              <span className={`pulse ${aiStats?.isRealData ? 'live' : ''}`}></span>
              <span className="sb-text">{aiStats?.isRealData ? 'LIVE - Learning from real market data' : 'Initializing...'}</span>
            </div>
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${progress}%`}}></div>
              </div>
              <span className="progress-text">{aiStats?.dataPoints || 0}/100 to virtual trading</span>
            </div>
          </div>

          <p className="hero-desc">A self-learning AI that trades Solana memecoins. 5 AI models vote together, analyze 60+ signals per token, and learn from every outcome.</p>

          <div className="btn-grid">
            <button className="main-btn hot" onClick={() => toggleWindow('feed')}>Live Feed</button>
            <button className="main-btn" onClick={() => toggleWindow('experiment')}>The Experiment</button>
            <button className="main-btn" onClick={() => toggleWindow('brain')}>AI Brain</button>
            <button className="main-btn" onClick={() => toggleWindow('learning')}>Self-Learning</button>
            <button className="main-btn" onClick={() => toggleWindow('trading')}>Trading</button>
            <button className="main-btn" onClick={() => toggleWindow('techstack')}>Tech Stack</button>
            <button className="main-btn" onClick={() => toggleWindow('infrastructure')}>Infrastructure</button>
            <button className="main-btn" onClick={() => toggleWindow('apis')}>Data Sources</button>
            <button className="main-btn" onClick={() => toggleWindow('roadmap')}>Roadmap</button>
          </div>

          <div className="social-links">
            <a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://pump.fun" target="_blank" rel="noopener noreferrer">Pump.fun</a>
          </div>
        </div>
      </Win>

      <Win id="stats" width={360}>
        <div className="stats-win">
          <div className="sw-header">
            <span className={`sw-dot ${aiStats ? 'on' : ''}`}></span>
            <span>System Status</span>
          </div>
          
          {aiStats ? (
            <>
              <div className="big-stat">
                <div className="bs-val">{aiStats.confidence}<span>%</span></div>
                <div className="bs-lbl">AI Confidence</div>
                <div className="bs-bar"><div style={{width: `${aiStats.confidence}%`}}></div></div>
              </div>

              <div className="stat-rows">
                <div className="sr"><span>Data Points</span><span className="srv">{aiStats.dataPoints?.toLocaleString()}</span></div>
                <div className="sr"><span>Tokens Tracked</span><span className="srv">{aiStats.trackedTokens || 0}</span></div>
                <div className="sr"><span>AI Accuracy</span><span className="srv">{aiStats.aiAccuracy?.toFixed(1) || 0}%</span></div>
                <div className="sr"><span>Market Regime</span><span className="srv cap">{aiStats.marketRegime || 'neutral'}</span></div>
                <div className="sr"><span>AIs Online</span><span className="srv green">{aiStats.availableAIs?.length || 0}/5</span></div>
              </div>

              <div className="outcomes-box">
                <div className="ob-title">Learning Outcomes</div>
                <div className="ob-bar">
                  <div className="ob-pump" style={{width: `${pumpRate}%`}}></div>
                </div>
                <div className="ob-nums">
                  <span className="green">{aiStats.stats?.pumps || 0} pumps</span>
                  <span className="red">{aiStats.stats?.dumps || 0} dumps</span>
                  <span>{aiStats.stats?.neutral || 0} flat</span>
                </div>
              </div>

              <div className="mini-stats">
                <div className="ms"><span className="msv">{aiStats.knownWallets || 0}</span><span>Wallets</span></div>
                <div className="ms"><span className="msv">{aiStats.trackedClusters || 0}</span><span>Clusters</span></div>
              </div>
            </>
          ) : (
            <div className="loading"><div className="spinner"></div><span>Connecting...</span></div>
          )}
        </div>
      </Win>

      <Win id="experiment" width={500}>
        <div className="exp-win">
          <div className="exp-question">Can an AI learn to profitably trade memecoins?</div>
          
          <div className="exp-block">
            <h3>The Challenge</h3>
            <p>Memecoin trading is chaos. Tokens pump 1000% then dump to zero in minutes. 95% are scams. Information is scattered across Twitter, Telegram, and on-chain data. Human emotions lead to FOMO buys and panic sells.</p>
          </div>

          <div className="exp-block">
            <h3>Our Approach</h3>
            <ul>
              <li>5 AI models analyze every token independently</li>
              <li>60+ signals scored: price, volume, holders, security, wallets</li>
              <li>Consensus voting - only trade when AIs agree</li>
              <li>Learn from every outcome to improve predictions</li>
              <li>No emotions, no FOMO, pure data-driven decisions</li>
            </ul>
          </div>

          <div className="exp-block">
            <h3>Revenue Model</h3>
            <div className="rev-flow">
              <div className="rf-step"><div className="rf-icon">1</div><span>AI trades</span></div>
              <div className="rf-arrow">-</div>
              <div className="rf-step"><div className="rf-icon">2</div><span>Profits</span></div>
              <div className="rf-arrow">-</div>
              <div className="rf-step"><div className="rf-icon">3</div><span>Buyback</span></div>
            </div>
            <p className="rf-note">100% of trading profits buy TRADOR tokens. No taxes. Pure performance.</p>
          </div>

          <div className="exp-block">
            <h3>Transparency</h3>
            <p>Everything public. Real-time stats. All trades verifiable on-chain. No black boxes. Watch the AI learn and improve.</p>
          </div>
        </div>
      </Win>

      <Win id="brain" width={520}>
        <div className="brain-win">
          <div className="brain-visual">
            <div className="bv-core">BRAIN</div>
            <div className="bv-orbit">
              <div className="bv-ai a1"><span>Gemini</span></div>
              <div className="bv-ai a2"><span>GPT-4</span></div>
              <div className="bv-ai a3"><span>Claude</span></div>
              <div className="bv-ai a4"><span>Groq</span></div>
              <div className="bv-ai a5"><span>Perplexity</span></div>
            </div>
          </div>

          <div className="brain-block">
            <h3>Multi-AI Consensus</h3>
            <p>5 different AI models analyze each token. Each has different training, biases, and perspectives. They vote independently: BUY, SELL, or HOLD.</p>
          </div>

          <div className="vote-example">
            <div className="ve-title">Example Analysis:</div>
            <div className="ve-votes">
              <span className="v-buy">Gemini: BUY</span>
              <span className="v-buy">GPT-4: BUY</span>
              <span className="v-hold">Claude: HOLD</span>
              <span className="v-buy">Groq: BUY</span>
              <span className="v-sell">Perplexity: SELL</span>
            </div>
            <div className="ve-result">60% BUY - Below threshold, no trade</div>
          </div>

          <div className="brain-block">
            <h3>Why This Works</h3>
            <ul>
              <li>Reduces individual AI bias and hallucinations</li>
              <li>Filters out noise - random signals don't get consensus</li>
              <li>More robust - if one API fails, others continue</li>
              <li>70%+ agreement required to execute trades</li>
            </ul>
          </div>
        </div>
      </Win>

      <Win id="learning" width={500}>
        <div className="learn-win">
          <div className="learn-flow">
            <div className="lf-step"><div className="lf-num">1</div><div className="lf-text"><b>Scan</b><span>New token detected</span></div></div>
            <div className="lf-step"><div className="lf-num">2</div><div className="lf-text"><b>Analyze</b><span>60+ signals scored</span></div></div>
            <div className="lf-step"><div className="lf-num">3</div><div className="lf-text"><b>Track</b><span>Monitor for 10 min</span></div></div>
            <div className="lf-step"><div className="lf-num">4</div><div className="lf-text"><b>Learn</b><span>Record outcome</span></div></div>
          </div>

          <div className="learn-block">
            <h3>What It Learns</h3>
            <ul>
              <li>Which signals predict pumps vs dumps</li>
              <li>Optimal market cap ranges</li>
              <li>Wallet patterns that indicate smart money</li>
              <li>Time-of-day effects</li>
              <li>Which AI models are most accurate</li>
            </ul>
          </div>

          <div className="learn-stats-box">
            <div className="lsb-item"><span className="lsb-val">{aiStats?.stats?.pumps || 0}</span><span>Pumps</span></div>
            <div className="lsb-item"><span className="lsb-val">{aiStats?.stats?.dumps || 0}</span><span>Dumps</span></div>
            <div className="lsb-item"><span className="lsb-val">{aiStats?.aiAccuracy?.toFixed(0) || 0}%</span><span>Accuracy</span></div>
          </div>

          <div className="learn-block">
            <h3>Continuous Optimization</h3>
            <p>Every 50 outcomes, the AI runs an optimization pass. It identifies which signals are most predictive and adjusts their weights. The system literally gets smarter over time.</p>
          </div>
        </div>
      </Win>

      <Win id="trading" width={480}>
        <div className="trade-win">
          <div className="trade-block">
            <h3>Trade Execution</h3>
            <div className="trade-steps">
              <div className="ts">1. Token passes 60+ signal analysis</div>
              <div className="ts">2. 5 AI models vote BUY/SELL/HOLD</div>
              <div className="ts">3. 70%+ consensus required</div>
              <div className="ts">4. Kelly Criterion sizes position</div>
              <div className="ts">5. Execute via Jupiter aggregator</div>
            </div>
          </div>

          <div className="trade-block">
            <h3>Risk Management</h3>
            <div className="risk-items">
              <div className="ri"><div className="ri-icon">SL</div><div><b>Stop Loss</b><span>Auto-exit at -15%</span></div></div>
              <div className="ri"><div className="ri-icon">TP</div><div><b>Take Profit</b><span>Lock gains at targets</span></div></div>
              <div className="ri"><div className="ri-icon">TS</div><div><b>Trailing Stop</b><span>Protect as price rises</span></div></div>
              <div className="ri"><div className="ri-icon">MX</div><div><b>Max Exposure</b><span>Limit total risk</span></div></div>
            </div>
          </div>

          <div className="trade-block">
            <h3>Security Checks</h3>
            <ul>
              <li>No mint authority (can't inflate supply)</li>
              <li>No freeze authority (can't lock wallets)</li>
              <li>LP burned or locked</li>
              <li>No known rugger wallets</li>
              <li>Passes RugCheck + GoPlus scans</li>
            </ul>
          </div>
        </div>
      </Win>

      <Win id="techstack" width={540}>
        <div className="tech-win">
          <div className="tech-header">Full Technical Stack - 100% Verifiable</div>
          
          <div className="tech-section">
            <h3>Backend (Node.js)</h3>
            <div className="tech-items">
              <div className="tech-item">
                <span className="ti-name">Runtime</span>
                <span className="ti-val">Node.js v20 LTS</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Framework</span>
                <span className="ti-val">Express.js REST API</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Process Manager</span>
                <span className="ti-val">PM2 (auto-restart, logs)</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Data Storage</span>
                <span className="ti-val">JSON files (training data)</span>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h3>Frontend (React)</h3>
            <div className="tech-items">
              <div className="tech-item">
                <span className="ti-name">Framework</span>
                <span className="ti-val">React 18 + Vite</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Styling</span>
                <span className="ti-val">Custom CSS (Win98 theme)</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">State</span>
                <span className="ti-val">React Hooks (useState, useEffect)</span>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h3>AI Models (5 Total)</h3>
            <div className="tech-items">
              <div className="tech-item">
                <span className="ti-name">Google</span>
                <span className="ti-val">Gemini 1.5 Flash</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">OpenAI</span>
                <span className="ti-val">GPT-4o Mini</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Anthropic</span>
                <span className="ti-val">Claude 3 Haiku</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Groq</span>
                <span className="ti-val">Llama 3.1 70B</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">Perplexity</span>
                <span className="ti-val">Llama 3.1 Sonar</span>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h3>Core Modules</h3>
            <div className="tech-items">
              <div className="tech-item">
                <span className="ti-name">brain.js</span>
                <span className="ti-val">Main trading logic, scoring</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">multiAI.js</span>
                <span className="ti-val">AI consensus voting</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">learner.js</span>
                <span className="ti-val">Self-learning from outcomes</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">analytics.js</span>
                <span className="ti-val">60+ signal analysis</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">helius.js</span>
                <span className="ti-val">Blockchain data fetching</span>
              </div>
              <div className="tech-item">
                <span className="ti-name">walletIntel.js</span>
                <span className="ti-val">Wallet pattern detection</span>
              </div>
            </div>
          </div>
        </div>
      </Win>

      <Win id="infrastructure" width={520}>
        <div className="infra-win">
          <div className="infra-header">Infrastructure - Fully Transparent</div>
          
          <div className="infra-section">
            <h3>Cloud Hosting</h3>
            <div className="infra-box">
              <div className="ib-row">
                <span className="ib-label">Provider</span>
                <span className="ib-value">Google Cloud Platform (GCP)</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Service</span>
                <span className="ib-value">Compute Engine VM</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Region</span>
                <span className="ib-value">us-central1 (Iowa)</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Machine Type</span>
                <span className="ib-value">e2-medium (2 vCPU, 4GB RAM)</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">OS</span>
                <span className="ib-value">Ubuntu 22.04 LTS</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Uptime</span>
                <span className="ib-value">24/7 (auto-restart on crash)</span>
              </div>
            </div>
          </div>

          <div className="infra-section">
            <h3>Network Architecture</h3>
            <div className="infra-box">
              <div className="ib-row">
                <span className="ib-label">Public Website</span>
                <span className="ib-value">Port 80 (this site)</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">AI API</span>
                <span className="ib-value">Port 3003 (REST endpoints)</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Admin Dashboard</span>
                <span className="ib-value">Port 443 (private)</span>
              </div>
            </div>
          </div>

          <div className="infra-section">
            <h3>Process Management</h3>
            <div className="infra-box">
              <div className="ib-row">
                <span className="ib-label">trador-ai</span>
                <span className="ib-value">Main AI engine (always running)</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">trador-public</span>
                <span className="ib-value">This website</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">trador-private</span>
                <span className="ib-value">Admin dashboard</span>
              </div>
            </div>
            <p className="infra-note">All processes managed by PM2 with auto-restart and log rotation.</p>
          </div>

          <div className="infra-section">
            <h3>Why Google Cloud?</h3>
            <ul>
              <li>99.99% uptime SLA</li>
              <li>Low latency to Solana RPC nodes</li>
              <li>Scalable if trading volume increases</li>
              <li>Enterprise-grade security</li>
            </ul>
          </div>
        </div>
      </Win>

      <Win id="apis" width={560}>
        <div className="apis-win">
          <div className="apis-header">Data Sources & APIs</div>
          <p className="apis-intro">All data comes from real, verifiable sources. No fake data. No simulations.</p>
          
          <div className="api-section">
            <h3>Blockchain Data</h3>
            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">B</span>
                <span>Birdeye API</span>
                <a href="https://birdeye.so" target="_blank" rel="noopener noreferrer" className="api-link">birdeye.so</a>
              </div>
              <div className="api-desc">Real-time Solana token prices, volume, market cap, holder counts, trading activity. Primary data source for token discovery.</div>
              <div className="api-data">Provides: Price, Volume, Market Cap, Holders, Buy/Sell Pressure</div>
            </div>
            
            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">H</span>
                <span>Helius RPC</span>
                <a href="https://helius.dev" target="_blank" rel="noopener noreferrer" className="api-link">helius.dev</a>
              </div>
              <div className="api-desc">Enhanced Solana RPC with token metadata, holder distribution, transaction history. Used for deep on-chain analysis.</div>
              <div className="api-data">Provides: Holder Distribution, Top Wallets, Transaction History</div>
            </div>

            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">P</span>
                <span>Pump.fun API</span>
                <a href="https://pump.fun" target="_blank" rel="noopener noreferrer" className="api-link">pump.fun</a>
              </div>
              <div className="api-desc">Direct access to Pump.fun token data. Ensures we only analyze real Pump.fun tokens, not random Solana tokens.</div>
              <div className="api-data">Provides: Token Verification, Bonding Curve Status, Creator Info</div>
            </div>
          </div>

          <div className="api-section">
            <h3>Price & Trading</h3>
            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">J</span>
                <span>Jupiter Aggregator</span>
                <a href="https://jup.ag" target="_blank" rel="noopener noreferrer" className="api-link">jup.ag</a>
              </div>
              <div className="api-desc">Best price execution across all Solana DEXs. Will be used for actual trade execution when live trading begins.</div>
              <div className="api-data">Provides: Price Quotes, Swap Routes, Slippage Calculation</div>
            </div>

            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">D</span>
                <span>DexScreener</span>
                <a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer" className="api-link">dexscreener.com</a>
              </div>
              <div className="api-desc">Backup data source for token discovery and price verification. Cross-references with Birdeye data.</div>
              <div className="api-data">Provides: Pair Data, Liquidity, Price Charts</div>
            </div>
          </div>

          <div className="api-section">
            <h3>Security Checks</h3>
            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">R</span>
                <span>RugCheck</span>
                <a href="https://rugcheck.xyz" target="_blank" rel="noopener noreferrer" className="api-link">rugcheck.xyz</a>
              </div>
              <div className="api-desc">Automated rug pull detection. Checks mint authority, freeze authority, LP status, and known scammer wallets.</div>
              <div className="api-data">Provides: Risk Score, Security Flags, LP Analysis</div>
            </div>

            <div className="api-item">
              <div className="api-name">
                <span className="api-icon">G</span>
                <span>GoPlus Security</span>
                <a href="https://gopluslabs.io" target="_blank" rel="noopener noreferrer" className="api-link">gopluslabs.io</a>
              </div>
              <div className="api-desc">Additional security layer. Detects honeypots, blacklisted addresses, and contract vulnerabilities.</div>
              <div className="api-data">Provides: Honeypot Detection, Contract Analysis</div>
            </div>
          </div>

          <div className="api-note">
            <b>Verification:</b> You can verify any token data by checking the same APIs yourself. All contract addresses shown in the Live Feed can be looked up on Solscan, Birdeye, or Pump.fun.
          </div>
        </div>
      </Win>

      <Win id="roadmap" width={460}>
        <div className="roadmap-win">
          <div className="rm-phase current">
            <div className="rm-marker">NOW</div>
            <div className="rm-content">
              <h3>Phase 1: Learning</h3>
              <ul>
                <li>Collecting market data 24/7</li>
                <li>Training on pump/dump patterns</li>
                <li>Building prediction accuracy</li>
                <li>Target: 100+ data points</li>
              </ul>
            </div>
          </div>

          <div className="rm-phase">
            <div className="rm-marker">NEXT</div>
            <div className="rm-content">
              <h3>Phase 2: Virtual Trading</h3>
              <ul>
                <li>Paper trading with real signals</li>
                <li>Track virtual P&L</li>
                <li>Optimize entry/exit strategies</li>
                <li>Target: 55%+ win rate</li>
              </ul>
            </div>
          </div>

          <div className="rm-phase">
            <div className="rm-marker">SOON</div>
            <div className="rm-content">
              <h3>Phase 3: Live Trading</h3>
              <ul>
                <li>Real trades with real SOL</li>
                <li>Start small, scale with confidence</li>
                <li>100% profits to buybacks</li>
                <li>Full transparency on-chain</li>
              </ul>
            </div>
          </div>

          <div className="rm-phase">
            <div className="rm-marker">FUTURE</div>
            <div className="rm-content">
              <h3>Phase 4: Scale</h3>
              <ul>
                <li>Increase position sizes</li>
                <li>Add more AI models</li>
                <li>Cross-chain expansion</li>
                <li>Community features</li>
              </ul>
            </div>
          </div>
        </div>
      </Win>

      <Win id="feed" width={620}>
        <div className="feed-win">
          <div className="feed-header">
            <span className={`feed-dot ${recentTokens.length > 0 ? 'on' : ''}`}></span>
            <span>Live Token Analysis</span>
            <span className="feed-count">{recentTokens.length} recent</span>
          </div>
          {recentTokens.length > 0 ? (
            <div className="feed-list">
              {recentTokens.map((t, i) => (
                <div key={i} className={`feed-item ${t.shouldTrade ? 'trade' : ''} ${t.recommendation === 'STRONG_BUY' ? 'hot' : ''}`}>
                  <div className="fi-main">
                    <span className="fi-symbol">{t.symbol}</span>
                    {t.isPumpFun && <span className="fi-verified">PUMP.FUN</span>}
                    <span className="fi-mcap">${(t.marketCap/1000).toFixed(0)}k</span>
                    <span className={`fi-score ${t.score >= 70 ? 'high' : t.score >= 50 ? 'med' : 'low'}`}>{t.score}</span>
                    <span className={`fi-rec ${t.recommendation?.toLowerCase()}`}>{t.recommendation}</span>
                    {t.shouldTrade && <span className="fi-trade">TRADE</span>}
                  </div>
                  <div className="fi-contract">
                    <button className="fi-copy" onClick={() => {navigator.clipboard.writeText(t.mint); alert('CA copied!')}}>Copy CA</button>
                    <a href={`https://solscan.io/token/${t.mint}`} target="_blank" rel="noopener noreferrer" className="fi-link">Solscan</a>
                    <a href={`https://pump.fun/coin/${t.mint}`} target="_blank" rel="noopener noreferrer" className="fi-link">Pump.fun</a>
                    <a href={`https://birdeye.so/token/${t.mint}?chain=solana`} target="_blank" rel="noopener noreferrer" className="fi-link">Birdeye</a>
                    <a href={`https://dexscreener.com/solana/${t.mint}`} target="_blank" rel="noopener noreferrer" className="fi-link">DexScreener</a>
                  </div>
                  <div className="fi-ca">
                    <span className="fi-mint">{t.mint}</span>
                  </div>
                  <div className="fi-details">
                    <span className="fi-ai">AI: {t.aiVotes?.buy || 0}B/{t.aiVotes?.sell || 0}S/{t.aiVotes?.hold || 0}H</span>
                    <span className="fi-holders">{t.holders} holders</span>
                    <span className="fi-liq">{(t.liquidity || 0).toFixed(1)} SOL</span>
                    {t.source && <span className="fi-source">{t.source}</span>}
                  </div>
                  {t.flags?.length > 0 && (
                    <div className="fi-flags">
                      {t.flags.slice(0, 4).map((f, j) => (
                        <span key={j} className={`fi-flag ${f.startsWith('RED') ? 'red' : f.startsWith('GREEN') ? 'green' : 'yellow'}`}>
                          {f.replace('RED:', '').replace('GREEN:', '').replace('YELLOW:', '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="feed-empty">Waiting for token analyses...</div>
          )}
        </div>
      </Win>

      <Win id="terminal" width={560}>
        <div className="terminal">
          <div className="term-top">
            <span>TRADOR Terminal v1.0</span>
            <span className={aiStats ? 'online' : 'offline'}>{aiStats ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="term-content">
            {logs.map((log, i) => <div key={i} className="term-line">{log}</div>)}
            <div className="term-cursor">{'>'} _</div>
          </div>
        </div>
      </Win>

      <div className="taskbar">
        <button className="start-btn" onClick={() => setStartMenuOpen(!startMenuOpen)}>
          <span className="start-icon">T</span>
          <span>Start</span>
        </button>
        <div className="taskbar-windows">
          {windows.filter(w => w.open).map(w => (
            <button key={w.id} className={`tb-win ${!w.minimized ? 'active' : ''}`}
              onClick={() => { setWindows(ws => ws.map(x => x.id === w.id ? { ...x, minimized: false } : x)); bringToFront(w.id); }}>
              {w.title}
            </button>
          ))}
        </div>
        <div className="tray">
          <span className={`tray-dot ${aiStats ? 'on' : ''}`}></span>
          <span className="tray-time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {startMenuOpen && (
        <div className="start-menu">
          <div className="sm-side">TRADOR</div>
          <div className="sm-items">
            {windows.map(w => (
              <button key={w.id} className="sm-btn" onClick={() => toggleWindow(w.id)}>
                <span className="sm-icon">{w.title[0]}</span>
                <span>{w.title}</span>
              </button>
            ))}
            <div className="sm-sep"></div>
            <a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer" className="sm-btn">
              <span className="sm-icon">X</span><span>Twitter</span>
            </a>
            <a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer" className="sm-btn">
              <span className="sm-icon">T</span><span>Telegram</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
