import { config } from './config.js';
import { state, updateState } from './state.js';
import { WalletService } from './services/wallet.js';
import { Scanner } from './services/scanner.js';
import { TierRouter } from './services/tierRouter.js';
import { SwapExecutor } from './services/swapExecutor.js';
import { PositionManager } from './services/positionManager.js';
import { BuybackExecutor } from './services/buybackExecutor.js';
import { TelegramBot } from './services/telegram.js';
import { ApiServer } from './services/api.js';
import { logger } from './services/logger.js';
import { Simulator } from './services/simulator.js';

class TradorBot {
  constructor() {
    this.wallet = new WalletService();
    this.scanner = new Scanner();
    this.tierRouter = new TierRouter();
    this.swap = new SwapExecutor(this.wallet);
    this.telegram = new TelegramBot();
    this.position = new PositionManager(this.swap, this.wallet, this.scanner, this.telegram);
    this.buyback = new BuybackExecutor(this.swap, this.wallet, this.telegram);
    this.api = new ApiServer();
    this.simulator = new Simulator();
    
    this.lastTrade = 0;
    this.running = false;
    this.cycleCount = 0;
    this.simulationMode = !config.privateKey;
  }

  printBanner() {
    console.log('');
    console.log('\x1b[32m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[32m║\x1b[0m                                                           \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m   \x1b[1m\x1b[36m████████╗██████╗  █████╗ ██████╗  ██████╗ ██████╗ \x1b[0m   \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m   \x1b[1m\x1b[36m╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔══██╗\x1b[0m   \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m   \x1b[1m\x1b[36m   ██║   ██████╔╝███████║██║  ██║██║   ██║██████╔╝\x1b[0m   \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m   \x1b[1m\x1b[36m   ██║   ██╔══██╗██╔══██║██║  ██║██║   ██║██╔══██╗\x1b[0m   \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m   \x1b[1m\x1b[36m   ██║   ██║  ██║██║  ██║██████╔╝╚██████╔╝██║  ██║\x1b[0m   \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m   \x1b[1m\x1b[36m   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝\x1b[0m   \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m                                                           \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m              \x1b[33mDegen Trading Bot v1.0.0\x1b[0m                     \x1b[32m║\x1b[0m');
    console.log('\x1b[32m║\x1b[0m                                                           \x1b[32m║\x1b[0m');
    console.log('\x1b[32m╚═══════════════════════════════════════════════════════════╝\x1b[0m');
    console.log('');
  }

  async init() {
    this.printBanner();
    
    if (this.simulationMode) {
      logger.warn('INIT', 'Running in SIMULATION mode - no real trades');
      logger.info('INIT', 'Add PRIVATE_KEY to .env for live trading');
    }
    
    logger.info('WALLET', `Address: ${this.wallet.publicKey.toString()}`);
    
    const balance = await this.wallet.getBalance();
    logger.info('WALLET', `Balance: ${balance.toFixed(4)} SOL`);
    
    await this.wallet.initBaseline();
    await this.wallet.getTradorHoldings();
    
    if (balance < config.minSolReserve && !this.simulationMode) {
      logger.warn('WALLET', `Low balance! Need at least ${config.minSolReserve} SOL`);
    }
    
    // Start API server
    this.api.start();
    
    // Start simulator if in simulation mode
    if (this.simulationMode) {
      this.simulator.start();
    }
    
    // Send startup notification
    await this.telegram.sendStartup();
    
    updateState({ botStatus: 'running' });
    logger.success('INIT', 'Bot initialized and ready');
    console.log('');
  }

  async scanAndScore() {
    const tokens = await this.scanner.getNewTokens();
    const candidates = [];
    
    // Also get trending tokens
    const trending = await this.scanner.getKingOfTheHill();
    const allTokens = [...tokens, ...trending].slice(0, 50);
    
    // Dedupe by mint
    const seen = new Set();
    const uniqueTokens = allTokens.filter(t => {
      if (seen.has(t.mint)) return false;
      seen.add(t.mint);
      return true;
    });
    
    for (const token of uniqueTokens) {
      try {
        const trades = await this.scanner.getTrades(token.mint, 300);
        if (trades.length < 10) continue;
        
        const metrics = this.scanner.calculateMetrics(token, trades);
        
        const tier = this.tierRouter.determineTier(metrics);
        if (!tier) continue;
        
        const filterResult = this.tierRouter.passesFilters(metrics, tier);
        if (!filterResult.pass) continue;
        
        // Get available risk
        const availableRisk = await this.wallet.getAvailableRisk();
        if (availableRisk <= 0 && !this.simulationMode) continue;
        
        // Calculate position size
        const positionSize = this.tierRouter.getPositionSize(tier, Math.max(availableRisk, 1));
        
        // Simulate slippage (skip in simulation mode for speed)
        let slippage = { priceImpact: 0 };
        if (!this.simulationMode) {
          const tierConfig = config.tiers[tier];
          slippage = await this.swap.simulateSlippage(token.mint, positionSize);
          if (!slippage || slippage.priceImpact > tierConfig.maxSlippage) continue;
        }
        
        const score = this.tierRouter.score(metrics, tier);
        
        candidates.push({
          ...metrics,
          tier,
          tierName: config.tiers[tier].name,
          score,
          positionSize,
          slippage: slippage?.priceImpact || 0
        });
      } catch (err) {
        // Skip failed tokens silently
      }
    }
    
    const sorted = candidates.sort((a, b) => b.score - a.score);
    updateState({ candidates: sorted.slice(0, 10), lastScan: Date.now() });
    
    return sorted;
  }

