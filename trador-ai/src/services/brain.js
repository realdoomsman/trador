import config from '../config.js';
import storage from './storage.js';
import gemini from './gemini.js';
import helius from './helius.js';
import analytics from './analytics.js';

class TradingBrain {
  constructor() {
    this.state = {
      confidence: 0,
      dataPoints: 0,
      dataSizeBytes: 0,
      lastTrainingUpdate: null,
      patterns: null,
      isLearning: true,
      canVirtualTrade: false,
      canLiveTrade: false,
      riskProfile: 'medium',
      virtualTrades: [],
      pnl: { daily: 0, weekly: 0, monthly: 0, allTime: 0 },
      stats: {
        totalAnalyzed: 0,
        totalVirtualTrades: 0,
        virtualWins: 0,
        virtualLosses: 0,
        avgWinPercent: 0,
        avgLossPercent: 0,
        // New learning stats
        tokensTracked: 0,
        pumps: 0,
        dumps: 0,
        neutral: 0
      },
      backtestResults: null,
      learnedPatterns: null
    };
    this.activeVirtualPositions = new Map();
    this.seenTokens = new Set();
    this.dataBuffer = [];
    this.bufferFlushSize = 100;
    
    // Price tracking for learning outcomes
    this.trackedTokens = new Map();
    this.maxTrackedTokens = 500;
    this.trackDuration = 30 * 60 * 1000;
  }

  async initialize() {
    console.log('Initializing Trading Brain...');
    
    // Load saved state
    const savedState = await storage.loadModelState();
    if (savedState) {
      this.state = { ...this.state, ...savedState };
      console.log(`Loaded state: ${this.state.dataPoints} data points, ${this.state.confidence}% confidence`);
    }
    
    // Get current data size
    this.state.dataSizeBytes = await storage.getDataSize();
    this.state.dataPoints = await storage.getDataPointCount();
    
    // Load virtual trades for PnL calculation
    const virtualTrades = await storage.loadVirtualTrades(30);
    this.state.virtualTrades = virtualTrades;
    this.calculatePnL();
    
    // Update capabilities
    this.updateCapabilities();
    
    console.log(`Brain initialized. Confidence: ${this.state.confidence}%, Can virtual trade: ${this.state.canVirtualTrade}`);
  }

  updateCapabilities() {
    // Determine what the AI can do based on data and confidence
    this.state.canVirtualTrade = 
      this.state.dataPoints >= config.minDataPointsForVirtualTrading &&
      this.state.confidence >= config.minConfidenceVirtual;
    
    this.state.canLiveTrade = 
      this.state.canVirtualTrade &&
      this.state.confidence >= config.minConfidenceLive &&
      this.state.stats.virtualWins > 10 &&
      (this.state.stats.virtualWins / Math.max(1, this.state.stats.totalVirtualTrades)) > 0.55;
  }

  setRiskProfile(profile) {
    if (['low', 'medium', 'high'].includes(profile)) {
      this.state.riskProfile = profile;
      this.saveState();
    }
  }

  getRiskConfig() {
    return config.riskProfiles[this.state.riskProfile];
  }

  // Collect data point for learning
  async collectDataPoint(tokenData, priceHistory, outcome = null) {
    const dataPoint = {
      timestamp: Date.now(),
      token: {
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        name: tokenData.name,
        marketCap: tokenData.usd_market_cap,
        liquidity: tokenData.virtual_sol_reserves,
        holders: tokenData.holder_count,
        ageMinutes: (Date.now() - new Date(tokenData.created_timestamp).getTime()) / 60000
      },
      priceHistory,
      outcome, // null if still collecting, or { pnlPercent, holdTime, exitReason }
      marketContext: {
        solPrice: await helius.getSolPrice(),
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      }
    };

    this.dataBuffer.push(dataPoint);
    this.state.totalAnalyzed++;

    // Flush buffer periodically
    if (this.dataBuffer.length >= this.bufferFlushSize) {
      await this.flushDataBuffer();
    }

    return dataPoint;
  }

