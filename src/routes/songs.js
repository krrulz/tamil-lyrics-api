const express = require('express');
const router  = express.Router();
const { searchSongs, getSongById, listSongs } = require('../services/songs');

/**
 * GET /api/songs
 * List songs, optionally filter by movie.
 * ?movie=Bombay  &limit=50  &startAfterId=some-doc-id
 */
router.get('/', async (req, res, next) => {
  try {
    const { movie, limit = 50, startAfterId } = req.query;
    const songs = await listSongs({
      movie        : movie || null,
      limit        : Math.min(parseInt(limit) || 50, 100),
      startAfterId : startAfterId || null,
    });
    res.json({ songs, count: songs.length });
  } catch (err) { next(err); }
});

/**
 * GET /api/songs/search
 * Search by song name or movie name.
 * ?q=munbe&type=song|movie|all  &limit=20
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q = '', type = 'all', limit = 20 } = req.query;
    if (!q.trim()) return res.json({ songs: [], count: 0 });
    const songs = await searchSongs({ q, type, limit: Math.min(parseInt(limit) || 20, 50) });
    res.json({ songs, count: songs.length });
  } catch (err) { next(err); }
});

/**
 * GET /api/songs/:id
 * Get a single song with full lyrics.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const song = await getSongById(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json({ song });
  } catch (err) { next(err); }
});

module.exports = router;
