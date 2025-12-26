// PUMP.FUN WEBSOCKET SERVICE - Real-time token detection
// Catches new tokens the moment they're created, not 15 seconds later

import WebSocket from 'ws';
import config from '../config.js';

const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

class PumpFunWebSocket {
  constructor() {
    this.ws = null;
    this.heliusWs = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    
    // Callbacks
    this.onNewToken = null;
    this.onTrade = null;
    this.onPriceUpdate = null;
    
    // Token tracking
    this.recentTokens = new Map(); // mint -> { createdAt, trades, price }
    this.maxTrackedTokens = 500;
    
    // Stats
    this.stats = {
      tokensDetected: 0,
      tradesDetected: 0,
      lastTokenTime: null,
      uptime: 0,
      reconnects: 0
    };
  }

  // Connect to Helius WebSocket for program logs
  async connectHelius() {
    if (!config.heliusApiKey) {
      console.log('[WS] No Helius API key - skipping WebSocket');
      return false;
    }

    const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
    
    return new Promise((resolve) => {
      try {
        this.heliusWs = new WebSocket(wsUrl);
        
        this.heliusWs.on('open', () => {
          console.log('[WS] Connected to Helius WebSocket');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Subscribe to Pump.fun program logs
          this.subscribeToProgram(PUMP_FUN_PROGRAM_ID);
          resolve(true);
        });

        this.heliusWs.on('message', (data) => {
          this.handleHeliusMessage(data);
        });

        this.heliusWs.on('error', (err) => {
          console.error('[WS] Helius WebSocket error:', err.message);
        });

        this.heliusWs.on('close', () => {
          console.log('[WS] Helius WebSocket closed');
          this.isConnected = false;
          this.scheduleReconnect();
        });

      } catch (err) {
        console.error('[WS] Failed to connect:', err.message);
        resolve(false);
      }
    });
  }

  // Subscribe to program logs
  subscribeToProgram(programId) {
    if (!this.heliusWs || this.heliusWs.readyState !== WebSocket.OPEN) return;

    const subscribeMsg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'logsSubscribe',
      params: [
        { mentions: [programId] },
        { commitment: 'confirmed' }
      ]
    };

    this.heliusWs.send(JSON.stringify(subscribeMsg));
    console.log(`[WS] Subscribed to program: ${programId}`);
  }

  // Handle incoming Helius messages
  handleHeliusMessage(rawData) {
    try {
      const data = JSON.parse(rawData.toString());
      
      // Subscription confirmation
      if (data.result !== undefined && !data.method) {
        console.log(`[WS] Subscription confirmed: ${data.result}`);
        return;
      }

      // Log notification
      if (data.method === 'logsNotification') {
        const logs = data.params?.result?.value?.logs || [];
        const signature = data.params?.result?.value?.signature;
        
        this.processLogs(logs, signature);
      }
    } catch (err) {
      // Ignore parse errors
    }
  }

  // Process program logs to detect events
  processLogs(logs, signature) {
    const logStr = logs.join(' ');
    
    // Detect new token creation
    if (logStr.includes('Program log: Instruction: Create') || 
        logStr.includes('InitializeMint') ||
        logStr.includes('CreateIdempotent')) {
      this.handleNewToken(logs, signature);
    }
    
    // Detect trades (Buy/Sell)
    if (logStr.includes('Program log: Instruction: Buy') || 
        logStr.includes('Program log: Instruction: Sell')) {
      this.handleTrade(logs, signature);
    }
  }

  // Handle new token creation
  async handleNewToken(logs, signature) {
    this.stats.tokensDetected++;
    this.stats.lastTokenTime = Date.now();
    
    // Extract mint address from logs
    const mint = this.extractMintFromLogs(logs);
    if (!mint) return;
    
    // Skip if already seen
    if (this.recentTokens.has(mint)) return;
    
    console.log(`[WS] NEW TOKEN DETECTED: ${mint} (sig: ${signature?.slice(0, 20)}...)`);
    
    // Track it
    this.recentTokens.set(mint, {
      mint,
      createdAt: Date.now(),
      trades: 0,
      signature
    });
    
    // Cleanup old tokens
    if (this.recentTokens.size > this.maxTrackedTokens) {
      const oldest = [...this.recentTokens.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) this.recentTokens.delete(oldest[0]);
    }
    
    // Trigger callback
    if (this.onNewToken) {
      try {
        await this.onNewToken(mint, signature);
      } catch (err) {
        console.error('[WS] onNewToken callback error:', err.message);
      }
    }
  }

  // Handle trade events
  handleTrade(logs, signature) {
    this.stats.tradesDetected++;
    
    const mint = this.extractMintFromLogs(logs);
    if (!mint) return;
    
    // Update trade count
    const token = this.recentTokens.get(mint);
    if (token) {
      token.trades++;
      token.lastTrade = Date.now();
    }
    
    // Trigger callback
    if (this.onTrade) {
      const isBuy = logs.some(l => l.includes('Instruction: Buy'));
      this.onTrade(mint, isBuy ? 'buy' : 'sell', signature);
    }
  }

  // Extract mint address from logs
  extractMintFromLogs(logs) {
    for (const log of logs) {
      // Look for mint address patterns
      const mintMatch = log.match(/mint[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
      if (mintMatch) return mintMatch[1];
      
      // Look for token address patterns
      const tokenMatch = log.match(/token[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
      if (tokenMatch) return tokenMatch[1];
      
      // Look for any base58 address that's not a known program
      const addrMatch = log.match(/([1-9A-HJ-NP-Za-km-z]{43,44})/);
      if (addrMatch && !this.isKnownProgram(addrMatch[1])) {
        return addrMatch[1];
      }
    }
    return null;
  }

  isKnownProgram(addr) {
    const knownPrograms = [
      PUMP_FUN_PROGRAM_ID,
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
      '11111111111111111111111111111111', // System Program
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token
    ];
    return knownPrograms.includes(addr);
  }

  // Schedule reconnection
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    this.stats.reconnects++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`[WS] Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectHelius();
    }, delay);
  }

  // Get recently detected tokens
  getRecentTokens(maxAge = 300000) { // 5 minutes default
    const now = Date.now();
    return [...this.recentTokens.values()]
      .filter(t => now - t.createdAt < maxAge)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Get stats
  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      trackedTokens: this.recentTokens.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Disconnect
  disconnect() {
    if (this.heliusWs) {
      this.heliusWs.close();
      this.heliusWs = null;
    }
    this.isConnected = false;
  }
}

export default new PumpFunWebSocket();
