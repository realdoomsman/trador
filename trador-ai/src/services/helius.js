import config from '../config.js';

class HeliusService {
  constructor() {
    this.apiKey = config.heliusApiKey;
    this.rpcUrl = config.heliusRpcUrl;
    this.baseUrl = `https://api.helius.xyz/v0`;
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
    try {
      // Try Jupiter token list first (most reliable)
      const jupRes = await fetch('https://token.jup.ag/strict');
      if (jupRes.ok) {
        const tokens = await jupRes.json();
        // Get random sample of recent tokens
        const solanaTokens = tokens.slice(0, 100).map(t => ({
          mint: t.address,
          symbol: t.symbol,
          name: t.name,
          usd_market_cap: Math.random() * 500000 + 5000, // Simulated for learning
          virtual_sol_reserves: Math.random() * 100 + 5,
          holder_count: Math.floor(Math.random() * 1000) + 10,
          created_timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          price: Math.random() * 0.001,
          volume24h: Math.random() * 100000,
          priceChange24h: (Math.random() - 0.5) * 100,
          txns24h: Math.floor(Math.random() * 500)
        }));
        return solanaTokens;
      }
    } catch (e) {
      console.error('Jupiter API failed:', e.message);
    }

    // Fallback: Generate synthetic training data
    console.log('Using synthetic data for training...');
    return this.generateSyntheticTokens(50);
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
