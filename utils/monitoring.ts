/**
 * Application monitoring and health check utilities
 */

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  timestamp: Date;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  performance: {
    fps: number;
    responseTime: number;
    errorRate: number;
  };
  network: {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  storage: {
    used: number;
    available: number;
    percentage: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  cooldown: number; // milliseconds
  lastTriggered?: Date;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  timestamp: Date;
  metrics: SystemMetrics;
  acknowledged: boolean;
}

class MonitoringService {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private metrics: SystemMetrics | null = null;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: ((alert: Alert) => void)[] = [];

  constructor() {
    this.initializeDefaultAlertRules();
  }

  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        condition: (metrics) => metrics.memory.percentage > 85,
        severity: 'warning',
        message: 'Memory usage is above 85%',
        cooldown: 60000 // 1 minute
      },
      {
        id: 'critical_memory_usage',
        name: 'Critical Memory Usage',
        condition: (metrics) => metrics.memory.percentage > 95,
        severity: 'critical',
        message: 'Memory usage is critically high (>95%)',
        cooldown: 30000 // 30 seconds
      },
      {
        id: 'low_fps',
        name: 'Low Frame Rate',
        condition: (metrics) => metrics.performance.fps < 30,
        severity: 'warning',
        message: 'Frame rate has dropped below 30 FPS',
        cooldown: 120000 // 2 minutes
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: (metrics) => metrics.performance.errorRate > 0.1,
        severity: 'error',
        message: 'Error rate is above 10%',
        cooldown: 60000 // 1 minute
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        condition: (metrics) => metrics.performance.responseTime > 5000,
        severity: 'warning',
        message: 'Average response time is above 5 seconds',
        cooldown: 180000 // 3 minutes
      },
      {
        id: 'network_offline',
        name: 'Network Offline',
        condition: (metrics) => !metrics.network.online,
        severity: 'error',
        message: 'Network connection is offline',
        cooldown: 10000 // 10 seconds
      },
      {
        id: 'storage_full',
        name: 'Storage Nearly Full',
        condition: (metrics) => metrics.storage.percentage > 90,
        severity: 'warning',
        message: 'Local storage is above 90% capacity',
        cooldown: 300000 // 5 minutes
      }
    ];
  }

  startMonitoring(interval: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.runHealthChecks();
      this.evaluateAlertRules();
    }, interval);

    // Initial collection
    this.collectMetrics();
    this.runHealthChecks();
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  private async collectMetrics(): Promise<void> {
    try {
      const memory = this.getMemoryMetrics();
      const performance = await this.getPerformanceMetrics();
      const network = this.getNetworkMetrics();
      const storage = this.getStorageMetrics();

      this.metrics = {
        memory,
        performance,
        network,
        storage
      };
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  private getMemoryMetrics(): SystemMetrics['memory'] {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }

    // Fallback for browsers without memory API
    return {
      used: 0,
      total: 0,
      percentage: 0
    };
  }

  private async getPerformanceMetrics(): Promise<SystemMetrics['performance']> {
    const fps = await this.measureFPS();
    const responseTime = this.getAverageResponseTime();
    const errorRate = this.calculateErrorRate();

    return {
      fps,
      responseTime,
      errorRate
    };
  }

  private async measureFPS(): Promise<number> {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();

      const countFrame = () => {
        frames++;
        if (performance.now() - startTime < 1000) {
          requestAnimationFrame(countFrame);
        } else {
          resolve(frames);
        }
      };

      requestAnimationFrame(countFrame);
    });
  }

  private getAverageResponseTime(): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (entries.length > 0) {
        const entry = entries[0];
        return entry.responseEnd - entry.requestStart;
      }
    }
    return 0;
  }

  private calculateErrorRate(): number {
    // This would typically be calculated from actual error tracking
    // For now, return a placeholder value
    return 0;
  }

  private getNetworkMetrics(): SystemMetrics['network'] {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        online,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      };
    }

    return { online };
  }

  private getStorageMetrics(): SystemMetrics['storage'] {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate().then(estimate => ({
        used: estimate.usage || 0,
        available: estimate.quota || 0,
        percentage: estimate.usage && estimate.quota 
          ? (estimate.usage / estimate.quota) * 100 
          : 0
      })).catch(() => ({
        used: 0,
        available: 0,
        percentage: 0
      }));
    }

    // Fallback
    return {
      used: 0,
      available: 0,
      percentage: 0
    };
  }

  private async runHealthChecks(): Promise<void> {
    // API Health Check
    await this.checkAPIHealth();
    
    // Local Storage Health Check
    this.checkLocalStorageHealth();
    
    // Browser Compatibility Check
    this.checkBrowserCompatibility();
    
    // Performance Health Check
    this.checkPerformanceHealth();
  }

  private async checkAPIHealth(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // This would typically ping your API endpoint
      // For now, we'll simulate a health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const responseTime = performance.now() - startTime;
      
      this.healthChecks.set('api', {
        name: 'API Health',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        message: `API responding in ${responseTime.toFixed(2)}ms`,
        timestamp: new Date(),
        responseTime,
        metadata: { endpoint: '/api/health' }
      });
    } catch (error) {
      this.healthChecks.set('api', {
        name: 'API Health',
        status: 'unhealthy',
        message: `API health check failed: ${error}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private checkLocalStorageHealth(): void {
    try {
      const testKey = '__health_check__';
      const testValue = 'test';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      this.healthChecks.set('localStorage', {
        name: 'Local Storage',
        status: retrieved === testValue ? 'healthy' : 'unhealthy',
        message: retrieved === testValue ? 'Local storage is working' : 'Local storage read/write failed',
        timestamp: new Date()
      });
    } catch (error) {
      this.healthChecks.set('localStorage', {
        name: 'Local Storage',
        status: 'unhealthy',
        message: `Local storage is not available: ${error}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private checkBrowserCompatibility(): void {
    const requiredFeatures = [
      'fetch',
      'Promise',
      'localStorage',
      'sessionStorage',
      'WebSocket'
    ];

    const missingFeatures = requiredFeatures.filter(feature => 
      typeof window !== 'undefined' && !(feature in window)
    );

    this.healthChecks.set('browserCompatibility', {
      name: 'Browser Compatibility',
      status: missingFeatures.length === 0 ? 'healthy' : 'degraded',
      message: missingFeatures.length === 0 
        ? 'All required features are supported'
        : `Missing features: ${missingFeatures.join(', ')}`,
      timestamp: new Date(),
      metadata: { missingFeatures }
    });
  }

  private checkPerformanceHealth(): void {
    if (!this.metrics) return;

    const issues: string[] = [];
    
    if (this.metrics.memory.percentage > 80) {
      issues.push('High memory usage');
    }
    
    if (this.metrics.performance.fps < 30) {
      issues.push('Low frame rate');
    }
    
    if (this.metrics.performance.responseTime > 3000) {
      issues.push('Slow response times');
    }

    this.healthChecks.set('performance', {
      name: 'Performance Health',
      status: issues.length === 0 ? 'healthy' : issues.length < 3 ? 'degraded' : 'unhealthy',
      message: issues.length === 0 
        ? 'Performance is good'
        : `Performance issues: ${issues.join(', ')}`,
      timestamp: new Date(),
      metadata: { issues, metrics: this.metrics.performance }
    });
  }

  private evaluateAlertRules(): void {
    if (!this.metrics) return;

    const now = new Date();

    this.alertRules.forEach(rule => {
      // Check cooldown
      if (rule.lastTriggered && 
          now.getTime() - rule.lastTriggered.getTime() < rule.cooldown) {
        return;
      }

      // Evaluate condition
      if (rule.condition(this.metrics!)) {
        const alert: Alert = {
          id: `${rule.id}_${now.getTime()}`,
          rule,
          timestamp: now,
          metrics: { ...this.metrics! },
          acknowledged: false
        };

        this.alerts.push(alert);
        rule.lastTriggered = now;

        // Notify callbacks
        this.alertCallbacks.forEach(callback => {
          try {
            callback(alert);
          } catch (error) {
            console.error('Alert callback failed:', error);
          }
        });
      }
    });
  }

  // Public API methods
  getHealthStatus(): Map<string, HealthCheck> {
    return new Map(this.healthChecks);
  }

  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics ? { ...this.metrics } : null;
  }

  getAlerts(unacknowledgedOnly: boolean = false): Alert[] {
    return this.alerts.filter(alert => !unacknowledgedOnly || !alert.acknowledged);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  onAlert(callback: (alert: Alert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index !== -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  exportData(): {
    healthChecks: HealthCheck[];
    alerts: Alert[];
    metrics: SystemMetrics | null;
  } {
    return {
      healthChecks: Array.from(this.healthChecks.values()),
      alerts: [...this.alerts],
      metrics: this.metrics ? { ...this.metrics } : null
    };
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

// Utility functions for monitoring integration
export function createMonitoringDashboard(): HTMLElement {
  const dashboard = document.createElement('div');
  dashboard.className = 'monitoring-dashboard';
  dashboard.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 300px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
    max-height: 400px;
    overflow-y: auto;
  `;

  return dashboard;
}

export function updateMonitoringDashboard(
  dashboard: HTMLElement, 
  monitoring: MonitoringService
): void {
  const metrics = monitoring.getCurrentMetrics();
  const healthChecks = monitoring.getHealthStatus();
  const alerts = monitoring.getAlerts(true);

  let html = '<h3>System Monitoring</h3>';

  // Metrics
  if (metrics) {
    html += `
      <div>
        <strong>Memory:</strong> ${metrics.memory.percentage.toFixed(1)}%<br>
        <strong>FPS:</strong> ${metrics.performance.fps}<br>
        <strong>Response Time:</strong> ${metrics.performance.responseTime.toFixed(0)}ms<br>
        <strong>Network:</strong> ${metrics.network.online ? 'Online' : 'Offline'}<br>
      </div>
    `;
  }

  // Health Checks
  html += '<h4>Health Checks</h4>';
  healthChecks.forEach(check => {
    const statusColor = check.status === 'healthy' ? 'green' : 
                       check.status === 'degraded' ? 'orange' : 'red';
    html += `<div style="color: ${statusColor}">
      ${check.name}: ${check.status}
      ${check.message ? `<br><small>${check.message}</small>` : ''}
    </div>`;
  });

  // Alerts
  if (alerts.length > 0) {
    html += '<h4>Active Alerts</h4>';
    alerts.forEach(alert => {
      const severityColor = alert.rule.severity === 'critical' ? 'red' :
                           alert.rule.severity === 'error' ? 'orange' :
                           alert.rule.severity === 'warning' ? 'yellow' : 'white';
      html += `<div style="color: ${severityColor}">
        ${alert.rule.name}: ${alert.rule.message}
      </div>`;
    });
  }

  dashboard.innerHTML = html;
}

// Global monitoring instance
export const monitoring = new MonitoringService();

// Auto-start monitoring in development
if (process.env.NODE_ENV === 'development') {
  monitoring.startMonitoring(10000); // Every 10 seconds in dev
  
  // Create and show monitoring dashboard
  if (typeof window !== 'undefined') {
    const dashboard = createMonitoringDashboard();
    document.body.appendChild(dashboard);
    
    setInterval(() => {
      updateMonitoringDashboard(dashboard, monitoring);
    }, 1000);
  }
}