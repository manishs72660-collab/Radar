const express = require('express');
const controller = require('./alert.controller');
const { protect } = require('../auth/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);
router.post('/test', controller.sendTest);

module.exports = router;