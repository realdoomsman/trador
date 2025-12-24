import { config } from '../config.js';
import { state, updateState, addTrade } from '../state.js';

export class PositionManager {
  constructor(swapExecutor, walletService, scanner, telegram) {
    this.swap = swapExecutor;
    this.wallet = walletService;
    this.scanner = scanner;
    this.telegram = telegram;
    this.position = null;
    this.highWaterMark = 0;
  }

  hasPosition() {
    return this.position !== null;
  }

  async openPosition(mint, tier, solAmount, metrics) {
    const tierConfig = config.tiers[tier];
    
    this.position = {
      mint,
      symbol: metrics.symbol,
      name: metrics.name,
      image: metrics.image,
      tier,
      tierName: tierConfig.name,
      solIn: solAmount,
      entryPrice: metrics.currentPrice,
      entryMcap: metrics.mcapUsd,
      entryTime: Date.now(),
      takeProfit: tierConfig.takeProfit,
      stopLoss: tierConfig.stopLoss,
      maxHoldMs: tierConfig.maxHoldMs,
      trailingTrigger: tierConfig.trailingTrigger,
      trailingStop: tierConfig.trailingStop,
      trailingActive: false,
      currentPrice: metrics.currentPrice,
      currentPnl: 0
    };
    
    this.highWaterMark = metrics.currentPrice;
    updateState({ position: this.position });
    
    console.log(`[Position] 🚀 OPENED ${tier} | ${metrics.symbol} | ${solAmount.toFixed(2)} SOL @ $${metrics.mcapUsd.toFixed(0)} mcap`);
    
    // Telegram notification
    if (this.telegram) {
      await this.telegram.sendTradeOpen(this.position);
    }
    
    return this.position;
  }

  checkExit(currentPrice, currentMcap) {
    if (!this.position) return { shouldExit: false };
    
    const { entryPrice, entryTime, takeProfit, stopLoss, maxHoldMs, trailingTrigger, trailingStop } = this.position;
    const pnlPercent = (currentPrice - entryPrice) / entryPrice;
    const holdTime = Date.now() - entryTime;
    
    // Update position state
    this.position.currentPrice = currentPrice;
    this.position.currentPnl = pnlPercent;
    this.position.currentMcap = currentMcap;
    this.position.holdTime = holdTime;
    updateState({ position: this.position });
    
    // Update high water mark
    if (currentPrice > this.highWaterMark) {
      this.highWaterMark = currentPrice;
    }
    
    // Activate trailing stop
    if (pnlPercent >= trailingTrigger && !this.position.trailingActive) {
      this.position.trailingActive = true;
      console.log(`[Position] 📈 Trailing stop ACTIVATED at ${(pnlPercent * 100).toFixed(1)}%`);
    }
    
    // Check trailing stop
    if (this.position.trailingActive) {
      const drawdown = (this.highWaterMark - currentPrice) / this.highWaterMark;
      if (drawdown >= trailingStop) {
        return { shouldExit: true, reason: 'TRAILING STOP', pnlPercent };
      }
    }
    
    // Take profit
    if (pnlPercent >= takeProfit) {
      return { shouldExit: true, reason: 'TAKE PROFIT 🎯', pnlPercent };
    }
    
    // Stop loss
    if (pnlPercent <= stopLoss) {
      return { shouldExit: true, reason: 'STOP LOSS 💀', pnlPercent };
    }
    
    // Max hold time
    if (holdTime >= maxHoldMs) {
      return { shouldExit: true, reason: 'TIMEOUT ⏰', pnlPercent };
    }
    
    return { shouldExit: false, pnlPercent };
  }

  async closePosition(reason, pnlPercent) {
    if (!this.position) return null;
    
    const { mint, symbol, tier, solIn } = this.position;
    
    // Get token balance and sell
    const tokenBalance = await this.wallet.getTokenBalance(mint);
    let solOut = solIn; // Default if sell fails
    
    if (tokenBalance > 0) {
      try {
        const balanceBefore = await this.wallet.getBalance();
        await this.swap.sell(mint, tokenBalance * 1e9); // Convert to lamports
        const balanceAfter = await this.wallet.getBalance();
        solOut = balanceAfter - balanceBefore + solIn;
      } catch (err) {
        console.error('[Position] Sell failed:', err.message);
        // Blacklist token if sell fails
        this.scanner?.blacklistToken(mint, 'sell failed');
      }
    }
    
    const pnlSol = solOut - solIn;
    const emoji = pnlSol >= 0 ? '✅' : '❌';
    
    const trade = {
      mint,
      symbol,
      tier,
      solIn,
      solOut,
      pnlSol,
      pnlPercent,
      reason,
      entryTime: this.position.entryTime,
      exitTime: Date.now(),
      holdTimeMs: Date.now() - this.position.entryTime
    };
    
    addTrade(trade);
    
    console.log(`[Position] ${emoji} CLOSED ${symbol} | ${reason} | PnL: ${pnlSol >= 0 ? '+' : ''}${pnlSol.toFixed(4)} SOL (${(pnlPercent * 100).toFixed(1)}%)`);
    
    // Telegram notification
    if (this.telegram) {
      await this.telegram.sendTradeClose(trade);
    }
    
    this.position = null;
    this.highWaterMark = 0;
    updateState({ position: null });
    
    return trade;
  }
}
