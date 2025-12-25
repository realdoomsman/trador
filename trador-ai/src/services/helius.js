import config from '../config.js';

class HeliusService {
  constructor() {
    this.apiKey = config.heliusApiKey;
    this.rpcUrl = config.heliusRpcUrl;
    this.baseUrl = `https://api.helius.xyz/v0`;
    this.birdeyeKey = config.birdeyeApiKey;
    this.dataSource = 'none'; // Track which source is working
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}?api-key=${this.apiKey}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
    return res.json();
  }

  async rpc(method, params = []) {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }

  // Get token metadata
  async getTokenMetadata(mintAddress) {
    try {
      const data = await this.fetch(`/token-metadata?mint=${mintAddress}`);
      return data;
    } catch (err) {
      return null;
    }
  }

  // Get token holders
  async getTokenHolders(mintAddress) {
    try {
      const accounts = await this.rpc('getTokenLargestAccounts', [mintAddress]);
      return accounts.value || [];
    } catch (err) {
      return [];
    }
  }

  // Get recent transactions for a token
  async getTokenTransactions(mintAddress, limit = 100) {
    try {
      const signatures = await this.rpc('getSignaturesForAddress', [
        mintAddress,
        { limit }
      ]);
      return signatures || [];
    } catch (err) {
      return [];
    }
  }

  // Get parsed transaction
  async getTransaction(signature) {
    try {
      return await this.rpc('getTransaction', [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
      ]);
    } catch (err) {
      return null;
    }
  }

  // Get token price from Jupiter
  async getTokenPrice(mintAddress) {
    try {
      const res = await fetch(`https://price.jup.ag/v6/price?ids=${mintAddress}`);
      const data = await res.json();
      return data.data?.[mintAddress]?.price || null;
    } catch (err) {
      return null;
    }
  }

  // Get SOL price
  async getSolPrice() {
    try {
      const res = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112');
      const data = await res.json();
      return data.data?.['So11111111111111111111111111111111111111112']?.price || 0;
    } catch (err) {
      return 0;
    }
  }

  // Get account balance
  async getBalance(address) {
    try {
      const balance = await this.rpc('getBalance', [address]);
      return balance / 1e9; // Convert lamports to SOL
    } catch (err) {
      return 0;
    }
  }

  // Get new Solana tokens from multiple sources
  async getPumpFunTokens() {
    // Try Birdeye API first (best for real Pump.fun data)
    if (this.birdeyeKey) {
      try {
        const tokens = await this.getBirdeyeTokens();
        if (tokens && tokens.length > 0) {
          this.dataSource = 'birdeye';
          console.log(`[REAL DATA] Fetched ${tokens.length} tokens from Birdeye`);
          return tokens;
        }
      } catch (e) {
        console.error('Birdeye API failed:', e.message);
      }
    }

    // Try DexScreener as backup
    try {
      const tokens = await this.getDexScreenerTokens();
      if (tokens && tokens.length > 0) {
        this.dataSource = 'dexscreener';
        console.log(`[REAL DATA] Fetched ${tokens.length} tokens from DexScreener`);
        return tokens;
      }
    } catch (e) {
      console.error('DexScreener API failed:', e.message);
    }

    // Try Helius DAS API for recent tokens
    try {
      const tokens = await this.getHeliusTokens();
      if (tokens && tokens.length > 0) {
        this.dataSource = 'helius';
        console.log(`[REAL DATA] Fetched ${tokens.length} tokens from Helius`);
        return tokens;
      }
    } catch (e) {
      console.error('Helius API failed:', e.message);
    }

    // Fallback: Generate synthetic training data
    this.dataSource = 'synthetic';
    console.log('[SYNTHETIC DATA] All APIs failed, using synthetic data for training...');
    return this.generateSyntheticTokens(50);
  }

  // Birdeye API - Best source for Solana tokens
  async getBirdeyeTokens() {
    if (!this.birdeyeKey) return [];
    
    const res = await fetch('https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=50', {
      headers: {
        'X-API-KEY': this.birdeyeKey,
        'x-chain': 'solana'
      }
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Birdeye ${res.status}: ${text.slice(0, 100)}`);
    }
    
    const data = await res.json();
    if (!data.data?.tokens) return [];
    
    return data.data.tokens.map(t => ({
      mint: t.address,
      symbol: t.symbol,
      name: t.name,
      // Price data
      price: t.price || 0,
      priceChange30m: t.v30mChangePercent || 0,
      priceChange1h: t.v1hChangePercent || 0,
      priceChange4h: t.v4hChangePercent || 0,
      priceChange24h: t.v24hChangePercent || 0,
      // Market data
      usd_market_cap: t.mc || t.realMc || 0,
      fdv: t.fdv || 0,
      virtual_sol_reserves: t.liquidity || 0,
      // Volume data
      volume30m: t.v30mUSD || 0,
      volume1h: t.v1hUSD || 0,
      volume4h: t.v4hUSD || 0,
      volume24h: t.v24hUSD || 0,
      // Trading activity
      txns24h: t.trade24h || 0,
      buys24h: t.buy24h || 0,
      sells24h: t.sell24h || 0,
      buyVolume24h: t.vBuy24hUSD || 0,
      sellVolume24h: t.vSell24hUSD || 0,
      // Holder data
      holder_count: t.holder || 0,
      // Unique wallets
      uniqueWallet24h: t.uniqueWallet24h || 0,
      // Supply info
      supply: t.supply || 0,
      circulatingSupply: t.circulatingSupply || 0,
      // Timestamps
      created_timestamp: t.createdAt || new Date().toISOString(),
      lastTradeTime: t.lastTradeUnixTime || 0,
      // Calculated metrics
      buyPressure: t.buy24h && t.sell24h ? (t.buy24h / (t.buy24h + t.sell24h)) * 100 : 50,
      volumeToMcap: t.mc ? (t.v24hUSD || 0) / t.mc : 0,
      source: 'birdeye'
    }));
  }

  // DexScreener API
  async getDexScreenerTokens() {
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/solana', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.pairs) return [];
    
    return data.pairs.slice(0, 50).map(pair => this.formatDexScreenerToken(pair));
  }

  // Helius DAS API for token discovery
  async getHeliusTokens() {
    // Get recent token accounts using Helius enhanced API
    const res = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mintAccounts: [],
        includeOffChain: true,
        disableCache: false
      })
    });
    
    if (!res.ok) return [];
    
    // This endpoint needs mint addresses, so we'll use a different approach
    // Get trending from Jupiter
    const jupRes = await fetch('https://token.jup.ag/strict');
    if (!jupRes.ok) return [];
    
    const tokens = await jupRes.json();
    
    // Get prices for these tokens
    const mints = tokens.slice(0, 30).map(t => t.address);
    const priceRes = await fetch(`https://price.jup.ag/v6/price?ids=${mints.join(',')}`);
    const priceData = priceRes.ok ? await priceRes.json() : { data: {} };
    
    return tokens.slice(0, 30).map(t => ({
      mint: t.address,
      symbol: t.symbol,
      name: t.name,
      usd_market_cap: 0, // Jupiter doesn't provide this
      virtual_sol_reserves: 0,
      holder_count: 0,
      created_timestamp: new Date().toISOString(),
      price: priceData.data?.[t.address]?.price || 0,
      volume24h: 0,
      priceChange24h: 0,
      txns24h: 0,
      source: 'helius'
    }));
  }

  getDataSource() {
    return this.dataSource;
  }

  generateSyntheticTokens(count) {
    const tokens = [];
    const names = ['MOON', 'DOGE', 'PEPE', 'SHIB', 'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'SLERF'];
    
    for (let i = 0; i < count; i++) {
      const baseName = names[Math.floor(Math.random() * names.length)];
      tokens.push({
        mint: `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
        symbol: `${baseName}${Math.floor(Math.random() * 999)}`,
        name: `${baseName} Token ${i}`,
        usd_market_cap: Math.random() * 500000 + 5000,
        virtual_sol_reserves: Math.random() * 100 + 5,
        holder_count: Math.floor(Math.random() * 1000) + 10,
        created_timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        price: Math.random() * 0.001,
        volume24h: Math.random() * 100000,
        priceChange24h: (Math.random() - 0.5) * 100,
        txns24h: Math.floor(Math.random() * 500)
      });
    }
    return tokens;
  }

  formatDexScreenerToken(pair) {
    return {
      mint: pair.baseToken?.address || pair.pairAddress,
      symbol: pair.baseToken?.symbol || 'UNKNOWN',
      name: pair.baseToken?.name || 'Unknown Token',
      usd_market_cap: pair.marketCap || pair.fdv || 0,
      virtual_sol_reserves: pair.liquidity?.usd ? pair.liquidity.usd / 200 : 0,
      holder_count: 100,
      created_timestamp: new Date(pair.pairCreatedAt || Date.now()).toISOString(),
      price: parseFloat(pair.priceUsd) || 0,
      volume24h: pair.volume?.h24 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0)
    };
  }

  // Get token details from Pump.fun
  async getPumpFunToken(mintAddress) {
    try {
      const res = await fetch(`https://frontend-api.pump.fun/coins/${mintAddress}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  // Analyze token trading activity
  async analyzeTokenActivity(mintAddress, hours = 24) {
    const txs = await this.getTokenTransactions(mintAddress, 500);
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    let buys = 0, sells = 0, volume = 0;
    const uniqueWallets = new Set();
    
    for (const tx of txs) {
      if (tx.blockTime * 1000 < cutoff) continue;
      // Simplified analysis - in production you'd parse the actual swap instructions
      uniqueWallets.add(tx.signature.slice(0, 20));
    }
    
    return {
      transactionCount: txs.length,
      uniqueWallets: uniqueWallets.size,
      recentActivity: txs.filter(t => t.blockTime * 1000 > cutoff).length
    };
  }
}

export default new HeliusService();
