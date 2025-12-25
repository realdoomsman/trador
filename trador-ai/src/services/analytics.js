import storage from './storage.js';
import helius from './helius.js';
import config from '../config.js';

class AnalyticsEngine {
  constructor() {
    this.patterns = {
      pumpSignals: [],
      dumpSignals: [],
      optimalRanges: {},
      smartWallets: new Set(),
      winningCombos: []
    };
    this.backtestResults = null;
  }

  // PATTERN RECOGNITION - Find what signals lead to pumps
  async analyzePatterns(dataPoints) {
    if (dataPoints.length < 50) return null;

    const pumps = dataPoints.filter(d => d.outcome === 'pump');
    const dumps = dataPoints.filter(d => d.outcome === 'dump');
    
    if (pumps.length < 10 || dumps.length < 10) return null;

    console.log(`Analyzing patterns from ${pumps.length} pumps and ${dumps.length} dumps...`);

    // Find optimal ranges for each signal
    const signals = [
      'marketCap', 'liquidity', 'volume24h', 'holders', 'buyPressure',
      'priceChange1h', 'priceChange24h', 'volumeToMcap', 'top10Percent',
      'whalePercent', 'distributionScore'
    ];

    const optimalRanges = {};
    
    for (const signal of signals) {
      const pumpValues = pumps.map(p => this.getSignalValue(p, signal)).filter(v => v !== null);
      const dumpValues = dumps.map(d => this.getSignalValue(d, signal)).filter(v => v !== null);
      
      if (pumpValues.length < 5 || dumpValues.length < 5) continue;

      // Find ranges where pumps are more common
      const pumpAvg = pumpValues.reduce((a, b) => a + b, 0) / pumpValues.length;
      const dumpAvg = dumpValues.reduce((a, b) => a + b, 0) / dumpValues.length;
      const pumpMin = Math.min(...pumpValues);
      const pumpMax = Math.max(...pumpValues);
      
      // Calculate percentiles for pump signals
      pumpValues.sort((a, b) => a - b);
      const p25 = pumpValues[Math.floor(pumpValues.length * 0.25)];
      const p75 = pumpValues[Math.floor(pumpValues.length * 0.75)];

      optimalRanges[signal] = {
        pumpAvg,
        dumpAvg,
        optimalMin: p25,
        optimalMax: p75,
        direction: pumpAvg > dumpAvg ? 'higher_better' : 'lower_better',
        importance: Math.abs(pumpAvg - dumpAvg) / Math.max(pumpAvg, dumpAvg, 1)
      };
    }

    // Find winning signal combinations
    const winningCombos = this.findWinningCombinations(pumps, dumps, optimalRanges);

    this.patterns = {
      ...this.patterns,
      optimalRanges,
      winningCombos,
      sampleSize: dataPoints.length,
      pumpRate: pumps.length / dataPoints.length,
      analyzedAt: Date.now()
    };

    return this.patterns;
  }

  getSignalValue(dataPoint, signal) {
    // Check in different locations
    const locations = [
      dataPoint.signals,
      dataPoint.priceSignals,
      dataPoint.marketSignals,
      dataPoint.volumeSignals,
      dataPoint.tradingSignals,
      dataPoint.holderSignals,
      dataPoint.securitySignals,
      dataPoint.token
    ];

    for (const loc of locations) {
      if (loc && loc[signal] !== undefined && loc[signal] !== null) {
        return parseFloat(loc[signal]);
      }
    }
    return null;
  }

  findWinningCombinations(pumps, dumps, ranges) {
    const combos = [];
    const signalKeys = Object.keys(ranges);

    // Test each pair of signals
    for (let i = 0; i < signalKeys.length; i++) {
      for (let j = i + 1; j < signalKeys.length; j++) {
        const sig1 = signalKeys[i];
        const sig2 = signalKeys[j];
        const range1 = ranges[sig1];
        const range2 = ranges[sig2];

        // Count pumps/dumps in optimal range for both signals
        let pumpInRange = 0;
        let dumpInRange = 0;

        for (const p of pumps) {
          const v1 = this.getSignalValue(p, sig1);
          const v2 = this.getSignalValue(p, sig2);
          if (v1 >= range1.optimalMin && v1 <= range1.optimalMax &&
              v2 >= range2.optimalMin && v2 <= range2.optimalMax) {
            pumpInRange++;
          }
        }

        for (const d of dumps) {
          const v1 = this.getSignalValue(d, sig1);
          const v2 = this.getSignalValue(d, sig2);
          if (v1 >= range1.optimalMin && v1 <= range1.optimalMax &&
              v2 >= range2.optimalMin && v2 <= range2.optimalMax) {
            dumpInRange++;
          }
        }

        const total = pumpInRange + dumpInRange;
        if (total >= 5) {
          const winRate = pumpInRange / total;
          if (winRate >= 0.6) {
            combos.push({
              signals: [sig1, sig2],
              winRate,
              sampleSize: total,
              pumpCount: pumpInRange
            });
          }
        }
      }
    }

    return combos.sort((a, b) => b.winRate - a.winRate).slice(0, 10);
  }

