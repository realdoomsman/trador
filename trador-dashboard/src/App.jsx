import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'Welcome.exe', open: true, minimized: false, x: 50, y: 30, z: 10 },
    { id: 'terminal', title: 'Terminal.exe', open: true, minimized: false, x: 500, y: 50, z: 9 },
    { id: 'positions', title: 'Positions.exe', open: false, minimized: false, x: 100, y: 100, z: 8 },
    { id: 'performance', title: 'Performance.exe', open: false, minimized: false, x: 150, y: 80, z: 7 },
    { id: 'buybacks', title: 'Buybacks.exe', open: false, minimized: false, x: 200, y: 120, z: 6 },
    { id: 'whitepaper', title: 'Whitepaper.exe', open: false, minimized: false, x: 80, y: 60, z: 5 },
    { id: 'architecture', title: 'Architecture.exe', open: false, minimized: false, x: 250, y: 90, z: 4 },
    { id: 'signals', title: 'Signals.exe', open: false, minimized: false, x: 300, y: 70, z: 3 },
    { id: 'roadmap', title: 'Roadmap.exe', open: false, minimized: false, x: 350, y: 110, z: 2 },
    { id: 'socials', title: 'Socials.exe', open: false, minimized: false, x: 400, y: 80, z: 1 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState(['[SYSTEM] Initializing TRADOR AI...', '[SYSTEM] Connecting to Solana mainnet...']);
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
        addLog(`[DATA] Fetched ${data.dataPoints || 0} data points | ${data.trackedTokens || 0} tokens tracked`);
      }
      if (posRes?.ok) setPositions(await posRes.json());
      if (tradesRes?.ok) setTrades(await tradesRes.json());
    } catch (e) { addLog('[ERROR] API connection failed'); }
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
          <span className="window-title">📁 {win.title}</span>
          <div className="window-controls">
            <button className="window-btn min" onClick={() => minimizeWindow(id)}>−</button>
            <button className="window-btn close" onClick={() => closeWindow(id)}>×</button>
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
            <div className="icon-img">{w.id === 'terminal' ? '💻' : w.id === 'whitepaper' ? '📄' : w.id === 'performance' ? '📈' : '📁'}</div>
            <span>{w.title.replace('.exe', '')}</span>
          </div>
        ))}
      </div>

      {/* Welcome Window */}
      {renderWindow('welcome', (
        <div className="welcome">
          <h1 className="logo">🤖 TRADOR</h1>
          <p className="tagline">The Self-Learning AI Trading Experiment</p>
          <div className="welcome-stats">
            <div className="ws"><span className="wv">{aiStats?.aiModelsCount || 5}</span><span className="wl">AI Models</span></div>
            <div className="ws"><span className="wv">60+</span><span className="wl">Signals</span></div>
            <div className="ws"><span className="wv">{aiStats?.dataPoints?.toLocaleString() || '0'}</span><span className="wl">Data Points</span></div>
            <div className="ws"><span className="wv">{aiStats?.isRealData ? '🟢' : '🟡'}</span><span className="wl">{aiStats?.isRealData ? 'Live' : 'Learning'}</span></div>
          </div>
          <p className="desc">TRADOR is an experimental AI that trades Solana memecoins on Pump.fun. It uses 5 AI models working in consensus, analyzes 60+ signals per token, and learns from every trade to improve over time.</p>
          <p className="desc"><strong>Revenue Model:</strong> All profits from Pump.fun creator fees and trading are used to buy back TRADOR tokens. No taxes - pure buyback pressure from AI profits.</p>
          <div className="welcome-btns">
            <button className="btn primary" onClick={() => toggleWindow('whitepaper')}>📄 Whitepaper</button>
            <button className="btn" onClick={() => toggleWindow('terminal')}>💻 Terminal</button>
            <button className="btn" onClick={() => toggleWindow('performance')}>📈 Stats</button>
          </div>
        </div>
      ), 450)}

      {/* Terminal Window */}
      {renderWindow('terminal', (
        <div className="terminal">
          <div className="term-header">
            <span>TRADOR AI Terminal v1.0</span>
            <span className={`status ${aiStats ? 'online' : 'offline'}`}>{aiStats ? '● ONLINE' : '○ OFFLINE'}</span>
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
          <h2>📊 Active Positions</h2>
          {positions.length === 0 ? (
            <div className="empty">No active positions. AI is {aiStats?.canVirtualTrade ? 'ready to trade' : 'still learning'}.</div>
          ) : (
            <div className="pos-list">
              {positions.map(p => (
                <div key={p.id} className="pos-item">
                  <div className="pos-header">
                    <span className="pos-symbol">{p.symbol}</span>
                    <span className={`pos-pnl ${p.pnlPercent >= 0 ? 'green' : 'red'}`}>{p.pnlPercent?.toFixed(2)}%</span>
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
            <span>Total Positions: {positions.length}</span>
            <span>Virtual Mode: {aiStats?.canVirtualTrade ? '✓' : '✗'}</span>
          </div>
        </div>
      ), 400)}

      {/* Performance Window */}
      {renderWindow('performance', (
        <div className="performance">
          <h2>📈 Performance & Stats</h2>
          <div className="perf-grid">
            <div className="perf-card">
              <span className="perf-label">AI Confidence</span>
              <span className="perf-value">{aiStats?.confidence || 0}%</span>
              <div className="perf-bar"><div style={{ width: `${aiStats?.confidence || 0}%` }}></div></div>
            </div>
            <div className="perf-card">
              <span className="perf-label">Data Points</span>
              <span className="perf-value">{aiStats?.dataPoints?.toLocaleString() || 0}</span>
              <span className="perf-sub">Target: 5,000 for trading</span>
            </div>
            <div className="perf-card">
              <span className="perf-label">Tokens Tracked</span>
              <span className="perf-value">{aiStats?.trackedTokens || 0}</span>
              <span className="perf-sub">Learning outcomes</span>
            </div>
            <div className="perf-card">
              <span className="perf-label">AI Accuracy</span>
              <span className="perf-value">{aiStats?.aiAccuracy?.toFixed(1) || 0}%</span>
              <span className="perf-sub">{aiStats?.aiPredictions || 0} predictions</span>
            </div>
          </div>
          <h3>PnL (Virtual Trading)</h3>
          <div className="pnl-grid">
            <div className={`pnl-item ${pnl.daily >= 0 ? 'green' : 'red'}`}><span>Daily</span><span>{pnl.daily >= 0 ? '+' : ''}{pnl.daily?.toFixed(2)}%</span></div>
            <div className={`pnl-item ${pnl.weekly >= 0 ? 'green' : 'red'}`}><span>Weekly</span><span>{pnl.weekly >= 0 ? '+' : ''}{pnl.weekly?.toFixed(2)}%</span></div>
            <div className={`pnl-item ${pnl.monthly >= 0 ? 'green' : 'red'}`}><span>Monthly</span><span>{pnl.monthly >= 0 ? '+' : ''}{pnl.monthly?.toFixed(2)}%</span></div>
            <div className={`pnl-item ${pnl.allTime >= 0 ? 'green' : 'red'}`}><span>All Time</span><span>{pnl.allTime >= 0 ? '+' : ''}{pnl.allTime?.toFixed(2)}%</span></div>
          </div>
          <h3>Trade Stats</h3>
          <div className="trade-stats">
            <span>Total Trades: {stats.totalVirtualTrades || 0}</span>
            <span>Wins: {stats.virtualWins || 0}</span>
            <span>Losses: {stats.virtualLosses || 0}</span>
            <span>Win Rate: {stats.totalVirtualTrades > 0 ? ((stats.virtualWins / stats.totalVirtualTrades) * 100).toFixed(1) : 0}%</span>
          </div>
          <h3>Learning Stats</h3>
          <div className="learn-stats">
            <span>Pumps Detected: {stats.pumps || 0}</span>
            <span>Dumps Detected: {stats.dumps || 0}</span>
            <span>Neutral: {stats.neutral || 0}</span>
          </div>
        </div>
      ), 450)}

      {/* Buybacks Window */}
      {renderWindow('buybacks', (
        <div className="buybacks">
          <h2>💰 Buyback Tracker</h2>
          <div className="buyback-info">
            <p>All trading profits are automatically used to buy TRADOR tokens from the open market.</p>
          </div>
          <div className="buyback-stats">
            <div className="bb-stat"><span className="bb-label">Total Buybacks</span><span className="bb-value">$0.00</span><span className="bb-sub">Waiting for launch</span></div>
            <div className="bb-stat"><span className="bb-label">Tokens Bought</span><span className="bb-value">0</span><span className="bb-sub">TRADOR</span></div>
            <div className="bb-stat"><span className="bb-label">Avg Buy Price</span><span className="bb-value">--</span><span className="bb-sub">USD</span></div>
          </div>
          <div className="bb-flow">
            <div className="bb-step">🤖 AI Trades</div>
            <div className="bb-arrow">→</div>
            <div className="bb-step">💵 Profits</div>
            <div className="bb-arrow">→</div>
            <div className="bb-step">🔄 Buyback</div>
            <div className="bb-arrow">→</div>
            <div className="bb-step">📈 Price Support</div>
          </div>
          <div className="bb-notice">
            <span>🚀 Token not launched yet</span>
            <p>Buybacks will begin after TRADOR launches on Pump.fun</p>
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
            <p>TRADOR is an experimental artificial intelligence system designed to trade memecoins on the Solana blockchain, specifically targeting tokens launched on Pump.fun. The system employs a multi-AI consensus mechanism, analyzes over 60 distinct signals per token, and continuously learns from trade outcomes to improve its decision-making over time.</p>
            <p>Unlike traditional trading bots that rely on fixed rules, TRADOR adapts its strategy based on real market data, identifying patterns that lead to profitable trades and avoiding those that result in losses. All profits generated are used to buy back TRADOR tokens, creating sustained buy pressure without requiring transaction taxes.</p>
          </section>

          <section>
            <h2>2. Problem Statement</h2>
            <p>The memecoin market on Solana presents unique challenges:</p>
            <ul>
              <li><strong>Information Overload:</strong> Hundreds of new tokens launch daily on Pump.fun, making manual analysis impossible</li>
              <li><strong>High Rug Risk:</strong> Many tokens are created with malicious intent, requiring sophisticated security analysis</li>
              <li><strong>Speed Requirements:</strong> Profitable opportunities often last minutes, requiring automated execution</li>
              <li><strong>Pattern Recognition:</strong> Successful tokens share common characteristics that are difficult for humans to identify consistently</li>
              <li><strong>Emotional Trading:</strong> Human traders often make poor decisions based on FOMO or fear</li>
            </ul>
          </section>

          <section>
            <h2>3. Solution: Multi-AI Consensus Trading</h2>
            <p>TRADOR addresses these challenges through a sophisticated AI architecture:</p>
            
            <h3>3.1 Multi-AI Consensus Engine</h3>
            <p>Rather than relying on a single AI model, TRADOR employs five different AI systems that independently analyze each token:</p>
            <ul>
              <li><strong>Google Gemini:</strong> Advanced reasoning and pattern recognition</li>
              <li><strong>OpenAI GPT-4:</strong> Comprehensive market analysis</li>
              <li><strong>Anthropic Claude:</strong> Risk assessment and safety analysis</li>
              <li><strong>Groq (Llama):</strong> Fast inference for time-sensitive decisions</li>
              <li><strong>Perplexity:</strong> Real-time web search for news and sentiment</li>
            </ul>
            <p>Each AI votes on whether to BUY, SELL, or HOLD. Trades are only executed when there is strong consensus (70%+ agreement) among the models, significantly reducing false signals.</p>

            <h3>3.2 Signal Analysis (60+ Signals)</h3>
            <p>Every token is analyzed across multiple dimensions:</p>
            <table>
              <thead><tr><th>Category</th><th>Signals</th><th>Purpose</th></tr></thead>
              <tbody>
                <tr><td>Price</td><td>30m, 1h, 4h, 24h changes, momentum, volatility</td><td>Trend identification</td></tr>
                <tr><td>Volume</td><td>Volume/MCap ratio, buy/sell pressure, whale trades</td><td>Interest measurement</td></tr>
                <tr><td>Holders</td><td>Count, distribution, concentration, growth rate</td><td>Community health</td></tr>
                <tr><td>Security</td><td>Mint authority, freeze, LP burned, rug score</td><td>Risk assessment</td></tr>
                <tr><td>Wallets</td><td>Dev wallets, snipers, smart money, clusters</td><td>Insider detection</td></tr>
                <tr><td>Social</td><td>Narrative, viral potential, hype cycle</td><td>Sentiment analysis</td></tr>
                <tr><td>Time</td><td>Hour, day, market hours, token age</td><td>Timing optimization</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>4. Self-Learning System</h2>
            <p>TRADOR's core innovation is its ability to learn from every trade outcome:</p>
            
            <h3>4.1 Outcome Tracking</h3>
            <p>Every analyzed token is tracked for 30 minutes after initial analysis. The system records:</p>
            <ul>
              <li>Entry price and all signal values at time of analysis</li>
              <li>Price movement over the tracking period</li>
              <li>Final outcome classification: PUMP (20%+), DUMP (-20%+), or NEUTRAL</li>
            </ul>

            <h3>4.2 Pattern Recognition</h3>
            <p>The learning engine identifies which signal combinations correlate with successful outcomes:</p>
            <ul>
              <li>Signals that predict pumps are weighted higher in future analyses</li>
              <li>Signals that predict dumps trigger automatic avoidance</li>
              <li>The system continuously refines its understanding of market patterns</li>
            </ul>

            <h3>4.3 Strategy Optimization</h3>
            <p>Every 50 outcomes, the system runs auto-optimization:</p>
            <ul>
              <li>Recalculates signal weights based on recent performance</li>
              <li>Adjusts confidence thresholds for trade execution</li>
              <li>Updates risk parameters based on market conditions</li>
            </ul>
          </section>

          <section>
            <h2>5. Risk Management</h2>
            <p>TRADOR employs multiple layers of risk management:</p>
            
            <h3>5.1 Position Sizing</h3>
            <p>Uses Kelly Criterion to calculate optimal position sizes based on:</p>
            <ul>
              <li>Historical win rate</li>
              <li>Average win/loss percentages</li>
              <li>Current AI confidence level</li>
            </ul>

            <h3>5.2 Dynamic Exits</h3>
            <ul>
              <li><strong>Stop Loss:</strong> Automatically exits if price drops below threshold</li>
              <li><strong>Take Profit:</strong> Locks in gains at predetermined levels</li>
              <li><strong>Trailing Stop:</strong> Follows price up, locks in profits on reversal</li>
              <li><strong>Time Limit:</strong> Exits positions after maximum hold time</li>
            </ul>

            <h3>5.3 Portfolio Heat</h3>
            <p>Monitors total portfolio exposure and reduces position sizes when risk is elevated.</p>

            <h3>5.4 Security Checks</h3>
            <p>Before any trade, the system verifies:</p>
            <ul>
              <li>No mint authority (can't create more tokens)</li>
              <li>No freeze authority (can't freeze wallets)</li>
              <li>LP is burned or locked</li>
              <li>No coordinated wallet clusters</li>
              <li>No known rugger wallets</li>
            </ul>
          </section>

          <section>
            <h2>6. Revenue Model</h2>
            <p>TRADOR generates revenue through two mechanisms:</p>
            
            <h3>6.1 Pump.fun Creator Fees</h3>
            <p>When TRADOR creates tokens on Pump.fun as part of its trading strategy, it earns creator fees from the platform's fee structure.</p>

            <h3>6.2 Trading Profits</h3>
            <p>Successful trades generate direct profits from price appreciation.</p>

            <h3>6.3 Buyback Mechanism</h3>
            <p>100% of all profits are used to purchase TRADOR tokens from the open market:</p>
            <ul>
              <li>No transaction taxes on TRADOR token</li>
              <li>Buybacks create constant buy pressure</li>
              <li>More successful trades = more buybacks</li>
              <li>All buyback transactions are publicly verifiable on-chain</li>
            </ul>
          </section>

          <section>
            <h2>7. Technical Architecture</h2>
            
            <h3>7.1 Data Sources</h3>
            <ul>
              <li><strong>Birdeye API:</strong> Real-time token data, prices, volume, holder info</li>
              <li><strong>Helius RPC:</strong> On-chain data, transaction history, wallet analysis</li>
              <li><strong>Pump.fun API:</strong> New token launches, bonding curve data</li>
              <li><strong>Jupiter:</strong> Price feeds and swap execution</li>
            </ul>

            <h3>7.2 Processing Pipeline</h3>
            <ol>
              <li><strong>Scan:</strong> Fetch new tokens from Pump.fun every 60 seconds</li>
              <li><strong>Filter:</strong> Apply basic filters (market cap, liquidity, age)</li>
              <li><strong>Analyze:</strong> Run 60+ signal analysis on each token</li>
              <li><strong>AI Consensus:</strong> Get votes from all 5 AI models</li>
              <li><strong>Security Check:</strong> Verify token safety</li>
              <li><strong>Execute:</strong> Place trade if consensus reached</li>
              <li><strong>Monitor:</strong> Track position with dynamic exits</li>
              <li><strong>Learn:</strong> Record outcome for future learning</li>
            </ol>

            <h3>7.3 Infrastructure</h3>
            <ul>
              <li>Google Cloud VM (e2-standard-16)</li>
              <li>Node.js runtime</li>
              <li>PM2 process management</li>
              <li>Real-time WebSocket connections</li>
            </ul>
          </section>

          <section>
            <h2>8. Transparency</h2>
            <p>TRADOR is built on complete transparency:</p>
            <ul>
              <li><strong>Public Dashboard:</strong> Real-time stats, positions, and performance visible to all</li>
              <li><strong>On-Chain Verification:</strong> All trades and buybacks verifiable on Solana</li>
              <li><strong>Open Metrics:</strong> AI confidence, data points, win rate all publicly displayed</li>
              <li><strong>No Hidden Fees:</strong> Zero transaction taxes, revenue only from trading</li>
            </ul>
          </section>

          <section>
            <h2>9. Roadmap</h2>
            <div className="wp-roadmap">
              <div className="wp-phase done"><span>✓</span><div><strong>Phase 1: Development</strong><p>Multi-AI engine, signal analysis, learning system</p></div></div>
              <div className="wp-phase active"><span>◉</span><div><strong>Phase 2: Training</strong><p>Data collection, pattern recognition, virtual trading</p></div></div>
              <div className="wp-phase"><span>○</span><div><strong>Phase 3: Launch</strong><p>TRADOR token on Pump.fun, community building</p></div></div>
              <div className="wp-phase"><span>○</span><div><strong>Phase 4: Live Trading</strong><p>Real trades, automatic buybacks, continuous learning</p></div></div>
            </div>
          </section>

          <section>
            <h2>10. Conclusion</h2>
            <p>TRADOR represents a new approach to memecoin trading: an AI system that learns, adapts, and improves over time. By combining multiple AI models, comprehensive signal analysis, and continuous learning, TRADOR aims to identify profitable opportunities while managing risk.</p>
            <p>The buyback mechanism ensures that all success directly benefits token holders through sustained buy pressure, creating alignment between the AI's performance and holder value.</p>
            <p>This is an experiment in AI-driven trading. Past performance does not guarantee future results. Only invest what you can afford to lose.</p>
          </section>
        </div>
      ), 700)}

      {/* Architecture Window */}
      {renderWindow('architecture', (
        <div className="architecture">
          <h2>🏗️ System Architecture</h2>
          <div className="arch-diagram">
            <div className="arch-layer data">
              <h3>Data Layer</h3>
              <div className="arch-items">
                <span>Birdeye API</span><span>Helius RPC</span><span>Pump.fun</span><span>Jupiter</span>
              </div>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-layer analysis">
              <h3>Analysis Layer</h3>
              <div className="arch-items">
                <span>Price Signals</span><span>Volume Signals</span><span>Holder Analysis</span><span>Security Check</span><span>Wallet Intel</span><span>Social Intel</span>
              </div>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-layer ai">
              <h3>AI Layer</h3>
              <div className="arch-items">
                <span>Gemini</span><span>GPT-4</span><span>Claude</span><span>Groq</span><span>Perplexity</span>
              </div>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-layer exec">
              <h3>Execution Layer</h3>
              <div className="arch-items">
                <span>Position Sizing</span><span>Trade Execution</span><span>Risk Management</span><span>Exit Strategy</span>
              </div>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-layer learn">
              <h3>Learning Layer</h3>
              <div className="arch-items">
                <span>Outcome Tracking</span><span>Pattern Recognition</span><span>Strategy Optimization</span>
              </div>
            </div>
          </div>
          <div className="arch-stats">
            <div><strong>Scan Interval:</strong> 60 seconds</div>
            <div><strong>Analysis Time:</strong> ~2 seconds per token</div>
            <div><strong>AI Response:</strong> ~1 second per model</div>
            <div><strong>Learning Cycle:</strong> Every 50 outcomes</div>
          </div>
        </div>
      ), 500)}

      {/* Signals Window */}
      {renderWindow('signals', (
        <div className="signals">
          <h2>📡 Signal Analysis</h2>
          <p className="sig-intro">TRADOR analyzes 60+ signals across 7 categories for every token:</p>
          
          <div className="sig-category">
            <h3>💰 Price Signals</h3>
            <ul>
              <li>Price change: 30m, 1h, 4h, 24h</li>
              <li>Momentum score</li>
              <li>Volatility index</li>
              <li>Distance from ATH/ATL</li>
            </ul>
          </div>

          <div className="sig-category">
            <h3>📊 Volume Signals</h3>
            <ul>
              <li>Volume/Market Cap ratio</li>
              <li>Buy vs Sell volume</li>
              <li>Whale trade detection</li>
              <li>Volume trend (increasing/decreasing)</li>
            </ul>
          </div>

          <div className="sig-category">
            <h3>👥 Holder Signals</h3>
            <ul>
              <li>Total holder count</li>
              <li>Top 1/5/10 holder concentration</li>
              <li>Holder growth rate</li>
              <li>Distribution score</li>
            </ul>
          </div>

          <div className="sig-category">
            <h3>🔒 Security Signals</h3>
            <ul>
              <li>Mint authority check</li>
              <li>Freeze authority check</li>
              <li>LP burn percentage</li>
              <li>Contract verification</li>
              <li>RugCheck score</li>
            </ul>
          </div>

          <div className="sig-category">
            <h3>👛 Wallet Signals</h3>
            <ul>
              <li>Dev wallet detection</li>
              <li>Sniper wallet detection</li>
              <li>Smart money tracking</li>
              <li>Cluster analysis (coordinated buying)</li>
              <li>Known rugger wallets</li>
            </ul>
          </div>

          <div className="sig-category">
            <h3>🌐 Social Signals</h3>
            <ul>
              <li>Narrative detection (AI, meme, animal, etc.)</li>
              <li>Viral potential score</li>
              <li>Hype cycle stage</li>
              <li>Community sentiment</li>
            </ul>
          </div>

          <div className="sig-category">
            <h3>⏰ Time Signals</h3>
            <ul>
              <li>Token age</li>
              <li>Hour of day</li>
              <li>Day of week</li>
              <li>US/Asia market hours</li>
            </ul>
          </div>
        </div>
      ), 450)}

      {/* Roadmap Window */}
      {renderWindow('roadmap', (
        <div className="roadmap-content">
          <h2>🗺️ Development Roadmap</h2>
          <div className="rm-timeline">
            <div className="rm-phase completed">
              <div className="rm-marker">✓</div>
              <div className="rm-content">
                <h3>Phase 1: AI Development</h3>
                <span className="rm-status">COMPLETED</span>
                <ul>
                  <li>✓ Multi-AI consensus engine (5 models)</li>
                  <li>✓ 60+ signal analysis system</li>
                  <li>✓ Self-learning architecture</li>
                  <li>✓ Wallet intelligence system</li>
                  <li>✓ Security scanning integration</li>
                  <li>✓ Social sentiment analysis</li>
                </ul>
              </div>
            </div>
            <div className="rm-phase active">
              <div className="rm-marker">◉</div>
              <div className="rm-content">
                <h3>Phase 2: Training & Testing</h3>
                <span className="rm-status current">IN PROGRESS</span>
                <ul>
                  <li>◉ Collecting real market data</li>
                  <li>◉ Training pattern recognition</li>
                  <li>○ Virtual paper trading</li>
                  <li>○ Strategy optimization</li>
                  <li>○ Backtesting validation</li>
                </ul>
                <div className="rm-progress">
                  <div className="rm-bar"><div style={{ width: `${Math.min(100, (aiStats?.dataPoints || 0) / 50)}%` }}></div></div>
                  <span>{aiStats?.dataPoints || 0} / 5,000 data points</span>
                </div>
              </div>
            </div>
            <div className="rm-phase">
              <div className="rm-marker">○</div>
              <div className="rm-content">
                <h3>Phase 3: Token Launch</h3>
                <span className="rm-status">UPCOMING</span>
                <ul>
                  <li>○ TRADOR token launch on Pump.fun</li>
                  <li>○ Community building</li>
                  <li>○ Social media presence</li>
                  <li>○ Marketing campaign</li>
                </ul>
              </div>
            </div>
            <div className="rm-phase">
              <div className="rm-marker">○</div>
              <div className="rm-content">
                <h3>Phase 4: Live Trading</h3>
                <span className="rm-status">FUTURE</span>
                <ul>
                  <li>○ Activate live trading</li>
                  <li>○ Automatic buyback system</li>
                  <li>○ Public trade verification</li>
                  <li>○ Continuous AI improvement</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ), 480)}

      {/* Socials Window */}
      {renderWindow('socials', (
        <div className="socials">
          <h2>🌐 Connect</h2>
          <div className="social-grid">
            <div className="social-item soon"><span className="social-icon">𝕏</span><span>Twitter</span><span className="soon-badge">Coming Soon</span></div>
            <div className="social-item soon"><span className="social-icon">✈️</span><span>Telegram</span><span className="soon-badge">Coming Soon</span></div>
            <div className="social-item soon"><span className="social-icon">📊</span><span>DEXScreener</span><span className="soon-badge">After Launch</span></div>
            <div className="social-item soon"><span className="social-icon">🦅</span><span>Birdeye</span><span className="soon-badge">After Launch</span></div>
          </div>
          <div className="launch-box">
            <h3>🚀 Token Launch Coming Soon</h3>
            <p>TRADOR will launch on Pump.fun once the AI completes its training phase and demonstrates consistent performance in virtual trading.</p>
            <p>Follow our socials for launch announcements!</p>
          </div>
        </div>
      ), 380)}

      {/* Taskbar */}
      <div className="taskbar">
        <button className="start-btn" onClick={() => setStartMenuOpen(!startMenuOpen)}>
          <span>🤖</span> TRADOR
        </button>
        <div className="taskbar-windows">
          {windows.filter(w => w.open).map(w => (
            <button key={w.id} className={`taskbar-item ${!w.minimized ? 'active' : ''}`}
              onClick={() => { setWindows(wins => wins.map(win => win.id === w.id ? { ...win, minimized: false } : win)); bringToFront(w.id); }}>
              {w.title.replace('.exe', '')}
            </button>
          ))}
        </div>
        <div className="taskbar-tray">
          <span className={`tray-dot ${aiStats ? 'online' : ''}`}></span>
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div className="start-menu">
          <div className="sm-header"><span>🤖</span> TRADOR AI</div>
          <div className="sm-items">
            {windows.map(w => (
              <button key={w.id} className="sm-item" onClick={() => toggleWindow(w.id)}>
                <span>{w.id === 'terminal' ? '💻' : w.id === 'whitepaper' ? '📄' : '📁'}</span>
                {w.title.replace('.exe', '')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
