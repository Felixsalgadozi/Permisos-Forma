// lib/aps.js — Lógica compartida de Autodesk Platform Services (ACC/BIM360)
// Usado por todas las funciones serverless en /api

const CLIENT_ID = process.env.APS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET || '';
const ACCOUNT_ID = process.env.APS_ACCOUNT_ID || 'ee9b4a25-2dc1-4ce9-8a69-f02e8b208af9';
const ADMIN_USER_ID = process.env.APS_ADMIN_USER_ID || '9c0b6676-0eda-4d7f-9856-5752fad1ee22';
const REGION = (process.env.APS_REGION || 'US').toUpperCase();
const BASE = 'https://developer.api.autodesk.com';

// ─── Token 2-legged con caché (en memoria del proceso) ───────────────────────
let tokenCache = { value: null, expiresAt: 0 };
async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60000) return tokenCache.value;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Faltan APS_CLIENT_ID / APS_CLIENT_SECRET');
  const basic = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const r = await fetch(BASE + '/authentication/v2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'account:read account:write data:read data:write' })
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Auth Autodesk: ' + (data.error_description || JSON.stringify(data)));
  tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.value;
}

function writeHeaders(token) {
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'User-Id': ADMIN_USER_ID,
    'x-user-id': ADMIN_USER_ID,
    'Region': REGION
  };
}

const isUuidStr = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');

// ─── Funciones que llevan 3 módulos (Docs + Design Collab + Model Coord) ─────
const ROLES_TRES_MODULOS = new Set([
  "JMC_U_ing Ambiental",
  "EXT_YAV_Proveedor Imagenes Y Videos",
  "JMC_A_Dibujante",
  "EXT_YSH_Ingeniero Seguridad Humana",
  "JMC_A_Jefe De Coordinación De Proyectos",
  "JMC_U_Arquitecto De Gestión Urbana",
  "EXT_L_Ingeniero Diseño Eléctrico",
  "JMC_A_Arquitecto Diseñador (Cabidas)",
  "EXT_YGE_Geotecnista",
  "JMC_A_Arquitecto Diseñador",
  "JMC_A_Arquitecto Auxiliar Tramites Legales",
  "EXT_YCS_Consultor Certificaciones Sostenibilidad",
  "EXT_YCB_Consultor De Bioclimatica",
  "EXT_E_Ingeniero Diseño Estructural",
  "EXT_YPP_Proveedor POP",
  "EXT_M_Ingeniero Mecánico",
  "JMC_A_Ing/Arq De Presupuestos",
  "JMC_U_Dibujante De G. Urbana",
  "EXT_YDV_Ingeniero De Vías",
  "EXT_G_Ingeniero Diseño Gas",
  "EXT_H_Ingeniero Diseño Hidrosanitario",
  "EXT_Asesor diseño Eléctrico",
  "EXT_H_Interventoría De Diseño Hidrosanitario",
  "EXT_YFM_Formaletas",
  "EXT_YSP_Proveedor De Servicios Públicos",
  "EXT_YPF_Proveedor Formaletas",
  "EXT_E_Ingeniero De Supervisión Técnica",
  "EXT_YSO_Diseñador Paneles Fotovoltaicos",
  "EXT_L_Ingeniero Diseño Iluminación",
  "EXT_YAL_Ingeniero Alcantarillado",
  "EXT_YTP_Topografo",
  "EXT_A_Diseño Arquitectónico",
  "EXT_L_Certificador Diseños Eléctricos, Comunicaciones Y Alumbrado Publico",
  "EXT_T_Ingeniero Diseño Telecomunicaciones",
  "EXT_E_Revisor Estructural",
  "EXT_A_Despiece de cubiertas",
  "EXT_YPS_Proveedor Equipos Piscinas",
  "EXT_YMV_Ingeniero Estudio De Tráfico",
  "JMC_U_Auxiliar Técnico De G. Urbana",
]);

