const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./user.model');

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });

  return {
    token: signToken(user._id),
    user: { id: user._id, name: user.name, email: user.email },
  };
}

async function login({ email, password }) {
  // password by default select nahi hota, isliye explicitly mangna padega
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Same message dono cases mein, taaki hacker ko pata na chale ki email exist karta hai ya nahi
  const invalid = () => {
    const err = new Error('Invalid email or password');
    err.status = 401;
    return err;
  };

  if (!user) throw invalid();

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw invalid();

  return {
    token: signToken(user._id),
    user: { id: user._id, name: user.name, email: user.email },
  };
}

async function getUserById(id) {
  return User.findById(id);
}

module.exports = { register, login, signToken, getUserById };