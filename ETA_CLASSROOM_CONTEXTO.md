# ETA CLASSROOM — Documento Fundacional
## Contexto completo para Claude Code · Sprint 6
**Edoardo Ortiz · Colegio Boston Flexible · 2026**

> *"El sistema trabaja. El maestro enseña."*

---

## 1. ORIGEN — Por qué existe esto

En una conversación del 21 de abril de 2026, Edoardo dijo:

> *"El director entró al virtual campus para ver mis guías. Pero no puede ver mis clases a menos que entre al salón físicamente."*

Esa frase desencadenó la visión completa de **ETA Platform**: un sistema donde el director observa en tiempo real sin interrumpir, el docente ejecuta desde un entorno unificado, y la IA atestigua todo lo que ocurre en el aula.

---

## 2. CONTEXTO INSTITUCIONAL

| Campo | Valor |
|---|---|
| Institución | Colegio Boston Flexible (CBF) |
| Ciudad | Barranquilla, Colombia |
| DANE | 308001800455 · Res. 09685/2019 |
| Docente / Owner | Edoardo Ortiz |
| Email admin | edoardoortiz@redboston.edu.co |
| Escala de notas | 1.0–5.0 · `(puntaje / total) × 4 + 1` |
| Año institucional | 2026 — "Año de la Pureza" |
| Versículo del año | Génesis 1:27-28a (TLA) |

---

## 3. ARQUITECTURA ETA PLATFORM — LAS 5 CAPAS

```
┌──────────────────────────────────────────────────────────────┐
│  CAPA 5 — INTELIGENCIA (Sprint 16 — VISIÓN FUTURA)          │
│  IA con memoria acumulada por estudiante                      │
│  Diferenciación automática · Instrucción adaptada            │
├──────────────────────────────────────────────────────────────┤
│  CAPA 4 — EVALUACIÓN (backend completo en cbf-planner)       │
│  Exámenes con IA · Corrección automática · Anti-trampa       │
│  Cola AI · Escala colombiana · Revisión humana               │
├──────────────────────────────────────────────────────────────┤
│  CAPA 3 — EJECUCIÓN ← SPRINT 6 ACTIVO                       │
│  cbf-classroom: entorno de aula unificado                    │
│  Pizarra · Video LiveKit · Testigo IA · Split-screen         │
├──────────────────────────────────────────────────────────────┤
│  CAPA 2 — PRODUCCIÓN (cbf-studio — PENDIENTE)                │
│  Animaciones 2D/3D · Diapositivas · Recursos multimedia      │
│  Motor 2D + Three.js                                         │
├──────────────────────────────────────────────────────────────┤
│  CAPA 1 — DISEÑO (cbf-planner — ✅ SPRINTS 1–5 COMPLETOS)   │
│  NEWS · Guías · Indicadores · Rúbricas · Export DOCX         │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. FLUJO COMPLETO DEL SISTEMA

```
DOCENTE DISEÑA (cbf-planner)
  → NEWS, guías, indicadores, rúbricas, exámenes
  → Todo en Supabase, listo para ejecutar
          ↓
DOCENTE EJECUTA (cbf-classroom ← aquí estamos)
  → Abre el entorno → la clase ya está lista (classResolver)
  → Proyecta los 5 momentos desde la planeación real
  → Pizarra, split-screen, diapositivas — todo en un lugar
  → Strip de estudiantes presenciales + virtuales (LiveKit)
  → Testigo IA observa en tiempo real
  → REC graba si el docente lo activa
          ↓
DIRECTOR OBSERVA (sin interrumpir)
  → Dashboard con Supabase Realtime
  → Ve cada salón activo: docente, grado, tema, momento actual
  → Alertas automáticas si algo no ocurre
          ↓
DIRECTOR DE RED
  → Dashboard multi-institución
  → Drill-down por colegio, sin cuentas adicionales
          ↓
