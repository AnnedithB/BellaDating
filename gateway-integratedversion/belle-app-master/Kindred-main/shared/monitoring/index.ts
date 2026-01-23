// Monitoring service placeholder to resolve dependencies
export interface MonitoringServiceInterface {
  disabled: true;
}

export class MonitoringService implements MonitoringServiceInterface {
  disabled = true as const;
  
  startMonitoring() {
    throw new Error("Monitoring service disabled - missing dependencies");
  }
  
  stopMonitoring() {
    // No-op
  }
  
  recordMetric() {
    throw new Error("Monitoring service disabled - missing dependencies");
  }
  
  getStats() {
    throw new Error("Monitoring service disabled - missing dependencies");
  }
}

export const monitoringService = new MonitoringService();
