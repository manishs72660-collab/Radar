const express = require('express');
const controller = require('./statuspage.controller');
const { publicLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// Koi login nahi chahiye, isliye IP se limit
router.get('/status/:slug', publicLimiter, controller.getPublic);

module.exports = router;