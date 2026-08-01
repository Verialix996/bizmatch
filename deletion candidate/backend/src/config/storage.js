const supabase = require('./supabase');

// Public buckets: matches the exposure level of the old Cloudinary URLs
// (never truly access-controlled — the download endpoints below add a JWT
// check on top, same as before, but the object itself is fetchable by URL).
const BUCKETS = {
  photo: 'photos',
  cv: 'cvs',
  deck: 'decks',
  video: 'videos',
};

async function uploadBuffer(bucket, path, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { BUCKETS, uploadBuffer };
