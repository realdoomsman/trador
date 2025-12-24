import React, { useState } from 'react';

export function MobileNav({ activeTab, setActiveTab, state, formatTime }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="mobile-header">
        <div className="mobile-logo">
          <div className="logo-icon">T</div>
          <span className="logo-text">TRADOR</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '✕' : '☰'}
        </button>
      </div>
      
      {isOpen && (
        <div className="mobile-menu">
          <div className="mobile-nav-items">
            <div 
              className={`mobile-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => { setActiveTab('overview'); setIsOpen(false); }}
            >
              📊 Overview
            </div>
            <div 
              className={`mobile-nav-item ${activeTab === 'trades' ? 'active' : ''}`}
              onClick={() => { setActiveTab('trades'); setIsOpen(false); }}
            >
              📈 Trade History
            </div>
            <div 
              className={`mobile-nav-item ${activeTab === 'buybacks' ? 'active' : ''}`}
              onClick={() => { setActiveTab('buybacks'); setIsOpen(false); }}
            >
              🔄 Buybacks
            </div>
          </div>
          <div className="mobile-status">
            <div className={`status-indicator ${state.botStatus !== 'running' ? 'offline' : ''}`}></div>
            <span>{state.botStatus === 'running' ? 'Bot Active' : 'Bot Offline'}</span>
          </div>
        </div>
      )}
    </>
  );
}