  // RISK SCORING - Score token 0-100
  scoreToken(tokenData, deepAnalysis) {
    let score = 50; // Start neutral
    const flags = { red: [], yellow: [], green: [] };

    // Market cap scoring
    const mcap = tokenData.usd_market_cap || tokenData.marketCap || 0;
    if (mcap >= 20000 && mcap <= 200000) { score += 10; flags.green.push('Good mcap range'); }
    else if (mcap < 5000) { score -= 15; flags.red.push('Mcap too low'); }
    else if (mcap > 1000000) { score -= 5; flags.yellow.push('Mcap high'); }

    // Liquidity scoring
    const liq = tokenData.virtual_sol_reserves || tokenData.liquidity || 0;
    if (liq >= 20) { score += 10; flags.green.push('Strong liquidity'); }
    else if (liq >= 5) { score += 5; }
    else if (liq < 2) { score -= 15; flags.red.push('Low liquidity'); }

    // Volume scoring
    const vol = tokenData.volume24h || 0;
    const volToMcap = mcap > 0 ? vol / mcap : 0;
    if (volToMcap > 0.5) { score += 10; flags.green.push('High volume/mcap'); }
    else if (volToMcap > 0.1) { score += 5; }
    else if (volToMcap < 0.01) { score -= 5; flags.yellow.push('Low volume'); }

    // Buy pressure
    const buyPressure = tokenData.buyPressure || 50;
    if (buyPressure > 60) { score += 10; flags.green.push('Buy pressure'); }
    else if (buyPressure < 40) { score -= 10; flags.red.push('Sell pressure'); }

    // Holder analysis
    if (deepAnalysis?.holders) {
      const h = deepAnalysis.holders;
      if (h.distributionScore > 60) { score += 10; flags.green.push('Good distribution'); }
      else if (h.distributionScore < 30) { score -= 15; flags.red.push('Concentrated holders'); }
      
      if (h.whalePercent > 50) { score -= 15; flags.red.push('Whale dominated'); }
      if (h.top1Percent > 30) { score -= 10; flags.red.push('Top holder >30%'); }
    }

    // Security analysis
    if (deepAnalysis?.security) {
      const s = deepAnalysis.security;
      if (s.hasMintRisk) { score -= 10; flags.yellow.push('Mintable'); }
      if (s.hasFreezeRisk) { score -= 10; flags.yellow.push('Freezable'); }
      if (s.isLpBurned) { score += 10; flags.green.push('LP burned'); }
      if (s.creatorPercentage > 20) { score -= 10; flags.red.push('Creator holds >20%'); }
    }

    // Recent trades
    if (deepAnalysis?.recentTrades) {
      const t = deepAnalysis.recentTrades;
      if (t.hasWhaleInterest) { score += 5; flags.green.push('Whale interest'); }
      if (t.isBuyHeavy) { score += 5; flags.green.push('Buy heavy'); }
      if (t.isSellHeavy) { score -= 10; flags.red.push('Sell heavy'); }
    }

    // Price momentum
    const change1h = tokenData.priceChange1h || 0;
    const change24h = tokenData.priceChange24h || 0;
    if (change1h > 10 && change1h < 50) { score += 5; flags.green.push('Good 1h momentum'); }
    else if (change1h > 100) { score -= 5; flags.yellow.push('Overextended'); }
    else if (change1h < -20) { score -= 10; flags.red.push('Dumping'); }

    // Apply learned patterns
    if (this.patterns.optimalRanges) {
      score += this.applyLearnedPatterns(tokenData, deepAnalysis);
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      flags,
      recommendation: score >= 70 ? 'STRONG_BUY' : score >= 60 ? 'BUY' : score >= 45 ? 'HOLD' : 'AVOID'
    };
  }

  applyLearnedPatterns(tokenData, deepAnalysis) {
    let bonus = 0;
    const ranges = this.patterns.optimalRanges;
    
    for (const [signal, range] of Object.entries(ranges)) {
      const value = this.getSignalValue({ token: tokenData, ...deepAnalysis }, signal);
      if (value === null) continue;

      if (value >= range.optimalMin && value <= range.optimalMax) {
        bonus += range.importance * 5;
      }
    }

    return Math.min(15, bonus);
  }


