import { useState, useEffect, useRef } from 'react';
import './styles.css';

const API_URL = 'http://34.123.211.253:3003';

function App() {
  const [windows, setWindows] = useState([
    { id: 'welcome', title: 'Welcome.exe', open: true, minimized: false, x: 50, y: 50, z: 10 },
    { id: 'howitworks', title: 'HowItWorks.exe', open: false, minimized: false, x: 120, y: 80, z: 9 },
    { id: 'revenue', title: 'Revenue.exe', open: false, minimized: false, x: 180, y: 110, z: 8 },
    { id: 'livestats', title: 'LiveStats.exe', open: false, minimized: false, x: 240, y: 60, z: 7 },
    { id: 'roadmap', title: 'Roadmap.exe', open: false, minimized: false, x: 300, y: 90, z: 6 },
    { id: 'docs', title: 'Docs.exe', open: false, minimized: false, x: 360, y: 120, z: 5 },
    { id: 'socials', title: 'Socials.exe', open: false, minimized: false, x: 420, y: 70, z: 4 },
  ]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [maxZ, setMaxZ] = useState(11);
  const dragRef = useRef(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) setAiStats(await res.json());
    } catch (e) { /* API not available */ }
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

  const minimizeWindow = (id) => {
    setWindows(wins => wins.map(w => w.id === id ? { ...w, minimized: true } : w));
  };

  const closeWindow = (id) => {
    setWindows(wins => wins.map(w => w.id === id ? { ...w, open: false } : w));
  };

  const startDrag = (e, id) => {
    if (e.target.closest('.window-btn')) return;
    bringToFront(id);
    const win = windows.find(w => w.id === id);
    dragRef.current = { id, startX: e.clientX - win.x, startY: e.clientY - win.y };
  };

  const onDrag = (e) => {
    if (!dragRef.current) return;
    const { id, startX, startY } = dragRef.current;
    setWindows(wins => wins.map(w => w.id === id ? { ...w, x: e.clientX - startX, y: e.clientY - startY } : w));
  };

  const endDrag = () => { dragRef.current = null; };

  const getWindow = (id) => windows.find(w => w.id === id);

  const renderWindow = (id, content) => {
    const win = getWindow(id);
    if (!win.open || win.minimized) return null;
    return (
      <div className="window" style={{ left: win.x, top: win.y, zIndex: win.z }}
        onMouseDown={() => bringToFront(id)}>
        <div className="window-header" onMouseDown={(e) => startDrag(e, id)}>
          <span className="window-title">{win.title}</span>
          <div className="window-controls">
            <button className="window-btn" onClick={() => minimizeWindow(id)}>_</button>
            <button className="window-btn" onClick={() => closeWindow(id)}>×</button>
          </div>
        </div>
        <div className="window-content">{content}</div>
      </div>
    );
  };

  return (
    <div className="desktop" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
      {/* Desktop Icons */}
      <div className="desktop-icons">
        {windows.map(w => (
          <div key={w.id} className="desktop-icon" onDoubleClick={() => toggleWindow(w.id)}>
            <div className="icon-img">📁</div>
            <span>{w.title}</span>
          </div>
        ))}
      </div>

      {/* Welcome Window */}
      {renderWindow('welcome', (
        <div className="content-welcome">
          <div className="logo-section">
            <h1 className="glitch" data-text="TRADOR">TRADOR</h1>
            <p className="tagline">The Self-Learning AI Trading Experiment</p>
          </div>
          <div className="welcome-text">
            <p><strong>TRADOR</strong> is an experimental AI system that trades Solana memecoins on Pump.fun.</p>
            <p>It uses <strong>5 AI models</strong> working together, analyzes <strong>60+ signals</strong> per token, and <strong>learns from every trade</strong> to get smarter over time.</p>
            <p>All profits from trading are used to <strong>buy back TRADOR tokens</strong>, creating constant buy pressure.</p>
            <div className="cta-buttons">
              <button className="win-btn primary" onClick={() => toggleWindow('howitworks')}>How It Works</button>
              <button className="win-btn" onClick={() => toggleWindow('livestats')}>Live Stats</button>
            </div>
          </div>
          <div className="status-badge">
            <span className="pulse"></span>
            {aiStats ? 'AI ONLINE' : 'CONNECTING...'}
          </div>
        </div>
      ))}

      {/* How It Works Window */}
      {renderWindow('howitworks', (
        <div className="content-docs">
          <h2>🧠 The AI Brain</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3>5 AI Models</h3>
              <p>Gemini, GPT-4, Claude, Groq, and Perplexity analyze every token. They vote on trades - only consensus signals get executed.</p>
            </div>
            <div className="info-card">
              <h3>60+ Signals</h3>
              <p>Price momentum, volume patterns, holder distribution, whale activity, social sentiment, security checks, and more.</p>
            </div>
            <div className="info-card">
              <h3>Self-Learning</h3>
              <p>Every trade outcome is recorded. The AI learns which signals predict pumps vs dumps and adjusts its strategy.</p>
            </div>
            <div className="info-card">
              <h3>Wallet Intelligence</h3>
              <p>Tracks known profitable wallets, identifies dev wallets, detects coordinated buying, and spots rug patterns.</p>
            </div>
          </div>
          <h2>🔄 The Trading Loop</h2>
          <div className="flow-diagram">
            <div className="flow-step">Scan Pump.fun</div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">Analyze Token</div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">AI Consensus</div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">Execute Trade</div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">Learn Outcome</div>
          </div>
        </div>
      ))}

      {/* Revenue Model Window */}
      {renderWindow('revenue', (
        <div className="content-docs">
          <h2>💰 Revenue Model</h2>
          <div className="revenue-flow">
            <div className="revenue-step highlight">
              <h3>Pump.fun Creator Program</h3>
              <p>When TRADOR creates and trades tokens on Pump.fun, it earns creator fees from the platform.</p>
            </div>
            <div className="revenue-arrow">↓</div>
            <div className="revenue-step">
              <h3>Trading Profits</h3>
              <p>The AI trades memecoins, taking profits on successful trades using dynamic exit strategies.</p>
            </div>
            <div className="revenue-arrow">↓</div>
            <div className="revenue-step highlight">
              <h3>Automatic Buybacks</h3>
              <p>100% of profits are used to buy TRADOR tokens from the open market.</p>
            </div>
            <div className="revenue-arrow">↓</div>
            <div className="revenue-step">
              <h3>Constant Buy Pressure</h3>
              <p>More successful trades = more buybacks = sustained price support.</p>
            </div>
          </div>
          <div className="no-tax-badge">
            <span>🚫 NO TAXES</span>
            <p>TRADOR has zero buy/sell tax. All revenue comes from AI trading profits.</p>
          </div>
        </div>
      ))}

      {/* Live Stats Window */}
      {renderWindow('livestats', (
        <div className="content-stats">
          <h2>📊 Live AI Stats</h2>
          {aiStats ? (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{aiStats.confidence || 0}%</span>
                  <span className="stat-label">AI Confidence</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{aiStats.dataPoints?.toLocaleString() || 0}</span>
                  <span className="stat-label">Data Points</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{aiStats.aiModelsCount || 0}</span>
                  <span className="stat-label">AI Models</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{aiStats.trackedTokens || 0}</span>
                  <span className="stat-label">Tokens Tracked</span>
                </div>
              </div>
              <div className="stats-section">
                <h3>Learning Progress</h3>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (aiStats.dataPoints || 0) / 50)}%` }}></div>
                </div>
                <p className="progress-text">{aiStats.dataPoints || 0} / 5000 data points for virtual trading</p>
              </div>
              <div className="stats-section">
                <h3>Market Analysis</h3>
                <div className="mini-stats">
                  <span>Regime: <strong>{aiStats.marketRegime || 'Neutral'}</strong></span>
                  <span>Data Source: <strong>{aiStats.isRealData ? '🟢 Real' : '🟡 Learning'}</strong></span>
                </div>
              </div>
              <div className="stats-section">
                <h3>Available AIs</h3>
                <div className="ai-list">
                  {(aiStats.availableAIs || []).map(ai => (
                    <span key={ai} className="ai-badge">{ai}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Connecting to AI...</p>
            </div>
          )}
        </div>
      ))}

      {/* Roadmap Window */}
      {renderWindow('roadmap', (
        <div className="content-docs">
          <h2>🗺️ Roadmap</h2>
          <div className="roadmap">
            <div className="roadmap-phase completed">
              <div className="phase-marker">✓</div>
              <div className="phase-content">
                <h3>Phase 1: AI Development</h3>
                <ul>
                  <li>Multi-AI consensus engine</li>
                  <li>60+ signal analysis</li>
                  <li>Self-learning system</li>
                  <li>Wallet intelligence</li>
                  <li>Security scanning</li>
                </ul>
              </div>
            </div>
            <div className="roadmap-phase active">
              <div className="phase-marker">◉</div>
              <div className="phase-content">
                <h3>Phase 2: Training & Testing</h3>
                <ul>
                  <li>Collect market data</li>
                  <li>Virtual paper trading</li>
                  <li>Pattern recognition</li>
                  <li>Strategy optimization</li>
                </ul>
              </div>
            </div>
            <div className="roadmap-phase">
              <div className="phase-marker">○</div>
              <div className="phase-content">
                <h3>Phase 3: Token Launch</h3>
                <ul>
                  <li>TRADOR token on Pump.fun</li>
                  <li>Community building</li>
                  <li>Live trading activation</li>
                </ul>
              </div>
            </div>
            <div className="roadmap-phase">
              <div className="phase-marker">○</div>
              <div className="phase-content">
                <h3>Phase 4: Full Automation</h3>
                <ul>
                  <li>Automatic buybacks</li>
                  <li>Public stats dashboard</li>
                  <li>Continuous learning</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Docs Window */}
      {renderWindow('docs', (
        <div className="content-docs">
          <h2>📚 Technical Documentation</h2>
          <div className="docs-section">
            <h3>AI Architecture</h3>
            <p>TRADOR uses a multi-layer AI system:</p>
            <ul>
              <li><strong>Data Layer:</strong> Birdeye API for real-time Pump.fun data, Helius RPC for on-chain analysis</li>
              <li><strong>Analysis Layer:</strong> 60+ signals including price, volume, holders, security, social</li>
              <li><strong>AI Layer:</strong> 5 models (Gemini, GPT-4, Claude, Groq, Perplexity) vote on each trade</li>
              <li><strong>Learning Layer:</strong> Tracks outcomes, identifies patterns, optimizes strategy</li>
              <li><strong>Execution Layer:</strong> Dynamic position sizing, trailing stops, profit targets</li>
            </ul>
          </div>
          <div className="docs-section">
            <h3>Signal Categories</h3>
            <table className="docs-table">
              <thead><tr><th>Category</th><th>Signals</th></tr></thead>
              <tbody>
                <tr><td>Price</td><td>30m, 1h, 4h, 24h changes, momentum</td></tr>
                <tr><td>Volume</td><td>Volume/MCap ratio, buy pressure, whale trades</td></tr>
                <tr><td>Holders</td><td>Distribution, concentration, whale %</td></tr>
                <tr><td>Security</td><td>Mint authority, freeze, LP burned, rug score</td></tr>
                <tr><td>Social</td><td>Narrative detection, viral potential, hype analysis</td></tr>
                <tr><td>Wallets</td><td>Dev wallets, sniper detection, smart money</td></tr>
              </tbody>
            </table>
          </div>
          <div className="docs-section">
            <h3>Risk Management</h3>
            <ul>
              <li>Position sizing based on Kelly Criterion</li>
              <li>Dynamic stop-loss and take-profit levels</li>
              <li>Trailing stops that lock in profits</li>
              <li>Maximum daily trade limits</li>
              <li>Portfolio heat monitoring</li>
            </ul>
          </div>
        </div>
      ))}

      {/* Socials Window */}
      {renderWindow('socials', (
        <div className="content-socials">
          <h2>🌐 Connect With Us</h2>
          <div className="social-grid">
            <div className="social-card coming-soon">
              <span className="social-icon">𝕏</span>
              <span className="social-name">Twitter</span>
              <span className="social-status">Coming Soon</span>
            </div>
            <div className="social-card coming-soon">
              <span className="social-icon">✈️</span>
              <span className="social-name">Telegram</span>
              <span className="social-status">Coming Soon</span>
            </div>
            <div className="social-card coming-soon">
              <span className="social-icon">📊</span>
              <span className="social-name">DEXScreener</span>
              <span className="social-status">After Launch</span>
            </div>
            <div className="social-card coming-soon">
              <span className="social-icon">🦅</span>
              <span className="social-name">Birdeye</span>
              <span className="social-status">After Launch</span>
            </div>
          </div>
          <div className="launch-notice">
            <h3>🚀 Token Launch Coming Soon</h3>
            <p>TRADOR will launch on Pump.fun once the AI has completed its training phase.</p>
            <p>Follow our socials for launch announcements!</p>
          </div>
        </div>
      ))}

      {/* Taskbar */}
      <div className="taskbar">
        <button className="start-btn" onClick={() => setStartMenuOpen(!startMenuOpen)}>
          <span className="start-icon">🪟</span> Start
        </button>
        <div className="taskbar-windows">
          {windows.filter(w => w.open).map(w => (
            <button key={w.id} className={`taskbar-item ${!w.minimized ? 'active' : ''}`}
              onClick={() => { 
                if (w.minimized) setWindows(wins => wins.map(win => win.id === w.id ? { ...win, minimized: false } : win));
                bringToFront(w.id);
              }}>
              {w.title}
            </button>
          ))}
        </div>
        <div className="taskbar-tray">
          <span className="tray-status">{aiStats ? '🟢' : '🔴'}</span>
          <span className="tray-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div className="start-menu">
          <div className="start-menu-header">
            <span className="start-logo">🤖</span>
            <span>TRADOR</span>
          </div>
          <div className="start-menu-items">
            {windows.map(w => (
              <button key={w.id} className="start-menu-item" onClick={() => toggleWindow(w.id)}>
                <span>📁</span> {w.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
