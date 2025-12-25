import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'TRADOR', open: true, minimized: false, x: 30, y: 25, z: 10 },
    { id: 'stats', title: 'Live Stats', open: true, minimized: false, x: 470, y: 25, z: 9 },
    { id: 'experiment', title: 'The Experiment', open: false, minimized: false, x: 80, y: 50, z: 8 },
    { id: 'brain', title: 'AI Brain', open: false, minimized: false, x: 100, y: 70, z: 7 },
    { id: 'decisions', title: 'AI Decisions', open: false, minimized: false, x: 120, y: 45, z: 6 },
    { id: 'learning', title: 'Self-Learning', open: false, minimized: false, x: 140, y: 65, z: 5 },
    { id: 'trading', title: 'Trading', open: false, minimized: false, x: 160, y: 85, z: 4 },
    { id: 'tech', title: 'Tech Stack', open: false, minimized: false, x: 180, y: 55, z: 3 },
    { id: 'transparency', title: 'Transparency', open: false, minimized: false, x: 200, y: 75, z: 2 },
    { id: 'terminal', title: 'Terminal', open: false, minimized: false, x: 220, y: 45, z: 1 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [logs, setLogs] = useState(['Initializing TRADOR AI...']);
  const [maxZ, setMaxZ] = useState(11);
  const dragRef = useRef(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setAiStats(data);
        if (data.multiAI?.recentConsensus?.[0]) {
          const recent = data.multiAI.recentConsensus[0];
          addLog(`Analyzed ${recent.token}: ${recent.consensus} (${recent.confidence}% confidence)`);
        } else {
          addLog(`Synced: ${data.dataPoints} data points | ${data.trackedTokens} tracked`);
        }
      }
    } catch (e) { addLog('Reconnecting...'); }
  };

  const addLog = (msg) => setLogs(l => [...l.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
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
            <button className="win-btn" onClick={() => setWindows(w => w.map(x => x.id === id ? { ...x, minimized: true } : x))}>_</button>
            <button className="win-btn" onClick={() => setWindows(w => w.map(x => x.id === id ? { ...x, open: false } : x))}>X</button>
          </div>
        </div>
        <div className="win-body">{children}</div>
      </div>
    );
  };

  const totalOutcomes = (aiStats?.stats?.pumps || 0) + (aiStats?.stats?.dumps || 0) + (aiStats?.stats?.neutral || 0);
  const recentDecisions = aiStats?.multiAI?.recentConsensus || [];

  return (
    <div className="desktop" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
      <div className="icons">
        {windows.map(w => (<div key={w.id} className="icon" onDoubleClick={() => toggleWindow(w.id)}><div className="icon-img">{w.title[0]}</div><span>{w.title}</span></div>))}
      </div>

      {/* Welcome */}
      <Win id="welcome" width={450}>
        <div className="welcome">
          <div className="logo-box"><h1>TRADOR</h1><div className="logo-sub">Autonomous AI Trading Experiment</div></div>
          <div className="hero-stats">
            <div className="hs"><span className="hsv">{aiStats?.aiModelsCount || 5}</span><span className="hsl">AI Models</span></div>
            <div className="hs"><span className="hsv">60+</span><span className="hsl">Signals</span></div>
            <div className="hs"><span className="hsv">{aiStats?.dataPoints?.toLocaleString() || '0'}</span><span className="hsl">Data Points</span></div>
          </div>
          <div className="hero-desc">
            <p>A fully autonomous AI system that analyzes and trades Solana memecoins. 5 AI models work together, analyze 60+ signals per token, and continuously learn from outcomes.</p>
          </div>
          <div className="status-badge"><span className={`sb-dot ${aiStats?.isRealData ? 'live' : ''}`}></span><span>{aiStats?.isRealData ? 'LIVE - Real Data' : 'LEARNING MODE'}</span></div>
          <div className="nav-grid">
            <button className="nav-btn" onClick={() => toggleWindow('experiment')}>The Experiment</button>
            <button className="nav-btn" onClick={() => toggleWindow('brain')}>AI Brain</button>
            <button className="nav-btn" onClick={() => toggleWindow('decisions')}>AI Decisions</button>
            <button className="nav-btn" onClick={() => toggleWindow('learning')}>Self-Learning</button>
            <button className="nav-btn" onClick={() => toggleWindow('trading')}>Trading</button>
            <button className="nav-btn" onClick={() => toggleWindow('tech')}>Tech Stack</button>
            <button className="nav-btn" onClick={() => toggleWindow('transparency')}>Transparency</button>
            <button className="nav-btn" onClick={() => toggleWindow('terminal')}>Terminal</button>
          </div>
          <div className="social-row"><a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer">Twitter</a><span className="sep">|</span><a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer">Telegram</a></div>
        </div>
      </Win>

      {/* Live Stats */}
      <Win id="stats" width={400}>
        <h2>Live System Stats</h2>
        {aiStats ? (<>
          <div className="stat-grid">
            <div className="stat-card"><div className="sc-icon">C</div><div className="sc-data"><span className="sc-val">{aiStats.confidence}%</span><span className="sc-lbl">Confidence</span><div className="sc-bar"><div style={{ width: `${aiStats.confidence}%` }}></div></div></div></div>
            <div className="stat-card"><div className="sc-icon">D</div><div className="sc-data"><span className="sc-val">{aiStats.dataPoints?.toLocaleString()}</span><span className="sc-lbl">Data Points</span></div></div>
            <div className="stat-card"><div className="sc-icon">T</div><div className="sc-data"><span className="sc-val">{aiStats.stats?.tokensTracked || 0}</span><span className="sc-lbl">Analyzed</span></div></div>
            <div className="stat-card"><div className="sc-icon">A</div><div className="sc-data"><span className="sc-val">{aiStats.aiAccuracy?.toFixed(1) || 0}%</span><span className="sc-lbl">Accuracy</span></div></div>
          </div>
          <div className="info-table">
            <div className="it-row"><span>Status</span><span className={aiStats.isRealData ? 'green' : 'yellow'}>{aiStats.isRealData ? 'LIVE' : 'LEARNING'}</span></div>
            <div className="it-row"><span>Data Source</span><span>{aiStats.dataSource || 'Birdeye'}</span></div>
            <div className="it-row"><span>Market</span><span className="cap">{aiStats.marketRegime || 'neutral'}</span></div>
            <div className="it-row"><span>AIs Online</span><span>{aiStats.availableAIs?.length || 0}/5</span></div>
            <div className="it-row"><span>Wallets Known</span><span>{aiStats.knownWallets || 0}</span></div>
            <div className="it-row"><span>Hot Narratives</span><span>{aiStats.hotNarratives?.join(', ') || 'None'}</span></div>
          </div>
          <div className="section-box"><h3>Learning Progress</h3>
            <div className="learn-row"><span className="green">Pumps: {aiStats.stats?.pumps || 0}</span><span className="red">Dumps: {aiStats.stats?.dumps || 0}</span><span>Neutral: {aiStats.stats?.neutral || 0}</span></div>
            <div className="learn-row"><span>Total Outcomes: {totalOutcomes}</span></div>
          </div>
        </>) : (<div className="loading"><div className="loader"></div><span>Connecting...</span></div>)}
      </Win>

      {/* The Experiment */}
      <Win id="experiment" width={520}>
        <h2>The Experiment</h2>
        <div className="exp-hero"><div className="exp-q">Can an AI learn to profitably trade memecoins?</div></div>
        <div className="exp-section"><h3>The Challenge</h3><p>Memecoin trading is one of the hardest problems in crypto:</p>
          <ul><li>Hundreds of new tokens launch daily</li><li>90%+ are scams or rugs</li><li>Opportunities last minutes, not hours</li><li>Information is scattered and unreliable</li><li>Emotions lead to bad decisions</li></ul>
        </div>
        <div className="exp-section"><h3>Our Approach</h3><p>Build an AI that can:</p>
          <ul><li>Process massive amounts of data in real-time</li><li>Use multiple AI models for diverse perspectives</li><li>Learn from every outcome (pump, dump, or neutral)</li><li>Continuously improve its prediction accuracy</li><li>Trade autonomously without emotion</li></ul>
        </div>
        <div className="exp-section"><h3>Revenue Model</h3>
          <div className="flow-diagram">
            <div className="fd-step"><div className="fd-icon">AI</div><div className="fd-text">Analyze</div></div><div className="fd-arrow">{'>'}</div>
            <div className="fd-step"><div className="fd-icon">T</div><div className="fd-text">Trade</div></div><div className="fd-arrow">{'>'}</div>
            <div className="fd-step"><div className="fd-icon">$</div><div className="fd-text">Profit</div></div><div className="fd-arrow">{'>'}</div>
            <div className="fd-step"><div className="fd-icon">B</div><div className="fd-text">Buyback</div></div>
          </div>
          <p className="fd-note">100% of trading profits buy TRADOR tokens. No taxes. Pure performance-based value.</p>
        </div>
      </Win>

      {/* AI Brain */}
      <Win id="brain" width={540}>
        <h2>The AI Brain</h2>
        <div className="brain-viz"><div className="bv-center">BRAIN</div>
          <div className="bv-nodes"><div className="bv-node n1">Gemini</div><div className="bv-node n2">GPT-4</div><div className="bv-node n3">Claude</div><div className="bv-node n4">Groq</div><div className="bv-node n5">Perplexity</div></div>
        </div>
        <div className="brain-section"><h3>Multi-AI Consensus</h3><p>5 different AI models analyze every token independently. Each has different training data, biases, and perspectives. They vote BUY/SELL/HOLD.</p>
          <div className="consensus-example"><div className="ce-header">How Voting Works:</div>
            <div className="ce-votes"><span className="vote buy">Gemini: BUY</span><span className="vote buy">GPT-4: BUY</span><span className="vote hold">Claude: HOLD</span><span className="vote buy">Groq: BUY</span><span className="vote sell">Perplexity: SELL</span></div>
            <div className="ce-result">60% BUY - Below 70% threshold - No trade</div>
          </div>
        </div>
        <div className="brain-section"><h3>Why 70% Threshold?</h3><p>We require strong consensus before trading. This means:</p>
          <ul><li>Fewer trades, but higher conviction</li><li>Filters out noise and weak signals</li><li>Reduces false positives significantly</li><li>Only acts when multiple AIs agree</li></ul>
        </div>
        <div className="brain-section"><h3>Current AI Status</h3>
          <div className="ai-status">{aiStats?.availableAIs?.map(ai => (<span key={ai} className="ai-online">{ai}</span>)) || 'Loading...'}</div>
        </div>
      </Win>

      {/* AI Decisions - Real-time */}
      <Win id="decisions" width={520}>
        <h2>Recent AI Decisions</h2>
        <p className="decisions-intro">Real-time view of what the AI is analyzing and deciding:</p>
        {recentDecisions.length > 0 ? (
          <div className="decisions-list">
            {recentDecisions.slice(0, 5).map((d, i) => (
              <div key={i} className="decision-item">
                <div className="di-header">
                  <span className="di-token">{d.token}</span>
                  <span className={`di-signal ${d.consensus?.toLowerCase()}`}>{d.consensus}</span>
                </div>
                <div className="di-details">
                  <span>Confidence: {d.confidence}%</span>
                  <span>Agreement: {d.agreement}%</span>
                  <span>AIs: {d.aiCount}</span>
                </div>
                <div className="di-votes">
                  <span className="dv buy">BUY: {d.votes?.buy || 0}</span>
                  <span className="dv sell">SELL: {d.votes?.sell || 0}</span>
                  <span className="dv hold">HOLD: {d.votes?.hold || 0}</span>
                </div>
                {d.analyses?.[0]?.reasoning && (
                  <div className="di-reasoning">{d.analyses[0].reasoning.slice(0, 150)}...</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-decisions">No recent decisions yet. AI is warming up...</div>
        )}
      </Win>

      {/* Self-Learning */}
      <Win id="learning" width={520}>
        <h2>Self-Learning System</h2>
        <div className="learn-cycle">
          <div className="lc-step"><div className="lc-num">1</div><div className="lc-content"><h4>Analyze</h4><p>60+ signals</p></div></div><div className="lc-arrow">{'>'}</div>
          <div className="lc-step"><div className="lc-num">2</div><div className="lc-content"><h4>Track</h4><p>30 minutes</p></div></div><div className="lc-arrow">{'>'}</div>
          <div className="lc-step"><div className="lc-num">3</div><div className="lc-content"><h4>Outcome</h4><p>Pump/Dump?</p></div></div><div className="lc-arrow">{'>'}</div>
          <div className="lc-step"><div className="lc-num">4</div><div className="lc-content"><h4>Learn</h4><p>Adjust weights</p></div></div>
        </div>
        <div className="learn-section"><h3>What Gets Learned</h3>
          <ul><li>Which signal combinations predict pumps vs dumps</li><li>Optimal market cap ranges for entry</li><li>Best times of day to trade</li><li>Which wallet patterns indicate smart money</li><li>Narrative strength correlations</li></ul>
        </div>
        <div className="learn-section"><h3>Top Predictive Signals</h3>
          <div className="top-signals">{aiStats?.topSignals?.slice(0, 5).map((s, i) => (<span key={i} className="signal-tag">{s}</span>)) || 'Still learning...'}</div>
        </div>
        <div className="learn-section"><h3>Current Learning Stats</h3>
          <div className="learn-stats">
            <div className="ls-item"><span className="ls-val">{aiStats?.stats?.tokensTracked || 0}</span><span className="ls-lbl">Tokens Analyzed</span></div>
            <div className="ls-item"><span className="ls-val">{totalOutcomes}</span><span className="ls-lbl">Outcomes Recorded</span></div>
            <div className="ls-item"><span className="ls-val">{aiStats?.aiAccuracy?.toFixed(1) || 0}%</span><span className="ls-lbl">Accuracy</span></div>
          </div>
        </div>
      </Win>

      {/* Trading System */}
      <Win id="trading" width={520}>
        <h2>Trading System</h2>
        <div className="trade-section"><h3>Trade Execution Flow</h3>
          <div className="trade-flow">
            <div className="tf-item"><div className="tf-num">1</div><div className="tf-text">New token detected on Pump.fun via Birdeye API</div></div>
            <div className="tf-item"><div className="tf-num">2</div><div className="tf-text">60+ signals analyzed (price, volume, holders, security, wallets, social)</div></div>
            <div className="tf-item"><div className="tf-num">3</div><div className="tf-text">All 5 AI models vote independently</div></div>
            <div className="tf-item"><div className="tf-num">4</div><div className="tf-text">70%+ consensus required to proceed</div></div>
            <div className="tf-item"><div className="tf-num">5</div><div className="tf-text">Position size calculated via Kelly Criterion</div></div>
            <div className="tf-item"><div className="tf-num">6</div><div className="tf-text">Trade executed via Jupiter aggregator for best price</div></div>
          </div>
        </div>
        <div className="trade-section"><h3>Risk Management</h3>
          <div className="risk-grid">
            <div className="rg-item"><div className="rg-icon">SL</div><div className="rg-text"><b>Stop Loss</b><span>Auto-exit at -15%</span></div></div>
            <div className="rg-item"><div className="rg-icon">TP</div><div className="rg-text"><b>Take Profit</b><span>Dynamic targets</span></div></div>
            <div className="rg-item"><div className="rg-icon">TS</div><div className="rg-text"><b>Trailing Stop</b><span>Lock in gains</span></div></div>
            <div className="rg-item"><div className="rg-icon">PH</div><div className="rg-text"><b>Portfolio Heat</b><span>Max exposure limits</span></div></div>
          </div>
        </div>
        <div className="trade-section"><h3>Security Checks (Before Every Trade)</h3>
          <ul><li>No mint authority (can't create more tokens)</li><li>No freeze authority (can't freeze wallets)</li><li>LP burned or locked</li><li>No known rugger wallets in top holders</li><li>Passes RugCheck verification</li><li>Passes GoPlus security scan</li></ul>
        </div>
      </Win>

      {/* Tech Stack */}
      <Win id="tech" width={500}>
        <h2>Technical Architecture</h2>
        <div className="tech-section">
          <h3>Data Sources</h3>
          <div className="tech-grid">
            <div className="tech-item"><b>Birdeye API</b><span>Real-time token data, prices, volume</span></div>
            <div className="tech-item"><b>Helius RPC</b><span>On-chain data, transactions, holders</span></div>
            <div className="tech-item"><b>Pump.fun</b><span>New token detection</span></div>
            <div className="tech-item"><b>RugCheck</b><span>Security verification</span></div>
            <div className="tech-item"><b>GoPlus</b><span>Contract security scanning</span></div>
          </div>
        </div>
        <div className="tech-section">
          <h3>AI Models</h3>
          <div className="tech-grid">
            <div className="tech-item"><b>Google Gemini</b><span>Fast analysis, good at patterns</span></div>
            <div className="tech-item"><b>OpenAI GPT-4</b><span>Deep reasoning, context understanding</span></div>
            <div className="tech-item"><b>Anthropic Claude</b><span>Careful analysis, risk assessment</span></div>
            <div className="tech-item"><b>Groq</b><span>Ultra-fast inference</span></div>
            <div className="tech-item"><b>Perplexity</b><span>Real-time information synthesis</span></div>
          </div>
        </div>
        <div className="tech-section">
          <h3>Infrastructure</h3>
          <div className="tech-grid">
            <div className="tech-item"><b>Google Cloud</b><span>Reliable, scalable hosting</span></div>
            <div className="tech-item"><b>Node.js</b><span>High-performance runtime</span></div>
            <div className="tech-item"><b>Jupiter</b><span>DEX aggregator for best prices</span></div>
          </div>
        </div>
        <div className="tech-section">
          <h3>Signal Categories (60+)</h3>
          <div className="signal-cats">
            <span>Price (12)</span><span>Volume (8)</span><span>Holders (10)</span><span>Security (8)</span><span>Wallets (12)</span><span>Social (6)</span><span>Time (4)</span>
          </div>
        </div>
      </Win>

      {/* Transparency */}
      <Win id="transparency" width={500}>
        <h2>Transparency</h2>
        <div className="trans-section">
          <h3>What's Public</h3>
          <ul>
            <li><b>All stats</b> - Real-time on this dashboard</li>
            <li><b>AI decisions</b> - See what the AI is analyzing</li>
            <li><b>Learning progress</b> - Watch accuracy improve</li>
            <li><b>Trade history</b> - All trades verifiable on-chain</li>
            <li><b>Buybacks</b> - All buybacks verifiable on-chain</li>
          </ul>
        </div>
        <div className="trans-section">
          <h3>No Hidden Mechanics</h3>
          <ul>
            <li>No transaction taxes</li>
            <li>No hidden fees</li>
            <li>No team token unlocks</li>
            <li>Revenue only from AI trading performance</li>
          </ul>
        </div>
        <div className="trans-section">
          <h3>Verifiable On-Chain</h3>
          <p>When trading goes live, you'll be able to verify:</p>
          <ul>
            <li>Every trade the AI makes</li>
            <li>Every profit/loss</li>
            <li>Every TRADOR buyback</li>
            <li>AI wallet holdings</li>
          </ul>
        </div>
        <div className="trans-section">
          <h3>Current System Status</h3>
          <div className="status-grid">
            <div className="sg-item"><span className="sg-label">Mode</span><span className="sg-value">{aiStats?.canVirtualTrade ? 'Virtual Trading' : 'Learning Only'}</span></div>
            <div className="sg-item"><span className="sg-label">Data</span><span className="sg-value">{aiStats?.isRealData ? 'Real (Birdeye)' : 'Synthetic'}</span></div>
            <div className="sg-item"><span className="sg-label">AIs</span><span className="sg-value">{aiStats?.availableAIs?.length || 0}/5 Online</span></div>
            <div className="sg-item"><span className="sg-label">Uptime</span><span className="sg-value green">Running</span></div>
          </div>
        </div>
      </Win>

      {/* Terminal */}
      <Win id="terminal" width={550}>
        <div className="terminal">
          <div className="term-header"><span>TRADOR Terminal</span><span className={aiStats ? 'status-on' : 'status-off'}>{aiStats ? 'CONNECTED' : 'OFFLINE'}</span></div>
          <div className="term-body">{logs.map((log, i) => <div key={i} className="term-line">{log}</div>)}<div className="term-line cursor">_</div></div>
        </div>
      </Win>

      {/* Taskbar */}
      <div className="taskbar">
        <button className="start" onClick={() => setStartMenuOpen(!startMenuOpen)}>Start</button>
        <div className="taskbar-wins">{windows.filter(w => w.open).map(w => (<button key={w.id} className={`taskbar-btn ${!w.minimized ? 'active' : ''}`} onClick={() => { setWindows(ws => ws.map(x => x.id === w.id ? { ...x, minimized: false } : x)); bringToFront(w.id); }}>{w.title}</button>))}</div>
        <div className="tray"><span className={`dot ${aiStats ? 'on' : ''}`}></span><span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>

      {startMenuOpen && (<div className="start-menu"><div className="sm-header">TRADOR</div>{windows.map(w => (<button key={w.id} className="sm-item" onClick={() => toggleWindow(w.id)}>{w.title}</button>))}<div className="sm-divider"></div><a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer" className="sm-item">Twitter</a><a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer" className="sm-item">Telegram</a></div>)}
    </div>
  );
}

export default App;
