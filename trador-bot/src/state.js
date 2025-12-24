import { saveState, loadState, saveTrades, loadTrades, saveBuybacks, loadBuybacks } from './services/persistence.js';

// Load persisted data on startup
const persistedState = loadState();
const persistedTrades = loadTrades();
const persistedBuybacks = loadBuybacks();

export const state = {
  walletAddress: persistedState?.walletAddress || '',
  solBalance: persistedState?.solBalance || 0,
  baseline: persistedState?.baseline || 0,
  totalProfit: persistedState?.totalProfit || 0,
  position: null,
  stats: persistedState?.stats || {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    totalPnlSol: 0,
    totalPnlPercent: 0,
    biggestWin: 0,
    biggestLoss: 0,
    winStreak: 0,
    currentStreak: 0,
    totalBuybacks: 0,
    totalBuybackSol: 0
  },
  recentTrades: persistedTrades || [],
  recentBuybacks: persistedBuybacks || [],
  botStatus: 'stopped',
  lastScan: null,
  candidates: [],
  tradorPrice: 0,
  tradorMcap: 0,
  tradorHoldings: 0
};

// Restore stats from trades if needed
if (state.recentTrades.length > 0 && state.stats.totalTrades === 0) {
  state.stats.totalTrades = state.recentTrades.length;
  state.stats.wins = state.recentTrades.filter(t => t.pnlSol > 0).length;
  state.stats.losses = state.recentTrades.filter(t => t.pnlSol <= 0).length;
  state.stats.totalPnlSol = state.recentTrades.reduce((sum, t) => sum + (t.pnlSol || 0), 0);
  state.stats.biggestWin = Math.max(...state.recentTrades.map(t => t.pnlSol || 0), 0);
  state.stats.biggestLoss = Math.min(...state.recentTrades.map(t => t.pnlSol || 0), 0);
}

if (state.recentBuybacks.length > 0 && state.stats.totalBuybacks === 0) {
  state.stats.totalBuybacks = state.recentBuybacks.length;
  state.stats.totalBuybackSol = state.recentBuybacks.reduce((sum, b) => sum + (b.solSpent || 0), 0);
}

let saveTimeout = null;

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveState({
      walletAddress: state.walletAddress,
      solBalance: state.solBalance,
      baseline: state.baseline,
      totalProfit: state.totalProfit,
      stats: state.stats
    });
  }, 1000);
}

export function updateState(updates) {
  Object.assign(state, updates);
  debouncedSave();
}

export function addTrade(trade) {
  state.recentTrades.unshift(trade);
  if (state.recentTrades.length > 100) state.recentTrades.pop();
  
  state.stats.totalTrades++;
  state.stats.totalPnlSol += trade.pnlSol || 0;
  
  if (trade.pnlSol > 0) {
    state.stats.wins++;
    state.stats.currentStreak = Math.max(0, state.stats.currentStreak) + 1;
    if (trade.pnlSol > state.stats.biggestWin) state.stats.biggestWin = trade.pnlSol;
  } else {
    state.stats.losses++;
    state.stats.currentStreak = Math.min(0, state.stats.currentStreak) - 1;
    if (trade.pnlSol < state.stats.biggestLoss) state.stats.biggestLoss = trade.pnlSol;
  }
  
  state.stats.winStreak = Math.max(state.stats.winStreak, state.stats.currentStreak);
  
  saveTrades(state.recentTrades);
  debouncedSave();
}

export function addBuyback(buyback) {
  state.recentBuybacks.unshift(buyback);
  if (state.recentBuybacks.length > 50) state.recentBuybacks.pop();
  
  state.stats.totalBuybacks++;
  state.stats.totalBuybackSol += buyback.solSpent;
  
  saveBuybacks(state.recentBuybacks);
  debouncedSave();
}
