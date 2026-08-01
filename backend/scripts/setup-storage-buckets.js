// One-time setup: creates the public Supabase Storage buckets this app
// expects (photos/cvs/decks/videos). Safe to re-run — skips buckets that
// already exist.
require('dotenv').config();
const supabase = require('../src/config/supabase');

const BUCKETS = ['photos', 'cvs', 'decks', 'videos'];

async function main() {
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  const existingNames = new Set((existing || []).map(b => b.name));

  for (const name of BUCKETS) {
    if (existingNames.has(name)) {
      console.log(`bucket "${name}" already exists, skipping`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(name, { public: true });
    if (error) throw error;
    console.log(`created bucket "${name}"`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Failed to set up storage buckets:', err.message);
  process.exit(1);
});
