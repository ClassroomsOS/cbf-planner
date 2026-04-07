# CBF PLANNER — v4.1
## CLAUDE.md — Documento maestro

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Léelo completo antes de escribir código. · Última actualización: Abril 7, 2026

---

## 🏫 CONTEXTO

```
Institución: Colegio Boston Flexible (CBF) — Barranquilla, Colombia
             DANE: 308001800455 · Res. 09685/2019
Plataforma:  CBF Planner → ETA Platform (Experiencia Total de Aprendizaje)
Repo:        ClassroomsOS/cbf-planner  ('ClassroomsOS' con 's' — typo original, no cambiar)
Deploy:      https://classroomsos.github.io/cbf-planner/
Local:       C:\BOSTON FLEX\ClassroomOS\cbf-planner
Supabase:    vouxrqsiyoyllxgcriic
School ID:   a21e681b-5898-4647-8ad9-bdb5f9844094
Admin:       edoardoortiz@redboston.edu.co (role: admin)
Tema 2026:   "AÑO DE LA PUREZA" · Génesis 1:27-28a (TLA)
Notas:       1.0–5.0 · (puntaje/total)×4+1 · Superior≥4.6 · Alto≥4.0 · Básico≥3.0
Libros:      Uncover 4 (8°) · Evolve 4 (9°) · Cambridge One (digital)
```

---

## 🏛️ VISIÓN ETA — 5 CAPAS

```
CAPA 1 — DISEÑO DOCENTE           ← activa (sprint actual)
CAPA 2 — PRODUCCIÓN MULTIMEDIA    ← pendiente
CAPA 3 — EXPERIENCIA ESTUDIANTIL  ← pendiente
CAPA 4 — EVALUACIÓN INTEGRADA     ← pendiente
CAPA 5 — INTELIGENCIA PEDAGÓGICA  ← pendiente
```

---

## 🧠 LA CASCADA PEDAGÓGICA — LEY DEL SISTEMA

Todo el código debe respetar este flujo. Es la arquitectura pedagógica del sistema.

```
SYLLABUS TOPICS (contenidos por semana, por materia, por grado)
  │ alimenta y secuencia
  ▼
ACHIEVEMENT GOAL — Logro de período (1 por materia/período)
  verbo Bloom + contenido + condición de desempeño
  │ se desagrega en 3–4
  ▼
ACHIEVEMENT INDICATORS — Indicadores de logro
  ├── Cognitivo     (saber — comprende, analiza, distingue)
  ├── Procedimental (hacer — produce, presenta, construye)
  │   └── skill_area: speaking|listening|reading|writing|general|null
  │       Si tiene valor → NEWS hereda plantilla de rúbrica automáticamente
  └── Actitudinal   (ser — disposición, convivencia)
  │ cada indicador jalona exactamente UN
  ▼
NEWS PROJECT — Proyecto de período (2–4 semanas)
  indicator_id → FK al indicador · rubric pre-seleccionada por skill_area
  │ estructura semana a semana
  ▼
LESSON PLAN — Guía semanal (formato CBF-G AC-01 v02)
  news_project_id · indicator_id · syllabus_topic_id (pre-fill automático)
  smart_blocks → duration_minutes + eleot_items · session_agenda auto-generada
  │ al cerrar la semana
  ▼
CHECKPOINT — ¿Mayoría/algunos/pocos alcanzaron el indicador? → desbloquea próxima guía
  │ al cerrar el NEWS Project
  ▼
EVALUACIÓN — Rúbrica aplicada → nota 1.0–5.0 automática · indicador marcado "evaluado"
```

---

## ✅ ESTADO ACTUAL — PRODUCCIÓN

