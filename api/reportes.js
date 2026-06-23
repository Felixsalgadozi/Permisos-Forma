// api/reportes.js — Devuelve historial y estadísticas (protegido por contraseña)
// Uso: POST con { password } en el body
const { obtenerAltas, obtenerEstadisticas } = require('../lib/db');

const REPORT_PASSWORD = process.env.REPORT_PASSWORD || 'BIM2025';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { password } = req.body || {};
  if (!password || password !== REPORT_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized', detail: 'Contraseña incorrecta' });
  }
  try {
    const [altas, stats] = await Promise.all([obtenerAltas(2000), obtenerEstadisticas()]);
    res.json({ ok: true, altas, stats });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};
