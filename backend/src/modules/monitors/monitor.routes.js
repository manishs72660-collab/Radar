const express = require('express');
const controller = require('./monitor.controller');
const { protect } = require('../auth/auth.middleware');
const { checkNowLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.use(protect);

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.get('/:id/checks', controller.checks);
router.get('/:id/stats', controller.stats);
router.post('/:id/check', checkNowLimiter, controller.checkNow);
router.delete('/:id', controller.remove);

module.exports = router;