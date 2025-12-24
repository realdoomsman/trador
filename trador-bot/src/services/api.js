import http from 'http';
import { config } from '../config.js';
import { state } from '../state.js';

export class ApiServer {
  constructor() {
    this.server = null;
  }

  start() {
    this.server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${config.dashboardPort}`);
      
      if (url.pathname === '/api/state') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state));
        return;
      }
      
      if (url.pathname === '/api/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state.stats));
        return;
      }
      
      if (url.pathname === '/api/trades') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state.recentTrades));
        return;
      }
      
      if (url.pathname === '/api/buybacks') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state.recentBuybacks));
        return;
      }
      
      if (url.pathname === '/api/position') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state.position));
        return;
      }
      
      if (url.pathname === '/api/candidates') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state.candidates));
        return;
      }
      
      // Health check
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', botStatus: state.botStatus }));
        return;
      }
      
      res.writeHead(404);
      res.end('Not found');
    });

    this.server.listen(config.dashboardPort, () => {
      console.log(`[API] Server running on http://localhost:${config.dashboardPort}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}
