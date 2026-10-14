const express = require('express');
const service = require('./dashboard.service');
const { protect } = require('../auth/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/summary', async (req, res) => {
  try {
    res.json(await service.getSummary(req.user.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/incidents', async (req, res) => {
  try {
    res.json(await service.getIncidents(req.user.id, req.query.monitorId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
