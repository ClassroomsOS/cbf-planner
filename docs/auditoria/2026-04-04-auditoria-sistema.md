# AUDITORÍA EXHAUSTIVA — CBF PLANNER
**Fecha:** 2026-04-04  
**Modelo:** Claude Opus 4.6 + Claude Sonnet 4.6  
**Líneas de código analizadas:** ~20,015 JSX/JS + 2,643 CSS  
**Estado al momento del análisis:** commit `8690311`

---

## FICHA TÉCNICA

| Dimensión | Valor |
|---|---|
| **Stack** | React 18 + Vite 5 SPA → GitHub Pages |
| **Backend** | Supabase (Auth, PostgreSQL, Storage, Edge Functions, Realtime) |
| **Líneas de código** | ~20,015 (JS/JSX) + 2,643 (CSS) |
| **Archivos fuente** | 64 (.jsx/.js) |
| **Dependencias prod** | 17 paquetes |
| **Tests** | 0 |
| **Deploy** | GitHub Actions → GitHub Pages (push to main) |

---

## I. MAPA DE ARQUITECTURA COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│                    GITHUB PAGES (CDN)                        │
│                   /cbf-planner/ (SPA)                        │
│                   404.html → SPA redirect                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  App.jsx — State Machine (session: undefined/null/object)   │
│  ├── ErrorBoundary (class component, logs a Supabase)       │
│  ├── ToastProvider (context)                                │
│  └── BrowserRouter basename="/cbf-planner"                  │
│       ├── /login      → LoginPage                           │
│       ├── /setup      → ProfileSetupPage                    │
│       ├── /pending    → PendingPage                         │
│       ├── /rejected   → RejectedPage                        │
│       └── /*          → DashboardPage (shell principal)     │
│            ├── FeaturesProvider (feature flags por colegio) │
│            ├── Realtime subscriptions (notifications/msgs)  │
│            └── Routes (15+ páginas)                         │
└─────────────────────────────────────────────────────────────┘
```

### Pages (21 archivos)

| Página | Líneas | Rol |
|---|---|---|
| `GuideEditorPage.jsx` | 1,521 | Editor principal de guías semanales |
| `LearningTargetsPage.jsx` | 1,045 | CRUD de Indicadores de Logro |
| `PlannerPage.jsx` | 1,004 | Pantalla de inicio / crear guía |
| `AdminTeachersPage.jsx` | 670 | Gestión de docentes (admin) |
| `SettingsPage.jsx` | 649 | Panel de control institucional |
| `AgendaPage.jsx` | 569 | Agenda semanal para padres |
| `AIUsagePage.jsx` | 260 | Consumo de IA por docente |
| `NewsPage.jsx` | 342 | Listado de proyectos NEWS |
| `MyPlansPage.jsx` | 339 | Mis guías guardadas |
| `SchedulePage.jsx` | 404 | Horario institucional |
| `NotificationsPage.jsx` | 389 | Notificaciones admin |
| `MessagesPage.jsx` | 293 | Mensajería interna |
| `CalendarPage.jsx` | 317 | Calendario escolar |
| `PrinciplesPage.jsx` | 307 | Principios bíblicos mensuales |
| `CurriculumPage.jsx` | 271 | Malla curricular |
| `DirectorPage.jsx` | 214 | Vista director de grupo |
| `DashboardPage.jsx` | 351 | Shell principal + sidebar + routing |
| `LoginPage.jsx` | — | Auth |
| `ProfileSetupPage.jsx` | — | Setup inicial |
| `PendingPage.jsx` | — | Espera aprobación |
| `RejectedPage.jsx` | — | Cuenta rechazada |

### Components (17 archivos)

| Componente | Líneas | Rol |
|---|---|---|
| `NewsProjectEditor.jsx` | 1,516 | Editor NEWS multi-step (8 pasos) |
| `SmartBlocks.jsx` | 1,339 | 9 tipos de bloques estructurados |
| `AIComponents.jsx` | 524 | Modales de IA (suggest/analyze/generate) |
| `LearningTargetSelector.jsx` | 242 | Selector de indicador |
| `CheckpointModal.jsx` | 244 | Evaluación fin de semana |
| `CorrectionRequestModal.jsx` | 246 | Solicitud de corrección |
| `LayoutSelectorModal.jsx` | 234 | Selector de layout de imágenes |
| `CommentsPanel.jsx` | — | Panel de comentarios en guías |
| `RichEditor.jsx` | — | Editor Tiptap WYSIWYG |
| `ImageUploader.jsx` | — | Upload + compresión de imágenes |
| `SectionPreview.jsx` | — | Preview HTML sanitizado |
| `ProfileModal.jsx` | — | Edición de perfil docente |
| `ErrorBoundary.jsx` | 168 | Crash recovery con log a Supabase |
| `IconButton.jsx` | — | Botón con a11y enforced |
| `news/NewsProjectCard.jsx` | — | Tarjeta de proyecto NEWS |
| `news/NewsTimeline.jsx` | 226 | Línea de tiempo del período |
| `news/NewsWeekBadge.jsx` | — | Badge de semana |

### Utilities (11 archivos)

| Archivo | Líneas | Rol |
|---|---|---|
| `AIAssistant.js` | 779 | 7 funciones IA + proxy Edge Function |
| `exportDocx.js` | 858 | Exportación Word (.docx) |
| `exportRubricHtml.js` | 659 | Rúbrica interactiva HTML |
| `exportHtml.js` | 475 | Exportación HTML + print/PDF |
| `constants.js` | 160 | Constantes globales |
| `roles.js` | 84 | Helpers de roles y permisos |
| `dateUtils.js` | 171 | Utilidades de fecha |
| `validationSchemas.js` | 153 | Schemas Zod + sanitización IA |
| `accessibility.js` | 163 | Helpers a11y (parcialmente usados) |
| `logger.js` | — | logError / logActivity / safeAsync |

### State Management

```
Props drilling  → teacher object: App → Dashboard → 15 páginas
Contexts (2):
  ├── ToastContext    — notificaciones globales
  └── FeaturesContext — feature flags por colegio
Zustand store   → useUIStore.js (CÓDIGO MUERTO — no se usa)
Custom hooks    → 8 definidos, 3 activamente usados
```

### Backend (Supabase)

```
Auth:      email/password (Supabase Auth)
DB:        14+ tablas PostgreSQL con RLS
Storage:   guide-images bucket (logos, imágenes de secciones)
Edge Fn:   claude-proxy (API key server-side, nunca al cliente)
Realtime:  2 channels (notifications, messages)
```

---

## II. HALLAZGOS CRÍTICOS (RIESGO ALTO)

### 🔴 H1. Credenciales Supabase hardcodeadas

**Archivo:** `src/supabase.js:3-4`
```js
const SUPABASE_URL = 'https://vouxrqsiyoyllxgcriic.supabase.co'
const SUPABASE_KEY = 'sb_publishable_lvALYoqrwIge-...'
```

Las credenciales están hardcodeadas en el source code, ignorando `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` que GitHub Actions inyecta en build. `AIAssistant.js:82` sí usa `import.meta.env` correctamente — hay una inconsistencia directa.

**Acción:** Cambiar a `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Verificar que GitHub Secrets estén configurados antes de hacer el cambio.

---

### 🔴 H2. `minify: false` en vite.config.js

**Archivo:** `vite.config.js:8`

El build de producción no minificaba el código. Bundle 2-3x más grande, código fuente legible en producción.

**✅ CORREGIDO** — commit `c0cffd4` (2026-04-04)

---

### 🔴 H3. Año hardcodeado en `ACADEMIC_PERIODS`

**Archivo:** `src/utils/constants.js:38-42`

El año "2026" estaba hardcodeado — se hubiera roto en enero 2027.

**✅ CORREGIDO** — commit `c0cffd4` (2026-04-04). Ahora usa `new Date().getFullYear()`.

---

### 🔴 H4. `loadTeacher` sin manejo de errores

**Archivo:** `src/App.jsx:33-39`

Si la query fallaba, `data` era `null` y el app redirigía a `/setup` indefinidamente sin mostrar error al usuario.

**✅ CORREGIDO** — commit `0cc8583` (2026-04-04). Muestra pantalla de error con botón "Reintentar".

---

### 🔴 H5. XSS en `exportRubricHtml.js`

**Archivo:** `src/utils/exportRubricHtml.js:485, 495, 505, 515`

Datos de rúbrica (`c.name`, `c.desc`, `c.levels`) se insertaban directamente en `innerHTML` sin sanitizar. Un criterio con JavaScript malicioso se ejecutaría al abrir la rúbrica.

**✅ CORREGIDO** — commit `f71f76f` (2026-04-04). Se agregó función `esc()` y se aplica en todos los puntos vulnerables.

---

### 🔴 H6. Protocolos peligrosos en RichEditor links

**Archivo:** `src/components/RichEditor.jsx:95-100`

`window.prompt()` permitía insertar `javascript:`, `vbscript:` o `data:` como URL de enlace sin validación.

**✅ CORREGIDO** — commit `237375e` (2026-04-04). Se bloquean los tres protocolos peligrosos.

---

### 🔴 H7. `compressImage` Promise que nunca rechaza

**Archivo:** `src/components/ImageUploader.jsx:162-183`

Si una imagen falla al cargar, la Promise quedaba pendiente para siempre — la UI se congelaba en estado "uploading" sin salida.

**✅ CORREGIDO** — commit `aa6d953` (2026-04-04). La Promise ahora rechaza con mensaje en 3 casos: timeout (15s), FileReader error, Image error.

---

### 🔴 H8. `.env.local` con SERVICE_ROLE_KEY

El archivo `.env.local` contiene el Supabase Service Role Key — esta key bypasea completamente RLS y tiene acceso total a la DB.

**Acción pendiente:** Verificar que `.env.local` está en `.gitignore`. Si estuvo en el historial de Git, rotar las keys de Supabase inmediatamente.

---

### 🔴 H9. Zero tests

No existe ninguna infraestructura de testing. Sin `jest.config`, `vitest.config`, ni archivos `*.test.js`.

**Impacto:** Cada deploy es un acto de fe. Con 20k líneas de lógica compleja, cualquier refactoring es riesgoso.

**Pendiente — Fase 2.**

---

## III. HALLAZGOS IMPORTANTES (RIESGO MEDIO)

### 🟡 H10. 23 operaciones de escritura sin manejo de errores

El agente de datos encontró 23 operaciones `.insert()`, `.update()`, `.delete()` que no verifican si hubo error. Si la operación falla (RLS, red, concurrencia), el usuario no recibe feedback y la UI queda inconsistente.

**Archivos afectados:** `CommentsPanel`, `MyPlansPage`, `NotificationsPage`, `SettingsPage`, `AgendaPage`, `MessagesPage`, `CalendarPage`, `LearningTargetsPage`, `CheckpointModal`, `CorrectionRequestModal`.

**Pendiente — Fase 1.**

---

### 🟡 H11. Logger utilities sin adoptar

`logger.js` exporta 3 funciones: `logError`, `logActivity`, `safeAsync`. Solo `logError` se usa, y únicamente en 1 archivo (GuideEditorPage). `logActivity` (auditoría) y `safeAsync` (wrapper seguro) son código muerto a pesar de estar bien implementados.

---

### 🟡 H12. Zustand store `useUIStore` — Código 100% muerto

`src/stores/useUIStore.js` — 45 líneas que no se importan en ningún componente. Define `globalLoading`, `toasts`, `sidebarOpen`, `activeModal`, `saveStatus` — todos gestionados por `useState` local o Context.

---

### 🟡 H13. Hooks custom sin adoptar

| Hook | ¿Usado? |
|---|---|
| `useForm` | ❌ No |
| `useAutoSave` | ❌ No (GuideEditor tiene su propio setInterval) |
| `useAsync/useFetch` | ❌ No |
| `usePersistentState` | ❌ No |
| `useToggle` | ✅ Sí |
| `useFocusTrap` | ✅ Sí (6 modales) |
| `useNewsProjects` | ✅ Sí |
| `useRubricTemplates` | ✅ Sí |

---

### 🟡 H14. Schemas de validación Zod sin adoptar

`validationSchemas.js` define schemas para `teacherProfile`, `imageUpload`, `aiInput`, `learningTarget`, `newsProject`, `lessonPlanMeta`. Solo `sanitizeAIInput` e `imageUploadSchema` se usan. Los schemas de NEWS, Learning Target y Lesson Plan no se usan — las validaciones están inline en cada página.

---

### 🟡 H15. CSS monolítico + estilos mixtos

| Métrica | Valor |
|---|---|
| `src/styles/index.css` | 2,643 líneas (un solo archivo) |
| Inline `style={}` en JSX | 651 ocurrencias |
| `className=` en JSX | 627 ocurrencias |

Mezcla 50/50 entre inline styles y clases CSS. Sin CSS modules, sin Tailwind, sin design tokens. Colores hardcodeados en JSX y en CSS por separado.

---

### 🟡 H16. Archivos gigantes sin separación de concerns

| Archivo | Líneas | Problema |
|---|---|---|
| `GuideEditorPage.jsx` | 1,521 | Editor + auto-save + panels + SmartBlock injection + AI + export |
| `NewsProjectEditor.jsx` | 1,516 | 8+ steps del wizard mezclados |
| `SmartBlocks.jsx` | 1,339 | 9 tipos de bloques + preview + interactive en un solo archivo |
| `LearningTargetsPage.jsx` | 1,045 | CRUD + Modelo A/B + auto-creación NEWS + modal |
| `PlannerPage.jsx` | 1,004 | Timeline + selector + checkpoint + calendar queries |

---

### 🟡 H17. Accesibilidad deficiente

| Métrica | Valor |
|---|---|
| Atributos ARIA/role | 30 en todo el codebase |
| Focus trap en modales | ✅ 6 modales (bien) |
| Skip link | ✅ 1 (bien) |
| Screen reader announcements | 0 (utility existe pero no se usa) |
| `accessibility.js` utilities usadas | 1 de 6 |

---

### 🟡 H18. Props drilling profundo

El objeto `teacher` viaja: `App → DashboardPage → 15 páginas`. Si teacher cambia, todos re-renderizan. Solución: `TeacherContext`.

---

### 🟡 H19. Race condition en GuideEditorPage

`contentRef.current` se muta en 5+ lugares. Si el usuario edita rápidamente, el auto-save puede guardar un estado intermedio. No hay optimistic locking ni version check por `updated_at`.

---

### 🟡 H20. `ACADEMIC_PERIODS` con año hardcodeado

✅ **CORREGIDO** — commit `c0cffd4`.

---

### 🟡 H21. CORS permisivo en Edge Function

El proxy de Claude usa `Access-Control-Allow-Origin: *`. Debería restringirse al dominio de producción.

---

## IV. HALLAZGOS DE BAJO RIESGO

### 🟢 H22. Console statements en producción (17)
Mayormente `console.error` en catch blocks — aceptable. No hay `console.log` de debugging. Recomendación: centralizar con `logError()`.

### 🟢 H23. `dateUtils.js` parcialmente adoptado
`parseRelativeDate`, `isPastDate`, `isToday`, `getSchoolWeek` existen pero no se importan en ningún archivo.

### 🟢 H24. Deploy pipeline sin linting ni tests
GitHub Actions hace `npm install → npm run build → deploy`. Sin ESLint, sin tests, sin preview environments. Si un build con errores pasa `vite build`, va directo a producción.

### 🟢 H25. `teacher.full_name` podía ser undefined
`DashboardPage.jsx:150`: `teacher.full_name.split(' ')` crasheaba si `full_name` era null.

✅ **CORREGIDO** — commit `c0cffd4`.

### 🟢 H26. `htmlToText` en AgendaPage usa innerHTML
`AgendaPage.jsx:55`: `div.innerHTML = html` sin sanitizar. Solo extrae `textContent`, pero es frágil.

### 🟢 H27. Parser HTML en exportDocx incompleto
Solo maneja `<p>`, `<div>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`. No soporta `<a>`, `<h1>-<h6>`, colores aplicados. Contenido con formato avanzado se degrada en el DOCX.

---

## V. FORTALEZAS DEL SISTEMA

| Fortaleza | Detalle |
|---|---|
| **Modelo pedagógico sólido** | Cadena Indicador→NEWS→Guía bien implementada |
| **AI integration segura** | API key nunca al cliente, Edge Function proxy |
| **SmartBlocks extensible** | 9 tipos, preview + interactividad exportable |
| **Export dual HTML + DOCX** | Respetan SmartBlocks, imágenes, layouts |
| **ErrorBoundary con auto-log** | Captura crashes, logea a Supabase, recovery UI |
| **Feature flags por colegio** | FeaturesContext con JSONB en Supabase |
| **Realtime bien implementado** | Cleanup apropiado, sin polling |
| **DOMPurify en preview** | Contenido HTML sanitizado antes de renderizar |
| **Roles bien diseñados** | 5 roles con helpers semánticos centralizados |
| **Logging profesional** | logError/logActivity/safeAsync bien diseñados (aunque subutilizados) |
| **Prompt injection prevention** | sanitizeAIInput() en validationSchemas.js |
| **Focus trap en modales** | useFocusTrap() adoptado en 6 modales |

---

## VI. ROADMAP PRIORIZADO

### ✅ FASE 0: COMPLETADA (2026-04-04)

| Fix | Commit |
|---|---|
| minify activado en vite.config.js | `c0cffd4` |
| Año dinámico en ACADEMIC_PERIODS | `c0cffd4` |
| Null-safe full_name en DashboardPage | `c0cffd4` |
| Error handling + reintento en loadTeacher | `0cc8583` |
| XSS fix en exportRubricHtml.js | `f71f76f` |
| Bloqueo protocolos peligrosos en RichEditor | `237375e` |
| compressImage con reject y timeout | `aa6d953` |

### FASE 1: URGENTE (Próximos días)

| # | Tarea | Archivos |
|---|---|---|
| 1 | Verificar .env.local en .gitignore / rotar keys | `.gitignore`, Supabase dashboard |
| 2 | Error handling en 23 escrituras sin catch | CommentsPanel, MyPlansPage, NotificationsPage, SettingsPage, AgendaPage, MessagesPage, CalendarPage, LearningTargetsPage, CheckpointModal, CorrectionRequestModal |
| 3 | Adoptar `safeAsync()` del logger | Mismos archivos |
| 4 | CORS Edge Function → restringir a dominio prod | `supabase/functions/claude-proxy/index.ts` |
| 5 | Sanitizar innerHTML en AgendaPage.jsx:55 | `AgendaPage.jsx` |
| 6 | Fix supabase.js → usar import.meta.env | `src/supabase.js` |
| 7 | Eliminar useUIStore.js (código muerto) | `src/stores/useUIStore.js` |

### FASE 2: TESTING & CI (1 semana)

| # | Tarea |
|---|---|
| 1 | Setup Vitest + tests para dateUtils, roles, constants |
| 2 | Tests para AIAssistant (mock edge function) |
| 3 | Tests para exports (HTML/DOCX snapshots) |
| 4 | CI: npm test + ESLint en deploy workflow |
| 5 | ESLint config con reglas básicas |

### FASE 3: ARQUITECTURA (2-3 semanas)

| # | Tarea | Esfuerzo |
|---|---|---|
| 1 | TeacherContext — eliminar prop drilling | 3 hrs |
| 2 | Partir GuideEditorPage (1521 lns) | 6 hrs |
| 3 | Partir NewsProjectEditor (1516 lns) por steps | 6 hrs |
| 4 | Partir SmartBlocks (1339 lns) por tipo | 4 hrs |
| 5 | CSS: partir index.css (2643 lns) en módulos | 8 hrs |
| 6 | Accesibilidad: ARIA en modales, keyboard nav | 6 hrs |
| 7 | Adoptar Zod schemas en todas las forms | 4 hrs |

### FASE 4: VISIÓN (Largo plazo)

| Tarea | Viabilidad |
|---|---|
| TypeScript migration gradual (.tsx) | **Posible** — Vite lo soporta nativamente |
| Offline support (Service Worker + IndexedDB) | **Posible** — útil para internet intermitente |
| i18n completo ES/EN | **Posible** — react-intl o i18next |
| SCORM/xAPI para SmartBlocks | **Ambicioso** — requiere plataforma LMS |
| Mobile app (Capacitor) | **Imposible sin refactoring** — atado al DOM |
| Multi-school SaaS | **Ya preparado** — school_id scoping es sólido |

---

## VII. MATRIZ DE RIESGOS

```
              IMPACTO
         Bajo    Medio    Alto    Crítico
    ┌────────┬────────┬────────┬─────────┐
Alta│        │  H17   │  H9    │  H1     │
    │        │  a11y  │  tests │  creds  │
P   ├────────┼────────┼────────┼─────────┤
R   │  H22   │  H15   │  H16   │  H8     │
O   │  logs  │  CSS   │  files │  envkey │
B   ├────────┼────────┼────────┼─────────┤
.   │  H23   │  H13   │  H18   │  H10    │
    │  dates │  hooks │  props │  writes |
    ├────────┼────────┼────────┼─────────┤
Baja│  H24   │  H14   │  H19   │         │
    │  CI    │  zod   │  race  │         │
    └────────┴────────┴────────┴─────────┘
```

---

## VIII. INVENTARIO DE TABLAS SUPABASE

| Tabla | Propósito |
|---|---|
| `teachers` | Perfiles. `status`, `role`, `school_id`, `ai_monthly_limit` |
| `schools` | Raíz multi-tenant. `features` JSONB, `year_verse`, `logo_url` |
| `teacher_assignments` | Asignaciones de clase por docente. `schedule` JSONB |
| `lesson_plans` | Una fila por guía. `content` JSONB. Links a `target_id`, `news_project_id` |
| `learning_targets` | Indicadores de Logro del trimestre. `indicadores` JSONB |
| `news_projects` | Proyectos NEWS. `actividades_evaluativas` JSONB, `rubric` JSONB |
| `school_monthly_principles` | Principios rectores por mes. `month_verse`, `indicator_principle` |
| `school_calendar` | Feriados y eventos. `is_school_day`, `affects_planning` |
| `checkpoints` | Evaluación de logro al fin de semana |
| `weekly_agendas` | Agenda semanal por grado/sección |
| `schedule_slots` | Franjas del horario institucional |
| `notifications` / `messages` | Comunicación interna. Event-driven via Realtime |
| `error_log` / `activity_log` | Observabilidad. Escritos por logger.js |
| `ai_usage` | Tracking de consumo IA por docente/mes |
| `plan_comments` | Comentarios en guías |
| `correction_requests` | Solicitudes de corrección |
| `rubric_templates` | Plantillas de rúbricas |

---

## IX. INVENTARIO DE FUNCIONES DE IA

| Función | maxTokens | Propósito |
|---|---|---|
| `suggestSectionActivity()` | 2,000 | Sugerir HTML para una sección |
| `analyzeGuide()` | 4,000 | Análisis pedagógico completo |
| `generateGuideStructure()` | 16,000 | Generar semana completa como JSON |
| `suggestSmartBlock()` | 1,200 | Sugerir un SmartBlock por contexto |
| `generateRubric()` | 4,000 | Rúbrica completa 8 criterios × 5 niveles |
| `generateIndicadores()` | 1,500/2,000 | Indicadores por Modelo A o B |
| `importGuideFromDocx()` | 8,000 | Parsear .docx → CBF lesson_plan JSON |

---

## X. VEREDICTO

El sistema **funciona bien para su estado actual**. Es una SPA educativa con buena lógica de dominio, modelo pedagógico bien pensado, e integración de IA bien protegida. Las fortalezas superan las debilidades.

**Los riesgos reales son operativos, no arquitectónicos.** El año hardcodeado, la falta de tests, y las credenciales en el source son accidentes esperando suceder — no fallas de diseño fundamental.

**Lo que NO hay que hacer:**
- No reescribir en Next.js/TypeScript/Tailwind "porque sí"
- No agregar Redux — el tamaño actual no lo justifica
- No migrar a micro-frontends — equipo pequeño, app coherente

**Lo que SÍ hay que hacer, en orden:**
1. ✅ Fase 0 completada (7 fixes, 2026-04-04)
2. Verificar credenciales y .gitignore
3. Testing básico + CI con lint
4. Refactoring gradual por área

---

*Documento generado automáticamente por auditoría técnica Claude Opus 4.6 + Sonnet 4.6.*  
*Repositorio: `ClassroomsOS/cbf-planner` — branch `main`*
