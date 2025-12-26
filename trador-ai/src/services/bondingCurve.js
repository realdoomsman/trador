// BONDING CURVE PRICE CALCULATOR
// Calculates exact prices from Pump.fun's constant product formula: x * y = k
// Now with VELOCITY TRACKING for detecting momentum

class BondingCurveCalculator {
  constructor() {
    // Pump.fun bonding curve constants
    this.INITIAL_VIRTUAL_TOKEN_RESERVES = 1073000000 * 1e6; // 1.073B tokens
    this.INITIAL_VIRTUAL_SOL_RESERVES = 30 * 1e9; // 30 SOL in lamports
    this.TOTAL_SUPPLY = 1000000000 * 1e6; // 1B tokens
    
    // Graduation threshold (when token moves to Raydium)
    this.GRADUATION_THRESHOLD = 0.8; // 80% of bonding curve filled
    this.GRADUATION_SOL = 85; // ~85 SOL to graduate
    
    // VELOCITY TRACKING - Store progress history for each token
    this.progressHistory = new Map(); // mint -> [{progress, timestamp}, ...]
    this.maxHistoryLength = 20; // Keep last 20 data points per token
    this.velocityWindow = 60000; // 60 seconds for velocity calculation
  }

  // Calculate current price from reserves using constant product formula
  // Price = virtualSolReserves / virtualTokenReserves
  calculatePrice(virtualSolReserves, virtualTokenReserves) {
    if (!virtualTokenReserves || virtualTokenReserves <= 0) return 0;
    
    // Convert from lamports to SOL
    const solReserves = virtualSolReserves / 1e9;
    // Convert from smallest unit to tokens
    const tokenReserves = virtualTokenReserves / 1e6;
    
    // Price per token in SOL
    const priceInSol = solReserves / tokenReserves;
    
    return priceInSol;
  }

  // Calculate price in USD
  calculatePriceUSD(virtualSolReserves, virtualTokenReserves, solPrice) {
    const priceInSol = this.calculatePrice(virtualSolReserves, virtualTokenReserves);
    return priceInSol * solPrice;
  }

  // Calculate market cap from reserves
  calculateMarketCap(virtualSolReserves, virtualTokenReserves, solPrice) {
    const priceUSD = this.calculatePriceUSD(virtualSolReserves, virtualTokenReserves, solPrice);
    return priceUSD * (this.TOTAL_SUPPLY / 1e6);
  }

  // Calculate bonding curve progress (0-100%)
  calculateProgress(virtualSolReserves) {
    const solReserves = virtualSolReserves / 1e9;
    const progress = (solReserves / this.GRADUATION_SOL) * 100;
    return Math.min(100, progress);
  }

  // Check if token is near graduation (80%+ progress)
  isNearGraduation(virtualSolReserves) {
    return this.calculateProgress(virtualSolReserves) >= 80;
  }

  // Calculate price impact for a given buy amount
  // Uses constant product: (x + dx) * (y - dy) = k
  calculateBuyPriceImpact(virtualSolReserves, virtualTokenReserves, buyAmountSol) {
    const k = virtualSolReserves * virtualTokenReserves;
    const newSolReserves = virtualSolReserves + (buyAmountSol * 1e9);
    const newTokenReserves = k / newSolReserves;
    
    const tokensReceived = virtualTokenReserves - newTokenReserves;
    const effectivePrice = (buyAmountSol * 1e9) / tokensReceived;
    const spotPrice = virtualSolReserves / virtualTokenReserves;
    
    const priceImpact = ((effectivePrice / spotPrice) - 1) * 100;
    
    return {
      tokensReceived: tokensReceived / 1e6,
      effectivePrice: effectivePrice / 1e3, // Price per 1000 tokens
      spotPrice: spotPrice / 1e3,
      priceImpact: priceImpact,
      newSolReserves: newSolReserves / 1e9,
      newTokenReserves: newTokenReserves / 1e6
    };
  }

  // Calculate price impact for a given sell amount
  calculateSellPriceImpact(virtualSolReserves, virtualTokenReserves, sellAmountTokens) {
    const k = virtualSolReserves * virtualTokenReserves;
    const newTokenReserves = virtualTokenReserves + (sellAmountTokens * 1e6);
    const newSolReserves = k / newTokenReserves;
    
    const solReceived = virtualSolReserves - newSolReserves;
    const effectivePrice = solReceived / (sellAmountTokens * 1e6);
    const spotPrice = virtualSolReserves / virtualTokenReserves;
    
    const priceImpact = ((spotPrice / effectivePrice) - 1) * 100;
    
    return {
      solReceived: solReceived / 1e9,
      effectivePrice: effectivePrice / 1e3,
      spotPrice: spotPrice / 1e3,
      priceImpact: priceImpact,
      newSolReserves: newSolReserves / 1e9,
      newTokenReserves: newTokenReserves / 1e6
    };
  }

