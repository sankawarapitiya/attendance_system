const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

exports.api = onRequest({ cors: true }, (req, res) => {
  res.json({ success: true, message: 'SpeedFace Cloud API is online' });
});
