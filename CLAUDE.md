# CBF PLANNER — ARQUITECTURA COMPLETA v4.0
## CLAUDE.md — Documento maestro unificado

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Este archivo es la memoria permanente del sistema. Léelo completo antes de escribir una línea de código.
> Última actualización: Abril 7, 2026

---

# 🚨🚨🚨 ACCIÓN OBLIGATORIA ANTES DE CUALQUIER OTRA COSA 🚨🚨🚨

## CONFLICTO CRÍTICO DE TABLAS — RESOLVER PRIMERO, SIN EXCEPCIÓN

**NO toques migraciones. NO toques componentes. NO toques hooks. Hasta resolver esto.**

### El problema
Existen DOS tablas de NEWS en Supabase apuntando a lugares distintos:

| Tabla | Creada | Usada por | Estado |
|---|---|---|---|
| `news` | Marzo 30 | `useActiveNews.js` → IA del editor | ⚠️ LEGACY — posiblemente vacía |
| `news_projects` | Marzo 31 | `useNewsProjects.js` → /news UI | ✅ CANÓNICA — esta es la correcta |

**Consecuencia si no se resuelve:** el docente crea un NEWS Project en `/news`
(escribe en `news_projects`), pero la IA del editor lee desde `news` — vacía o con
datos viejos. La IA genera guías sin contexto del proyecto. El sistema pierde coherencia.

---

### Protocolo de resolución — ejecutar en este orden exacto

**PASO 1 — Verificar qué existe en Supabase:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('news', 'news_projects');
```

**PASO 2 — Si la tabla `news` existe, verificar si tiene datos:**
```sql
SELECT COUNT(*) FROM news;
```

**PASO 3A — Si `news` tiene datos (COUNT > 0):**
Crear migración `xxx_migrate_news_to_news_projects.sql` que:
1. Inserte los registros de `news` en `news_projects` mapeando campos
2. Renombre `news` a `news_legacy` (NO borrar — conservar como backup)
3. Continuar al Paso 4

**PASO 3B — Si `news` está vacía (COUNT = 0) o no existe:**
```sql
ALTER TABLE IF EXISTS news RENAME TO news_legacy;
```
Continuar al Paso 4.

**PASO 4 — Actualizar `useActiveNews.js` para leer de `news_projects`:**

| Campo en `news` (viejo) | Campo en `news_projects` (canónico) |
|---|---|
| `is_active` | `status = 'active'` |
| `deadline` | `end_date` |
| `start_date` | `start_date` |
| `deliverable_type` | `deliverable_type` |
| `description` | `description` |

**PASO 5 — Verificar que la IA recibe contexto correcto:**
En `GuideEditorPage.jsx`, confirmar que `useActiveNews` retorna datos reales
de `news_projects` y que `buildNewsPromptContext()` los inyecta en el prompt.

**PASO 6 — Solo después de verificar que todo funciona:**
Continuar con las migraciones de Sesión A.

### Señal de que está resuelto ✅
```
✅ Supabase: news_projects tiene datos, news_legacy existe como backup
✅ useActiveNews.js lee desde news_projects
✅ GuideEditorPage muestra el NEWS activo correcto en el panel de IA
✅ Al generar una guía, la IA menciona el proyecto NEWS del período
```

---


## 🏫 CONTEXTO DEL PROYECTO

```
Institución:   Colegio Boston Flexible (CBF) — Barranquilla, Colombia
               DANE: 308001800455 · Res. 09685/2019
Plataforma:    CBF Planner → ETA Platform (Experiencia Total de Aprendizaje)
Repo:          ClassroomsOS/cbf-planner  (nota: 'ClassroomsOS' con 's' — typo original, no cambiar)
Deploy:        https://classroomsos.github.io/cbf-planner/
Local:         C:\BOSTON FLEX\ClassroomOS\cbf-planner
Supabase ID:   vouxrqsiyoyllxgcriic
School ID:     a21e681b-5898-4647-8ad9-bdb5f9844094
Admin email:   edoardoortiz@redboston.edu.co  (role: admin, status: approved)
Tema 2026:     "AÑO DE LA PUREZA" · Génesis 1:27-28a (TLA)
Escala notas:  1.0–5.0 · Fórmula: (puntaje / total) × 4 + 1
Niveles:       Superior 4.6–5.0 · Alto 4.0–4.5 · Básico 3.0–3.9 · Bajo 1.0–2.9
Textbooks:     Uncover 4 (8°) · Evolve 4 (9°) · Cambridge One (plataforma digital)
```

---

## 🏛️ VISIÓN ETA — LAS 5 CAPAS

```
CAPA 1 — DISEÑO DOCENTE           ← construcción activa (ver estado detallado abajo)
CAPA 2 — PRODUCCIÓN MULTIMEDIA    ← pendiente
CAPA 3 — EXPERIENCIA ESTUDIANTIL  ← pendiente
CAPA 4 — EVALUACIÓN INTEGRADA     ← pendiente
CAPA 5 — INTELIGENCIA PEDAGÓGICA  ← pendiente
```

---

## 🧠 LA CASCADA PEDAGÓGICA COMPLETA

Esta es la ley del sistema. Todo el código debe respetarla.

```
SYLLABUS TOPICS
(contenidos del plan de estudios — por semana, por materia, por grado)
        │
        │  alimenta y secuencia
        ▼
ACHIEVEMENT GOAL — Logro de período
(1 por asignatura por período · enunciado: verbo Bloom + contenido + condición)
        │
        │  se desagrega en 3–4
        ▼
ACHIEVEMENT INDICATORS — Indicadores de logro
  ├── Cognitivo     (saber — comprende, analiza, distingue)
  ├── Procedimental (hacer — produce, presenta, construye)
  ├── Procedimental (hacer — segunda habilidad, ej: oral vs escrito)
  └── Actitudinal   (ser — disposición, revisión, convivencia)
        │
        │  cada indicador jalona exactamente UN
        ▼
NEWS PROJECT — Proyecto de período parcial (2–4 semanas)
  ├── indicator_id      → FK obligatorio al indicador que jalona
  ├── product           → evidencia concreta que el estudiante produce
  ├── rubric            → definida desde el Día 1, versión docente + versión estudiante (A2)
  ├── weight            → % en la nota del período
  └── eleot_coverage    → dominios Cognia que este proyecto puede evidenciar
        │
        │  estructura semana a semana
        ▼
LESSON PLAN — Guía de Aprendizaje Autónomo (semanal · formato CBF-G AC-01 v02)
  ├── news_project_id   → FK al NEWS Project activo
  ├── indicator_id      → heredado del NEWS (pre-fill automático)
  ├── syllabus_topic_id → contenido de esa semana (pre-fill automático)
  ├── smart_blocks      → actividades con tiempo estimado + dominios eleot®
  ├── session_agenda    → generada automáticamente desde los bloques
  └── eleot_coverage    → calculado en tiempo real al diseñar
        │
        │  al finalizar cada semana
        ▼
CHECKPOINT — Reflexión docente semanal
  ├── ¿La mayoría / algunos / pocos alcanzaron el indicador esta semana?
  ├── Observación libre del docente
  └── Desbloquea la creación de la guía de la semana siguiente
        │
        │  al cerrar el NEWS Project
        ▼