  // SMART ENTRY/EXIT - Dynamic TP/SL based on momentum
  calculateDynamicExits(tokenData, riskProfile) {
    const baseConfig = config.riskProfiles[riskProfile];
    const momentum = this.calculateMomentum(tokenData);
    const volatility = this.estimateVolatility(tokenData);

    // Adjust TP/SL based on momentum and volatility
    let tpMultiplier = 1;
    let slMultiplier = 1;

    // Strong momentum = wider TP
    if (momentum > 0.7) { tpMultiplier = 1.5; }
    else if (momentum > 0.5) { tpMultiplier = 1.2; }
    else if (momentum < 0.3) { tpMultiplier = 0.8; }

    // High volatility = wider SL
    if (volatility > 0.5) { slMultiplier = 1.3; }
    else if (volatility < 0.2) { slMultiplier = 0.8; }

    const price = tokenData.price || 0;
    
    return {
      takeProfit: price * (1 + baseConfig.takeProfit * tpMultiplier),
      stopLoss: price * (1 - baseConfig.stopLoss * slMultiplier),
      trailingStop: baseConfig.stopLoss * 0.7, // Trailing stop at 70% of SL
      momentum,
      volatility
    };
  }

  calculateMomentum(tokenData) {
    const changes = [
      tokenData.priceChange30m || 0,
      tokenData.priceChange1h || 0,
      tokenData.priceChange4h || 0
    ];
    
    // Weighted average (recent more important)
    const weights = [0.5, 0.3, 0.2];
    let momentum = 0;
    
    for (let i = 0; i < changes.length; i++) {
      // Normalize to 0-1 range
      const normalized = Math.min(1, Math.max(0, (changes[i] + 50) / 100));
      momentum += normalized * weights[i];
    }
    
    return momentum;
  }

  estimateVolatility(tokenData) {
    const changes = [
      Math.abs(tokenData.priceChange30m || 0),
      Math.abs(tokenData.priceChange1h || 0),
      Math.abs(tokenData.priceChange4h || 0),
      Math.abs(tokenData.priceChange24h || 0)
    ];
    
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    return Math.min(1, avgChange / 50); // Normalize to 0-1
  }

  // BACKTESTING - Test strategy against historical data
  async runBacktest(strategy, dataPoints) {
    if (dataPoints.length < 100) {
      return { error: 'Not enough data for backtest' };
    }

    const results = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      sharpeRatio: 0,
      trades: []
    };

    let balance = 1000; // Virtual $1000
    let peak = balance;
    const pnls = [];

    for (const dp of dataPoints) {
      if (!dp.outcome || dp.outcome === 'neutral') continue;

      // Would we have traded this?
      const score = this.scoreToken(dp.token || dp, {
        holders: dp.holderSignals,
        security: dp.securitySignals,
        recentTrades: dp.recentTradeSignals
      });

      const wouldTrade = strategy.minScore ? score.score >= strategy.minScore : score.score >= 60;
      
      if (!wouldTrade) continue;

      results.totalTrades++;
      const pnl = dp.pnlPercent || 0;
      pnls.push(pnl);

      if (pnl > 0) {
        results.wins++;
        results.avgWin = (results.avgWin * (results.wins - 1) + pnl) / results.wins;
      } else {
        results.losses++;
        results.avgLoss = (results.avgLoss * (results.losses - 1) + Math.abs(pnl)) / Math.max(1, results.losses);
      }

      results.totalPnl += pnl;
      balance *= (1 + pnl / 100);
      
      if (balance > peak) peak = balance;
      const drawdown = (peak - balance) / peak;
      if (drawdown > results.maxDrawdown) results.maxDrawdown = drawdown;

      results.trades.push({
        symbol: dp.token?.symbol || 'Unknown',
        score: score.score,
        pnl,
        outcome: dp.outcome
      });
    }

    results.winRate = results.totalTrades > 0 ? results.wins / results.totalTrades : 0;
    results.finalBalance = balance;
    results.returnPercent = ((balance - 1000) / 1000) * 100;

    // Calculate Sharpe ratio
    if (pnls.length > 1) {
      const avgPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
      const variance = pnls.reduce((sum, p) => sum + Math.pow(p - avgPnl, 2), 0) / pnls.length;
      const stdDev = Math.sqrt(variance);
      results.sharpeRatio = stdDev > 0 ? avgPnl / stdDev : 0;
    }

