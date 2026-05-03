/**
 * Rate Limiter
 * Prevents cascading failures by limiting signal ingestion rate
 */

export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10000, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(): boolean {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getMetrics(): {
    requestsInWindow: number;
    maxRequests: number;
    utilizationPercent: number;
  } {
    const now = Date.now();
    const filtered = this.requests.filter((time) => now - time < this.windowMs);
    return {
      requestsInWindow: filtered.length,
      maxRequests: this.maxRequests,
      utilizationPercent: (filtered.length / this.maxRequests) * 100,
    };
  }
}