ESTUDIANTE RESPONDE (cbf-student — futuro)
  → Ve el canvas del docente en tiempo real
  → Trabaja en su canvas personal
  → Entrega sin papel
          ↓
LA IA DIFERENCIA (Sprint 16 — futuro)
  → Historial acumulado por estudiante
  → Sugiere diferenciación al docente automáticamente
```

---

## 5. MONOREPO — ESTRUCTURA

```
eta-platform/
├── apps/
│   ├── cbf-planner/       ← ✅ Sprints 1–5 completos
│   ├── cbf-classroom/     ← ⏳ Sprint 6 — EN CONSTRUCCIÓN
│   ├── cbf-student/       ← 📋 Sprint 13–14
│   └── cbf-studio/        ← 📋 Sprint 11–12
│
└── packages/
    ├── supabase/          ← cliente + tipos compartidos (@eta/supabase)
    ├── ui/                ← design tokens + componentes (@eta/ui)
    └── config/            ← vite.base, tsconfig.base (@eta/config)
```

**Regla de oro:** ninguna `app` importa directamente de otra `app`. Todo lo compartido vive en `packages/`.

---

## 6. CREDENCIALES Y REPOS

```
Supabase URL:     https://vouxrqsiyoyllxgcriic.supabase.co
Supabase Key:     sb_publishable_lvALYoqrwIge-1IJ40JT-w_ADuxBEAR
Supabase ID:      vouxrqsiyoyllxgcriic
School UUID:      a21e681b-5898-4647-8ad9-bdb5f9844094

GitHub Org:       ClassroomsOS  (con s)
Repo planner:     ClassroomsOS/cbf-planner
Repo monorepo:    ClassroomsOS/eta-platform  (por crear en Sprint 6)

Deploy planner:   https://classroomsos.github.io/cbf-planner/
Deploy classroom: https://classroomsos.github.io/cbf-classroom/  (por crear)

Local planner:    C:\BOSTON FLEX\ClassroomOS\cbf-planner
Local monorepo:   C:\BOSTON FLEX\ClassroomOS\eta-platform  (por crear)
```

---

## 7. WORKFLOW DE DESARROLLO

```bash
# Desde la raíz del monorepo
cd "C:\BOSTON FLEX\ClassroomOS\eta-platform"

npm install           # instala todo el workspace
npm run dev           # levanta todas las apps en paralelo

# O una sola app
cd apps/cbf-classroom
npm run dev           # http://localhost:5174/cbf-classroom/

# Deploy
git add .
git commit -m "feat: descripción"
git push              # GitHub Actions → deploy ~2 min

# Siempre minify: false en vite.config.js (regla permanente)
```

---

## 8. CBF-PLANNER — LO QUE YA EXISTE (Sprints 1–5)

Completamente funcional y desplegado. Incluye:

- Auth con 5 roles: `superadmin`, `coordinator`, `group_director`, `psychopedagogue`, `teacher`
- Calendario institucional con notificaciones en cascada
- Constructor de horarios con validación de solapamientos
- Sistema NEWS completo (Need → Experience → Wisdom → Send)
- Backward design real
- Generación automática de agenda semanal para directores de grupo
- AI rubric autofill + AI guide generation (via Edge Function `claude-proxy`)
- Dropdowns inteligentes por grado, materia, sección
- Export DOCX dual:
  - Formato CBF Planner (diseño moderno)
  - Formato legado `CBF-G AC-01` (institucional — tratado como documento legal)
- Sidebar pedagógico ordenado
- Stack: React + Vite + Supabase + GitHub Pages

### Reglas del formato legado (CBF-G AC-01) — crítico

- Fuente: Arial en todo el documento
- Columnas con anchos exactos definidos en el template
- Colores exactos: SYNC = rojo `#FF0000`, SUBJECT = verde `#008F00`, otras secciones = azul `#1F497D`
- El encabezado debe reproducirse byte a byte del archivo de referencia
- Cualquier desviación visual es considerada falsificación por el supervisor (Mr. Yair)
- Función separada `buildLegacyDocx()` — no mezclar con el pipeline moderno
- Regla pedagógica de Mr. Yair: ninguna unidad puede abarcar más de 2 semanas en Language Arts o Science

