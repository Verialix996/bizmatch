const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendOtp(toEmail, code) {
  await getTransporter().sendMail({
    from: `"BizMatch" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'BizMatch — Your verification code',
    text: `Your verification code is: ${code}\nIt expires in 10 minutes.`,
    html: `<p>Your BizMatch verification code is:</p>
           <h2>${code}</h2>
           <p>Expires in 10 minutes.</p>`,
  });
}

async function sendPasswordReset(toEmail, resetUrl) {
  await getTransporter().sendMail({
    from: `"BizMatch" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'BizMatch — Reset your password',
    text: `Reset your password: ${resetUrl}`,
    html: `<p>Click the link below to reset your password:</p>
           <a href="${resetUrl}">${resetUrl}</a>
           <p>This link expires in 1 hour.</p>`,
  });
}

module.exports = { sendOtp, sendPasswordReset };
