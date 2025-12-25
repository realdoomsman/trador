// WALLET INTELLIGENCE ENGINE - Deep wallet analysis and tracking
import config from '../config.js';
import storage from './storage.js';

class WalletIntelligence {
  constructor() {
    this.birdeyeKey = config.birdeyeApiKey;
    
    // Wallet databases
    this.knownWallets = new Map(); // address -> wallet profile
    this.devWallets = new Map();   // dev wallets we've identified
    this.sniperWallets = new Set(); // known sniper bots
    this.whaleWallets = new Map();  // whale wallets with history
    this.insiderWallets = new Set(); // suspected insider wallets
    this.ruggerWallets = new Set();  // wallets associated with rugs
    this.profitableWallets = new Map(); // wallets with good track record
    
    // Cluster tracking (bubble maps)
    this.walletClusters = new Map(); // cluster ID -> Set of addresses
    this.walletToCluster = new Map(); // address -> cluster ID
    
    // Performance tracking
    this.walletPerformance = new Map(); // address -> { wins, losses, avgPnl, tokens }
    
    // Known good/bad lists (will be populated from data)
    this.blacklist = new Set();
    this.whitelist = new Set();
  }

  async initialize() {
    // Load saved wallet data
    const saved = await storage.loadWalletIntel();
    if (saved) {
      this.loadFromSaved(saved);
      console.log(`Wallet Intel loaded: ${this.knownWallets.size} wallets, ${this.walletClusters.size} clusters`);
    }
  }

  loadFromSaved(data) {
    if (data.knownWallets) this.knownWallets = new Map(data.knownWallets);
    if (data.devWallets) this.devWallets = new Map(data.devWallets);
    if (data.sniperWallets) this.sniperWallets = new Set(data.sniperWallets);
    if (data.whaleWallets) this.whaleWallets = new Map(data.whaleWallets);
    if (data.insiderWallets) this.insiderWallets = new Set(data.insiderWallets);
    if (data.ruggerWallets) this.ruggerWallets = new Set(data.ruggerWallets);
    if (data.profitableWallets) this.profitableWallets = new Map(data.profitableWallets);
    if (data.walletClusters) this.walletClusters = new Map(data.walletClusters.map(([k, v]) => [k, new Set(v)]));
    if (data.walletToCluster) this.walletToCluster = new Map(data.walletToCluster);
    if (data.blacklist) this.blacklist = new Set(data.blacklist);
    if (data.whitelist) this.whitelist = new Set(data.whitelist);
    if (data.walletPerformance) this.walletPerformance = new Map(data.walletPerformance);
  }

  async save() {
    await storage.saveWalletIntel({
      knownWallets: Array.from(this.knownWallets.entries()),
      devWallets: Array.from(this.devWallets.entries()),
      sniperWallets: Array.from(this.sniperWallets),
      whaleWallets: Array.from(this.whaleWallets.entries()),
      insiderWallets: Array.from(this.insiderWallets),
      ruggerWallets: Array.from(this.ruggerWallets),
      profitableWallets: Array.from(this.profitableWallets.entries()),
      walletClusters: Array.from(this.walletClusters.entries()).map(([k, v]) => [k, Array.from(v)]),
      walletToCluster: Array.from(this.walletToCluster.entries()),
      blacklist: Array.from(this.blacklist),
      whitelist: Array.from(this.whitelist),
      walletPerformance: Array.from(this.walletPerformance.entries())
    });
  }

