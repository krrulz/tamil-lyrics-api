# Tamil Lyrics App — Admin Migration Script

## What it does

Reads every document in the `songs` collection and:

| Field | Action |
|---|---|
| `searchTokens` | Builds from `name` + `movie` (lowercase, deduped tokens) |
| `year` | Adds as `null` placeholder if missing |
| `singer` | Adds as `[]` if missing |
| `composer` | Adds as `""` if missing |
| `lyricist` | Adds as `""` if missing |
| `language` | Sets to `"ta"` if missing |
| `createdAt` | Converts ISO string → Firestore Timestamp |
| `updatedAt` | Converts ISO string → Firestore Timestamp |

---

## Setup

### 1. Get your Service Account Key

1. Go to **Firebase Console** → `tamil-lyrics-app`
2. Click the **gear icon** → **Project settings**
3. Click the **Service accounts** tab
4. Click **Generate new private key** → **Generate key**
5. Save the downloaded file as **`serviceAccountKey.json`** in this folder

### 2. Install dependencies

```bash
npm install
```

---

## Usage

### Dry run first (no writes — always do this first!)
```bash
node migrate.js
```

### Test on a single document
```bash
node migrate.js --commit --id aadhi-sakthi-vel-kondu
```

### Commit all documents
```bash
node migrate.js --commit
```

---

## After migration — fill in metadata

The script sets `year`, `singer`, `composer`, `lyricist` to empty placeholders.
To fill them in properly, you can either:

**Option A — Manual per document** in Firebase console (for a small number of songs)

**Option B — Bulk CSV update** using the companion `update-metadata.js` script:
1. Export the songs list: `node migrate.js` prints all doc IDs
2. Fill in a CSV with columns: `id, year, singer, composer, lyricist`
3. Run: `node update-metadata.js metadata.csv --commit`

---

## searchTokens explained

Given a song with:
- `name`: `"Munbe Vaa"`
- `movie`: `"Sillunu Oru Kaadhal"`

The generated tokens will be:
```
["munbe", "vaa", "sillunu", "oru", "kaadhal", "munbe vaa", "sillunu oru kaadhal"]
```

Your API then queries:
```js
db.collection('songs')
  .where('searchTokens', 'array-contains', 'munbe')
```
