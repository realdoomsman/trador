import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'Welcome', open: true, minimized: false, x: 40, y: 30, z: 10 },
    { id: 'stats', title: 'Live Stats', open: true, minimized: false, x: 480, y: 30, z: 9 },
    { id: 'howitworks', title: 'How It Works', open: false, minimized: false, x: 100, y: 60, z: 8 },
    { id: 'whitepaper', title: 'Whitepaper', open: false, minimized: false, x: 120, y: 80, z: 7 },
    { id: 'tokenomics', title: 'Tokenomics', open: false, minimized: false, x: 140, y: 50, z: 6 },
    { id: 'contracts', title: 'Contracts', open: false, minimized: false, x: 160, y: 70, z: 5 },
    { id: 'terminal', title: 'Terminal', open: false, minimized: false, x: 180, y: 90, z: 4 },
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
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setAiStats(data);
        addLog(`Synced: ${data.dataPoints} data points | ${data.trackedTokens} tokens tracked`);
      }
    } catch (e) { 
      addLog('Connection retry...');
    }
  };

  const addLog = (msg) => {
    setLogs(l => [...l.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addLog('Copied to clipboard');
  };

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

  // Contract addresses (placeholder - update when deployed)
  const CONTRACT = 'TBD - Launching Soon';
  const PAIR = 'TBD';
  const AI_WALLET = 'TBD';

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
            <button className="btn98" onClick={() => toggleWindow('tokenomics')}>Tokenomics</button>
            <button className="btn98" onClick={() => toggleWindow('contracts')}>Contracts</button>
          </div>
          <div className="social-links">
            <a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer">Chart</a>
          </div>
        </div>
      </Win>

      {/* Live Stats */}
      <Win id="stats" width={400}>
        <h2>Live AI Stats</h2>
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
              <span>Status</span>
              <b style={{color: aiStats.isRealData ? '#0a0' : '#aa0'}}>{aiStats.isRealData ? 'LIVE' : 'LEARNING'}</b>
            </div>
            <div className="stat-row">
              <span>Data Source</span>
              <b>{aiStats.dataSource || 'Birdeye'}</b>
            </div>
            <div className="stat-row">
              <span>Market Regime</span>
              <b>{aiStats.marketRegime || 'neutral'}</b>
            </div>
            <div className="stat-row">
              <span>AIs Online</span>
              <b>{aiStats.availableAIs?.join(', ') || 'Loading...'}</b>
            </div>
            <div className="stat-section">
              <h3>Learning Stats</h3>
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

      {/* How It Works */}
      <Win id="howitworks" width={520}>
        <h2>How TRADOR Works</h2>
        <div className="section">
          <h3>Multi-AI Consensus</h3>
          <p>5 different AI models analyze every token independently. They vote BUY/SELL/HOLD. Trades only execute when 70%+ agree. This filters out noise and reduces false signals.</p>
          <div className="ai-list">
            <span>Gemini</span><span>GPT-4</span><span>Claude</span><span>Groq</span><span>Perplexity</span>
          </div>
        </div>
        <div className="section">
          <h3>60+ Signal Analysis</h3>
          <p>Every token gets deep analysis across multiple categories:</p>
          <ul>
            <li><b>Price:</b> Momentum, volatility, trend direction, support/resistance</li>
            <li><b>Volume:</b> Buy/sell pressure, whale activity, volume spikes</li>
            <li><b>Holders:</b> Distribution, concentration, growth rate</li>
            <li><b>Security:</b> Mint authority, freeze, LP burn status</li>
            <li><b>Wallets:</b> Dev detection, sniper tracking, smart money</li>
            <li><b>Social:</b> Narrative strength, viral potential, hype cycle</li>
          </ul>
        </div>
        <div className="section">
          <h3>Self-Learning</h3>
          <p>The AI tracks every token it analyzes. After 30 minutes, it checks the outcome (pump/dump/neutral). It learns which signal combinations predict success and continuously optimizes.</p>
        </div>
        <div className="section">
          <h3>Buyback Mechanism</h3>
          <p>All trading profits automatically buy TRADOR from the open market. No transaction taxes. Revenue comes purely from AI trading performance.</p>
          <div className="flow">
            <span>AI Trades</span>
            <span className="arrow">{'>'}</span>
            <span>Profits</span>
            <span className="arrow">{'>'}</span>
            <span>Buy TRADOR</span>
            <span className="arrow">{'>'}</span>
            <span>Burn/Hold</span>
          </div>
        </div>
      </Win>

      {/* Tokenomics */}
      <Win id="tokenomics" width={480}>
        <h2>Tokenomics</h2>
        <div className="token-info">
          <div className="token-row">
            <span>Total Supply</span>
            <b>1,000,000,000 TRADOR</b>
          </div>
          <div className="token-row">
            <span>Tax</span>
            <b>0% Buy / 0% Sell</b>
          </div>
          <div className="token-row">
            <span>LP</span>
            <b>Burned</b>
          </div>
          <div className="token-row">
            <span>Contract</span>
            <b>Renounced</b>
          </div>
        </div>
        
        <h3>Distribution</h3>
        <div className="distribution">
          <div className="dist-item">
            <div className="dist-bar" style={{width: '90%'}}></div>
            <span>90% - Liquidity Pool</span>
          </div>
          <div className="dist-item">
            <div className="dist-bar" style={{width: '5%'}}></div>
            <span>5% - AI Trading Wallet</span>
          </div>
          <div className="dist-item">
            <div className="dist-bar" style={{width: '5%'}}></div>
            <span>5% - Development</span>
          </div>
        </div>

        <h3>Revenue Flow</h3>
        <p>The AI trades with its allocated wallet. All profits are used to:</p>
        <ul>
          <li>Buy TRADOR from open market (creates buy pressure)</li>
          <li>Tokens bought are either burned or held in treasury</li>
          <li>No team tokens dumping - dev allocation is vested</li>
        </ul>
        
        <div className="highlight-box">
          <b>Why 0% Tax?</b>
          <p>Revenue comes from AI performance, not taxes. This means better trading experience and the project only succeeds if the AI performs well.</p>
        </div>
      </Win>

      {/* Contracts */}
      <Win id="contracts" width={500}>
        <h2>Contract Addresses</h2>
        <div className="contract-section">
          <h3>TRADOR Token</h3>
          <div className="contract-box" onClick={() => copyToClipboard(CONTRACT)}>
            <code>{CONTRACT}</code>
            <span className="copy-hint">Click to copy</span>
          </div>
        </div>
        
        <div className="contract-section">
          <h3>AI Trading Wallet</h3>
          <div className="contract-box" onClick={() => copyToClipboard(AI_WALLET)}>
            <code>{AI_WALLET}</code>
            <span className="copy-hint">Click to copy</span>
          </div>
          <p className="contract-note">All trades from this wallet are verifiable on-chain</p>
        </div>

        <h3>Verification</h3>
        <div className="verify-links">
          <a href="#" className="verify-btn">Solscan</a>
          <a href="#" className="verify-btn">Birdeye</a>
          <a href="#" className="verify-btn">DexScreener</a>
          <a href="#" className="verify-btn">RugCheck</a>
        </div>

        <div className="security-info">
          <h3>Security</h3>
          <ul>
            <li>LP tokens burned - liquidity locked forever</li>
            <li>Contract ownership renounced</li>
            <li>No mint function - supply is fixed</li>
            <li>No freeze authority</li>
            <li>Open source AI code on GitHub</li>
          </ul>
        </div>
      </Win>

      {/* Whitepaper */}
      <Win id="whitepaper" width={600}>
        <div className="wp">
          <h1>TRADOR Whitepaper</h1>
          
          <h2>Abstract</h2>
          <p>TRADOR is an experimental autonomous trading system that uses multiple AI models to trade Solana memecoins. Unlike typical trading bots, TRADOR learns from every trade outcome and continuously optimizes its strategy. Revenue is generated purely from trading performance, with all profits used to buy back the native token.</p>
          
          <h2>The Problem</h2>
          <p>Memecoin trading is chaotic. Hundreds of new tokens launch daily on Pump.fun. Most are scams or rugs. Opportunities last minutes. Humans can't process the volume of data needed, and emotions lead to poor decisions. Existing bots use static rules that don't adapt.</p>
          
          <h2>The Solution</h2>
          
          <h3>Multi-AI Consensus</h3>
          <p>Five AI models (Gemini, GPT-4, Claude, Groq, Perplexity) independently analyze each token. They vote on whether to trade. Only strong consensus (70%+) triggers execution. This dramatically reduces false signals and provides diverse analytical perspectives.</p>
          
          <h3>Signal Analysis</h3>
          <p>60+ signals across 7 categories are analyzed for every token:</p>
          <ul>
            <li><b>Price Signals:</b> Momentum, volatility, trend direction, RSI, MACD patterns</li>
            <li><b>Volume Signals:</b> Buy/sell pressure, whale activity, volume anomalies</li>
            <li><b>Holder Signals:</b> Distribution score, concentration risk, growth rate</li>
            <li><b>Security Signals:</b> Mint authority, freeze authority, LP status, metadata</li>
            <li><b>Wallet Intelligence:</b> Dev wallet detection, sniper tracking, smart money flow</li>
            <li><b>Social Signals:</b> Narrative strength, viral coefficient, hype cycle stage</li>
            <li><b>Time Signals:</b> Token age, market hours, day-of-week patterns</li>
          </ul>
          
          <h3>Self-Learning System</h3>
          <p>Every analyzed token is tracked for 30 minutes. The AI records whether it pumped (20%+), dumped (-20%+), or stayed neutral. It identifies which signal combinations predict success and continuously adjusts signal weights. The system gets smarter with every data point.</p>
          
          <h2>Risk Management</h2>
          <ul>
            <li>Position sizing via Kelly Criterion</li>
            <li>Automatic stop-loss and take-profit levels</li>
            <li>Trailing stops to lock in gains</li>
            <li>Security verification before every trade</li>
            <li>Portfolio heat monitoring</li>
            <li>Market regime detection (bull/bear/neutral)</li>
          </ul>
          
          <h2>Revenue Model</h2>
          <p>TRADOR generates revenue from trading profits only. 100% of profits are used to buy TRADOR tokens from the open market. No transaction taxes. All buybacks are verifiable on-chain. The project succeeds only if the AI performs well.</p>
          
          <h2>Technical Architecture</h2>
          <ul>
            <li><b>Data Layer:</b> Birdeye API, Helius RPC, Pump.fun websocket</li>
            <li><b>AI Layer:</b> Gemini, GPT-4, Claude, Groq, Perplexity</li>
            <li><b>Analysis:</b> Custom analytics engine with 60+ signals</li>
            <li><b>Execution:</b> Jupiter aggregator for best prices</li>
            <li><b>Infrastructure:</b> Google Cloud, Node.js, real-time processing</li>
          </ul>
          
          <h2>Transparency</h2>
          <p>All stats are public via the dashboard. All trades are verifiable on-chain. All buybacks are verifiable on-chain. AI code is open source. No hidden fees or mechanics.</p>
          
          <p className="disclaimer"><b>Disclaimer:</b> This is an experimental project. Cryptocurrency trading involves significant risk. Past performance does not guarantee future results. Do your own research. This is not financial advice.</p>
        </div>
      </Win>

      {/* Terminal */}
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
          <div className="sm-divider"></div>
          <a href="https://twitter.com/tradorai" target="_blank" rel="noopener noreferrer" className="sm-item">Twitter</a>
          <a href="https://t.me/tradorai" target="_blank" rel="noopener noreferrer" className="sm-item">Telegram</a>
        </div>
      )}
    </div>
  );
}

export default App;
