import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const BUYBACKS_FILE = path.join(DATA_DIR, 'buybacks.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function saveState(state) {
  ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[Persistence] Failed to save state:', err.message);
  }
}

export function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Persistence] Failed to load state:', err.message);
  }
  return null;
}

export function saveTrades(trades) {
  ensureDir();
  try {
    fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
  } catch (err) {
    console.error('[Persistence] Failed to save trades:', err.message);
  }
}

export function loadTrades() {
  try {
    if (fs.existsSync(TRADES_FILE)) {
      return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Persistence] Failed to load trades:', err.message);
  }
  return [];
}

export function saveBuybacks(buybacks) {
  ensureDir();
  try {
    fs.writeFileSync(BUYBACKS_FILE, JSON.stringify(buybacks, null, 2));
  } catch (err) {
    console.error('[Persistence] Failed to save buybacks:', err.message);
  }
}

export function loadBuybacks() {
  try {
    if (fs.existsSync(BUYBACKS_FILE)) {
      return JSON.parse(fs.readFileSync(BUYBACKS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Persistence] Failed to load buybacks:', err.message);
  }
  return [];
}

export function clearData() {
  try {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    if (fs.existsSync(TRADES_FILE)) fs.unlinkSync(TRADES_FILE);
    if (fs.existsSync(BUYBACKS_FILE)) fs.unlinkSync(BUYBACKS_FILE);
  } catch (err) {
    console.error('[Persistence] Failed to clear data:', err.message);
  }
}
