import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'TRADOR', open: true, minimized: false, x: 50, y: 30, z: 10 },
    { id: 'terminal', title: 'Terminal', open: true, minimized: false, x: 520, y: 50, z: 9 },
    { id: 'positions', title: 'Positions', open: false, minimized: false, x: 100, y: 100, z: 8 },
    { id: 'performance', title: 'Performance', open: false, minimized: false, x: 150, y: 80, z: 7 },
    { id: 'buybacks', title: 'Buybacks', open: false, minimized: false, x: 200, y: 120, z: 6 },
    { id: 'whitepaper', title: 'Whitepaper', open: false, minimized: false, x: 80, y: 60, z: 5 },
    { id: 'architecture', title: 'Architecture', open: false, minimized: false, x: 250, y: 90, z: 4 },
    { id: 'signals', title: 'Signals', open: false, minimized: false, x: 300, y: 70, z: 3 },
    { id: 'roadmap', title: 'Roadmap', open: false, minimized: false, x: 350, y: 110, z: 2 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState(['> Initializing TRADOR AI...', '> Connecting to Solana mainnet...']);
  const [maxZ, setMaxZ] = useState(11);
  const dragRef = useRef(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [statusRes, posRes, tradesRes] = await Promise.all([
        fetch(`${API_URL}/api/status`).catch(() => null),
        fetch(`${API_URL}/api/positions`).catch(() => null),
        fetch(`${API_URL}/api/trades`).catch(() => null),
      ]);
      if (statusRes?.ok) {
        const data = await statusRes.json();
        setAiStats(data);
        addLog(`> Synced: ${data.dataPoints || 0} data points | ${data.trackedTokens || 0} tokens tracked`);
      }
      if (posRes?.ok) setPositions(await posRes.json());
      if (tradesRes?.ok) setTrades(await tradesRes.json());
    } catch (e) { addLog('> ERROR: API connection failed'); }
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(logs => [...logs.slice(-50), `[${time}] ${msg}`]);
  };

  const bringToFront = (id) => {
    setMaxZ(z => z + 1);
    setWindows(wins => wins.map(w => w.id === id ? { ...w, z: maxZ + 1 } : w));
  };

  const toggleWindow = (id) => {
    setWindows(wins => wins.map(w => w.id === id ? { ...w, open: !w.open, minimized: false } : w));
    bringToFront(id);
    setStartMenuOpen(false);
  };

  const minimizeWindow = (id) => setWindows(wins => wins.map(w => w.id === id ? { ...w, minimized: true } : w));
  const closeWindow = (id) => setWindows(wins => wins.map(w => w.id === id ? { ...w, open: false } : w));

  const startDrag = (e, id) => {
    if (e.target.closest('.window-btn')) return;
    bringToFront(id);
    const win = windows.find(w => w.id === id);
    dragRef.current = { id, startX: e.clientX - win.x, startY: e.clientY - win.y };
  };

  const onDrag = (e) => {
    if (!dragRef.current) return;
    const { id, startX, startY } = dragRef.current;
    setWindows(wins => wins.map(w => w.id === id ? { ...w, x: Math.max(0, e.clientX - startX), y: Math.max(0, e.clientY - startY) } : w));
  };

  const endDrag = () => { dragRef.current = null; };
  const getWindow = (id) => windows.find(w => w.id === id);

  const renderWindow = (id, content, width = 500) => {
    const win = getWindow(id);
    if (!win.open || win.minimized) return null;
    return (
      <div className="window" style={{ left: win.x, top: win.y, zIndex: win.z, width }} onMouseDown={() => bringToFront(id)}>
        <div className="window-header" onMouseDown={(e) => startDrag(e, id)}>
          <span className="window-title">{win.title}</span>
          <div className="window-controls">
            <button className="window-btn min" onClick={() => minimizeWindow(id)}>_</button>
            <button className="window-btn close" onClick={() => closeWindow(id)}>x</button>
          </div>
        </div>
        <div className="window-content">{content}</div>
      </div>
    );
  };

  const pnl = aiStats?.pnl || { daily: 0, weekly: 0, monthly: 0, allTime: 0 };
  const stats = aiStats?.stats || {};

  return (
    <div className="desktop" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
      {/* Desktop Icons */}
      <div className="desktop-icons">
        {windows.map(w => (
          <div key={w.id} className="desktop-icon" onDoubleClick={() => toggleWindow(w.id)}>
            <div className="icon-box">{w.title.charAt(0)}</div>
            <span>{w.title}</span>
          </div>
        ))}
      </div>

      {/* Welcome Window */}
      {renderWindow('welcome', (
        <div className="welcome">
          <h1 className="logo">TRADOR</h1>
          <p className="tagline">Self-Learning AI Trading System</p>
          <div className="welcome-stats">
            <div className="ws"><span className="wv">{aiStats?.aiModelsCount || 5}</span><span className="wl">AI MODELS</span></div>
            <div className="ws"><span className="wv">60+</span><span className="wl">SIGNALS</span></div>
            <div className="ws"><span className="wv">{aiStats?.dataPoints?.toLocaleString() || '0'}</span><span className="wl">DATA POINTS</span></div>
            <div className="ws status-box"><span className="wv">{aiStats?.isRealData ? 'LIVE' : 'LEARNING'}</span><span className="wl">STATUS</span></div>
          </div>
          <div className="welcome-desc">
            <p>TRADOR is an experimental AI that trades Solana memecoins on Pump.fun. Uses 5 AI models in consensus, analyzes 60+ signals per token, learns from every trade.</p>
            <p><strong>The play:</strong> AI makes money trading shitcoins. All profits buy back TRADOR. No taxes. Pure buyback pressure from trading gains. Number go up technology.</p>
          </div>
          <div className="welcome-btns">
            <button className="btn primary" onClick={() => toggleWindow('whitepaper')}>WHITEPAPER</button>
            <button className="btn" onClick={() => toggleWindow('terminal')}>TERMINAL</button>
            <button className="btn" onClick={() => toggleWindow('performance')}>STATS</button>
          </div>
        </div>
      ), 460)}

      {/* Terminal Window */}
      {renderWindow('terminal', (
        <div className="terminal">
          <div className="term-header">
            <span>TRADOR AI v1.0</span>
            <span className={`status ${aiStats ? 'online' : 'offline'}`}>{aiStats ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="term-body">
            {terminalLogs.map((log, i) => (
              <div key={i} className={`term-line ${log.includes('ERROR') ? 'error' : log.includes('TRADE') ? 'trade' : log.includes('PROFIT') ? 'profit' : ''}`}>{log}</div>
            ))}
          </div>
          <div className="term-input">
            <span className="prompt">trador@ai:~$</span>
            <span className="cursor">_</span>
          </div>
        </div>
      ), 550)}

      {/* Positions Window */}
      {renderWindow('positions', (
        <div className="positions">
          <h2>Active Positions</h2>
          {positions.length === 0 ? (
            <div className="empty">{aiStats?.canVirtualTrade ? 'No active positions. AI ready to trade.' : 'AI still learning. Collecting data before trading.'}</div>
          ) : (
            <div className="pos-list">
              {positions.map(p => (
                <div key={p.id} className="pos-item">
                  <div className="pos-header">
                    <span className="pos-symbol">{p.symbol}</span>
                    <span className={`pos-pnl ${p.pnlPercent >= 0 ? 'green' : 'red'}`}>{p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent?.toFixed(2)}%</span>
                  </div>
                  <div className="pos-details">
                    <span>Entry: ${p.entryPrice?.toFixed(8)}</span>
                    <span>Strategy: {p.strategy}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pos-summary">
            <span>Positions: {positions.length}</span>
            <span>Mode: {aiStats?.canVirtualTrade ? 'Virtual Trading' : 'Learning'}</span>
          </div>
        </div>
      ), 400)}

      {/* Performance Window */}
      {renderWindow('performance', (
        <div className="performance">
          <h2>Performance</h2>
          <div className="perf-grid">
            <div className="perf-card">
              <span className="perf-label">AI Confidence</span>
              <span className="perf-value">{aiStats?.confidence || 0}%</span>
              <div className="perf-bar"><div style={{ width: `${aiStats?.confidence || 0}%` }}></div></div>
            </div>
            <div className="perf-card">
              <span className="perf-label">Data Points</span>
              <span className="perf-value">{aiStats?.dataPoints?.toLocaleString() || 0}</span>
              <span className="perf-sub">need 5,000 for trading</span>
            </div>
            <div className="perf-card">
              <span className="perf-label">Tokens Tracked</span>
              <span className="perf-value">{aiStats?.trackedTokens || 0}</span>
              <span className="perf-sub">learning outcomes</span>
            </div>
            <div className="perf-card">
              <span className="perf-label">AI Accuracy</span>
              <span className="perf-value">{aiStats?.aiAccuracy?.toFixed(1) || 0}%</span>
              <span className="perf-sub">{aiStats?.aiPredictions || 0} predictions</span>
            </div>
          </div>
          <h3>PnL (Virtual)</h3>
          <div className="pnl-grid">
            <div className={`pnl-item ${pnl.daily >= 0 ? 'green' : 'red'}`}><span>24H</span><span>{pnl.daily >= 0 ? '+' : ''}{pnl.daily?.toFixed(2)}%</span></div>
            <div className={`pnl-item ${pnl.weekly >= 0 ? 'green' : 'red'}`}><span>7D</span><span>{pnl.weekly >= 0 ? '+' : ''}{pnl.weekly?.toFixed(2)}%</span></div>
            <div className={`pnl-item ${pnl.monthly >= 0 ? 'green' : 'red'}`}><span>30D</span><span>{pnl.monthly >= 0 ? '+' : ''}{pnl.monthly?.toFixed(2)}%</span></div>
            <div className={`pnl-item ${pnl.allTime >= 0 ? 'green' : 'red'}`}><span>ALL</span><span>{pnl.allTime >= 0 ? '+' : ''}{pnl.allTime?.toFixed(2)}%</span></div>
          </div>
          <h3>Trade Stats</h3>
          <div className="trade-stats">
            <span>Trades: {stats.totalVirtualTrades || 0}</span>
            <span>Wins: {stats.virtualWins || 0}</span>
            <span>Losses: {stats.virtualLosses || 0}</span>
            <span>Win Rate: {stats.totalVirtualTrades > 0 ? ((stats.virtualWins / stats.totalVirtualTrades) * 100).toFixed(1) : 0}%</span>
          </div>
          <h3>Learning</h3>
          <div className="learn-stats">
            <span>Pumps: {stats.pumps || 0}</span>
            <span>Dumps: {stats.dumps || 0}</span>
            <span>Neutral: {stats.neutral || 0}</span>
          </div>
        </div>
      ), 450)}

      {/* Buybacks Window */}
      {renderWindow('buybacks', (
        <div className="buybacks">
          <h2>Buyback System</h2>
          <div className="buyback-info">
            <p>All trading profits automatically buy TRADOR from the open market. No taxes. Revenue only from AI trading.</p>
          </div>
          <div className="buyback-stats">
            <div className="bb-stat"><span className="bb-label">Total Bought</span><span className="bb-value">$0</span><span className="bb-sub">waiting for launch</span></div>
            <div className="bb-stat"><span className="bb-label">TRADOR Bought</span><span className="bb-value">0</span><span className="bb-sub">tokens</span></div>
            <div className="bb-stat"><span className="bb-label">Avg Price</span><span className="bb-value">--</span><span className="bb-sub">USD</span></div>
          </div>
          <div className="bb-flow">
            <div className="bb-step">AI Trades</div>
            <div className="bb-arrow">→</div>
            <div className="bb-step">Profits</div>
            <div className="bb-arrow">→</div>
            <div className="bb-step">Buyback</div>
            <div className="bb-arrow">→</div>
            <div className="bb-step">Number Go Up</div>
          </div>
          <div className="bb-notice">
            <span>TOKEN NOT LAUNCHED</span>
            <p>Buybacks start after TRADOR launches on Pump.fun</p>
          </div>
        </div>
      ), 420)}

      {/* Whitepaper Window */}
      {renderWindow('whitepaper', (
        <div className="whitepaper">
          <h1>TRADOR Whitepaper</h1>
          <p className="wp-subtitle">A Self-Learning AI Trading System for Solana Memecoins</p>
          
          <section>
            <h2>1. Abstract</h2>
            <p>TRADOR is an experimental AI system that trades memecoins on Solana, specifically targeting Pump.fun tokens. The system uses multi-AI consensus (5 models voting together), analyzes 60+ signals per token, and learns from every trade outcome to improve over time.</p>
            <p>All profits are used to buy back TRADOR tokens. No transaction taxes. Pure buyback pressure from trading gains.</p>
          </section>

          <section>
            <h2>2. The Problem</h2>
            <p>Memecoin trading is hard:</p>
            <ul>
              <li>Hundreds of new tokens daily - impossible to analyze manually</li>
              <li>Most are rugs or scams - need sophisticated security analysis</li>
              <li>Opportunities last minutes - need automated execution</li>
              <li>Patterns exist but humans can't spot them consistently</li>
              <li>Emotions cause bad trades - FOMO, fear, greed</li>
            </ul>
          </section>

          <section>
            <h2>3. The Solution</h2>
            <h3>3.1 Multi-AI Consensus</h3>
            <p>Five AI models analyze every token independently:</p>
            <ul>
              <li><strong>Gemini</strong> - Pattern recognition</li>
              <li><strong>GPT-4</strong> - Market analysis</li>
              <li><strong>Claude</strong> - Risk assessment</li>
              <li><strong>Groq</strong> - Fast inference</li>
              <li><strong>Perplexity</strong> - Real-time news search</li>
            </ul>
            <p>Each AI votes BUY/SELL/HOLD. Trades only execute on 70%+ consensus. This filters out noise and reduces false signals.</p>

            <h3>3.2 Signal Analysis</h3>
            <p>60+ signals across 7 categories:</p>
            <table>
              <thead><tr><th>Category</th><th>What We Check</th></tr></thead>
              <tbody>
                <tr><td>Price</td><td>30m/1h/4h/24h changes, momentum, volatility</td></tr>
                <tr><td>Volume</td><td>Volume/MCap ratio, buy pressure, whale trades</td></tr>
                <tr><td>Holders</td><td>Count, distribution, concentration, growth</td></tr>
                <tr><td>Security</td><td>Mint auth, freeze auth, LP burned, rug score</td></tr>
                <tr><td>Wallets</td><td>Dev wallets, snipers, smart money, clusters</td></tr>
                <tr><td>Social</td><td>Narrative, viral potential, hype cycle</td></tr>
                <tr><td>Time</td><td>Token age, hour, day, market hours</td></tr>
              </tbody>
            </table>

            <h3>3.3 Self-Learning</h3>
            <p>The AI learns from every trade:</p>
            <ul>
              <li>Tracks every analyzed token for 30 minutes</li>
              <li>Records outcome: PUMP (20%+), DUMP (-20%+), or NEUTRAL</li>
              <li>Identifies which signals predict success vs failure</li>
              <li>Auto-optimizes strategy every 50 outcomes</li>
            </ul>
          </section>

          <section>
            <h2>4. Risk Management</h2>
            <ul>
              <li><strong>Position Sizing:</strong> Kelly Criterion based on win rate and confidence</li>
              <li><strong>Stop Loss:</strong> Auto-exit on price drop</li>
              <li><strong>Take Profit:</strong> Lock gains at targets</li>
              <li><strong>Trailing Stop:</strong> Follow price up, exit on reversal</li>
              <li><strong>Security Checks:</strong> No mint auth, no freeze, LP burned, no known ruggers</li>
            </ul>
          </section>

          <section>
            <h2>5. Revenue Model</h2>
            <p>Two revenue sources:</p>
            <ul>
              <li><strong>Pump.fun Creator Fees:</strong> Earned from platform fee structure</li>
              <li><strong>Trading Profits:</strong> Direct gains from successful trades</li>
            </ul>
            <p><strong>100% of profits buy TRADOR tokens.</strong> No taxes. All buybacks verifiable on-chain.</p>
          </section>

          <section>
            <h2>6. Technical Stack</h2>
            <ul>
              <li><strong>Data:</strong> Birdeye API, Helius RPC, Pump.fun API</li>
              <li><strong>AI:</strong> Gemini, GPT-4, Claude, Groq, Perplexity</li>
              <li><strong>Infra:</strong> Google Cloud VM, Node.js, PM2</li>
              <li><strong>Execution:</strong> Jupiter for swaps</li>
            </ul>
          </section>

          <section>
            <h2>7. Transparency</h2>
            <ul>
              <li>Public dashboard with real-time stats</li>
              <li>All trades verifiable on-chain</li>
              <li>All buybacks verifiable on-chain</li>
              <li>Open metrics: confidence, data points, win rate</li>
              <li>No hidden fees or taxes</li>
            </ul>
          </section>

          <section>
            <h2>8. Disclaimer</h2>
            <p>This is an experiment. AI trading is risky. Past performance doesn't guarantee future results. Only invest what you can afford to lose. DYOR. NFA.</p>
          </section>
        </div>
      ), 680)}

      {/* Architecture Window */}
      {renderWindow('architecture', (
        <div className="architecture">
          <h2>System Architecture</h2>
          <div className="arch-diagram">
            <div className="arch-layer data">
              <h3>DATA LAYER</h3>
              <div className="arch-items">
                <span>Birdeye</span><span>Helius</span><span>Pump.fun</span><span>Jupiter</span>
              </div>
            </div>
            <div className="arch-arrow">|</div>
            <div className="arch-layer analysis">
              <h3>ANALYSIS LAYER</h3>
              <div className="arch-items">
                <span>Price</span><span>Volume</span><span>Holders</span><span>Security</span><span>Wallets</span><span>Social</span>
              </div>
            </div>
            <div className="arch-arrow">|</div>
            <div className="arch-layer ai">
              <h3>AI LAYER</h3>
              <div className="arch-items">
                <span>Gemini</span><span>GPT-4</span><span>Claude</span><span>Groq</span><span>Perplexity</span>
              </div>
            </div>
            <div className="arch-arrow">|</div>
            <div className="arch-layer exec">
              <h3>EXECUTION LAYER</h3>
              <div className="arch-items">
                <span>Position Size</span><span>Trade</span><span>Risk Mgmt</span><span>Exit</span>
              </div>
            </div>
            <div className="arch-arrow">|</div>
            <div className="arch-layer learn">
              <h3>LEARNING LAYER</h3>
              <div className="arch-items">
                <span>Track Outcomes</span><span>Find Patterns</span><span>Optimize</span>
              </div>
            </div>
          </div>
          <div className="arch-stats">
            <div><strong>Scan:</strong> Every 60s</div>
            <div><strong>Analysis:</strong> ~2s per token</div>
            <div><strong>AI Response:</strong> ~1s per model</div>
            <div><strong>Learning:</strong> Every 50 outcomes</div>
          </div>
        </div>
      ), 480)}

      {/* Signals Window */}
      {renderWindow('signals', (
        <div className="signals">
          <h2>Signal Analysis</h2>
          <p className="sig-intro">60+ signals analyzed for every token:</p>
          
          <div className="sig-category">
            <h3>PRICE</h3>
            <p>30m/1h/4h/24h changes, momentum score, volatility, distance from ATH/ATL</p>
          </div>

          <div className="sig-category">
            <h3>VOLUME</h3>
            <p>Volume/MCap ratio, buy vs sell volume, whale trades, volume trend</p>
          </div>

          <div className="sig-category">
            <h3>HOLDERS</h3>
            <p>Total count, top 1/5/10 concentration, growth rate, distribution score</p>
          </div>

          <div className="sig-category">
            <h3>SECURITY</h3>
            <p>Mint authority, freeze authority, LP burn %, contract verification, RugCheck score</p>
          </div>

          <div className="sig-category">
            <h3>WALLETS</h3>
            <p>Dev wallets, sniper detection, smart money tracking, cluster analysis, known ruggers</p>
          </div>

          <div className="sig-category">
            <h3>SOCIAL</h3>
            <p>Narrative detection (AI/meme/animal), viral potential, hype cycle stage, sentiment</p>
          </div>

          <div className="sig-category">
            <h3>TIME</h3>
            <p>Token age, hour of day, day of week, US/Asia market hours</p>
          </div>
        </div>
      ), 420)}

      {/* Roadmap Window */}
      {renderWindow('roadmap', (
        <div className="roadmap-content">
          <h2>Roadmap</h2>
          <div className="rm-timeline">
            <div className="rm-phase completed">
              <div className="rm-marker">1</div>
              <div className="rm-content">
                <h3>AI Development</h3>
                <span className="rm-status done">DONE</span>
                <p>Multi-AI consensus, 60+ signals, self-learning, wallet intel, security scanning</p>
              </div>
            </div>
            <div className="rm-phase active">
              <div className="rm-marker">2</div>
              <div className="rm-content">
                <h3>Training</h3>
                <span className="rm-status current">NOW</span>
                <p>Collecting data, training patterns, virtual trading, optimization</p>
                <div className="rm-progress">
                  <div className="rm-bar"><div style={{ width: `${Math.min(100, (aiStats?.dataPoints || 0) / 50)}%` }}></div></div>
                  <span>{aiStats?.dataPoints || 0} / 5,000 data points</span>
                </div>
              </div>
            </div>
            <div className="rm-phase">
              <div className="rm-marker">3</div>
              <div className="rm-content">
                <h3>Launch</h3>
                <span className="rm-status">SOON</span>
                <p>TRADOR token on Pump.fun, community, socials</p>
              </div>
            </div>
            <div className="rm-phase">
              <div className="rm-marker">4</div>
              <div className="rm-content">
                <h3>Live Trading</h3>
                <span className="rm-status">FUTURE</span>
                <p>Real trades, automatic buybacks, continuous improvement</p>
              </div>
            </div>
          </div>
        </div>
      ), 450)}

      {/* Taskbar */}
      <div className="taskbar">
        <button className="start-btn" onClick={() => setStartMenuOpen(!startMenuOpen)}>
          TRADOR
        </button>
        <div className="taskbar-windows">
          {windows.filter(w => w.open).map(w => (
            <button key={w.id} className={`taskbar-item ${!w.minimized ? 'active' : ''}`}
              onClick={() => { setWindows(wins => wins.map(win => win.id === w.id ? { ...win, minimized: false } : win)); bringToFront(w.id); }}>
              {w.title}
            </button>
          ))}
        </div>
        <div className="taskbar-tray">
          <span className={`tray-dot ${aiStats ? 'online' : ''}`}></span>
          <span>{aiStats ? 'ONLINE' : 'OFFLINE'}</span>
          <span className="tray-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div className="start-menu">
          <div className="sm-header">TRADOR AI</div>
          <div className="sm-items">
            {windows.map(w => (
              <button key={w.id} className="sm-item" onClick={() => toggleWindow(w.id)}>
                {w.title}
              </button>
            ))}
          </div>
          <div className="sm-footer">
            <span>v1.0</span>
            <span>{aiStats?.dataPoints || 0} data points</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
