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
  // Option B – JSON string env var (Render / Railway / etc.)
  else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  // Option C – GOOGLE_APPLICATION_CREDENTIALS env var (Cloud Run / etc.)
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  else {
    throw new Error(
      'Firebase credentials not found.\n' +
      'Place serviceAccountKey.json in the project root, set FIREBASE_SERVICE_ACCOUNT, or set GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }
}

const db = admin.firestore();

module.exports = { admin, db };