  // WALLET TYPE CLASSIFICATION
  classifyWallet(walletData) {
    const types = [];
    const flags = [];
    let riskScore = 50;

    // Check known lists first
    if (this.blacklist.has(walletData.address)) {
      types.push('BLACKLISTED');
      flags.push('Known bad actor');
      riskScore = 100;
    }
    if (this.whitelist.has(walletData.address)) {
      types.push('WHITELISTED');
      flags.push('Known good wallet');
      riskScore = 10;
    }
    if (this.ruggerWallets.has(walletData.address)) {
      types.push('RUGGER');
      flags.push('Associated with rugs');
      riskScore = 95;
    }
    if (this.sniperWallets.has(walletData.address)) {
      types.push('SNIPER');
      flags.push('Bot/sniper wallet');
      riskScore += 20;
    }
    if (this.insiderWallets.has(walletData.address)) {
      types.push('INSIDER');
      flags.push('Suspected insider');
      riskScore += 15;
    }

    // Analyze behavior patterns
    const behavior = this.analyzeBehavior(walletData);
    
    if (behavior.isSniper) {
      types.push('SNIPER');
      flags.push('Sniper behavior detected');
      riskScore += 15;
    }
    if (behavior.isWhale) {
      types.push('WHALE');
      if (behavior.whaleType === 'smart') {
        flags.push('Smart whale');
        riskScore -= 10;
      } else {
        flags.push('Whale wallet');
      }
    }
    if (behavior.isDev) {
      types.push('DEV');
      flags.push('Likely dev wallet');
      riskScore += 25;
    }
    if (behavior.isInsider) {
      types.push('INSIDER');
      flags.push('Insider pattern');
      riskScore += 20;
    }
    if (behavior.isProfitable) {
      types.push('PROFITABLE');
      flags.push(`${behavior.winRate}% win rate`);
      riskScore -= 15;
    }
    if (behavior.isFresh) {
      types.push('FRESH');
      flags.push('New wallet');
      riskScore += 10;
    }

    return {
      address: walletData.address,
      types,
      flags,
      riskScore: Math.max(0, Math.min(100, riskScore)),
      behavior,
      isGood: riskScore < 40,
      isBad: riskScore > 70,
      isNeutral: riskScore >= 40 && riskScore <= 70
    };
  }

  // Analyze wallet behavior patterns
  analyzeBehavior(walletData) {
    const behavior = {
      isSniper: false,
      isWhale: false,
      whaleType: null,
      isDev: false,
      isInsider: false,
      isProfitable: false,
      isFresh: false,
      winRate: 0,
      avgHoldTime: 0,
      avgTradeSize: 0,
      totalTrades: 0
    };

    // Check if sniper (buys within first few blocks)
    if (walletData.avgBuyTime && walletData.avgBuyTime < 60) { // < 60 seconds
      behavior.isSniper = true;
    }
    if (walletData.firstBuyBlock && walletData.tokenCreationBlock) {
      if (walletData.firstBuyBlock - walletData.tokenCreationBlock < 5) {
        behavior.isSniper = true;
      }
    }

    // Check if whale
    if (walletData.avgTradeSize > 5000 || walletData.totalVolume > 100000) {
      behavior.isWhale = true;
      // Smart whale = profitable whale
      if (walletData.winRate > 60) {
        behavior.whaleType = 'smart';
      } else {
        behavior.whaleType = 'regular';
      }
    }

    // Check if dev (holds from creation, large initial position)
    if (walletData.holdsSinceCreation && walletData.initialHoldPercent > 5) {
      behavior.isDev = true;
    }

    // Check if insider (buys before announcements, consistent early entries)
    if (walletData.earlyBuyRate > 0.7 && walletData.totalTrades > 5) {
      behavior.isInsider = true;
    }

    // Check profitability
    if (walletData.totalTrades > 10 && walletData.winRate > 55) {
      behavior.isProfitable = true;
      behavior.winRate = walletData.winRate;
    }

    // Check if fresh wallet
    if (walletData.walletAge && walletData.walletAge < 7) { // < 7 days
      behavior.isFresh = true;
    }

    behavior.avgHoldTime = walletData.avgHoldTime || 0;
    behavior.avgTradeSize = walletData.avgTradeSize || 0;
    behavior.totalTrades = walletData.totalTrades || 0;

    return behavior;
  }

