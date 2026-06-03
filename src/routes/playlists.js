const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listPlaylists, getPlaylist, createPlaylist,
  renamePlaylist, deletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist, reorderPlaylist,
} = require('../services/playlists');

// All playlist routes require auth
router.use(authenticate);

/**
 * GET /api/playlists
 * List all playlists for the authenticated user.
 */
router.get('/', async (req, res, next) => {
  try {
    const playlists = await listPlaylists(req.user.uid);
    res.json({ playlists, count: playlists.length });
  } catch (err) { next(err); }
});

/**
 * POST /api/playlists
 * Create a new playlist.
 * Body: { name: "My Favourites" }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const playlist = await createPlaylist(req.user.uid, name);
    res.status(201).json({ playlist });
  } catch (err) { next(err); }
});

/**
 * GET /api/playlists/:id
 * Get a single playlist (with song ID list).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const playlist = await getPlaylist(req.params.id, req.user.uid);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/playlists/:id
 * Rename a playlist.
 * Body: { name: "New Name" }
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const playlist = await renamePlaylist(req.params.id, req.user.uid, name);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/playlists/:id
 * Delete a playlist.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deletePlaylist(req.params.id, req.user.uid);
    if (!ok) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

/**
 * PUT /api/playlists/:id/songs
 * Add a song to the playlist.
 * Body: { songId: "munbe-vaa" }
 */
router.put('/:id/songs', async (req, res, next) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId is required' });
    const playlist = await addSongToPlaylist(req.params.id, req.user.uid, songId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/playlists/:id/songs/:songId
 * Remove a song from the playlist.
 */
router.delete('/:id/songs/:songId', async (req, res, next) => {
  try {
    const playlist = await removeSongFromPlaylist(req.params.id, req.user.uid, req.params.songId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/playlists/:id/reorder
 * Reorder songs in the playlist.
 * Body: { songs: ["id3", "id1", "id2"] }
 */
router.patch('/:id/reorder', async (req, res, next) => {
  try {
    const { songs } = req.body;
    if (!Array.isArray(songs)) return res.status(400).json({ error: 'songs array is required' });
    const playlist = await reorderPlaylist(req.params.id, req.user.uid, songs);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) { next(err); }
});

module.exports = router;