  async flushDataBuffer() {
    if (this.dataBuffer.length === 0) return;
    
    await storage.saveBatch('market_data', this.dataBuffer);
    this.state.dataPoints += this.dataBuffer.length;
    this.dataBuffer = [];
    
    // Update data size
    this.state.dataSizeBytes = await storage.getDataSize();
    
    // Recalculate confidence
    await this.updateConfidence();
    this.saveState();
  }

  async updateConfidence() {
    // Base confidence from data quantity
    let confidence = Math.min(50, (this.state.dataPoints / config.minDataPointsForVirtualTrading) * 50);
    
    // Add confidence from virtual trading performance
    if (this.state.stats.totalVirtualTrades > 0) {
      const winRate = this.state.stats.virtualWins / this.state.stats.totalVirtualTrades;
      const performanceBonus = Math.min(30, winRate * 50);
      confidence += performanceBonus;
    }
    
    // Add confidence from pattern recognition
    if (this.state.patterns?.confidenceInPatterns) {
      confidence += Math.min(20, this.state.patterns.confidenceInPatterns * 0.2);
    }
    
    // Apply decay if no recent data
    const hoursSinceUpdate = (Date.now() - (this.state.lastTrainingUpdate || 0)) / 3600000;
    confidence *= Math.max(0.5, 1 - (hoursSinceUpdate * config.confidenceDecayRate));
    
    this.state.confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    this.state.lastTrainingUpdate = Date.now();
    this.updateCapabilities();
  }

  // Analyze a token for potential trade
  async analyzeToken(tokenData) {
    // Skip if already seen recently
    if (this.seenTokens.has(tokenData.mint)) {
      return null;
    }
    this.seenTokens.add(tokenData.mint);
    
    // Clean up old seen tokens
    if (this.seenTokens.size > 10000) {
      this.seenTokens.clear();
    }

    const riskConfig = this.getRiskConfig();
    
    // Basic filters
    const marketCap = tokenData.usd_market_cap || 0;
    if (marketCap < riskConfig.minMarketCap || marketCap > riskConfig.maxMarketCap) {
      return null;
    }

    // Get additional data
    const [activity, solPrice] = await Promise.all([
      helius.analyzeTokenActivity(tokenData.mint, 1),
      helius.getSolPrice()
    ]);

    // Prepare data for Gemini
    const enrichedData = {
      ...tokenData,
      marketCap,
      holders: tokenData.holder_count,
      liquidity: tokenData.virtual_sol_reserves,
      ageMinutes: (Date.now() - new Date(tokenData.created_timestamp).getTime()) / 60000,
      txCount: activity.transactionCount,
      uniqueWallets: activity.uniqueWallets
    };

    const marketContext = {
      solPrice,
      sentiment: 'neutral',
      pumpfunActivity: 'normal'
    };

    // Get deep analysis for this token
    let deepAnalysis = null;
    try {
      deepAnalysis = await helius.getDeepTokenAnalysis(tokenData.mint);
    } catch (err) {
      // Continue without deep analysis
    }

    // Use advanced analytics engine
    const advancedAnalysis = await analytics.analyzeToken(enrichedData, deepAnalysis);
    
    // Get AI analysis (Gemini or rule-based)
    const geminiAnalysis = await gemini.analyzeToken(enrichedData, marketContext, this.state.patterns);
    
    // Combine analyses
    const combinedAnalysis = {
      ...geminiAnalysis,
      advancedScore: advancedAnalysis.score,
      advancedRecommendation: advancedAnalysis.recommendation,
      multiTimeframe: advancedAnalysis.multiTimeframe,
      smartWalletBuying: advancedAnalysis.smartWalletBuying,
      dynamicExits: advancedAnalysis.exits,
      flags: advancedAnalysis.flags,
      finalConfidence: advancedAnalysis.confidence
    };
    
    // Collect data point for learning
    await this.collectDataPoint(tokenData, null, null);
    
    // Track this token to learn outcome later (with deep analysis)
    await this.trackToken(enrichedData, combinedAnalysis);

    return {
      token: enrichedData,
      analysis: combinedAnalysis,
      shouldTrade: this.shouldTradeAdvanced(combinedAnalysis)
    };
  }