  // BUBBLE MAP / CLUSTER ANALYSIS
  async analyzeHolderClusters(holders, mintAddress) {
    const clusters = [];
    const analyzed = new Set();

    for (const holder of holders) {
      if (analyzed.has(holder.address)) continue;

      // Find connected wallets
      const cluster = await this.findConnectedWallets(holder.address, holders);
      
      if (cluster.size > 1) {
        const clusterId = `cluster_${mintAddress}_${clusters.length}`;
        clusters.push({
          id: clusterId,
          wallets: Array.from(cluster),
          totalHolding: this.calculateClusterHolding(cluster, holders),
          type: this.classifyCluster(cluster),
          risk: this.assessClusterRisk(cluster)
        });

        // Track cluster membership
        for (const addr of cluster) {
          this.walletToCluster.set(addr, clusterId);
          analyzed.add(addr);
        }
        this.walletClusters.set(clusterId, cluster);
      }
    }

    return {
      totalClusters: clusters.length,
      clusters,
      largestCluster: clusters.sort((a, b) => b.totalHolding - a.totalHolding)[0] || null,
      clusterRisk: this.calculateOverallClusterRisk(clusters),
      hasCoordinatedHolding: clusters.some(c => c.totalHolding > 20)
    };
  }

  // Find wallets that are connected (same funding source, similar patterns)
  async findConnectedWallets(address, allHolders) {
    const connected = new Set([address]);
    
    // Get wallet's funding history
    const fundingSource = await this.getWalletFundingSource(address);
    
    if (fundingSource) {
      // Find other wallets funded by same source
      for (const holder of allHolders) {
        if (holder.address === address) continue;
        
        const otherFunding = await this.getWalletFundingSource(holder.address);
        if (otherFunding === fundingSource) {
          connected.add(holder.address);
        }
      }
    }

    // Check for similar transaction patterns
    for (const holder of allHolders) {
      if (connected.has(holder.address)) continue;
      
      const similarity = await this.checkWalletSimilarity(address, holder.address);
      if (similarity > 0.8) {
        connected.add(holder.address);
      }
    }

    return connected;
  }

  // Get wallet's original funding source
  async getWalletFundingSource(address) {
    try {
      // Get first SOL transfer to this wallet
      const res = await fetch(
        `https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${address}&limit=100`,
        {
          headers: {
            'X-API-KEY': this.birdeyeKey,
            'x-chain': 'solana'
          }
        }
      );
      
      if (!res.ok) return null;
      const data = await res.json();
      
      if (!data.data?.items) return null;
      
      // Find first incoming SOL transfer
      const firstFunding = data.data.items
        .filter(tx => tx.side === 'in' && tx.symbol === 'SOL')
        .sort((a, b) => a.blockTime - b.blockTime)[0];
      
      return firstFunding?.from || null;
    } catch (err) {
      return null;
    }
  }

  // Check similarity between two wallets
  async checkWalletSimilarity(addr1, addr2) {
    // Simple heuristic - can be expanded
    // Check if they trade same tokens at similar times
    let similarity = 0;
    
    // If in same cluster already
    if (this.walletToCluster.get(addr1) === this.walletToCluster.get(addr2)) {
      similarity += 0.5;
    }
    
    // If both are known types
    const type1 = this.knownWallets.get(addr1)?.types || [];
    const type2 = this.knownWallets.get(addr2)?.types || [];
    const commonTypes = type1.filter(t => type2.includes(t));
    similarity += commonTypes.length * 0.1;
    
    return Math.min(1, similarity);
  }

  calculateClusterHolding(cluster, holders) {
    let total = 0;
    const holderMap = new Map(holders.map(h => [h.address, h.percentage || 0]));
    
    for (const addr of cluster) {
      total += holderMap.get(addr) || 0;
    }
    return total;
  }

  classifyCluster(cluster) {
    const types = [];
    let devCount = 0;
    let sniperCount = 0;
    let whaleCount = 0;

    for (const addr of cluster) {
      if (this.devWallets.has(addr)) devCount++;
      if (this.sniperWallets.has(addr)) sniperCount++;
      if (this.whaleWallets.has(addr)) whaleCount++;
    }

    if (devCount > 0) types.push('DEV_CLUSTER');
    if (sniperCount > cluster.size * 0.5) types.push('SNIPER_CLUSTER');
    if (whaleCount > 0) types.push('WHALE_CLUSTER');
    if (types.length === 0) types.push('UNKNOWN_CLUSTER');

    return types;
  }

