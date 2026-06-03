/**
 * Tamil Lyrics App — Bulk Metadata Updater
 * =========================================
 * Updates year / singer / composer / lyricist from a CSV file.
 *
 * CSV format (first row = header):
 *   id,year,singer,composer,lyricist
 *   munbe-vaa,2006,"Shreya Ghoshal,Benny Dayal",A.R. Rahman,Yugabharathi
 *   kandha-sashti-kavasam,1952,Sirkazhi Govindarajan,,Subramania Bharati
 *
 * Run:
 *   node update-metadata.js metadata.csv            — dry-run
 *   node update-metadata.js metadata.csv --commit   — write to Firestore
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const PROJECT_ID           = 'tamil-lyrics-app';
const BATCH_SIZE           = 500;

// ─── ARGS ────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const CSV_FILE = args.find(a => a.endsWith('.csv'));
const DRY_RUN  = !args.includes('--commit');

if (!CSV_FILE) {
  console.error('Usage: node update-metadata.js <file.csv> [--commit]');
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`❌  serviceAccountKey.json not found at: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  projectId: PROJECT_ID,
});
const db = admin.firestore();

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const lines  = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows   = [];

  for (let i = 1; i < lines.length; i++) {
    // Handles quoted fields with commas inside
    const cols = [];
    let cur = '', inQuote = false;
    for (const ch of lines[i] + ',') {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cols.length < 2) continue;
    const row = {};
    header.forEach((h, idx) => row[h] = cols[idx] ?? '');
    if (row.id) rows.push(row);
  }
  return rows;
}

// ─── BUILD SEARCH TOKENS ─────────────────────────────────────────────────────
function buildSearchTokens(name = '', movie = '', singerArr = [], composer = '', lyricist = '') {
  const singerStr = singerArr.join(' ');
  const text = `${name} ${movie} ${singerStr} ${composer} ${lyricist}`.toLowerCase();
  const words = text
    .split(/[\s\-_,.()/\\]+/)
    .map(w => w.replace(/[^a-z0-9\u0B80-\u0BFF]/g, ''))
    .filter(w => w.length > 1);
  const extras = [name, movie].map(s => s.toLowerCase().trim()).filter(Boolean);
  return [...new Set([...words, ...extras])];
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🎵  Tamil Lyrics — Metadata Updater`);
  console.log(`   CSV     : ${CSV_FILE}`);
  console.log(`   Mode    : ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  COMMIT'}\n`);

  const rows = parseCSV(CSV_FILE);
  console.log(`📋  Parsed ${rows.length} rows from CSV\n`);

  // Fetch all referenced docs in one go
  const ids    = rows.map(r => r.id);
  const refs   = ids.map(id => db.collection('songs').doc(id));
  const snaps  = await db.getAll(...refs);
  const docMap = {};
  snaps.forEach(s => { if (s.exists) docMap[s.id] = s.data(); });

  const updates = [];
  const missing = [];

  for (const row of rows) {
    const existing = docMap[row.id];
    if (!existing) { missing.push(row.id); continue; }

    const singerArr = row.singer
      ? row.singer.split(';').map(s => s.trim()).filter(Boolean)
      : (existing.singer || []);

    const year = row.year ? parseInt(row.year, 10) : (existing.year ?? null);

    const update = {
      year        : isNaN(year) ? null : year,
      singer      : singerArr,
      composer    : row.composer  || existing.composer  || '',
      lyricist    : row.lyricist  || existing.lyricist  || '',
      searchTokens: buildSearchTokens(
        existing.name     || '',
        existing.movie    || '',
        singerArr,
        row.composer  || existing.composer  || '',
        row.lyricist  || existing.lyricist  || ''
      ),
      updatedAt   : admin.firestore.FieldValue.serverTimestamp(),
    };

    updates.push({ ref: refs[ids.indexOf(row.id)], id: row.id, update });
  }

  if (missing.length) {
    console.warn(`⚠️   ${missing.length} doc(s) not found in Firestore:`);
    missing.forEach(id => console.warn(`     - ${id}`));
    console.log('');
  }

  console.log(`📝  ${updates.length} docs to update:\n`);
  for (const { id, update } of updates) {
    console.log(
      `  ${DRY_RUN ? '[DRY]' : '[UPD]'} ${id.padEnd(45)}` +
      `  year=${update.year ?? '—'}` +
      `  singer=[${update.singer.join(', ')}]` +
      `  composer=${update.composer || '—'}` +
      `  lyricist=${update.lyricist || '—'}`
    );
  }

  if (!DRY_RUN && updates.length > 0) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach(({ ref, update }) => batch.update(ref, update));
      await batch.commit();
      console.log(`\n  💾  Committed ${chunk.length} writes`);
    }
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`✅  Done!  ${updates.length} updated, ${missing.length} not found`);
  if (DRY_RUN) console.log(`💡  Run with --commit to apply changes.`);
}

run().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  process.exit(1);
});
