const path = require('path');
const winston = require('winston');

const logDir = path.join(__dirname, '..', '..', 'logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.splat(),
        winston.format.printf(
          ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`
        )
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
  ],
});

// Separate append-only audit trail for payment and auth events.
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
    }),
  ],
});

function audit(action, details = {}) {
  auditLogger.info({ action, ...details });
  logger.info('AUDIT %s %s', action, JSON.stringify(details));
}

module.exports = logger;
module.exports.audit = audit;
