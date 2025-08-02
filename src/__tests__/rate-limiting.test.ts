import { checkRateLimit, resetRateLimit } from '../rate-limiting';

describe('Rate Limiting', () => {
  let originalNow: () => number;
  let currentTime = 1000000;

  beforeEach(() => {
    originalNow = Date.now;
    Date.now = jest.fn(() => currentTime);
    resetRateLimit(currentTime);
  });

  afterEach(() => {
    Date.now = originalNow;
    resetRateLimit(currentTime);
  });

  describe('checkRateLimit', () => {
    it('should allow first log within rate limit', () => {
      expect(checkRateLimit()).toBe(true);
    });

    it('should allow logs up to rate limit', () => {
      for (let i = 0; i < 1000; i++) {
        expect(checkRateLimit()).toBe(true);
      }
    });

    it('should reject log when rate limit exceeded', () => {
      for (let i = 0; i < 1000; i++) {
        checkRateLimit();
      }
      expect(checkRateLimit()).toBe(false);
    });

    it('should reset counter after time window', () => {
      for (let i = 0; i < 1000; i++) {
        checkRateLimit();
      }
      
      expect(checkRateLimit()).toBe(false);
      
      currentTime += 1001;
      
      expect(checkRateLimit()).toBe(true);
    });

    it('should handle time window boundaries correctly', () => {
      for (let i = 0; i < 1000; i++) {
        checkRateLimit();
      }
      
      expect(checkRateLimit()).toBe(false);
      
      currentTime += 1001;
      
      expect(checkRateLimit()).toBe(true);
    });

    it('should handle reset Limits correctly', () => {
      for (let i = 0; i < 600; i++) {
        checkRateLimit();
      }

      resetRateLimit();

      for (let i = 0; i < 402; i++) {
        checkRateLimit();
      }

      expect(checkRateLimit()).toBe(true);

    });

    it('should handle rapid time changes', () => {
      for (let i = 0; i < 500; i++) {
        checkRateLimit();
      }
      
      currentTime += 2000;
      
      for (let i = 0; i < 1000; i++) {
        expect(checkRateLimit()).toBe(true);
      }
      
      expect(checkRateLimit()).toBe(false);
    });

    it('should maintain correct state across multiple time windows', () => {
      for (let i = 0; i < 1000; i++) {
        checkRateLimit();
      }
      
      currentTime += 1001;
      
      for (let i = 0; i < 1000; i++) {
        expect(checkRateLimit()).toBe(true);
      }
      
      expect(checkRateLimit()).toBe(false);
      
      currentTime += 1001;
      
      expect(checkRateLimit()).toBe(true);
    });

    it('should handle time window reset correctly', () => {
      resetRateLimit(1000);
      currentTime = 1000;
      
      // First log should work
      expect(checkRateLimit()).toBe(true);
      
      // Fill up to limit
      for (let i = 1; i < 1000; i++) {
        expect(checkRateLimit()).toBe(true);
      }
      
      // Should be blocked now
      expect(checkRateLimit()).toBe(false);
      
      // Reset time window
      currentTime = 2001; // 1001ms after initial time
      
      // Should allow again
      expect(checkRateLimit()).toBe(true);
    });

    it('should handle multiple rapid resets', () => {
      checkRateLimit();
      
      for (let i = 0; i < 5; i++) {
        currentTime += 1001;
        expect(checkRateLimit()).toBe(true);
      }
    });

    it('should handle concurrent access simulation', () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(checkRateLimit());
      }
      
      expect(results.every(r => r === true)).toBe(true);
      
      for (let i = 0; i < 990; i++) {
        checkRateLimit();
      }
      
      expect(checkRateLimit()).toBe(false);
    });

    it('should handle exact boundary conditions', () => {
      for (let i = 0; i < 1000; i++) {
        expect(checkRateLimit()).toBe(true);
      }
      
      expect(checkRateLimit()).toBe(false);
      
      currentTime += 1001;
      
      expect(checkRateLimit()).toBe(true);
    });

    it('should maintain correct state isolation', () => {
      expect(checkRateLimit()).toBe(true);
      
      currentTime += 2000;
      
      expect(checkRateLimit()).toBe(true);
    });

    it('should handle large time jumps', () => {
      for (let i = 0; i < 1000; i++) {
        checkRateLimit();
      }
      
      currentTime += 1000000;
      
      for (let i = 0; i < 1000; i++) {
        expect(checkRateLimit()).toBe(true);
      }
    });
  });
});
