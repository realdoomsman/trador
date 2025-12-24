import fetch from 'node-fetch';
import { config } from '../config.js';
import { state } from '../state.js';

export class TelegramBot {
  constructor() {
    this.token = config.telegramBotToken;
    this.chatId = config.telegramChatId;
    this.enabled = !!(this.token && this.chatId);
    
    if (this.enabled) {
      console.log('[Telegram] Bot enabled');
    } else {
      console.log('[Telegram] Bot disabled (no token/chatId)');
    }
  }

  async send(message, parseMode = 'HTML') {
    if (!this.enabled) return;
    
    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: parseMode,
          disable_web_page_preview: true
        }),
        timeout: 5000
      });
    } catch (err) {
      console.error('[Telegram] Send failed:', err.message);
    }
  }

  async sendTradeOpen(position) {
    const msg = `
🚀 <b>TRADE OPENED</b>

<b>Token:</b> ${position.symbol} (${position.tierName})
<b>Entry:</b> ${position.solIn.toFixed(4)} SOL
<b>MCap:</b> $${position.entryMcap.toFixed(0)}

<b>Targets:</b>
✅ TP: +${(position.takeProfit * 100).toFixed(0)}%
❌ SL: ${(position.stopLoss * 100).toFixed(0)}%
⏰ Max: ${Math.floor(position.maxHoldMs / 60000)}min

<a href="https://pump.fun/${position.mint}">View on Pump.fun</a>
    `.trim();
    
    await this.send(msg);
  }

  async sendTradeClose(trade) {
    const emoji = trade.pnlSol >= 0 ? '✅' : '❌';
    const pnlEmoji = trade.pnlSol >= 0 ? '🟢' : '🔴';
    
    const msg = `
${emoji} <b>TRADE CLOSED</b>

<b>Token:</b> ${trade.symbol}
<b>Reason:</b> ${trade.reason}

${pnlEmoji} <b>PnL:</b> ${trade.pnlSol >= 0 ? '+' : ''}${trade.pnlSol.toFixed(4)} SOL (${(trade.pnlPercent * 100).toFixed(1)}%)
<b>Hold time:</b> ${Math.floor(trade.holdTimeMs / 60000)}min

<b>Stats:</b> ${state.stats.wins}W / ${state.stats.losses}L | Total: ${state.stats.totalPnlSol >= 0 ? '+' : ''}${state.stats.totalPnlSol.toFixed(4)} SOL
    `.trim();
    
    await this.send(msg);
  }

  async sendBuyback(buyback) {
    const msg = `
🔥 <b>BUYBACK EXECUTED</b>

<b>Profit:</b> ${buyback.profit.toFixed(4)} SOL
<b>Spent:</b> ${buyback.solSpent.toFixed(4)} SOL
<b>TRADOR Holdings:</b> ${buyback.tradorBalance?.toLocaleString() || 'N/A'}

<b>Total Buybacks:</b> ${state.stats.totalBuybacks}
<b>Total SOL Spent:</b> ${state.stats.totalBuybackSol.toFixed(4)} SOL

<a href="https://solscan.io/tx/${buyback.sig}">View TX</a>
    `.trim();
    
    await this.send(msg);
  }

  async sendStatus() {
    const { stats, solBalance, position } = state;
    const winRate = stats.totalTrades > 0 ? ((stats.wins / stats.totalTrades) * 100).toFixed(1) : 0;
    
    let positionInfo = 'None';
    if (position) {
      const pnl = (position.currentPnl * 100).toFixed(1);
      positionInfo = `${position.symbol} (${pnl >= 0 ? '+' : ''}${pnl}%)`;
    }
    
    const msg = `
📊 <b>TRADOR STATUS</b>

<b>Balance:</b> ${solBalance.toFixed(4)} SOL
<b>Position:</b> ${positionInfo}

<b>Stats:</b>
• Trades: ${stats.totalTrades}
• Win Rate: ${winRate}%
• Total PnL: ${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(4)} SOL
• Biggest Win: +${stats.biggestWin.toFixed(4)} SOL
• Biggest Loss: ${stats.biggestLoss.toFixed(4)} SOL

<b>Buybacks:</b>
• Count: ${stats.totalBuybacks}
• Total: ${stats.totalBuybackSol.toFixed(4)} SOL
    `.trim();
    
    await this.send(msg);
  }

  async sendError(error, context = '') {
    const msg = `
⚠️ <b>ERROR</b>

${context ? `<b>Context:</b> ${context}\n` : ''}<b>Error:</b> ${error.message || error}
    `.trim();
    
    await this.send(msg);
  }

  async sendStartup() {
    const msg = `
🤖 <b>TRADOR BOT STARTED</b>

<b>Wallet:</b> <code>${state.walletAddress}</code>
<b>Balance:</b> ${state.solBalance.toFixed(4)} SOL
<b>Mode:</b> AGGRESSIVE 🔥

Let's make some gains! 📈
    `.trim();
    
    await this.send(msg);
  }
}
