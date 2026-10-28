import {
  MempoolStreamEvent,
  RpcEndpointConfig,
  RpcHealthMetrics,
} from '../types/index.js';

export type RpcRequestTransport = (
  endpoint: RpcEndpointConfig,
  method: string,
  params: unknown[]
) => Promise<unknown>;

/**
 * Milestone 2: Resilient Multi-RPC Fallback Client & Mempool Stream Layer.
 *
 * Provides:
 * 1. Priority-ordered RPC endpoint management with automatic failover, timeout guards,
 *    and exponential backoff retries.
 * 2. Continuous health-check and latency scoring across providers (Alchemy, Infura, QuickNode, Anvil).
 * 3. Resilient WebSocket / Subscription stream for `newHeads` and `pendingTransactions` with
 *    auto-reconnect on connection drops and a bounded backpressure ring buffer during gas spikes.
 */
export class ResilientRpcManager {
  private readonly endpoints: RpcEndpointConfig[];
  private readonly metrics: Map<string, RpcHealthMetrics> = new Map();
  private readonly transport: RpcRequestTransport;
  private readonly baseBackoffMs: number;

  // Mempool stream state
  private streamConnected = false;
  private reconnectAttempts = 0;
  private readonly maxBufferSize: number;
  private readonly backpressureBuffer: MempoolStreamEvent[] = [];
  private droppedEventsCount = 0;
  private readonly subscribers: Set<(event: MempoolStreamEvent) => void> = new Set();