```
COMPLETADO ✅
  Auth + perfiles + dashboard + sidebar pedagógico
  GuideEditor: 6 secciones + auto-save localStorage + Tiptap + layouts + typography
  Smart Blocks (6): Dictation, Quiz, Vocabulary, Workshop, Speaking, Notice
  Export DOCX/HTML/PDF: imágenes base64, logo, videos, CSS scoped (.cbf-day)
  Export Virtual Campus: buildDayHtml / exportDayHtml por jornada
  IA: generar / analizar / sugerir por sección (Claude Sonnet via claude-proxy)
  Horario real desde teacher_assignments + guías 1–2 semanas
  NEWS System: /news UI + news_projects + 5 rubric_templates + AI autofill
  Smart dropdowns desde teacher_assignments + Modal fixes (ESC, confirmación)
  Sistema comunicación (4 módulos) + Mensajes + Notificaciones
  Panel control features + aprobación docentes + AdminTeachersPage
  Roles: admin/superadmin/rector/teacher/co-teacher/psicopedagoga
  Edge Fn admin-create-teacher + SetPasswordPage + validación dominio email
  SuperAdminPage + FeedbackModal + DirectorPage (3 tabs)
  ToastContext (reemplaza window.alert) + ErrorBoundary + logger.js
  Checkpoints: tabla + CheckpointModal + flujo semana N→N+1
  minify: false permanente · ANTHROPIC_API_KEY en Supabase Secrets

SESIÓN A ✅ (2026-04-07 · commit 6ed2f3d)
  achievement_goals + achievement_indicators (con skill_area) en Supabase
  syllabus_topics en Supabase
  news_projects.indicator_id + lesson_plans.(indicator_id, syllabus_topic_id,
    eleot_coverage, session_agenda) en Supabase
  checkpoints.indicator_id FK en Supabase
  learning_targets migrados → achievement_goals/indicators
  news → news_legacy (conflicto de tablas resuelto)
  useAchievements.js · useSyllabus.js · useActiveNews.js (lee news_projects)
  ObjectivesPage.jsx (/objectives): logros + indicadores + barra progreso + badge skill_area
  SyllabusPage.jsx (/syllabus): contenidos por semana

SESIÓN B 🔄 PRÓXIMA
  NewsProjectEditor: selector indicator_id + filtro rubric por skill_area del indicador
  GuideEditorPage: pre-fill indicator + syllabus_topic desde NEWS activo
  CheckpointModal: usar indicator_id (migrar desde target_id legacy)

PENDIENTE ⏳
  Sesión C: eleot® Engine (tablas + seed 28 ítems + useEleot + EleotCoveragePanel)
  Sesión D: Smart Blocks nuevos (8 tipos) + duration_minutes en existentes
  Sesión E: Exportación DOCX inteligente + IA conversacional (5 pasos)
  Sesión F: SubjectManagerPage · GuideLibraryPage · PeriodCoverageDashboard
```

---

## 🗄️ BASE DE DATOS — ESTADO ACTUAL

### Tablas en producción (no modificar sin revisar RLS)

```
teachers              — RLS via get_my_school_id() SECURITY DEFINER
schools               — instituciones + features JSONB
teacher_assignments   — asignaciones materia/grado/sección/horario
lesson_plans          — guías · news_project_id, news_week_number, news_criteria_focus,
                        indicator_id, syllabus_topic_id, eleot_coverage {}, session_agenda []
news_projects         — proyectos NEWS · indicator_id FK → achievement_indicators
rubric_templates      — 5 plantillas institucionales sembradas
achievement_goals     — logros · UNIQUE(teacher_id, subject, grade, period, academic_year)
achievement_indicators— indicadores · dimension + skill_area(speaking|listening|reading|writing|general|null)
syllabus_topics       — contenidos por semana · indicator_id FK
checkpoints           — reflexiones · target_id (legacy) + indicator_id (nuevo)
learning_targets      — LEGACY (migrado — no borrar aún)
news_legacy           — LEGACY (era tabla news — no borrar)
error_log · activity_log
```

### Tablas pendientes — eleot® Engine (Sesión C)

```
eleot_domains       — 7 dominios (A–G), datos estáticos
eleot_items         — 28 ítems (A1–G4), datos estáticos
eleot_block_mapping — Smart Block → ítems + weight
eleot_observations  — historial observaciones Cognia recibidas
```

El seed completo (dominios, 28 ítems, mapeo bloques) está en CLAUDE.md v4.0 en git (commit 0d906da).

---

## 🧩 SMART BLOCKS

### Existentes (extender con duration_minutes + eleot_items en Sesión D)
| Tipo | eleot® principales |
|---|---|
| `dictation` | D3, E3, F4 |
| `quiz` | B2, E1, E3 |
| `vocabulary` | D3, B2, E3 |
| `workshop` | D3, D4, B4, C3 |
| `speaking` | D1, B4, G3 |
| `notice` | F4, F3 |