  shouldTradeAdvanced(analysis) {
    if (!analysis) return false;
    
    // Use advanced score
    const score = analysis.advancedScore || analysis.confidence || 0;
    const rec = analysis.advancedRecommendation || analysis.recommendation;
    
    if (rec === 'AVOID') return false;
    
    // Check multi-timeframe alignment
    if (analysis.multiTimeframe?.allBearish) return false;
    
    // Risk profile thresholds
    const minScore = this.state.riskProfile === 'low' ? 70 : 
                     this.state.riskProfile === 'medium' ? 60 : 50;
    
    // Boost threshold if smart wallet is buying
    const adjustedMin = analysis.smartWalletBuying ? minScore - 5 : minScore;
    
    return score >= adjustedMin && (rec === 'BUY' || rec === 'STRONG_BUY');
  }

  shouldTrade(analysis) {
    // Fallback to old method if no advanced analysis
    return this.shouldTradeAdvanced(analysis);
  }

  // Execute virtual trade with dynamic exits
  async executeVirtualTrade(tokenData, analysis) {
    if (!this.state.canVirtualTrade) {
      console.log('Cannot virtual trade yet - insufficient learning');
      return null;
    }

    const riskConfig = this.getRiskConfig();
    const currentPrice = tokenData.price || (tokenData.usd_market_cap / 1e9);
    
    const trade = {
      id: `vt_${Date.now()}_${tokenData.mint.slice(0, 8)}`,
      type: 'virtual',
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      entryPrice: currentPrice,
      entryMarketCap: tokenData.usd_market_cap,
      entryTime: Date.now(),
      positionSize: riskConfig.maxPositionSize,
      stopLoss: currentPrice * (1 - riskConfig.stopLoss),
      takeProfit: currentPrice * (1 + riskConfig.takeProfit),
      analysis: analysis,
      status: 'open'
    };

    this.activeVirtualPositions.set(trade.id, trade);
    this.state.stats.totalVirtualTrades++;
    
    console.log(`Virtual trade opened: ${trade.symbol} @ $${currentPrice.toFixed(8)}`);
    
    return trade;
  }

  // Update virtual positions
  async updateVirtualPositions() {
    for (const [id, position] of this.activeVirtualPositions) {
      try {
        const tokenData = await helius.getPumpFunToken(position.mint);
        if (!tokenData) continue;

        const currentPrice = tokenData.price || (tokenData.usd_market_cap / 1e9);
        const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        // Check exit conditions
        let shouldExit = false;
        let exitReason = '';

        if (currentPrice <= position.stopLoss) {
          shouldExit = true;
          exitReason = 'stop_loss';
        } else if (currentPrice >= position.takeProfit) {
          shouldExit = true;
          exitReason = 'take_profit';
        } else if (Date.now() - position.entryTime > 24 * 60 * 60 * 1000) {
          shouldExit = true;
          exitReason = 'time_limit';
        }

        if (shouldExit) {
          await this.closeVirtualPosition(id, currentPrice, exitReason);
        }
      } catch (err) {
        console.error(`Error updating position ${id}:`, err.message);
      }
    }
  }