---

## 9. CBF-CLASSROOM — LO QUE SE CONSTRUYE EN SPRINT 6

### Concepto central

El docente no debería recordar conectar Gmail, abrir Meet, compartir pantalla, ajustar el micrófono. Eso consume energía mental que debería estar en enseñar. **cbf-classroom** unifica todo en un solo entorno.

### Marco permanente (siempre visible en la UI)

- **Top bar** con versículo del período, objetivo del día, fecha — como píldoras colapsables
- Al hacer clic en una píldora → se expande en overlay centrado
- Al cerrar → vuelve al estado comprimido en el top bar
- Indicador de momento activo (de los 5 momentos de la clase)

### Canvas central — modos

| Modo | Descripción |
|---|---|
| **Pizarra libre** | Canvas digital con lápiz, colores, borrador, texto — strokes guardados en Supabase |
| **Split screen** | YouTube/web a la izquierda, pizarra a la derecha |
| **Diapositivas** | Slides creadas dentro del entorno, navegables con flechas |
| **Proyección** | Contenido de la guía (texto, imágenes) proyectado en pantalla completa |

### Los 5 momentos de la clase

Tomados directamente de `lesson_plans.content.days[fecha]`:

1. **Apertura devocional** — versículo, oración, reflexión
2. **Presentación de contenido** — el skill del día
3. **Práctica guiada** — ejercicios en clase
4. **Aplicación real** — producción del estudiante
5. **Cierre y exit ticket** — verificación de aprendizaje

Cada momento tiene temporizador, descripción y recursos asociados.

### Paneles laterales

- **Izquierda:** toolbar de herramientas (lápiz, texto, figuras, imagen, audio, timer, random, QR)
- **Derecha (tabs):** Plan de sesión · Lista de estudiantes · Testigo IA · Notas

### Strip de estudiantes (franja inferior)

- Tile por estudiante: avatar, nombre, estado (Presente / Virtual / Ausente / Tardanza)
- Estudiantes virtuales con badge 📡 y borde azul + glow
- Estudiantes ausentes con opacidad reducida
- Scroll horizontal si hay más estudiantes de los que caben

### Testigo IA

- Observa en tiempo real el canvas y el momento activo
- Genera sugerencias contextuales: ejercicios extra, errores comunes, ritmo vs. plan
- Chips de sugerencia rápida (ej. "+ ejercicio", "error común", "¿voy a tiempo?")
- Input libre para preguntas del docente durante la clase
- Log automático de la sesión con timestamps

### classResolver — detección automática de clase

```javascript
// Al hacer login el docente:
// 1. Cruza teacher_assignments con día/hora actual
// 2. Encuentra lesson_plan activo (date_start ≤ hoy ≤ date_end)
// 3. Carga content.days[fecha] del lesson_plan
// 4. El aula está lista — sin que el docente toque nada

async function resolveCurrentClass(teacherId) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Dom ... 6=Sab
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

  const { data: assignment } = await supabase
    .from('teacher_assignments')
    .select(`*, lesson_plans(*)`)
    .eq('teacher_id', teacherId)
    .eq('day_of_week', dayOfWeek)
    .lte('start_time', currentTime)
    .gte('end_time', currentTime)
    .single();

  return assignment ?? null;
}
```

### Grabación (recorder.ts)

- MediaRecorder API — sin dependencias externas
- Captura canvas o pantalla completa con audio de micrófono
- Guardado en Supabase Storage
- REC badge parpadeante en top bar cuando está activo

### Tablas Supabase necesarias para Sprint 6