### Nuevos — Sesión D
| Tipo | eleot® principales |
|---|---|
| `reading` | D3, B4, D2, E3 |
| `writing` | D3, B4, B3, E2 |
| `self_assessment` | E1, E2, E4, B5 |
| `peer_review` | C3, E2, D1, C2 |
| `digital_resource` | G1, G2, D3 |
| `collaborative_task` | D4, D1, C3, A2 |
| `real_life_connection` | D2, D3, B4 |
| `teacher_note` | A1, A3 |

### Estructura JSON de un bloque
```json
{
  "id": "uuid", "type": "workshop", "title": "...",
  "duration_minutes": 20, "bloom_level": "create",
  "instructions": "...", "eleot_items": ["D3","D4","B4","C3"],
  "differentiation": { "azul": "...", "rojo": "..." },
  "resources": [], "assessment_criteria": []
}
```

---

## 🤖 IA — Edge Function `claude-proxy`

**Endpoints activos:** `generate` (guía completa) · `analyze` (sugerir por sección)

**Endpoints pendientes — Sesión E:**
- `validate_goal` → `{ is_valid, issues, suggestion, bloom_level }`
- `suggest_rubric` → `{ rubric_criteria, student_rubric, suggested_blocks, eleot_weak_domains }`
- `analyze_coverage` → `{ coverage_score {A-G}, missing_domains, session_agenda }`
- `generate_guide` → modal 5 pasos con contexto pedagógico completo
- `generate_student_rubric` → rúbrica docente → versión A2

**Modelo:** `claude-sonnet-4-20250514` — no cambiar sin avisar.

---

## 🔐 RLS — PATRÓN ESTÁNDAR

```sql
ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "[tabla]_owner" ON [tabla] FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "[tabla]_school" ON [tabla] FOR SELECT USING (school_id = get_my_school_id());
-- Tablas estáticas eleot® → lectura pública:
CREATE POLICY "eleot_read_all" ON eleot_domains FOR SELECT USING (true);
```

---

## ⚠️ REGLAS CRÍTICAS — NUNCA VIOLAR

```
1. minify: false en vite.config.js — NUNCA reactivar
2. Edge Functions: siempre deploy con --no-verify-jwt
3. RLS teachers: SIEMPRE usar get_my_school_id() SECURITY DEFINER
4. JSONB: patrón preferido para datos flexibles
5. supabase.exe: en raíz del proyecto, en .gitignore
6. Modelo IA: claude-sonnet-4-20250514 — no cambiar sin avisar
7. Migraciones: numeradas cronológicamente, nunca editar una ya ejecutada en prod
8. Nunca borrar datos de producción sin backup explícito
9. learning_targets y news_legacy: LEGACY — no borrar hasta confirmar todo migrado
10. NUNCA usar window.alert — usar showToast() del ToastContext
```

---

## 🗂 ROLES

| Perfil | Rol DB | Capacidades |
|---|---|---|
| Docente | `teacher` | Guías, NEWS, mensajes propios |
| Dir. de grupo | `teacher` + `homeroom_grade` | + Agenda de su grupo |
| Co-teacher | `teacher` + `coteacher_grade` | + Agenda del grupo asignado |
| Psicopedagoga | `psicopedagoga` | + Calendario, horario, ver todos los planes |
| Rector | `rector` | = Admin completo + vista Director + feedback |
| Coordinador | `admin` | Gestión docentes, roles, feature flags |
| Superadmin | `superadmin` | Todo + identidad institucional + seguridad |

**Seguridad pendiente:** Google OAuth con validación dominio · "Olvidé mi contraseña" · email automático al crear docente.

---

## 🔗 CÓDIGO — ESTADO ACTUAL

### DashboardPage.jsx — imports y rutas activas
```javascript
// Páginas activas
import PlannerPage         from './PlannerPage'        // /
import MyPlansPage         from './MyPlansPage'         // /plans
import GuideEditorPage     from './GuideEditorPage'     // /editor/:id
import NewsPage            from './NewsPage'             // /news
import LearningTargetsPage from './LearningTargetsPage' // /targets (legacy — mantener)
import ObjectivesPage      from './ObjectivesPage'      // /objectives ✅ Sesión A
import SyllabusPage        from './SyllabusPage'        // /syllabus  ✅ Sesión A
import AIUsagePage         from './AIUsagePage'         // /ai-usage
import MessagesPage        from './MessagesPage'        // /messages
// Admin: CalendarPage, NotificationsPage, AdminTeachersPage, SettingsPage, SuperAdminPage
// Pendiente: SubjectManagerPage (/subjects), GuideLibraryPage (/library)
```

