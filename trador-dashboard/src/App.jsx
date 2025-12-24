import React, { useState, useEffect, useCallback } from 'react';

const API_URL = '/api';

const mockState = {
  walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  solBalance: 10.0, baseline: 10.0, totalProfit: 0, position: null,
  stats: { totalTrades: 0, wins: 0, losses: 0, totalPnlSol: 0, biggestWin: 0, biggestLoss: 0, totalBuybacks: 0, totalBuybackSol: 0 },
  recentTrades: [], recentBuybacks: [], candidates: [], botStatus: 'stopped', lastScan: null,
};

function BootScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => { if (p >= 100) { clearInterval(interval); setTimeout(() => onComplete(), 200); return 100; } return p + 8; });
    }, 100);
    return () => clearInterval(interval);
  }, [onComplete]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 60 }}>
        <div style={{ width: 60, height: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          <div style={{ background: '#ff0000', borderRadius: 2 }}></div>
          <div style={{ background: '#00ff00', borderRadius: 2 }}></div>
          <div style={{ background: '#0000ff', borderRadius: 2 }}></div>
          <div style={{ background: '#ffff00', borderRadius: 2 }}></div>
        </div>
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 56, fontWeight: 'bold', color: '#fff' }}>TRADOR</div>
          <div style={{ fontFamily: 'serif', fontSize: 28, color: '#fff', fontStyle: 'italic', marginTop: -8 }}>98</div>
        </div>
      </div>
      <div style={{ width: 220, height: 24, background: '#000', border: '1px solid #333', padding: 4, display: 'flex', gap: 3 }}>
        {Array(Math.floor(progress / 5)).fill(0).map((_, i) => (<div key={i} style={{ width: 10, height: '100%', background: '#3366cc' }}></div>))}
      </div>
      <div style={{ position: 'absolute', bottom: 30, color: '#666', fontSize: 11 }}>Starting TRADOR...</div>
    </div>
  );
}

function Window({ title, children, style, zIndex, onFocus, onClose, onMinimize, minimized }) {
  const [pos, setPos] = useState({ x: style?.left || 100, y: style?.top || 100 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const handleMouseDown = (e) => { if (e.target.closest('.window-controls')) return; setDragging(true); setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y }); onFocus?.(); };
  useEffect(() => {
    const move = (e) => dragging && setPos({ x: Math.max(0, e.clientX - offset.x), y: Math.max(0, e.clientY - offset.y) });
    const up = () => setDragging(false);
    if (dragging) { document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); }
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }, [dragging, offset]);
  if (minimized) return null;
  return (
    <div className="window" style={{ ...style, left: pos.x, top: pos.y, zIndex }} onMouseDown={onFocus}>
      <div className="window-title" onMouseDown={handleMouseDown}><span>{title}</span><div className="window-controls"><button className="window-btn" onClick={onMinimize}>_</button><button className="window-btn" onClick={onClose}>x</button></div></div>
      <div className="window-content">{children}</div>
    </div>
  );
}


