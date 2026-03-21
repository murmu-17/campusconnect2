// In-memory OTP store
const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function setOTP(key, otp, ttlMs = 10 * 60 * 1000) {
  otpStore.set(key, { otp, expires: Date.now() + ttlMs, verified: false });
}

function getOTP(key) {
  return otpStore.get(key) || null;
}

function markVerified(key) {
  const record = otpStore.get(key);
  if (record) {
    record.verified = true;
    otpStore.set(key, record);
  }
}

function deleteOTP(key) {
  otpStore.delete(key);
}

function isExpired(record) {
  return Date.now() > record.expires;
}

module.exports = { generateOTP, setOTP, getOTP, markVerified, deleteOTP, isExpired };
