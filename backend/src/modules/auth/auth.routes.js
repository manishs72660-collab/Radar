const express = require('express');
const controller = require('./auth.controller');
const { protect } = require('./auth.middleware');
const { loginLimiter, registerLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.post('/register', registerLimiter, controller.register);
router.post('/login', loginLimiter, controller.login);
router.post('/logout', controller.logout);
router.get('/me', protect, controller.me);

module.exports = router;