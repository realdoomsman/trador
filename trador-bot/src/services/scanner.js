import fetch from 'node-fetch';
import { state, updateState } from '../state.js';

const PUMPFUN_API = 'https://frontend-api.pump.fun';

export class Scanner {
  constructor() {
    this.cache = new Map();
    this.blacklist = new Set();
  }

  async getNewTokens() {
    try {
      const res = await fetch(`${PUMPFUN_API}/coins?offset=0&limit=100&sort=created_timestamp&order=DESC`, {
        timeout: 10000
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const tokens = await res.json();
      return tokens.filter(t => !this.blacklist.has(t.mint));
    } catch (err) {
      console.error('[Scanner] Failed to fetch tokens:', err.message);
      return [];
    }
  }

  async getKingOfTheHill() {
    try {
      const res = await fetch(`${PUMPFUN_API}/coins?offset=0&limit=50&sort=market_cap&order=DESC`, {
        timeout: 10000
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  }

  async getTokenDetails(mint) {
    try {
      const res = await fetch(`${PUMPFUN_API}/coins/${mint}`, { timeout: 5000 });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(`[Scanner] Failed to fetch ${mint}:`, err.message);
      return null;
    }
  }

  async getTrades(mint, limit = 200) {
    try {
      const res = await fetch(`${PUMPFUN_API}/trades/${mint}?limit=${limit}`, { timeout: 5000 });
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  }

  blacklistToken(mint, reason = 'unknown') {
    this.blacklist.add(mint);
    console.log(`[Scanner] Blacklisted ${mint.slice(0, 8)}... (${reason})`);
  }

  calculateMetrics(token, trades) {
    const now = Date.now();
    const age = now - token.created_timestamp;
    
    // Volume calculations by time window
    const trades1m = trades.filter(t => now - t.timestamp < 60000);
    const trades5m = trades.filter(t => now - t.timestamp < 300000);
    const trades15m = trades.filter(t => now - t.timestamp < 900000);
    const trades30m = trades.filter(t => now - t.timestamp < 1800000);
    
    const volume1m = trades1m.reduce((sum, t) => sum + Math.abs(t.sol_amount || 0), 0);
    const volume5m = trades5m.reduce((sum, t) => sum + Math.abs(t.sol_amount || 0), 0);
    const volume15m = trades15m.reduce((sum, t) => sum + Math.abs(t.sol_amount || 0), 0);
    
    // Buy vs sell pressure
    const buys5m = trades5m.filter(t => t.is_buy).length;
    const sells5m = trades5m.filter(t => !t.is_buy).length;
    const buyPressure = buys5m / Math.max(sells5m, 1);
    
    // Volume acceleration (current vs previous window)
    const prevTrades5m = trades.filter(t => now - t.timestamp >= 300000 && now - t.timestamp < 600000);
    const prevVolume5m = prevTrades5m.reduce((sum, t) => sum + Math.abs(t.sol_amount || 0), 0);
    const volumeAccel = prevVolume5m > 0 ? volume5m / prevVolume5m : volume5m > 0 ? 10 : 0;
    
    // Price movement
    const currentPrice = token.usd_market_cap / token.total_supply;
    let priceMove1m = 0;
    let priceMove5m = 0;
    
    if (trades1m.length > 0 && trades.length > trades1m.length) {
      const oldPrice = trades[trades1m.length]?.price_usd || currentPrice;
      priceMove1m = (currentPrice - oldPrice) / oldPrice;
    }
    
    if (trades5m.length > 0 && trades.length > trades5m.length) {
      const oldPrice = trades[trades5m.length]?.price_usd || currentPrice;
      priceMove5m = (currentPrice - oldPrice) / oldPrice;
    }
    
    // Unique traders (whale detection)
    const uniqueTraders = new Set(trades5m.map(t => t.user)).size;
    const avgTradeSize = volume5m / Math.max(trades5m.length, 1);
    
    return {
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      image: token.image_uri,
      age,
      mcapUsd: token.usd_market_cap,
      mcapSol: token.market_cap,
      liquidity: token.virtual_sol_reserves || 0,
      totalSupply: token.total_supply,
      volume1m,
      volume5m,
      volume15m,
      tradeCount5m: trades5m.length,
      buys5m,
      sells5m,
      buyPressure,
      volumeAccel,
      priceMove1m,
      priceMove5m,
      uniqueTraders,
      avgTradeSize,
      currentPrice
    };
  }
}
