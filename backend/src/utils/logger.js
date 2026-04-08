const winston = require('winston');
const fs = require('fs');

const transports = [new winston.transports.Console()];

if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync('logs')) fs.mkdirSync('logs');
  transports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  transports.push(new winston.transports.File({ filename: 'logs/combined.log' }));
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports,
});

module.exports = logger;