### Sidebar — orden canónico (pedagógico)
```
PLANIFICACIÓN:
  🎯 Objetivos  → /objectives   (logros + indicadores)
  📚 Syllabus   → /syllabus     (contenidos por semana)
  📋 NEWS       → /news
  📝 Nueva Guía → /
  📂 Mis Guías  → /plans

HERRAMIENTAS: 💬 Mensajes · 🤖 Uso IA

ADMIN: Docentes · Notificaciones · Calendario · Panel control · Superadmin
```

### Hooks
```javascript
// src/hooks/
useAchievements.js    // CRUD achievement_goals + indicators + getPeriodProgress()
useSyllabus.js        // CRUD syllabus_topics · byWeek Map · getTopicsForWeek(week)
useActiveNews.js      // NEWS activo desde news_projects (canónica)
                      // Exporta: { news, loading, weekContext, buildNewsPromptContext }
useNewsProjects.js    // CRUD news_projects
useRubricTemplates.js // CRUD rubric_templates (5 plantillas sembradas)
```

### Componentes clave
```javascript
// news/:  NewsProjectEditor (3 tabs: Proyecto/Textbook/Rúbrica)
//         NewsProjectCard · NewsTimeline · NewsWeekBadge
// system: CheckpointModal · ProfileModal · ErrorBoundary
// utils:  logger.js · DocxExporter.js · AIAssistant.js
// ctx:    FeaturesContext · ToastContext

// NOTA: GoalCard / IndicatorList / PeriodProgress están implementados
//       inline en ObjectivesPage.jsx — NO existen como componentes separados.
```

### Provider pattern — CRÍTICO (no romper)
```jsx
export default function DashboardPage({ session, teacher, setTeacher }) {
  return (
    <FeaturesProvider schoolId={teacher.school_id}>
      <ToastProvider>
        <DashboardInner session={session} teacher={teacher} setTeacher={setTeacher} />
      </ToastProvider>
    </FeaturesProvider>
  )
}
// useFeatures() y useToast() SOLO en DashboardInner, nunca en DashboardPage
```

---

## 💻 COMANDOS

```bash
cd "C:\BOSTON FLEX\ClassroomOS\cbf-planner"
npm run dev                                              # localhost:5173/cbf-planner/
git add . && git commit -m "feat: ..." && git push      # deploy automático ~2 min
.\supabase.exe functions deploy claude-proxy --no-verify-jwt
.\supabase.exe functions logs claude-proxy
```

---

## 🗺️ ORDEN DE EJECUCIÓN

```
SESIÓN A ✅ COMPLETADA (2026-04-07)

SESIÓN B 🔄 PRÓXIMA
  9.  NewsProjectEditor: selector indicator_id + filtro rubric_templates por skill_area
  10. GuideEditorPage: pre-fill indicator + syllabus_topic desde NEWS activo
  11. CheckpointModal: indicator_id reemplaza target_id

SESIÓN C — eleot® Engine
  12. Migración: eleot_domains + eleot_items + eleot_block_mapping + eleot_observations
  13. useEleot.js — cálculo coverage por guía y período acumulado
  14. EleotCoveragePanel.jsx — semáforo tiempo real en GuideEditor (panel lateral)

SESIÓN D — Smart Blocks nuevos (8)
  15. Reading · Writing · SelfAssessment · PeerReview
  16. DigitalResource · CollaborativeTask · RealLifeConnection · TeacherNote
  17. Agregar duration_minutes a bloques existentes

SESIÓN E — Exportación + IA conversacional
  18. AgendaGenerator.js + StudentRubricGenerator.js
  19. DocxExporter.js: agenda + rúbrica A2 + indicador + obs/adaptaciones
  20. claude-proxy: validate_goal · suggest_rubric · analyze_coverage · generate_guide
  21. ConversationalGuideModal.jsx — 5 pasos con contexto pedagógico completo

SESIÓN F — Pendientes históricos
  22. SubjectManagerPage — gestor de materias (admin)
  23. GuideLibraryPage — biblioteca de guías aprobadas
  24. PeriodCoverageDashboard + ObservationLogger
```

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

---

*CBF Planner · ETA Platform · Edoardo Ortiz + Claude Sonnet · Barranquilla 2026*
*"Nosotros diseñamos. El docente enseña." · CLAUDE.md v4.1 — Abril 7, 2026*
