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

async function sendWarningEmail(email, userName, warningMessage) {
  await transporter.sendMail({
    from: `"Campus Connect" <${EMAIL_USER}>`,
    to: email,
    subject: `⚠️ Account Warning — Campus Connect`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f5ef;border-radius:16px;">
        <h2 style="color:#3e2c0f;margin-bottom:8px;">🎓 Campus Connect</h2>
        <div style="background:#fff3e0;border:2px solid #e65100;border-radius:12px;padding:20px;margin:20px 0;">
          <h3 style="color:#e65100;margin-bottom:8px;">⚠️ Account Warning</h3>
          <p style="color:#4a3f35;margin-bottom:12px;">Dear <strong>${userName}</strong>,</p>
          <p style="color:#4a3f35;margin-bottom:12px;">Your account has been flagged for violating Campus Connect's community guidelines.</p>
          <div style="background:#fff8e1;border-radius:8px;padding:12px;margin:12px 0;">
            <strong style="color:#e65100;">Reason:</strong>
            <p style="color:#4a3f35;margin-top:6px;">${warningMessage}</p>
          </div>
          <p style="color:#4a3f35;margin-bottom:0;">Please ensure respectful communication with other users. <strong>Further violations may result in permanent suspension of your account.</strong></p>
        </div>
        <p style="color:#8b7d6b;font-size:12px;">If you believe this is a mistake, contact support@campusconnect.in</p>
      </div>
    `,
  });
}

async function sendSuspensionEmail(email, userName, reason) {
  await transporter.sendMail({
    from: `"Campus Connect" <${EMAIL_USER}>`,
    to: email,
    subject: `🔴 Account Suspended — Campus Connect`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f5ef;border-radius:16px;">
        <h2 style="color:#3e2c0f;margin-bottom:8px;">🎓 Campus Connect</h2>
        <div style="background:#ffebee;border:2px solid #c62828;border-radius:12px;padding:20px;margin:20px 0;">
          <h3 style="color:#c62828;margin-bottom:8px;">🔴 Account Suspended</h3>
          <p style="color:#4a3f35;margin-bottom:12px;">Dear <strong>${userName}</strong>,</p>
          <p style="color:#4a3f35;margin-bottom:12px;">Your account has been suspended due to repeated violations of Campus Connect's community guidelines.</p>
          <div style="background:#fff8e1;border-radius:8px;padding:12px;margin:12px 0;">
            <strong style="color:#c62828;">Reason:</strong>
            <p style="color:#4a3f35;margin-top:6px;">${reason}</p>
          </div>
          <p style="color:#4a3f35;">To appeal this decision, contact <strong>support@campusconnect.in</strong></p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendEmailOTP, sendPasswordResetOTP, sendWarningEmail, sendSuspensionEmail };