  assessClusterRisk(cluster) {
    let risk = 0;
    
    // Large clusters are risky
    if (cluster.size > 5) risk += 20;
    if (cluster.size > 10) risk += 20;
    
    // Check for bad actors in cluster
    for (const addr of cluster) {
      if (this.ruggerWallets.has(addr)) risk += 30;
      if (this.blacklist.has(addr)) risk += 25;
      if (this.sniperWallets.has(addr)) risk += 10;
    }
    
    return Math.min(100, risk);
  }

  calculateOverallClusterRisk(clusters) {
    if (clusters.length === 0) return 0;
    
    let totalRisk = 0;
    let maxClusterHolding = 0;
    
    for (const cluster of clusters) {
      totalRisk += cluster.risk;
      if (cluster.totalHolding > maxClusterHolding) {
        maxClusterHolding = cluster.totalHolding;
      }
    }
    
    // High risk if any cluster holds >20%
    if (maxClusterHolding > 20) totalRisk += 30;
    if (maxClusterHolding > 40) totalRisk += 30;
    
    return Math.min(100, totalRisk / clusters.length + (maxClusterHolding > 20 ? 30 : 0));
  }


  // ANALYZE TOKEN HOLDERS - Full analysis
  async analyzeTokenHolders(mintAddress, topHolders) {
    const analysis = {
      totalAnalyzed: 0,
      devWallets: [],
      sniperWallets: [],
      whaleWallets: [],
      insiderWallets: [],
      profitableWallets: [],
      riskyWallets: [],
      clusters: null,
      overallRisk: 50,
      signals: []
    };

    if (!topHolders || topHolders.length === 0) {
      return analysis;
    }

    // Analyze each holder
    for (const holder of topHolders.slice(0, 20)) {
      const walletData = await this.getWalletProfile(holder.address);
      const classification = this.classifyWallet(walletData);
      
      analysis.totalAnalyzed++;
      
      // Categorize
      if (classification.types.includes('DEV')) {
        analysis.devWallets.push({ address: holder.address, holding: holder.percentage });
      }
      if (classification.types.includes('SNIPER')) {
        analysis.sniperWallets.push({ address: holder.address, holding: holder.percentage });
      }
      if (classification.types.includes('WHALE')) {
        analysis.whaleWallets.push({ 
          address: holder.address, 
          holding: holder.percentage,
          type: classification.behavior.whaleType 
        });
      }
      if (classification.types.includes('INSIDER')) {
        analysis.insiderWallets.push({ address: holder.address, holding: holder.percentage });
      }
      if (classification.types.includes('PROFITABLE')) {
        analysis.profitableWallets.push({ 
          address: holder.address, 
          holding: holder.percentage,
          winRate: classification.behavior.winRate 
        });
      }
      if (classification.isBad) {
        analysis.riskyWallets.push({ 
          address: holder.address, 
          holding: holder.percentage,
          risk: classification.riskScore,
          flags: classification.flags 
        });
      }

      // Update known wallets
      this.knownWallets.set(holder.address, classification);
    }

    // Cluster analysis
    analysis.clusters = await this.analyzeHolderClusters(topHolders, mintAddress);

    // Calculate overall risk
    let risk = 50;
    
    // Dev wallet risk
    const devHolding = analysis.devWallets.reduce((sum, w) => sum + w.holding, 0);
    if (devHolding > 10) risk += 15;
    if (devHolding > 20) risk += 15;
    
    // Sniper risk
    const sniperHolding = analysis.sniperWallets.reduce((sum, w) => sum + w.holding, 0);
    if (sniperHolding > 5) risk += 10;
    if (sniperHolding > 15) risk += 15;
    
    // Cluster risk
    if (analysis.clusters?.clusterRisk > 50) risk += 20;
    
    // Risky wallet risk
    if (analysis.riskyWallets.length > 3) risk += 15;
    
    // Positive signals
    const smartWhales = analysis.whaleWallets.filter(w => w.type === 'smart');
    if (smartWhales.length > 0) risk -= 10;
    if (analysis.profitableWallets.length > 2) risk -= 10;
    
    analysis.overallRisk = Math.max(0, Math.min(100, risk));

    // Generate signals
    if (devHolding > 15) {
      analysis.signals.push({ type: 'WARNING', message: `Dev wallets hold ${devHolding.toFixed(1)}%` });
    }
    if (sniperHolding > 10) {
      analysis.signals.push({ type: 'WARNING', message: `Snipers hold ${sniperHolding.toFixed(1)}%` });
    }
    if (analysis.clusters?.hasCoordinatedHolding) {
      analysis.signals.push({ type: 'DANGER', message: 'Coordinated holding detected' });
    }
    if (smartWhales.length > 0) {
      analysis.signals.push({ type: 'BULLISH', message: `${smartWhales.length} smart whales holding` });
    }
    if (analysis.profitableWallets.length > 2) {
      analysis.signals.push({ type: 'BULLISH', message: `${analysis.profitableWallets.length} profitable traders holding` });
    }

    return analysis;
  }

