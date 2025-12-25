// EXTERNAL TOOLS - RugCheck, GoPlus, Social Sentiment, etc.
import config from '../config.js';

class ExternalTools {
  constructor() {
    this.birdeyeKey = config.birdeyeApiKey;
    
    // Cache for API responses
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 min cache
  }

  // RUGCHECK.XYZ - Automated rug detection
  async checkRugCheck(mintAddress) {
    const cacheKey = `rugcheck_${mintAddress}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.time < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report`);
      
      if (!res.ok) return null;
      const data = await res.json();
      
      const result = {
        score: data.score || 0,
        risks: data.risks || [],
        isRug: data.score < 50,
        topRisks: (data.risks || []).slice(0, 3).map(r => r.name),
        // Specific checks
        mintAuthority: data.risks?.some(r => r.name?.includes('Mint')),
        freezeAuthority: data.risks?.some(r => r.name?.includes('Freeze')),
        lpUnlocked: data.risks?.some(r => r.name?.includes('LP') && r.name?.includes('unlock')),
        lowLiquidity: data.risks?.some(r => r.name?.includes('Liquidity')),
        // Overall assessment
        isSafe: data.score >= 70,
        isRisky: data.score < 50,
        riskLevel: data.score >= 70 ? 'LOW' : data.score >= 50 ? 'MEDIUM' : 'HIGH'
      };