function modulosParaFuncion(roleName) {
  const tres = roleName && ROLES_TRES_MODULOS.has(roleName);
  if (tres) {
    return {
      acc: [
        { key: 'docs', access: 'member' },
        { key: 'designCollaboration', access: 'member' },
        { key: 'modelCoordination', access: 'member' },
      ],
      bim360: {
        document_management: { access_level: 'user' },
        design_collaboration: { access_level: 'user' },
        model_coordination: { access_level: 'user' },
      }
    };
  }
  return {
    acc: [{ key: 'docs', access: 'member' }],
    bim360: { document_management: { access_level: 'user' } }
  };
}

// ─── Lista base de funciones (respaldo) ──────────────────────────────────────
const BASE_ROLES = [
  "EXT_A_Asesor VR/AR","EXT_A_Despiece de cubiertas","EXT_A_Diseño Arquitectónico",
  "EXT_A_Revisor Curaduría","EXT_Asesor diseño Eléctrico","EXT_E_Ingeniero De Supervisión Técnica",
  "EXT_E_Ingeniero Diseño Estructural","EXT_E_Revisor Estructural","EXT_G_Ingeniero Diseño Gas",
  "EXT_H_Ingeniero Diseño Hidrosanitario","EXT_H_Interventoría De Diseño Hidrosanitario",
  "EXT_H_Revisor Diseño Hidrosanitario","EXT_Ingeniero Detección Y Alarma",
  "EXT_J_Revisor Curaduría","EXT_L_Certificador Diseños Eléctricos, Comunicaciones Y Alumbrado Publico",
  "EXT_L_Certificador Diseños Eléctricos, Comunicaciones Y Alumbrado Publico AP",
  "EXT_L_Diseño Iluminación","EXT_L_Ingeniero Diseño Eléctrico","EXT_L_Ingeniero Diseño Iluminación",
  "EXT_L_Interventoría De Diseño Eléctrico","EXT_L_Revisor Curaduría","EXT_L_Revisor Diseño Eléctrico",
  "EXT_M_Diseño HVAC","EXT_M_Ingeniero Mecánico","EXT_Revisor Eléctrico",
  "EXT_T_Ingeniero Diseño Telecomunicaciones","EXT_YAB_Ingeniero Ambiental",
  "EXT_YAC_Ingeniero Acueducto","EXT_YAI_Agente Inmobiliario","EXT_YAL_Ingeniero Alcantarillado",
  "EXT_YAQ_Arqueólogo","EXT_YAT_Automatización, Control Y Electrónica",
  "EXT_YAV_Proveedor Imagenes Y Videos","EXT_YCB_Consultor De Bioclimatica",
  "EXT_YCS_Consultor Certificaciones Sostenibilidad","EXT_YDA_Ingeniero Detección Y Alarma",
  "EXT_YDR_Proveedor Dotaciones Recreativas","EXT_YDV_Ingeniero De Vías",
  "EXT_YEC_Proveedor Equipos Comunicaciones","EXT_YFM_Formaletas","EXT_YFR_Ingeniero Forestal",
  "EXT_YGE_Geotecnista","EXT_YGE_Ingeniero Geotécnico","EXT_YHD_Ingeniero Especialista Hidrología",
  "EXT_YIM_Consultor De Implementación","EXT_YMV_Ingeniero Estudio De Tráfico",
  "EXT_YPF_Proveedor Formaletas","EXT_YPL_Ingeniero Pluvial","EXT_YPP_Proveedor POP",
  "EXT_YPS_Proveedor Equipos Piscinas","EXT_YRA_Consultor RA","EXT_YSC_Proveedor Ascensores",
  "EXT_YSH_Ingeniero Seguridad Humana","EXT_YSO_Diseñador Paneles Fotovoltaicos",
  "EXT_YSO_Diseño Sonido","EXT_YSP_Proveedor De Servicios Públicos","EXT_YTP_Topografo",
  "EXT_YZV_Diseñador Paisajístico","JMC_A_Arquitecto Auxiliar Tramites Legales",
  "JMC_A_Arquitecto Diseñador","JMC_A_Arquitecto Diseñador (Cabidas)",
  "JMC_A_Arquitecto Proyectos Internos","JMC_A_Arquitecto Técnico Acabados",
  "JMC_A_Coordinador 3D","JMC_A_Coordinador Proyectos Sostenibles",
  "JMC_A_Coordinador Técnico Estructuras","JMC_A_Dibujante","JMC_A_Gerencia De Planeación",
  "JMC_A_Ing/Arq Control De Costos","JMC_A_Ing/Arq De Presupuestos","JMC_A_Invitado",
  "JMC_A_Jefe Control De Costos","JMC_A_Jefe De Coordinación De Proyectos",
  "JMC_A_Jefe De Coordinación Técnica","JMC_A_Jefe De Diseño","JMC_A_Jefe De Presupuestos",
  "JMC_A_Sub-gerente De Planeación","JMC_A_Tramitador","JMC_A_Visualización arquitectónica",
  "JMC_BIM_Arquitecto BIM","JMC_BIM_Auditor De Modelos","JMC_BIM_Ingeniero BIM Gestión Urbana",
  "JMC_BIM_Ingeniero BIM PMO","JMC_BIM_Ingeniero De Automatización","JMC_BIM_Jefe De Coordinación BIM",
  "JMC_BIM_Modelador BIM","JMC_C_Administrador De Formaletas","JMC_C_Asistente Construcciones",
  "JMC_C_Auxiliar De Ingenieria","JMC_C_Auxiliar Ingeniería","JMC_C_Coordinador Lean",
  "JMC_C_Director De Obras","JMC_C_Gerente De Construcciones","JMC_C_Ing/Arq De Contratación",
  "JMC_C_Ing/Arq De Postventas","JMC_C_Inspector De Obra","JMC_C_Jefe De Contratos",
  "JMC_C_Liberaciones Y Entregas","JMC_C_Proyectista De Formaletas","JMC_C_Residente De Acabados",
  "JMC_C_Residente De Estructuras","JMC_C_Residente De Urbanismo","JMC_C_Residente Modelos Y SV",
  "JMC_C_Sub Gerente De Construcciones","JMC_C_Subdirector De Obras","JMC_C_Técnico De Formaleta",
  "JMC_C_Técnico De Forlmaleta","JMC_I_Administracion Inmuebles","JMC_I_Dibujante De Proyectos Internos",
  "JMC_J_Especialista En Trámites Legales","JMC_J_Jurídico","JMC_M_Coordinador Comercial",
  "JMC_M_Desarrollos Comerciales","JMC_M_Gerente Comercial","JMC_P_Arquitecto De Especificaciones",
  "JMC_P_Arquitecto Paisajista","JMC_P_Coordinador De Imagen","JMC_P_Coordinador Gráfico",
  "JMC_P_Coordinador Multimedia","JMC_P_Creativo Audiovisual","JMC_P_Creativo Gráfico",
  "JMC_P_Creativo Multimedia","JMC_P_Creativo Social Media","JMC_P_Estratega Digital",
  "JMC_P_Especialista Mercadeo","JMC_P_Planner","JMC_P_Publicidad","JMC_P_Web Master",
  "JMC_R_Coordinador De Seguridad","JMC_Residente Modelos Y SV","JMC_T_Jefe Tecnología",
  "JMC_T_Talento Humano","JMC_U_Arquitecto De Gestión De Suelo","JMC_U_Arquitecto De Gestión Urbana",
  "JMC_U_arq Gestión Urbana","JMC_U_Auxiliar Técnico De G. Urbana",
  "JMC_U_Coordinador De Diseño Urbano","JMC_U_Coordinador De Gestión Ambiental",
  "JMC_U_Coordinador De Gestión De Suelo","JMC_U_Dibujante De G. Urbana",
  "JMC_U_ing Ambiental","JMC_U_Ing Tecnico De G. Urbana","JMC_U_Jefe Técnico De G. Urbana"
].sort((a, b) => a.localeCompare(b, 'es'));