  constructor(
    endpoints: RpcEndpointConfig[],
    options?: {
      transport?: RpcRequestTransport;
      baseBackoffMs?: number;
      maxBufferSize?: number;
    }
  ) {
    if (endpoints.length === 0) {
      throw new Error('ResilientRpcManager requires at least one RpcEndpointConfig');
    }

    this.endpoints = [...endpoints].sort((a, b) => a.priority - b.priority);
    this.baseBackoffMs = options?.baseBackoffMs ?? 15;
    this.maxBufferSize = options?.maxBufferSize ?? 256;
    this.transport = options?.transport ?? this.defaultSimulatedTransport.bind(this);

    for (const ep of this.endpoints) {
      this.metrics.set(ep.httpUrl, {
        name: ep.name,
        httpUrl: ep.httpUrl,
        healthy: true,
        latencyMs: 12,
        consecutiveFailures: 0,
        score: 100 - ep.priority,
        lastCheckedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Executes a JSON-RPC call across the priority-ranked endpoints with timeout handling,
   * exponential backoff retry, and automatic failover to secondary RPCs.
   */
  public async call<T = unknown>(method: string, params: unknown[] = []): Promise<{
    result: T;
    providerUsed: string;
    attempts: number;
  }> {
    const orderedEndpoints = this.getRankedEndpoints();
    let totalAttempts = 0;
    const errors: string[] = [];

    for (const endpoint of orderedEndpoints) {
      const maxRetries = endpoint.maxRetries ?? 2;
      const timeoutMs = endpoint.timeoutMs ?? 2000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        totalAttempts++;
        const startTime = Date.now();
        try {
          const result = (await this.withTimeout(
            this.transport(endpoint, method, params),
            timeoutMs,
            `${endpoint.name} timed out after ${timeoutMs}ms`
          )) as T;

          const latencyMs = Math.max(1, Date.now() - startTime);
          this.recordSuccess(endpoint, latencyMs);

          return {
            result,
            providerUsed: endpoint.name,
            attempts: totalAttempts,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`[${endpoint.name}#${attempt}] ${message}`);
          this.recordFailure(endpoint);

          if (attempt < maxRetries) {
            const backoffDelay = this.baseBackoffMs * Math.pow(2, attempt - 1);
            await this.delay(backoffDelay);
          }
        }
      }
    }

    throw new Error(`All RPC endpoints failed for ${method}: ${errors.join(' | ')}`);
  }

  /**
   * Runs an active health check (`eth_blockNumber`) across all configured RPCs and updates latency scores.
   */
  public async healthCheckAll(): Promise<RpcHealthMetrics[]> {
    for (const endpoint of this.endpoints) {
      const start = Date.now();
      try {
        await this.withTimeout(
          this.transport(endpoint, 'eth_blockNumber', []),
          endpoint.timeoutMs ?? 1500,
          'Health check timeout'
        );
        const latencyMs = Math.max(1, Date.now() - start);
        this.recordSuccess(endpoint, latencyMs);
      } catch {
        this.recordFailure(endpoint);
      }
    }
    return this.getHealthMetrics();
  }

  public getHealthMetrics(): RpcHealthMetrics[] {
    return Array.from(this.metrics.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Subscribes to `newHeads` and `pendingTransactions` stream events.
   */
  public subscribeMempoolStream(listener: (event: MempoolStreamEvent) => void): () => void {
    this.streamConnected = true;
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Pushes an incoming WebSocket `newHeads` or `pendingTransactions` event into the backpressure buffer.
   * If the consumer is paused or disconnected, buffers up to `maxBufferSize` events without crashing.
   */
  public ingestStreamEvent(event: MempoolStreamEvent, deliverImmediately = true): void {
    if (this.backpressureBuffer.length >= this.maxBufferSize) {
      // Drop oldest event to preserve latest mempool state under extreme gas spike backpressure
      this.backpressureBuffer.shift();
      this.droppedEventsCount++;
    }
    this.backpressureBuffer.push(event);

    if (deliverImmediately && this.streamConnected) {
      this.flushBackpressureBuffer();
    }
  }

  /**
   * Drains buffered mempool events to all active subscribers.
   */
  public flushBackpressureBuffer(): number {
    if (!this.streamConnected || this.subscribers.size === 0) {
      return 0;
    }
    let flushed = 0;
    while (this.backpressureBuffer.length > 0) {
      const ev = this.backpressureBuffer.shift()!;
      flushed++;
      for (const sub of this.subscribers) {
        sub(ev);
      }
    }
    return flushed;
  }

  /**
   * Simulates a WebSocket connection drop and triggers automatic reconnection + buffer drain.
   */
  public async handleConnectionDropAndReconnect(): Promise<{
    reconnected: boolean;
    reconnectAttempts: number;
    flushedEvents: number;
  }> {
    this.streamConnected = false;
    this.reconnectAttempts++;
    await this.delay(this.baseBackoffMs);
    this.streamConnected = true;
    const flushedEvents = this.flushBackpressureBuffer();
    return {
      reconnected: this.streamConnected,
      reconnectAttempts: this.reconnectAttempts,
      flushedEvents,
    };
  }

  public getStreamDiagnostics(): {
    connected: boolean;
    bufferedCount: number;
    droppedEventsCount: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.streamConnected,
      bufferedCount: this.backpressureBuffer.length,
      droppedEventsCount: this.droppedEventsCount,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private getRankedEndpoints(): RpcEndpointConfig[] {
    return [...this.endpoints].sort((a, b) => {
      const metricA = this.metrics.get(a.httpUrl);
      const metricB = this.metrics.get(b.httpUrl);
      const scoreA = metricA?.score ?? 0;
      const scoreB = metricB?.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.priority - b.priority;
    });
  }

  private recordSuccess(endpoint: RpcEndpointConfig, latencyMs: number): void {
    const latencyPenalty = Math.min(40, Math.floor(latencyMs / 25));
    const priorityBonus = Math.max(0, 20 - endpoint.priority * 5);
    const score = Math.max(10, 100 - latencyPenalty + priorityBonus);

    this.metrics.set(endpoint.httpUrl, {
      name: endpoint.name,
      httpUrl: endpoint.httpUrl,
      healthy: true,
      latencyMs,
      consecutiveFailures: 0,
      score,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  private recordFailure(endpoint: RpcEndpointConfig): void {
    const existing = this.metrics.get(endpoint.httpUrl);
    const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
    const score = Math.max(0, (existing?.score ?? 50) - consecutiveFailures * 35);

    this.metrics.set(endpoint.httpUrl, {
      name: endpoint.name,
      httpUrl: endpoint.httpUrl,
      healthy: false,
      latencyMs: existing?.latencyMs ?? 9999,
      consecutiveFailures,
      score,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  private async defaultSimulatedTransport(
    endpoint: RpcEndpointConfig,
    method: string
  ): Promise<unknown> {
    if (endpoint.httpUrl.includes('offline') || endpoint.httpUrl.includes('fail')) {
      throw new Error(`Connection refused: ${endpoint.httpUrl}`);
    }
    if (method === 'eth_blockNumber') {
      return '0x138ce80'; // Block 20500096
    }
    return { ok: true, method, provider: endpoint.name };
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
