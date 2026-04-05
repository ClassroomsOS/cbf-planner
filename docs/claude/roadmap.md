# Roadmap y Estado del Proyecto

> Extraído de `CLAUDE.md` + auditoría `docs/auditoria/2026-04-04-auditoria-sistema.md`
> Última actualización: 2026-04-05

---

## Estado por área — Snapshot actual

| Área | Estado | Notas |
|---|---|---|
| Auth / Login | 🔶 A medias | Email+pass ✅ · Google OAuth handler ✅ · Forgot password ❌ · Emails automáticos ❌ |
| Roles y permisos | ✅ Completo | Rector = Coordinador, canManage expandido, badges sidebar |
| Paneles admin | ✅ Completo | SettingsPage limpio, SuperAdminPage, AdminTeachersPage edit+delete |
| Asignaciones RLS | ✅ Completo | Policies para admin + superadmin + rector |
| Toast / UI | ✅ Completo | createPortal, visible sobre modales |
| Agenda semanal | ✅ Completo | Dashboard, generación masiva, AgendaViewer read-only, co-teacher |
| Director de Grupo | ✅ Completo | homeroom_grade/section, flujo propio, vista Agenda |
| Co-teacher | ✅ Completo | coteacher_grade/section, director_absent_until, edición activada por ausencia |
| DirectorPage | ✅ Completo | 3 tabs (Guías/NEWS/Agendas), FeedbackModal |
| Feedback/Revisión | ✅ Parcial | FeedbackModal + document_feedback table. **Falta:** sala-revision, interfaz edición con justificación |
| Tests + CI | ✅ Completo | Vitest 71 tests, CI bloqueante en deploy |
| Error handling | ✅ Completo | 23 escrituras Supabase, safeAsync |
| Seguridad XSS | ✅ Completo | exportRubricHtml esc(), RichEditor protocolos |
| Indicadores / NEWS | ✅ Completo | Modelo A y B, auto-creación NEWS, timelines |
| Guías semanales | ✅ Completo | Editor completo, SmartBlocks, export HTML+DOCX, IA |
| Mensajería | 🔶 Básica | Mensajes 1-a-1 funcionan. Falta: salas grupales |
| Sala de Revisión | ⬜ Pendiente | `/sala-revision` — guías publicadas organizadas por grado |
| Archivado (Fase 5) | ⬜ Pendiente | Snapshot JSON + PDF al publicar, versioning |
| Pipeline imágenes IA | ⬜ Pendiente | Fotos de textbook → multimodal → prompt |
| Refactoring (Fase 3) | ⬜ Pendiente | Archivos grandes, CSS modular, TeacherContext |

---

## Fases de desarrollo

| Fase | Estado | Contenido |
|---|---|---|
| **0** | ✅ | Fixes urgentes: minify, año dinámico, XSS, compressImage, null-safe |
| **1** | ✅ | Error handling 23 escrituras, CORS Edge Fn, env vars, código muerto |
| **2** | ✅ | Vitest 71 tests, CI bloqueante |
| **3** | ⬜ | Refactoring archivos grandes, TeacherContext, CSS modular, a11y |
| **4** | ⬜ | TypeScript gradual, offline support |
| **5** | ⬜ | Persistencia/archivado guías+NEWS, versioning, pipeline imágenes libros |

---

## Próximas tareas — orden de prioridad

### 🔴 Alta prioridad

**Login/Auth completo** (`LoginPage.jsx`, `App.jsx`, Edge Fn `admin-create-teacher`)
1. Configurar Google OAuth en Supabase Dashboard → Auth → Providers → Google
2. Validar dominio `@redboston.edu.co` post-OAuth en `App.jsx:onAuthStateChange`
3. Agregar "Olvidé mi contraseña" en LoginPage → `resetPasswordForEmail()` → `SetPasswordPage` (ya existe)
4. Email automático al crear docente desde `admin-create-teacher` (Supabase SMTP / Resend)

Ver detalles en [`security.md`](security.md).

### 🟡 Media prioridad

**Sala de Revisión de Guías Publicadas** (`/sala-revision`)
- Guías publicadas organizadas por grado
- Coordinador/rector edita con justificación + notificación al docente
- RLS: UPDATE para `admin` y `rector`

**Mensajería expandida**
- `MessagesPage` → chat 1-a-1 completo + salas grupales

### 🟢 Baja prioridad / Fase 3

**Refactoring archivos grandes:**
| Archivo | Líneas | Plan |
|---|---|---|
| `GuideEditorPage.jsx` | ~1521 | Partir en subcomponentes por panel |
| `NewsProjectEditor.jsx` | ~1516 | Partir por steps del wizard |
| `SmartBlocks.jsx` | ~1339 | Un archivo por tipo de bloque |
| `src/styles/index.css` | ~2643 | CSS modules por página/componente |

---

## Features pendientes de diseño — Fase 5

### Archivado de guías y NEWS publicadas
Cuando una guía o proyecto NEWS cambia a `published`:
1. Snapshot JSON inmutable en Supabase Storage: `archives/{school_id}/guides/{plan_id}.json`
2. PDF automático: `archives/{school_id}/pdfs/{plan_id}.pdf`
3. Tabla `archived_versions`: `{ entity_type, entity_id, version, storage_path, archived_at, archived_by }`
4. Campo `locked: bool` en `lesson_plans` y `news_projects` — bloquea edición sin aprobación admin

### Pipeline de imágenes de libros para IA
Cuando el docente sube fotos de textbook en NewsProjectEditor:
1. Bucket: `guide-images/textbook/{school_id}/{news_id}/page_{n}.webp`
2. Compresión automática: max 1200px, WebP, calidad 0.85
3. URLs firmadas → `generateGuideStructure()` como `textbook_pages: [url1, url2, ...]`
4. Prompt: bloque `📖 PÁGINAS DEL LIBRO` con URLs para lectura multimodal
5. UI: sección "Subir páginas del libro" con previsualización y reorden drag

---

## Deuda técnica — NO agravar

| Problema | Archivo | Estado |
|---|---|---|
| GuideEditorPage muy grande | `GuideEditorPage.jsx` (~1521 lns) | Fase 3 |
| NewsProjectEditor muy grande | `news/NewsProjectEditor.jsx` (~1516 lns) | Fase 3 |
| CSS monolítico | `src/styles/index.css` (~2643 lns) | Fase 3 |
| Hooks sin adoptar | `src/hooks/` | Adoptar o eliminar en Fase 3 |
| Props drilling `teacher` | App → 15 páginas | `TeacherContext` en Fase 3 |
| Race condition GuideEditor | `contentRef.current` mutado en 5+ lugares | Fase 3 |
