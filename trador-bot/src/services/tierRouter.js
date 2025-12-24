import { config } from '../config.js';

export class TierRouter {
  determineTier(metrics) {
    const { mcapUsd } = metrics;
    
    if (mcapUsd < config.tiers.A.mcapMax) return 'A';
    if (mcapUsd >= config.tiers.B.mcapMin && mcapUsd < config.tiers.B.mcapMax) return 'B';
    if (mcapUsd >= config.tiers.C.mcapMin) return 'C';
    
    return null;
  }

  passesFilters(metrics, tier) {
    const t = config.tiers[tier];
    
    // Age filter
    if (metrics.age < t.minAge) {
      return { pass: false, reason: `too young (${Math.floor(metrics.age/60000)}m < ${Math.floor(t.minAge/60000)}m)` };
    }
    
    // Liquidity filter
    if (metrics.liquidity < t.minLiquidity) {
      return { pass: false, reason: `low liq (${metrics.liquidity.toFixed(1)} < ${t.minLiquidity})` };
    }
    
    // Volume filters by tier
    if (tier === 'A') {
      if (metrics.volume1m < t.minVolume1m) return { pass: false, reason: 'low 1m vol' };
      if (metrics.volume5m < t.minVolume5m) return { pass: false, reason: 'low 5m vol' };
      if (metrics.tradeCount5m < t.minTrades5m) return { pass: false, reason: 'low trades' };
    }
    
    if (tier === 'B') {
      if (metrics.volume5m < t.minVolume5m) return { pass: false, reason: 'low 5m vol' };
    }
    
    if (tier === 'C') {
      if (metrics.volume15m < t.minVolume15m) return { pass: false, reason: 'low 15m vol' };
    }
    
    // Buy pressure filter - we want more buys than sells
    if (metrics.buyPressure < 0.8) {
      return { pass: false, reason: 'weak buy pressure' };
    }
    
    // Volume acceleration - we want increasing volume
    if (metrics.volumeAccel < 0.5) {
      return { pass: false, reason: 'volume dying' };
    }
    
    return { pass: true };
  }

  score(metrics, tier) {
    const weights = config.scoring[tier];
    let score = 0;
    
    if (tier === 'A') {
      // Volume acceleration (capped at 5x)
      score += Math.min(metrics.volumeAccel / 5, 1) * weights.volumeAccel;
      // Trade count
      score += Math.min(metrics.tradeCount5m / 100, 1) * weights.tradeCount;
      // Momentum (positive price movement)
      score += Math.min(Math.max(metrics.priceMove5m, 0) / 0.5, 1) * weights.momentum;
      // Liquidity
      score += Math.min(metrics.liquidity / 20, 1) * weights.liquidity;
      
      // BONUS: Strong buy pressure
      if (metrics.buyPressure > 2) score += 0.15;
      // BONUS: Many unique traders
      if (metrics.uniqueTraders > 20) score += 0.10;
    }
    
    if (tier === 'B') {
      score += Math.min(metrics.volumeAccel / 3, 1) * weights.volumeAccel;
      score += Math.min(Math.max(metrics.priceMove5m, 0) / 0.3, 1) * weights.momentum;
      score += Math.min(metrics.liquidity / 60, 1) * weights.liquidity;
      
      if (metrics.buyPressure > 1.5) score += 0.10;
    }
    
    if (tier === 'C') {
      score += Math.min(metrics.volumeAccel / 2, 1) * weights.volumeAccel;
      score += Math.min(metrics.liquidity / 200, 1) * weights.liquidity;
      score += Math.min(metrics.age / (4 * 60 * 60 * 1000), 1) * weights.age;
    }
    
    return Math.min(score, 1);
  }

  getPositionSize(tier, availableRisk) {
    const t = config.tiers[tier];
    const size = availableRisk * t.positionSizePercent;
    return Math.min(size, t.positionMaxSol);
  }
}
