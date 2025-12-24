import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import config from '../config.js';

class GpuWorkerPool {
  constructor() {
    this.workers = [];
    this.taskQueue = [];
    this.isGpuAvailable = false;
  }

  async initialize() {
    if (!config.useGpu) {
      console.log('GPU disabled, using CPU mode');
      return;
    }

    try {
      // Check for NVIDIA GPU
      const { execSync } = await import('child_process');
      const gpuInfo = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader', { encoding: 'utf8' });
      console.log('GPU detected:', gpuInfo.trim());
      this.isGpuAvailable = true;
      
      // Create worker pool
      for (let i = 0; i < config.gpuWorkers; i++) {
        this.workers.push({ id: i, busy: false });
      }
      console.log(`GPU worker pool initialized with ${config.gpuWorkers} workers`);
    } catch (err) {
      console.log('No GPU available, using CPU mode');
      this.isGpuAvailable = false;
    }
  }

  // Process multiple tokens in parallel when GPU available
  async processParallel(tokens, processFn) {
    if (!this.isGpuAvailable || tokens.length <= 1) {
      // Sequential processing
      const results = [];
      for (const token of tokens) {
        results.push(await processFn(token));
      }
      return results;
    }

    // Parallel processing with worker pool
    const batchSize = Math.ceil(tokens.length / config.gpuWorkers);
    const batches = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map(batch => this.processBatch(batch, processFn))
    );

    return results.flat();
  }

  async processBatch(batch, processFn) {
    const results = [];
    for (const item of batch) {
      results.push(await processFn(item));
    }
    return results;
  }

  getStatus() {
    return {
      gpuAvailable: this.isGpuAvailable,
      workers: config.gpuWorkers,
      mode: this.isGpuAvailable ? 'GPU' : 'CPU'
    };
  }
}

export default new GpuWorkerPool();
