const nodemailer = require("nodemailer");
const { EMAIL_USER, EMAIL_PASS } = require("../config/env");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

async function sendEmailOTP(email, otp) {
  await transporter.sendMail({
    from: `"Campus Connect" <${EMAIL_USER}>`,
    to: email,
    subject: `Your Campus Connect OTP: ${otp}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f5ef;border-radius:16px;">
        <h2 style="color:#3e2c0f;margin-bottom:8px;">🎓 Campus Connect</h2>
        <p style="color:#8b7d6b;margin-bottom:24px;">Your One-Time Password for signup verification:</p>
        <div style="background:#3e2c0f;color:#f0c060;font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:20px;border-radius:12px;">${otp}</div>
        <p style="color:#8b7d6b;margin-top:24px;font-size:13px;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>
    `,
  });
}

async function sendPasswordResetOTP(email, otp) {
  await transporter.sendMail({
    from: `"Campus Connect" <${EMAIL_USER}>`,
    to: email,
    subject: `Campus Connect — Password Reset OTP: ${otp}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f5ef;border-radius:16px;">
        <h2 style="color:#3e2c0f;">🎓 Campus Connect</h2>
        <p style="color:#8b7d6b;margin-bottom:20px;">Password reset OTP:</p>
        <div style="background:#3e2c0f;color:#f0c060;font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:20px;border-radius:12px;">${otp}</div>
        <p style="color:#8b7d6b;margin-top:20px;font-size:13px;">Expires in <strong>10 minutes</strong>.</p>
      </div>
    `,
  });
}

module.exports = { sendEmailOTP, sendPasswordResetOTP };