function roleAllowed(name) {
  if (!name) return false;
  const n = name.toUpperCase();
  if (!(n.startsWith('JMC') || n.startsWith('EXT'))) return false;
  if (n.includes('BIM')) return false;
  return true;
}

// ─── Caché de plataforma por proyecto ────────────────────────────────────────
const platformCache = {};
async function getProjectPlatform(projectId, token) {
  if (platformCache[projectId]) return platformCache[projectId];
  const r = await fetch(BASE + '/construction/admin/v1/projects/' + projectId, {
    headers: { Authorization: 'Bearer ' + token, Region: REGION }
  });
  if (!r.ok) return 'acc';
  const d = await r.json();
  const platform = (d.platform || 'acc').toLowerCase();
  platformCache[projectId] = platform;
  return platform;
}

// ─── Caché de funciones por proyecto (nombre -> {id, services}) ──────────────
const projectRolesCache = {};
async function getProjectRolesMap(projectId) {
  if (projectRolesCache[projectId]) return projectRolesCache[projectId];
  const byName = new Map();
  const tok = await getToken();
  const url = BASE + '/hq/v2/accounts/' + ACCOUNT_ID + '/projects/' + projectId + '/industry_roles';
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok, Region: REGION, 'x-user-id': ADMIN_USER_ID } });
    if (r.ok) {
      const d = await r.json();
      const arr = Array.isArray(d) ? d : (d.results || d.data || []);
      for (const role of arr) if (role.id && role.name) byName.set(role.name, { id: role.id, services: role.services || {} });
    }
  } catch (e) {}
  projectRolesCache[projectId] = byName;
  return byName;
}

