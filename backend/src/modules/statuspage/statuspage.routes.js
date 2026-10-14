const express = require('express');
const controller = require('./statuspage.controller');
const { protect } = require('../auth/auth.middleware');

const router = express.Router();

router.get('/', protect, controller.getMine);
router.put('/', protect, controller.saveMine);

module.exports = router;