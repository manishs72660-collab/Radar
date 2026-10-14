const User = require('../auth/user.model');
const { notifyUser } = require('./alert.service');

async function getSettings(req, res) {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      telegramConnected: !!user.telegramChatId,
      telegramChatId: user.telegramChatId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateSettings(req, res) {
  try {
    const { telegramChatId } = req.body;

    if (telegramChatId !== null && telegramChatId !== undefined && !/^-?\d+$/.test(String(telegramChatId))) {
      return res.status(400).json({ message: 'Chat id should be a number' });
    }

    const user = await User.findById(req.user.id);
    user.telegramChatId = telegramChatId ? String(telegramChatId) : null;
    await user.save();

    res.json({ telegramConnected: !!user.telegramChatId, telegramChatId: user.telegramChatId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function sendTest(req, res) {
  try {
    const result = await notifyUser(
      req.user.id,
      '✅ Radar test alert. Telegram is connected, you will get downtime alerts here.'
    );
    if (!result.sent) {
      return res.status(400).json({
        message: 'Could not send. Check your chat id, bot token, and that you pressed Start on the bot.',
      });
    }
    res.json({ message: 'Test alert sent', channels: result.channels });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getSettings, updateSettings, sendTest };