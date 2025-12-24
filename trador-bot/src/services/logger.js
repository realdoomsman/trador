import fs from 'fs';
import path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

export class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  getFilename(prefix) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${prefix}-${date}.json`);
  }

  // Console logging with colors
  info(module, message, data = null) {
    const ts = this.timestamp();
    const prefix = `${COLORS.gray}${ts}${COLORS.reset} ${COLORS.cyan}[${module}]${COLORS.reset}`;
    console.log(`${prefix} ${message}`, data ? data : '');
  }

  success(module, message, data = null) {
    const ts = this.timestamp();
    const prefix = `${COLORS.gray}${ts}${COLORS.reset} ${COLORS.green}[${module}]${COLORS.reset}`;
    console.log(`${prefix} ${COLORS.green}✓${COLORS.reset} ${message}`, data ? data : '');
  }

  warn(module, message, data = null) {
    const ts = this.timestamp();
    const prefix = `${COLORS.gray}${ts}${COLORS.reset} ${COLORS.yellow}[${module}]${COLORS.reset}`;
    console.log(`${prefix} ${COLORS.yellow}⚠${COLORS.reset} ${message}`, data ? data : '');
  }

  error(module, message, error = null) {
    const ts = this.timestamp();
    const prefix = `${COLORS.gray}${ts}${COLORS.reset} ${COLORS.red}[${module}]${COLORS.reset}`;
    console.log(`${prefix} ${COLORS.red}✗${COLORS.reset} ${message}`);
    if (error) {
      console.log(`${COLORS.dim}  ${error.message || error}${COLORS.reset}`);
    }
  }

  trade(action, symbol, tier, details) {
    const ts = this.timestamp();
    const emoji = action === 'OPEN' ? '🚀' : action === 'CLOSE' ? '📤' : '📊';
    const color = action === 'OPEN' ? COLORS.cyan : COLORS.magenta;
    console.log(`${COLORS.gray}${ts}${COLORS.reset} ${color}[TRADE]${COLORS.reset} ${emoji} ${action} ${COLORS.bright}${symbol}${COLORS.reset} (Tier ${tier})`);
    if (details) {
      Object.entries(details).forEach(([key, val]) => {
        console.log(`${COLORS.dim}  ${key}: ${val}${COLORS.reset}`);
      });
    }
  }

  pnl(symbol, pnlSol, pnlPercent, reason) {
    const ts = this.timestamp();
    const isWin = pnlSol >= 0;
    const emoji = isWin ? '✅' : '❌';
    const color = isWin ? COLORS.green : COLORS.red;
    const sign = isWin ? '+' : '';
    console.log(`${COLORS.gray}${ts}${COLORS.reset} ${color}[P&L]${COLORS.reset} ${emoji} ${symbol} ${color}${sign}${pnlSol.toFixed(4)} SOL${COLORS.reset} (${sign}${(pnlPercent * 100).toFixed(1)}%) - ${reason}`);
  }

  buyback(amount, total) {
    const ts = this.timestamp();
    console.log(`${COLORS.gray}${ts}${COLORS.reset} ${COLORS.yellow}[BUYBACK]${COLORS.reset} 🔥 ${COLORS.yellow}+${amount.toFixed(4)} SOL${COLORS.reset} → TRADOR (Total: ${total.toFixed(4)} SOL)`);
  }

  scan(candidateCount, topCandidate = null) {
    const ts = this.timestamp();
    if (topCandidate) {
      console.log(`${COLORS.gray}${ts}${COLORS.reset} ${COLORS.blue}[SCAN]${COLORS.reset} Found ${candidateCount} candidates | Top: ${topCandidate.symbol} (${(topCandidate.score * 100).toFixed(0)}%)`);
    } else {
      console.log(`${COLORS.gray}${ts}${COLORS.reset} ${COLORS.blue}[SCAN]${COLORS.reset} ${COLORS.dim}No candidates found${COLORS.reset}`);
    }
  }

  // File logging
  logTrade(trade) {
    const file = this.getFilename('trades');
    const entry = { ...trade, timestamp: Date.now() };
    this.appendJson(file, entry);
  }

  logBuyback(buyback) {
    const file = this.getFilename('buybacks');
    const entry = { ...buyback, timestamp: Date.now() };
    this.appendJson(file, entry);
  }

  logError(error, context = {}) {
    const file = this.getFilename('errors');
    const entry = {
      message: error.message || error,
      stack: error.stack,
      context,
      timestamp: Date.now()
    };
    this.appendJson(file, entry);
  }

  appendJson(file, entry) {
    let data = [];
    if (fs.existsSync(file)) {
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        data = [];
      }
    }
    data.push(entry);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
}

export const logger = new Logger();
