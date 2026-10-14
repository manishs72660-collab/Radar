const express = require('express');
const controller = require('./statuspage.controller');

const router = express.Router();

// Koi login nahi chahiye
router.get('/status/:slug', controller.getPublic);

module.exports = router;