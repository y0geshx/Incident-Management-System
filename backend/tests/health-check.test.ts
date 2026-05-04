/**
 * Health Check Service Tests
 */

import { HealthCheckService } from '../src/services/HealthCheckService';
import { DataLakeStore } from '../src/storage/DataLakeStore';
import { SourceOfTruthStore } from '../src/storage/SourceOfTruthStore';
import { CacheStore } from '../src/storage/CacheStore';

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;
  let dataLakeStore: jest.Mocked<DataLakeStore>;
  let sourceOfTruthStore: jest.Mocked<SourceOfTruthStore>;
  let cacheStore: jest.Mocked<CacheStore>;

  beforeEach(() => {
    // Mock the storage services
    dataLakeStore = {
      healthCheck: jest.fn().mockResolvedValue(true),
    } as any;

    sourceOfTruthStore = {
      healthCheck: jest.fn().mockResolvedValue(true),
    } as any;

    cacheStore = {
      healthCheck: jest.fn().mockResolvedValue(true),
    } as any;

    healthCheckService = new HealthCheckService(
      dataLakeStore,
      sourceOfTruthStore,
      cacheStore
    );
  });

  describe('checkAllServices', () => {
    it('should return operational status when all services are healthy', async () => {
      const systemStatus = await healthCheckService.checkAllServices();

      expect(systemStatus.status).toBe('operational');
      expect(systemStatus.services).toHaveLength(4);
      expect(systemStatus.services.every((s) => s.status === 'healthy')).toBe(true);
      expect(dataLakeStore.healthCheck).toHaveBeenCalled();
      expect(sourceOfTruthStore.healthCheck).toHaveBeenCalled();
      expect(cacheStore.healthCheck).toHaveBeenCalled();
    });

    it('should return degraded status when one service is unhealthy', async () => {
      (dataLakeStore.healthCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Connection timeout')
      );

      const systemStatus = await healthCheckService.checkAllServices();

      expect(systemStatus.status).toBe('degraded');
      expect(systemStatus.services.some((s) => s.status === 'unhealthy')).toBe(true);
    });

    it('should return down status when multiple services are unhealthy', async () => {
      (dataLakeStore.healthCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Connection timeout')
      );
      (sourceOfTruthStore.healthCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const systemStatus = await healthCheckService.checkAllServices();

      expect(systemStatus.status).toBe('down');
    });

    it('should include response times for each service', async () => {
      const systemStatus = await healthCheckService.checkAllServices();

      systemStatus.services.forEach((service) => {
        expect(typeof service.responseTime).toBe('number');
        expect(service.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include timestamps for each service', async () => {
      const systemStatus = await healthCheckService.checkAllServices();

      systemStatus.services.forEach((service) => {
        expect(service.lastChecked).toBeTruthy();
        expect(() => new Date(service.lastChecked)).not.toThrow();
      });
    });

    it('should include system-level timestamp and uptime', async () => {
      const systemStatus = await healthCheckService.checkAllServices();

      expect(systemStatus.timestamp).toBeTruthy();
      expect(typeof systemStatus.uptime).toBe('number');
      expect(systemStatus.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
