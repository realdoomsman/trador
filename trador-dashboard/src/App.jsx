import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'Welcome', open: true, minimized: false, x: 40, y: 30, z: 10 },
    { id: 'stats', title: 'Live Stats', open: true, minimized: false, x: 480, y: 30, z: 9 },
    { id: 'howitworks', title: 'How It Works', open: false, minimized: false, x: 100, y: 60, z: 8 },
    { id: 'signals', title: 'Signal Analysis', open: false, minimized: false, x: 120, y: 80, z: 7 },
    { id: 'whitepaper', title: 'Whitepaper', open: false, minimized: false, x: 140, y: 50, z: 6 },
    { id: 'terminal', title: 'Terminal', open: false, minimized: false, x: 160, y: 70, z: 5 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [logs, setLogs] = useState(['Connecting to TRADOR AI...']);
  const [maxZ, setMaxZ] = useState(11);
  const dragRef = useRef(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(\`\${API_URL}/api/status\`);
      if (res.ok) {
        const data = await res.json();
        setAiStats(data);
        addLog(\`Synced: \${data.dataPoints} data points | \${data.trackedTokens} tokens tracked\`);
      }
    } catch (e) { 
      addLog('Connection retry...');
    }
  };

  const addLog = (msg) => {
    setLogs(l => [...l.slice(-50), \`[\${new Date().toLocaleTimeString()}] \${msg}\`]);
  };

  const bringToFront = (id) => {
    setMaxZ(z => z + 1);
    setWindows(w => w.map(win => win.id === id ? { ...win, z: maxZ + 1 } : win));
  };

  const toggleWindow = (id) => {
    setWindows(w => w.map(win => win.id === id ? { ...win, open: !win.open, minimized: false } : win));
    bringToFront(id);
    setStartMenuOpen(false);
  };

  const startDrag = (e, id) => {
    if (e.target.closest('.win-btn')) return;
    bringToFront(id);
    const win = windows.find(w => w.id === id);
    dragRef.current = { id, startX: e.clientX - win.x, startY: e.clientY - win.y };
  };

  const onDrag = (e) => {
    if (!dragRef.current) return;
    const { id, startX, startY } = dragRef.current;
    setWindows(w => w.map(win => win.id === id ? { ...win, x: Math.max(0, e.clientX - startX), y: Math.max(0, e.clientY - startY) } : win));
  };

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

  return (
    <div className="desktop" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
      <div className="icons">
        {windows.map(w => (
          <div key={w.id} className="icon" onDoubleClick={() => toggleWindow(w.id)}>
            <div className="icon-img"></div>
            <span>{w.title}</span>
          </div>
        ))}
      </div>

      <Win id="welcome" width={460}>
        <div className="welcome">
          <h1>TRADOR</h1>
          <p className="sub">Self-Learning AI Trading System on Solana</p>
          <div className="welcome-grid">
            <div className="wg-item"><span className="wg-val">{aiStats?.aiModelsCount || 5}</span><span className="wg-lbl">AI Models</span></div>
            <div className="wg-item"><span className="wg-val">60+</span><span className="wg-lbl">Signals</span></div>
            <div className="wg-item"><span className="wg-val">{aiStats?.dataPoints?.toLocaleString() || '0'}</span><span className="wg-lbl">Data Points</span></div>
          </div>
          <p>An autonomous AI that trades Solana memecoins. 5 AI models vote together, analyzes 60+ signals per token, learns from every outcome.</p>
          <p><b>Revenue Model:</b> 100% of AI trading profits buy back TRADOR tokens. No taxes. Pure buyback pressure from real performance.</p>
          <div className="welcome-btns">
            <button className="btn98 primary" onClick={() => toggleWindow('howitworks')}>How It Works</button>
            <button className="btn98" onClick={() => toggleWindow('signals')}>Signals</button>
            <button className="btn98" onClick={() => toggleWindow('whitepaper')}>Whitepaper</button>
          </div>
          <div className="social-links">
            <a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer">Telegram</a>
          </div>
        </div>
      </Win>

      <Win id="stats" width={400}>
        <h2>Live AI Stats</h2>
        {aiStats ? (
          <>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-val">{aiStats.confidence}%</span>
                <span className="stat-lbl">AI Confidence</span>
                <div className="stat-bar"><div style={{ width: \`\${aiStats.confidence}%\` }}></div></div>
              </div>
              <div className="stat-item">
                <span className="stat-val">{aiStats.dataPoints?.toLocaleString()}</span>
                <span className="stat-lbl">Data Points</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{aiStats.trackedTokens || 0}</span>
                <span className="stat-lbl">Tokens Tracked</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{aiStats.aiAccuracy?.toFixed(1) || 0}%</span>
                <span className="stat-lbl">AI Accuracy</span>
              </div>
            </div>
            <div className="stat-row"><span>Status</span><b style={{color: aiStats.isRealData ? '#0a0' : '#aa0'}}>{aiStats.isRealData ? 'LIVE' : 'LEARNING'}</b></div>
            <div className="stat-row"><span>Data Source</span><b>{aiStats.dataSource || 'Birdeye'}</b></div>
            <div className="stat-row"><span>Market Regime</span><b>{aiStats.marketRegime || 'neutral'}</b></div>
            <div className="stat-row"><span>AIs Online</span><b>{aiStats.availableAIs?.join(', ') || 'Loading...'}</b></div>
            <div className="stat-section">
              <h3>Learning Progress</h3>
              <div className="mini-stats">
                <span>Pumps: {aiStats.stats?.pumps || 0}</span>
                <span>Dumps: {aiStats.stats?.dumps || 0}</span>
                <span>Neutral: {aiStats.stats?.neutral || 0}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="loading">Connecting to AI...</div>
        )}
      </Win>

      <Win id="howitworks" width={520}>
        <h2>How TRADOR Works</h2>
        <div className="section">
          <h3>Multi-AI Consensus</h3>
          <p>5 different AI models analyze every token independently. They vote BUY/SELL/HOLD. Trades only execute when 70%+ agree.</p>
          <div className="ai-list">
            <span>Gemini</span><span>GPT-4</span><span>Claude</span><span>Groq</span><span>Perplexity</span>
          </div>
        </div>
        <div className="section">
          <h3>Deep Analysis</h3>
          <p>Every token gets analyzed across 60+ signals including price momentum, volume patterns, holder distribution, security checks, wallet intelligence, and social signals.</p>
        </div>
        <div className="section">
          <h3>Self-Learning</h3>
          <p>The AI tracks every token it analyzes. After 30 minutes, it checks the outcome. It learns which signal combinations predict success and continuously optimizes.</p>
        </div>
        <div className="section">
          <h3>Wallet Intelligence</h3>
          <p>Tracks dev wallets, snipers, whales, and smart money. Detects coordinated buying patterns and cluster activity.</p>
        </div>
        <div className="section">
          <h3>Buyback Mechanism</h3>
          <p>All trading profits automatically buy TRADOR from the open market. No taxes. Revenue comes purely from AI performance.</p>
          <div className="flow">
            <span>AI Trades</span><span className="arrow">{'>'}</span><span>Profits</span><span className="arrow">{'>'}</span><span>Buy TRADOR</span>
          </div>
        </div>
      </Win>

      <Win id="signals" width={500}>
        <h2>60+ Signal Analysis</h2>
        <p className="intro">Every token is analyzed across these categories:</p>
        <div className="signal-cat"><h3>Price Signals</h3><p>Momentum, volatility, trend direction, RSI, MACD, support/resistance, multi-timeframe analysis</p></div>
        <div className="signal-cat"><h3>Volume Signals</h3><p>Buy/sell pressure, whale activity, volume spikes, volume-to-mcap ratio</p></div>
        <div className="signal-cat"><h3>Holder Analysis</h3><p>Top holder concentration, distribution score, holder growth rate, whale percentage</p></div>
        <div className="signal-cat"><h3>Security Checks</h3><p>Mint authority, freeze authority, LP burn status, RugCheck and GoPlus integration</p></div>
        <div className="signal-cat"><h3>Wallet Intelligence</h3><p>Dev wallet detection, sniper tracking, smart money flow, cluster analysis, rugger detection</p></div>
        <div className="signal-cat"><h3>Social Signals</h3><p>Narrative strength, viral coefficient, hype cycle stage, pump-and-dump detection</p></div>
        <div className="signal-cat"><h3>Time Context</h3><p>Token age, market hours, day-of-week patterns, trading session detection</p></div>
      </Win>

      <Win id="whitepaper" width={600}>
        <div className="wp">
          <h1>TRADOR Whitepaper</h1>
          <h2>Abstract</h2>
          <p>TRADOR is an experimental autonomous trading system using multiple AI models to trade Solana memecoins. It learns from every outcome and continuously optimizes. Revenue comes purely from trading performance.</p>
          <h2>The Problem</h2>
          <p>Memecoin trading is chaotic. Hundreds of tokens launch daily. Most are scams. Opportunities last minutes. Humans can't process it all and emotions cause bad decisions.</p>
          <h2>Multi-AI Consensus</h2>
          <p>Five AI models independently analyze each token and vote. Only 70%+ consensus triggers trades. This reduces false signals dramatically.</p>
          <h2>Signal Analysis</h2>
          <p>60+ signals across price, volume, holders, security, wallets, social, and time context are analyzed for every token.</p>
          <h2>Self-Learning</h2>
          <p>Every token is tracked for 30 minutes. The AI learns which signals predict pumps vs dumps and adjusts weights continuously.</p>
          <h2>Risk Management</h2>
          <ul>
            <li>Kelly Criterion position sizing</li>
            <li>Automatic stop-loss and take-profit</li>
            <li>Trailing stops</li>
            <li>Security verification</li>
            <li>Portfolio heat monitoring</li>
          </ul>
          <h2>Revenue Model</h2>
          <p>100% of trading profits buy TRADOR tokens. No taxes. All buybacks verifiable on-chain.</p>
          <h2>Tech Stack</h2>
          <p>Birdeye API, Helius RPC, Gemini/GPT-4/Claude/Groq/Perplexity, Jupiter aggregator, Google Cloud</p>
          <p className="disclaimer"><b>Disclaimer:</b> Experimental project. Trading is risky. DYOR. NFA.</p>
        </div>
      </Win>

      <Win id="terminal" width={550}>
        <div className="terminal">
          <div className="term-header">
            <span>TRADOR Terminal v1.0</span>
            <span className={aiStats ? 'status-on' : 'status-off'}>{aiStats ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>
          <div className="term-body">
            {logs.map((log, i) => <div key={i} className="term-line">{log}</div>)}
            <div className="term-line blink">_</div>
          </div>
        </div>
      </Win>

      <div className="taskbar">
        <button className="start" onClick={() => setStartMenuOpen(!startMenuOpen)}>Start</button>
        <div className="taskbar-wins">
          {windows.filter(w => w.open).map(w => (
            <button key={w.id} className={\`taskbar-btn \${!w.minimized ? 'active' : ''}\`}
              onClick={() => { setWindows(ws => ws.map(x => x.id === w.id ? { ...x, minimized: false } : x)); bringToFront(w.id); }}>
              {w.title}
            </button>
          ))}
        </div>
        <div className="tray">
          <span className={\`dot \${aiStats ? 'on' : ''}\`}></span>
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {startMenuOpen && (
        <div className="start-menu">
          <div className="sm-header">TRADOR</div>
          {windows.map(w => (
            <button key={w.id} className="sm-item" onClick={() => toggleWindow(w.id)}>{w.title}</button>
          ))}
          <div className="sm-divider"></div>
          <a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer" className="sm-item">Twitter</a>
          <a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer" className="sm-item">Telegram</a>
        </div>
      )}
    </div>
  );
}

export default App;
