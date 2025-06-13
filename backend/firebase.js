// backend/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://futa-marketplace-default-rtdb.firebaseio.com/",
});

module.exports = admin;