EVALUACIÓN — Rúbrica aplicada
  ├── Versión docente:   descriptores técnicos completos
  ├── Versión estudiante: lenguaje A2, visible desde semana 1
  ├── Conversión:        automática → nota 1.0–5.0
  └── Indicador:         marcado como "evaluado" → progreso del logro visible

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
eleot® ENGINE — corre por debajo de todo el sistema
7 dominios · 28 ítems · estándar Cognia de acreditación
Cada Smart Block tiene dominios eleot® asignados internamente.
Cada guía muestra cobertura en tiempo real.
El sistema alerta cuando un dominio está débil en el período.
El DOCX exportado inyecta automáticamente los elementos que
hacen visible cada dominio para el observador de aula.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ✅ ESTADO ACTUAL — LO QUE YA EXISTE EN PRODUCCIÓN

### Capa 1 — Completado

```
✅ Auth + perfil docente + dashboard
✅ GuideEditorPage con 6 secciones + auto-save localStorage
✅ Smart Blocks — 6 tipos: Dictation, Quiz, Vocabulary, Workshop, Speaking, Notice
✅ Export DOCX / HTML / PDF con imágenes, logo institucional, videos embebidos
✅ Preview WYSIWYG inline
✅ Tiptap rich text editor
✅ Image upload → Supabase Storage (bucket: guide-images)
✅ Videos YouTube/Vimeo embebidos por sección
✅ Links en imágenes
✅ Layout selector modal (3 modos: none / stack / side)
✅ Typography profiles (3 perfiles por nivel de grado)
✅ Horario integrado desde teacher_assignments (schedule real en días)
✅ Guías de 1 o 2 semanas según schedule
✅ Multi-week guide support
✅ IA: generar guía, analizar, sugerir por sección (Claude Sonnet via Edge Function)
✅ AIGeneratorModal + AIAssistant utility
✅ ToastContext global (reemplaza window.alert)
✅ ErrorBoundary + logger.js (logError, logActivity, safeAsync)
✅ Sistema de comunicación completo (4 módulos)
✅ Panel de control de features por colegio
✅ Flujo de aprobación de docentes
✅ Logo institucional automático
✅ Gestión de roles admin/teacher
✅ MyPlansPage con preview y duplicación
✅ CalendarPage con datos de festivos
✅ AdminTeachersPage con detección de conflictos
✅ NEWS System Phase 1 + 2 — /news UI completo (desplegado marzo 31)
✅ Tablas: rubric_templates (5 plantillas sembradas) + news_projects
✅ lesson_plans extendido: news_project_id, news_week_number, news_criteria_focus
✅ Smart NEWS dropdowns con cascada desde teacher_assignments
✅ Sidebar reordenado: 🎯 Objetivos → 📋 NEWS → 📝 Nueva Guía → 📂 Mis Guías
✅ Modal fixes: ESC key, confirmación de borrado, CSS grid fix
✅ AI rubric autofill en NewsProjectEditor
✅ RLS bug resuelto: SECURITY DEFINER función get_my_school_id()
✅ Learning Targets (tabla en BD + LearningTargetsPage + selector en editor)
✅ Checkpoints (tabla en BD + CheckpointModal + flujo semana N→N+1)
✅ ANTHROPIC_API_KEY en Supabase Secrets (migrado de Groq)
✅ minify: false en vite.config.js (permanente)
```

### Pendiente de la arquitectura anterior (no olvidar)

```
⏳ Modo conversacional IA
   Estado: infraestructura lista (claude-proxy + AIGeneratorModal)
   Qué falta: modal de 5 pasos + prompt enriquecido con contexto pedagógico completo
   Estimado: 1 sesión (~2 hrs)
   NOTA: con la nueva arquitectura este modo es MUCHO más poderoso — la IA
   ahora tiene: logro + indicador + contenido de la semana + NEWS activo +
   dominios eleot® débiles. Ya no genera en el vacío.

⏳ Gestor de materias
   Estado: no iniciado
   Qué hace: admin agrega/quita materias del catálogo global del colegio
   Importancia: necesario para escalar a otros colegios
   Estimado: 0.5 sesión

⏳ Biblioteca de guías
   Estado: no iniciado
   Qué hace: página donde todos los docentes ven guías aprobadas como referencia
   Importancia: valor institucional + demo para rectores
   Estimado: 0.5 sesión

⏳ Campos Observaciones + Adaptaciones por semana
   Estado: no iniciado
   Qué hace: sección en la guía para notas del docente sobre ajustes realizados
   Importancia: evidencia de diferenciación para eleot® A.1
   Estimado: incluir como Smart Block "Nota docente" en el sprint actual
```

---

## 🗄️ BASE DE DATOS — ARQUITECTURA COMPLETA

### Tablas existentes (no modificar sin revisar primero)

```
teachers          — docentes · RLS via get_my_school_id() SECURITY DEFINER
schools           — instituciones
teacher_assignments — asignaciones materia/grado/sección
lesson_plans      — guías semanales (ya tiene: news_project_id, news_week_number,
                    news_criteria_focus)
news_projects     — proyectos NEWS (extender con indicator_id)
rubric_templates  — 5 plantillas institucionales sembradas
learning_targets  — objetivos de desempeño (Capa anterior — integrar con indicadores)
checkpoints       — reflexiones semanales docente (mantener, integrar al flujo nuevo)
error_log         — errores del sistema
activity_log      — actividad de usuarios
```

### NOTA sobre learning_targets y checkpoints
```
learning_targets existente se integra así:
→ Conceptualmente equivale a achievement_indicators (misma idea, nombre más maduro)
→ Migrar los datos existentes a achievement_indicators
→ Mantener la tabla checkpoints tal cual — sigue siendo válida en la cascada nueva
→ checkpoint.target_id → cambiar FK a achievement_indicators.id
```

### Tablas nuevas — BLOQUE 1: Logros y Contenidos

