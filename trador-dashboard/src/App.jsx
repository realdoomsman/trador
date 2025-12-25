import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'Welcome', open: true, minimized: false, x: 60, y: 40, z: 10 },
    { id: 'howitworks', title: 'How It Works', open: false, minimized: false, x: 120, y: 70, z: 9 },
    { id: 'stats', title: 'Live Stats', open: true, minimized: false, x: 500, y: 50, z: 8 },
    { id: 'whitepaper', title: 'Whitepaper', open: false, minimized: false, x: 150, y: 90, z: 7 },
    { id: 'terminal', title: 'Terminal', open: false, minimized: false, x: 200, y: 60, z: 6 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [logs, setLogs] = useState(['Connecting to TRADOR AI...']);
  const [maxZ, setMaxZ] = useState(11);
  const dragRef = useRef(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setAiStats(data);
        addLog(`Synced: ${data.dataPoints} data points collected`);
      }
    } catch (e) { 
      addLog('Connection failed - retrying...');
    }
  };

  const addLog = (msg) => {
    setLogs(l => [...l.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
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
      {/* Desktop Icons */}
      <div className="icons">
        {windows.map(w => (
          <div key={w.id} className="icon" onDoubleClick={() => toggleWindow(w.id)}>
            <div className="icon-img"></div>
            <span>{w.title}</span>
          </div>
        ))}
      </div>

      {/* Welcome */}
      <Win id="welcome" width={440}>
        <div className="welcome">
          <h1>TRADOR</h1>
          <p className="sub">Self-Learning AI Trading Experiment</p>
          <div className="welcome-grid">
            <div className="wg-item"><span className="wg-val">{aiStats?.aiModelsCount || 5}</span><span className="wg-lbl">AI Models</span></div>
            <div className="wg-item"><span className="wg-val">60+</span><span className="wg-lbl">Signals</span></div>
            <div className="wg-item"><span className="wg-val">{aiStats?.dataPoints?.toLocaleString() || '0'}</span><span className="wg-lbl">Data Points</span></div>
          </div>
          <p>An AI that trades Solana memecoins on Pump.fun. 5 AI models vote together, analyzes 60+ signals per token, learns from every outcome.</p>
          <p><b>The model:</b> AI profits from trading go to buying TRADOR. No taxes. Pure buyback pressure.</p>
          <div className="welcome-btns">
            <button className="btn98 primary" onClick={() => toggleWindow('howitworks')}>How It Works</button>
            <button className="btn98" onClick={() => toggleWindow('whitepaper')}>Whitepaper</button>
          </div>
        </div>
      </Win>

      {/* How It Works */}
      <Win id="howitworks" width={500}>
        <h2>How TRADOR Works</h2>
        <div className="section">
          <h3>Multi-AI Consensus</h3>
          <p>5 different AI models analyze every token independently. They vote BUY/SELL/HOLD. Trades only happen when 70%+ agree. This filters out noise.</p>
          <div className="ai-list">
            <span>Gemini</span><span>GPT-4</span><span>Claude</span><span>Groq</span><span>Perplexity</span>
          </div>
        </div>
        <div className="section">
          <h3>60+ Signal Analysis</h3>
          <p>Every token gets analyzed across price momentum, volume patterns, holder distribution, security checks, wallet intelligence, and social signals.</p>
        </div>
        <div className="section">
          <h3>Self-Learning</h3>
          <p>The AI tracks every token it analyzes. After 30 minutes, it checks if it pumped or dumped. It learns which signals predict success and adjusts its strategy.</p>
        </div>
        <div className="section">
          <h3>Buyback System</h3>
          <p>All trading profits automatically buy TRADOR tokens. No transaction taxes. Revenue only from AI trading performance.</p>
          <div className="flow">
            <span>AI Trades</span>
            <span className="arrow">{'>'}</span>
            <span>Profits</span>
            <span className="arrow">{'>'}</span>
            <span>Buyback TRADOR</span>
          </div>
        </div>
      </Win>

      {/* Live Stats */}
      <Win id="stats" width={380}>
        <h2>Live Stats</h2>
        {aiStats ? (
          <>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-val">{aiStats.confidence}%</span>
                <span className="stat-lbl">AI Confidence</span>
                <div className="stat-bar"><div style={{ width: `${aiStats.confidence}%` }}></div></div>
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
            <div className="stat-row">
              <span>Status: <b style={{color: aiStats.isRealData ? '#0a0' : '#aa0'}}>{aiStats.isRealData ? 'LIVE DATA' : 'LEARNING'}</b></span>
              <span>Source: <b>{aiStats.dataSource || 'API'}</b></span>
            </div>
            <div className="stat-row">
              <span>AIs Online: <b>{aiStats.availableAIs?.join(', ') || 'Loading...'}</b></span>
            </div>
          </>
        ) : (
          <div className="loading">Connecting to AI...</div>
        )}
      </Win>

      {/* Whitepaper */}
      <Win id="whitepaper" width={600}>
        <div className="wp">
          <h1>TRADOR Whitepaper</h1>
          
          <h2>What Is TRADOR</h2>
          <p>TRADOR is an experimental AI system that trades memecoins on Solana's Pump.fun platform. It uses multiple AI models working together, analyzes dozens of signals per token, and continuously learns from trade outcomes.</p>
          
          <h2>The Problem</h2>
          <p>Memecoin trading is chaotic. Hundreds of new tokens launch daily. Most are scams. Opportunities last minutes. Humans can't process it all and emotions cause bad decisions.</p>
          
          <h2>The Solution</h2>
          <h3>Multi-AI Consensus</h3>
          <p>Five AI models (Gemini, GPT-4, Claude, Groq, Perplexity) independently analyze each token. They vote on whether to trade. Only strong consensus (70%+) triggers execution. This dramatically reduces false signals.</p>
          
          <h3>Signal Analysis</h3>
          <p>60+ signals across 7 categories:</p>
          <ul>
            <li><b>Price:</b> Momentum, volatility, trend direction</li>
            <li><b>Volume:</b> Buy/sell pressure, whale activity</li>
            <li><b>Holders:</b> Distribution, concentration, growth</li>
            <li><b>Security:</b> Mint authority, freeze, LP status</li>
            <li><b>Wallets:</b> Dev detection, sniper tracking, smart money</li>
            <li><b>Social:</b> Narrative, viral potential, hype cycle</li>
            <li><b>Time:</b> Token age, market hours, day patterns</li>
          </ul>
          
          <h3>Self-Learning</h3>
          <p>Every analyzed token is tracked for 30 minutes. The AI records whether it pumped (20%+), dumped (-20%+), or stayed neutral. It identifies which signal combinations predict success and continuously optimizes its strategy.</p>
          
          <h2>Risk Management</h2>
          <ul>
            <li>Position sizing via Kelly Criterion</li>
            <li>Automatic stop-loss and take-profit</li>
            <li>Trailing stops to lock in gains</li>
            <li>Security verification before every trade</li>
            <li>Portfolio heat monitoring</li>
          </ul>
          
          <h2>Revenue Model</h2>
          <p>TRADOR generates revenue from Pump.fun creator fees and trading profits. 100% of profits are used to buy TRADOR tokens from the open market. No transaction taxes. All buybacks are verifiable on-chain.</p>
          
          <h2>Technical Stack</h2>
          <ul>
            <li><b>Data:</b> Birdeye API, Helius RPC, Pump.fun</li>
            <li><b>AI:</b> Gemini, GPT-4, Claude, Groq, Perplexity</li>
            <li><b>Execution:</b> Jupiter aggregator</li>
            <li><b>Infrastructure:</b> Google Cloud, Node.js</li>
          </ul>
          
          <h2>Transparency</h2>
          <p>All stats are public. All trades verifiable on-chain. All buybacks verifiable on-chain. No hidden fees.</p>
          
          <p className="disclaimer"><b>Disclaimer:</b> This is an experiment. Trading is risky. Past performance doesn't guarantee future results. DYOR. NFA.</p>
        </div>
      </Win>

      {/* Terminal */}
      <Win id="terminal" width={500}>
        <div className="terminal">
          <div className="term-header">TRADOR Terminal v1.0 - {aiStats ? 'CONNECTED' : 'OFFLINE'}</div>
          <div className="term-body">
            {logs.map((log, i) => <div key={i} className="term-line">{log}</div>)}
          </div>
        </div>
      </Win>

      {/* Taskbar */}
      <div className="taskbar">
        <button className="start" onClick={() => setStartMenuOpen(!startMenuOpen)}>Start</button>
        <div className="taskbar-wins">
          {windows.filter(w => w.open).map(w => (
            <button key={w.id} className={`taskbar-btn ${!w.minimized ? 'active' : ''}`}
              onClick={() => { setWindows(ws => ws.map(x => x.id === w.id ? { ...x, minimized: false } : x)); bringToFront(w.id); }}>
              {w.title}
            </button>
          ))}
        </div>
        <div className="tray">
          <span className={`dot ${aiStats ? 'on' : ''}`}></span>
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div className="start-menu">
          <div className="sm-header">TRADOR</div>
          {windows.map(w => (
            <button key={w.id} className="sm-item" onClick={() => toggleWindow(w.id)}>{w.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