    this.backtestResults = results;
    return results;
  }

  // MULTI-TIMEFRAME ANALYSIS
  analyzeMultiTimeframe(tokenData) {
    const tf = {
      '30m': { change: tokenData.priceChange30m || 0, volume: tokenData.volume30m || 0 },
      '1h': { change: tokenData.priceChange1h || 0, volume: tokenData.volume1h || 0 },
      '4h': { change: tokenData.priceChange4h || 0, volume: tokenData.volume4h || 0 },
      '24h': { change: tokenData.priceChange24h || 0, volume: tokenData.volume24h || 0 }
    };

    // Trend alignment
    const trends = Object.values(tf).map(t => t.change > 0 ? 1 : t.change < 0 ? -1 : 0);
    const trendAlignment = Math.abs(trends.reduce((a, b) => a + b, 0)) / trends.length;

    // Volume confirmation
    const volumeIncreasing = tf['30m'].volume > tf['1h'].volume / 2;

    // Momentum acceleration
    const momentumAccel = tf['30m'].change > tf['1h'].change / 2;

    return {
      timeframes: tf,
      trendAlignment, // 1 = all aligned, 0 = mixed
      allBullish: trends.every(t => t >= 0),
      allBearish: trends.every(t => t <= 0),
      volumeConfirming: volumeIncreasing,
      momentumAccelerating: momentumAccel,
      signal: trendAlignment > 0.7 && trends[0] > 0 ? 'BULLISH' : 
              trendAlignment > 0.7 && trends[0] < 0 ? 'BEARISH' : 'NEUTRAL'
    };
  }

  // SMART WALLET TRACKING
  async trackSmartWallets(recentTrades) {
    if (!recentTrades?.items) return;

    // Find wallets that consistently buy before pumps
    for (const trade of recentTrades.items) {
      if (trade.side === 'buy' && trade.volumeUSD > 500) {
        // Track this wallet
        this.patterns.smartWallets.add(trade.owner);
      }
    }

    // Limit size
    if (this.patterns.smartWallets.size > 1000) {
      const arr = [...this.patterns.smartWallets];
      this.patterns.smartWallets = new Set(arr.slice(-500));
    }
  }

  isSmartWalletBuying(recentTrades) {
    if (!recentTrades?.items || this.patterns.smartWallets.size === 0) return false;

    const recentBuyers = recentTrades.items
      .filter(t => t.side === 'buy')
      .map(t => t.owner);

    const smartBuyers = recentBuyers.filter(w => this.patterns.smartWallets.has(w));
    return smartBuyers.length > 0;
  }

  // COMPREHENSIVE ANALYSIS - Combine everything
  async analyzeToken(tokenData, deepAnalysis) {
    const score = this.scoreToken(tokenData, deepAnalysis);
    const multiTF = this.analyzeMultiTimeframe(tokenData);
    const exits = this.calculateDynamicExits(tokenData, 'medium');
    const smartWalletBuying = this.isSmartWalletBuying(deepAnalysis?.recentTrades);

    // Track smart wallets
    if (deepAnalysis?.recentTrades) {
      await this.trackSmartWallets(deepAnalysis.recentTrades);
    }

    // Final recommendation
    let finalScore = score.score;
    
    // Boost for aligned timeframes
    if (multiTF.allBullish && multiTF.trendAlignment > 0.7) finalScore += 10;
    if (multiTF.allBearish) finalScore -= 15;
    
    // Boost for smart wallet activity
    if (smartWalletBuying) finalScore += 10;
    
    // Boost for volume confirmation
    if (multiTF.volumeConfirming && multiTF.momentumAccelerating) finalScore += 5;

    finalScore = Math.max(0, Math.min(100, finalScore));

    return {
      score: finalScore,
      baseScore: score.score,
      flags: score.flags,
      recommendation: finalScore >= 75 ? 'STRONG_BUY' : 
                      finalScore >= 65 ? 'BUY' : 
                      finalScore >= 50 ? 'HOLD' : 'AVOID',
      multiTimeframe: multiTF,
      exits,
      smartWalletBuying,
      confidence: this.calculateConfidence(score, multiTF, smartWalletBuying)
    };
  }

  calculateConfidence(score, multiTF, smartWallet) {
    let confidence = 50;
    
    // Score confidence
    if (score.score >= 70) confidence += 15;
    else if (score.score >= 60) confidence += 10;
    else if (score.score < 40) confidence -= 15;
    
    // Timeframe alignment
    if (multiTF.trendAlignment > 0.8) confidence += 15;
    else if (multiTF.trendAlignment < 0.3) confidence -= 10;
    
    // Smart wallet
    if (smartWallet) confidence += 10;
    
    // Flags
    confidence -= score.flags.red.length * 5;
    confidence += score.flags.green.length * 3;
    
    return Math.max(0, Math.min(100, confidence));
  }

  getPatterns() {
    return this.patterns;
  }

  getBacktestResults() {
    return this.backtestResults;
  }
}

export default new AnalyticsEngine();
