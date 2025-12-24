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

  // Get new Pump.fun tokens
  async getPumpFunTokens() {
    try {
      // Try multiple endpoints
      const endpoints = [
        'https://client-api-2-74b1891ee9f9.herokuapp.com/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false',
        'https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false'
      ];
      
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const text = await res.text();
          if (text.startsWith('<')) continue; // HTML response, try next
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) return data;
          if (data.coins) return data.coins;
        } catch (e) {
          continue;
        }
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch Pump.fun tokens:', err.message);
      return [];
    }
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