      this.cache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    } catch (err) {
      console.error('RugCheck error:', err.message);
      return null;
    }
  }

  // GOPLUS SECURITY - Token security scanning
  async checkGoPlus(mintAddress) {
    const cacheKey = `goplus_${mintAddress}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.time < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const res = await fetch(`https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=${mintAddress}`);
      
      if (!res.ok) return null;
      const data = await res.json();
      
      const tokenData = data.result?.[mintAddress.toLowerCase()] || data.result?.[mintAddress];
      if (!tokenData) return null;

      const result = {
        // Ownership risks
        isOpenSource: tokenData.is_open_source === '1',
        isProxy: tokenData.is_proxy === '1',
        isMintable: tokenData.is_mintable === '1',
        canTakeBackOwnership: tokenData.can_take_back_ownership === '1',
        ownerChangeBalance: tokenData.owner_change_balance === '1',
        hiddenOwner: tokenData.hidden_owner === '1',
        
        // Trading risks
        cannotBuy: tokenData.cannot_buy === '1',
        cannotSellAll: tokenData.cannot_sell_all === '1',
        tradingCooldown: tokenData.trading_cooldown === '1',
        transferPausable: tokenData.transfer_pausable === '1',
        isBlacklisted: tokenData.is_blacklisted === '1',
        isWhitelisted: tokenData.is_whitelisted === '1',
        isAntiWhale: tokenData.is_anti_whale === '1',
        
        // Tax info
        buyTax: parseFloat(tokenData.buy_tax || 0) * 100,
        sellTax: parseFloat(tokenData.sell_tax || 0) * 100,
        
        // Holder info
        holderCount: parseInt(tokenData.holder_count || 0),
        lpHolderCount: parseInt(tokenData.lp_holder_count || 0),
        totalSupply: tokenData.total_supply,
        
        // Creator info
        creatorAddress: tokenData.creator_address,
        creatorPercent: parseFloat(tokenData.creator_percent || 0) * 100,
        
        // LP info
        lpTotalSupply: tokenData.lp_total_supply,
        
        // Risk assessment
        riskCount: 0,
        risks: []
      };

      // Count risks
      if (result.isMintable) { result.riskCount++; result.risks.push('Mintable'); }
      if (result.canTakeBackOwnership) { result.riskCount++; result.risks.push('Can take back ownership'); }
      if (result.hiddenOwner) { result.riskCount++; result.risks.push('Hidden owner'); }
      if (result.cannotSellAll) { result.riskCount++; result.risks.push('Cannot sell all'); }
      if (result.transferPausable) { result.riskCount++; result.risks.push('Transfer pausable'); }
      if (result.buyTax > 10) { result.riskCount++; result.risks.push(`High buy tax: ${result.buyTax}%`); }
      if (result.sellTax > 10) { result.riskCount++; result.risks.push(`High sell tax: ${result.sellTax}%`); }
      if (result.creatorPercent > 10) { result.riskCount++; result.risks.push(`Creator holds ${result.creatorPercent.toFixed(1)}%`); }

      result.isSafe = result.riskCount === 0;
      result.isRisky = result.riskCount >= 3;
      result.riskLevel = result.riskCount === 0 ? 'LOW' : result.riskCount < 3 ? 'MEDIUM' : 'HIGH';

      this.cache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    } catch (err) {
      console.error('GoPlus error:', err.message);
      return null;
    }
  }

  // DEXTOOLS - Additional trading data
  async getDexToolsData(mintAddress) {
    try {
      // DexTools doesn't have a public API, but we can try their public endpoints
      const res = await fetch(`https://www.dextools.io/shared/data/pair?address=${mintAddress}&chain=solana`);
      
      if (!res.ok) return null;
      const data = await res.json();
      
      return {
        dextScore: data.dextScore || null,
        audit: data.audit || null,
        locks: data.locks || null
      };
    } catch (err) {
      return null;
    }
  }

  // TWITTER/X SENTIMENT (using Birdeye social data if available)
  async getSocialSentiment(mintAddress) {
    if (!this.birdeyeKey) return null;

    try {
      // Birdeye has some social data
      const res = await fetch(
        `https://public-api.birdeye.so/defi/token_overview?address=${mintAddress}`,
        {
          headers: {
            'X-API-KEY': this.birdeyeKey,
            'x-chain': 'solana'
          }
        }
      );
      
      if (!res.ok) return null;
      const data = await res.json();
      
      // Extract social signals from trading patterns
      const overview = data.data;
      if (!overview) return null;

      // Infer sentiment from trading activity
      const buyPressure = overview.buy24h / (overview.buy24h + overview.sell24h) * 100 || 50;
      const volumeGrowth = overview.v1hUSD > 0 ? (overview.v4hUSD / 4) / overview.v1hUSD : 1;
      const uniqueTraders = overview.uniqueWallet24h || 0;
      
      let sentiment = 'NEUTRAL';
      if (buyPressure > 60 && volumeGrowth > 1.2) sentiment = 'BULLISH';
      if (buyPressure < 40 && volumeGrowth < 0.8) sentiment = 'BEARISH';
      
      return {
        sentiment,
        buyPressure,
        volumeGrowth,
        uniqueTraders,
        isViral: uniqueTraders > 500 && volumeGrowth > 2,
        isFading: volumeGrowth < 0.5 && buyPressure < 45
      };
    } catch (err) {
      return null;
    }
  }

  // COMBINED SECURITY CHECK - Run all security tools
  async runSecurityCheck(mintAddress) {
    const [rugCheck, goPlus, social] = await Promise.all([
      this.checkRugCheck(mintAddress),
      this.checkGoPlus(mintAddress),
      this.getSocialSentiment(mintAddress)
    ]);

    // Combine results
    const result = {
      rugCheck,
      goPlus,
      social,
      
      // Overall assessment
      overallRisk: 'MEDIUM',
      riskScore: 50,
      flags: [],
      isSafe: false
    };

    let riskScore = 50;
    
    // RugCheck scoring
    if (rugCheck) {
      if (rugCheck.isSafe) riskScore -= 15;
      if (rugCheck.isRisky) riskScore += 20;
      if (rugCheck.mintAuthority) { riskScore += 10; result.flags.push('Mint authority active'); }
      if (rugCheck.lpUnlocked) { riskScore += 15; result.flags.push('LP unlocked'); }
    }

    // GoPlus scoring
    if (goPlus) {
      if (goPlus.isSafe) riskScore -= 15;
      if (goPlus.isRisky) riskScore += 20;
      if (goPlus.isMintable) { riskScore += 10; result.flags.push('Token mintable'); }
      if (goPlus.cannotSellAll) { riskScore += 25; result.flags.push('Cannot sell all'); }
      if (goPlus.hiddenOwner) { riskScore += 15; result.flags.push('Hidden owner'); }
      if (goPlus.sellTax > 5) { riskScore += 10; result.flags.push(`Sell tax: ${goPlus.sellTax}%`); }
    }

    // Social scoring
    if (social) {
      if (social.sentiment === 'BULLISH') riskScore -= 5;
      if (social.sentiment === 'BEARISH') riskScore += 10;
      if (social.isViral) { riskScore -= 10; result.flags.push('Going viral'); }
      if (social.isFading) { riskScore += 10; result.flags.push('Volume fading'); }
    }

    result.riskScore = Math.max(0, Math.min(100, riskScore));
    result.overallRisk = result.riskScore < 40 ? 'LOW' : result.riskScore < 70 ? 'MEDIUM' : 'HIGH';
    result.isSafe = result.riskScore < 40;

    return result;
  }

  // GET TRENDING TOKENS FROM MULTIPLE SOURCES
  async getTrendingTokens() {
    const trending = [];

    // Try DexScreener trending
    try {
      const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/trending');
      if (res.ok) {
        const data = await res.json();
        if (data.pairs) {
          trending.push(...data.pairs.filter(p => p.chainId === 'solana').slice(0, 10).map(p => ({
            source: 'dexscreener',
            address: p.baseToken?.address,
            symbol: p.baseToken?.symbol,
            priceChange: p.priceChange?.h24
          })));
        }
      }
    } catch (err) {}

    // Try Jupiter strict list for quality tokens
    try {
      const res = await fetch('https://token.jup.ag/strict');
      if (res.ok) {
        const tokens = await res.json();
        trending.push(...tokens.slice(0, 10).map(t => ({
          source: 'jupiter',
          address: t.address,
          symbol: t.symbol,
          name: t.name
        })));
      }
    } catch (err) {}

    return trending;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get status
  getStatus() {
    return {
      cacheSize: this.cache.size,
      hasBirdeye: !!this.birdeyeKey
    };
  }
}

export default new ExternalTools();