```sql
-- ─────────────────────────────────────────────────────────
-- ACHIEVEMENT GOALS — Logros de período
-- ─────────────────────────────────────────────────────────
CREATE TABLE achievement_goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    UUID REFERENCES teachers(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  grade         TEXT NOT NULL,
  period        INTEGER NOT NULL CHECK (period BETWEEN 1 AND 4),
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  text          TEXT NOT NULL,
  verb          TEXT,
  bloom_level   TEXT CHECK (bloom_level IN
                  ('remember','understand','apply','analyze','evaluate','create')),
  year_verse    TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject, grade, period, academic_year)
);

-- ─────────────────────────────────────────────────────────
-- ACHIEVEMENT INDICATORS — Indicadores de logro
-- (reemplaza y supera a learning_targets)
-- ─────────────────────────────────────────────────────────
CREATE TABLE achievement_indicators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       UUID REFERENCES achievement_goals(id) ON DELETE CASCADE,
  dimension     TEXT NOT NULL
                CHECK (dimension IN ('cognitive','procedural','attitudinal')),
  -- skill_area: solo para materias de idioma (English).
  -- NULL para materias sin habilidades comunicativas (Science, Cosmovisión, etc.)
  -- Cuando tiene valor → el NEWS Project vinculado pre-selecciona automáticamente
  -- la plantilla de rúbrica institucional correspondiente (Speaking/Listening/Reading/Writing).
  skill_area    TEXT CHECK (skill_area IN ('speaking','listening','reading','writing','general')),
  text          TEXT NOT NULL,
  student_text  TEXT,        -- versión lenguaje A2, generada por IA
  weight        NUMERIC(5,2),
  order_index   INTEGER NOT NULL DEFAULT 1,
  bloom_level   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- SYLLABUS TOPICS — Contenidos del plan de estudios
-- ─────────────────────────────────────────────────────────
CREATE TABLE syllabus_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    UUID REFERENCES teachers(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  grade         TEXT NOT NULL,
  period        INTEGER NOT NULL CHECK (period BETWEEN 1 AND 4),
  week_number   INTEGER,
  topic         TEXT NOT NULL,
  content_type  TEXT NOT NULL CHECK (content_type IN
                  ('grammar','vocabulary','skill','value','concept','other')),
  description   TEXT,
  resources     JSONB DEFAULT '[]',
  -- recursos: [{type:'textbook', ref:'Cambridge Book pp.6-11'},
  --            {type:'cambridge_one', activity:'...'},
  --            {type:'workbook', ref:'pp.5-7'}]
  indicator_id  UUID REFERENCES achievement_indicators(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Modificaciones a tablas existentes

```sql
-- Agregar indicator_id a news_projects
ALTER TABLE news_projects
  ADD COLUMN indicator_id UUID REFERENCES achievement_indicators(id) ON DELETE SET NULL;

-- Agregar FK de syllabus a lesson_plans
ALTER TABLE lesson_plans
  ADD COLUMN syllabus_topic_id UUID REFERENCES syllabus_topics(id) ON DELETE SET NULL,
  ADD COLUMN eleot_coverage     JSONB DEFAULT '{}',
  ADD COLUMN session_agenda     JSONB DEFAULT '[]';

-- Actualizar checkpoints para apuntar a achievement_indicators
-- (migración de datos: learning_targets → achievement_indicators)
ALTER TABLE checkpoints
  ADD COLUMN indicator_id UUID REFERENCES achievement_indicators(id) ON DELETE SET NULL;
-- Luego de migrar datos, deprecar target_id
```

### Tablas nuevas — BLOQUE 2: eleot® Engine

```sql
-- ELEOT DOMAINS — 7 dominios (datos estáticos)
CREATE TABLE eleot_domains (
  id            TEXT PRIMARY KEY,  -- 'A'..'G'
  name          TEXT NOT NULL,
  description   TEXT,
  target_score  NUMERIC DEFAULT 3.5
);

-- ELEOT ITEMS — 28 ítems (datos estáticos)
CREATE TABLE eleot_items (
  id            TEXT PRIMARY KEY,  -- 'A1'..'G3'
  domain_id     TEXT REFERENCES eleot_domains(id),
  order_index   INTEGER NOT NULL,
  text          TEXT NOT NULL,
  tip           TEXT
);

-- ELEOT BLOCK MAPPING — Smart Block → ítems que evidencia
CREATE TABLE eleot_block_mapping (
  block_type    TEXT NOT NULL,
  item_id       TEXT REFERENCES eleot_items(id),
  weight        NUMERIC DEFAULT 1.0,
  PRIMARY KEY (block_type, item_id)
);

-- ELEOT OBSERVATIONS — historial de observaciones recibidas
CREATE TABLE eleot_observations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    UUID REFERENCES teachers(id) ON DELETE CASCADE,
  school_id     UUID REFERENCES schools(id),
  observed_at   TIMESTAMPTZ NOT NULL,
  observer      TEXT,
  subject       TEXT,
  grade         TEXT,
  scores        JSONB NOT NULL,  -- {A1:3, A2:4, B1:3, ...}
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Datos semilla — eleot® (ejecutar en migración)

```sql
-- DOMINIOS
INSERT INTO eleot_domains VALUES
('A','Equitable Learning','Diferenciación, acceso igual, trato justo',3.5),
('B','High Expectations','HOT, desafío alcanzable, autonomía, calidad articulada',3.5),
('C','Supportive Learning','Comunidad, riesgo seguro, pares como recurso',3.5),
('D','Active Learning','Diálogo, conexión real, engagement, colaboración',3.5),
('E','Progress Monitoring','Automonitoreo, feedback, comprensión, evaluación transparente',3.5),
('F','Well-Managed Learning','Respeto, normas, transiciones eficientes, tiempo sin desperdicios',3.5),
('G','Digital Learning','Tecnología para aprender, investigar, crear, colaborar',3.5);

-- ÍTEMS (28)
INSERT INTO eleot_items VALUES
('A1','A',1,'Learners engage in differentiated learning opportunities','Incluye actividades con niveles distintos o instrucciones diferenciadas por sección'),
('A2','A',2,'Learners have equal access to discussions, resources, technology','Todos los estudiantes participan — no solo los mismos siempre'),
('A3','A',3,'Learners are treated in a fair, clear and consistent manner','Las instrucciones son claras para todos'),
('A4','A',4,'Learners demonstrate opportunities to develop empathy/respect','Actividades que involucran perspectivas diversas'),
('B1','B',1,'Learners strive to meet or articulate high expectations','El estudiante puede decir qué nivel de calidad se espera'),
('B2','B',2,'Learners engage in activities that are challenging but attainable','Actividades con dificultad progresiva — zona de desarrollo próximo'),
('B3','B',3,'Learners demonstrate and/or describe high quality work','El estudiante puede mostrar qué es trabajo de alto nivel'),
('B4','B',4,'Learners engage in tasks requiring higher order thinking','Analizar, evaluar, crear — no solo recordar y reproducir'),
('B5','B',5,'Learners take responsibility and are self-directed','Momentos de trabajo autónomo sin depender del docente'),
('C1','C',1,'Learners demonstrate a positive, cohesive, engaged community','El ambiente se siente seguro y de pertenencia'),
('C2','C',2,'Learners take risks without fear of negative feedback','Los errores se tratan como parte del aprendizaje'),
('C3','C',3,'Learners are supported by peers and/or resources to accomplish tasks','Coevaluación, trabajo en pares, apoyo entre compañeros'),
('C4','C',4,'Learners demonstrate a congenial relationship with their teacher','Relación docente-estudiante cálida y de respeto mutuo'),
('D1','D',1,'Learners dialogues/exchanges with each other predominate','El estudiante habla más que el docente'),
('D2','D',2,'Learners make connections from content to real-life experiences','Momento explícito de conexión con la vida real'),
('D3','D',3,'Learners are actively engaged in learning activities','Los estudiantes están haciendo, no solo escuchando'),
('D4','D',4,'Learners collaborate with peers to accomplish tasks','Trabajo en equipo con producto compartido'),
('E1','E',1,'Learners monitor their own progress','Autoevaluación, checklist, rúbrica en mano'),
('E2','E',2,'Learners receive/respond to feedback to improve','Retroalimentación incorporada antes de la entrega final'),
('E3','E',3,'Learners verbalize understanding of content','El estudiante puede explicar lo que aprendió'),
('E4','E',4,'Learners can explain how their work is assessed','⚠ CRÍTICO: el estudiante sabe exactamente cómo lo calificarán'),
('F1','F',1,'Learners speak and interact respectfully','Normas de convivencia visibles y consistentes'),
('F2','F',2,'Learners know and follow classroom rules and expectations','Protocolos de clase interiorizados'),
('F3','F',3,'Learners transition smoothly between activities','Sin tiempo muerto — el estudiante sabe qué sigue'),
('F4','F',4,'Learners use class time purposefully with minimal waste','La guía está clara — tiempo de espera mínimo'),
('G1','G',1,'Learners use digital tools to gather and evaluate information','Investigación, análisis con tecnología'),
('G2','G',2,'Learners use digital tools to research, solve problems or create','Producción digital — no solo consumo'),
('G3','G',3,'Learners use digital tools to communicate or collaborate','Cambridge One, plataformas colaborativas');

-- MAPEO BLOQUES → ítems eleot®
INSERT INTO eleot_block_mapping VALUES
-- Bloques existentes
('dictation','D3',1.0),('dictation','E3',0.8),('dictation','F4',0.7),
('quiz','B2',1.0),('quiz','E1',0.9),('quiz','E3',1.0),('quiz','B4',0.6),
('vocabulary','D3',0.8),('vocabulary','B2',0.7),('vocabulary','E3',0.8),
('workshop','D3',1.0),('workshop','D4',1.0),('workshop','B4',1.0),('workshop','C3',0.8),
('speaking','D1',1.0),('speaking','B4',0.9),('speaking','D3',1.0),('speaking','G3',0.7),
('notice','F4',0.8),('notice','F3',0.7),
-- Bloques nuevos
('reading','D3',0.9),('reading','B4',0.8),('reading','D2',0.7),('reading','E3',0.8),
('writing','D3',1.0),('writing','B4',0.9),('writing','B3',0.8),('writing','E2',0.7),
('self_assessment','E1',1.0),('self_assessment','E2',1.0),('self_assessment','E4',1.0),('self_assessment','B5',0.9),
('peer_review','C3',1.0),('peer_review','E2',0.9),('peer_review','D1',0.8),('peer_review','C2',0.7),
('digital_resource','G1',1.0),('digital_resource','G2',0.8),('digital_resource','D3',0.7),
('collaborative_task','D4',1.0),('collaborative_task','D1',0.9),('collaborative_task','C3',0.8),('collaborative_task','A2',0.7),
('real_life_connection','D2',1.0),('real_life_connection','D3',0.8),('real_life_connection','B4',0.7),
('teacher_note','A1',0.8),('teacher_note','A3',0.7);  -- Observaciones + Adaptaciones
```