  // Get wallet profile from Birdeye
  async getWalletProfile(address) {
    const profile = {
      address,
      totalTrades: 0,
      winRate: 0,
      avgTradeSize: 0,
      avgHoldTime: 0,
      totalVolume: 0,
      walletAge: null,
      tokens: [],
      pnl: 0
    };

    try {
      // Get wallet token holdings
      const holdingsRes = await fetch(
        `https://public-api.birdeye.so/v1/wallet/token_list?wallet=${address}`,
        {
          headers: {
            'X-API-KEY': this.birdeyeKey,
            'x-chain': 'solana'
          }
        }
      );
      
      if (holdingsRes.ok) {
        const holdings = await holdingsRes.json();
        profile.tokens = holdings.data?.items || [];
      }

      // Get wallet transaction history
      const txRes = await fetch(
        `https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${address}&limit=100`,
        {
          headers: {
            'X-API-KEY': this.birdeyeKey,
            'x-chain': 'solana'
          }
        }
      );
      
      if (txRes.ok) {
        const txData = await txRes.json();
        const txs = txData.data?.items || [];
        
        profile.totalTrades = txs.length;
        
        // Calculate metrics
        if (txs.length > 0) {
          const volumes = txs.map(t => t.volumeUSD || 0);
          profile.totalVolume = volumes.reduce((a, b) => a + b, 0);
          profile.avgTradeSize = profile.totalVolume / txs.length;
          
          // Estimate wallet age from first tx
          const firstTx = txs[txs.length - 1];
          if (firstTx?.blockTime) {
            profile.walletAge = (Date.now() / 1000 - firstTx.blockTime) / 86400; // days
          }
        }
      }

      // Check if we have performance data
      if (this.walletPerformance.has(address)) {
        const perf = this.walletPerformance.get(address);
        profile.winRate = perf.wins / (perf.wins + perf.losses) * 100 || 0;
        profile.pnl = perf.totalPnl || 0;
      }

    } catch (err) {
      // Return basic profile on error
    }

    return profile;
  }

  // TRACK WALLET PERFORMANCE - Learn from outcomes
  async trackWalletOutcome(address, tokenMint, outcome, pnlPercent) {
    if (!this.walletPerformance.has(address)) {
      this.walletPerformance.set(address, {
        wins: 0,
        losses: 0,
        totalPnl: 0,
        tokens: [],
        lastUpdate: Date.now()
      });
    }

    const perf = this.walletPerformance.get(address);
    
    if (outcome === 'pump' || pnlPercent > 0) {
      perf.wins++;
    } else {
      perf.losses++;
    }
    
    perf.totalPnl += pnlPercent;
    perf.tokens.push({ mint: tokenMint, pnl: pnlPercent, time: Date.now() });
    perf.lastUpdate = Date.now();

    // Keep only last 50 tokens
    if (perf.tokens.length > 50) {
      perf.tokens = perf.tokens.slice(-50);
    }

    // Update wallet classification
    const winRate = perf.wins / (perf.wins + perf.losses) * 100;
    
    if (winRate > 65 && perf.wins + perf.losses > 10) {
      this.profitableWallets.set(address, perf);
      this.whitelist.add(address);
    }
    
    if (winRate < 30 && perf.wins + perf.losses > 10) {
      this.blacklist.add(address);
    }

    await this.save();
  }

