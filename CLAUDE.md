# CLAUDE.md

> **"Nosotros Diseñamos. El docente enseña."**
> El diseño no debe ser abrumador para el profesor. Nosotros diseñamos para ellos.

---

## 🔒 LEY FUNDAMENTAL — NO BORRAR JAMÁS

> **Referencia pedagógica completa:** `theoric mark/CBF_Analisis_Implementacion_Sistema.md`

```
INDICADOR DE LOGRO → PROYECTO NEWS (inmutable al publicar) → GUÍAS SEMANALES → EVALUACIÓN
```

**Reglas no negociables:**
1. El NEWS se crea al inicio del período. Una vez publicado, no se modifica.
2. `news_projects.target_id` es el vínculo más importante de toda la base de datos.
3. El indicador activo de una guía = NEWS con `due_date` más próxima al futuro de esa semana.
4. La IA genera con ese indicador como norte. El docente lo ve read-only.
5. Toda actividad evaluativa DEBE tener `fecha`. El sistema no permite guardar sin ella.
6. **Modelo B = Language Arts, Social Studies, Science, Lingua Skill** (`MODELO_B_SUBJECTS` en `constants.js`). Por ahora solo se trabaja Modelo B.

**Lookup indicador activo (`GuideEditorPage.jsx`):**
- Prioridad 1 — Modelo B: `actividades_evaluativas[].fecha` en días de la guía → indicador por `skill`
- Prioridad 2 — Modelo A + fallback B: `due_date` más próxima → `target_indicador`

---

## ⚠️ Session Checklist

**Al INICIAR:** Lee `.claude-session-checklist.md` + **revisa `OPEN_QUESTIONS.md`** (preguntas de diseño pendientes).
**Al FINALIZAR:** Ejecuta `.claude/session-end-check.sh` y actualiza CLAUDE.md.

## 🤝 Convención de trabajo — OPEN_QUESTIONS.md

`OPEN_QUESTIONS.md` en la raíz es la "segunda pantalla" para preguntas de diseño complejas.

**Cuándo escribir ahí** (NO en el chat):
- Decisiones que afectan múltiples archivos o el modelo de datos
- Preguntas que bloquean un bloque entero de implementación
- Cuando hay 3 o más preguntas relacionadas

**Cuándo preguntar en el chat** (NO en el archivo):
- Preguntas puntuales de 1-2 líneas con respuesta rápida

**Señal en el chat:** cuando haya algo nuevo en OPEN_QUESTIONS.md escribir:
> 📋 **OPEN_QUESTIONS.md actualizado** — [tema breve]

El usuario mantiene el archivo abierto en su editor como panel de auditoría.

## 🚨 Commits obligatorios

**NUNCA salir con cambios sin commitear.**
- Formato: `feat/fix/refactor/docs(scope):` — Scopes: `news`, `ai`, `editor`, `auth`, `export`, `perf`, `a11y`, `agenda`, `roles`
- Scripts: `./.claude/auto-commit.sh "feat(scope): desc"` · `./.claude/session-end-check.sh`

## Commands

```bash
npm run dev / build / preview
supabase functions deploy <fn> --no-verify-jwt
```
Local: `.env.local` con `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

---

## 🔐 Seguridad

### Validación de dominio de email
- **Toggle en `/superadmin` → Seguridad:** `schools.features.restrict_email_domain` (bool, default `true`)
- **Dominio permitido:** `schools.features.email_domain` (string, default `"redboston.edu.co"`)
- **LoginPage** (auto-registro): consulta `schools.features` antes de `signUp`; bloquea si dominio no coincide y restricción activa
- **Edge Function `admin-create-teacher`**: valida dominio contra `schools.features` antes de crear auth user; hace rollback del auth user si falla el insert en `teachers`
- **Para pruebas:** desactivar toggle en `/superadmin` → Seguridad

### Flujo de creación de docentes por admin
```
Admin → Panel Control → Docentes → ➕ Crear docente
      → Edge Function admin-create-teacher (service role key)
      → crea auth user (email_confirm: true) + insert teachers (status: approved)
      → genera recovery link (expira 1h)
      → Admin comparte link → Docente abre → SetPasswordPage
      → supabase.auth.updateUser({ password }) → acceso al sistema
