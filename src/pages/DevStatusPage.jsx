/**
 * DevStatusPage — Mapa de estado de desarrollo del sistema CBF Planner
 * Solo para uso interno durante el desarrollo. Acceso: admin/superadmin.
 *
 * Cada módulo muestra:
 * - Barra de progreso visual
 * - Estado actual (qué funciona)
 * - Pendientes (qué falta)
 * - Historial de mejoras aplicadas (fecha + descripción)
 *
 * Un módulo "completado" aparece con badge verde y su historial desplegable.
 */

import { useState } from 'react'

// ── Data: estado de cada módulo del sistema ───────────────────────────────────

const MODULES = [
  {
    id: 'auth',
    name: 'Autenticación y Roles',
    icon: '🔐',
    category: 'core',
    progress: 90,
    status: 'active',
    summary: 'Login email+contraseña con validación de dominio. Recuperación de contraseña. Creación de docentes por admin con email de bienvenida (Resend). Perfil completo.',
    works: [
      'Login email + contraseña (signInWithPassword)',
      'Validación de dominio @redboston.edu.co configurable',
      'Recuperación de contraseña con SetPasswordPage',
      'Creación de docentes por admin (Edge Fn admin-create-teacher)',
      'Email de bienvenida HTML con Resend o fallback Supabase SMTP',
      'Roles: teacher · admin · rector · superadmin · psicopedagoga',
      'Helpers de roles en roles.js: canManage, isSuperAdmin, canReadAllPlans…',
    ],
    pending: [
      'Google OAuth — handler existe, falta configurar en Supabase Dashboard → Auth → Providers',
      'Validación de dominio post-OAuth en App.jsx:onAuthStateChange',
    ],
    history: [
      { date: '2026-04-05', reason: 'Expansión de roles', detail: 'Rector = Coordinador completo. canManage expandido a rector + admin + superadmin. Badges de rol en sidebar.' },
      { date: '2026-04-05', reason: 'RLS assignments', detail: 'Policies teacher_assignments expandidas para incluir rector además de admin.' },
      { date: '2026-04-21', reason: 'Email bienvenida', detail: 'Edge Fn admin-create-teacher: si hay RESEND_API_KEY envía email HTML institucional; fallback a inviteUserByEmail de Supabase.' },
    ],
  },
  {
    id: 'cascade',
    name: 'Cascada Pedagógica',
    icon: '🎯',
    category: 'core',
    progress: 100,
    status: 'complete',
    summary: 'Núcleo del sistema. Syllabus → Logros → Indicadores → NEWS → Guías → Checkpoints. Dos modelos: Modelo A (español) y Modelo B (inglés/habilidades).',
    works: [
      'Syllabus Topics por semana con indicator_id FK',
      'Achievement Goals (Logros) — Modelo A y Modelo B',
      'Achievement Indicators con dimensión, skill_area y texto_en',
      'AchievementsPage completo con stats, filtros, CascadePanel, GoalCard, WeightBar',
      'Checkpoints al final de cada período',
      'Vinculación automática guía → logro → indicador',
    ],
    pending: [],
    history: [
      { date: '2026-05-01', reason: 'Rediseño AchievementsPage', detail: 'ObjectivesPage → AchievementsPage. Header degradado navy, 4 stat cards, agrupación por materia+grado, GoalCard coloreado, 3 columnas por dimensión, WeightBar, CompletenessChecklist, CascadePanel, empty state con diagrama.' },
      { date: '2026-04-10', reason: 'Modelo B completo', detail: 'Competencias, operadores intelectuales, 4 habilidades (Speaking/Listening/Reading/Writing), auto-creación de 4 NEWS al crear logro Modelo B.' },
    ],
  },
  {
    id: 'planner',
    name: 'Planificador y Editor de Guías',
    icon: '📝',
    category: 'core',
    progress: 100,
    status: 'complete',
    summary: 'Creación y edición de guías semanales. Guías de 1 o 2 semanas. SmartBlocks, export HTML/DOCX/PDF, IA integrada, vista previa antes de descargar.',
    works: [
      'PlannerPage con selector de duración (1/2 semanas), callout indicador activo, PlannerPeriodTimeline, hitos NEWS',
      'GuideEditorPage: 6 secciones por día (subject/motivation/activity/skill/closing/assignment)',
      'SmartBlocks: 16 tipos con modelos, preview inline y export interactivo',
      'Export: HTML (con interactividad), PDF (print dialog), DOCX CBF, DOCX legacy, Campus Virtual por jornada',
      'Vista previa antes de descargar (modal iframe con imagen inlineada)',
      'IA: suggestSectionActivity, analyzeGuide, generateGuideStructure (JSON → guía completa)',
      'Auto-guardado cada 30s (único intervalo legítimo en la app)',
      'Guías de 2 semanas: nav con Semana 1 / Semana 2',
      'PIAR: acomodaciones inyectadas en generateGuideStructure sin PII',
    ],
    pending: [
      'Pipeline de imágenes de textbook para IA (fotos físicas → multimodal → SmartBlocks)',
      'Refactoring GuideEditorPage.jsx (~1521 líneas) — Fase 3',
    ],
    history: [
      { date: '2026-04-20', reason: 'PIAR en IA', detail: 'GuideEditorPage consulta student_accommodation_plans y pasa acomodaciones por categoría (sin nombres) a generateGuideStructure. ConversationalGuideModal muestra aviso naranja en paso 3.' },
      { date: '2026-04-15', reason: 'Export Virtual Campus', detail: 'buildDayHtml / exportDayHtml: CSS scoped a .cbf-day, SmartBlocks interactivos, imágenes base64, preview modal antes de descargar.' },
      { date: '2026-04-10', reason: 'Preview antes de descargar', detail: 'openExportPreview: modal iframe con buildFn async, inlineImages, botón confirmar diferenciado por formato.' },
    ],
  },
  {
    id: 'news',
    name: 'Proyectos NEWS',
    icon: '🗞️',
    category: 'core',
    progress: 97,
    status: 'active',
    summary: 'Experiencias Significativas de Aprendizaje. CRUD completo con wizard multi-paso, rúbricas, actividades evaluativas, línea de tiempo, archivado de versiones.',
    works: [
      'NewsProjectEditor: wizard 8 pasos (Identificación → Indicador → Marco → Contenido → Fechas → Textbook → Actividades → Línea de Tiempo → Rúbrica)',
      'Actividades evaluativas con % y fecha, indicador visual de totales',
      'Línea de Tiempo: agrupación por semana ISO, hito 🏁 de entrega',
      'Rúbrica CBF: 8 criterios × 5 niveles generada con IA',
      'Export HTML de rúbrica',
      'Auto-creación de 4 proyectos al crear Logro Modelo B',
      'Archivado de versiones: news_project_versions con storage_path (HTML en Storage)',
      'Principio bíblico del indicador: biblical_principle + indicator_verse_ref + biblical_reflection',
    ],
    pending: [
      'Sección educativa en NewsProjectEditor para news_model === "standard" (Modelo A) — Fase 3',
      'Refactoring NewsProjectEditor.jsx (~1516 líneas) — Fase 3',
    ],
    history: [
      { date: '2026-04-15', reason: 'Archivado Fase 5', detail: 'news_project_versions: snapshot HTML inmutable en Supabase Storage. Botón "Archivar versión" en paso Rúbrica.' },
      { date: '2026-04-10', reason: 'Actividades evaluativas', detail: 'actividades_evaluativas JSONB con nombre, descripción, porcentaje y fecha. Paso "Actividades" + "Línea de Tiempo" en el wizard.' },
    ],
  },
  {
    id: 'exams',
    name: 'Módulo de Evaluación',
    icon: '📋',
    category: 'evaluation',
    progress: 100,
    status: 'complete',
    summary: 'Blueprints → sessions → instances por estudiante → ExamPlayerV2 → AI correction → resultados → revisión humana. Sistema antitrampa 5 capas.',
    works: [
      'ExamCreatorPage: wizard Quiz/Examen Final, N versiones, criterios editables, rigor pedagógico',
      'Generación de preguntas con IA por sección (9000 tokens/sección)',
      'ExamPlayerV2: autenticación por email, antitramp 5 capas, fullscreen adaptativo iOS/Desktop',
      'Marca de agua en canvas (nombre + versión + hora, resistente a DevTools)',
      'exam-ai-corrector v3: cola con reintentos, confianza < 0.65 → human review',
      'ExamDashboardPage: gestión blueprints, instancias por roster, monitor en vivo',
      'ExamRevisionPage: revisión humana, corrección manual (human_overrides)',
      'Impresión institucional CBF-G AC-01 (tabla 3×3 exacta)',
      'seededShuffle LCG en examUtils.js — función canónica',
      'Examen Final vs Quiz: EXAM_PRESETS diferenciados',
    ],
    pending: [],
    history: [
      { date: '2026-05-01', reason: 'Quiz vs Examen Final', detail: 'EXAM_PRESETS (quiz/final_lower/final_upper). Wizard diferenciado. Badge en dashboard. 23 tests nuevos (total 161).' },
      { date: '2026-04-25', reason: 'Antitrampa Nivel Máximo', detail: '5 capas: multi-evento, canvas watermark, fullscreen adaptativo, Telegram realtime, matriz pruebas.' },
      { date: '2026-04-22', reason: 'Roster y email auth', detail: 'school_students table. ExamPlayerV2: entry por email @redboston.edu.co. exam-instance-generator auto-roster.' },
    ],
  },
  {
    id: 'library',
    name: 'Biblioteca CBF',
    icon: '📚',
    category: 'resources',
    progress: 80,
    status: 'active',
    summary: 'Repositorio de documentos institucionales y personales. Upload, visor universal, compartición, historial con rollback, cuota personal. PDF.js 5, WaveSurfer 7, OpenSeadragon 6.',
    works: [
      'Tabs: Institucional · Personal · Supervisión (admin)',
      'Upload: PDF, imagen, video, audio, MIDI con cuota por docente',
      'Visor universal: PDF.js 5 (canvas page-by-page) · WaveSurfer 7 (waveform) · OpenSeadragon 6 (deep zoom)',
      'Carga lazy de visores (dynamic import — no afecta bundle inicial)',
      'EditModal: editar metadatos + reemplazar archivo',
      'ShareModal: compartir con otro docente (can_edit)',
      'HistoryDrawer: historial de ediciones con rollback via RPC library_rollback',
      'Admin oversight: admin/rector/superadmin ve TODOS los documentos personales del colegio',
      'library_edit_log: triggers automáticos en INSERT y UPDATE',
      'Quota meter visual en sidebar de la Biblioteca',
    ],
    pending: [
      'Fase 3: Integración con Syllabus — selección de páginas PDF asignadas a semana/día, páginas auto-aparecen en GuideEditorPage',
      'Fase 4: IA multimodal — analyzeTextbookPages() — Claude lee páginas seleccionadas y sugiere SmartBlocks',
    ],
    history: [
      { date: '2026-05-09', reason: 'Fase 2 — Visores avanzados', detail: 'PDF.js 5 (canvas page-by-page, CDN worker), WaveSurfer 7 (waveform, API nueva con timeupdate), OpenSeadragon 6 (deep zoom). Lazy loading — bundle sin cambios.' },
      { date: '2026-05-08', reason: 'Fase 1.5 — Compartir e historial', detail: 'library_shares, library_edit_log, RPC library_rollback. EditModal, ShareModal, HistoryDrawer. Admin oversight policy. Skip-log flag para rollback sin log duplicado.' },
      { date: '2026-05-07', reason: 'Fase 1 — Base', detail: 'school_library table, RLS dual (personal/institucional), Storage bucket cbf-library, LibraryPage con tabs, upload con validación de tipo, visor básico, quota meter.' },
    ],
  },
  {
    id: 'grading',
    name: 'Módulo de Calificación',
    icon: '📊',
    category: 'evaluation',
    progress: 70,
    status: 'active',
    summary: 'Sesiones de calificación grupales, micro-actividades evaluables, GradebookPage y QuickGradePage. El módulo funciona pero necesita integración con el flujo principal.',
    works: [
      'GradingHubPage: dashboard de sesiones de calificación',
      'GradingSessionPage: sesión individual con micro-actividades',
      'GradingDisplayPage: vista de calificaciones para mostrar en clase',
      'GradingHistoryPage: historial de sesiones',
      'GradebookPage: libro de calificaciones por asignatura',
      'QuickGradePage: calificación rápida por actividad',
      'grading_sessions + micro_activities + student_activity_grades en DB',
    ],
    pending: [
      'Integración con exam_results para vista unificada de notas',
      'Export de calificaciones a Excel/PDF',
      'Cálculo automático de nota definitiva del período',
      'Notificaciones automáticas a representantes cuando hay calificaciones',
    ],
    history: [
      { date: '2026-04-28', reason: 'Módulo inicial', detail: 'grading_sessions, micro_activities, micro_activity_groups, student_activity_grades. GradingHubPage, GradingSessionPage, GradingDisplayPage, GradingHistoryPage.' },
    ],
  },
  {
    id: 'psicosocial',
    name: 'Módulo Psicosocial',
    icon: '🧠',
    category: 'student',
    progress: 100,
    status: 'complete',
    summary: 'Perfiles psicosociales de estudiantes, seguimiento de observaciones, planes de acomodación PIAR. Notas confidenciales restringidas por rol.',
    works: [
      'PsicosocialPage: lista de estudiantes con semáforo de soporte (verde/amarillo/rojo)',
      'Perfil completo por estudiante: flags, notas del docente, notas confidenciales',
      'student_observations: seguimiento cronológico por estudiante',
      'student_accommodation_plans: acomodaciones JSONB por categoría',
      'Notas confidenciales: solo psicopedagoga, rector y admin',
      'Modo consulta docentes: banner azul, notas confidenciales ocultas',
      'Integración con IA: acomodaciones inyectadas en generateGuideStructure sin PII',
    ],
    pending: [],
    history: [
      { date: '2026-04-25', reason: 'Privacidad notas confidenciales', detail: 'confidential_notes ocultas para role=teacher. Banner azul "Modo consulta". PIAR sin PII en generateGuideStructure.' },
      { date: '2026-04-22', reason: 'Módulo completo', detail: '3 tablas (profiles, observations, accommodation_plans). PsicosocialPage con semáforo, perfil, observaciones y plan de acomodación.' },
    ],
  },
  {
    id: 'students',
    name: 'Roster de Estudiantes',
    icon: '👩‍🎓',
    category: 'student',
    progress: 95,
    status: 'active',
    summary: 'Gestión del padrón de estudiantes por grado y sección. Importación CSV, student_code automático, email único por colegio.',
    works: [
      'StudentsPage: lista por grado/sección con búsqueda',
      'Agregar estudiante uno a uno',
      'Importar CSV (apellido1|apellido2|nombre1|nombre2|grado|sección|email)',
      'Import row-by-row con manejo de conflictos 23505',
      'Ordenamiento por columna (nombre, grado, sección, código)',
      'Eliminación por lotes con confirmación',
      'student_code autogenerado por trigger',
      'displayName: orden apellido-nombre',
      'ObservationLoggerPage: registro rápido de observaciones en clase',
    ],
    pending: [
      'Exportar roster a CSV/PDF',
      'Vista de estudiante con historial académico completo',
      'Integración con StudentPlayerPage para seguimiento individual de progreso',
    ],
    history: [
      { date: '2026-04-25', reason: 'Mejoras CSV y UX', detail: 'CSV reordenado, parser robusto (mínimo 4 cols, email auto), import row-by-row, eliminación por lotes, ordenamiento por columna.' },
      { date: '2026-04-22', reason: 'school_students inicial', detail: 'Tabla school_students con trigger auto-student_code, RLS, índices. StudentsPage con agregar y importar CSV.' },
    ],
  },
  {
    id: 'agenda',
    name: 'Agenda Semanal',
    icon: '📅',
    category: 'schedule',
    progress: 100,
    status: 'complete',
    summary: 'Agenda semanal por grado/sección. Director de grupo, co-teacher, vista AgendaViewer read-only. Generación masiva y status draft/ready/sent.',
    works: [
      'AgendaPage: CRUD completo para director de grupo y admin',
      'Co-teacher: edición activada cuando director_absent_until está activo',
      'Generación masiva de agendas para todos los grados del admin',
      'AgendaViewer: vista read-only para docentes',
      'Status: draft → ready → sent',
      'weekly_agendas con content JSONB por período',
    ],
    pending: [],
    history: [
      { date: '2026-04-10', reason: 'Co-teacher', detail: 'coteacher_grade/section + director_absent_until. isCoteacherActive() helper. Edición habilitada solo durante ausencia del director.' },
    ],
  },
  {
    id: 'sala_revision',
    name: 'Sala de Revisión',
    icon: '🏛️',
    category: 'admin',
    progress: 100,
    status: 'complete',
    summary: 'Cola de guías enviadas para revisión. Coordinador/Rector aprueba, devuelve o publica. Justificación obligatoria, snapshot en Storage, notificación al docente.',
    works: [
      'ReviewRoomPage: acordeón por grado, cola de guías submitted',
      'Actions: Aprobar → submitted→approved, Devolver → returned, Publicar → published',
      'IntentModal: justificación obligatoria al editar guía de otro docente',
      'Snapshot HTML inmutable en Storage al publicar (lesson_plan_versions)',
      'Notificación automática al docente dueño',
      'FeedbackModal: comentarios y feedback sin cambiar el doc',
    ],
    pending: [],
    history: [
      { date: '2026-04-20', reason: 'Sala completa', detail: 'ReviewRoomPage con cola, acordeón, estadísticas. IntentModal. Snapshot HTML en Storage. Notificaciones.' },
    ],
  },
  {
    id: 'messages',
    name: 'Mensajería',
    icon: '💬',
    category: 'communication',
    progress: 50,
    status: 'active',
    summary: 'Mensajes 1-a-1 funcionan con tiempo real vía Supabase Realtime. Salas grupales pendientes.',
    works: [
      'MessagesPage: mensajes 1-a-1 entre docentes',
      'Supabase Realtime: subscriptions en messages y notifications',
      'Badge de mensajes no leídos en sidebar',
      'NotificationsPage: notificaciones in-app con mark-as-read',
    ],
    pending: [
      'Salas grupales (message_rooms, room_messages, room_participants) — tablas listas, UI pendiente',
      'Chat completo con scroll infinito, búsqueda, emojis',
      'Notificaciones push (service worker)',
    ],
    history: [],
  },
  {
    id: 'director',
    name: 'Vista Director',
    icon: '👁️',
    category: 'admin',
    progress: 100,
    status: 'complete',
    summary: 'Rector y Coordinador ven guías de todos los docentes, proyectos NEWS y agendas. FeedbackModal para dejar comentarios sin editar.',
    works: [
      'DirectorPage: 3 tabs (Guías / NEWS / Agendas)',
      'FeedbackModal: comentarios tipificados (aprobado/devuelto/comentario)',
      'canReadAllPlans, canGiveFeedback, canEditOthersDocs — helpers de roles',
      'Banner "Estás editando la guía de [docente]" al entrar a guía ajena',
    ],
    pending: [],
    history: [
      { date: '2026-04-10', reason: 'Vista Director completa', detail: '3 tabs, FeedbackModal, banner de edición de guía ajena, integración con sala de revisión.' },
    ],
  },
  {
    id: 'observability',
    name: 'Observabilidad',
    icon: '📡',
    category: 'system',
    progress: 30,
    status: 'active',
    summary: 'Infraestructura completa (logger.js, cbf-logger Edge Fn, tablas de logs, alertas). Adopción baja — solo ~14% de módulos la usan.',
    works: [
      'logger.js: logError, logActivity, safeAsync',
      'cbf-logger Edge Fn: system_events con error_code, severity, module',
      'error_log + activity_log en DB con RLS',
      'system_alerts + alert_rules para umbral-based alerting',
      'system_health_snapshots periódicos',
      'error_codes: catálogo CBF-[MOD]-[TYPE]-[NNN]',
      'QADashboardPage /qa: panel de logs, errores, alertas, IA, protocolos',
    ],
    pending: [
      'Instrumentar LibraryPage (0 logs actualmente)',
      'Instrumentar AdminTeachersPage (crear/editar/eliminar docentes)',
      'Instrumentar StudentsPage (importar CSV, crear, eliminar)',
      'Instrumentar NewsPage + NewsProjectEditor (CRUD proyectos)',
      'Instrumentar PlannerPage + GuideEditorPage (creación de guías)',
      'Instrumentar AchievementsPage (logros e indicadores)',
      'Instrumentar ReviewRoomPage (aprobar/devolver/publicar)',
      'Instrumentar ExamCreatorPage + ExamDashboardPage + ExamRevisionPage',
      'Instrumentar PsicosocialPage (perfiles y observaciones)',
      'Llamar cbf-logger desde frontend para eventos críticos',
      'Instrumentar claude-proxy con cbf-logger (latencia, tokens, rate limit)',
      'Instrumentar admin-create-teacher con cbf-logger',
    ],
    history: [
      { date: '2026-05-09', reason: 'QA Dashboard + admin RLS', detail: 'QADashboardPage /qa con tabs: Errores, Actividad, Sistema, Alertas, IA, QA Runs, Protocolos. Migración admin RLS para error_log, activity_log, system_events.' },
      { date: '2026-04-21', reason: 'Infraestructura completa', detail: 'cbf-logger Edge Fn v1. system_events, alert_rules, system_health_snapshots, error_codes. CBF Observability Layer v1.0.' },
    ],
  },
  {
    id: 'qa_system',
    name: 'Sistema QA Guiado',
    icon: '🧪',
    category: 'system',
    progress: 85,
    status: 'active',
    summary: 'Verificación guiada paso a paso. Suites de QA ejecutables desde el sidebar. Historial guardado en qa_runs. QA Dashboard para vista global.',
    works: [
      'QAContext: estado de suite activa, markStep, abort, reset',
      'QARunner: panel overlay con paso actual, nota libre, navegación',
      'QASummary: resumen al finalizar con % pass/fail/skip',
      'QALauncher: selector de suites + historial de runs desde Supabase',
      'Suites activas: Dashboard, NEWS, Calendario, Logros',
      'qa_runs en DB con results JSONB, ran_at, runner_id',
      'QADashboardPage: historial global + análisis de fallos',
    ],
    pending: [
      'Suite: Módulo de Evaluación (crear/publicar/jugar/corregir)',
      'Suite: Biblioteca CBF (upload/visor/compartir)',
      'Suite: Módulo de Calificación',
      'Suite: Psicosocial',
      'Suite: Admin (crear docente / asignar / permisos)',
      'Auto-marcado de pasos vía assertions programáticas (opcional, baja prioridad)',
    ],
    history: [
      { date: '2026-05-08', reason: 'QA Dashboard integrado', detail: 'QADashboardPage /qa con tab "QA Runs" muestra historial completo de runs con detalle expandible.' },
      { date: '2026-05-06', reason: 'Suite Logros', detail: 'suite_achievements.js: verificación de AchievementsPage, GoalCard, CascadePanel, IndicatorFormModal.' },
      { date: '2026-05-05', reason: 'QA system inicial', detail: 'QAContext, QARunner, QASummary, QALauncher. Suites: Dashboard, NEWS, Calendario. Guardado en qa_runs.' },
    ],
  },
  {
    id: 'classroom',
    name: 'Aula Virtual (Capa 2)',
    icon: '🖥️',
    category: 'future',
    progress: 5,
    status: 'pending',
    summary: 'Videoclase en vivo con LiveKit. Pizarra virtual, diapositivas, documentos compartidos, presencia automática. Tablas listas en DB, UI pendiente.',
    works: [
      'Tablas en DB: classroom_sessions, classroom_boards, classroom_slides, classroom_documents',
      'LiveKit: livekit_rooms, livekit_participants',
      'presence_events, network_access',
    ],
    pending: [
      'Toda la UI — ClassroomPage, LiveKit integration, pizarra virtual',
      'Detección de presencia automática (asistencia)',
      'Control de acceso de red por estudiante',
      'Grabación de sesiones',
    ],
    history: [],
  },
  {
    id: 'scorm',
    name: 'Experiencia Estudiantil (Capa 3)',
    icon: '🎓',
    category: 'future',
    progress: 2,
    status: 'pending',
    summary: 'Portal del estudiante, entregas, tracking SCORM/xAPI. Proyecto separado — largo plazo.',
    works: [
      'submissions table en DB (entregas de estudiantes)',
      'StudentPlayerPage y StudentDetailPage (seguimiento básico)',
    ],
    pending: [
      'Portal de acceso para estudiantes',
      'Entrega de actividades y tareas',
      'Tracking de completitud de SmartBlocks',
      'SCORM/xAPI — proyecto separado',
    ],
    history: [],
  },
]

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',           label: 'Todo',           icon: '🗂️' },
  { id: 'core',         label: 'Core pedagógico', icon: '📚' },
  { id: 'evaluation',   label: 'Evaluación',      icon: '📋' },
  { id: 'student',      label: 'Estudiantes',     icon: '👩‍🎓' },
  { id: 'resources',    label: 'Recursos',        icon: '📁' },
  { id: 'schedule',     label: 'Horario/Agenda',  icon: '📅' },
  { id: 'admin',        label: 'Admin',           icon: '🏛️' },
  { id: 'communication',label: 'Comunicación',    icon: '💬' },
  { id: 'system',       label: 'Sistema',         icon: '⚙️' },
  { id: 'future',       label: 'Futuro',          icon: '🔮' },
]