  async closeVirtualPosition(id, exitPrice, exitReason) {
    const position = this.activeVirtualPositions.get(id);
    if (!position) return;

    const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
    const holdTimeMinutes = (Date.now() - position.entryTime) / 60000;

    const closedTrade = {
      ...position,
      exitPrice,
      exitTime: Date.now(),
      exitReason,
      pnlPercent,
      holdTimeMinutes,
      status: 'closed'
    };

    // Update stats
    if (pnlPercent > 0) {
      this.state.stats.virtualWins++;
      this.state.stats.avgWinPercent = 
        (this.state.stats.avgWinPercent * (this.state.stats.virtualWins - 1) + pnlPercent) / this.state.stats.virtualWins;
    } else {
      this.state.stats.virtualLosses++;
      this.state.stats.avgLossPercent = 
        (this.state.stats.avgLossPercent * (this.state.stats.virtualLosses - 1) + Math.abs(pnlPercent)) / Math.max(1, this.state.stats.virtualLosses);
    }

    // Save trade
    await storage.saveVirtualTrade(closedTrade);
    this.state.virtualTrades.push(closedTrade);
    
    // Learn from trade
    const evaluation = await gemini.evaluateTrade({
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice,
      pnlPercent,
      holdTimeMinutes,
      entryMarketCap: position.entryMarketCap,
      exitMarketCap: exitPrice * 1e9,
      entryReasoning: position.analysis?.reasoning
    });

    if (evaluation) {
      await this.collectDataPoint(position, null, { pnlPercent, holdTimeMinutes, exitReason, evaluation });
    }

    this.activeVirtualPositions.delete(id);
    this.calculatePnL();
    this.updateCapabilities();
    this.saveState();

    console.log(`Virtual trade closed: ${position.symbol} | PnL: ${pnlPercent.toFixed(2)}% | Reason: ${exitReason}`);
    
    return closedTrade;
  }

  calculatePnL() {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const closedTrades = this.state.virtualTrades.filter(t => t.status === 'closed');
    
    this.state.pnl = {
      daily: closedTrades.filter(t => t.exitTime > dayAgo).reduce((sum, t) => sum + t.pnlPercent, 0),
      weekly: closedTrades.filter(t => t.exitTime > weekAgo).reduce((sum, t) => sum + t.pnlPercent, 0),
      monthly: closedTrades.filter(t => t.exitTime > monthAgo).reduce((sum, t) => sum + t.pnlPercent, 0),
      allTime: closedTrades.reduce((sum, t) => sum + t.pnlPercent, 0)
    };
  }

  // Periodic pattern analysis
  async analyzePatterns() {
    console.log('Running pattern analysis...');
    const trainingData = await storage.loadTrainingData('market_data', 500);
    
    if (trainingData.length < 100) {
      console.log('Not enough data for pattern analysis');
      return;
    }

    const patterns = await gemini.analyzePatterns(trainingData);
    if (patterns) {
      this.state.patterns = patterns;
      await this.updateConfidence();
      this.saveState();
      console.log('Pattern analysis complete. Confidence in patterns:', patterns.confidenceInPatterns);
    }
  }

  async saveState() {
    await storage.saveModelState({
      confidence: this.state.confidence,
      dataPoints: this.state.dataPoints,
      dataSizeBytes: this.state.dataSizeBytes,
      lastTrainingUpdate: this.state.lastTrainingUpdate,
      patterns: this.state.patterns,
      riskProfile: this.state.riskProfile,
      stats: this.state.stats,
      pnl: this.state.pnl
    });
  }

  getStatus() {
    const dataSizeMB = this.state.dataSizeBytes / (1024 * 1024);
    const dataSizeFormatted = dataSizeMB > 1024 
      ? `${(dataSizeMB / 1024).toFixed(2)} GB` 
      : `${dataSizeMB.toFixed(2)} MB`;

    return {
      confidence: this.state.confidence,
      dataPoints: this.state.dataPoints,
      dataSize: dataSizeFormatted,
      dataSizeBytes: this.state.dataSizeBytes,
      isLearning: this.state.isLearning,
      canVirtualTrade: this.state.canVirtualTrade,
      canLiveTrade: this.state.canLiveTrade,
      riskProfile: this.state.riskProfile,
      activePositions: this.activeVirtualPositions.size,
      pnl: this.state.pnl,
      stats: this.state.stats,
      trackedTokens: this.trackedTokens.size,
      patterns: this.state.patterns ? {
        hasPatterns: true,
        confidenceInPatterns: this.state.patterns.confidenceInPatterns
      } : null
    };
  }

