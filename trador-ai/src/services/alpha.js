// ALPHA ENGINE - Advanced profit maximization strategies
import config from '../config.js';

class AlphaEngine {
  constructor() {
    // Profit optimization state
    this.profitTargets = {
      daily: 0,
      weekly: 0,
      monthly: 0
    };
    
    // Market regime detection
    this.marketRegime = 'neutral'; // bull, bear, neutral, volatile
    this.regimeHistory = [];
    
    // Position sizing optimization
    this.kellyFraction = 0.25; // Conservative Kelly criterion
    
    // Momentum tracking
    this.marketMomentum = [];
    this.sectorMomentum = {};
    
    // Correlation tracking
    this.tokenCorrelations = new Map();
    
    // Whale wallet tracking
    this.whaleWallets = new Map();
    this.smartMoney = new Set();
    
    // Entry timing optimization
    this.optimalEntryTimes = {
      hourly: new Array(24).fill(0),
      daily: new Array(7).fill(0)
    };
    
    // Exit optimization
    this.exitStrategies = {
      scalp: { tp: 0.15, sl: 0.05, timeLimit: 15 },      // 15% TP, 5% SL, 15min
      swing: { tp: 0.50, sl: 0.15, timeLimit: 240 },     // 50% TP, 15% SL, 4hr
      moon: { tp: 2.00, sl: 0.25, timeLimit: 1440 }      // 200% TP, 25% SL, 24hr
    };
  }

  // MARKET REGIME DETECTION - Know when to trade aggressively vs defensively
  detectMarketRegime(recentTokens, solPrice, solPriceHistory) {
    const metrics = {
      avgPriceChange: 0,
      volatility: 0,
      bullishTokens: 0,
      bearishTokens: 0,
      volume: 0
    };

    for (const token of recentTokens) {
      const change = token.priceChange24h || 0;
      metrics.avgPriceChange += change;
      metrics.volatility += Math.abs(change);
      if (change > 10) metrics.bullishTokens++;
      if (change < -10) metrics.bearishTokens++;
      metrics.volume += token.volume24h || 0;
    }

    const count = recentTokens.length || 1;
    metrics.avgPriceChange /= count;
    metrics.volatility /= count;

    // Determine regime
    let regime = 'neutral';
    
    if (metrics.avgPriceChange > 20 && metrics.bullishTokens > count * 0.6) {
      regime = 'bull';
    } else if (metrics.avgPriceChange < -15 && metrics.bearishTokens > count * 0.5) {
      regime = 'bear';
    } else if (metrics.volatility > 50) {
      regime = 'volatile';
    }

    // SOL price trend
    if (solPriceHistory && solPriceHistory.length > 1) {
      const solChange = ((solPrice - solPriceHistory[0]) / solPriceHistory[0]) * 100;
      if (solChange < -5) regime = 'bear'; // SOL dumping = meme coins dump harder
    }

    this.marketRegime = regime;
    this.regimeHistory.push({ regime, timestamp: Date.now(), metrics });
    
    // Keep last 100 regime changes
    if (this.regimeHistory.length > 100) {
      this.regimeHistory = this.regimeHistory.slice(-100);
    }

    return {
      regime,
      metrics,
      recommendation: this.getRegimeRecommendation(regime)
    };
  }

  getRegimeRecommendation(regime) {
    switch (regime) {
      case 'bull':
        return {
          action: 'AGGRESSIVE',
          positionSize: 1.5, // 150% normal size
          strategy: 'moon',
          message: 'Bull market - ride the momentum'
        };
      case 'bear':
        return {
          action: 'DEFENSIVE',
          positionSize: 0.3, // 30% normal size
          strategy: 'scalp',
          message: 'Bear market - quick scalps only'
        };
      case 'volatile':
        return {
          action: 'SELECTIVE',
          positionSize: 0.5,
          strategy: 'swing',
          message: 'High volatility - be selective'
        };
      default:
        return {
          action: 'NORMAL',
          positionSize: 1.0,
          strategy: 'swing',
          message: 'Normal conditions'
        };
    }
  }