  async monitorPosition() {
    if (!this.position.hasPosition()) return;
    
    const pos = this.position.position;
    const details = await this.scanner.getTokenDetails(pos.mint);
    if (!details) return;
    
    const currentPrice = details.virtual_sol_reserves / details.total_supply;
    const currentMcap = details.usd_market_cap;
    const exitCheck = this.position.checkExit(currentPrice, currentMcap);
    
    if (exitCheck.shouldExit) {
      const trade = await this.position.closePosition(exitCheck.reason, exitCheck.pnlPercent);
      if (trade) {
        logger.pnl(trade.symbol, trade.pnlSol, trade.pnlPercent, trade.reason);
        logger.logTrade(trade);
      }
      updateState({ lastTrade: Date.now() });
    }
  }

  async tryEnterPosition(candidates) {
    if (this.position.hasPosition()) return;
    if (Date.now() - this.lastTrade < config.tradeCooldownMs) return;
    if (candidates.length === 0) return;
    
    const availableRisk = await this.wallet.getAvailableRisk();
    if (availableRisk <= 0.1 && !this.simulationMode) {
      return;
    }
    
    const best = candidates[0];
    
    logger.trade('OPEN', best.symbol, best.tier, {
      'Score': `${(best.score * 100).toFixed(0)}%`,
      'MCap': `$${best.mcapUsd.toFixed(0)}`,
      'Size': `${best.positionSize.toFixed(4)} SOL`,
      'Volume 5m': `${best.volume5m.toFixed(2)} SOL`,
      'Buy Pressure': `${best.buyPressure.toFixed(2)}x`
    });
    
    try {
      if (!this.simulationMode) {
        await this.swap.buy(best.mint, best.positionSize);
      }
      
      // Refresh token details after buy
      const details = await this.scanner.getTokenDetails(best.mint);
      if (details) {
        best.currentPrice = details.virtual_sol_reserves / details.total_supply;
      }
      
      await this.position.openPosition(best.mint, best.tier, best.positionSize, best);
      this.lastTrade = Date.now();
      updateState({ lastTrade: Date.now() });
      
    } catch (err) {
      logger.error('TRADE', `Entry failed for ${best.symbol}`, err);
      this.scanner.blacklistToken(best.mint, 'entry failed');
      await this.telegram.sendError(err, `Entry failed for ${best.symbol}`);
      logger.logError(err, { action: 'entry', token: best.symbol });
    }
  }

  async runCycle() {
    this.cycleCount++;
    
    // If in simulation mode, use simulator
    if (this.simulationMode) {
      await this.simulator.tick();
      return;
    }
    
    try {
      // Update balance
      await this.wallet.getBalance();
      
      // Monitor existing position
      await this.monitorPosition();
      
      // Check for buyback opportunity
      const buyback = await this.buyback.checkAndExecute();
      if (buyback) {
        logger.buyback(buyback.solSpent, state.stats.totalBuybackSol);
        logger.logBuyback(buyback);
      }
      
      // Scan for new opportunities (only if no position)
      if (!this.position.hasPosition()) {
        const candidates = await this.scanAndScore();
        
        // Log scan results periodically
        if (this.cycleCount % 6 === 0) {
          logger.scan(candidates.length, candidates[0]);
        }
        
        await this.tryEnterPosition(candidates);
      }
      
      // Periodic status update to Telegram
      if (this.cycleCount % 120 === 0) {
        await this.telegram.sendStatus();
      }
      
    } catch (err) {
      logger.error('CYCLE', 'Error in main loop', err);
      logger.logError(err, { cycle: this.cycleCount });
    }
  }

  async start() {
    await this.init();
    this.running = true;
    
    logger.info('BOT', `Starting main loop (${config.scanIntervalMs / 1000}s interval)`);
    console.log('');
    
    while (this.running) {
      await this.runCycle();
      await new Promise(r => setTimeout(r, config.scanIntervalMs));
    }
  }

  stop() {
    this.running = false;
    updateState({ botStatus: 'stopped' });
    this.api.stop();
    logger.info('BOT', 'Shutting down...');
  }
}

// Main
const bot = new TradorBot();

process.on('SIGINT', () => {
  bot.stop();
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  bot.stop();
  setTimeout(() => process.exit(0), 1000);
});

process.on('uncaughtException', (err) => {
  logger.error('FATAL', 'Uncaught exception', err);
  logger.logError(err, { type: 'uncaughtException' });
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('FATAL', 'Unhandled rejection', err);
  logger.logError(err, { type: 'unhandledRejection' });
});

bot.start().catch(err => {
  logger.error('FATAL', 'Failed to start bot', err);
  process.exit(1);
});
