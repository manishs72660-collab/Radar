const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ ke liye zaroori
});

connection.on('connect', () => console.log('Redis connected'));
connection.on('error', (err) => console.error('Redis error:', err.message));

module.exports = connection;