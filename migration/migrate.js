/**
 * Tamil Lyrics App — Admin Migration Script
 * ==========================================
 * What this does:
 *  1. Reads every document in the `songs` collection
 *  2. Adds missing fields: year, singer, composer, lyricist, language
 *  3. Builds searchTokens[] from name + movie (lowercase, deduped tokens)
 *  4. Normalises createdAt / updatedAt to Firestore Timestamps
 *  5. Writes updates in batches of 500 (Firestore limit)
 *
 * Run:
 *   node migrate.js                  — dry-run (prints what would change)
 *   node migrate.js --commit         — writes to Firestore
 *   node migrate.js --commit --id aadhi-sakthi-vel-kondu  — single doc test
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const PROJECT_ID           = 'tamil-lyrics-app';
const COLLECTION           = 'songs';
const BATCH_SIZE           = 500;

// ─── ARGS ────────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const DRY_RUN   = !args.includes('--commit');
const SINGLE_ID = (() => { const i = args.indexOf('--id'); return i >= 0 ? args[i + 1] : null; })();

// ─── INIT ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`
❌  serviceAccountKey.json not found at:
    ${SERVICE_ACCOUNT_PATH}

    To get it:
      Firebase console → Project settings (gear icon)
      → Service accounts → Generate new private key
      → Save as serviceAccountKey.json in this folder
  `);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Build searchTokens from name + movie.
 * Splits on whitespace / punctuation, lowercases, removes empties & dupes.
 * Also adds the full lowercased name and movie as single tokens so
 * "array-contains" matches whole-word searches.
 */
function buildSearchTokens(name = '', movie = '') {
  const text  = `${name} ${movie}`.toLowerCase();
  const words = text
    .split(/[\s\-_,.()/\\]+/)
    .map(w => w.replace(/[^a-z0-9\u0B80-\u0BFF]/g, '')) // keep latin + Tamil Unicode
    .filter(w => w.length > 1);

  // Add full name + movie lowercased (helps "starts with" style prefix matches)
  const extras = [name.toLowerCase().trim(), movie.toLowerCase().trim()].filter(Boolean);

  return [...new Set([...words, ...extras])];
}

/**
 * Convert a string ISO date or Firestore Timestamp to a JS Date.
 * Returns null if unparseable.
 */
function toDate(val) {
  if (!val) return null;
  if (val instanceof admin.firestore.Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Given an existing doc, return only the fields that need updating.
 * Returns null if nothing needs to change.
 */
function buildUpdate(docId, data) {
  const update = {};

  // ── searchTokens ──────────────────────────────────────────────────────────
  const freshTokens = buildSearchTokens(data.name, data.movie);
  const existingTokens = Array.isArray(data.searchTokens) ? [...data.searchTokens].sort().join(',') : '';
  if (existingTokens !== freshTokens.sort().join(',')) {
    update.searchTokens = freshTokens;
  }

  // ── year ──────────────────────────────────────────────────────────────────
  if (data.year === undefined || data.year === null || data.year === '') {
    update.year = null;   // placeholder — can be filled later per-song
  }

  // ── singer ────────────────────────────────────────────────────────────────
  if (!Array.isArray(data.singer)) {
    update.singer = [];
  }

  // ── composer ──────────────────────────────────────────────────────────────
  if (data.composer === undefined || data.composer === null) {
    update.composer = '';
  }

  // ── lyricist ──────────────────────────────────────────────────────────────
  if (data.lyricist === undefined || data.lyricist === null) {
    update.lyricist = '';
  }

  // ── language ──────────────────────────────────────────────────────────────
  if (!data.language) {
    update.language = 'ta';
  }

  // ── normalise createdAt to Timestamp ──────────────────────────────────────
  if (typeof data.createdAt === 'string') {
    const d = toDate(data.createdAt);
    if (d) update.createdAt = admin.firestore.Timestamp.fromDate(d);
  }

  // ── normalise updatedAt to Timestamp ──────────────────────────────────────
  if (typeof data.updatedAt === 'string') {
    const d = toDate(data.updatedAt);
    if (d) update.updatedAt = admin.firestore.Timestamp.fromDate(d);
  }

  return Object.keys(update).length > 0 ? update : null;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🎵  Tamil Lyrics Migration`);
  console.log(`   Mode    : ${DRY_RUN ? '🔍 DRY-RUN (no writes)' : '✍️  COMMIT'}`);
  console.log(`   Target  : ${SINGLE_ID ? `single doc → ${SINGLE_ID}` : 'all songs'}`);
  console.log(`   Project : ${PROJECT_ID}\n`);

  // ── Fetch documents ───────────────────────────────────────────────────────
  let query = db.collection(COLLECTION);
  if (SINGLE_ID) {
    const snap = await db.collection(COLLECTION).doc(SINGLE_ID).get();
    if (!snap.exists) { console.error(`❌  Document not found: ${SINGLE_ID}`); process.exit(1); }
    await processBatch([snap], DRY_RUN);
    return;
  }

  let lastDoc   = null;
  let totalDocs = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let page = 1;

  while (true) {
    let q = query.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snapshot = await q.get();
    if (snapshot.empty) break;

    console.log(`📄  Page ${page} — ${snapshot.size} docs`);

    const { updated, skipped } = await processBatch(snapshot.docs, DRY_RUN);
    totalUpdated += updated;
    totalSkipped += skipped;
    totalDocs    += snapshot.size;

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    page++;

    if (snapshot.size < BATCH_SIZE) break;
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`✅  Done!`);
  console.log(`   Total docs   : ${totalDocs}`);
  console.log(`   Needs update : ${totalUpdated}`);
  console.log(`   Already OK   : ${totalSkipped}`);
  if (DRY_RUN) {
    console.log(`\n💡  Run with --commit to apply changes.`);
  }
}

async function processBatch(docs, dryRun) {
  // Collect all updates first
  const updates = [];
  for (const doc of docs) {
    const update = buildUpdate(doc.id, doc.data());
    if (update) {
      updates.push({ ref: doc.ref, id: doc.id, update });
    } else {
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');

  if (updates.length === 0) return { updated: 0, skipped: docs.length };

  // Show what would change
  for (const { id, update } of updates) {
    const fields = Object.keys(update).join(', ');
    console.log(`  ${dryRun ? '[DRY]' : '[UPD]'} ${id.padEnd(45)} → ${fields}`);
  }

  // Write in Firestore write-batches (max 500 ops each)
  if (!dryRun) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const { ref, update } of chunk) {
        batch.update(ref, update);
      }
      await batch.commit();
      console.log(`  💾  Committed ${chunk.length} writes`);
    }
  }

  return { updated: updates.length, skipped: docs.length - updates.length };
}

run().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  process.exit(1);
});
