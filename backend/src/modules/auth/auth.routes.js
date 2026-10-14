const express = require('express');
const controller = require('./auth.controller');
const { protect } = require('./auth.middleware');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', protect, controller.me);

module.exports = router;