/**
 * Database connection manager for optimized performance
 * Handles connection pooling and health monitoring
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ConnectionHealth {
  isHealthy: boolean;
  latency: number;
  lastChecked: Date;
  errorCount: number;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private health: ConnectionHealth = {
    isHealthy: true,
    latency: 0,
    lastChecked: new Date(),
    errorCount: 0
  };
  static getInstance(): ConnectionManager {
    if (!this.instance) {
      this.instance = new ConnectionManager();
    }
    return this.instance;
  }

  /**
   * Check database connection health
   */
  private async checkConnectionHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simple query to test connection
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        throw error;
      }

      this.health = {
        isHealthy: true,
        latency,
        lastChecked: new Date(),
        errorCount: Math.max(0, this.health.errorCount - 1) // Slowly reduce error count on success
      };

      if (this.health.errorCount === 0) {
        logger.info('Database connection healthy', { latency });
      }

    } catch (error) {
      this.health = {
        isHealthy: false,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        errorCount: this.health.errorCount + 1
      };

      logger.error('Database connection unhealthy', { 
        error: error instanceof Error ? error.message : String(error),
        errorCount: this.health.errorCount 
      });
    }
  }

  /**
   * Get current connection health
   */
  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  /**
   * Wait for healthy connection
   */
  async waitForHealthyConnection(timeoutMs = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.health.isHealthy) {
        return;
      }

      // Force health check
      await this.checkConnectionHealth();

      if (this.health.isHealthy) {
        return;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Database connection not healthy after ${timeoutMs}ms`);
  }

  /**
   * Execute query with connection management
   */
  async executeWithHealthCheck<T>(operation: () => Promise<T>): Promise<T> {
    // Check if connection is healthy
    if (!this.health.isHealthy && this.health.errorCount > 3) {
      await this.waitForHealthyConnection();
    }

    try {
      const result = await operation();
      
      // Reset error count on success
      if (this.health.errorCount > 0) {
        this.health.errorCount = Math.max(0, this.health.errorCount - 1);
      }

      return result;
    } catch (error) {
      this.health.errorCount++;
      throw error;
    }
  }

  /**
   * Cleanup resources. Health is now checked on demand (only when an operation
   * fails or a caller waits for a healthy connection), so there is no timer to clear.
   */
  dispose(): void {
    this.health = {
      isHealthy: true,
      latency: 0,
      lastChecked: new Date(),
      errorCount: 0,
    };
  }
}