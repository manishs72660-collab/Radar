const service = require('./auth.service');

const COOKIE_NAME = 'accessToken';

const cookieOptions = {
  httpOnly: true, // JS se cookie padhi nahi ja sakti
  secure: process.env.NODE_ENV === 'production', // production mein sirf HTTPS
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 60 * 60 * 1000, // 1 ghanta
};

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const { token, user } = await service.register({ name, email, password });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.status(201).json({ user });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const { token, user } = await service.login({ email, password });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ user });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ message: 'Logged out' });
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, logout, me };