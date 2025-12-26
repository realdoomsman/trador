// BONDING CURVE PRICE CALCULATOR
// Calculates exact prices from Pump.fun's constant product formula: x * y = k

class BondingCurveCalculator {
  constructor() {
    // Pump.fun bonding curve constants
    this.INITIAL_VIRTUAL_TOKEN_RESERVES = 1073000000 * 1e6; // 1.073B tokens
    this.INITIAL_VIRTUAL_SOL_RESERVES = 30 * 1e9; // 30 SOL in lamports
    this.TOTAL_SUPPLY = 1000000000 * 1e6; // 1B tokens
    
    // Graduation threshold (when token moves to Raydium)
    this.GRADUATION_THRESHOLD = 0.8; // 80% of bonding curve filled
    this.GRADUATION_SOL = 85; // ~85 SOL to graduate
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
}

export default new BondingCurveCalculator();
