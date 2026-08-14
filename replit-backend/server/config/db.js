const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error: %s', err.message);
  });
  return mongoose.connection;
}

module.exports = connectDB;