  // Get full bonding curve state analysis
  analyzeState(virtualSolReserves, virtualTokenReserves, solPrice) {
    const progress = this.calculateProgress(virtualSolReserves);
    const priceInSol = this.calculatePrice(virtualSolReserves, virtualTokenReserves);
    const priceUSD = priceInSol * solPrice;
    const marketCap = this.calculateMarketCap(virtualSolReserves, virtualTokenReserves, solPrice);
    
    // Calculate liquidity depth (how much SOL to move price 10%)
    const tenPercentImpact = this.calculateBuyForPriceImpact(
      virtualSolReserves, 
      virtualTokenReserves, 
      10
    );
    
    return {
      // Price info
      priceInSol,
      priceUSD,
      marketCap,
      
      // Reserves
      solReserves: virtualSolReserves / 1e9,
      tokenReserves: virtualTokenReserves / 1e6,
      
      // Progress
      progress,
      isNearGraduation: progress >= 80,
      solToGraduation: Math.max(0, this.GRADUATION_SOL - (virtualSolReserves / 1e9)),
      
      // Liquidity
      liquidityDepth: tenPercentImpact,
      
      // Signals
      signals: this.generateSignals(progress, virtualSolReserves, virtualTokenReserves)
    };
  }

  // Calculate how much SOL needed to move price by X%
  calculateBuyForPriceImpact(virtualSolReserves, virtualTokenReserves, targetImpactPercent) {
    // Binary search for the buy amount
    let low = 0;
    let high = virtualSolReserves; // Max is current reserves
    
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const impact = this.calculateBuyPriceImpact(
        virtualSolReserves, 
        virtualTokenReserves, 
        mid / 1e9
      );
      
      if (Math.abs(impact.priceImpact - targetImpactPercent) < 0.1) {
        return mid / 1e9; // Return in SOL
      }
      
      if (impact.priceImpact < targetImpactPercent) {
        low = mid;
      } else {
        high = mid;
      }
    }
    