---

## 🧩 SMART BLOCKS — CATÁLOGO COMPLETO

### Existentes (extender con: duración + eleot_items + diferenciación)
| Tipo | Propósito | eleot® principales |
|---|---|---|
| `dictation` | Comprensión auditiva, ortografía | D3, E3, F4 |
| `quiz` | Verificación de conocimiento | B2, E1, E3 |
| `vocabulary` | Construcción léxica | D3, B2, E3 |
| `workshop` | Producción guiada | D3, D4, B4, C3 |
| `speaking` | Producción oral | D1, B4, G3 |
| `notice` | Comunicación institucional | F4, F3 |

### Nuevos (construir en este sprint)
| Tipo | Propósito | eleot® principales |
|---|---|---|
| `reading` | Comprensión lectora estructurada | D3, B4, D2, E3 |
| `writing` | Producción escrita con criterios | D3, B4, B3, E2 |
| `self_assessment` | Autoevaluación con checklist del indicador | E1, E2, E4, B5 |
| `peer_review` | Coevaluación entre pares con rúbrica | C3, E2, D1, C2 |
| `digital_resource` | Recurso digital con instrucción y producto | G1, G2, D3 |
| `collaborative_task` | Tarea grupal con roles definidos | D4, D1, C3, A2 |
| `real_life_connection` | Conexión explícita contenido → vida real | D2, D3, B4 |
| `teacher_note` | Observaciones + Adaptaciones del docente | A1, A3 |

### Estructura JSON interna de un bloque
```json
{
  "id": "uuid",
  "type": "workshop",
  "title": "My Past Story — First Draft",
  "duration_minutes": 20,
  "bloom_level": "create",
  "instructions": "...",
  "news_project_ref": true,
  "eleot_items": ["D3", "D4", "B4", "C3"],
  "differentiation": {
    "azul": "...",
    "rojo": "..."
  },
  "real_life_connection": "...",
  "resources": [],
  "assessment_criteria": []
}
```

---

## 📤 EXPORTACIÓN DOCX INTELIGENTE

El DOCX exportado inyecta automáticamente:

```
┌─────────────────────────────────────────┐
│ AGENDA DE HOY (auto-generada)           │
│  5min  Warm-up                          │
│ 10min  Vocabulary pre-teaching          │
│ 20min  Workshop: First Draft            │
│ 10min  Peer Review                      │
│  5min  Self-Assessment checklist        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ OBJETIVO DE ESTA SEMANA                 │
│ [Indicador en lenguaje estudiante A2]   │
│ NEWS activo: "My Past Story"            │
└─────────────────────────────────────────┘
[... bloques de actividades ...]
┌─────────────────────────────────────────┐
│ ¿CÓMO TE VAN A EVALUAR? (eleot E.4)    │
│ [Rúbrica versión estudiante — A2]       │
│ auto-generada desde NEWS Project        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ OBSERVACIONES Y ADAPTACIONES            │
│ [teacher_note blocks si existen]        │
└─────────────────────────────────────────┘
```

---

## 📊 PANEL eleot® EN EL EDITOR

Panel lateral derecho colapsable en `GuideEditorPage`:

```
COBERTURA eleot® — ESTA GUÍA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A Equitable     ████░░  ◎ parcial
B High Expect.  ██████  ✓ cubierto
C Supportive    ██░░░░  ⚠ débil
D Active        █████░  ✓ cubierto
E Progress      ██████  ✓ cubierto
F Well-Managed  █████░  ✓ cubierto
G Digital       ██████  ✓ cubierto
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ C débil — ¿Agregar Peer Review?
[+ Agregar bloque coevaluación]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACUMULADO PERÍODO 1
A 3.4 ↗  B 3.8 ✓  C 2.9 ⚠
D 3.6 ✓  E 3.9 ✓  F 3.5 ✓  G 4.0 ★
Promedio: 3.57 (target: 3.5+)
```

---

## 🔁 FLUJO COMPLETO DEL DOCENTE

### INICIO DE AÑO / PERÍODO (una sola vez)

```
1. Syllabus → Contenidos del período
   Por semana: tema / estructura / habilidad / recurso
   Vinculado al indicador que alimenta

2. Objetivos → Nuevo Logro
   Asignatura + Grado + Período
   Texto: verbo Bloom + contenido + condición
   IA valida el verbo y sugiere mejoras

3. Logro → Agregar Indicadores (3–4)
   Dimensión: cognitiva / procedimental / actitudinal
   Texto técnico + texto versión estudiante (IA genera A2)
   Peso en la nota del período
```

