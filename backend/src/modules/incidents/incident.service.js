const Incident = require('./incident.model');

// created: true tabhi hoga jab incident abhi naya bana (alert sirf tabhi bhejna hai)
async function openIncident(monitorId, cause) {
  const existing = await Incident.findOne({ monitorId, status: 'OPEN' });
  if (existing) return { incident: existing, created: false };

  const incident = await Incident.create({ monitorId, startedAt: new Date(), cause });
  return { incident, created: true };
}

async function resolveIncident(monitorId) {
  const incident = await Incident.findOne({ monitorId, status: 'OPEN' });
  if (!incident) return null;

  incident.resolvedAt = new Date();
  incident.durationSeconds = Math.round((incident.resolvedAt - incident.startedAt) / 1000);
  incident.status = 'RESOLVED';
  await incident.save();
  return incident;
}

module.exports = { openIncident, resolveIncident };