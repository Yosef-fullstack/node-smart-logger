/**
 * @jest-environment node
 */

// Use a testing approach that works with CommonJS modules
describe('Graceful Shutdown', () => {
  let gracefulShutdown;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processOnSpy;
  let processExitSpy;

  // Store original methods
  let originalProcessOn;
  let originalProcessExit;
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(() => {
    // Store original methods
    originalProcessOn = process.on;
    originalProcessExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    // Create spies
    consoleLogSpy = jest.fn();
    consoleErrorSpy = jest.fn();
    processOnSpy = jest.fn();
    processExitSpy = jest.fn();
    
    // Replace global methods
    process.on = processOnSpy;
    process.exit = processExitSpy;
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
    
    // Clear module cache and reload
    jest.resetModules();
    delete require.cache[require.resolve('../graceful-shutdown')];
    gracefulShutdown = require('../graceful-shutdown');
  });

  afterEach(() => {
    // Restore original methods
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('setCloudWatchTransport', () => {
    it('should set CloudWatch transport without error', () => {
      const mockTransport = { name: 'cloudwatch' };
      expect(() => gracefulShutdown.setCloudWatchTransport(mockTransport)).not.toThrow();
    });

    it('should handle null transport without error', () => {
      expect(() => gracefulShutdown.setCloudWatchTransport(null)).not.toThrow();
    });
  });

  describe('shutdownLogger', () => {
    it('should complete shutdown without CloudWatch transport', async () => {
      await gracefulShutdown.shutdownLogger();
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });

    it('should handle CloudWatch transport with kthxbye method', async () => {
      const mockTransport = { 
        kthxbye: jest.fn((callback) => callback()) 
      };
      
      gracefulShutdown.setCloudWatchTransport(mockTransport);
      await gracefulShutdown.shutdownLogger();
      
      expect(mockTransport.kthxbye).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });

    it('should handle CloudWatch transport without kthxbye method', async () => {
      const mockTransport = { name: 'cloudwatch' };
      
      gracefulShutdown.setCloudWatchTransport(mockTransport);
      await gracefulShutdown.shutdownLogger();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });

    it('should handle CloudWatch transport flush error', async () => {
      const mockTransport = {
        kthxbye: jest.fn(() => {
          throw new Error('Flush error');
        })
      };
      
      gracefulShutdown.setCloudWatchTransport(mockTransport);
      await gracefulShutdown.shutdownLogger();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error flushing CloudWatch logs:', expect.any(Error));
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });

    it('should not shutdown twice', async () => {
      await gracefulShutdown.shutdownLogger();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      consoleLogSpy.mockClear();
      
      await gracefulShutdown.shutdownLogger();
      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle async kthxbye method', async () => {
      const mockTransport = {
        kthxbye: jest.fn((callback) => setTimeout(callback, 1))
      };
      
      gracefulShutdown.setCloudWatchTransport(mockTransport);
      await gracefulShutdown.shutdownLogger();
      
      expect(mockTransport.kthxbye).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });
  });

  describe('Process Signal Handlers', () => {
    it('should register SIGTERM handler on module load', () => {
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler on module load', () => {
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should handle SIGTERM signal', async () => {
      const sigtermCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM');
      expect(sigtermCall).toBeDefined();
      
      const sigtermHandler = sigtermCall[1];
      expect(typeof sigtermHandler).toBe('function');
      
      await sigtermHandler('SIGTERM');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal', async () => {
      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();
      
      const sigintHandler = sigintCall[1];
      expect(typeof sigintHandler).toBe('function');
      
      await sigintHandler('SIGINT');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('SIGINT received, shutting down gracefully');
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle signal handler errors synchronously', async () => {
      // Create a transport that will throw an error synchronously
      const mockTransport = {
        kthxbye: jest.fn(() => {
          throw new Error('Sync flush error');
        })
      };
      
      gracefulShutdown.setCloudWatchTransport(mockTransport);
      
      const sigtermCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM');
      expect(sigtermCall).toBeDefined();
      
      const sigtermHandler = sigtermCall[1];
      expect(typeof sigtermHandler).toBe('function');
      
      await sigtermHandler('SIGTERM');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error flushing CloudWatch logs:', expect.any(Error));
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null CloudWatch transport gracefully', async () => {
      gracefulShutdown.setCloudWatchTransport(null);
      await gracefulShutdown.shutdownLogger();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });

    it('should handle undefined CloudWatch transport gracefully', async () => {
      gracefulShutdown.setCloudWatchTransport(undefined);
      await gracefulShutdown.shutdownLogger();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Logger shutdown complete');
    });

    it('should handle rapid consecutive shutdown calls', async () => {
      await gracefulShutdown.shutdownLogger();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      consoleLogSpy.mockClear();
      
      await gracefulShutdown.shutdownLogger();
      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    });
  });
});