const STATUS_META = {
  complete: { label: 'Completo',  color: '#16a34a', bg: '#f0fdf4', bar: '#16a34a' },
  active:   { label: 'En curso',  color: '#2563eb', bg: '#eff6ff', bar: '#3b82f6' },
  pending:  { label: 'Pendiente', color: '#94a3b8', bg: '#f8fafc', bar: '#cbd5e1' },
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ value, color }) {
  return (
    <div className="ds-progress-track">
      <div
        className="ds-progress-fill"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  )
}

// ── ModuleCard ────────────────────────────────────────────────────────────────

function ModuleCard({ mod, isSelected, onClick }) {
  const meta = STATUS_META[mod.status]
  return (
    <div
      className={`ds-module-card ${isSelected ? 'ds-module-card--selected' : ''} ds-module-card--${mod.status}`}
      onClick={onClick}>
      <div className="ds-module-card-header">
        <span className="ds-module-icon">{mod.icon}</span>
        <div className="ds-module-meta">
          <div className="ds-module-name">{mod.name}</div>
          <span className="ds-module-status-badge" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <div className="ds-module-pct">{mod.progress}%</div>
      </div>
      <ProgressBar value={mod.progress} color={meta.bar} />
    </div>
  )
}

// ── ModuleDetail ──────────────────────────────────────────────────────────────

