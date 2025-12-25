import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'TRADOR', open: true, minimized: false, x: 30, y: 25, z: 10 },
    { id: 'stats', title: 'Live Stats', open: true, minimized: false, x: 470, y: 25, z: 9 },
    { id: 'experiment', title: 'The Experiment', open: false, minimized: false, x: 80, y: 50, z: 8 },
    { id: 'brain', title: 'AI Brain', open: false, minimized: false, x: 100, y: 70, z: 7 },
    { id: 'learning', title: 'Self-Learning', open: false, minimized: false, x: 120, y: 45, z: 6 },
    { id: 'trading', title: 'Trading System', open: false, minimized: false, x: 140, y: 65, z: 5 },
    { id: 'signals', title: 'Signals', open: false, minimized: false, x: 160, y: 85, z: 4 },
    { id: 'terminal', title: 'Terminal', open: false, minimized: false, x: 180, y: 55, z: 3 },
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
        addLog(`Synced: ${data.dataPoints} data points | ${data.trackedTokens} tracked`);
      }
    } catch (e) { addLog('Reconnecting...'); }
  };

  const addLog = (msg) => setLogs(l => [...l.slice(-40), `[${new Date().toLocaleTimeString()}] ${msg}`]);
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
  const pumpRate = totalOutcomes > 0 ? ((aiStats?.stats?.pumps || 0) / totalOutcomes * 100).toFixed(1) : 0;

  return (
    <div className="desktop" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
      <div className="icons">
        {windows.map(w => (<div key={w.id} className="icon" onDoubleClick={() => toggleWindow(w.id)}><div className="icon-img">{w.title[0]}</div><span>{w.title}</span></div>))}
      </div>

      <Win id="welcome" width={440}>
        <div className="welcome">
          <div className="logo-box"><h1>TRADOR</h1><div className="logo-sub">Autonomous AI Trading Experiment</div></div>
          <div className="hero-stats">
            <div className="hs"><span className="hsv">{aiStats?.aiModelsCount || 5}</span><span className="hsl">AI Models</span></div>
            <div className="hs"><span className="hsv">60+</span><span className="hsl">Signals</span></div>
            <div className="hs"><span className="hsv">{aiStats?.dataPoints?.toLocaleString() || '0'}</span><span className="hsl">Data Points</span></div>
          </div>
          <div className="hero-desc"><p>A self-learning AI that trades Solana memecoins. 5 AI models vote together, analyze 60+ signals, and learn from every outcome.</p></div>
          <div className="status-badge"><span className={`sb-dot ${aiStats?.isRealData ? 'live' : ''}`}></span><span>{aiStats?.isRealData ? 'LIVE DATA' : 'LEARNING MODE'}</span></div>
          <div className="nav-grid">
            <button className="nav-btn" onClick={() => toggleWindow('experiment')}>The Experiment</button>
            <button className="nav-btn" onClick={() => toggleWindow('brain')}>AI Brain</button>
            <button className="nav-btn" onClick={() => toggleWindow('learning')}>Self-Learning</button>
            <button className="nav-btn" onClick={() => toggleWindow('trading')}>Trading System</button>
            <button className="nav-btn" onClick={() => toggleWindow('signals')}>Signals</button>
            <button className="nav-btn" onClick={() => toggleWindow('terminal')}>Terminal</button>
          </div>
          <div className="social-row"><a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer">Twitter</a><span className="sep">|</span><a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer">Telegram</a></div>
        </div>
      </Win>

      <Win id="stats" width={380}>
        <h2>Live System Stats</h2>
        {aiStats ? (<>
          <div className="stat-grid">
            <div className="stat-card"><div className="sc-icon">C</div><div className="sc-data"><span className="sc-val">{aiStats.confidence}%</span><span className="sc-lbl">Confidence</span><div className="sc-bar"><div style={{ width: `${aiStats.confidence}%` }}></div></div></div></div>
            <div className="stat-card"><div className="sc-icon">D</div><div className="sc-data"><span className="sc-val">{aiStats.dataPoints?.toLocaleString()}</span><span className="sc-lbl">Data Points</span></div></div>
            <div className="stat-card"><div className="sc-icon">T</div><div className="sc-data"><span className="sc-val">{aiStats.trackedTokens || 0}</span><span className="sc-lbl">Tracked</span></div></div>
            <div className="stat-card"><div className="sc-icon">A</div><div className="sc-data"><span className="sc-val">{aiStats.aiAccuracy?.toFixed(1) || 0}%</span><span className="sc-lbl">Accuracy</span></div></div>
          </div>
          <div className="info-table">
            <div className="it-row"><span>Status</span><span className={aiStats.isRealData ? 'green' : 'yellow'}>{aiStats.isRealData ? 'LIVE' : 'LEARNING'}</span></div>
            <div className="it-row"><span>Source</span><span>{aiStats.dataSource || 'Birdeye'}</span></div>
            <div className="it-row"><span>Regime</span><span className="cap">{aiStats.marketRegime || 'neutral'}</span></div>
            <div className="it-row"><span>AIs</span><span>{aiStats.availableAIs?.join(', ') || 'Loading'}</span></div>
          </div>
          <div className="section-box"><h3>Learning</h3>
            <div className="outcome-viz"><div className="ov-bar"><div className="ov-pump" style={{width: `${pumpRate}%`}}></div></div>
            <div className="ov-labels"><span className="green">Pumps: {aiStats.stats?.pumps || 0}</span><span className="red">Dumps: {aiStats.stats?.dumps || 0}</span><span>Neutral: {aiStats.stats?.neutral || 0}</span></div></div>
          </div>
        </>) : (<div className="loading"><div className="loader"></div><span>Connecting...</span></div>)}
      </Win>

      <Win id="experiment" width={520}>
        <h2>The Experiment</h2>
        <div className="exp-hero"><div className="exp-q">Can an AI learn to profitably trade memecoins?</div></div>
        <div className="exp-section"><h3>What We're Building</h3><p>TRADOR is an experiment in autonomous AI trading:</p>
          <ul><li>Analyzes hundreds of new tokens daily on Pump.fun</li><li>Uses 5 AI models for consensus decisions</li><li>Learns from every outcome to improve</li><li>Trades autonomously based on patterns</li></ul>
        </div>
        <div className="exp-section"><h3>Why This Matters</h3><p>Memecoin trading is chaos. Tokens pump and dump in minutes. Most are scams. If an AI can learn to navigate this profitably, it proves something about ML in adversarial environments.</p></div>
        <div className="exp-section"><h3>Revenue Model</h3>
          <div className="flow-diagram">
            <div className="fd-step"><div className="fd-icon">AI</div><div className="fd-text">Analyze</div></div><div className="fd-arrow">{'>'}</div>
            <div className="fd-step"><div className="fd-icon">T</div><div className="fd-text">Trade</div></div><div className="fd-arrow">{'>'}</div>
            <div className="fd-step"><div className="fd-icon">$</div><div className="fd-text">Profit</div></div><div className="fd-arrow">{'>'}</div>
            <div className="fd-step"><div className="fd-icon">B</div><div className="fd-text">Buyback</div></div>
          </div>
          <p className="fd-note">100% of profits buy TRADOR. No taxes. Pure performance.</p>
        </div>
      </Win>

      <Win id="brain" width={540}>
        <h2>The AI Brain</h2>
        <div className="brain-viz"><div className="bv-center">BRAIN</div>
          <div className="bv-nodes"><div className="bv-node n1">Gemini</div><div className="bv-node n2">GPT-4</div><div className="bv-node n3">Claude</div><div className="bv-node n4">Groq</div><div className="bv-node n5">Perplexity</div></div>
        </div>
        <div className="brain-section"><h3>Multi-AI Consensus</h3><p>5 different AI models analyze tokens independently. They vote BUY/SELL/HOLD. Only 70%+ consensus triggers trades.</p>
          <div className="consensus-example"><div className="ce-header">Example:</div>
            <div className="ce-votes"><span className="vote buy">Gemini: BUY</span><span className="vote buy">GPT-4: BUY</span><span className="vote hold">Claude: HOLD</span><span className="vote buy">Groq: BUY</span><span className="vote buy">Perplexity: BUY</span></div>
            <div className="ce-result">80% BUY - Trade executes</div>
          </div>
        </div>
        <div className="brain-section"><h3>Why Multiple AIs?</h3><ul><li>Reduces individual model bias</li><li>Filters out noise</li><li>Catches edge cases</li><li>Redundancy if one fails</li></ul></div>
      </Win>

      <Win id="learning" width={520}>
        <h2>Self-Learning System</h2>
        <div className="learn-cycle">
          <div className="lc-step"><div className="lc-num">1</div><div className="lc-content"><h4>Analyze</h4><p>60+ signals</p></div></div><div className="lc-arrow">{'>'}</div>
          <div className="lc-step"><div className="lc-num">2</div><div className="lc-content"><h4>Track</h4><p>30 minutes</p></div></div><div className="lc-arrow">{'>'}</div>
          <div className="lc-step"><div className="lc-num">3</div><div className="lc-content"><h4>Outcome</h4><p>Pump/Dump?</p></div></div><div className="lc-arrow">{'>'}</div>
          <div className="lc-step"><div className="lc-num">4</div><div className="lc-content"><h4>Learn</h4><p>Adjust weights</p></div></div>
        </div>
        <div className="learn-section"><h3>What It Learns</h3><ul><li>Signal combinations that predict pumps</li><li>Optimal entry timing</li><li>Market cap sweet spots</li><li>Smart money wallet patterns</li><li>Time-of-day effects</li></ul></div>
        <div className="learn-section"><h3>Current Stats</h3>
          <div className="learn-stats"><div className="ls-item"><span className="ls-val">{aiStats?.stats?.pumps || 0}</span><span className="ls-lbl">Pumps</span></div><div className="ls-item"><span className="ls-val">{aiStats?.stats?.dumps || 0}</span><span className="ls-lbl">Dumps</span></div><div className="ls-item"><span className="ls-val">{aiStats?.aiAccuracy?.toFixed(1) || 0}%</span><span className="ls-lbl">Accuracy</span></div></div>
        </div>
      </Win>

      <Win id="trading" width={520}>
        <h2>Trading System</h2>
        <div className="trade-section"><h3>Trade Flow</h3>
          <div className="trade-flow">
            <div className="tf-item"><div className="tf-num">1</div><div className="tf-text">New token on Pump.fun</div></div>
            <div className="tf-item"><div className="tf-num">2</div><div className="tf-text">60+ signals analyzed</div></div>
            <div className="tf-item"><div className="tf-num">3</div><div className="tf-text">5 AIs vote</div></div>
            <div className="tf-item"><div className="tf-num">4</div><div className="tf-text">70%+ consensus to trade</div></div>
            <div className="tf-item"><div className="tf-num">5</div><div className="tf-text">Kelly Criterion sizing</div></div>
            <div className="tf-item"><div className="tf-num">6</div><div className="tf-text">Execute via Jupiter</div></div>
          </div>
        </div>
        <div className="trade-section"><h3>Risk Management</h3>
          <div className="risk-grid">
            <div className="rg-item"><div className="rg-icon">SL</div><div className="rg-text"><b>Stop Loss</b><span>Auto-exit at -15%</span></div></div>
            <div className="rg-item"><div className="rg-icon">TP</div><div className="rg-text"><b>Take Profit</b><span>Lock gains</span></div></div>
            <div className="rg-item"><div className="rg-icon">TS</div><div className="rg-text"><b>Trailing</b><span>Protect profits</span></div></div>
            <div className="rg-item"><div className="rg-icon">PH</div><div className="rg-text"><b>Heat</b><span>Limit exposure</span></div></div>
          </div>
        </div>
        <div className="trade-section"><h3>Security</h3><ul><li>No mint authority</li><li>No freeze authority</li><li>LP burned/locked</li><li>RugCheck + GoPlus</li></ul></div>
      </Win>

      <Win id="signals" width={500}>
        <h2>60+ Signal Analysis</h2>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">$</span><h3>Price</h3></div><p>Momentum, volatility, RSI, MACD, multi-timeframe</p></div>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">V</span><h3>Volume</h3></div><p>Buy/sell pressure, whale activity, volume spikes</p></div>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">H</span><h3>Holders</h3></div><p>Concentration, distribution, growth rate</p></div>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">S</span><h3>Security</h3></div><p>Mint/freeze auth, LP status, RugCheck</p></div>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">W</span><h3>Wallets</h3></div><p>Dev detection, snipers, smart money, clusters</p></div>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">N</span><h3>Social</h3></div><p>Narrative, viral potential, hype cycle</p></div>
        <div className="sig-category"><div className="sig-header"><span className="sig-icon">T</span><h3>Time</h3></div><p>Token age, market hours, regime</p></div>
      </Win>

      <Win id="terminal" width={550}>
        <div className="terminal">
          <div className="term-header"><span>TRADOR Terminal</span><span className={aiStats ? 'status-on' : 'status-off'}>{aiStats ? 'CONNECTED' : 'OFFLINE'}</span></div>
          <div className="term-body">{logs.map((log, i) => <div key={i} className="term-line">{log}</div>)}<div className="term-line cursor">_</div></div>
        </div>
      </Win>

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