function App() {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState(mockState);
  const [time, setTime] = useState(new Date());
  const [windows, setWindows] = useState({
    welcome: { open: true, minimized: false, zIndex: 10 },
    stats: { open: true, minimized: false, zIndex: 11 },
    position: { open: true, minimized: false, zIndex: 12 },
    trades: { open: false, minimized: false, zIndex: 13 },
    buybacks: { open: true, minimized: false, zIndex: 14 },
    docs: { open: false, minimized: false, zIndex: 15 },
    winamp: { open: true, minimized: false, zIndex: 16 },
    chart: { open: true, minimized: false, zIndex: 17 },
    meme: { open: true, minimized: false, zIndex: 18 },
    guestbook: { open: false, minimized: false, zIndex: 19 },
    links: { open: false, minimized: false, zIndex: 20 },
  });
  const [topZ, setTopZ] = useState(25);
  const [connected, setConnected] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [visitors] = useState(Math.floor(Math.random() * 50000) + 10000);

  const focusWindow = (id) => { setTopZ((z) => z + 1); setWindows((w) => ({ ...w, [id]: { ...w[id], zIndex: topZ + 1 } })); };
  const toggleWindow = (id, key, value) => { setWindows((w) => ({ ...w, [id]: { ...w[id], [key]: value } })); };
  const openWindow = (id) => { setWindows((w) => ({ ...w, [id]: { ...w[id], open: true, minimized: false, zIndex: topZ + 1 } })); setTopZ((z) => z + 1); };

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/state`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) { const d = await res.json(); if (d.walletAddress) { setState(d); setConnected(true); } }
    } catch { setConnected(false); }
  }, []);

  useEffect(() => {
    if (!booted) return;
    fetchState();
    const i = setInterval(fetchState, 3000);
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(i); clearInterval(t); };
  }, [fetchState, booted]);

  useEffect(() => { const close = () => setStartOpen(false); document.addEventListener('click', close); return () => document.removeEventListener('click', close); }, []);

  if (!booted) return <BootScreen onComplete={() => setBooted(true)} />;

  const { stats, position, recentTrades, recentBuybacks, candidates } = state;
  const winRate = stats.totalTrades > 0 ? ((stats.wins / stats.totalTrades) * 100).toFixed(0) : 0;


  return (
    <div className="desktop">
      {/* DESKTOP ICONS */}
      <div className="desktop-icons">
        <div className="desktop-icon" onDoubleClick={() => openWindow('welcome')}><div className="icon-box">R</div><span>README</span></div>
        <div className="desktop-icon" onDoubleClick={() => openWindow('docs')}><div className="icon-box" style={{background:'#000080',color:'#fff'}}>?</div><span>How It Works</span></div>
        <div className="desktop-icon" onDoubleClick={() => openWindow('stats')}><div className="icon-box" style={{background:'#ffcc00'}}>$</div><span>Stats</span></div>
        <div className="desktop-icon" onDoubleClick={() => openWindow('trades')}><div className="icon-box" style={{background:'#ffffcc'}}>T</div><span>Trades</span></div>
        <div className="desktop-icon" onDoubleClick={() => openWindow('chart')}><div className="icon-box" style={{background:'#000',color:'#0f0'}}>^</div><span>Chart</span></div>
        <div className="desktop-icon" onDoubleClick={() => openWindow('guestbook')}><div className="icon-box" style={{background:'#ffccff'}}>G</div><span>Guestbook</span></div>
        <div className="desktop-icon" onDoubleClick={() => openWindow('links')}><div className="icon-box" style={{background:'#00ccff'}}>L</div><span>Links</span></div>
        <div className="desktop-icon" onDoubleClick={() => window.open(`https://solscan.io/account/${state.walletAddress}`, '_blank')}><div className="icon-box" style={{background:'#ccc'}}>S</div><span>Solscan</span></div>
        <div className="desktop-icon" onDoubleClick={() => window.open('https://pump.fun', '_blank')}><div className="icon-box" style={{background:'#0c6'}}>P</div><span>Pump.fun</span></div>
      </div>

      {/* VISITOR COUNTER */}
      <div style={{ position: 'fixed', bottom: 35, right: 10, background: '#000', color: '#0f0', padding: '4px 8px', fontFamily: 'monospace', fontSize: 11, border: '2px inset #808080' }}>
        VISITORS: {visitors.toLocaleString()}
      </div>

      {/* UNDER CONSTRUCTION */}
      <div style={{ position: 'fixed', top: 10, right: 10, background: '#ff0', color: '#000', padding: '4px 8px', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ animation: 'blink98 0.5s infinite' }}>!</span> UNDER CONSTRUCTION <span style={{ animation: 'blink98 0.5s infinite' }}>!</span>
      </div>


      {/* WELCOME WINDOW */}
      {windows.welcome.open && (
        <Window title="README.txt" style={{ left: 80, top: 40, width: 360 }} zIndex={windows.welcome.zIndex} minimized={windows.welcome.minimized}
          onFocus={() => focusWindow('welcome')} onClose={() => toggleWindow('welcome', 'open', false)} onMinimize={() => toggleWindow('welcome', 'minimized', true)}>
          <div style={{ background: '#fff', padding: 12, fontFamily: 'monospace', fontSize: 11 }}>
            <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, textAlign: 'center' }}>*** WTF IS TRADOR? ***</div>
            <p>A degen bot that trades pump.fun shitcoins 24/7</p>
            <div style={{ marginTop: 10, fontWeight: 'bold' }}>THE RULES:</div>
            <p>1. Bot trades memecoins automatically</p>
            <p>2. 100% of profits buy $TRADOR</p>
            <p>3. Bot NEVER sells its $TRADOR</p>
            <p>4. One wallet, fully transparent</p>
            <div style={{ marginTop: 10, padding: 8, background: '#e8ffe8', border: '1px solid #0a0', textAlign: 'center' }}>
              BOT WINS = BUYBACKS = CHART GO UP
            </div>
            <div style={{ marginTop: 10, fontSize: 9, background: '#000', color: '#0f0', padding: 6, wordBreak: 'break-all' }}>{state.walletAddress}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button className="btn98" onClick={() => navigator.clipboard.writeText(state.walletAddress)}>Copy Wallet</button>
              <button className="btn98" onClick={() => window.open(`https://solscan.io/account/${state.walletAddress}`, '_blank')}>Verify</button>
              <button className="btn98" onClick={() => openWindow('docs')}>Learn More</button>
            </div>
          </div>
        </Window>
      )}

      {/* STATS WINDOW */}
      {windows.stats.open && (
        <Window title="Bot Stats" style={{ left: 460, top: 40, width: 260 }} zIndex={windows.stats.zIndex} minimized={windows.stats.minimized}
          onFocus={() => focusWindow('stats')} onClose={() => toggleWindow('stats', 'open', false)} onMinimize={() => toggleWindow('stats', 'minimized', true)}>
          <div className="inset">
            <div className="stat-row"><span>Balance:</span><span style={{fontWeight:'bold'}}>{state.solBalance?.toFixed(4)} SOL</span></div>
            <div className="stat-row"><span>Total P/L:</span><span style={{ color: stats.totalPnlSol >= 0 ? 'green' : 'red', fontWeight:'bold' }}>{stats.totalPnlSol >= 0 ? '+' : ''}{stats.totalPnlSol?.toFixed(4)} SOL</span></div>
            <div className="stat-row"><span>Win Rate:</span><span style={{ color: winRate >= 50 ? 'green' : 'red' }}>{winRate}%</span></div>
            <div className="stat-row"><span>Record:</span><span>{stats.wins}W - {stats.losses}L</span></div>
            <div className="stat-row"><span>Best Win:</span><span style={{color:'green'}}>+{stats.biggestWin?.toFixed(4)}</span></div>
            <div className="stat-row"><span>Worst Loss:</span><span style={{color:'red'}}>{stats.biggestLoss?.toFixed(4)}</span></div>
          </div>
          <div className="inset" style={{ marginTop: 8, background: '#ffffcc' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, textAlign: 'center' }}>BUYBACK STATS</div>
            <div className="stat-row"><span>Total Burned:</span><span style={{color:'#f60', fontWeight:'bold'}}>{stats.totalBuybackSol?.toFixed(4)} SOL</span></div>
            <div className="stat-row"><span>Buybacks:</span><span>{stats.totalBuybacks}</span></div>
          </div>
        </Window>
      )}


      {/* POSITION WINDOW */}
      {windows.position.open && (
        <Window title={position ? 'LIVE POSITION' : 'Position Monitor'} style={{ left: 80, top: 340, width: 360 }} zIndex={windows.position.zIndex} minimized={windows.position.minimized}
          onFocus={() => focusWindow('position')} onClose={() => toggleWindow('position', 'open', false)} onMinimize={() => toggleWindow('position', 'minimized', true)}>
          {position ? (
            <div className="inset-dark">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div><span style={{ color: '#f00', animation: 'blink98 1s infinite' }}>*</span> POSITION OPEN</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>${position.symbol}</div>
                  <div style={{ fontSize: 9, opacity: 0.6, cursor: 'pointer' }} onClick={() => window.open(`https://pump.fun/${position.mint}`, '_blank')}>{position.mint?.slice(0, 10)}...{position.mint?.slice(-6)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, opacity: 0.6 }}>UNREALIZED P/L</div>
                  <div style={{ fontSize: 24, color: (position.currentPnl || 0) >= 0 ? '#0f0' : '#f00' }}>{(position.currentPnl || 0) >= 0 ? '+' : ''}{((position.currentPnl || 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10, fontSize: 10 }}>
                <div><div style={{opacity:0.5}}>SIZE</div>{position.solIn?.toFixed(3)} SOL</div>
                <div><div style={{opacity:0.5}}>MCAP</div>${(position.currentMcap||0).toLocaleString()}</div>
                <div><div style={{opacity:0.5}}>TIER</div>{position.tier}</div>
                <div><div style={{opacity:0.5}}>TP</div>+{((position.takeProfit||0)*100).toFixed(0)}%</div>
                <div><div style={{opacity:0.5}}>SL</div>{((position.stopLoss||0)*100).toFixed(0)}%</div>
                <div><div style={{opacity:0.5}}>TRAIL</div>{position.trailingActive ? 'ON' : 'OFF'}</div>
              </div>
            </div>
          ) : (
            <div className="inset-dark" style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 14 }}>NO ACTIVE POSITION</div>
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6 }}>{state.botStatus === 'running' ? 'scanning for plays...' : 'bot offline'}</div>
              {candidates?.length > 0 && (
                <div style={{ marginTop: 14, textAlign: 'left', fontSize: 10 }}>
                  <div style={{ opacity: 0.6, marginBottom: 4 }}>NEXT TARGETS:</div>
                  {candidates.slice(0, 4).map((c, i) => (
                    <div key={i} style={{ marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                      <span>${c.symbol}</span>
                      <span>${c.mcapUsd?.toLocaleString()} ({((c.score || 0) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Window>
      )}

      {/* CHART WINDOW */}
      {windows.chart.open && (
        <Window title="P/L Chart" style={{ left: 740, top: 40, width: 300 }} zIndex={windows.chart.zIndex} minimized={windows.chart.minimized}
          onFocus={() => focusWindow('chart')} onClose={() => toggleWindow('chart', 'open', false)} onMinimize={() => toggleWindow('chart', 'minimized', true)}>
          <div className="inset-dark" style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: 2, padding: 8 }}>
            {Array(20).fill(0).map((_, i) => {
              const h = 20 + Math.random() * 100;
              const isGreen = Math.random() > 0.4;
              return <div key={i} style={{ flex: 1, height: `${h}%`, background: isGreen ? '#0f0' : '#f00', minWidth: 8 }}></div>;
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4, color: '#808080' }}>
            <span>24h ago</span><span>now</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11 }}>
            <span style={{ color: '#0f0' }}>GREEN = WIN</span> | <span style={{ color: '#f00' }}>RED = LOSS</span>
          </div>
        </Window>
      )}


      {/* TRADES WINDOW */}
      {windows.trades.open && (
        <Window title="Trade History" style={{ left: 460, top: 220, width: 380 }} zIndex={windows.trades.zIndex} minimized={windows.trades.minimized}
          onFocus={() => focusWindow('trades')} onClose={() => toggleWindow('trades', 'open', false)} onMinimize={() => toggleWindow('trades', 'minimized', true)}>
          <div className="inset" style={{ maxHeight: 200, overflow: 'auto' }}>
            {recentTrades?.length > 0 ? (
              <table className="trade-table">
                <thead><tr><th>Token</th><th>CA</th><th>P/L</th><th>Exit</th></tr></thead>
                <tbody>
                  {recentTrades.slice(0, 10).map((t, i) => (
                    <tr key={i}>
                      <td><b>${t.symbol}</b><br/><span style={{fontSize:8,opacity:0.6}}>Tier {t.tier}</span></td>
                      <td><a href={`https://pump.fun/${t.mint}`} target="_blank" rel="noreferrer" style={{fontSize:8}}>{t.mint?.slice(0,6)}...</a></td>
                      <td style={{ color: t.pnlSol >= 0 ? 'green' : 'red' }}>{t.pnlSol >= 0 ? '+' : ''}{t.pnlSol?.toFixed(3)}<br/><span style={{fontSize:8}}>({(t.pnlPercent*100).toFixed(0)}%)</span></td>
                      <td style={{fontSize:10}}>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (<div style={{ textAlign: 'center', padding: 20, color: '#808080' }}>no trades yet - bot warming up</div>)}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: '#808080' }}>Total: {stats.totalTrades} trades | {stats.wins}W / {stats.losses}L</div>
        </Window>
      )}

      {/* BUYBACKS WINDOW */}
      {windows.buybacks.open && (
        <Window title="Buyback Log" style={{ left: 460, top: 450, width: 220 }} zIndex={windows.buybacks.zIndex} minimized={windows.buybacks.minimized}
          onFocus={() => focusWindow('buybacks')} onClose={() => toggleWindow('buybacks', 'open', false)} onMinimize={() => toggleWindow('buybacks', 'minimized', true)}>
          <div className="marquee98"><div className="marquee98-inner">*** 100% PROFITS = BUYBACK *** WAGMI *** LFG ***</div></div>
          <div className="inset" style={{ textAlign: 'center', marginTop: 6 }}>
            <div style={{ fontSize: 9, opacity: 0.6 }}>TOTAL BURNED</div>
            <div style={{ fontSize: 22, color: '#f60', fontWeight: 'bold' }}>{stats.totalBuybackSol?.toFixed(4)} SOL</div>
          </div>
          <div className="inset" style={{ marginTop: 6, maxHeight: 80, overflow: 'auto' }}>
            {recentBuybacks?.length > 0 ? recentBuybacks.slice(0, 6).map((bb, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dotted #ccc', fontSize: 10 }}>
                <span style={{color:'#f60'}}>+{bb.solSpent?.toFixed(4)} SOL</span>
              </div>
            )) : (<div style={{ textAlign: 'center', padding: 10, color: '#808080', fontSize: 10 }}>waiting...</div>)}
          </div>
        </Window>
      )}

      {/* MEME WINDOW */}
      {windows.meme.open && (
        <Window title="motivation.bmp" style={{ left: 740, top: 220, width: 180 }} zIndex={windows.meme.zIndex} minimized={windows.meme.minimized}
          onFocus={() => focusWindow('meme')} onClose={() => toggleWindow('meme', 'open', false)} onMinimize={() => toggleWindow('meme', 'minimized', true)}>
          <div style={{ textAlign: 'center', padding: 10, background: '#fff' }}>
            <div style={{ fontSize: 60 }}>{stats.totalPnlSol >= 0 ? ':)' : ':('}</div>
            <div style={{ fontFamily: 'Impact', fontSize: 14, marginTop: 8 }}>{stats.totalPnlSol >= 0 ? 'WAGMI' : 'NGMI'}</div>
            <div style={{ fontSize: 10, marginTop: 8, color: '#808080' }}>
              {stats.totalPnlSol >= 0 ? 'bot is printing' : 'temporary setback'}
            </div>
          </div>
        </Window>
      )}


      {/* DOCS WINDOW */}
      {windows.docs.open && (
        <Window title="How TRADOR Works" style={{ left: 150, top: 100, width: 550 }} zIndex={windows.docs.zIndex} minimized={windows.docs.minimized}
          onFocus={() => focusWindow('docs')} onClose={() => toggleWindow('docs', 'open', false)} onMinimize={() => toggleWindow('docs', 'minimized', true)}>
          <div style={{ background: '#fff', padding: 14, maxHeight: 350, overflow: 'auto', fontSize: 11, lineHeight: 1.5 }}>
            <h3 style={{ color: '#000080', borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '0 0 8px 0' }}>What is TRADOR?</h3>
            <p style={{margin:'6px 0'}}>TRADOR is a Pump.fun token with an autonomous trading bot. The bot trades other memecoins, and <b>100% of profits buy back TRADOR</b>.</p>
            <h3 style={{ color: '#000080', borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '14px 0 8px 0' }}>The 3-Tier Strategy</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead><tr style={{background:'#c0c0c0'}}><th style={{padding:4,border:'1px solid #808080'}}>Tier</th><th style={{padding:4,border:'1px solid #808080'}}>MCap</th><th style={{padding:4,border:'1px solid #808080'}}>Size</th><th style={{padding:4,border:'1px solid #808080'}}>TP</th><th style={{padding:4,border:'1px solid #808080'}}>SL</th></tr></thead>
              <tbody>
                <tr><td style={{padding:4,border:'1px solid #ccc'}}>A - Degen</td><td style={{padding:4,border:'1px solid #ccc'}}>&lt;$25k</td><td style={{padding:4,border:'1px solid #ccc'}}>15%</td><td style={{padding:4,border:'1px solid #ccc',color:'green'}}>+100%</td><td style={{padding:4,border:'1px solid #ccc',color:'red'}}>-35%</td></tr>
                <tr><td style={{padding:4,border:'1px solid #ccc'}}>B - Momentum</td><td style={{padding:4,border:'1px solid #ccc'}}>$25k-$150k</td><td style={{padding:4,border:'1px solid #ccc'}}>25%</td><td style={{padding:4,border:'1px solid #ccc',color:'green'}}>+60%</td><td style={{padding:4,border:'1px solid #ccc',color:'red'}}>-25%</td></tr>
                <tr><td style={{padding:4,border:'1px solid #ccc'}}>C - Swing</td><td style={{padding:4,border:'1px solid #ccc'}}>&gt;$150k</td><td style={{padding:4,border:'1px solid #ccc'}}>40%</td><td style={{padding:4,border:'1px solid #ccc',color:'green'}}>+35%</td><td style={{padding:4,border:'1px solid #ccc',color:'red'}}>-15%</td></tr>
              </tbody>
            </table>
            <h3 style={{ color: '#000080', borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '14px 0 8px 0' }}>The Buyback Engine</h3>
            <ol style={{margin:'6px 0',paddingLeft:20}}>
              <li>Bot tracks baseline SOL balance</li>
              <li>After wins, calculates profit</li>
              <li>100% of profit buys TRADOR</li>
              <li>TRADOR held forever - never sold</li>
            </ol>
            <div style={{ background: '#ffffcc', padding: 8, border: '1px solid #cc0', marginTop: 10 }}><b>More wins = More buybacks = Chart support</b></div>
            <h3 style={{ color: '#000080', borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '14px 0 8px 0' }}>Transparency</h3>
            <p style={{margin:'6px 0'}}>Everything on-chain. One wallet. Verify everything:</p>
            <div style={{ background: '#000', color: '#0f0', padding: 6, fontFamily: 'monospace', fontSize: 9, wordBreak: 'break-all' }}>{state.walletAddress}</div>
          </div>
        </Window>
      )}

      {/* GUESTBOOK WINDOW */}
      {windows.guestbook.open && (
        <Window title="Guestbook" style={{ left: 200, top: 150, width: 350 }} zIndex={windows.guestbook.zIndex} minimized={windows.guestbook.minimized}
          onFocus={() => focusWindow('guestbook')} onClose={() => toggleWindow('guestbook', 'open', false)} onMinimize={() => toggleWindow('guestbook', 'minimized', true)}>
          <div style={{ background: '#ffffcc', padding: 10, border: '2px solid #cc9900' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Sign the Guestbook!</div>
            <div style={{ background: '#fff', padding: 8, border: '1px inset #808080', maxHeight: 150, overflow: 'auto', fontSize: 11 }}>
              <div style={{marginBottom:8}}><b>anon420:</b> WAGMI ser, bot is printing</div>
              <div style={{marginBottom:8}}><b>degen_trader:</b> finally a token that buys itself lmao</div>
              <div style={{marginBottom:8}}><b>pump_it:</b> 100% buyback is genius</div>
              <div style={{marginBottom:8}}><b>sol_maxi:</b> watching the bot trade is addicting</div>
              <div style={{marginBottom:8}}><b>moon_soon:</b> LFG!!!</div>
              <div style={{marginBottom:8}}><b>early_ape:</b> transparent af, love it</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#808080' }}>* guestbook is for display only</div>
          </div>
        </Window>
      )}

      {/* LINKS WINDOW */}
      {windows.links.open && (
        <Window title="Important Links" style={{ left: 600, top: 350, width: 250 }} zIndex={windows.links.zIndex} minimized={windows.links.minimized}
          onFocus={() => focusWindow('links')} onClose={() => toggleWindow('links', 'open', false)} onMinimize={() => toggleWindow('links', 'minimized', true)}>
          <div className="inset" style={{ padding: 10 }}>
            <div style={{ marginBottom: 8 }}><a href={`https://solscan.io/account/${state.walletAddress}`} target="_blank" rel="noreferrer">View Wallet on Solscan</a></div>
            <div style={{ marginBottom: 8 }}><a href="https://pump.fun" target="_blank" rel="noreferrer">Pump.fun</a></div>
            <div style={{ marginBottom: 8 }}><a href="https://jup.ag" target="_blank" rel="noreferrer">Jupiter DEX</a></div>
            <div style={{ marginBottom: 8 }}><a href="https://birdeye.so" target="_blank" rel="noreferrer">Birdeye Charts</a></div>
            <div style={{ marginBottom: 8 }}><a href="https://dexscreener.com" target="_blank" rel="noreferrer">DexScreener</a></div>
          </div>
        </Window>
      )}


      {/* WINAMP */}
      {windows.winamp.open && (
        <div className="winamp" style={{ position: 'absolute', left: 740, top: 420, zIndex: windows.winamp.zIndex }} onClick={() => focusWindow('winamp')}>
          <div className="winamp-title"><span>TRADOR Radio</span><span style={{ cursor: 'pointer' }} onClick={() => toggleWindow('winamp', 'open', false)}>x</span></div>
          <div style={{ background: '#000', padding: 4, margin: 4 }}>
            <div style={{ display: 'flex', gap: 1, height: 20, alignItems: 'flex-end' }}>
              {Array(20).fill(0).map((_, i) => (<div key={i} style={{ width: 4, background: 'linear-gradient(#0f0, #ff0, #f00)', height: playing ? `${20 + Math.random() * 80}%` : '10%', transition: 'height 0.1s' }}></div>))}
            </div>
            <div style={{ color: '#0f0', fontSize: 8, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ whiteSpace: 'nowrap', animation: playing ? 'scroll 8s linear infinite' : 'none' }}>{playing ? '*** TRADOR DEGEN ANTHEM *** 100% BUYBACK *** WAGMI ***' : '[ PAUSED ]'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: 4 }}>
            <button className="winamp-btn" onClick={() => setPlaying(!playing)}>{playing ? 'II' : '>'}</button>
            <button className="winamp-btn" onClick={() => setPlaying(false)}>[]</button>
          </div>
        </div>
      )}

      {/* START MENU */}
      {startOpen && (
        <div className="start-menu" onClick={(e) => e.stopPropagation()}>
          <div className="start-menu-sidebar"><span>TRADOR<br/>98</span></div>
          <div className="start-menu-items">
            <div className="start-menu-item" onClick={() => { openWindow('welcome'); setStartOpen(false); }}>README</div>
            <div className="start-menu-item" onClick={() => { openWindow('docs'); setStartOpen(false); }}>How It Works</div>
            <div className="start-menu-item" onClick={() => { openWindow('stats'); setStartOpen(false); }}>Stats</div>
            <div className="start-menu-item" onClick={() => { openWindow('position'); setStartOpen(false); }}>Position</div>
            <div className="start-menu-item" onClick={() => { openWindow('trades'); setStartOpen(false); }}>Trades</div>
            <div className="start-menu-item" onClick={() => { openWindow('buybacks'); setStartOpen(false); }}>Buybacks</div>
            <div className="start-menu-item" onClick={() => { openWindow('chart'); setStartOpen(false); }}>Chart</div>
            <div style={{ height: 1, background: '#808080', margin: '4px 8px' }}></div>
            <div className="start-menu-item" onClick={() => { openWindow('guestbook'); setStartOpen(false); }}>Guestbook</div>
            <div className="start-menu-item" onClick={() => { openWindow('links'); setStartOpen(false); }}>Links</div>
            <div style={{ height: 1, background: '#808080', margin: '4px 8px' }}></div>
            <div className="start-menu-item" onClick={() => window.open('https://solscan.io', '_blank')}>Solscan</div>
            <div className="start-menu-item" onClick={() => window.open('https://pump.fun', '_blank')}>Pump.fun</div>
          </div>
        </div>
      )}

      {/* TASKBAR */}
      <div className="taskbar">
        <button className="start-btn" onClick={(e) => { e.stopPropagation(); setStartOpen(!startOpen); }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, background: 'linear-gradient(135deg, #f00 25%, #0f0 25%, #0f0 50%, #00f 50%, #00f 75%, #ff0 75%)', marginRight: 4 }}></span>
          Start
        </button>
        <div className="taskbar-divider"></div>
        <div className="taskbar-items">
          {Object.entries(windows).filter(([_, w]) => w.open).map(([id]) => (
            <button key={id} className="taskbar-item" onClick={() => { toggleWindow(id, 'minimized', false); focusWindow(id); }}>{id}</button>
          ))}
        </div>
        <div className="taskbar-tray">
          <span title={connected ? 'Connected' : 'Disconnected'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#0f0' : '#f00', display: 'inline-block' }}></span>
          <span title={state.botStatus} style={{ marginLeft: 6, fontSize: 10 }}>{state.botStatus === 'running' ? 'BOT ON' : 'BOT OFF'}</span>
          <span style={{ marginLeft: 8 }}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
