require('dotenv').config();
const app = require('./src/app');
const { testConnection } = require('./src/config/db');
const { runMigrations } = require('./migrations/run');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  await runMigrations();
  await testConnection();
  app.listen(PORT, () => {
    logger.info(`BizMatch server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

start();
