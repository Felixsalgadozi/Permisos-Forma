// api/projects.js — Lista proyectos activos de la cuenta
const { getToken, BASE, ACCOUNT_ID, REGION } = require('../lib/aps');

module.exports = async (req, res) => {
  try {
    const token = await getToken();
    let all = [], offset = 0;
    for (;;) {
      const r = await fetch(
        BASE + '/construction/admin/v1/accounts/' + ACCOUNT_ID + '/projects?limit=100&offset=' + offset + '&status=active',
        { headers: { Authorization: 'Bearer ' + token, Region: REGION } }
      );
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: 'list_projects', detail: d });
      const results = d.results || d.data || [];
      all = all.concat(results);
      if (results.length < 100) break;
      offset += 100;
    }
    res.json({
      projects: all.map(p => ({
        id: p.id,
        name: p.name,
        city: p.city || '',
        status: p.status,
        platform: (p.platform || 'acc').toLowerCase()
      }))
    });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};
