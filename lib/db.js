// lib/db.js — Trazabilidad de altas usando Vercel Postgres
// Guarda cada alta (persona, función, proyecto, fecha, resultado) para auditoría.

const { sql } = require('@vercel/postgres');

let initialized = false;

// Crea la tabla si no existe (se ejecuta una vez)
async function ensureTable() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS altas (
      id SERIAL PRIMARY KEY,
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email TEXT NOT NULL,
      nombre TEXT,
      funcion TEXT,
      proyecto_id TEXT NOT NULL,
      proyecto_nombre TEXT,
      plataforma TEXT,
      modulos TEXT,
      resultado TEXT NOT NULL,
      detalle TEXT,
      ejecutor TEXT
    )
  `;
  initialized = true;
}

// Registra un alta
async function registrarAlta(registro) {
  try {
    await ensureTable();
    const {
      email, nombre = '', funcion = '', proyectoId, proyectoNombre = '',
      plataforma = '', modulos = '', resultado, detalle = '', ejecutor = ''
    } = registro;
    await sql`
      INSERT INTO altas (email, nombre, funcion, proyecto_id, proyecto_nombre, plataforma, modulos, resultado, detalle, ejecutor)
      VALUES (${email}, ${nombre}, ${funcion}, ${proyectoId}, ${proyectoNombre}, ${plataforma}, ${modulos}, ${resultado}, ${detalle}, ${ejecutor})
    `;
  } catch (e) {
    console.error('Error registrando alta:', e.message);
    // No bloquear el flujo principal si falla el log
  }
}

// Obtiene todas las altas (para reportes), ordenadas por fecha desc
async function obtenerAltas(limite = 1000) {
  await ensureTable();
  const { rows } = await sql`
    SELECT id, fecha, email, nombre, funcion, proyecto_id, proyecto_nombre, plataforma, modulos, resultado, detalle, ejecutor
    FROM altas
    ORDER BY fecha DESC
    LIMIT ${limite}
  `;
  return rows;
}

// Estadísticas agregadas para los gráficos
async function obtenerEstadisticas() {
  await ensureTable();
  const porFuncion = await sql`
    SELECT funcion, COUNT(*)::int AS total
    FROM altas WHERE resultado = 'OK' AND funcion <> ''
    GROUP BY funcion ORDER BY total DESC
  `;
  const porPlataforma = await sql`
    SELECT plataforma, COUNT(*)::int AS total
    FROM altas WHERE resultado = 'OK'
    GROUP BY plataforma
  `;
  const porDia = await sql`
    SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS total
    FROM altas WHERE resultado = 'OK'
    GROUP BY dia ORDER BY dia DESC LIMIT 30
  `;
  const totales = await sql`
    SELECT
      COUNT(*) FILTER (WHERE resultado = 'OK')::int AS exitosas,
      COUNT(*) FILTER (WHERE resultado <> 'OK')::int AS fallidas,
      COUNT(DISTINCT email) FILTER (WHERE resultado = 'OK')::int AS personas,
      COUNT(DISTINCT proyecto_id) FILTER (WHERE resultado = 'OK')::int AS proyectos
    FROM altas
  `;
  return {
    porFuncion: porFuncion.rows,
    porPlataforma: porPlataforma.rows,
    porDia: porDia.rows,
    totales: totales.rows[0] || { exitosas: 0, fallidas: 0, personas: 0, proyectos: 0 }
  };
}

module.exports = { registrarAlta, obtenerAltas, obtenerEstadisticas };