### INICIO DE NEWS PROJECT (cada 2–4 semanas)

```
4. NEWS Projects → Nuevo Proyecto
   Seleccionar indicador → sistema pre-llena logro padre
   Nombre + duración + producto final
   Rúbrica: seleccionar plantilla o crear
   IA sugiere: criterios + rúbrica versión A2 + bloques recomendados
   eleot® preview: dominios que este proyecto puede evidenciar
```

### CADA SEMANA

```
5. Nueva Guía → seleccionar semana
   Sistema detecta NEWS Project activo en esa semana
   Pre-fill automático: logro + indicador + contenido del syllabus
   Diseño con Smart Blocks (tiempo estimado obligatorio)
   Panel eleot® muestra cobertura en tiempo real
   IA sugiere bloque si hay dominio débil
   Exportar DOCX: agenda + rúbrica estudiante + indicador + obs/adaptaciones

6. Al cerrar la semana → Checkpoint
   ¿Mayoría / Algunos / Pocos alcanzaron el indicador?
   Observación libre
   Desbloquea la creación de la próxima guía
```

### CIERRE DEL NEWS PROJECT

```
7. NEWS Project → Evaluar
   Rúbrica aplicada por criterio → nota 1.0–5.0 automática
   Retroalimentación narrativa (IA asistida)
   Indicador marcado como "evaluado"
   Panel Objetivos: barra de progreso del logro del período
```

---

## 🤖 IA — COMPORTAMIENTOS ESPERADOS (Edge Function claude-proxy)

### Endpoint: validate_goal
```json
Input:  { "text": "texto del logro" }
Output: { "is_valid": true, "issues": [...], "suggestion": "...", "bloom_level": "create" }
```

### Endpoint: suggest_rubric
```json
Input:  { "indicator": {...}, "subject": "...", "grade": "...", "product": "..." }
Output: {
  "rubric_criteria": [{"criterion": "...", "weight": 30}, ...],
  "student_rubric": "texto A2 simplificado",
  "suggested_blocks": ["workshop", "peer_review", "self_assessment"],
  "eleot_weak_domains": ["C", "E"],
  "tips": ["Agrega Peer Review para cubrir C.3..."]
}
```

### Endpoint: analyze_coverage
```json
Input:  { "blocks": [...], "indicator": {...}, "week_content": {...} }
Output: {
  "coverage_score": { "A": 2.8, "B": 3.5, "C": 2.1, "D": 3.8, "E": 4.0, "F": 3.5, "G": 4.0 },
  "missing_domains": ["C"],
  "suggestion": "Tu guía no tiene evidencia de C.3. ¿Agregar Peer Review?",
  "session_agenda": ["5min Warm-up", "15min Workshop", ...]
}
```

### Endpoint: generate_guide (modo conversacional — 5 pasos)
```json
Input:  {
  "step1_topic": "Simple Past vs Past Continuous",
  "step2_skill": "writing",
  "step3_level": "A2 — la mayoría va bien, 3 estudiantes necesitan refuerzo",
  "step4_special": "ninguno",
  "step5_emphasis": "práctica guiada antes de producción autónoma",
  "context": {
    "logro": "...", "indicador": "...", "news_project": {...},
    "syllabus_topic": "...", "eleot_weak": ["C"],
    "week_number": 3, "period": 1
  }
}
Output: { "guide_structure": {...}, "blocks": [...], "agenda": [...] }
```

### Endpoint: generate_student_rubric
```json
Input:  { "rubric_criteria": [...], "language_level": "A2" }
Output: { "student_rubric": "En esta tarea serás evaluado en: 1) ..." }
```

---

## 📁 ARCHIVOS A CREAR O MODIFICAR

### BLOQUE 1 — Logros, Indicadores, Syllabus (prioridad máxima)

| Archivo | Tipo | Descripción |
|---|---|---|
| `supabase/migrations/xxx_achievement_goals.sql` | Nuevo | achievement_goals + achievement_indicators con RLS |
| `supabase/migrations/xxx_syllabus_topics.sql` | Nuevo | syllabus_topics con RLS |
| `supabase/migrations/xxx_extend_news_lesson.sql` | Modificación | indicator_id en news_projects · syllabus_topic_id + eleot en lesson_plans |
| `supabase/migrations/xxx_migrate_learning_targets.sql` | Migración | Mueve datos de learning_targets → achievement_indicators · actualiza checkpoints.indicator_id |
| `src/hooks/useAchievements.js` | Nuevo | CRUD logros + indicadores + progreso del período |
| `src/hooks/useSyllabus.js` | Nuevo | CRUD contenidos del syllabus |
| `src/pages/ObjectivesPage.jsx` | Refactorizar | Logros con indicadores anidados + barra de progreso |
| `src/pages/SyllabusPage.jsx` | Nuevo | Gestión de contenidos por semana con drag & drop |
| `src/components/goals/GoalCard.jsx` | Nuevo | Card de logro con indicadores expandibles |
| `src/components/goals/IndicatorList.jsx` | Nuevo | Lista de indicadores con dimensión + peso + estado |
| `src/components/goals/PeriodProgress.jsx` | Nuevo | Barra: cuántos indicadores evaluados / total |
| `src/components/news/NewsProjectEditor.jsx` | Modificar | Selector de indicador + eleot preview + student rubric · **Al seleccionar un indicador con `skill_area` definido → pre-seleccionar automáticamente la plantilla de rúbrica institucional correspondiente** (el dropdown de plantillas se filtra por `skill_area` del indicador) |
| `src/pages/GuideEditorPage.jsx` | Modificar | Pre-fill desde indicador + syllabus + agenda auto |

### BLOQUE 2 — eleot® Engine

| Archivo | Tipo | Descripción |
|---|---|---|
| `supabase/migrations/xxx_eleot_tables.sql` | Nuevo | eleot_domains + eleot_items + eleot_block_mapping + eleot_observations con seed completo |
| `src/hooks/useEleot.js` | Nuevo | Cálculo coverage por guía y por período |
| `src/components/eleot/EleotCoveragePanel.jsx` | Nuevo | Panel lateral en GuideEditor — semáforo tiempo real |
| `src/components/eleot/PeriodCoverageDashboard.jsx` | Nuevo | Vista acumulada del período |
| `src/components/eleot/ObservationLogger.jsx` | Nuevo | Registro de observaciones reales recibidas |

