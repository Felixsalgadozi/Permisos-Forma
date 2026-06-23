# Altas de personas · ACC / BIM 360 — Constructora Jaramillo Mora

Herramienta web para agregar empleados a proyectos de Autodesk Construction Cloud (ACC) y BIM 360, con trazabilidad y reportes protegidos.

## Qué hace

- **Agrega personas** a proyectos ACC y BIM 360 seleccionando empleado + función.
- **Asigna módulos automáticamente** según la función (Docs siempre; Design Collaboration y Model Coordination en las 39 funciones configuradas).
- **Valida** que el correo pertenezca a un miembro activo de la cuenta.
- **Registra cada alta** (persona, función, proyecto, fecha, resultado) en base de datos.
- **Reportes protegidos** con contraseña: gráficos (por función, plataforma, día) + listado detallado con exportación a CSV.

### Limitación conocida (BIM 360)
En proyectos **BIM 360**, Autodesk no expone Design Collaboration ni Model Coordination a la API pública (solo Document Management). La herramienta agrega lo que puede e intenta los demás módulos; si Autodesk los rechaza, se completan manualmente. En **ACC funciona todo**.

---

## Despliegue en Vercel — paso a paso

### 1. Subir el proyecto a GitHub
Crea un repositorio nuevo en GitHub y sube esta carpeta completa (o usa la CLI de Vercel directamente, ver más abajo).

### 2. Importar en Vercel
1. Entra a https://vercel.com e inicia sesión.
2. **Add New → Project** → importa el repositorio de GitHub.
3. Vercel detecta la configuración automáticamente (no cambies el framework, déjalo en "Other").
4. **No hagas Deploy todavía** — primero configura la base de datos y las variables (pasos 3 y 4).

### 3. Crear la base de datos (Vercel Postgres)
1. En el proyecto de Vercel, ve a la pestaña **Storage**.
2. **Create Database → Postgres** → dale un nombre (ej. `altas-db`) → **Create**.
3. Conéctala al proyecto (**Connect Project**). Esto agrega automáticamente las variables `POSTGRES_*` que la app necesita. No tienes que copiarlas manualmente.

> La tabla `altas` se crea sola la primera vez que se registra un alta.

### 4. Configurar variables de entorno
En **Settings → Environment Variables**, agrega estas (para todos los entornos: Production, Preview, Development):

| Variable | Valor |
|---|---|
| `APS_CLIENT_ID` | *(tu Client ID de Autodesk)* |
| `APS_CLIENT_SECRET` | *(tu Client Secret de Autodesk)* |
| `APS_ACCOUNT_ID` | `ee9b4a25-2dc1-4ce9-8a69-f02e8b208af9` |
| `APS_ADMIN_USER_ID` | `9c0b6676-0eda-4d7f-9856-5752fad1ee22` |
| `APS_REGION` | `US` |
| `REPORT_PASSWORD` | *(la contraseña que quieras para los reportes)* |

> Si no defines `REPORT_PASSWORD`, la contraseña por defecto es `BIM2025`. **Cámbiala.**

### 5. Desplegar
Pulsa **Deploy**. Cuando termine, tendrás una URL tipo `https://tu-proyecto.vercel.app`.

- Página principal (altas): `https://tu-proyecto.vercel.app/`
- Reportes (protegida): `https://tu-proyecto.vercel.app/reportes`

---

## Alternativa: desplegar con la CLI de Vercel (sin GitHub)

```bash
npm i -g vercel
cd jm-acc
vercel            # primera vez: sigue el asistente
# luego configura Storage (Postgres) y variables desde el panel web (pasos 3-4)
vercel --prod     # despliegue a producción
```

## Probar en local

```bash
npm install
vercel dev        # requiere la CLI de Vercel y las variables en .env.local
```

Crea un archivo `.env.local` con las mismas variables del paso 4 (y las `POSTGRES_*` que te da Vercel al crear la base) para que funcione en local.

---

## Estructura del proyecto

```
jm-acc/
├── api/                  Funciones serverless (backend)
│   ├── health.js         Estado del servidor y credenciales
│   ├── projects.js       Lista proyectos activos
│   ├── account-users.js  Lista empleados activos (validación)
│   ├── roles.js          Funciones del proyecto (?projectId=)
│   ├── add-user.js       Alta de persona + registro de trazabilidad
│   └── reportes.js       Historial + estadísticas (protegido)
├── lib/
│   ├── aps.js            Lógica compartida de Autodesk (ACC/BIM360)
│   └── db.js             Trazabilidad (Vercel Postgres)
├── public/
│   ├── index.html        Interfaz de altas
│   ├── reportes.html     Panel de reportes
│   ├── logo-jaramillo.png
│   └── logo-bim.jpg
├── package.json
├── vercel.json
└── .gitignore
```

## Nota sobre el Callback URL de Autodesk
La versión anterior usaba login de Autodesk (3-legged). **Esta versión ya no lo usa** — todo funciona con token de aplicación (2-legged). Puedes dejar el Callback URL como esté en aps.autodesk.com; no afecta.