```

### Patrones de seguridad obligatorios
- **Supabase writes** → siempre `{ data, error }`, manejar `error`. Usar `safeAsync()` cuando sea posible.
- **innerHTML** → nunca con datos de usuario/DB. Usar `DOMPurify.sanitize()` en React o `esc()` en HTML generado.
- **Roles** → usar helpers de `roles.js` (`canManage`, `isDirector`, etc.), nunca comparar strings directo.
- **Feature flags** → verificar con `useFeatures()` antes de renderizar funciones opcionales.
- **Edge Functions** → CORS whitelist: `classroomsos.github.io`, `localhost:5173`, `localhost:4173`
- **Links en RichEditor** → protocolos `javascript:`, `vbscript:`, `data:` bloqueados
- **XSS en exportRubricHtml** → función `esc()` en todos los puntos de inserción dinámica

### Protección de guías y NEWS guardadas *(pendiente — Fase 5)*
- Las guías (`lesson_plans.content`) y NEWS (`news_projects`) viven en Supabase DB con RLS.
- **Pendiente:** snapshot/archivado automático al cambiar status a `published`. Guardar PDF o JSON en Supabase Storage bucket `archives/{school_id}/{type}/{id}.json`.
- **Pendiente:** versioning de guías — campo `version int` + tabla `lesson_plan_versions` para auditoría.
- Una guía publicada no debería poder sobreescribirse sin confirmación explícita del admin.

---

## 🔧 Estado Técnico

> **Auditoría completa:** `docs/auditoria/2026-04-04-auditoria-sistema.md` — leer antes de refactoring mayor.

### Patrones obligatorios
- **Fechas** → usar `dateUtils.js`. No hardcodear años, días o meses.
- **Modales** → nunca cerrar con click fuera. Usar `createPortal` si el modal está dentro de un padre clickeable.
- **Logging** → `logError(err, { page, action })` y `logActivity(...)` de `logger.js`.

### Deuda técnica — NO agravar

| Problema | Archivo | Estado |
|---|---|---|
| GuideEditorPage muy grande | `GuideEditorPage.jsx` (~1521 lns) | Fase 3 |
| NewsProjectEditor muy grande | `news/NewsProjectEditor.jsx` (~1516 lns) | Fase 3 |
| CSS monolítico | `src/styles/index.css` (~2643 lns) | Fase 3 |
| Hooks sin adoptar | `src/hooks/` | Adoptar o eliminar |

### Historial de commits relevantes

**Sesión 2026-04-04 (post-auditoría):**
- `c0cffd4` minify, año dinámico, null-safe full_name · `0cc8583` error handling loadTeacher
- `f71f76f` XSS fix exportRubricHtml · `237375e` bloqueo protocolos RichEditor
- `aa6d953` compressImage con reject+timeout · Fase 1 ✅ error handling 23 escrituras Supabase
- Fase 2 ✅ Vitest 71 tests + CI bloqueante

**Sesión 2026-04-04 (features):**
- `f4ddc70` PlannerPeriodTimeline horizontal con `detectActivityType()` y campo `tier`
- `school_calendar` integrado en NewsProjectEditor: warnings días no laborables

**Sesión 2026-04-05 (agenda + auth + roles):**
- `2aaf2aa` Agenda dashboard semanal: 🚀 Generar todas, cobertura por grado/sección, `buildEntriesForPair()`
- `3079d47` Edge Fn `admin-create-teacher` + modal Crear docente en AdminTeachersPage
- `bf5fb47` `SetPasswordPage` para recovery link de docentes creados por admin
- `542c5d8` Validación dominio email en Edge Fn + LoginPage
- `1d2cfaa` Toggle `restrict_email_domain` en Panel de Control → Seguridad + `FeaturesContext`
- `b99cac9` Modal perfil sin scroll horizontal (`overflow-x: hidden`) + ojito 👁 en contraseñas
- AgendaViewer read-only (coordinator + rector pueden ver contenido de agendas)
- Co-teacher con `director_absent_until` (edición activada por ausencia del director)
- `CoteacherEditor` en AdminTeachersPage
- DirectorPage reescrito: 3 tabs (Guías | NEWS | Agendas) + `FeedbackModal`
- `FeedbackModal` nuevo componente con `document_feedback` table
- `roles.js` ampliado: `canGiveFeedback`, `canEditOthersDocs`, `isCoteacherActive`

**Sesión 2026-04-05 (paneles admin):**
- SettingsPage limpio para Coordinador (docentes, franjas, feature flags — sin identidad ni seguridad)
- `2931943` SuperAdminPage nuevo (`/superadmin`): logo, DANE, resolución, dominio email
- DashboardPage: sidebar `🔑 Panel Superadmin` solo para superadmin; ruta `/superadmin` protegida

### Roadmap

| Fase | Estado | Contenido |
|---|---|---|
| 0 | ✅ | Fixes urgentes seguridad y estabilidad |
| 1 | ✅ | Error handling escrituras, CORS, env vars, código muerto |
| 2 | ✅ | Vitest 71 tests, CI bloqueante |
| 3 | ⬜ | Refactoring archivos grandes, TeacherContext, CSS modular, a11y |
| 4 | ⬜ | TypeScript gradual, offline support |
| 5 | ⬜ | Persistencia/archivado guías+NEWS, versioning, pipeline imágenes libros |

---

## 🗂 Mapa de Roles — Decisiones confirmadas

> Detalle completo en `docs/claude/architecture.md`. Este es el resumen ejecutivo.

| Perfil | Rol DB | Flag | Capacidades clave |
|---|---|---|---|
| Docente | `teacher` | — | Guías propias, NEWS propio, mensajes |
| Dir. de grupo | `teacher` | `homeroom_grade/section` | + Agenda de su grupo |
| Co-teacher | `teacher` | `coteacher_grade/section` | + Ver agenda (editar si `director_absent_until` activo) |
| Psicopedagoga | `psicopedagoga` | — | + Calendario, horario, ver todos los planes |
| Rector | `rector` | — | = Coordinador en gestión docentes + vista Director + feedback/revisión |
| Coordinador | `admin` | — | Gestión docentes, roles, feature flags, revisión de documentos |
| Superadmin | `superadmin` | — | Todo lo anterior + identidad institucional + seguridad |

**Decisión confirmada 2026-04-05:** Rector y Coordinador comparten capacidades de gestión de docentes y asignación de roles. En el futuro, Superadmin tendrá toggles para definir diferencias finas.

**Pendiente:** Implementar `canManage` expandido para incluir `rector` — ver `OPEN_QUESTIONS.md` Q1-followup.

### Sala de Revisión de Guías Publicadas *(pendiente — feature nueva)*
Lugar donde descansan las guías publicadas, organizadas por grado. Ambos docente y coordinador/rector pueden editar, corregir, dar feedback y notificar al otro.
- Ruta propuesta: `/published-guides` o `/sala-revision`
- RLS: UPDATE en `lesson_plans` permitido para `admin` y `rector`
- Banner "Estás editando la guía de [docente]" cuando otro perfil edita
- Modal de justificación obligatorio antes de guardar cambios de otro
- Notificación automática al dueño del documento cuando hay cambios o feedback

### Mensajería expandida *(pendiente)*
MessagesPage actual → sala de chat completa: mensajes 1-a-1 + salas grupales.

---

## 📦 Visión — Features Pendientes de Diseño

### Archivado de guías y NEWS publicadas *(Fase 5)*
Cuando una guía o proyecto NEWS cambia a `published`, el sistema debe:
1. Crear un snapshot JSON inmutable en Supabase Storage: `archives/{school_id}/guides/{plan_id}.json`
2. Generar PDF automático y almacenarlo en `archives/{school_id}/pdfs/{plan_id}.pdf`
3. Registrar en tabla `archived_versions`: `{ entity_type, entity_id, version, storage_path, archived_at, archived_by }`
4. Bloquear ediciones posteriores sin aprobación de admin (campo `locked: bool` en `lesson_plans` y `news_projects`)

### Pipeline de imágenes de libros para IA *(Fase 5)*
Cuando el docente sube fotos de páginas de su textbook en NewsProjectEditor:
1. **Bucket:** `guide-images/textbook/{school_id}/{news_id}/page_{n}.webp`
2. **Compresión automática:** igual que `compressImage()` en `ImageUploader.jsx` — max 1200px, WebP, calidad 0.85
3. **Formato para IA:** array de URLs públicas firmadas → se pasan a `generateGuideStructure()` como contexto adicional `textbook_pages: [url1, url2, ...]`
4. **En el prompt:** bloque `📖 PÁGINAS DEL LIBRO` con las URLs para que Claude las lea visualmente (multimodal)
5. **UI en NewsProjectEditor → Step Textbook:** sección "Subir páginas del libro" con previsualización y reorden drag

---

## Detailed Reference

@docs/claude/architecture.md
@docs/claude/ai-integration.md
@docs/claude/data-model.md
@docs/claude/guide-editor.md
@docs/claude/pedagogical-models.md
@docs/auditoria/2026-04-04-auditoria-sistema.md
