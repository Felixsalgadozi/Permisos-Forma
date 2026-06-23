// api/add-user.js — Agrega una persona a un proyecto (ACC o BIM 360)
// Registra cada intento en la base de datos para trazabilidad.
const aps = require('../lib/aps');
const { registrarAlta } = require('../lib/db');

const {
  getToken, getProjectPlatform, getRoleName, resolveRoleIds,
  getDefaultCompanyId, getAccountEmailSet, modulosParaFuncion,
  writeHeaders, BASE, ACCOUNT_ID, REGION, ADMIN_USER_ID
} = aps;

module.exports = async (req, res) => {
  const body = req.body || {};
  const { projectId, user, projectName } = body;
  if (!projectId || !user || !user.email) {
    return res.status(400).json({ error: 'bad_request', detail: 'Falta projectId o user.email' });
  }

  let resultadoLog = 'ERROR', detalleLog = '', plataformaLog = '', modulosLog = '', funcionLog = '';

  try {
    const token = await getToken();

    // Seguridad: validar que el correo sea miembro activo de la cuenta
    const accountEmails = await getAccountEmailSet();
    if (accountEmails.size && !accountEmails.has(user.email.toLowerCase())) {
      detalleLog = 'El correo no pertenece a un miembro activo de la cuenta.';
      await registrarAlta({
        email: user.email, nombre: user.name || '', proyectoId: projectId, proyectoNombre: projectName || '',
        resultado: 'ERROR', detalle: detalleLog
      });
      return res.status(403).json({ error: 'not_member', detail: detalleLog });
    }

    const platform = await getProjectPlatform(projectId, token);
    plataformaLog = platform;

    // Resolver nombre de la función (puede llegar UUID o nombre)
    const roleRef = (Array.isArray(user.roleIds) && user.roleIds.length) ? user.roleIds[0] : null;
    const roleName = await getRoleName(roleRef, projectId);
    funcionLog = roleName || '';

    let r;
    if (platform === 'bim360') {
      // ── BIM 360: endpoint hq/v2 users/import con token 2-legged ──────────
      const bimRoleIds = await resolveRoleIds(user.roleIds, projectId);
      const companyId = await getDefaultCompanyId();
      const bimUrl = BASE + '/hq/v2/accounts/' + ACCOUNT_ID + '/projects/' + projectId + '/users/import';
      const services = modulosParaFuncion(roleName).bim360;

      async function tryImport(svcSet, roles) {
        const entry = { email: user.email, services: svcSet, industry_roles: roles };
        if (companyId) entry.company_id = companyId;
        return fetch(bimUrl, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'x-user-id': ADMIN_USER_ID },
          body: JSON.stringify([entry])
        });
      }

      r = await tryImport(services, bimRoleIds);
      let t = await r.clone().text(); let dd; try { dd = JSON.parse(t); } catch { dd = {}; }
      const im = dd?.failure_items?.[0]?.errors?.[0]?.message || '';
      const m = im.match(/Invalid services \[([^\]]+)\]/i);
      if (m) {
        const invalid = m[1].split(',').map(s => s.trim().replace(/["']/g, ''));
        const filtered = {};
        for (const [k, v] of Object.entries(services)) if (!invalid.includes(k)) filtered[k] = v;
        if (!filtered.document_management) filtered.document_management = { access_level: 'user' };
        r = await tryImport(filtered, bimRoleIds);
      }
      modulosLog = Object.keys(modulosParaFuncion(roleName).bim360).join(', ');
    } else {
      // ── ACC moderno ───────────────────────────────────────────────────────
      const validRoleIds = await resolveRoleIds(user.roleIds, projectId);
      const products = modulosParaFuncion(roleName).acc;
      modulosLog = products.map(p => p.key).join(', ');

      const payload = { email: user.email, products };
      if (validRoleIds.length) payload.roleIds = validRoleIds;

      r = await fetch(BASE + '/construction/admin/v1/projects/' + projectId + '/users', {
        method: 'POST',
        headers: writeHeaders(token),
        body: JSON.stringify(payload)
      });
    }

    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // BIM 360 import: 200 con failure_items posibles
    if (platform === 'bim360' && data && typeof data.failure === 'number') {
      if (data.success > 0) {
        resultadoLog = 'OK';
        await registrarAlta({
          email: user.email, nombre: user.name || '', funcion: funcionLog,
          proyectoId: projectId, proyectoNombre: projectName || '', plataforma: platform,
          modulos: modulosLog, resultado: 'OK', detalle: 'active', ejecutor: body.ejecutor || ''
        });
        return res.json({ ok: true, email: user.email, status: 'active', platform });
      }
      const fail = (data.failure_items && data.failure_items[0]) || {};
      detalleLog = (fail.errors && fail.errors[0] && fail.errors[0].message) || 'No se pudo agregar';
      await registrarAlta({
        email: user.email, nombre: user.name || '', funcion: funcionLog,
        proyectoId: projectId, proyectoNombre: projectName || '', plataforma: platform,
        modulos: modulosLog, resultado: 'ERROR', detalle: detalleLog, ejecutor: body.ejecutor || ''
      });
      return res.status(400).json({ error: 'autodesk', status: 400, detail: detalleLog, platform });
    }

    if (!r.ok) {
      let detail = data.detail || data.title || data.message ||
        (data.errors?.[0] && (data.errors[0].detail || data.errors[0].title || data.errors[0].message)) ||
        JSON.stringify(data);
      if (Array.isArray(data.errors) && data.errors.length) {
        detail = data.errors.map(e => e.detail || e.title || e.message || JSON.stringify(e)).join(' | ');
      }
      detalleLog = String(detail);
      await registrarAlta({
        email: user.email, nombre: user.name || '', funcion: funcionLog,
        proyectoId: projectId, proyectoNombre: projectName || '', plataforma: platform,
        modulos: modulosLog, resultado: 'ERROR', detalle: detalleLog, ejecutor: body.ejecutor || ''
      });
      return res.status(r.status).json({ error: 'autodesk', status: r.status, detail, platform });
    }

    // Éxito ACC
    resultadoLog = 'OK';
    detalleLog = data.status || 'active';
    await registrarAlta({
      email: user.email, nombre: user.name || '', funcion: funcionLog,
      proyectoId: projectId, proyectoNombre: projectName || '', plataforma: platform,
      modulos: modulosLog, resultado: 'OK', detalle: detalleLog, ejecutor: body.ejecutor || ''
    });
    res.json({ ok: true, email: user.email, status: data.status || 'active', id: data.id, platform });

  } catch (e) {
    await registrarAlta({
      email: (user && user.email) || '', nombre: (user && user.name) || '', funcion: funcionLog,
      proyectoId: projectId, proyectoNombre: projectName || '', plataforma: plataformaLog,
      modulos: modulosLog, resultado: 'ERROR', detalle: String(e.message || e), ejecutor: body.ejecutor || ''
    });
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};
