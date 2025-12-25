// SOCIAL INTELLIGENCE - Twitter, Telegram, Trends, Influencers, Narratives
import config from '../config.js';

class SocialIntelligence {
  constructor() {
    this.birdeyeKey = config.birdeyeApiKey;
    
    // Trending narratives tracking
    this.activeNarratives = new Map();
    this.narrativeHistory = [];
    
    // Influencer/KOL tracking
    this.knownInfluencers = new Map();
    this.influencerCalls = [];
    
    // Viral detection
    this.viralTokens = new Set();
    this.viralHistory = [];
    
    // Social scores cache
    this.socialScores = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 min
    
    // Known memecoin narratives
    this.narrativeKeywords = {
      'AI': ['ai', 'gpt', 'artificial', 'intelligence', 'neural', 'machine learning', 'bot'],
      'ANIMAL': ['dog', 'cat', 'pepe', 'frog', 'shib', 'doge', 'inu', 'wif', 'popcat', 'mew'],
      'POLITICAL': ['trump', 'biden', 'maga', 'political', 'election', 'president'],
      'CELEBRITY': ['elon', 'musk', 'kanye', 'drake', 'celebrity'],
      'GAMING': ['game', 'play', 'nft', 'metaverse', 'virtual'],
      'DEFI': ['defi', 'yield', 'stake', 'farm', 'liquidity'],
      'MEME': ['meme', 'wojak', 'chad', 'based', 'kek', 'lol', 'funny'],
      'FOOD': ['food', 'pizza', 'burger', 'sushi', 'coffee'],
      'CULTURE': ['anime', 'manga', 'crypto', 'degen', 'ape']
    };
    
    // Viral indicators
    this.viralIndicators = {
      minMentions: 50,
      minEngagement: 1000,
      minGrowthRate: 200, // 200% growth
      minUniqueAccounts: 20
    };
  }

  // DETECT TOKEN NARRATIVE
  detectNarrative(tokenData) {
    const name = (tokenData.name || '').toLowerCase();
    const symbol = (tokenData.symbol || '').toLowerCase();
    const combined = `${name} ${symbol}`;
    
    const detectedNarratives = [];
    
    for (const [narrative, keywords] of Object.entries(this.narrativeKeywords)) {
      for (const keyword of keywords) {
        if (combined.includes(keyword)) {
          detectedNarratives.push(narrative);
          break;
        }
      }
    }
    
    // Check if narrative is currently hot
    const hotNarratives = this.getHotNarratives();
    const isHotNarrative = detectedNarratives.some(n => hotNarratives.includes(n));
    
    return {
      narratives: detectedNarratives,
      primaryNarrative: detectedNarratives[0] || 'UNKNOWN',
      isHotNarrative,
      hotNarratives,
      narrativeScore: isHotNarrative ? 80 : detectedNarratives.length > 0 ? 50 : 20
    };
  }

  // GET CURRENTLY HOT NARRATIVES
  getHotNarratives() {
    // Based on recent successful tokens
    const recentHot = [];
    
    for (const [narrative, data] of this.activeNarratives) {
      if (data.successRate > 0.5 && data.recentCount > 3) {
        recentHot.push(narrative);
      }
    }
    
    // Default hot narratives (update based on market)
    if (recentHot.length === 0) {
      return ['AI', 'ANIMAL', 'MEME'];
    }
    
    return recentHot;
  }

  // TRACK NARRATIVE PERFORMANCE
  trackNarrativeOutcome(narrative, outcome, pnlPercent) {
    if (!this.activeNarratives.has(narrative)) {
      this.activeNarratives.set(narrative, {
        totalTokens: 0,
        successes: 0,
        failures: 0,
        totalPnl: 0,
        recentCount: 0,
        successRate: 0,
        lastUpdate: Date.now()
      });
    }
    
    const data = this.activeNarratives.get(narrative);
    data.totalTokens++;
    data.recentCount++;
    data.totalPnl += pnlPercent;
    
    if (outcome === 'pump') {
      data.successes++;
    } else {
      data.failures++;
    }
    
    data.successRate = data.successes / data.totalTokens;
    data.lastUpdate = Date.now();
    
    // Decay recent count over time
    setTimeout(() => {
      if (this.activeNarratives.has(narrative)) {
        this.activeNarratives.get(narrative).recentCount--;
      }
    }, 3600000); // 1 hour
  }

