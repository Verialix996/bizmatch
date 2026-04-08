require('dotenv').config();
require('./migrations/run');
const app = require('./src/app');
const { testConnection } = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    logger.info(`BizMatch server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

start();
