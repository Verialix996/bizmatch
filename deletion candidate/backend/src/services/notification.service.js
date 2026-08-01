const { query } = require('../config/db');

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const rows = await query('SELECT push_token FROM user_activity WHERE user_id = $1', [userId]);
    const token = rows[0]?.push_token;
    if (!token || !token.startsWith('ExponentPushToken')) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch { /* non-critical — never let push failure affect the main request */ }
}

module.exports = { sendPushNotification };
