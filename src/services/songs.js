const { db } = require('../config/firebase');

const COL = 'songs';

/**
 * Search songs by token (array-contains on searchTokens).
 * Falls back to a simple name prefix scan when searchTokens is missing.
 */
async function searchSongs({ q = '', type = 'all', limit = 20, startAfterDoc = null }) {
  const token = q.toLowerCase().trim();
  if (!token) return [];

  let query;

  if (type === 'movie') {
    // Exact movie field match (case-insensitive via lowercase stored value)
    query = db.collection(COL)
      .where('movie', '>=', q)
      .where('movie', '<=', q + '\uf8ff')
      .orderBy('movie')
      .orderBy('name')
      .limit(limit);
  } else {
    // Token search works for both song name and movie name
    query = db.collection(COL)
      .where('searchTokens', 'array-contains', token)
      .orderBy('name')
      .limit(limit);
  }

  if (startAfterDoc) query = query.startAfter(startAfterDoc);

  const snap = await query.get();
  return snap.docs.map(docToSong);
}

/**
 * Get a single song by Firestore document ID (the slug).
 */
async function getSongById(songId) {
  const doc = await db.collection(COL).doc(songId).get();
  if (!doc.exists) return null;
  return docToSong(doc);
}

/**
 * List all songs, optionally filtered by movie.
 */
async function listSongs({ movie = null, limit = 50, startAfterId = null } = {}) {
  let query = db.collection(COL).orderBy('name').limit(limit);
  if (movie) query = query.where('movie', '==', movie);
  if (startAfterId) {
    const cursor = await db.collection(COL).doc(startAfterId).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snap = await query.get();
  return snap.docs.map(docToSong);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function docToSong(doc) {
  const d = doc.data();
  return {
    id          : doc.id,
    name        : d.name        || '',
    movie       : d.movie       || '',
    year        : d.year        ?? null,
    singer      : d.singer      || [],
    composer    : d.composer    || '',
    lyricist    : d.lyricist    || '',
    language    : d.language    || 'ta',
    tamilLyrics : d.tamilLyrics || '',
    englishLyrics: d.englishLyrics || '',
    tamilStatus  : d.tamilStatus  || '',
    englishStatus: d.englishStatus || '',
    createdAt   : d.createdAt?.toDate?.() ?? d.createdAt ?? null,
    updatedAt   : d.updatedAt?.toDate?.() ?? d.updatedAt ?? null,
  };
}

module.exports = { searchSongs, getSongById, listSongs };
