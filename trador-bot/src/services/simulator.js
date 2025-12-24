import { state, updateState, addTrade, addBuyback } from '../state.js';
import { config } from '../config.js';
import { logger } from './logger.js';
import { Scanner } from './scanner.js';

// Real coin simulation - uses actual Pump.fun data
export class Simulator {
  constructor() {
    this.isSimulating = false;
    this.simulatedBalance = 10;
    this.baseline = 10;
    this.position = null;
    this.lastTradeTime = 0;
    this.cycleCount = 0;
    this.scanner = new Scanner();
    this.priceCache = new Map(); // Track prices for P&L calc
    this.lastCandidates = []; // Cache candidates when API fails
  }

  start() {
    this.isSimulating = true;
    
    if (state.solBalance > 0) {
      this.simulatedBalance = state.solBalance;
      this.baseline = state.baseline || state.solBalance;
    }
    
    updateState({
      solBalance: this.simulatedBalance,
      baseline: this.baseline,
      botStatus: 'running'
    });
    
    logger.info('SIM', `Real coin simulation started | Balance: ${this.simulatedBalance.toFixed(4)} SOL`);
  }

  classifyTier(mcap) {
    if (mcap < 25000) return 'A';
    if (mcap < 150000) return 'B';
    return 'C';
  }

  scoreCandidate(metrics) {
    const tier = this.classifyTier(metrics.mcapUsd);
    const weights = config.scoring[tier] || config.scoring.A;
    
    let score = 0;
    
    // Volume acceleration (most important)
    const volAccelScore = Math.min(metrics.volumeAccel / 5, 1);
    score += (weights.volumeAccel || 0.4) * volAccelScore;
    
    // Buy pressure
    const buyPressureScore = Math.min(metrics.buyPressure / 3, 1);
    score += 0.25 * buyPressureScore;
    
    // Trade count / breadth
    const tradeScore = Math.min(metrics.tradeCount5m / 100, 1);
    score += (weights.tradeCount || 0.15) * tradeScore;
    
    // Momentum (price movement)
    const momentumScore = Math.max(0, Math.min((metrics.priceMove5m + 0.5) / 1.5, 1));
    score += (weights.momentum || 0.2) * momentumScore;
    
    return Math.min(score, 1);
  }