  // Track a token to learn its outcome - WITH DEEP ANALYSIS
  async trackToken(tokenData, analysis) {
    if (this.trackedTokens.size >= this.maxTrackedTokens) {
      // Remove oldest tracked token
      const oldest = [...this.trackedTokens.entries()].sort((a, b) => a[1].entryTime - b[1].entryTime)[0];
      if (oldest) this.trackedTokens.delete(oldest[0]);
    }

    const price = tokenData.price || (tokenData.usd_market_cap / 1e9) || 0;
    if (price <= 0) return;

    // Get deep on-chain analysis (holder distribution, security, etc)
    let deepAnalysis = null;
    let recentTrades = null;
    let tokenOverview = null;
    
    try {
      // Run deep analysis in parallel
      const [deep, trades, overview] = await Promise.all([
        helius.getDeepTokenAnalysis(tokenData.mint),
        helius.getBirdeyeRecentTrades(tokenData.mint, 30),
        helius.getBirdeyeTokenOverview(tokenData.mint)
      ]);
      deepAnalysis = deep;
      recentTrades = trades;
      tokenOverview = overview;
    } catch (err) {
      // Continue without deep analysis
    }

    this.trackedTokens.set(tokenData.mint, {
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      name: tokenData.name,
      entryPrice: price,
      entryMarketCap: tokenData.usd_market_cap,
      entryTime: Date.now(),
      analysis: analysis,
      // Store ALL token data for learning
      tokenData: {
        // Basic info
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        name: tokenData.name,
        // Price metrics
        price: tokenData.price,
        priceChange30m: tokenData.priceChange30m || 0,
        priceChange1h: tokenData.priceChange1h || 0,
        priceChange4h: tokenData.priceChange4h || 0,
        priceChange24h: tokenData.priceChange24h || 0,
        // Market metrics
        marketCap: tokenData.usd_market_cap || 0,
        fdv: tokenData.fdv || 0,
        liquidity: tokenData.virtual_sol_reserves || 0,
        // Volume metrics
        volume30m: tokenData.volume30m || 0,
        volume1h: tokenData.volume1h || 0,
        volume4h: tokenData.volume4h || 0,
        volume24h: tokenData.volume24h || 0,
        // Trading activity
        txns24h: tokenData.txns24h || 0,
        buys24h: tokenData.buys24h || 0,
        sells24h: tokenData.sells24h || 0,
        buyVolume24h: tokenData.buyVolume24h || 0,
        sellVolume24h: tokenData.sellVolume24h || 0,
        // Holder metrics
        holders: tokenData.holder_count || 0,
        uniqueWallets24h: tokenData.uniqueWallet24h || 0,
        // Supply
        supply: tokenData.supply || 0,
        circulatingSupply: tokenData.circulatingSupply || 0,
        // Calculated signals
        buyPressure: tokenData.buyPressure || 50,
        volumeToMcap: tokenData.volumeToMcap || 0,
        // Time context
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        timestamp: Date.now()
      },
      // DEEP ON-CHAIN DATA
      holderAnalysis: deepAnalysis?.holders || null,
      securityAnalysis: deepAnalysis?.security || null,
      recentTrades: recentTrades || null,
      tokenOverview: tokenOverview || null
    });
    
    this.state.stats.tokensTracked++;
  }

