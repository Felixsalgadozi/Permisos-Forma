// api/roles.js — Lista funciones de un proyecto (filtradas: JMC/EXT sin BIM)
// Uso: /api/roles?projectId=XXXX
const { getToken, getProjectPlatform, getProjectRolesMap, roleAllowed } = require('../lib/aps');

module.exports = async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return res.status(400).json({ error: 'bad_request', detail: 'Falta projectId' });
  try {
    const token = await getToken();
    const platform = await getProjectPlatform(projectId, token);

    const rolesMap = new Map(); // name -> id
    const realMap = await getProjectRolesMap(projectId);
    for (const [name, info] of realMap.entries()) if (roleAllowed(name)) rolesMap.set(name, info.id);

    const roles = [...rolesMap.entries()]
      .map(([name, id]) => ({ id: id || name, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    res.json({ roles, platform });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};