  // KELLY CRITERION - Optimal position sizing for maximum growth
  calculateOptimalPositionSize(winRate, avgWin, avgLoss, confidence) {
    // Kelly formula: f* = (bp - q) / b
    // where b = avgWin/avgLoss, p = winRate, q = 1-p
    
    if (winRate <= 0 || avgWin <= 0 || avgLoss <= 0) {
      return 0.02; // Minimum 2%
    }

    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - p;
    
    let kelly = (b * p - q) / b;
    
    // Apply fractional Kelly (more conservative)
    kelly *= this.kellyFraction;
    
    // Adjust for confidence
    kelly *= (confidence / 100);
    
    // Adjust for market regime
    const regimeMultiplier = this.getRegimeRecommendation(this.marketRegime).positionSize;
    kelly *= regimeMultiplier;
    
    // Clamp between 1% and 15%
    return Math.max(0.01, Math.min(0.15, kelly));
  }


  // WHALE TRACKING - Follow the smart money
  async trackWhaleWallet(walletAddress, trades) {
    if (!this.whaleWallets.has(walletAddress)) {
      this.whaleWallets.set(walletAddress, {
        address: walletAddress,
        trades: [],
        winRate: 0,
        totalPnl: 0,
        avgHoldTime: 0,
        isSmartMoney: false
      });
    }

    const whale = this.whaleWallets.get(walletAddress);
    whale.trades.push(...trades);
    
    // Keep last 100 trades
    if (whale.trades.length > 100) {
      whale.trades = whale.trades.slice(-100);
    }

    // Calculate performance
    const completedTrades = whale.trades.filter(t => t.exitPrice);
    if (completedTrades.length >= 5) {
      const wins = completedTrades.filter(t => t.pnl > 0);
      whale.winRate = wins.length / completedTrades.length;
      whale.totalPnl = completedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      whale.avgHoldTime = completedTrades.reduce((sum, t) => sum + (t.holdTime || 0), 0) / completedTrades.length;
      
      // Mark as smart money if consistently profitable
      if (whale.winRate >= 0.6 && whale.totalPnl > 0) {
        whale.isSmartMoney = true;
        this.smartMoney.add(walletAddress);
      }
    }

    return whale;
  }

  // Check if smart money is buying a token
  isSmartMoneyBuying(recentTrades) {
    if (!recentTrades || this.smartMoney.size === 0) return { buying: false };

    const smartBuys = [];
    for (const trade of recentTrades) {
      if (trade.side === 'buy' && this.smartMoney.has(trade.owner)) {
        smartBuys.push({
          wallet: trade.owner,
          amount: trade.volumeUSD,
          time: trade.timestamp
        });
      }
    }

    return {
      buying: smartBuys.length > 0,
      count: smartBuys.length,
      totalVolume: smartBuys.reduce((sum, b) => sum + b.amount, 0),
      wallets: smartBuys.map(b => b.wallet)
    };
  }

  // ENTRY TIMING OPTIMIZATION - Learn best times to trade
  recordTradeTime(hour, dayOfWeek, pnl) {
    // Update hourly performance
    if (!this.optimalEntryTimes.hourlyPnl) {
      this.optimalEntryTimes.hourlyPnl = new Array(24).fill(0);
      this.optimalEntryTimes.hourlyCounts = new Array(24).fill(0);
    }
    this.optimalEntryTimes.hourlyPnl[hour] += pnl;
    this.optimalEntryTimes.hourlyCounts[hour]++;
    this.optimalEntryTimes.hourly[hour] = 
      this.optimalEntryTimes.hourlyPnl[hour] / this.optimalEntryTimes.hourlyCounts[hour];

    // Update daily performance
    if (!this.optimalEntryTimes.dailyPnl) {
      this.optimalEntryTimes.dailyPnl = new Array(7).fill(0);
      this.optimalEntryTimes.dailyCounts = new Array(7).fill(0);
    }
    this.optimalEntryTimes.dailyPnl[dayOfWeek] += pnl;
    this.optimalEntryTimes.dailyCounts[dayOfWeek]++;
    this.optimalEntryTimes.daily[dayOfWeek] = 
      this.optimalEntryTimes.dailyPnl[dayOfWeek] / this.optimalEntryTimes.dailyCounts[dayOfWeek];
  }

