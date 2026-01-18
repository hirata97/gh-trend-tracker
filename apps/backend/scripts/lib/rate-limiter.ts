/**
 * Rate Limiter for GitHub API requests
 * Ensures compliance with GitHub API rate limits (30 search requests per minute)
 */

export class RateLimiter {
  private lastRequestTime = 0;
  private minInterval: number;

  /**
   * @param requestsPerMinute - Maximum number of requests allowed per minute
   */
  constructor(requestsPerMinute: number = 30) {
    // Convert to milliseconds between requests
    this.minInterval = (60 * 1000) / requestsPerMinute;
  }

  /**
   * Throttle execution to respect rate limits
   * Sleeps if necessary to maintain the minimum interval between requests
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const sleepTime = this.minInterval - timeSinceLastRequest;
      await this.sleep(sleepTime);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset the rate limiter state
   * Useful for testing or starting a new batch of requests
   */
  reset(): void {
    this.lastRequestTime = 0;
  }
}
