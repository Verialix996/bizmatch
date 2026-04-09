const { google } = require('googleapis');

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function buildRawEmail(to, subject, html) {
  const message = [
    `From: "BizMatch" <${process.env.GMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\n');
  return Buffer.from(message).toString('base64url');
}

async function sendOtp(toEmail, code) {
  const gmail = getGmailClient();
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: buildRawEmail(
        toEmail,
        'BizMatch — Your verification code',
        `<p>Your BizMatch verification code is:</p><h2>${code}</h2><p>Expires in 10 minutes.</p>`
      ),
    },
  });
}

async function sendPasswordReset(toEmail, resetUrl) {
  const gmail = getGmailClient();
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: buildRawEmail(
        toEmail,
        'BizMatch — Reset your password',
        `<p>Click the link below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a><p>This link expires in 1 hour.</p>`
      ),
    },
  });
}

module.exports = { sendOtp, sendPasswordReset };