  getBestTradingTimes() {
    const hourlyAvg = this.optimalEntryTimes.hourly;
    const dailyAvg = this.optimalEntryTimes.daily;

    // Find best hours
    const bestHours = hourlyAvg
      .map((pnl, hour) => ({ hour, pnl }))
      .filter(h => h.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5)
      .map(h => h.hour);

    // Find best days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const bestDays = dailyAvg
      .map((pnl, day) => ({ day: days[day], pnl }))
      .filter(d => d.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .map(d => d.day);

    return { bestHours, bestDays };
  }

  isOptimalTradingTime() {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();

    const { bestHours, bestDays } = this.getBestTradingTimes();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const isGoodHour = bestHours.length === 0 || bestHours.includes(hour);
    const isGoodDay = bestDays.length === 0 || bestDays.includes(days[day]);

    return {
      isOptimal: isGoodHour && isGoodDay,
      currentHour: hour,
      currentDay: days[day],
      bestHours,
      bestDays
    };
  }

  // DYNAMIC EXIT STRATEGY - Maximize profits, minimize losses
  selectExitStrategy(tokenData, analysis, marketRegime) {
    const momentum = analysis?.multiTimeframe?.signal || 'NEUTRAL';
    const score = analysis?.advancedScore || analysis?.score || 50;
    const smartMoney = analysis?.smartWalletBuying;

    // Strong signals = moon bag strategy
    if (score >= 80 && momentum === 'BULLISH' && smartMoney) {
      return {
        ...this.exitStrategies.moon,
        strategy: 'moon',
        reason: 'Strong signals + smart money'
      };
    }

    // Good signals in bull market = swing
    if (score >= 65 && marketRegime === 'bull') {
      return {
        ...this.exitStrategies.swing,
        strategy: 'swing',
        reason: 'Good setup in bull market'
      };
    }

    // Bear market or weak signals = scalp
    if (marketRegime === 'bear' || score < 60) {
      return {
        ...this.exitStrategies.scalp,
        strategy: 'scalp',
        reason: 'Defensive scalp'
      };
    }

    // Default swing
    return {
      ...this.exitStrategies.swing,
      strategy: 'swing',
      reason: 'Standard setup'
    };
  }

  // COMPOUND GROWTH CALCULATOR
  calculateCompoundGrowth(startingCapital, trades) {
    let capital = startingCapital;
    let peak = capital;
    let maxDrawdown = 0;
    const history = [{ capital, timestamp: Date.now() }];

    for (const trade of trades) {
      const pnl = trade.pnlPercent || 0;
      const positionSize = trade.positionSize || 0.05;
      
      // Apply PnL to position
      const tradeReturn = capital * positionSize * (pnl / 100);
      capital += tradeReturn;
      
      // Track drawdown
      if (capital > peak) peak = capital;
      const drawdown = (peak - capital) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      
      history.push({ 
        capital, 
        pnl: tradeReturn,
        timestamp: trade.exitTime || Date.now() 
      });
    }

    return {
      startingCapital,
      finalCapital: capital,
      totalReturn: ((capital - startingCapital) / startingCapital) * 100,
      maxDrawdown: maxDrawdown * 100,
      tradeCount: trades.length,
      history
    };
  }

  // MOMENTUM SCORING - Detect tokens with strong momentum
  calculateMomentumScore(tokenData) {
    let score = 0;
    
    // Price momentum (weighted by timeframe)
    const pc30m = tokenData.priceChange30m || 0;
    const pc1h = tokenData.priceChange1h || 0;
    const pc4h = tokenData.priceChange4h || 0;
    const pc24h = tokenData.priceChange24h || 0;
    
    // Recent momentum more important
    if (pc30m > 5 && pc30m < 100) score += 20;
    if (pc1h > 10 && pc1h < 150) score += 15;
    if (pc4h > 20 && pc4h < 200) score += 10;
    if (pc24h > 50 && pc24h < 500) score += 5;
    
    // Volume momentum
    const vol30m = tokenData.volume30m || 0;
    const vol1h = tokenData.volume1h || 0;
    const volRatio = vol1h > 0 ? vol30m / (vol1h / 2) : 0;
    if (volRatio > 1.5) score += 15; // Accelerating volume
    
    // Buy pressure momentum
    const bp = tokenData.buyPressure || 50;
    if (bp > 60) score += 10;
    if (bp > 70) score += 10;
    
    return Math.min(100, score);
  }

  // RISK-ADJUSTED RETURNS - Sharpe-like ratio for crypto
  calculateRiskAdjustedScore(trades) {
    if (trades.length < 5) return { sharpe: 0, sortino: 0 };
    
    const returns = trades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Standard deviation
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Downside deviation (for Sortino)
    const negReturns = returns.filter(r => r < 0);
    const downsideVariance = negReturns.length > 0 
      ? negReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negReturns.length 
      : 0;
    const downsideDev = Math.sqrt(downsideVariance);
    
    return {
      sharpe: stdDev > 0 ? avgReturn / stdDev : 0,
      sortino: downsideDev > 0 ? avgReturn / downsideDev : 0,
      avgReturn,
      stdDev,
      downsideDev
    };
  }

  // PROFIT TARGET CALCULATOR - Dynamic targets based on market
  calculateProfitTargets(analysis, marketRegime) {
    const baseTP = 0.25; // 25% base
    const baseSL = 0.10; // 10% base
    
    let tpMultiplier = 1.0;
    let slMultiplier = 1.0;
    
    // Adjust for market regime
    switch (marketRegime) {
      case 'bull':
        tpMultiplier = 1.5;
        slMultiplier = 0.8;
        break;
      case 'bear':
        tpMultiplier = 0.6;
        slMultiplier = 1.2;
        break;
      case 'volatile':
        tpMultiplier = 1.2;
        slMultiplier = 1.3;
        break;
    }
    
    // Adjust for signal strength
    const score = analysis?.advancedScore || analysis?.score || 50;
    if (score >= 80) {
      tpMultiplier *= 1.3;
      slMultiplier *= 0.9;
    } else if (score < 60) {
      tpMultiplier *= 0.7;
      slMultiplier *= 1.1;
    }
    
    // Trailing stop activation
    const trailingActivation = baseTP * tpMultiplier * 0.5; // Activate at 50% of TP
    const trailingDistance = 0.10; // 10% trailing
    
    return {
      takeProfit: baseTP * tpMultiplier,
      stopLoss: baseSL * slMultiplier,
      trailingActivation,
      trailingDistance,
      strategy: this.selectExitStrategy(null, analysis, marketRegime).strategy
    };
  }

  // PORTFOLIO HEAT - Track overall exposure
  calculatePortfolioHeat(positions, totalCapital) {
    if (!positions || positions.length === 0) {
      return { heat: 0, risk: 'none', recommendation: 'Can open new positions' };
    }
    
    let totalExposure = 0;
    let totalRisk = 0;
    
    for (const pos of positions) {
      const posValue = (pos.positionSize || 0.05) * totalCapital;
      const posRisk = posValue * (pos.stopLoss ? (1 - pos.stopLoss / pos.entryPrice) : 0.1);
      totalExposure += posValue;
      totalRisk += posRisk;
    }
    
    const heat = (totalExposure / totalCapital) * 100;
    const riskPercent = (totalRisk / totalCapital) * 100;
    
    let risk = 'low';
    let recommendation = 'Can open new positions';
    
    if (heat > 50) {
      risk = 'high';
      recommendation = 'Reduce exposure - too many positions';
    } else if (heat > 30) {
      risk = 'medium';
      recommendation = 'Be selective with new positions';
    }
    
    return {
      heat,
      riskPercent,
      risk,
      positionCount: positions.length,
      recommendation
    };
  }

  // GET FULL ALPHA STATUS
  getStatus() {
    return {
      marketRegime: this.marketRegime,
      regimeRecommendation: this.getRegimeRecommendation(this.marketRegime),
      kellyFraction: this.kellyFraction,
      smartMoneyCount: this.smartMoney.size,
      whaleWalletsTracked: this.whaleWallets.size,
      optimalTimes: this.getBestTradingTimes(),
      isOptimalTime: this.isOptimalTradingTime(),
      exitStrategies: this.exitStrategies
    };
  }

  // SERIALIZE STATE FOR SAVING
  toJSON() {
    return {
      marketRegime: this.marketRegime,
      regimeHistory: this.regimeHistory.slice(-20),
      kellyFraction: this.kellyFraction,
      optimalEntryTimes: this.optimalEntryTimes,
      exitStrategies: this.exitStrategies,
      smartMoney: Array.from(this.smartMoney),
      profitTargets: this.profitTargets
    };
  }

  // LOAD STATE
  fromJSON(data) {
    if (!data) return;
    this.marketRegime = data.marketRegime || 'neutral';
    this.regimeHistory = data.regimeHistory || [];
    this.kellyFraction = data.kellyFraction || 0.25;
    this.optimalEntryTimes = data.optimalEntryTimes || this.optimalEntryTimes;
    this.exitStrategies = data.exitStrategies || this.exitStrategies;
    this.smartMoney = new Set(data.smartMoney || []);
    this.profitTargets = data.profitTargets || this.profitTargets;
  }
}

export default new AlphaEngine();
