import React from 'react';

export function LandingPage({ onEnter }) {
  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="grid-overlay"></div>
      </div>
      
      <div className="landing-content">
        <div className="landing-hero">
          <div className="hero-badge">Live on Solana</div>
          <h1 className="hero-title">
            <span className="hero-icon">T</span>
            TRADOR
          </h1>
          <p className="hero-subtitle">
            Autonomous trading bot that buys memecoins and uses all profits to buy back its own token.
          </p>
          
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">Profits → Buyback</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">24/7</div>
              <div className="hero-stat-label">Always Trading</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">Public</div>
              <div className="hero-stat-label">Wallet Visible</div>
            </div>
          </div>
          
          <div className="hero-actions">
            <button className="hero-btn primary" onClick={onEnter}>
              View Dashboard →
            </button>
            <a className="hero-btn secondary" href="https://pump.fun" target="_blank" rel="noopener noreferrer">
              Buy $TRADOR
            </a>
          </div>
        </div>
        
        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Aggressive Strategy</h3>
            <p>Targets early-stage memecoins with high volume and momentum. Big risk, big potential.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔥</div>
            <h3>Auto Buybacks</h3>
            <p>Every single profit SOL automatically buys TRADOR. The bot never sells its own token.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👁️</div>
            <h3>Full Transparency</h3>
            <p>One public wallet. All trades visible on-chain. No hidden fees or mechanics.</p>
          </div>
        </div>
        
        <div className="landing-disclaimer">
          <p>
            <strong>⚠️ High Risk:</strong> This is an experimental trading bot. 
            You can lose everything. Only invest what you can afford to lose. DYOR.
          </p>
        </div>
      </div>
    </div>
  );
}