  // Check tracked tokens and learn from outcomes
  async checkTrackedOutcomes() {
    const now = Date.now();
    const toRemove = [];
    
    for (const [mint, tracked] of this.trackedTokens) {
      // Check if tracking period is over
      if (now - tracked.entryTime < this.trackDuration) continue;
      
      try {
        // Get current price from Birdeye
        const currentData = await this.getTokenPrice(mint);
        if (!currentData || !currentData.price) {
          toRemove.push(mint);
          continue;
        }

        const pnlPercent = ((currentData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
        
        // Classify outcome
        let outcome;
        if (pnlPercent >= 20) {
          outcome = 'pump';
          this.state.stats.pumps++;
        } else if (pnlPercent <= -20) {
          outcome = 'dump';
          this.state.stats.dumps++;
        } else {
          outcome = 'neutral';
          this.state.stats.neutral++;
        }

        // Save learning data with outcome - SUPER DETAILED
        const learningData = {
          timestamp: Date.now(),
          token: tracked.tokenData,
          entryPrice: tracked.entryPrice,
          exitPrice: currentData.price,
          pnlPercent,
          outcome,
          holdTimeMinutes: (now - tracked.entryTime) / 60000,
          analysis: tracked.analysis,
          
          // PRICE & MOMENTUM SIGNALS
          priceSignals: {
            priceChange30m: tracked.tokenData.priceChange30m,
            priceChange1h: tracked.tokenData.priceChange1h,
            priceChange4h: tracked.tokenData.priceChange4h,
            priceChange24h: tracked.tokenData.priceChange24h
          },
          
          // MARKET SIZE SIGNALS
          marketSignals: {
            marketCap: tracked.tokenData.marketCap,
            fdv: tracked.tokenData.fdv,
            liquidity: tracked.tokenData.liquidity,
            mcapToLiquidity: tracked.tokenData.liquidity > 0 ? tracked.tokenData.marketCap / tracked.tokenData.liquidity : 0
          },
          
          // VOLUME SIGNALS
          volumeSignals: {
            volume30m: tracked.tokenData.volume30m,
            volume1h: tracked.tokenData.volume1h,
            volume24h: tracked.tokenData.volume24h,
            volumeToMcap: tracked.tokenData.volumeToMcap
          },
          
          // TRADING PRESSURE SIGNALS
          tradingSignals: {
            buys24h: tracked.tokenData.buys24h,
            sells24h: tracked.tokenData.sells24h,
            buyPressure: tracked.tokenData.buyPressure,
            txns24h: tracked.tokenData.txns24h,
            buyToSellRatio: tracked.tokenData.sells24h > 0 ? tracked.tokenData.buys24h / tracked.tokenData.sells24h : 1
          },
          
          // HOLDER SIGNALS
          holderSignals: {
            holders: tracked.tokenData.holders,
            uniqueWallets24h: tracked.tokenData.uniqueWallets24h,
            // Deep holder analysis
            top1Percent: tracked.holderAnalysis?.top1Percent || null,
            top5Percent: tracked.holderAnalysis?.top5Percent || null,
            top10Percent: tracked.holderAnalysis?.top10Percent || null,
            whaleCount: tracked.holderAnalysis?.whaleCount || null,
            whalePercent: tracked.holderAnalysis?.whalePercent || null,
            distributionScore: tracked.holderAnalysis?.distributionScore || null,
            isHighlyConcentrated: tracked.holderAnalysis?.isHighlyConcentrated || null,
            hasWhaleRisk: tracked.holderAnalysis?.hasWhaleRisk || null
          },
          
          // SECURITY SIGNALS
          securitySignals: {
            isMintable: tracked.securityAnalysis?.isMintable || null,
            isFreezable: tracked.securityAnalysis?.isFreezable || null,
            hasMintRisk: tracked.securityAnalysis?.hasMintRisk || null,
            hasFreezeRisk: tracked.securityAnalysis?.hasFreezeRisk || null,
            creatorPercentage: tracked.securityAnalysis?.creatorPercentage || null,
            ownerPercentage: tracked.securityAnalysis?.ownerPercentage || null,
            lpBurnedPercent: tracked.securityAnalysis?.lpBurnedPercent || null,
            isLpBurned: tracked.securityAnalysis?.isLpBurned || null,
            mutableMetadata: tracked.securityAnalysis?.mutableMetadata || null
          },
          
          // RECENT TRADE SIGNALS
          recentTradeSignals: {
            buyCount: tracked.recentTrades?.buyCount || null,
            sellCount: tracked.recentTrades?.sellCount || null,
            buyRatio: tracked.recentTrades?.buyRatio || null,
            avgBuySize: tracked.recentTrades?.avgBuySize || null,
            avgSellSize: tracked.recentTrades?.avgSellSize || null,
            whaleBuys: tracked.recentTrades?.whaleBuys || null,
            whaleSells: tracked.recentTrades?.whaleSells || null,
            uniqueBuyers: tracked.recentTrades?.uniqueBuyers || null,
            uniqueSellers: tracked.recentTrades?.uniqueSellers || null,
            isBuyHeavy: tracked.recentTrades?.isBuyHeavy || null,
            isSellHeavy: tracked.recentTrades?.isSellHeavy || null,
            hasWhaleInterest: tracked.recentTrades?.hasWhaleInterest || null
          },
          
          // TIME CONTEXT
          timeSignals: {
            hour: tracked.tokenData.hour,
            dayOfWeek: tracked.tokenData.dayOfWeek,
            isWeekend: tracked.tokenData.dayOfWeek === 0 || tracked.tokenData.dayOfWeek === 6,
            isUSMarketHours: tracked.tokenData.hour >= 13 && tracked.tokenData.hour <= 21, // UTC
            isAsiaHours: tracked.tokenData.hour >= 0 && tracked.tokenData.hour <= 8
          }
        };

        this.dataBuffer.push(learningData);
        
        if (outcome === 'pump') {
          console.log(`LEARNED: ${tracked.symbol} pumped ${pnlPercent.toFixed(1)}%`);
        } else if (outcome === 'dump') {
          console.log(`LEARNED: ${tracked.symbol} dumped ${pnlPercent.toFixed(1)}%`);
        }

        toRemove.push(mint);
      } catch (err) {
        toRemove.push(mint);
      }
    }

    // Clean up
    toRemove.forEach(mint => this.trackedTokens.delete(mint));
    
    // Flush if we have enough data
    if (this.dataBuffer.length >= 20) {
      await this.flushDataBuffer();
    }
  }

  // Get token price from Birdeye
  async getTokenPrice(mint) {
    try {
      const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
        headers: {
          'X-API-KEY': config.birdeyeApiKey,
          'x-chain': 'solana'
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.data ? { price: data.data.value } : null;
    } catch (err) {
      return null;
    }
  }

  // Run pattern analysis using analytics engine
  async runPatternAnalysis() {
    console.log('Running advanced pattern analysis...');
    const trainingData = await storage.loadTrainingData('market_data', 1000);
    
    if (trainingData.length < 50) {
      console.log('Not enough data for pattern analysis');
      return null;
    }

    const patterns = await analytics.analyzePatterns(trainingData);
    if (patterns) {
      this.state.learnedPatterns = patterns;
      console.log(`Pattern analysis complete. Found ${patterns.winningCombos?.length || 0} winning combos`);
      
      // Run backtest
      const backtest = await analytics.runBacktest({ minScore: 60 }, trainingData);
      this.state.backtestResults = backtest;
      console.log(`Backtest: ${backtest.totalTrades} trades, ${(backtest.winRate * 100).toFixed(1)}% win rate, ${backtest.returnPercent?.toFixed(1)}% return`);
      
      this.saveState();
    }
    
    return patterns;
  }

  // Run backtest with custom strategy
  async runBacktest(strategy = { minScore: 60 }) {
    const trainingData = await storage.loadTrainingData('market_data', 500);
    return analytics.runBacktest(strategy, trainingData);
  }
}

export default new TradingBrain();