```sql
-- Sesiones de clase (log de cada clase ejecutada)
CREATE TABLE classroom_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id),
  teacher_id uuid REFERENCES users(id),
  lesson_plan_id uuid REFERENCES lesson_plans(id),
  section_id uuid REFERENCES sections(id),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  current_momento int DEFAULT 0,        -- 0–4
  heartbeat_at timestamptz DEFAULT now()
);

-- Pizarra digital (strokes persistidos)
CREATE TABLE classroom_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES classroom_sessions(id),
  strokes jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

-- Diapositivas (JSON del slide deck)
CREATE TABLE classroom_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id),
  teacher_id uuid REFERENCES users(id),
  subject text,
  title text,
  slides_json jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Asistencia por sesión
CREATE TABLE classroom_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES classroom_sessions(id),
  student_id uuid REFERENCES users(id),
  status text CHECK (status IN ('present','virtual','absent','late')),
  recorded_at timestamptz DEFAULT now()
);
```

---

## 10. DECISIONES DE ARQUITECTURA

| Decisión | Razón |
|---|---|
| Monorepo npm workspaces | Un cambio de schema actualiza las 4 apps simultáneamente |
| Supabase (PostgreSQL) sobre Firebase | PostgreSQL real, RLS nativo, Realtime incluido; datos de menores requieren control serio |
| Vite + React SPA sobre Next.js | GitHub Pages no soporta SSR; migrar a Vercel + Next.js es trivial cuando escale |
| LiveKit sobre WebRTC directo | Escala a cientos de participantes; WebRTC colapsa con más de 6–8 streams |
| LiveKit Cloud ahora, self-hosted después | Arrancar sin infraestructura; migrar cuando el volumen justifique el costo fijo |
| Three.js sobre Unity/Unreal | Corre en el navegador sin instalar nada, en cualquier computador del colegio |
| `school_id` en cada tabla | Un colegio nunca puede ver datos de otro |
| `minify: false` en vite.config.js | Permanente — facilita debugging en producción (GitHub Pages) |
| JWT verify bypass en Edge Functions | `--no-verify-jwt` — decisión de Sprint 4, no revertir |
| IA: Claude Sonnet via `claude-proxy` | Migrado de Groq en Sprint 4; Edge Function existente en Supabase |

---

## 11. CRONOGRAMA DE SPRINTS

### Completados (1–5) — CBF Planner ✅

### Planificados

| Sprint | Nombre | App | Estado |
|---|---|---|---|
| **6** | cbf-classroom Core + datos reales | cbf-classroom | ⏳ SIGUIENTE |
| 7 | Video integrado (LiveKit) | cbf-classroom | 📋 |
| 8 | Testigo IA en tiempo real | cbf-classroom | 📋 |
| 9 | Dashboard del Director | cbf-classroom | 📋 |
| 10 | Editor de diapositivas en aula | cbf-classroom | 📋 |
| 11 | cbf-studio — Motor 2D | cbf-studio | 📋 |
| 12 | cbf-studio — Motor 3D (Three.js) | cbf-studio | 📋 |
| 13 | cbf-student — Vista básica | cbf-student | 📋 |
| 14 | cbf-student — Canvas y entregas | cbf-student | 📋 |
| 15 | Red de colegios — Dashboard | Todas | 📋 |
| 16 | IA con memoria de estudiante | Todas | 📋 |

### Sprint 6 — Pasos inmediatos para arrancar

1. Crear repo `ClassroomsOS/eta-platform` en GitHub
2. Subir scaffold (`eta-platform-v2.zip`) al monorepo
3. Copiar `src/` de `cbf-planner` al monorepo según `MIGRATION.md`
4. Inicializar `cbf-classroom` como app React/Vite
5. Conectar auth de Supabase
6. Primer deploy a `classroomsos.github.io/cbf-classroom`
7. Implementar `classResolver`
8. Construir top bar con píldoras y 5 momentos navegables

