const User = require('../auth/user.model');
const { sendTelegram } = require('./telegram.service');

// User ke saare connected channels pe message bhejo.
// Alert fail ho jaye to bhi app nahi rukna chahiye, isliye error pakad ke log karte hain.
async function notifyUser(userId, text) {
  const user = await User.findById(userId);
  if (!user) return { sent: false, reason: 'User not found' };

  const results = [];

  if (user.telegramChatId) {
    try {
      await sendTelegram(user.telegramChatId, text);
      results.push('telegram');
    } catch (err) {
      console.error('Telegram alert failed:', err.response?.data?.description || err.message);
    }
  }

  return { sent: results.length > 0, channels: results };
}

module.exports = { notifyUser };