### BLOQUE 3 — Smart Blocks nuevos (8)

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/components/blocks/ReadingBlock.jsx` | Nuevo | Comprensión lectora estructurada |
| `src/components/blocks/WritingBlock.jsx` | Nuevo | Producción escrita con criterios |
| `src/components/blocks/SelfAssessmentBlock.jsx` | Nuevo | Autoevaluación con checklist del indicador |
| `src/components/blocks/PeerReviewBlock.jsx` | Nuevo | Coevaluación con rúbrica simplificada |
| `src/components/blocks/DigitalResourceBlock.jsx` | Nuevo | Recurso digital + instrucción + producto esperado |
| `src/components/blocks/CollaborativeTaskBlock.jsx` | Nuevo | Tarea grupal con roles definidos |
| `src/components/blocks/RealLifeConnectionBlock.jsx` | Nuevo | Conexión explícita contenido → vida real |
| `src/components/blocks/TeacherNoteBlock.jsx` | Nuevo | Observaciones y Adaptaciones del docente |

### BLOQUE 4 — Exportación DOCX inteligente

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/utils/DocxExporter.js` | Modificar | Inyecta agenda + rúbrica estudiante + indicador + obs/adaptaciones |
| `src/utils/AgendaGenerator.js` | Nuevo | Genera agenda desde bloques con tiempos |
| `src/utils/StudentRubricGenerator.js` | Nuevo | Convierte rúbrica docente → versión A2 vía IA |

### BLOQUE 5 — Modo conversacional IA (pendiente histórico)

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/components/ConversationalGuideModal.jsx` | Nuevo | Modal 5 pasos con contexto pedagógico completo |
| `supabase/functions/claude-proxy/index.ts` | Modificar | Nuevos endpoints: validate_goal, suggest_rubric, analyze_coverage, generate_guide, generate_student_rubric |

### BLOQUE 6 — Pendientes históricos

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/pages/SubjectManagerPage.jsx` | Nuevo | Admin: agregar/quitar materias del catálogo global |
| `src/pages/GuideLibraryPage.jsx` | Nuevo | Biblioteca de guías aprobadas visible para todos |

---

## 🔐 RLS — REGLAS DE SEGURIDAD

```sql
-- Patrón estándar para todas las tablas nuevas
ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[tabla]_owner" ON [tabla]
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "[tabla]_school" ON [tabla]
  FOR SELECT USING (school_id = get_my_school_id());

-- Tablas estáticas eleot® — lectura pública
CREATE POLICY "eleot_read_all" ON eleot_domains FOR SELECT USING (true);
CREATE POLICY "eleot_items_read_all" ON eleot_items FOR SELECT USING (true);
CREATE POLICY "eleot_mapping_read_all" ON eleot_block_mapping FOR SELECT USING (true);
```

---

## ⚠️ REGLAS CRÍTICAS — NUNCA VIOLAR

```
1.  minify: false en vite.config.js — NUNCA reactivar
2.  Edge Functions: siempre deploy con --no-verify-jwt
3.  RLS en teachers: SIEMPRE usar get_my_school_id() SECURITY DEFINER
4.  JSONB: patrón preferido para datos flexibles
5.  supabase.exe: en raíz del proyecto, en .gitignore
6.  Modelo IA: claude-sonnet-4-20250514 — no cambiar sin avisar
7.  Migraciones: numeradas cronológicamente, nunca editar retroactivamente
8.  Nunca borrar datos de producción sin backup explícito
9.  Checkpoints: mantener tabla existente — solo agregar indicator_id FK
10. learning_targets: migrar datos, no borrar tabla hasta confirmar migración exitosa
```

---

## 🔗 MAPA COMPLETO DE IMPORTS Y RUTAS EXISTENTES

### DashboardPage.jsx — imports canónicos (última versión Sprint 1C)
```javascript
import { useState, useEffect }                    from 'react'
import { Routes, Route, NavLink, useNavigate }    from 'react-router-dom'
import { supabase }                               from '../supabase'

// Páginas existentes
import PlannerPage         from './PlannerPage'
import MyPlansPage         from './MyPlansPage'
import CalendarPage        from './CalendarPage'
import NotificationsPage   from './NotificationsPage'
import AdminTeachersPage   from './AdminTeachersPage'
import AIUsagePage         from './AIUsagePage'
import GuideEditorPage     from './GuideEditorPage'
import MessagesPage        from './MessagesPage'
import SettingsPage        from './SettingsPage'
import LearningTargetsPage from './LearningTargetsPage'   // tabla: learning_targets
import NewsPage            from './NewsPage'               // /news — live

// Páginas NUEVAS a agregar en las próximas sesiones
// import ObjectivesPage      from './ObjectivesPage'      // reemplaza + amplía LearningTargetsPage
// import SyllabusPage        from './SyllabusPage'
// import SubjectManagerPage  from './SubjectManagerPage'
// import GuideLibraryPage    from './GuideLibraryPage'

// Componentes
import ProfileModal from '../components/ProfileModal'

// Contexts
import { FeaturesProvider, useFeatures } from '../context/FeaturesContext'
import { ToastProvider }                 from '../context/ToastContext'
```

### DashboardPage.jsx — rutas existentes (Routes completas)
```jsx
<Routes>
  <Route path="/"           element={<PlannerPage          teacher={teacher} />} />
  <Route path="/plans"      element={<MyPlansPage          teacher={teacher} />} />
  <Route path="/editor/:id" element={<GuideEditorPage      teacher={teacher} />} />
  <Route path="/news"       element={<NewsPage             teacher={teacher} />} />
  <Route path="/targets"    element={<LearningTargetsPage  teacher={teacher} />} />
  <Route path="/ai-usage"   element={<AIUsagePage          teacher={teacher} />} />
  <Route path="/messages"   element={<MessagesPage         teacher={teacher} onUpdate={fetchUnreadMessages} />} />
  {isAdmin && (
    <>
      <Route path="/calendar"      element={<CalendarPage      teacher={teacher} />} />
      <Route path="/notifications" element={<NotificationsPage teacher={teacher} onRead={() => setUnread(0)} />} />
      <Route path="/teachers"      element={<AdminTeachersPage teacher={teacher} />} />
      <Route path="/settings"      element={<SettingsPage      teacher={teacher} />} />
    </>
  )}
</Routes>

// RUTAS NUEVAS a agregar (sprint activo):
// <Route path="/objectives"  element={<ObjectivesPage   teacher={teacher} />} />
// <Route path="/syllabus"    element={<SyllabusPage     teacher={teacher} />} />
// <Route path="/library"     element={<GuideLibraryPage teacher={teacher} />} />
// <Route path="/guide-chat"  element={<ConversationalGuideModal teacher={teacher} />} />
// Admin nuevos:
// <Route path="/subjects"    element={<SubjectManagerPage teacher={teacher} />} />
```

### DashboardPage.jsx — estructura de providers (CRÍTICO — no romper)
```jsx
// El patrón Provider/Inner es obligatorio para evitar el bug de useFeatures
// (useFeatures no puede llamarse en el mismo componente que define FeaturesProvider)

export default function DashboardPage({ session, teacher, setTeacher }) {
  return (
    <FeaturesProvider schoolId={teacher.school_id}>
      <ToastProvider>
        <DashboardInner session={session} teacher={teacher} setTeacher={setTeacher} />
      </ToastProvider>
    </FeaturesProvider>
  )
}

function DashboardInner({ session, teacher, setTeacher }) {
  // ← aquí sí se puede llamar useFeatures() y useToast()
  const { features } = useFeatures()
  // ...
}
```