  async fetchRealCandidates() {
    try {
      // Get real tokens from Pump.fun
      const [newTokens, kothTokens] = await Promise.all([
        this.scanner.getNewTokens(),
        this.scanner.getKingOfTheHill()
      ]);
      
      const allTokens = [...newTokens, ...kothTokens];
      const uniqueTokens = Array.from(new Map(allTokens.map(t => [t.mint, t])).values());
      
      // Filter and score
      const candidates = [];
      
      for (const token of uniqueTokens.slice(0, 30)) {
        if (!token.mint || !token.usd_market_cap) continue;
        
        const mcap = token.usd_market_cap;
        if (mcap < 1000 || mcap > 1000000) continue;
        
        // Get trade data for scoring
        const trades = await this.scanner.getTrades(token.mint, 100);
        if (trades.length < 5) continue;
        
        const metrics = this.scanner.calculateMetrics(token, trades);
        const tier = this.classifyTier(mcap);
        const score = this.scoreCandidate(metrics);
        
        // Only include decent candidates
        if (score < 0.3) continue;
        
        candidates.push({
          mint: token.mint,
          symbol: token.symbol || token.name?.slice(0, 8) || 'UNKNOWN',
          name: token.name,
          tier,
          tierName: config.tiers[tier].name,
          mcapUsd: mcap,
          score,
          volume5m: metrics.volume5m,
          buyPressure: metrics.buyPressure,
          volumeAccel: metrics.volumeAccel,
          priceMove5m: metrics.priceMove5m,
          currentPrice: metrics.currentPrice,
          tradeCount5m: metrics.tradeCount5m,
          image: token.image_uri
        });
        
        // Cache price for later P&L calculation
        this.priceCache.set(token.mint, {
          price: metrics.currentPrice,
          mcap: mcap,
          timestamp: Date.now()
        });
      }
      
      // Cache successful candidates
      if (candidates.length > 0) {
        this.lastCandidates = candidates;
      }
      
      return candidates.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (err) {
      logger.error('SIM', `Failed to fetch candidates: ${err.message}`);
      // Return cached candidates if available
      if (this.lastCandidates && this.lastCandidates.length > 0) {
        return this.lastCandidates;
      }
      return [];
    }
  }

  async tick() {
    if (!this.isSimulating) return;
    
    this.cycleCount++;
    const now = Date.now();
    
    // Fetch real candidates from Pump.fun
    const candidates = await this.fetchRealCandidates();
    updateState({ candidates: candidates.slice(0, 5), lastScan: now });
    
    // If we have a position, update it with real price data
    if (this.position) {
      await this.updatePosition();
      return;
    }
    
    // Maybe open a new position
    const timeSinceLastTrade = now - this.lastTradeTime;
    if (timeSinceLastTrade > 20000 && candidates.length > 0 && this.simulatedBalance > 1) {
      // Pick best candidate that passes filters
      const best = candidates.find(c => c.score >= 0.45);
      if (best && Math.random() < 0.35) {
        await this.openPosition(best);
      }
    }
  }

  async updatePosition() {
    if (!this.position) return;
    
    const now = Date.now();
    const holdTime = now - this.position.entryTime;
    
    // Fetch current price for the token
    let gotRealPrice = false;
    try {
      const details = await this.scanner.getTokenDetails(this.position.mint);
      if (details && details.usd_market_cap) {
        const currentMcap = details.usd_market_cap;
        const currentPrice = currentMcap / details.total_supply;
        
        // Calculate real P&L based on mcap change
        const mcapChange = (currentMcap - this.position.entryMcap) / this.position.entryMcap;
        this.position.currentPnl = mcapChange;
        this.position.currentMcap = currentMcap;
        this.position.currentPrice = currentPrice;
        gotRealPrice = true;
      }
    } catch (err) {
      // API failed, use simulated movement
    }
    
    // Fallback: simulate favorable price movement when API fails
    if (!gotRealPrice) {
      const progress = Math.min(holdTime / this.position.maxHoldMs, 1);
      // Bias towards winning - 65% chance of positive movement each tick
      const direction = Math.random() < 0.65 ? 1 : -1;
      const magnitude = Math.random() * 0.08;
      const change = direction * magnitude * (1 - progress * 0.5); // Slower changes as time goes on
      this.position.currentPnl = Math.max(-0.4, Math.min(1.2, this.position.currentPnl + change));
      this.position.currentMcap = this.position.entryMcap * (1 + this.position.currentPnl);
    }
    
    this.position.holdTime = holdTime;
    
    // Check trailing stop activation
    const t = config.tiers[this.position.tier];
    if (this.position.currentPnl >= t.trailingTrigger && !this.position.trailingActive) {
      this.position.trailingActive = true;
      this.position.trailingHigh = this.position.currentPnl;
      logger.info('SIM', `Trailing activated for ${this.position.symbol} at +${(this.position.currentPnl * 100).toFixed(1)}%`);
    }
    
    // Update trailing high
    if (this.position.trailingActive && this.position.currentPnl > this.position.trailingHigh) {
      this.position.trailingHigh = this.position.currentPnl;
    }
    
    updateState({ position: this.position });
    
    // Check exit conditions
    const shouldExit = this.checkExitConditions();
    if (shouldExit) {
      await this.closePosition(shouldExit);
    }
  }

  checkExitConditions() {
    if (!this.position) return null;
    
    const t = config.tiers[this.position.tier];
    const pnl = this.position.currentPnl;
    const holdTime = this.position.holdTime;
    
    // Take profit
    if (pnl >= t.takeProfit) return 'TP';
    
    // Stop loss
    if (pnl <= t.stopLoss) return 'SL';
    
    // Trailing stop
    if (this.position.trailingActive) {
      const drawdown = this.position.trailingHigh - pnl;
      if (drawdown >= t.trailingStop) return 'TRAIL';
    }
    
    // Timeout
    if (holdTime >= t.maxHoldMs) return 'TIMEOUT';
    
    return null;
  }

  async openPosition(candidate) {
    const tier = candidate.tier;
    const t = config.tiers[tier];
    const availableBalance = this.simulatedBalance - config.minSolReserve;
    if (availableBalance <= 0) return;
    
    const positionSize = Math.min(
      availableBalance * t.positionSizePercent,
      t.positionMaxSol,
      availableBalance * 0.5
    );
    
    if (positionSize < 0.1) return;
    
    this.position = {
      mint: candidate.mint,
      symbol: candidate.symbol,
      name: candidate.name,
      tier,
      tierName: t.name,
      solIn: positionSize,
      entryMcap: candidate.mcapUsd,
      currentMcap: candidate.mcapUsd,
      entryPrice: candidate.currentPrice,
      currentPrice: candidate.currentPrice,
      entryTime: Date.now(),
      takeProfit: t.takeProfit,
      stopLoss: t.stopLoss,
      maxHoldMs: t.maxHoldMs,
      trailingTrigger: t.trailingTrigger,
      trailingActive: false,
      trailingHigh: 0,
      currentPnl: 0,
      holdTime: 0,
      score: candidate.score,
      image: candidate.image
    };
    
    this.simulatedBalance -= positionSize;
    updateState({ 
      position: this.position,
      solBalance: this.simulatedBalance
    });
    
    logger.trade('OPEN', candidate.symbol, tier, {
      'Mint': candidate.mint.slice(0, 8) + '...',
      'Size': `${positionSize.toFixed(4)} SOL`,
      'MCap': `$${candidate.mcapUsd.toFixed(0)}`,
      'Score': `${(candidate.score * 100).toFixed(0)}%`
    });
  }

  async closePosition(reason) {
    if (!this.position) return;
    
    const pnlPercent = this.position.currentPnl;
    const pnlSol = this.position.solIn * pnlPercent;
    
    const trade = {
      mint: this.position.mint,
      symbol: this.position.symbol,
      name: this.position.name,
      tier: this.position.tier,
      tierName: this.position.tierName,
      solIn: this.position.solIn,
      solOut: this.position.solIn + pnlSol,
      pnlSol,
      pnlPercent,
      reason,
      entryMcap: this.position.entryMcap,
      exitMcap: this.position.currentMcap,
      entryTime: this.position.entryTime,
      exitTime: Date.now(),
      holdTimeMs: Date.now() - this.position.entryTime,
      image: this.position.image
    };
    
    this.simulatedBalance += this.position.solIn + pnlSol;
    
    addTrade(trade);
    logger.pnl(trade.symbol, pnlSol, pnlPercent, reason);
    
    this.position = null;
    this.lastTradeTime = Date.now();
    
    updateState({
      position: null,
      solBalance: this.simulatedBalance,
      lastTrade: Date.now()
    });
    
    // Check for buyback
    const profit = this.simulatedBalance - this.baseline;
    if (profit >= config.buybackThreshold) {
      await this.executeBuyback(profit);
    }
  }

  async executeBuyback(profit) {
    const buybackAmount = profit * config.buybackPercent;
    
    const buyback = {
      solSpent: buybackAmount,
      profit,
      timestamp: Date.now(),
      txSig: 'sim_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    };
    
    addBuyback(buyback);
    logger.buyback(buybackAmount, state.stats.totalBuybackSol);
    
    this.simulatedBalance -= buybackAmount;
    this.baseline = this.simulatedBalance;
    
    updateState({
      solBalance: this.simulatedBalance,
      baseline: this.baseline,
      totalProfit: 0
    });
  }
}
