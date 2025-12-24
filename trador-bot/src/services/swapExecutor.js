import { Connection, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fetch from 'node-fetch';
import { config } from '../config.js';

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export class SwapExecutor {
  constructor(walletService) {
    this.wallet = walletService;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  async getQuote(inputMint, outputMint, amountLamports, slippageBps = 300) {
    try {
      const url = `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&onlyDirectRoutes=false`;
      const res = await fetch(url, { timeout: 10000 });
      if (!res.ok) throw new Error(`Quote failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[Swap] Quote error:', err.message);
      return null;
    }
  }

  async simulateSlippage(mint, solAmount) {
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const quote = await this.getQuote(SOL_MINT, mint, lamports, 100);
    if (!quote) return null;
    
    const priceImpact = parseFloat(quote.priceImpactPct || 0) / 100;
    return { 
      expectedOut: parseFloat(quote.outAmount), 
      priceImpact, 
      quote,
      route: quote.routePlan?.map(r => r.swapInfo?.label).join(' → ') || 'direct'
    };
  }

  async buy(mint, solAmount) {
    console.log(`[Swap] Buying ${mint.slice(0, 8)}... with ${solAmount.toFixed(4)} SOL`);
    
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const quote = await this.getQuote(SOL_MINT, mint, lamports, 500); // 5% slippage for buys
    if (!quote) throw new Error('Failed to get quote');

    const swapRes = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: this.wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }),
      timeout: 15000
    });

    if (!swapRes.ok) {
      const err = await swapRes.text();
      throw new Error(`Swap request failed: ${err}`);
    }
    
    const { swapTransaction } = await swapRes.json();
    return this.executeTransaction(swapTransaction);
  }

  async sell(mint, tokenAmount) {
    console.log(`[Swap] Selling ${tokenAmount} of ${mint.slice(0, 8)}...`);
    
    const quote = await this.getQuote(mint, SOL_MINT, Math.floor(tokenAmount), 500);
    if (!quote) throw new Error('Failed to get sell quote');

    const swapRes = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: this.wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }),
      timeout: 15000
    });

    if (!swapRes.ok) {
      const err = await swapRes.text();
      throw new Error(`Swap request failed: ${err}`);
    }
    
    const { swapTransaction } = await swapRes.json();
    return this.executeTransaction(swapTransaction);
  }

  async executeTransaction(swapTransaction) {
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([this.wallet.keypair]);
    
    const sig = await this.connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`[Swap] TX sent: ${sig}`);
    
    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(sig, 'confirmed');
    if (confirmation.value.err) {
      throw new Error(`TX failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    console.log(`[Swap] TX confirmed: ${sig}`);
    return sig;
  }
}
