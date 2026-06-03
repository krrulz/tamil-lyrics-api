# Tamil Lyrics API — Claude Code Instructions

## Project Overview
Express.js REST API for a Tamil lyrics app backed by Firebase Firestore.
Node.js 18+, Express 4, Firebase Admin SDK.

## First-time setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add Firebase credentials
Place `serviceAccountKey.json` in this project root (never commit this file).
Get it from: Firebase Console → tamil-lyrics-app → Project Settings → Service Accounts → Generate new private key.

### 3. Copy env file
```bash
cp .env.example .env
```

### 4. Start dev server
```bash
npm run dev
```
API runs on http://localhost:4000

## Project structure
```
src/
├── index.js              ← server entry (port from .env)
├── app.js                ← Express app, middleware, route mounting
├── config/
│   └── firebase.js       ← Firebase Admin singleton (auto-detects credentials)
├── middleware/
│   ├── auth.js           ← verifyIdToken → attaches req.user
│   └── errors.js         ← 404 handler + global error handler
├── routes/
│   ├── songs.js          ← GET /api/songs, /api/songs/search, /api/songs/:id
│   └── playlists.js      ← full CRUD + reorder (all auth-protected)
└── services/
    ├── songs.js          ← Firestore queries for songs collection
    └── playlists.js      ← Firestore operations for playlists collection
```

## API endpoints

### Songs (public — no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Server health check |
| GET | /api/songs | List songs — `?movie=&limit=50&startAfterId=` |
| GET | /api/songs/search | Search — `?q=munbe&type=song\|movie\|all&limit=20` |
| GET | /api/songs/:id | Single song with full lyrics |

### Playlists (require `Authorization: Bearer <firebase-id-token>`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/playlists | List user's playlists |
| POST | /api/playlists | Create — body: `{ name }` |
| GET | /api/playlists/:id | Get one playlist |
| PATCH | /api/playlists/:id | Rename — body: `{ name }` |
| DELETE | /api/playlists/:id | Delete playlist |
| PUT | /api/playlists/:id/songs | Add song — body: `{ songId }` |
| DELETE | /api/playlists/:id/songs/:songId | Remove song |
| PATCH | /api/playlists/:id/reorder | Reorder — body: `{ songs: ["id1","id2"] }` |

## Common tasks for Claude Code

### Add a new field to song responses
Edit `src/services/songs.js` → `docToSong()` function.

### Add a new endpoint
1. Add the handler in the relevant `src/routes/*.js` file
2. Add the Firestore logic in the matching `src/services/*.js` file
3. If auth is needed on a songs route, import and apply `authenticate` middleware

### Change CORS origin
Edit `.env` → set `CORS_ORIGIN=https://your-frontend.com`

### Deploy to Cloud Run
```bash
gcloud run deploy tamil-lyrics-api \
  --source . \
  --region us-central1 \
  --set-env-vars NODE_ENV=production \
  --set-secrets GOOGLE_APPLICATION_CREDENTIALS=firebase-key:latest
```

### Run tests
```bash
# No test framework added yet — ask Claude Code to scaffold Jest tests
```

## Firestore collections
- `songs` — one doc per song, doc ID = slug (e.g. `munbe-vaa`)
- `playlists` — one doc per playlist, contains `userId`, `name`, `songs[]`

## Known limitations / future work
- Search uses `array-contains` on `searchTokens[]` — requires migration script to populate tokens
- No pagination cursor returned yet in search results — can be added when needed
- Rate limiting not yet configured — add `express-rate-limit` before going to production