  // ANALYZE SOCIAL SIGNALS FROM TRADING DATA
  async analyzeSocialSignals(tokenData) {
    const cacheKey = tokenData.mint;
    
    // Check cache
    if (this.socialScores.has(cacheKey)) {
      const cached = this.socialScores.get(cacheKey);
      if (Date.now() - cached.time < this.cacheTimeout) {
        return cached.data;
      }
    }

    const signals = {
      // Narrative analysis
      narrative: this.detectNarrative(tokenData),
      
      // Viral indicators from trading data
      viral: this.detectViralPotential(tokenData),
      
      // Hype indicators
      hype: this.analyzeHypeIndicators(tokenData),
      
      // Community strength
      community: this.analyzeCommunityStrength(tokenData),
      
      // Overall social score
      socialScore: 50,
      
      // Signals
      signals: [],
      
      // Risk factors
      risks: []
    };

    // Calculate overall social score
    let score = 50;
    
    // Narrative bonus
    if (signals.narrative.isHotNarrative) {
      score += 15;
      signals.signals.push('Hot narrative');
    }
    if (signals.narrative.narratives.length > 0) {
      score += 5;
    }
    
    // Viral bonus
    if (signals.viral.isViral) {
      score += 20;
      signals.signals.push('Going viral');
    }
    if (signals.viral.viralPotential > 70) {
      score += 10;
      signals.signals.push('High viral potential');
    }
    
    // Hype bonus
    if (signals.hype.isHyped) {
      score += 10;
      signals.signals.push('High hype');
    }
    
    // Community bonus
    if (signals.community.isStrong) {
      score += 10;
      signals.signals.push('Strong community');
    }
    
    // Risk penalties
    if (signals.viral.isFading) {
      score -= 15;
      signals.risks.push('Hype fading');
    }
    if (signals.hype.isPumpAndDump) {
      score -= 20;
      signals.risks.push('Pump & dump pattern');
    }
    
    signals.socialScore = Math.max(0, Math.min(100, score));
    
    // Cache result
    this.socialScores.set(cacheKey, { data: signals, time: Date.now() });
    
    return signals;
  }

  // DETECT VIRAL POTENTIAL
  detectViralPotential(tokenData) {
    const result = {
      isViral: false,
      isFading: false,
      viralPotential: 50,
      indicators: []
    };

    // Volume growth (comparing timeframes)
    const vol1h = tokenData.volume1h || 0;
    const vol4h = tokenData.volume4h || 0;
    const vol24h = tokenData.volume24h || 0;
    
    // Recent volume acceleration
    const hourlyAvg24h = vol24h / 24;
    const volumeAcceleration = hourlyAvg24h > 0 ? vol1h / hourlyAvg24h : 1;
    
    if (volumeAcceleration > 3) {
      result.viralPotential += 20;
      result.indicators.push('Volume exploding');
    } else if (volumeAcceleration > 1.5) {
      result.viralPotential += 10;
      result.indicators.push('Volume accelerating');
    } else if (volumeAcceleration < 0.5) {
      result.viralPotential -= 15;
      result.isFading = true;
      result.indicators.push('Volume declining');
    }

    // Unique traders growth
    const uniqueWallets = tokenData.uniqueWallet24h || 0;
    if (uniqueWallets > 500) {
      result.viralPotential += 15;
      result.indicators.push('Many unique traders');
    } else if (uniqueWallets > 200) {
      result.viralPotential += 10;
    }

    // Buy pressure
    const buyPressure = tokenData.buyPressure || 50;
    if (buyPressure > 65) {
      result.viralPotential += 10;
      result.indicators.push('Strong buy pressure');
    } else if (buyPressure < 40) {
      result.viralPotential -= 10;
      result.indicators.push('Weak buy pressure');
    }

    // Price momentum
    const priceChange1h = tokenData.priceChange1h || 0;
    const priceChange24h = tokenData.priceChange24h || 0;
    
    if (priceChange1h > 50 && priceChange1h < 200) {
      result.viralPotential += 15;
      result.indicators.push('Strong momentum');
    } else if (priceChange1h > 200) {
      result.viralPotential += 5; // Too much might be pump
      result.indicators.push('Extreme pump - caution');
    }

    // Determine if viral
    result.isViral = result.viralPotential >= 75;
    
    // Track viral tokens
    if (result.isViral && !this.viralTokens.has(tokenData.mint)) {
      this.viralTokens.add(tokenData.mint);
      this.viralHistory.push({
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        time: Date.now(),
        viralPotential: result.viralPotential
      });
      
      // Keep last 100
      if (this.viralHistory.length > 100) {
        this.viralHistory = this.viralHistory.slice(-100);
      }
    }

    return result;
  }