### Sidebar — orden canónico (pedagógico, confirmado)
```
GRUPO PLANIFICACIÓN:
  🎯 Objetivos      → /objectives  (LearningTargetsPage hoy, ObjectivesPage próximo sprint)
  📋 NEWS Projects  → /news
  📝 Nueva Guía     → /  (PlannerPage)
  📂 Mis Guías      → /plans

GRUPO HERRAMIENTAS:
  💬 Mensajes       → /messages   (si features.messages !== false)
  🤖 Uso de IA      → /ai-usage

GRUPO ADMIN (solo isAdmin):
  👥 Docentes       → /teachers
  🔔 Notificaciones → /notifications
  📅 Calendario     → /calendar
  ⚙️ Panel control  → /settings
```

### Hooks existentes
```javascript
// src/hooks/
useNewsProjects.js      // CRUD news_projects
useRubricTemplates.js   // CRUD rubric_templates (5 plantillas sembradas)
useActiveNews.js        // Resuelve el NEWS activo para subject/grade/period
                        // Exporta: { news, loading, weekContext }
                        // Exporta también: buildNewsPromptContext(news, weekContext)

// src/context/
FeaturesContext.jsx     // { features, loading, updateFeature }
ToastContext.jsx        // { showToast(message, type) }

// src/utils/
AIAssistant.js          // suggestSectionActivity(sectionType, content, target, newsContext)
                        // generateGuideStructure(params, newsContext)
                        // Llama a Edge Function: claude-proxy
```

### Componentes NEWS existentes
```javascript
// src/components/news/
NewsProjectEditor.jsx   // Modal editor — 3 tabs: Proyecto / Textbook / Rúbrica
                        // ESC key handler ✅ (Sprint 1C)
                        // Smart dropdowns desde teacher_assignments ✅
NewsProjectCard.jsx     // Card con status, timeline, acciones
NewsTimeline.jsx        // Vista visual del período
NewsWeekBadge.jsx       // Badge semana actual en editor
```

### Componentes Learning Targets existentes
```javascript
// src/pages/
LearningTargetsPage.jsx       // página completa CRUD

// src/components/
LearningTargetSelector.jsx    // selector con matching grade/group

// NOTA: learning_targets → se migran a achievement_indicators
// LearningTargetsPage → se reemplaza por ObjectivesPage (más potente)
// LearningTargetSelector → se refactoriza para usar achievement_indicators
```

### Componentes de sistema existentes
```javascript
// src/components/
ProfileModal.jsx              // editar perfil docente
CheckpointModal.jsx           // reflexión semanal — aparece al crear guía nueva
                              // si la semana anterior no tiene checkpoint
ErrorBoundary.jsx             // captura crashes de React — wrappea toda la app en App.jsx

// src/utils/
logger.js                     // logError(), logActivity(), safeAsync()
                              // escribe en error_log y activity_log en Supabase
DocxExporter.js               // exportación Word — MODIFICAR en sprint exportación
```

### App.jsx — estructura base
```jsx
// App.jsx wrappea todo con ErrorBoundary y el router
// El auth flow es:
//   /login → LoginPage
//   /register → RegisterPage
//   /setup → SetupPage (perfil incompleto)
//   /pending → PendingPage (esperando aprobación admin)
//   /* → DashboardPage (autenticado + aprobado)
```

---

## ⚠️ INCOHERENCIAS RESUELTAS EN ESTA VERSIÓN

### 1. LearningTargetsPage vs ObjectivesPage
**Problema:** El CLAUDE.md v3 mencionaba "refactorizar ObjectivesPage" pero en el código
la ruta `/targets` apunta a `LearningTargetsPage`. No existe aún `ObjectivesPage.jsx`.
**Resolución:** Mantener `/targets → LearningTargetsPage` hasta que se construya
`ObjectivesPage.jsx` en Sesión A. Al construirla, agregar ruta `/objectives` y
eventualmente redirigir `/targets → /objectives`. NO borrar LearningTargetsPage
hasta confirmar migración de datos learning_targets → achievement_indicators.

### 2. Checkpoints — FK a actualizar
**Problema:** `checkpoints.target_id` apunta a `learning_targets.id`. Con la migración,
debe apuntar a `achievement_indicators.id`.
**Resolución:** En la migración `xxx_migrate_learning_targets.sql`:
  1. Copiar datos de learning_targets → achievement_indicators (preservar IDs si es posible)
  2. Agregar columna `checkpoints.indicator_id` con FK a achievement_indicators
  3. Poblar indicator_id desde target_id via JOIN
  4. Deprecar (no borrar aún) target_id

### 3. useActiveNews vs news vs news_projects — dos tablas
**Problema:** Hay DOS implementaciones de NEWS:
  - `news` (tabla vieja, del chat "Continuando con el proyecto" marzo 30) — useActiveNews.js la usa
  - `news_projects` (tabla nueva, Phase 1 arquitectura, marzo 31) — useNewsProjects.js la usa
**Resolución:** `news_projects` ES la tabla canónica. `useActiveNews.js` debe actualizarse
para leer desde `news_projects`, no desde `news`. Verificar en Supabase si la tabla `news`
existe — si sí, migrar datos y deprecarla. La tabla `news_projects` tiene la arquitectura
completa correcta con rubric_templates.

---

## 💻 COMANDOS DE TRABAJO

```bash
cd "C:\BOSTON FLEX\ClassroomOS\cbf-planner"

# Desarrollo local
npm run dev                    # localhost:5173/cbf-planner/

# Deploy producción
git add .
git commit -m "feat: descripción clara"
git push                       # deploy automático ~2 min

# Edge Functions
.\supabase.exe functions deploy claude-proxy --no-verify-jwt

# Migraciones
.\supabase.exe db push         # aplica migraciones pendientes

# Ver logs en tiempo real
.\supabase.exe functions logs claude-proxy
```

---

## 🗺️ ORDEN DE EJECUCIÓN — PRÓXIMAS SESIONES

```
SESIÓN A — Logros + Indicadores + Syllabus (fundamento de todo)
  1. Migración: achievement_goals + achievement_indicators (RLS)
  2. Migración: syllabus_topics (RLS)
  3. Migración: FK indicator_id en news_projects
  4. Migración: migrar learning_targets → achievement_indicators
  5. Migración: extend lesson_plans (syllabus_topic_id, eleot_coverage, session_agenda)
  6. useAchievements.js + useSyllabus.js hooks
  7. ObjectivesPage.jsx refactorizada con barra de progreso
  8. SyllabusPage.jsx nueva

SESIÓN B — Integración en editor y NEWS
  9.  NewsProjectEditor.jsx — selector de indicador + eleot preview
  10. GuideEditorPage.jsx — pre-fill desde indicador + syllabus
  11. CheckpointModal — actualizar FK a achievement_indicators

SESIÓN C — eleot® Engine
  12. Migración: eleot_* tables con seed completo (28 ítems)
  13. useEleot.js hook — cálculo coverage
  14. EleotCoveragePanel.jsx — semáforo en tiempo real en el editor

SESIÓN D — Smart Blocks nuevos
  15. Reading, Writing, SelfAssessment, PeerReview
  16. DigitalResource, CollaborativeTask, RealLifeConnection, TeacherNote
  17. Agregar duración_minutes a bloques existentes

SESIÓN E — Exportación inteligente + IA conversacional
  18. AgendaGenerator.js + StudentRubricGenerator.js
  19. DocxExporter.js — inyección completa
  20. claude-proxy — nuevos endpoints IA
  21. ConversationalGuideModal.jsx — modal 5 pasos

SESIÓN F — Pendientes históricos
  22. SubjectManagerPage.jsx — gestor de materias
  23. GuideLibraryPage.jsx — biblioteca de guías
  24. PeriodCoverageDashboard.jsx + ObservationLogger.jsx
```