---

## 12. PROTOTIPOS HTML — REFERENCIA VISUAL

En la sesión del 21 de abril de 2026 se construyeron tres prototipos HTML standalone que definen la UI objetivo de cbf-classroom. Están disponibles como referencia de diseño:

| Archivo | Descripción | Complejidad |
|---|---|---|
| `cbf_classroom_view.html` | Primera versión: top bar con píldoras, 5 momentos, panel lateral básico | ⭐ |
| `cbf_aula.html` | Entorno completo: pizarra, split screen, editor diapositivas, 4 tabs | ⭐⭐⭐ |
| `eta_classroom_design.html` | Diseño integrado: strip estudiantes, Testigo IA, REC, diseño oscuro avanzado | ⭐⭐⭐⭐⭐ |

**`eta_classroom_design.html` es el target de UX** — lo que Sprint 6–10 debe alcanzar.

### Paleta de diseño (de los prototipos)

```css
--bg: #04060d;
--surface: #090d1a;
--accent: #4361ee;
--accent2: #7209b7;
--accent3: #4cc9f0;
--green: #06d6a0;
--amber: #ffd166;
--red: #ef233c;
--text: #dde4ff;
```

Font principal: `Outfit` (display) + `Space Mono` (monospace/datos)

---

## 13. CLASSROOM FACE — ARQUITECTURA DE OBJETOS (sesión 22 abril)

En la sesión del 22 de abril se estableció el concepto de **Classroom Face**: la capa de presentación del aula modelada como cuatro objetos pedagógicos.

### Los cuatro objetos

| Objeto | Atributos | Estado |
|---|---|---|
| Estudiante | 30 atributos mapeados | ✅ Definido |
| Sesión | 32 atributos mapeados | ✅ Definido |
| Unidad | 38 atributos mapeados | ✅ Definido |
| **Maestro** | — | 🔜 Pendiente |

**Total definido:** 100 atributos en los primeros tres objetos.
**Pendiente:** El Objeto Maestro — sus atributos, capacidades y cómo el sistema lo modela.

### Analogía FIFA (modelo conceptual)

- **Jugador** = Estudiante (atributos medibles: comprensión, producción, participación...)
- **Técnico** = Maestro (repertorio pedagógico, decisiones en tiempo real)
- **Partido** = Sesión de clase (contexto, duración, resultado, incidencias)
- **Liga/Torneo** = Unidad curricular (objetivo mayor, progresión)

El sistema no reemplaza al maestro — lo asiste como un asistente técnico que tiene la estadística.

---

## 14. NOTAS PARA CLAUDE CODE

Al abrir este proyecto en Claude Code, el estado es:

- `cbf-planner` → **producción**, no tocar flujos existentes sin necesidad
- `cbf-classroom` → **construcción desde cero**, usar `eta_classroom_design.html` como referencia visual
- El monorepo `eta-platform` puede no existir aún en GitHub — crearlo si no está
- La Edge Function `claude-proxy` ya existe en Supabase y funciona — no recrear
- El schema de Supabase ya tiene las tablas de Sprints 1–5 — las de Sprint 6 están definidas en la Sección 9 de este documento

### Lo que NO hacer

- No tocar `buildLegacyDocx()` ni el pipeline del formato CBF-G AC-01
- No habilitar `minify: true` en ningún vite.config.js
- No cambiar el modelo de auth existente
- No mezclar imports entre apps del monorepo

### Principio rector

> *"Nosotros diseñamos. El docente enseña."*

Toda decisión técnica se evalúa con esta pregunta: ¿esto reduce la carga cognitiva del docente durante la clase, o se la aumenta?

---

*Generado: 1 de mayo de 2026*
*Basado en sesiones del 21–22 de abril de 2026*
*Edoardo Ortiz + Claude Sonnet · CBF Planner → ETA Platform*
