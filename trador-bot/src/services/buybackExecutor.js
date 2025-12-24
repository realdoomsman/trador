import { config } from '../config.js';
import { state, addBuyback } from '../state.js';

export class BuybackExecutor {
  constructor(swapExecutor, walletService, telegram) {
    this.swap = swapExecutor;
    this.wallet = walletService;
    this.telegram = telegram;
    this.lastBuyback = 0;
  }

  canBuyback() {
    const cooldownPassed = Date.now() - this.lastBuyback >= config.buybackCooldownMs;
    return cooldownPassed && config.tradorMint;
  }

  async checkAndExecute() {
    if (!this.canBuyback()) return null;
    
    const profit = await this.wallet.getProfit();
    
    if (profit < config.buybackThreshold) {
      return null;
    }
    
    // ALL PROFITS GO TO BUYBACK
    const buybackAmount = profit * config.buybackPercent;
    
    console.log(`[Buyback] 🔥 PROFIT DETECTED: ${profit.toFixed(4)} SOL → Buying back TRADOR with ${buybackAmount.toFixed(4)} SOL`);
    
    try {
      const sig = await this.swap.buy(config.tradorMint, buybackAmount);
      
      this.lastBuyback = Date.now();
      
      // Update baseline after buyback
      const newBalance = await this.wallet.getBalance();
      this.wallet.updateBaseline(newBalance);
      
      // Get new TRADOR holdings
      const tradorBalance = await this.wallet.getTradorHoldings();
      
      const buyback = {
        sig,
        solSpent: buybackAmount,
        profit,
        tradorBalance,
        timestamp: Date.now()
      };
      
      addBuyback(buyback);
      
      console.log(`[Buyback] ✅ SUCCESS! Bought TRADOR with ${buybackAmount.toFixed(4)} SOL | Total holdings: ${tradorBalance}`);
      
      // Telegram notification
      if (this.telegram) {
        await this.telegram.sendBuyback(buyback);
      }
      
      return buyback;
    } catch (err) {
      console.error('[Buyback] ❌ Failed:', err.message);
      return null;
    }
  }
}