---

## 📊 ESTADO COMPLETO — CAPA 1

```
COMPLETADO ✅
  Auth + perfiles + dashboard
  GuideEditor + auto-save + Tiptap + Smart Blocks (6) + layouts
  Export DOCX/HTML/PDF + imágenes + logo + videos + links
  IA: generar / analizar / sugerir (Claude Sonnet)
  Horario real + guías 1-2 semanas
  Sistema comunicación (4 módulos)
  Panel control + aprobación docentes
  NEWS System completo (Phase 1+2) — /news UI live
  5 plantillas rúbricas institucionales
  Sidebar pedagógico + Modal fixes + ToastContext
  AI rubric autofill + Smart NEWS dropdowns
  Learning Targets + Checkpoints (integrar al flujo nuevo)
  ErrorBoundary + logger.js

SPRINT ACTIVO 🔄
  Logros de período (restaurar + profundizar)
  Indicadores de logro (3 dimensiones)
  Syllabus de contenidos por semana
  eleot® Engine (7 dominios, 28 ítems)
  Smart Blocks nuevos (8 tipos)
  Exportación DOCX inteligente

PENDIENTE ⏳
  Modo conversacional IA (5 pasos)
  Gestor de materias (admin)
  Biblioteca de guías
  Bloques diferenciados Azul/Rojo
  Calendario institucional con cascada
  Agenda semanal automática director de grupo
  PeriodCoverageDashboard
  ObservationLogger (registro obs. recibidas)
```

---

## 🗂 Mapa de Roles — Resumen ejecutivo

> Detalle completo en [`docs/claude/roles.md`](docs/claude/roles.md)

| Perfil | Rol DB | Capacidades clave |
|---|---|---|
| Docente | `teacher` | Guías propias, NEWS propio, mensajes |
| Dir. de grupo | `teacher` + `homeroom_grade` | + Agenda de su grupo |
| Co-teacher | `teacher` + `coteacher_grade` | + Agenda del grupo (editar si ausencia activa) |
| Psicopedagoga | `psicopedagoga` | + Calendario, horario, ver todos los planes |
| Rector | `rector` | = Coordinador completo + vista Director + feedback |
| Coordinador | `admin` | Gestión docentes, roles, feature flags, revisión |
| Superadmin | `superadmin` | Todo + identidad institucional + seguridad |

---

## 🔐 Seguridad — Resumen

> Detalle completo en [`docs/claude/security.md`](docs/claude/security.md)

- Validación dominio email: toggle en `/superadmin` → `schools.features.restrict_email_domain`
- Creación docentes: Edge Fn `admin-create-teacher` → recovery link → `SetPasswordPage`
- **Pendiente:** Google OAuth con validación de dominio post-login, Olvidé mi contraseña, email automático al crear docente

---

## 📚 Historial de sesiones relevantes

**Sesión 2026-04-04 (post-auditoría):**
- `c0cffd4` minify, año dinámico, null-safe full_name · `0cc8583` error handling loadTeacher
- `f71f76f` XSS fix exportRubricHtml · `237375e` bloqueo protocolos RichEditor
- `aa6d953` compressImage con reject+timeout · Fase 1 ✅ · Fase 2 ✅ Vitest 71 tests

**Sesión 2026-04-04 (features):**
- `f4ddc70` PlannerPeriodTimeline + `detectActivityType()` + campo `tier`
- `school_calendar` integrado en NewsProjectEditor: warnings días no laborables

**Sesión 2026-04-05 (agenda + auth + roles):**
- `2aaf2aa` Agenda: generación masiva, cobertura por grado/sección
- `3079d47` Edge Fn `admin-create-teacher` + modal Crear docente
- `bf5fb47` `SetPasswordPage` para recovery link
- `542c5d8` Validación dominio email · `1d2cfaa` Toggle restrict_email_domain
- `7895290` Co-teacher + FeedbackModal + DirectorPage 3 tabs
- `6837ff5` Rename director → rector en todo el sistema

**Sesión 2026-04-05 (paneles admin):**
- `e29180b` Rector = Coordinador en todos los permisos (`roles.js`)
- `aa02d73` Badge de rol en sidebar + editar/eliminar docentes en AdminTeachersPage
- `2931943` SuperAdminPage (`/superadmin`): identidad institucional + seguridad
- `840084e` Fix test canManage rector · `78b54db` Toast con createPortal

**Sesión 2026-04-06 (export + AI bíblico + Virtual Campus):**
- `ccdaf33` Fix `#pdf-tip` oculto en `@media print`
- `f387cce`–`e050193` (sesión anterior): fix encoding UTF-8, logo persistencia, columnas `document_code`/`doc_version`, principio bíblico en AI y export
- `427adfc` Export por jornada para Virtual Campus — `buildDayHtml`, `exportDayHtml`, `getActiveDays`
- `0c2a486` CSS scoped a `.cbf-day` — evita destruir layout del virtual campus al pegar snippet
- `7f22a5e` `type="button"` en todos los botones SmartBlock — evita submit de form en virtual campus
- `3306aa1` Click-outside handler para dropdown export (reemplaza `onMouseLeave` frágil)
- `c571195` `inlineImages()` — todas las imágenes (logo + secciones) se convierten a base64 en HTML/PDF/día. Cero CORS en virtual campus.
- `6bec16f` Acordeón `<details>/<summary>` por día en semana completa — primer día abierto, resto colapsados. Spinner en export por jornada.

**Sesión 2026-04-07 (Sesión A — cascada pedagógica):**
- `ba9b91f` achievement_goals + achievement_indicators (con skill_area) + syllabus_topics
- news_projects + lesson_plans extendidos con indicator_id, syllabus_topic_id, eleot_coverage, session_agenda
- Migración learning_targets → achievement_goals/indicators + news → news_legacy
- useAchievements.js + useSyllabus.js + useActiveNews.js (news_projects canónica)
- ObjectivesPage.jsx + SyllabusPage.jsx + rutas /objectives /syllabus en Dashboard

---

## Detailed Reference

@docs/claude/architecture.md
@docs/claude/ai-integration.md
@docs/claude/data-model.md
@docs/claude/guide-editor.md
@docs/claude/pedagogical-models.md
@docs/claude/roles.md
@docs/claude/security.md
@docs/claude/roadmap.md
@docs/auditoria/2026-04-04-auditoria-sistema.md

---

*CBF Planner · ETA Platform*
*Edoardo Ortiz + Claude Sonnet · Barranquilla, Colombia · 2026*
*"Nosotros diseñamos. El docente enseña."*
*CLAUDE.md v4.0 — Arquitectura unificada — Abril 7, 2026*