function ModuleDetail({ mod, onClose }) {
  const meta = STATUS_META[mod.status]
  const [histOpen, setHistOpen] = useState(mod.history.length > 0)

  return (
    <div className="ds-detail">
      {/* Header */}
      <div className="ds-detail-header">
        <div className="ds-detail-header-left">
          <span className="ds-detail-icon">{mod.icon}</span>
          <div>
            <h2 className="ds-detail-title">{mod.name}</h2>
            <div className="ds-detail-badges">
              <span className="ds-module-status-badge" style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
              <span className="ds-detail-pct-badge">{mod.progress}%</span>
            </div>
          </div>
        </div>
        <button className="ds-detail-close" onClick={onClose}>✕</button>
      </div>

      <ProgressBar value={mod.progress} color={meta.bar} />

      {/* Summary */}
      <p className="ds-detail-summary">{mod.summary}</p>

      {/* What works */}
      <div className="ds-detail-section">
        <h3 className="ds-detail-section-title">
          <span style={{ color: '#16a34a' }}>✓</span> Qué funciona ahora
        </h3>
        <ul className="ds-detail-list ds-detail-list--works">
          {mod.works.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>

      {/* Pending */}
      {mod.pending.length > 0 && (
        <div className="ds-detail-section">
          <h3 className="ds-detail-section-title">
            <span style={{ color: '#d97706' }}>⏳</span> Por desarrollar / mejorar
          </h3>
          <ul className="ds-detail-list ds-detail-list--pending">
            {mod.pending.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {/* History */}
      {mod.history.length > 0 && (
        <div className="ds-detail-section">
          <button
            className="ds-history-toggle"
            onClick={() => setHistOpen(h => !h)}>
            <span style={{ color: '#6366f1' }}>📅</span>
            Historial de mejoras ({mod.history.length})
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>{histOpen ? '▲' : '▼'}</span>
          </button>
          {histOpen && (
            <div className="ds-history-list">
              {mod.history.map((h, i) => (
                <div key={i} className="ds-history-entry">
                  <div className="ds-history-date">{fmtDate(h.date)}</div>
                  <div className="ds-history-body">
                    <div className="ds-history-reason">{h.reason}</div>
                    <div className="ds-history-detail">{h.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mod.history.length === 0 && (
        <div className="ds-history-empty">Sin historial de mejoras aún</div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DevStatusPage() {
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = MODULES.filter(m => {
    const matchCat = category === 'all' || m.category === category
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.summary.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Summary stats
  const complete = MODULES.filter(m => m.status === 'complete').length
  const active   = MODULES.filter(m => m.status === 'active').length
  const pending  = MODULES.filter(m => m.status === 'pending').length
  const avgProg  = Math.round(MODULES.reduce((s, m) => s + m.progress, 0) / MODULES.length)

  return (
    <div className="ds-page">
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-left">
          <h1 className="ds-title">Estado del Sistema</h1>
          <p className="ds-subtitle">
            Mapa de desarrollo interno · CBF Planner ETA Platform · 2026
          </p>
        </div>
        <div className="ds-header-badge">DESARROLLO INTERNO</div>
      </div>

      {/* Global stats */}
      <div className="ds-stats-row">
        <div className="ds-stat">
          <div className="ds-stat-value" style={{ color: '#16a34a' }}>{complete}</div>
          <div className="ds-stat-label">Completos</div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat-value" style={{ color: '#2563eb' }}>{active}</div>
          <div className="ds-stat-label">En curso</div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat-value" style={{ color: '#94a3b8' }}>{pending}</div>
          <div className="ds-stat-label">Pendientes</div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat-value" style={{ color: '#7c3aed' }}>{avgProg}%</div>
          <div className="ds-stat-label">Progreso global</div>
        </div>
      </div>

      {/* Controls */}
      <div className="ds-controls">
        <input
          className="ds-search"
          placeholder="Buscar módulo…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null) }}
        />
        <div className="ds-cat-pills">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              className={`ds-cat-pill ${category === c.id ? 'ds-cat-pill--active' : ''}`}
              onClick={() => { setCategory(c.id); setSelected(null) }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content: grid + detail panel */}
      <div className={`ds-content ${selected ? 'ds-content--split' : ''}`}>
        {/* Module grid */}
        <div className="ds-grid">
          {filtered.length === 0 && (
            <div className="ds-empty">Sin módulos que coincidan con la búsqueda</div>
          )}
          {filtered.map(mod => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              isSelected={selected === mod.id}
              onClick={() => setSelected(selected === mod.id ? null : mod.id)}
            />
          ))}
        </div>

        {/* Detail panel */}
        {selected && (() => {
          const mod = MODULES.find(m => m.id === selected)
          if (!mod) return null
          return <ModuleDetail mod={mod} onClose={() => setSelected(null)} />
        })()}
      </div>

      <div className="ds-footer">
        Esta página es solo para uso interno durante el desarrollo.
        No está vinculada a la navegación principal de la app.
      </div>
    </div>
  )
}
