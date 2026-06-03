const { db, admin } = require('../config/firebase');

const COL = 'playlists';

/**
 * List all playlists for a user, newest first.
 */
async function listPlaylists(userId) {
  const snap = await db.collection(COL)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(docToPlaylist);
}

/**
 * Get a single playlist by ID — verifies ownership.
 */
async function getPlaylist(playlistId, userId) {
  const doc = await db.collection(COL).doc(playlistId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.userId !== userId) return null; // treat as not found
  return docToPlaylist(doc);
}

/**
 * Create a new empty playlist.
 */
async function createPlaylist(userId, name) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await db.collection(COL).add({
    userId,
    name    : name.trim(),
    songs   : [],
    createdAt: now,
    updatedAt: now,
  });
  const created = await ref.get();
  return docToPlaylist(created);
}

/**
 * Rename a playlist.
 */
async function renamePlaylist(playlistId, userId, name) {
  const doc = await db.collection(COL).doc(playlistId).get();
  if (!doc.exists || doc.data().userId !== userId) return null;
  await doc.ref.update({
    name     : name.trim(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return getPlaylist(playlistId, userId);
}

/**
 * Delete a playlist.
 */
async function deletePlaylist(playlistId, userId) {
  const doc = await db.collection(COL).doc(playlistId).get();
  if (!doc.exists || doc.data().userId !== userId) return false;
  await doc.ref.delete();
  return true;
}

/**
 * Add a song to a playlist (appends to end, ignores duplicates).
 */
async function addSongToPlaylist(playlistId, userId, songId) {
  const doc = await db.collection(COL).doc(playlistId).get();
  if (!doc.exists || doc.data().userId !== userId) return null;

  const songs = doc.data().songs || [];

  // Prevent duplicates
  if (songs.some(s => s.songId === songId)) {
    return docToPlaylist(doc); // already in playlist, return as-is
  }

  const newEntry = { songId, order: songs.length };
  await doc.ref.update({
    songs    : [...songs, newEntry],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return getPlaylist(playlistId, userId);
}

/**
 * Remove a song from a playlist and re-index order.
 */
async function removeSongFromPlaylist(playlistId, userId, songId) {
  const doc = await db.collection(COL).doc(playlistId).get();
  if (!doc.exists || doc.data().userId !== userId) return null;

  const songs = (doc.data().songs || [])
    .filter(s => s.songId !== songId)
    .map((s, idx) => ({ ...s, order: idx }));   // re-index

  await doc.ref.update({
    songs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return getPlaylist(playlistId, userId);
}

/**
 * Reorder songs in a playlist.
 * Body: { songs: ['id3', 'id1', 'id2'] }  — ordered array of songIds
 */
async function reorderPlaylist(playlistId, userId, orderedSongIds) {
  const doc = await db.collection(COL).doc(playlistId).get();
  if (!doc.exists || doc.data().userId !== userId) return null;

  // Build new songs array preserving only IDs that already exist
  const existing = new Set((doc.data().songs || []).map(s => s.songId));
  const reordered = orderedSongIds
    .filter(id => existing.has(id))
    .map((songId, order) => ({ songId, order }));

  await doc.ref.update({
    songs    : reordered,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return getPlaylist(playlistId, userId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function docToPlaylist(doc) {
  const d = doc.data();
  return {
    id       : doc.id,
    userId   : d.userId,
    name     : d.name || '',
    songs    : (d.songs || []).sort((a, b) => a.order - b.order),
    createdAt: d.createdAt?.toDate?.() ?? d.createdAt ?? null,
    updatedAt: d.updatedAt?.toDate?.() ?? d.updatedAt ?? null,
  };
}

module.exports = {
  listPlaylists,
  getPlaylist,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylist,
};
