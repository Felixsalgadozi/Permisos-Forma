// api/account-users.js — Lista empleados activos de la cuenta (para validar y seleccionar)
const { getToken, BASE, ACCOUNT_ID, REGION, ADMIN_USER_ID } = require('../lib/aps');

module.exports = async (req, res) => {
  try {
    const token = await getToken();
    let all = [], offset = 0;
    for (;;) {
      const url = BASE + '/hq/v1/accounts/' + ACCOUNT_ID + '/users?limit=100&offset=' + offset + '&status=active';
      const r = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token, Region: REGION, 'x-user-id': ADMIN_USER_ID }
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: 'list_users', detail: d });
      const results = Array.isArray(d) ? d : (d.results || d.data || []);
      all = all.concat(results);
      if (results.length < 100) break;
      offset += 100;
    }
    res.json({
      users: all.map(u => ({ email: (u.email || '').toLowerCase(), name: u.name || u.email || '' })).filter(u => u.email),
      total: all.length
    });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};
