const service = require('./monitor.service');
const { runCheck } = require('../checks/check.engine');
const Check = require('../checks/check.model');

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function create(req, res) {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ message: 'name and url are required' });
    }
    if (!isValidUrl(url)) {
      return res.status(400).json({ message: 'Enter a valid http/https URL' });
    }
    const monitor = await service.createMonitor(req.user.id, req.body);
    res.status(201).json(monitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function list(req, res) {
  try {
    res.json(await service.getAllMonitors(req.user.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getOne(req, res) {
  try {
    const monitor = await service.getMonitorById(req.user.id, req.params.id);
    if (!monitor) return res.status(404).json({ message: 'Monitor not found' });
    res.json(monitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function update(req, res) {
  try {
    if (req.body.url && !isValidUrl(req.body.url)) {
      return res.status(400).json({ message: 'Enter a valid http/https URL' });
    }
    const monitor = await service.updateMonitor(req.user.id, req.params.id, req.body);
    if (!monitor) return res.status(404).json({ message: 'Monitor not found' });
    res.json(monitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function remove(req, res) {
  try {
    const monitor = await service.deleteMonitor(req.user.id, req.params.id);
    if (!monitor) return res.status(404).json({ message: 'Monitor not found' });
    res.json({ message: 'Monitor deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function checkNow(req, res) {
  try {
    const monitor = await service.getMonitorById(req.user.id, req.params.id);
    if (!monitor) return res.status(404).json({ message: 'Monitor not found' });

    const result = await runCheck(monitor);
    await Check.create({ monitorId: monitor._id, ...result });

    // Manual check sirf history mein jodta hai, incident logic worker sambhalta hai
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function checks(req, res) {
  try {
    const data = await service.getChecks(req.user.id, req.params.id, req.query.range);
    if (!data) return res.status(404).json({ message: 'Monitor not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function stats(req, res) {
  try {
    const data = await service.getStats(req.user.id, req.params.id, req.query.range);
    if (!data) return res.status(404).json({ message: 'Monitor not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { create, list, getOne, update, remove, checkNow, checks, stats };