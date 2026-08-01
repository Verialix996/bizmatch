require('dotenv').config();
const app = require('./src/app');
const { testConnection } = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

// Schema is managed via Supabase CLI migrations (supabase/migrations/, applied
// with `npm run migrate` -> `supabase db push`), not run in-process at boot.
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    logger.info(`BizMatch server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

start();
