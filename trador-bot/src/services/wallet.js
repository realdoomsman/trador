import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config.js';
import { state, updateState } from '../state.js';

export class WalletService {
  constructor() {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    
    if (config.privateKey) {
      this.keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
      this.publicKey = this.keypair.publicKey;
    } else {
      // Demo mode - generate random keypair
      this.keypair = Keypair.generate();
      this.publicKey = this.keypair.publicKey;
      console.log('[Wallet] Demo mode - no private key provided');
    }
    
    this.baseline = null;
    updateState({ walletAddress: this.publicKey.toString() });
  }

  async getBalance() {
    try {
      const lamports = await this.connection.getBalance(this.publicKey);
      const balance = lamports / LAMPORTS_PER_SOL;
      updateState({ solBalance: balance });
      return balance;
    } catch (err) {
      console.error('[Wallet] Balance fetch error:', err.message);
      return state.solBalance;
    }
  }

  async getAvailableRisk() {
    const balance = await this.getBalance();
    const available = balance - config.minSolReserve;
    if (available <= 0) return 0;
    return available * config.riskBudgetPercent;
  }

  async initBaseline() {
    this.baseline = await this.getBalance();
    updateState({ baseline: this.baseline });
    console.log(`[Wallet] Baseline set: ${this.baseline.toFixed(4)} SOL`);
    return this.baseline;
  }

  async getProfit() {
    if (this.baseline === null) await this.initBaseline();
    const current = await this.getBalance();
    const profit = current - this.baseline;
    updateState({ totalProfit: profit });
    return profit;
  }

  updateBaseline(newBaseline) {
    this.baseline = newBaseline;
    updateState({ baseline: this.baseline });
    console.log(`[Wallet] Baseline updated: ${this.baseline.toFixed(4)} SOL`);
  }

  async getTokenBalance(mintAddress) {
    try {
      const mint = new PublicKey(mintAddress);
      const accounts = await this.connection.getParsedTokenAccountsByOwner(
        this.publicKey,
        { mint }
      );
      if (accounts.value.length === 0) return 0;
      return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    } catch (err) {
      console.error('[Wallet] Token balance error:', err.message);
      return 0;
    }
  }

  async getTradorHoldings() {
    if (!config.tradorMint) return 0;
    const holdings = await this.getTokenBalance(config.tradorMint);
    updateState({ tradorHoldings: holdings });
    return holdings;
  }
}
