// PUMP.FUN WEBSOCKET SERVICE - Real-time token detection
// Catches new tokens the moment they're created, not 15 seconds later
// REFACTORED: Event-driven discovery with InitializeMint detection

import WebSocket from 'ws';
import config from '../config.js';

const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

class PumpFunWebSocket {
  constructor() {
    this.ws = null;
    this.heliusWs = null;
    this.tokenProgramWs = null; // NEW: Separate WS for InitializeMint
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    
    // Callbacks
    this.onNewToken = null;
    this.onTrade = null;
    this.onPriceUpdate = null;
    
    // Token tracking with first-block data
    this.recentTokens = new Map(); // mint -> { createdAt, trades, price, firstBlockBuyers }
    this.maxTrackedTokens = 1000;
    
    // First-block sniper tracking
    this.firstBlockBuyers = new Map(); // mint -> Set of wallet addresses
    
    // Stats
    this.stats = {
      tokensDetected: 0,
      tradesDetected: 0,
      lastTokenTime: null,
      uptime: 0,
      reconnects: 0,
      avgDetectionLatency: 0, // ms from block to callback
      firstBlockCaptures: 0
    };
    
    this.startTime = Date.now();
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
          
          // Subscribe to Pump.fun program logs (token creation + trades)
          this.subscribeToProgram(PUMP_FUN_PROGRAM_ID);
          
          // CRITICAL: Also subscribe to Token Program for InitializeMint
          // This catches the mint instruction BEFORE pump.fun processes it
          this.subscribeToTokenProgram();
          
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

  // Subscribe to Token Program for InitializeMint instructions
  subscribeToTokenProgram() {
    if (!this.heliusWs || this.heliusWs.readyState !== WebSocket.OPEN) return;

    // Subscribe to Token Program to catch InitializeMint
    const subscribeMsg = {
      jsonrpc: '2.0',
      id: 2,
      method: 'logsSubscribe',
      params: [
        { mentions: [TOKEN_PROGRAM_ID] },
        { commitment: 'processed' } // Use 'processed' for fastest detection
      ]
    };

    this.heliusWs.send(JSON.stringify(subscribeMsg));
    console.log(`[WS] Subscribed to Token Program for InitializeMint detection`);
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
    const detectionTime = Date.now();
    
    // PRIORITY 1: Detect InitializeMint (fastest - catches token before pump.fun)
    if (logStr.includes('InitializeMint') || logStr.includes('Instruction: InitializeMint')) {
      this.handleInitializeMint(logs, signature, detectionTime);
      return;
    }
    
    // PRIORITY 2: Detect new token creation on Pump.fun
    if (logStr.includes('Program log: Instruction: Create') || 
        logStr.includes('CreateIdempotent')) {
      this.handleNewToken(logs, signature, detectionTime);
      return;
    }
    
    // PRIORITY 3: Detect trades (Buy/Sell) - track first-block buyers
    if (logStr.includes('Program log: Instruction: Buy') || 
        logStr.includes('Program log: Instruction: Sell')) {
      this.handleTrade(logs, signature, detectionTime);
    }
  }

  // Handle InitializeMint - FASTEST detection method
  async handleInitializeMint(logs, signature, detectionTime) {
    const mint = this.extractMintFromLogs(logs);
    if (!mint) return;
    
    // Skip if already seen
    if (this.recentTokens.has(mint)) return;
    
    // Check if this is a pump.fun related mint (look for pump.fun program in logs)
    const logStr = logs.join(' ');
    const isPumpFun = logStr.includes(PUMP_FUN_PROGRAM_ID) || 
                      logStr.includes('pump') ||
                      logStr.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    
    if (!isPumpFun) return; // Skip non-pump.fun mints
    
    this.stats.tokensDetected++;
    this.stats.lastTokenTime = detectionTime;
    this.stats.firstBlockCaptures++;
    
    console.log(`[WS-MINT] InitializeMint detected: ${mint} (latency: ${Date.now() - detectionTime}ms)`);
    
    // Track it with first-block data
    this.recentTokens.set(mint, {
      mint,
      createdAt: detectionTime,
      detectedVia: 'InitializeMint',
      trades: 0,
      signature,
      firstBlockBuyers: new Set(),
      isFirstBlock: true
    });
    
    // Initialize first-block buyer tracking
    this.firstBlockBuyers.set(mint, new Set());
    
    // Cleanup old tokens
    this.cleanupOldTokens();
    
    // Trigger callback IMMEDIATELY
    if (this.onNewToken) {
      try {
        await this.onNewToken(mint, signature, { isFirstBlock: true, detectedVia: 'InitializeMint' });
      } catch (err) {
        console.error('[WS] onNewToken callback error:', err.message);
      }
    }
  }

  // Handle new token creation
  async handleNewToken(logs, signature, detectionTime = Date.now()) {
    this.stats.tokensDetected++;
    this.stats.lastTokenTime = detectionTime;
    
    // Extract mint address from logs
    const mint = this.extractMintFromLogs(logs);
    if (!mint) return;
    
    // Skip if already seen (might have been caught by InitializeMint)
    if (this.recentTokens.has(mint)) {
      // Update existing entry
      const existing = this.recentTokens.get(mint);
      existing.confirmedAt = detectionTime;
      return;
    }
    
    console.log(`[WS-CREATE] New token: ${mint} (sig: ${signature?.slice(0, 20)}...)`);
    
    // Track it
    this.recentTokens.set(mint, {
      mint,
      createdAt: detectionTime,
      detectedVia: 'Create',
      trades: 0,
      signature,
      firstBlockBuyers: new Set(),
      isFirstBlock: true
    });
    
    // Initialize first-block buyer tracking
    this.firstBlockBuyers.set(mint, new Set());
    
    // Cleanup old tokens
    this.cleanupOldTokens();
    
    // Trigger callback
    if (this.onNewToken) {
      try {
        await this.onNewToken(mint, signature, { isFirstBlock: true, detectedVia: 'Create' });
      } catch (err) {
        console.error('[WS] onNewToken callback error:', err.message);
      }
    }
  }

  // Handle trade events - TRACK FIRST-BLOCK SNIPERS
  handleTrade(logs, signature, detectionTime = Date.now()) {
    this.stats.tradesDetected++;
    
    const mint = this.extractMintFromLogs(logs);
    if (!mint) return;
    
    // Extract buyer wallet from logs
    const buyer = this.extractBuyerFromLogs(logs);
    
    // Update trade count
    const token = this.recentTokens.get(mint);
    if (token) {
      token.trades++;
      token.lastTrade = detectionTime;
      
      // Track first-block buyers (within 2 seconds of creation)
      if (buyer && token.isFirstBlock && (detectionTime - token.createdAt) < 2000) {
        token.firstBlockBuyers.add(buyer);
        
        // Also track in global map
        if (this.firstBlockBuyers.has(mint)) {
          this.firstBlockBuyers.get(mint).add(buyer);
        }
      }
      
      // After 5 seconds, mark as no longer first block
      if ((detectionTime - token.createdAt) > 5000) {
        token.isFirstBlock = false;
      }
    }
    
    // Trigger callback
    if (this.onTrade) {
      const isBuy = logs.some(l => l.includes('Instruction: Buy'));
      this.onTrade(mint, isBuy ? 'buy' : 'sell', signature, { buyer, isFirstBlock: token?.isFirstBlock });
    }
  }

  // Extract buyer wallet address from logs
  extractBuyerFromLogs(logs) {
    for (const log of logs) {
      // Look for wallet/signer patterns
      const signerMatch = log.match(/signer[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
      if (signerMatch) return signerMatch[1];
      
      const walletMatch = log.match(/wallet[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
      if (walletMatch) return walletMatch[1];
      
      const userMatch = log.match(/user[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
      if (userMatch) return userMatch[1];
    }
    return null;
  }

  // Get sniper count for a token
  getSniperCount(mint) {
    const buyers = this.firstBlockBuyers.get(mint);
    return buyers ? buyers.size : 0;
  }

  // Get first-block buyers for a token
  getFirstBlockBuyers(mint) {
    const buyers = this.firstBlockBuyers.get(mint);
    return buyers ? [...buyers] : [];
  }

  // Cleanup old tokens
  cleanupOldTokens() {
    if (this.recentTokens.size > this.maxTrackedTokens) {
      const oldest = [...this.recentTokens.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        this.recentTokens.delete(oldest[0]);
        this.firstBlockBuyers.delete(oldest[0]);
      }
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
      reconnectAttempts: this.reconnectAttempts,
      uptime: Date.now() - this.startTime,
      firstBlockBuyersTracked: this.firstBlockBuyers.size
    };
  }

  // Disconnect
  disconnect() {
    if (this.heliusWs) {
      this.heliusWs.close();
      this.heliusWs = null;
    }
    if (this.tokenProgramWs) {
      this.tokenProgramWs.close();
      this.tokenProgramWs = null;
    }
    this.isConnected = false;
  }
}

export default new PumpFunWebSocket();