    return (low + high) / 2 / 1e9;
  }

  // Generate trading signals based on bonding curve state
  generateSignals(progress, virtualSolReserves, virtualTokenReserves) {
    const signals = [];
    
    // Graduation frenzy signal
    if (progress >= 75 && progress < 85) {
      signals.push({
        type: 'GRADUATION_FRENZY',
        strength: 'HIGH',
        message: 'Token nearing graduation - expect buying pressure'
      });
    }
    
    // Early stage signal
    if (progress < 20) {
      signals.push({
        type: 'EARLY_STAGE',
        strength: 'MEDIUM',
        message: 'Very early - high risk/reward'
      });
    }
    
    // Mid-stage momentum
    if (progress >= 40 && progress < 60) {
      signals.push({
        type: 'MID_STAGE',
        strength: 'MEDIUM',
        message: 'Mid bonding curve - momentum building'
      });
    }
    
    // Post-graduation (if progress > 100, it's on Raydium)
    if (progress >= 100) {
      signals.push({
        type: 'GRADUATED',
        strength: 'INFO',
        message: 'Token graduated to Raydium'
      });
    }
    
    // Liquidity depth signal
    const solReserves = virtualSolReserves / 1e9;
    if (solReserves < 5) {
      signals.push({
        type: 'LOW_LIQUIDITY',
        strength: 'WARNING',
        message: 'Very low liquidity - high slippage risk'
      });
    } else if (solReserves > 50) {
      signals.push({
        type: 'HIGH_LIQUIDITY',
        strength: 'POSITIVE',
        message: 'Good liquidity depth'
      });
    }
    
    return signals;
  }

  // Parse bonding curve data from Pump.fun API response
  parseFromPumpFun(coinData) {
    if (!coinData) return null;
    
    return {
      virtualSolReserves: coinData.virtual_sol_reserves || 0,
      virtualTokenReserves: coinData.virtual_token_reserves || 0,
      realSolReserves: coinData.real_sol_reserves || 0,
      realTokenReserves: coinData.real_token_reserves || 0,
      complete: coinData.complete || false,
      bondingCurve: coinData.bonding_curve,
      associatedBondingCurve: coinData.associated_bonding_curve
    };
  }

  // VELOCITY TRACKING - Record progress and calculate velocity
  recordProgress(mint, virtualSolReserves) {
    const progress = this.calculateProgress(virtualSolReserves);
    const now = Date.now();
    
    if (!this.progressHistory.has(mint)) {
      this.progressHistory.set(mint, []);
    }
    
    const history = this.progressHistory.get(mint);
    history.push({ progress, timestamp: now });
    
    // Keep only recent history
    while (history.length > this.maxHistoryLength) {
      history.shift();
    }
    
    return progress;
  }

  // Calculate velocity (progress change per minute)
  calculateVelocity(mint) {
    const history = this.progressHistory.get(mint);
    if (!history || history.length < 2) return 0;
    
    const now = Date.now();
    const windowStart = now - this.velocityWindow;
    
    // Get data points within the velocity window
    const recentPoints = history.filter(p => p.timestamp >= windowStart);
    if (recentPoints.length < 2) {
      // Use all available points if not enough in window
      if (history.length < 2) return 0;
      const oldest = history[0];
      const newest = history[history.length - 1];
      const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / 60000;
      if (timeDiffMinutes <= 0) return 0;
      return (newest.progress - oldest.progress) / timeDiffMinutes;
    }
    
    const oldest = recentPoints[0];
    const newest = recentPoints[recentPoints.length - 1];
    const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / 60000;
    
    if (timeDiffMinutes <= 0) return 0;
    
    // Progress change per minute
    return (newest.progress - oldest.progress) / timeDiffMinutes;
  }

  // Get full velocity analysis for a token
  getVelocityAnalysis(mint, virtualSolReserves) {
    // Record current progress
    const progress = this.recordProgress(mint, virtualSolReserves);
    const velocity = this.calculateVelocity(mint);
    
    // Classify velocity
    let velocityClass = 'stable';
    if (velocity > 5) velocityClass = 'accelerating_fast';
    else if (velocity > 2) velocityClass = 'accelerating';
    else if (velocity > 0.5) velocityClass = 'growing';
    else if (velocity < -2) velocityClass = 'declining_fast';
    else if (velocity < -0.5) velocityClass = 'declining';
    
    // Estimate time to graduation
    const progressRemaining = 100 - progress;
    const estimatedMinutesToGraduation = velocity > 0.1 ? progressRemaining / velocity : null;
    
    // Is this in the "graduation frenzy" zone with momentum?
    const isGraduationFrenzy = progress >= 60 && progress < 85 && velocity > 1;
    
    // Is this a good entry point?
    const isGoodEntry = (
      (progress >= 60 && progress < 85 && velocity > 0.5) || // Graduation zone with momentum
      (progress >= 40 && progress < 60 && velocity > 2) ||   // Mid-stage with strong momentum
      (progress < 30 && velocity > 3)                         // Early with very strong momentum
    );
    
    return {
      progress,
      velocity,
      velocityClass,
      estimatedMinutesToGraduation,
      isGraduationFrenzy,
      isGoodEntry,
      historyLength: this.progressHistory.get(mint)?.length || 0,
      signals: this.generateVelocitySignals(progress, velocity)
    };
  }

  // Generate velocity-based signals
  generateVelocitySignals(progress, velocity) {
    const signals = [];
    
    // Graduation frenzy with momentum
    if (progress >= 75 && progress < 85 && velocity > 1) {
      signals.push({
        type: 'GRADUATION_FRENZY_MOMENTUM',
        strength: 'VERY_HIGH',
        message: 'Near graduation with strong buying momentum'
      });
    }
    
    // Strong acceleration
    if (velocity > 5) {
      signals.push({
        type: 'RAPID_ACCELERATION',
        strength: 'HIGH',
        message: `Progress accelerating at ${velocity.toFixed(1)}%/min`
      });
    }
    
    // Slowing down near graduation (potential top)
    if (progress >= 70 && velocity < 0.5 && velocity > -0.5) {
      signals.push({
        type: 'MOMENTUM_STALLING',
        strength: 'WARNING',
        message: 'Momentum stalling near graduation'
      });
    }
    
    // Declining (selling pressure)
    if (velocity < -1) {
      signals.push({
        type: 'SELLING_PRESSURE',
        strength: 'WARNING',
        message: `Progress declining at ${Math.abs(velocity).toFixed(1)}%/min`
      });
    }
    
    // Early stage with momentum
    if (progress < 30 && velocity > 2) {
      signals.push({
        type: 'EARLY_MOMENTUM',
        strength: 'MEDIUM',
        message: 'Early stage with strong momentum building'
      });
    }
    
    return signals;
  }

  // Clean up old history entries
  cleanupHistory(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [mint, history] of this.progressHistory) {
      if (history.length === 0 || now - history[history.length - 1].timestamp > maxAge) {
        this.progressHistory.delete(mint);
      }
    }
  }
}

export default new BondingCurveCalculator();