  // ANALYZE HYPE INDICATORS
  analyzeHypeIndicators(tokenData) {
    const result = {
      isHyped: false,
      isPumpAndDump: false,
      hypeScore: 50,
      indicators: []
    };

    // Transaction frequency
    const txns24h = tokenData.txns24h || 0;
    const holders = tokenData.holders || tokenData.holder_count || 0;
    const txPerHolder = holders > 0 ? txns24h / holders : 0;
    
    if (txPerHolder > 5) {
      result.hypeScore += 15;
      result.indicators.push('High trading activity');
    }

    // Volume to market cap ratio
    const volumeToMcap = tokenData.volumeToMcap || 0;
    if (volumeToMcap > 0.5) {
      result.hypeScore += 15;
      result.indicators.push('High volume/mcap ratio');
    } else if (volumeToMcap > 0.2) {
      result.hypeScore += 10;
    }

    // Buy/sell ratio
    const buys = tokenData.buys24h || 0;
    const sells = tokenData.sells24h || 0;
    const buyRatio = buys + sells > 0 ? buys / (buys + sells) : 0.5;
    
    if (buyRatio > 0.6) {
      result.hypeScore += 10;
      result.indicators.push('More buyers than sellers');
    }

    // Pump and dump detection
    const priceChange1h = tokenData.priceChange1h || 0;
    const priceChange4h = tokenData.priceChange4h || 0;
    
    // If pumped hard then dumping
    if (priceChange4h > 100 && priceChange1h < -20) {
      result.isPumpAndDump = true;
      result.hypeScore -= 20;
      result.indicators.push('Pump & dump pattern detected');
    }

    result.isHyped = result.hypeScore >= 65;
    
    return result;
  }

  // ANALYZE COMMUNITY STRENGTH
  analyzeCommunityStrength(tokenData) {
    const result = {
      isStrong: false,
      communityScore: 50,
      indicators: []
    };

    // Holder count
    const holders = tokenData.holders || tokenData.holder_count || 0;
    
    if (holders > 1000) {
      result.communityScore += 20;
      result.indicators.push('Large holder base');
    } else if (holders > 500) {
      result.communityScore += 15;
      result.indicators.push('Growing holder base');
    } else if (holders > 100) {
      result.communityScore += 10;
    } else {
      result.communityScore -= 10;
      result.indicators.push('Small holder base');
    }

    // Unique wallets (active community)
    const uniqueWallets = tokenData.uniqueWallet24h || 0;
    const activeRatio = holders > 0 ? uniqueWallets / holders : 0;
    
    if (activeRatio > 0.3) {
      result.communityScore += 15;
      result.indicators.push('Very active community');
    } else if (activeRatio > 0.1) {
      result.communityScore += 10;
      result.indicators.push('Active community');
    }

    // Token age (older = more established)
    const ageMinutes = tokenData.ageMinutes || 0;
    if (ageMinutes > 1440) { // > 1 day
      result.communityScore += 10;
      result.indicators.push('Established token');
    } else if (ageMinutes < 60) {
      result.communityScore -= 5;
      result.indicators.push('Very new token');
    }

    result.isStrong = result.communityScore >= 65;
    
    return result;
  }

  // GET TRENDING TOKENS (social signals)
  async getTrendingBySocial() {
    // Return recently viral tokens
    const recent = this.viralHistory
      .filter(v => Date.now() - v.time < 3600000) // Last hour
      .sort((a, b) => b.viralPotential - a.viralPotential);
    
    return recent.slice(0, 10);
  }

  // INFLUENCER TRACKING (placeholder for future)
  trackInfluencerCall(influencer, tokenMint, callType) {
    this.influencerCalls.push({
      influencer,
      tokenMint,
      callType, // 'BUY', 'SELL', 'SHILL'
      time: Date.now(),
      outcome: null
    });
    
    // Keep last 500
    if (this.influencerCalls.length > 500) {
      this.influencerCalls = this.influencerCalls.slice(-500);
    }
  }

  // Update influencer call outcome
  updateInfluencerOutcome(tokenMint, outcome, pnlPercent) {
    for (const call of this.influencerCalls) {
      if (call.tokenMint === tokenMint && !call.outcome) {
        call.outcome = outcome;
        call.pnl = pnlPercent;
        
        // Update influencer stats
        if (!this.knownInfluencers.has(call.influencer)) {
          this.knownInfluencers.set(call.influencer, {
            calls: 0,
            wins: 0,
            losses: 0,
            totalPnl: 0
          });
        }
        
        const stats = this.knownInfluencers.get(call.influencer);
        stats.calls++;
        stats.totalPnl += pnlPercent;
        if (outcome === 'pump') stats.wins++;
        else stats.losses++;
      }
    }
  }

  // GET BEST INFLUENCERS
  getBestInfluencers() {
    const influencers = [];
    
    for (const [name, stats] of this.knownInfluencers) {
      if (stats.calls >= 5) {
        influencers.push({
          name,
          winRate: stats.wins / stats.calls * 100,
          avgPnl: stats.totalPnl / stats.calls,
          calls: stats.calls
        });
      }
    }
    
    return influencers
      .filter(i => i.winRate > 50)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 10);
  }

  // GET STATUS
  getStatus() {
    return {
      activeNarratives: Array.from(this.activeNarratives.entries()).map(([name, data]) => ({
        name,
        successRate: (data.successRate * 100).toFixed(1) + '%',
        recentCount: data.recentCount
      })),
      hotNarratives: this.getHotNarratives(),
      viralTokensCount: this.viralTokens.size,
      recentViral: this.viralHistory.slice(-5),
      trackedInfluencers: this.knownInfluencers.size,
      bestInfluencers: this.getBestInfluencers().slice(0, 3)
    };
  }
}

export default new SocialIntelligence();