async function getRoleName(roleRef, projectId) {
  if (!roleRef) return null;
  if (!isUuidStr(roleRef)) return roleRef;
  const byName = await getProjectRolesMap(projectId);
  for (const [name, info] of byName.entries()) if (info.id === roleRef) return name;
  return null;
}

async function resolveRoleIds(roleIds, projectId) {
  if (!Array.isArray(roleIds) || !roleIds.length) return [];
  const resolved = [];
  let byName = null;
  for (const rid of roleIds) {
    if (isUuidStr(rid)) { resolved.push(rid); continue; }
    if (!byName) byName = await getProjectRolesMap(projectId);
    const found = byName.get(rid);
    if (found) resolved.push(found.id);
  }
  return resolved;
}

// ─── Company ID por defecto ──────────────────────────────────────────────────
let companyIdCache = { id: null, at: 0 };
async function getDefaultCompanyId() {
  if (companyIdCache.id && Date.now() - companyIdCache.at < 1800000) return companyIdCache.id;
  try {
    const token = await getToken();
    const r = await fetch(BASE + '/hq/v1/accounts/' + ACCOUNT_ID + '/companies?limit=1', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (r.ok) {
      const d = await r.json();
      const arr = Array.isArray(d) ? d : (d.results || d.data || []);
      if (arr[0] && arr[0].id) companyIdCache = { id: arr[0].id, at: Date.now() };
    }
  } catch (e) {}
  return companyIdCache.id;
}

// ─── Set de correos de la cuenta (caché 5 min) ───────────────────────────────
let emailCache = { set: new Set(), at: 0 };
async function getAccountEmailSet() {
  if (emailCache.set.size && Date.now() - emailCache.at < 300000) return emailCache.set;
  try {
    const token = await getToken();
    let all = [], offset = 0;
    for (;;) {
      const url = BASE + '/hq/v1/accounts/' + ACCOUNT_ID + '/users?limit=100&offset=' + offset + '&status=active';
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Region: REGION, 'x-user-id': ADMIN_USER_ID } });
      if (!r.ok) break;
      const d = await r.json();
      const results = Array.isArray(d) ? d : (d.results || d.data || []);
      all = all.concat(results);
      if (results.length < 100) break;
      offset += 100;
    }
    emailCache = { set: new Set(all.map(u => (u.email || '').toLowerCase()).filter(Boolean)), at: Date.now() };
  } catch (e) {}
  return emailCache.set;
}

module.exports = {
  CLIENT_ID, CLIENT_SECRET, ACCOUNT_ID, ADMIN_USER_ID, REGION, BASE,
  getToken, writeHeaders, isUuidStr, modulosParaFuncion, roleAllowed,
  getProjectPlatform, getProjectRolesMap, getRoleName, resolveRoleIds,
  getDefaultCompanyId, getAccountEmailSet
};
