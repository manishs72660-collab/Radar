const service = require('./statuspage.service');

async function getMine(req, res) {
  try {
    const page = await service.getPageForUser(req.user.id);
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function saveMine(req, res) {
  try {
    const page = await service.savePage(req.user.id, req.body);
    res.json(page);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getPublic(req, res) {
  try {
    const data = await service.getPublicPage(req.params.slug);
    if (!data) return res.status(404).json({ message: 'Status page not found' });
    res.set('Cache-Control', 'public, max-age=30');
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getMine, saveMine, getPublic };