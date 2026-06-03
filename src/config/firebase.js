const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

if (!admin.apps.length) {
  // Option A – service account file (local dev)
  const keyPath = path.join(__dirname, '../../serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(require(keyPath)),
    });
  }
  // Option B – GOOGLE_APPLICATION_CREDENTIALS env var (Cloud Run / etc.)
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  else {
    throw new Error(
      'Firebase credentials not found.\n' +
      'Either place serviceAccountKey.json in the project root, or set GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }
}

const db = admin.firestore();

module.exports = { admin, db };