  // IDENTIFY DEV WALLET
  async identifyDevWallet(mintAddress, creatorAddress) {
    if (!creatorAddress) return null;

    const devProfile = {
      address: creatorAddress,
      isConfirmedDev: true,
      tokens: [],
      rugHistory: [],
      successHistory: []
    };

    // Get dev's other tokens
    try {
      const res = await fetch(
        `https://public-api.birdeye.so/v1/wallet/token_list?wallet=${creatorAddress}`,
        {
          headers: {
            'X-API-KEY': this.birdeyeKey,
            'x-chain': 'solana'
          }
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        devProfile.tokens = data.data?.items || [];
      }
    } catch (err) {}

    // Track this dev
    this.devWallets.set(creatorAddress, devProfile);
    
    return devProfile;
  }

  // CHECK IF WALLET IS KNOWN RUGGER
  async checkRugHistory(address) {
    // Check our database
    if (this.ruggerWallets.has(address)) {
      return { isRugger: true, source: 'database' };
    }

    // Check dev wallet history
    if (this.devWallets.has(address)) {
      const dev = this.devWallets.get(address);
      if (dev.rugHistory && dev.rugHistory.length > 0) {
        return { isRugger: true, rugs: dev.rugHistory, source: 'dev_history' };
      }
    }

    return { isRugger: false };
  }

  // MARK WALLET AS RUGGER
  markAsRugger(address, tokenMint, details = {}) {
    this.ruggerWallets.add(address);
    this.blacklist.add(address);
    
    if (this.devWallets.has(address)) {
      const dev = this.devWallets.get(address);
      dev.rugHistory = dev.rugHistory || [];
      dev.rugHistory.push({ token: tokenMint, time: Date.now(), ...details });
    }
    
    this.save();
  }

  // GET WALLET INTEL SUMMARY
  getWalletIntelSummary(address) {
    const summary = {
      address,
      known: this.knownWallets.has(address),
      classification: this.knownWallets.get(address) || null,
      isDev: this.devWallets.has(address),
      isSniper: this.sniperWallets.has(address),
      isWhale: this.whaleWallets.has(address),
      isInsider: this.insiderWallets.has(address),
      isRugger: this.ruggerWallets.has(address),
      isProfitable: this.profitableWallets.has(address),
      isBlacklisted: this.blacklist.has(address),
      isWhitelisted: this.whitelist.has(address),
      cluster: this.walletToCluster.get(address) || null,
      performance: this.walletPerformance.get(address) || null
    };

    // Calculate trust score
    let trust = 50;
    if (summary.isWhitelisted) trust += 30;
    if (summary.isProfitable) trust += 20;
    if (summary.isBlacklisted) trust -= 40;
    if (summary.isRugger) trust -= 50;
    if (summary.isSniper) trust -= 10;
    if (summary.isDev) trust -= 15;
    
    summary.trustScore = Math.max(0, Math.min(100, trust));
    
    return summary;
  }

  // GET OVERALL STATS
  getStats() {
    return {
      totalKnownWallets: this.knownWallets.size,
      devWallets: this.devWallets.size,
      sniperWallets: this.sniperWallets.size,
      whaleWallets: this.whaleWallets.size,
      insiderWallets: this.insiderWallets.size,
      ruggerWallets: this.ruggerWallets.size,
      profitableWallets: this.profitableWallets.size,
      clusters: this.walletClusters.size,
      blacklisted: this.blacklist.size,
      whitelisted: this.whitelist.size,
      trackedPerformance: this.walletPerformance.size
    };
  }
}

export default new WalletIntelligence();
