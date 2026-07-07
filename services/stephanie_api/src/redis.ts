import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/0', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 200, 5_000);
  },
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

export default redis;
