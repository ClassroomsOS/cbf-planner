/**
 * DevStatusPage — Hub de desarrollo interno CBF Planner ETA Platform
 *
 * 4 tabs:
 *  1. Módulos    — progreso por área (barra + estado + historial)
 *  2. Roadmap    — backlog estratégico priorizado
 *  3. Arquitectura — patrones, gotchas, convenciones de datos
 *  4. Reglas     — never-do list y convenciones críticas del sistema
 *
 * Esta página reemplaza la necesidad de dispersar la documentación en
 * CLAUDE.md, roadmap.md, architecture.md y notas externas.
 * Acceso: admin · rector · superadmin
 */

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// DATA: MÓDULOS
// ─────────────────────────────────────────────────────────────────────────────

const MODULES = [
  {
    id: 'auth',
    name: 'Autenticación y Roles',
    icon: '🔐',
    category: 'core',
    progress: 90,
    status: 'active',
    summary: 'Login email+contraseña con validación de dominio. Recuperación de contraseña. Creación de docentes por admin con email de bienvenida. Perfil completo.',
    works: [
      'Login email + contraseña (signInWithPassword)',
      'Validación de dominio @redboston.edu.co — configurable desde /superadmin',
      'Recuperación de contraseña con SetPasswordPage',
      'Creación de docentes por admin (Edge Fn admin-create-teacher)',
      'Email de bienvenida HTML institucional con Resend / fallback Supabase SMTP',
      'Roles: teacher · admin · rector · superadmin · psicopedagoga',
      'Helpers de roles en roles.js: canManage, isSuperAdmin, canReadAllPlans, canGiveFeedback…',
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
    summary: 'Syllabus → Logros → Indicadores → NEWS → Guías → Checkpoints. Dos modelos: Modelo A (español) y Modelo B (inglés/habilidades). AchievementsPage completo.',
    works: [
      'Syllabus Topics por semana con indicator_id FK',
      'Achievement Goals (Logros) — Modelo A y Modelo B con auto-creación de 4 NEWS',
      'Achievement Indicators con dimensión, skill_area y texto_en',
      'AchievementsPage: stats, filtros, CascadePanel, GoalCard, WeightBar, CompletenessChecklist',
      'Checkpoints al final de cada período',
      'Vinculación automática guía → logro → indicador activo por semana',
    ],
    pending: [],
    history: [
      { date: '2026-05-01', reason: 'Rediseño AchievementsPage', detail: 'ObjectivesPage → AchievementsPage. Header degradado navy, 4 stat cards, agrupación por materia+grado, GoalCard coloreado, 3 columnas por dimensión, WeightBar, CascadePanel, empty state con diagrama.' },
      { date: '2026-04-10', reason: 'Modelo B completo', detail: 'Competencias, operadores intelectuales, 4 habilidades. Auto-creación de 4 proyectos NEWS al crear logro Modelo B.' },
    ],
  },
  {
    id: 'planner',
    name: 'Planificador y Editor de Guías',
    icon: '📝',
    category: 'core',
    progress: 100,
    status: 'complete',
    summary: 'PlannerPage + GuideEditorPage. Guías de 1 o 2 semanas. 6 secciones × día. SmartBlocks (16 tipos). Export HTML/DOCX/PDF/Campus Virtual. IA integrada.',
    works: [
      'PlannerPage: selector duración, callout indicador activo, PlannerPeriodTimeline, hitos NEWS',
      'GuideEditorPage: 6 secciones × día (subject/motivation/activity/skill/closing/assignment)',
      'SmartBlocks: 16 tipos, preview inline, export interactivo con auto-check',
      'Export HTML (interactivo), PDF (print dialog), DOCX CBF, DOCX legacy, Campus Virtual por jornada',
      'Vista previa modal antes de descargar (iframe con imágenes inlineadas base64)',
      'IA: suggestSectionActivity, analyzeGuide, generateGuideStructure, importGuideFromDocx',
      'Auto-guardado cada 30s · Ctrl+S / Cmd+S',
      'Guías de 2 semanas: nav Semana 1 / Semana 2, buildDaysFromDB completa días faltantes',
      'PIAR: acomodaciones por categoría inyectadas en IA sin PII',
    ],
    pending: [
      'Pipeline de imágenes de textbook para IA multimodal (fotos físicas → SmartBlocks)',
      'Refactoring GuideEditorPage.jsx (~1521 líneas) — Fase 3',
    ],
    history: [
      { date: '2026-04-20', reason: 'PIAR en IA', detail: 'GuideEditorPage consulta student_accommodation_plans y pasa acomodaciones por categoría a generateGuideStructure.' },
      { date: '2026-04-15', reason: 'Export Campus Virtual', detail: 'buildDayHtml / exportDayHtml: CSS scoped .cbf-day, SmartBlocks interactivos, imágenes base64.' },
      { date: '2026-04-10', reason: 'Preview antes de descargar', detail: 'openExportPreview: modal iframe con buildFn async, inlineImages, botón confirmar diferenciado.' },
    ],
  },
  {
    id: 'news',
    name: 'Proyectos NEWS',
    icon: '🗞️',
    category: 'core',
    progress: 97,
    status: 'active',
    summary: 'Wizard 8 pasos: Identificación → Indicador → Marco → Contenido → Fechas → Textbook → Actividades → Línea de Tiempo → Rúbrica. Archivado de versiones.',
    works: [
      'NewsProjectEditor: wizard completo con validación por paso',
      'Actividades evaluativas con %, fecha, indicador visual de totales',
      'Línea de Tiempo: semanas ISO, hito 🏁 de entrega, panel para actividades sin fecha',
      'Rúbrica CBF: 8 criterios × 5 niveles generada con IA, export HTML',
      'Auto-creación de 4 proyectos al crear Logro Modelo B',
      'news_project_versions: snapshot HTML inmutable en Storage al archivar',
      'Principio bíblico: biblical_principle + indicator_verse_ref + biblical_reflection',
    ],
    pending: [
      'Sección educativa para news_model === "standard" (Modelo A) — Fase 3',
      'Refactoring NewsProjectEditor.jsx (~1516 líneas) — Fase 3',
    ],
    history: [
      { date: '2026-04-15', reason: 'Archivado Fase 5', detail: 'news_project_versions: snapshot HTML en Supabase Storage. Botón "Archivar versión" en paso Rúbrica.' },
      { date: '2026-04-10', reason: 'Actividades evaluativas', detail: 'actividades_evaluativas JSONB. Paso "Actividades" + "Línea de Tiempo" en el wizard.' },
    ],
  },
  {
    id: 'exams',
    name: 'Módulo de Evaluación',
    icon: '📋',
    category: 'evaluation',
    progress: 100,
    status: 'complete',
    summary: 'Blueprints → sessions → instances × estudiante → ExamPlayerV2 → AI correction → resultados → revisión humana. Sistema antitrampa 5 capas.',
    works: [
      'ExamCreatorPage: wizard Quiz/Examen Final, N versiones, criterios editables, rigor pedagógico',
      'Generación de preguntas con IA por sección (9000 tokens/sección)',
      'ExamPlayerV2: email auth, antitrampa 5 capas, fullscreen adaptativo iOS/Desktop',
      'Canvas watermark: nombre + versión + hora, redibujo por requestAnimationFrame',
      'exam-ai-corrector v3: cola con reintentos, confianza < 0.65 → human review',
      'ExamDashboardPage: gestión blueprints, instancias por roster, monitor en vivo',
      'ExamRevisionPage: revisión humana, corrección manual (human_overrides)',
      'Impresión institucional CBF-G AC-01 (tabla 3×3)',
      'seededShuffle LCG + shuffleMCOptions en examUtils.js — función canónica',
      'EXAM_PRESETS: quiz / final_lower / final_upper diferenciados en prompts',
    ],
    pending: [],
    history: [
      { date: '2026-05-01', reason: 'Quiz vs Examen Final', detail: 'EXAM_PRESETS. Wizard diferenciado. Badge en dashboard. 23 tests nuevos (total 161).' },
      { date: '2026-04-25', reason: 'Antitrampa Nivel Máximo', detail: '5 capas: multi-evento, canvas watermark, fullscreen adaptativo, Telegram realtime, matriz pruebas.' },
      { date: '2026-04-22', reason: 'Roster y email auth', detail: 'school_students. ExamPlayerV2: entry por email. exam-instance-generator auto-roster.' },
    ],
  },
  {
    id: 'library',
    name: 'Biblioteca CBF',
    icon: '📚',
    category: 'resources',
    progress: 100,
    status: 'complete',
    summary: 'Documentos institucionales y personales. Upload, visor universal (PDF.js 5 / WaveSurfer 7 / OpenSeadragon 6), compartición, historial con rollback, cuota personal. Fragment Extractor + IA multimodal integrada en generación de guías.',
    works: [
      'Tabs: Institucional · Personal · Supervisión (admin)',
      'Upload: PDF, imagen, video, audio, MIDI con cuota configurable',
      'PDF.js 5: canvas page-by-page (lazy import, worker CDN)',
      'WaveSurfer 7: waveform, API v7 con timeupdate (no audioprocess)',
      'OpenSeadragon 6: deep zoom con controles zoom/reset',
      'EditModal: metadatos + reemplazar archivo',
      'ShareModal: compartir con can_edit por docente',
      'HistoryDrawer: historial de ediciones + rollback via RPC library_rollback',
      'Admin oversight: admin/rector/superadmin ve TODOS los personales del colegio',
      'Fase 3: Fragment Extractor — selección rectangular → Claude Vision → SmartBlock pre-populado → library_fragments',
      'Fase 3b/3c: Fragmentos de semana fluyen a GuideEditorPage y PlannerPage como contexto para generación IA',
      'Fase 4: Fragment images como imageBlocks en generateGuideStructure (máx. 5, fragmentos prioritarios)',
      'Fase 4: analyzeTextbookPages() — selección multi-página en PDF viewer → plan semanal + SmartBlocks sugeridos',
    ],
    pending: [],
    history: [
      { date: '2026-05-09', reason: 'Fase 3c + Fase 4 — IA multimodal completa', detail: 'Fragmentos en PlannerPage. Imágenes de fragmentos como imageBlocks a Claude. analyzeTextbookPages() con selección multi-página en PDF viewer y PagesAnalysisPanel.' },
      { date: '2026-05-09', reason: 'Fase 3 + 3b — Fragment Extractor', detail: 'FragmentSelector en PDF/imagen, analyzeTextbookFragment() Claude Vision, library_fragments tabla, fragmentos fluyen a generateGuideStructure vía GuideEditorPage y ConversationalGuideModal.' },
      { date: '2026-05-09', reason: 'Fase 2 — Visores avanzados', detail: 'PDF.js 5 canvas, WaveSurfer 7 (API nueva), OpenSeadragon 6. Lazy loading — bundle sin cambios.' },
      { date: '2026-05-08', reason: 'Fase 1.5 — Compartir e historial', detail: 'library_shares, library_edit_log, RPC library_rollback. EditModal, ShareModal, HistoryDrawer. Skip-log flag para rollback.' },
      { date: '2026-05-07', reason: 'Fase 1 — Base', detail: 'school_library, RLS dual, Storage bucket cbf-library, LibraryPage, quota meter.' },
    ],
  },
  {
    id: 'grading',
    name: 'Módulo de Calificación',
    icon: '📊',
    category: 'evaluation',
    progress: 70,
    status: 'active',
    summary: 'Sesiones de calificación grupales, micro-actividades evaluables, GradebookPage y QuickGradePage. Funciona pero necesita integración con exam_results.',
    works: [
      'GradingHubPage: dashboard de sesiones',
      'GradingSessionPage: sesión individual con micro-actividades',
      'GradingDisplayPage: vista para mostrar en clase',
      'GradingHistoryPage: historial de sesiones',
      'GradebookPage: libro de calificaciones por asignatura',
      'QuickGradePage: calificación rápida por actividad',
      'grading_sessions + micro_activities + student_activity_grades en DB',
    ],
    pending: [
      'Integración con exam_results para vista unificada de notas del período',
      'Export de calificaciones a Excel/PDF',
      'Cálculo automático de nota definitiva del período',
      'Notificaciones automáticas a representantes cuando hay calificaciones nuevas',
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
    summary: 'Perfiles psicosociales, observaciones, planes PIAR. Notas confidenciales restringidas. Integración con IA sin PII.',
    works: [
      'PsicosocialPage: semáforo de soporte (verde/amarillo/rojo)',
      'Perfil completo: flags, teacher_notes, confidential_notes (solo psico/rector/admin)',
      'student_observations: seguimiento cronológico',
      'student_accommodation_plans: acomodaciones JSONB por categoría',
      'Modo consulta docentes: banner azul, notas confidenciales ocultas',
      'Acomodaciones inyectadas en generateGuideStructure sin PII',
    ],
    pending: [],
    history: [
      { date: '2026-04-25', reason: 'Privacidad + PIAR en IA', detail: 'confidential_notes ocultas para role=teacher. Banner azul. PIAR sin PII en generateGuideStructure.' },
      { date: '2026-04-22', reason: 'Módulo completo', detail: '3 tablas. PsicosocialPage con semáforo, perfil, observaciones y plan de acomodación.' },
    ],
  },
  {
    id: 'students',
    name: 'Roster de Estudiantes',
    icon: '👩‍🎓',
    category: 'student',
    progress: 95,
    status: 'active',
    summary: 'Padrón de estudiantes por grado/sección. Importación CSV, student_code automático, email único por colegio.',
    works: [
      'StudentsPage: lista con búsqueda, agregar uno a uno e importar CSV',
      'Parser CSV robusto: mínimo 4 cols, email auto si dominio incorrecto, import row-by-row',
      'Ordenamiento por columna, eliminación por lotes con confirmación',
      'student_code autogenerado por trigger',
      'displayName: orden apellido-nombre',
      'ObservationLoggerPage: registro rápido de observaciones en clase',
    ],
    pending: [
      'Exportar roster a CSV/PDF',
      'Vista individual con historial académico completo (notas + exámenes + observaciones)',
      'Integración StudentPlayerPage con progreso real de exam_results',
    ],
    history: [
      { date: '2026-04-25', reason: 'Mejoras CSV y UX', detail: 'CSV reordenado, parser robusto, import row-by-row, eliminación por lotes, ordenamiento por columna.' },
      { date: '2026-04-22', reason: 'school_students inicial', detail: 'Tabla con trigger auto-student_code, RLS, índices. StudentsPage con agregar y importar CSV.' },
    ],
  },
  {
    id: 'agenda',
    name: 'Agenda Semanal',
    icon: '📅',
    category: 'schedule',
    progress: 100,
    status: 'complete',
    summary: 'Agenda semanal por grado/sección. Director de grupo, co-teacher, generación masiva. Status draft/ready/sent.',
    works: [
      'AgendaPage: CRUD completo para director de grupo y admin',
      'Co-teacher: edición activada durante director_absent_until',
      'Generación masiva de agendas para todos los grados del admin',
      'AgendaViewer: read-only para docentes',
      'weekly_agendas con content JSONB por período',
    ],
    pending: [],
    history: [
      { date: '2026-04-10', reason: 'Co-teacher', detail: 'coteacher_grade/section + director_absent_until. isCoteacherActive() helper.' },
    ],
  },
  {
    id: 'sala_revision',
    name: 'Sala de Revisión',
    icon: '🏛️',
    category: 'admin',
    progress: 100,
    status: 'complete',
    summary: 'Cola de guías enviadas. Coordinador/Rector aprueba, devuelve o publica. Justificación obligatoria, snapshot en Storage, notificación al docente.',
    works: [
      'ReviewRoomPage: acordeón por grado, cola de guías submitted',
      'Actions: Aprobar → submitted→approved · Devolver → returned · Publicar → published',
      'IntentModal: justificación obligatoria al editar guía ajena',
      'Snapshot HTML inmutable en Storage al publicar (lesson_plan_versions)',
      'FeedbackModal: comentarios sin modificar el doc',
    ],
    pending: [],
    history: [
      { date: '2026-04-20', reason: 'Sala completa', detail: 'ReviewRoomPage con cola, acordeón, stats. IntentModal. Snapshot en Storage. Notificaciones.' },
    ],
  },
  {
    id: 'messages',
    name: 'Mensajería',
    icon: '💬',
    category: 'communication',
    progress: 50,
    status: 'active',
    summary: 'Mensajes 1-a-1 con Realtime. NotificationsPage. Salas grupales pendientes.',
    works: [
      'MessagesPage: mensajes 1-a-1 entre docentes del colegio',
      'Supabase Realtime: subscriptions en messages y notifications',
      'Badge mensajes no leídos en sidebar',
      'NotificationsPage: notificaciones in-app con mark-as-read',
    ],
    pending: [
      'Salas grupales (message_rooms, room_messages, room_participants) — tablas listas, UI pendiente',
      'Chat completo: scroll infinito, búsqueda, archivos adjuntos',
      'Notificaciones push vía service worker',
    ],
    history: [],
  },
  {
    id: 'observability',
    name: 'Observabilidad',
    icon: '📡',
    category: 'system',
    progress: 30,
    status: 'active',
    summary: 'Infraestructura completa. Adopción baja (~14% de módulos). QADashboardPage /qa operativo.',
    works: [
      'logger.js: logError, logActivity, safeAsync',
      'cbf-logger Edge Fn: system_events con severity, module, error_code',
      'error_log + activity_log en DB con RLS + admin oversight',
      'system_alerts + alert_rules para umbral-based alerting',
      'system_health_snapshots periódicos',
      'QADashboardPage /qa: logs, errores, alertas, IA, QA Runs, Protocolos',
    ],
    pending: [
      'Instrumentar LibraryPage, AdminTeachersPage, StudentsPage, NewsPage, AchievementsPage',
      'Instrumentar ReviewRoomPage, ExamCreatorPage, ExamDashboardPage, PsicosocialPage',
      'Llamar cbf-logger desde frontend para eventos críticos de negocio',
      'Instrumentar claude-proxy y admin-create-teacher con cbf-logger',
    ],
    history: [
      { date: '2026-05-09', reason: 'QA Dashboard + admin RLS', detail: 'QADashboardPage /qa. Migración RLS admin para error_log, activity_log, system_events.' },
      { date: '2026-04-21', reason: 'Infraestructura completa', detail: 'cbf-logger Edge Fn v1. system_events, alert_rules, system_health_snapshots, error_codes.' },
    ],
  },
  {
    id: 'qa_system',
    name: 'Sistema QA Guiado',
    icon: '🧪',
    category: 'system',
    progress: 85,
    status: 'active',
    summary: 'Verificación guiada paso a paso desde el sidebar. Suites activas. Historial en qa_runs. QA Dashboard global.',
    works: [
      'QAContext + QARunner + QASummary + QALauncher',
      'Suites activas: Dashboard, NEWS, Calendario, Logros',
      'qa_runs: resultados guardados en DB con results JSONB',
      'QADashboardPage: historial global + análisis de fallos por suite',
    ],
    pending: [
      'Suite: Módulo de Evaluación (crear/publicar/jugar/corregir)',
      'Suite: Biblioteca CBF (upload/visor/compartir)',
      'Suite: Módulo de Calificación · Psicosocial · Admin',
    ],
    history: [
      { date: '2026-05-08', reason: 'QA Dashboard integrado', detail: 'Tab "QA Runs" en QADashboardPage con detalle expandible.' },
      { date: '2026-05-06', reason: 'Suite Logros', detail: 'suite_achievements.js: verificación de AchievementsPage, GoalCard, CascadePanel, IndicatorFormModal.' },
    ],
  },
  {
    id: 'classroom',
    name: 'Aula Virtual (Capa 2)',
    icon: '🖥️',
    category: 'future',
    progress: 5,
    status: 'pending',
    summary: 'Videoclase en vivo con LiveKit. Pizarra virtual, diapositivas, presencia automática. Tablas en DB. UI pendiente.',
    works: [
      'Tablas: classroom_sessions, classroom_boards, classroom_slides, classroom_documents',
      'LiveKit: livekit_rooms, livekit_participants',
      'presence_events, network_access',
    ],
    pending: [
      'Toda la UI — ClassroomPage, LiveKit integration, pizarra virtual',
      'Presencia automática (asistencia), control de acceso de red, grabación',
    ],
    history: [],
  },
  {
    id: 'student_experience',
    name: 'Experiencia Estudiantil (Capa 3)',
    icon: '🎓',
    category: 'future',
    progress: 2,
    status: 'pending',
    summary: 'Portal del estudiante, entregas, tracking. Proyecto separado — largo plazo.',
    works: ['submissions table en DB', 'StudentPlayerPage y StudentDetailPage (seguimiento básico)'],
    pending: [
      'Portal de acceso para estudiantes',
      'Entrega de actividades y tareas',
      'Tracking completitud SmartBlocks + SCORM/xAPI',
    ],
    history: [],
  },
  {
    id: 'teacher_instrument',
    name: 'Instrumento Docente de Sesión',
    icon: '🎙️',
    category: 'future',
    progress: 12,
    status: 'designed',
    summary: 'Guión de sesión generado por IA para el docente — complemento operativo de la Guía CBF-G AC-01. El instrumento lee la guía y la convierte en micro-experiencias por fase con opciones A/B/C según el estado del grupo y el IMS (Índice de Madurez de Sesión).',
    works: [
      'Diseño pedagógico completo — docs: theoric mark/instrumento-docente-sesion.md',
      'Prototipo UI funcional — theoric mark/teacher-instrument.jsx',
      'IMS definido: 4 niveles × 3 dimensiones (cognitivo/autónomo/social) por semanas del período',
      '5 estados de grupo: Presentes · Dispersos · Caídos · Eléctricos · Ansiosos',
      'Estructura de tiempo con límites duros: Pre-desarrollo ≤17 min · Durante ≤20 min · Cierre ≤10 min',
      'ANCHOR (pregunta que sostiene la sesión) + PREACHER CLOSE definidos',
      'Versículo del indicador como hilo estructural en todos los momentos',
      'Ruta mínima: sesión completa en 15 min',
    ],
    pending: [
      'DB: tabla teacher_instruments (plan_id FK, group_state, ims_index, generated_json, created_at)',
      'IA: generateTeacherInstrument() en guideAI.js (~2500 tokens, retorna JSON de fases)',
      'UI: InstrumentViewer.jsx — renderiza fases + opciones A/B/C',
      'UI: GroupStateSelector.jsx — 5 estados con descripción visual',
      'UI: IMSSelector.jsx — semana del período → nivel IMS automático',
      'Ruta: /instrument/:planId o panel dentro de GuideEditorPage',
    ],
    history: [
      { date: '2026-05-09', reason: 'Diseño completo en sesión Chat', detail: 'IMS, estados de grupo, ANCHOR, PREACHER CLOSE, estructura de tiempo, 3 opciones por fase. Prototipo UI en theoric mark/. Pendiente implementación.' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DATA: ROADMAP ESTRATÉGICO
// ─────────────────────────────────────────────────────────────────────────────

const ROADMAP_ITEMS = [
  // ── Alta prioridad estratégica ──────────────────────────────────────────
  {
    id: 'feedback_loop',
    priority: 'critical',
    title: 'Circuito de retroalimentación: Resultados → Planificación',
    module: 'exams',
    why: 'Los datos fluyen en una sola dirección: planear → ejecutar → evaluar. Los resultados de exam_results no regresan a informar la siguiente guía. Sin este ciclo el sistema es una herramienta, no inteligencia pedagógica.',
    impact: 'Convierte CBF Planner de herramienta de planificación a sistema de aprendizaje institucional. El AI de generateGuideStructure podría priorizar actividades basándose en tasas de fallo históricas por grado/materia.',
    how: 'Analizar exam_results por achievement_goal → score promedio por indicador → exponer en PlannerPage como contexto → pasar a generateGuideStructure como analytics_context.',
    complexity: 'medium',
    tables: ['exam_results', 'exam_instances', 'achievement_goals', 'achievement_indicators'],
    status: 'pending',
  },
  {
    id: 'parent_portal',
    priority: 'critical',
    title: 'Portal de Representantes (read-only)',
    module: 'students',
    why: 'representative_email existe en school_students pero no hace nada. Los padres son el stakeholder más emocionalmente investido. Cuando ellos exigen la plataforma, el colegio no puede abandonarla sin fricción social.',
    impact: 'Crea presión de adopción desde abajo (padres) además de arriba (directivos). Cumple con la obligación del SIEE colombiano de informar periódicamente a los representantes.',
    how: 'Ruta pública /parent/:token con calificaciones, observaciones (sin notas confidenciales), agenda de la semana, próximas evaluaciones del estudiante. Token temporal generado y enviado por email al representative_email.',
    complexity: 'medium',
    tables: ['school_students', 'exam_results', 'student_observations', 'weekly_agendas'],
    status: 'pending',
  },
  {
    id: 'biblical_integration',
    priority: 'high',
    title: 'Integración cristiana profunda en IA',
    module: 'planner',
    why: 'El campo biblical_principle existe en NEWS y en las guías, pero la IA lo trata como contexto decorativo. CBF es una escuela confesional — esa es la fosa competitiva. Ningún otro software educativo del mercado compite en este segmento.',
    impact: 'Una guía donde la actividad de cierre genuinamente conecta con el principio bíblico del período — no como campo extra sino como eje — hace el producto irreproducible para competidores genéricos.',
    how: 'Reforzar el prompt de generateGuideStructure: el principio bíblico define el closing section. Restricción en suggestSectionActivity: cada sugerencia debe tener un punto de conexión explícito con indicator_verse_ref.',
    complexity: 'low',
    tables: ['news_projects', 'lesson_plans', 'school_monthly_principles'],
    status: 'pending',
  },
  {
    id: 'institutional_memory',
    priority: 'high',
    title: 'Memoria institucional histórica',
    module: 'cascade',
    why: 'Si un docente deja CBF, los planes existen en la DB pero el conocimiento de qué funcionó desaparece. No hay respuesta a "¿qué tipos de actividad correlacionan con mejores resultados en 8.° Listening P2?"',
    impact: 'Transforma el sistema de repositorio de documentos a base de conocimiento pedagógico acumulado. La institución aprende aunque cambien los docentes.',
    how: 'Vista en AchievementsPage o DirectorPage: por logro → tasa de logro histórica (checkpoints) + promedio exam_results + actividades frecuentes en las guías que lo alcanzaron. Requiere agregación de datos existentes, no nuevas tablas.',
    complexity: 'medium',
    tables: ['checkpoints', 'exam_results', 'lesson_plans', 'achievement_goals'],
    status: 'pending',
  },
  {
    id: 'cross_teacher_collab',
    priority: 'high',
    title: 'Colaboración curricular entre docentes',
    module: 'planner',
    why: 'Los docentes trabajan en silos. No hay respuesta a "la profesora de Ciencias y el de Inglés están cubriendo el mismo tema — ¿coordinamos?" Esto es uno de los problemas más costosos en tiempo de una coordinación.',
    impact: 'Una vista de planificación cruzada por grado — qué están enseñando todos los docentes la misma semana — facilita interdisciplinariedad sin reuniones adicionales.',
    how: 'Vista en DirectorPage o nueva ruta /curriculum/{grade}: guías de la semana por materia, con temas principales extraídos de lesson_plans.content.info. No requiere nuevas tablas.',
    complexity: 'low',
    tables: ['lesson_plans', 'teacher_assignments'],
    status: 'pending',
  },
  // ── Media prioridad ─────────────────────────────────────────────────────
  {
    id: 'library_syllabus',
    priority: 'medium',
    title: 'Biblioteca → Textbook en guías (Fases 3 y 4)',
    module: 'library',
    why: 'El textbook físico es el artefacto central del docente CBF. La plataforma ahora lo integra completamente vía Fragment Extractor y IA multimodal.',
    impact: 'El ciclo está cerrado: docente sube PDF → extrae fragmentos → asigna a semana/grado/materia → Claude los ve como imágenes al generar la guía. analyzeTextbookPages() permite analizar unidades completas en un clic.',
    how: 'Implementado en Fases 3, 3b, 3c y 4 (2026-05-09): library_fragments tabla, FragmentSelector canvas, analyzeTextbookFragment/analyzeTextbookPages, flujo a generateGuideStructure con imageBlocks.',
    complexity: 'medium',
    tables: ['school_library', 'library_fragments', 'lesson_plans'],
    status: 'done',
  },
  {
    id: 'observability_100',
    priority: 'medium',
    title: 'Observabilidad al 100%',
    module: 'observability',
    why: 'El 86% de los errores del sistema son silenciosos. La infraestructura existe — logger.js, cbf-logger, tablas — pero solo 14% de los módulos la usan. Esto es deuda operacional, no técnica.',
    impact: 'Permite detectar y corregir errores antes de que los docentes los reporten. Fundamental antes de escalar el sistema a más colegios.',
    how: 'Pasar por cada página y añadir logError en catch blocks + logActivity en create/update/delete de entidades principales. Estimado: 2-3 horas de trabajo concentrado.',
    complexity: 'low',
    tables: ['error_log', 'activity_log', 'system_events'],
    status: 'in_progress',
  },
  {
    id: 'messaging_full',
    priority: 'medium',
    title: 'Mensajería expandida: salas grupales',
    module: 'messages',
    why: 'MessagesPage solo tiene 1-a-1. Las tablas message_rooms, room_messages y room_participants están en la DB listas. Los canales grupales (por grado, por materia, general) reducen el uso de WhatsApp externo.',
    impact: 'Mantiene la comunicación institucional dentro del sistema, auditada y sin datos personales en plataformas externas.',
    how: 'UI de salas en MessagesPage: lista de rooms en sidebar izquierdo, chat room en panel derecho. Realtime ya está configurado para la tabla messages.',
    complexity: 'medium',
    tables: ['message_rooms', 'room_messages', 'room_participants'],
    status: 'pending',
  },
  // ── Baja prioridad / Arquitectura ───────────────────────────────────────
  {
    id: 'teacher_instrument_impl',
    priority: 'low',
    title: 'Instrumento Docente de Sesión — implementación',
    module: 'planner',
    why: 'El docente tiene la Guía CBF-G AC-01 pero no tiene un guión operativo para conducir la clase. El instrumento convierte la guía en micro-decisiones de aula según el estado real del grupo.',
    impact: 'Cierra el ciclo Diseño → Ejecución. El docente entra al aula con un plan de 15-47 min estructurado por fases, ajustable en tiempo real según el grupo (Disperso, Caído, Eléctrico...).',
    how: 'Tabla teacher_instruments (plan_id FK). generateTeacherInstrument() en guideAI.js. InstrumentViewer, GroupStateSelector, IMSSelector. Ruta /instrument/:planId o panel en GuideEditorPage. Prototipo en theoric mark/.',
    complexity: 'medium',
    tables: ['teacher_instruments', 'lesson_plans'],
    status: 'designed',
  },
  {
    id: 'refactoring',
    priority: 'low',
    title: 'Refactoring Fase 3: archivos grandes',
    module: 'planner',
    why: 'GuideEditorPage.jsx (~1521 lns), NewsProjectEditor.jsx (~1516 lns), SmartBlocks.jsx (~1339 lns), index.css (~6200+ lns). No bloquea el desarrollo actual pero aumenta el costo cognitivo de cada cambio.',
    impact: 'Reduce el riesgo de regresiones al modificar features existentes. Necesario antes de onboarding de un segundo desarrollador.',
    how: 'Partir por subcomponentes por panel (GuideEditor) o por steps del wizard (NewsProjectEditor). CSS modules por página/componente.',
    complexity: 'high',
    tables: [],
    status: 'pending',
  },
  {
    id: 'typescript',
    priority: 'low',
    title: 'TypeScript gradual',
    module: 'auth',
    why: 'Codebase 100% JS. No bloquea nada actualmente. TypeScript reduce bugs de tipado y mejora la autocompletación en el IDE, lo que acelera el desarrollo.',
    impact: 'Medio-alto a largo plazo. Bajo a corto plazo. Solo empezar por utils/ y hooks/ nuevos.',
    how: 'Adopción gradual: new files in .tsx, existing files only when touched. Configurar tsconfig con allowJs: true.',
    complexity: 'low',
    tables: [],
    status: 'pending',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DATA: ARQUITECTURA
// ─────────────────────────────────────────────────────────────────────────────

const ARCHITECTURE_SECTIONS = [
  {
    id: 'grade_convention',
    title: 'Convención Grade + Section',
    icon: '📐',
    critical: true,
    description: 'La regla más violada del sistema. Dos formatos coexisten con significados distintos.',
    content: [
      { label: 'Combined "8.° Blue"', detail: 'lesson_plans · achievement_goals · achievement_indicators · syllabus_topics · checkpoints. CHECK activo: LIKE "%.° %"' },
      { label: 'Base "8.°" + section separada', detail: 'teacher_assignments · news_projects · school_students. CHECK activo: LIKE "%.°" AND NOT LIKE "% %"' },
      { label: 'lesson_plans es la excepción', detail: 'Tiene AMBAS: grade = "8.° Blue" (combined) Y columna section = "Blue" separada.' },
      { label: 'Queries correctas', detail: '.eq("grade", combinedGrade) para lesson_plans/achievement_goals. .eq("grade", baseGrade).eq("section", section) para school_students.' },
    ],
    never: [
      'grade.replace(/\\s+[A-Z]$/, "").trim()',
      'plan.grade.split(" ")[0]',
      'q.ilike("grade", gradeBase + "%")',
    ],
  },
  {
    id: 'rls_pattern',
    title: 'Patrón RLS y get_my_school_id()',
    icon: '🛡️',
    critical: true,
    description: 'Multi-tenancy por school_id. TODOS los datos están aislados por colegio.',
    content: [
      { label: 'Función canónica', detail: 'get_my_school_id() SECURITY DEFINER — no exponer school_id directo en client.' },
      { label: 'Patrón estándar', detail: 'teacher_id = auth.uid() para owner · school_id = get_my_school_id() para lectura escolar.' },
      { label: 'Roles en policies', detail: 'SIEMPRE usar role IN ("admin", "superadmin", "rector") — nunca comparar strings sueltos.' },
      { label: 'Edge Functions', detail: 'CORS whitelist explícita: classroomsos.github.io · localhost:5173 · localhost:4173. Nunca usar *.' },
    ],
    never: [
      'Comparar teacher.role === "admin" directamente — usar canManage(role)',
      'Exponer school_id en URL ni en localStorage',
      'INSERT sin RLS desde el cliente en tablas con datos sensibles',
    ],
  },
  {
    id: 'provider_pattern',
    title: 'Provider Pattern — crítico no romper',
    icon: '⚛️',
    critical: true,
    description: 'DashboardPage monta los providers. DashboardInner los consume. Nunca invertir esto.',
    content: [
      { label: 'FeaturesContext', detail: 'Carga schools.features una vez por sesión. useFeatures() solo dentro de DashboardInner.' },
      { label: 'ToastContext', detail: 'useToast() solo dentro de DashboardInner. NUNCA window.alert — usar showToast().' },
      { label: 'QAProvider', detail: 'Envuelve todo DashboardInner. QARunner y QALauncher dependen de este contexto.' },
    ],
    never: [
      'Llamar useFeatures() o useToast() en DashboardPage directamente',
      'window.alert() en cualquier parte del codebase',
    ],
  },
  {
    id: 'ai_pattern',
    title: 'Integración IA — Flujo y Reglas',
    icon: '🤖',
    critical: false,
    description: 'Toda IA pasa por claude-proxy Edge Fn. Passthrough puro. El modelo es claude-sonnet-4-20250514.',
    content: [
      { label: 'AIAssistant.js', detail: 'Único punto de entrada. callClaude() lee respuesta como texto antes de JSON.parse — evita "Unexpected token".' },
      { label: 'extractJSONArray', detail: 'JSON.parse → fallback regex /\\[[\\s\\S]*\\]/ para bloques markdown de Claude.' },
      { label: 'Tokens por función', detail: 'suggestSectionActivity: 2500 · generateGuideStructure: 16000 · generateExamQuestions: 9000/sección' },
      { label: 'AIGeneratorModal gate', detail: '!activeIndicator && !achievementGoal → muestra aviso ámbar, oculta formulario.' },
      { label: 'Límite mensual', detail: 'teachers.ai_monthly_limit int (0 = ilimitado). setAIContext() en login.' },
    ],
    never: [
      'Cambiar el modelo sin avisar (regla #6 de CLAUDE.md)',
      'Llamar a Anthropic API directamente desde el cliente — siempre via claude-proxy',
    ],
  },
  {
    id: 'logger_pattern',
    title: 'Logger — Observabilidad',
    icon: '📡',
    critical: false,
    description: 'logger.js expone logError, logActivity y safeAsync. Nunca lanza excepciones propias.',
    content: [
      { label: 'logError(err, { page, action, entityId })', detail: 'Escribe en error_log. Fire-and-forget seguro.' },
      { label: 'logActivity(action, entityType, entityId, description)', detail: 'Escribe en activity_log. Verbos: create · update · delete · export · ai_generate.' },
      { label: 'safeAsync(fn, context)', detail: 'Devuelve { data, error }. Nunca lanza. Auto-loguea si hay error.' },
      { label: 'Patrón de uso', detail: 'const { data, error } = await safeAsync(() => supabase.from(...), { page, action })' },
    ],
    never: [
      'try { } catch (e) { } silencioso — siempre logError(e, context)',
      'Supabase writes sin manejar el error retornado',
    ],
  },
  {
    id: 'modal_rules',
    title: 'Reglas de Modales',
    icon: '🗔',
    critical: false,
    description: 'Ningún modal debe cerrarse al hacer click fuera. Modales dentro de padres clickeables usan createPortal.',
    content: [
      { label: 'No click-outside', detail: 'Overlay div no debe tener onClick. Los modales del sistema son intencionales — el usuario cierra con el botón X.' },
      { label: 'createPortal obligatorio', detail: 'Cualquier modal dentro de un componente clickeable (accordion, card) usa createPortal(…, document.body).' },
      { label: 'Headers de color semántico', detail: 'Logros: navy #1F3864. NEWS: verde #1A6B3A. Biblioteca: azul oscuro.' },
    ],
    never: [
      'onClick en el overlay div de cualquier modal',
      'Modal sin portal dentro de componente con onClick en el padre',
    ],
  },
  {
    id: 'db_migrations',
    title: 'Migraciones de Base de Datos',
    icon: '🗄️',
    critical: true,
    description: 'Numeradas cronológicamente. Nunca editar una ya ejecutada en producción.',
    content: [
      { label: 'Prod', detail: 'vouxrqsiyoyllxgcriic — siempre link antes de db push o query directa.' },
      { label: 'Dev', detail: 'gfjiicfnwpkbkptwgnte — restaurar link al terminar en prod.' },
      { label: 'Formato', detail: 'YYYYMMDDHHMMSS_descripcion.sql — nunca editar una migración ya aplicada.' },
      { label: 'Edge Functions', detail: 'siempre deploy con --no-verify-jwt' },
    ],
    never: [
      'Editar una migración ya ejecutada en producción',
      'Borrar datos de producción sin backup explícito',
      'news_legacy: LEGACY — nunca borrar (datos históricos)',
    ],
  },
  {
    id: 'pdfjs_trap',
    title: 'PDFJS_WORKER_URL — Trampa de mantenimiento',
    icon: '⚠️',
    critical: true,
    description: 'URL del worker de PDF.js está hardcodeada con número de versión. Al actualizar la librería hay que actualizar también la URL.',
    content: [
      { label: 'URL actual', detail: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs' },
      { label: 'Archivo', detail: 'src/pages/LibraryPage.jsx — constante PDFJS_WORKER_URL al inicio del archivo.' },
      { label: 'Por qué no dynamic import + ?url', detail: 'Dynamic imports no admiten el query ?url de Vite para el worker. CDN es la única opción viable.' },
      { label: 'Síntoma si no se actualiza', detail: 'El visor de PDF falla silenciosamente — sin error en consola visible para el usuario.' },
    ],
    never: [
      'Actualizar pdfjs-dist en package.json sin actualizar PDFJS_WORKER_URL en LibraryPage.jsx',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DATA: REGLAS CRÍTICAS
// ─────────────────────────────────────────────────────────────────────────────

const RULES = [
  { id: 'r01', category: 'build',    critical: true,  rule: 'minify: false en vite.config.js', detail: 'NUNCA reactivar. Los bundles legibles facilitan debugging en producción.' },
  { id: 'r02', category: 'security', critical: true,  rule: 'Edge Functions: siempre --no-verify-jwt', detail: 'El token JWT del cliente no llega correctamente a las Edge Functions de Supabase.' },
  { id: 'r03', category: 'db',       critical: true,  rule: 'RLS teachers: siempre get_my_school_id() SECURITY DEFINER', detail: 'Exponer school_id directamente crea una brecha de multi-tenancy.' },
  { id: 'r04', category: 'db',       critical: true,  rule: 'Migraciones: numeradas cronológicamente, nunca editar una ya ejecutada en prod', detail: 'Editar una migración aplicada puede corromper el historial de migraciones de Supabase.' },
  { id: 'r05', category: 'security', critical: true,  rule: 'NUNCA borrar datos de producción sin backup explícito', detail: 'Siempre verificar con SELECT antes de DELETE. Preferir soft-delete si existe.' },
  { id: 'r06', category: 'ui',       critical: true,  rule: 'NUNCA usar window.alert()', detail: 'Usar showToast() del ToastContext. Los alerts bloquean el hilo de JS y son UX pésima.' },
  { id: 'r07', category: 'db',       critical: true,  rule: 'Grade: respetar CHECKs activos en DB', detail: 'lesson_plans exige "%.° %" — teacher_assignments exige "%.°" sin sección. Violarlos da error 23514.' },
  { id: 'r08', category: 'exam',     critical: true,  rule: 'seededShuffle: función canónica en examUtils.js', detail: 'NUNCA duplicar en componentes. El shuffle determinístico por versión depende de esta función única.' },
  { id: 'r09', category: 'db',       critical: true,  rule: 'Tablas DEPRECATED: no crear nuevos registros', detail: 'assessments · questions · assessment_versions · student_exam_sessions. Usar exam_blueprints → exam_sessions.' },
  { id: 'r10', category: 'ai',       critical: true,  rule: 'Modelo IA: claude-sonnet-4-20250514', detail: 'No cambiar sin avisar. El comportamiento del sistema fue calibrado con este modelo.' },
  { id: 'r11', category: 'db',       critical: false, rule: 'news_legacy: LEGACY — no borrar', detail: 'Datos históricos de proyectos anteriores. No afectan funcionalidad actual.' },
  { id: 'r12', category: 'ui',       critical: false, rule: 'Modales: nunca cerrar en click fuera', detail: 'El usuario cierra con el botón X. Evita pérdida accidental de datos en formularios.' },
  { id: 'r13', category: 'security', critical: false, rule: 'innerHTML: nunca con datos de usuario', detail: 'Usar DOMPurify.sanitize() o esc() en HTML generado. Links en RichEditor: bloquear javascript:, vbscript:, data:' },
  { id: 'r14', category: 'db',       critical: false, rule: 'upsert(onConflict) solo si la UNIQUE constraint existe en prod', detail: 'Para operaciones críticas usar check-then-write (busca → update/insert).' },
  { id: 'r15', category: 'ui',       critical: false, rule: 'Dropdowns de grado/sección: siempre <select> con assignments', detail: 'NUNCA <input> libre. El docente no debe escribir el grado — debe seleccionarlo.' },
  { id: 'r16', category: 'ai',       critical: false, rule: 'PDFJS_WORKER_URL: actualizar al subir versión de pdfjs-dist', detail: 'URL hardcodeada en LibraryPage.jsx con número de versión exacto.' },
  { id: 'r17', category: 'exam',     critical: false, rule: 'section_name en exam_instances.generated_questions', detail: '"" → preguntas sin tabs. Valores distintos → tabs automáticos. NUNCA hardcodear section_name: ""' },
  { id: 'r18', category: 'exam',     critical: false, rule: 'CYCLE_EVENTS no actualizan integrity_flags', detail: 'exam_started, exam_resumed, exam_submitted usan formato Telegram distinto. Cualquier otro event_type → violación → actualiza tab_switches.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',            label: 'Todo',            icon: '🗂️' },
  { id: 'core',           label: 'Core pedagógico', icon: '📚' },
  { id: 'evaluation',     label: 'Evaluación',      icon: '📋' },
  { id: 'student',        label: 'Estudiantes',     icon: '👩‍🎓' },
  { id: 'resources',      label: 'Recursos',        icon: '📁' },
  { id: 'schedule',       label: 'Agenda/Horario',  icon: '📅' },
  { id: 'admin',          label: 'Admin',           icon: '🏛️' },
  { id: 'communication',  label: 'Comunicación',    icon: '💬' },
  { id: 'system',         label: 'Sistema',         icon: '⚙️' },
  { id: 'future',         label: 'Futuro',          icon: '🔮' },
]

const STATUS_META = {
  complete: { label: 'Completo',  color: '#16a34a', bg: '#f0fdf4', bar: '#16a34a' },
  active:   { label: 'En curso',  color: '#2563eb', bg: '#eff6ff', bar: '#3b82f6' },
  pending:  { label: 'Pendiente', color: '#94a3b8', bg: '#f8fafc', bar: '#cbd5e1' },
}

const PRIORITY_META = {
  critical:  { label: 'Crítica',  color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  high:      { label: 'Alta',     color: '#d97706', bg: '#fffbeb', icon: '🟠' },
  medium:    { label: 'Media',    color: '#2563eb', bg: '#eff6ff', icon: '🔵' },
  low:       { label: 'Baja',     color: '#94a3b8', bg: '#f8fafc', icon: '⚪' },
  in_progress: { label: 'En progreso', color: '#7c3aed', bg: '#f5f3ff', icon: '🟣' },
}

const RULE_CATEGORY_META = {
  build:    { label: 'Build',     color: '#475569' },
  security: { label: 'Seguridad', color: '#dc2626' },
  db:       { label: 'DB / RLS',  color: '#2563eb' },
  ui:       { label: 'UI',        color: '#7c3aed' },
  exam:     { label: 'Examen',    color: '#d97706' },
  ai:       { label: 'IA',        color: '#16a34a' },
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS — shared
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value, color }) {
  return (
    <div className="ds-progress-track">
      <div className="ds-progress-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

function TabButton({ id, label, icon, active, onClick }) {
  return (
    <button
      className={`ds-tab ${active ? 'ds-tab--active' : ''}`}
      onClick={() => onClick(id)}>
      {icon} {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: MÓDULOS
// ─────────────────────────────────────────────────────────────────────────────

function ModuleCard({ mod, isSelected, onClick }) {
  const meta = STATUS_META[mod.status]
  return (
    <div
      className={`ds-module-card ds-module-card--${mod.status} ${isSelected ? 'ds-module-card--selected' : ''}`}
      onClick={onClick}>
      <div className="ds-module-card-header">
        <span className="ds-module-icon">{mod.icon}</span>
        <div className="ds-module-meta">
          <div className="ds-module-name">{mod.name}</div>
          <span className="ds-module-status-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
        </div>
        <div className="ds-module-pct">{mod.progress}%</div>
      </div>
      <ProgressBar value={mod.progress} color={meta.bar} />
    </div>
  )
}

function ModuleDetail({ mod, onClose }) {
  const meta = STATUS_META[mod.status]
  const [histOpen, setHistOpen] = useState(true)
  const relatedRoadmap = ROADMAP_ITEMS.filter(r => r.module === mod.id)

  return (
    <div className="ds-detail">
      <div className="ds-detail-header">
        <div className="ds-detail-header-left">
          <span className="ds-detail-icon">{mod.icon}</span>
          <div>
            <h2 className="ds-detail-title">{mod.name}</h2>
            <div className="ds-detail-badges">
              <span className="ds-module-status-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
              <span className="ds-detail-pct-badge">{mod.progress}%</span>
            </div>
          </div>
        </div>
        <button className="ds-detail-close" onClick={onClose}>✕</button>
      </div>

      <ProgressBar value={mod.progress} color={meta.bar} />
      <p className="ds-detail-summary">{mod.summary}</p>

      <div className="ds-detail-section">
        <h3 className="ds-detail-section-title"><span style={{ color: '#16a34a' }}>✓</span> Qué funciona ahora</h3>
        <ul className="ds-detail-list ds-detail-list--works">
          {mod.works.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>

      {mod.pending.length > 0 && (
        <div className="ds-detail-section">
          <h3 className="ds-detail-section-title"><span style={{ color: '#d97706' }}>⏳</span> Por desarrollar</h3>
          <ul className="ds-detail-list ds-detail-list--pending">
            {mod.pending.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {relatedRoadmap.length > 0 && (
        <div className="ds-detail-section">
          <h3 className="ds-detail-section-title"><span style={{ color: '#6366f1' }}>🗺️</span> Items del roadmap</h3>
          <div className="ds-related-roadmap">
            {relatedRoadmap.map(r => {
              const pm = PRIORITY_META[r.priority]
              return (
                <div key={r.id} className="ds-related-roadmap-item">
                  <span>{pm.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.why.slice(0, 100)}…</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mod.history.length > 0 && (
        <div className="ds-detail-section">
          <button className="ds-history-toggle" onClick={() => setHistOpen(h => !h)}>
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

function ModulesTab() {
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

  const complete  = MODULES.filter(m => m.status === 'complete').length
  const active    = MODULES.filter(m => m.status === 'active').length
  const pending   = MODULES.filter(m => m.status === 'pending').length
  const avgProg   = Math.round(MODULES.reduce((s, m) => s + m.progress, 0) / MODULES.length)

  return (
    <div>
      <div className="ds-stats-row">
        <div className="ds-stat"><div className="ds-stat-value" style={{ color: '#16a34a' }}>{complete}</div><div className="ds-stat-label">Completos</div></div>
        <div className="ds-stat"><div className="ds-stat-value" style={{ color: '#2563eb' }}>{active}</div><div className="ds-stat-label">En curso</div></div>
        <div className="ds-stat"><div className="ds-stat-value" style={{ color: '#94a3b8' }}>{pending}</div><div className="ds-stat-label">Pendientes</div></div>
        <div className="ds-stat"><div className="ds-stat-value" style={{ color: '#7c3aed' }}>{avgProg}%</div><div className="ds-stat-label">Progreso global</div></div>
      </div>

      <div className="ds-controls">
        <input className="ds-search" placeholder="Buscar módulo…" value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null) }} />
        <div className="ds-cat-pills">
          {CATEGORIES.map(c => (
            <button key={c.id} className={`ds-cat-pill ${category === c.id ? 'ds-cat-pill--active' : ''}`}
              onClick={() => { setCategory(c.id); setSelected(null) }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`ds-content ${selected ? 'ds-content--split' : ''}`}>
        <div className="ds-grid">
          {filtered.length === 0 && <div className="ds-empty">Sin módulos que coincidan</div>}
          {filtered.map(mod => (
            <ModuleCard key={mod.id} mod={mod}
              isSelected={selected === mod.id}
              onClick={() => setSelected(selected === mod.id ? null : mod.id)} />
          ))}
        </div>
        {selected && (() => {
          const mod = MODULES.find(m => m.id === selected)
          if (!mod) return null
          return <ModuleDetail mod={mod} onClose={() => setSelected(null)} />
        })()}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: ROADMAP
// ─────────────────────────────────────────────────────────────────────────────

function RoadmapTab() {
  const [selected, setSelected] = useState(null)
  const [priFilter, setPriFilter] = useState('all')

  const filtered = ROADMAP_ITEMS.filter(r =>
    priFilter === 'all' || r.priority === priFilter
  )

  const item = ROADMAP_ITEMS.find(r => r.id === selected)

  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, in_progress: 3, low: 4 }
  const sorted = [...filtered].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <div>
      <div className="ds-roadmap-intro">
        <p>
          Items estratégicos ordenados por impacto en indispensabilidad del producto.
          No son features de conveniencia — cada uno cierra un gap estructural del sistema.
        </p>
      </div>

      <div className="ds-controls" style={{ marginBottom: 16 }}>
        <div className="ds-cat-pills">
          {['all', 'critical', 'high', 'medium', 'low'].map(p => {
            const pm = p === 'all' ? { label: 'Todo', icon: '🗂️', color: '#475569', bg: '#f1f5f9' } : PRIORITY_META[p]
            return (
              <button key={p} className={`ds-cat-pill ${priFilter === p ? 'ds-cat-pill--active' : ''}`}
                style={priFilter === p ? { background: pm.color, borderColor: pm.color } : {}}
                onClick={() => { setPriFilter(p); setSelected(null) }}>
                {pm.icon || '🗂️'} {pm.label || 'Todo'}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`ds-content ${selected ? 'ds-content--split' : ''}`}>
        <div className="ds-grid">
          {sorted.map(r => {
            const pm = PRIORITY_META[r.priority] || PRIORITY_META.low
            const mod = MODULES.find(m => m.id === r.module)
            return (
              <div key={r.id}
                className={`ds-roadmap-card ${selected === r.id ? 'ds-roadmap-card--selected' : ''}`}
                onClick={() => setSelected(selected === r.id ? null : r.id)}>
                <div className="ds-roadmap-card-header">
                  <span className="ds-roadmap-priority-badge" style={{ background: pm.bg, color: pm.color }}>
                    {pm.icon} {pm.label}
                  </span>
                  {mod && <span className="ds-roadmap-module-tag">{mod.icon} {mod.name}</span>}
                </div>
                <div className="ds-roadmap-title">{r.title}</div>
                <div className="ds-roadmap-why">{r.why.slice(0, 120)}…</div>
              </div>
            )
          })}
        </div>

        {item && (
          <div className="ds-detail">
            <div className="ds-detail-header">
              <div>
                {(() => {
                  const pm = PRIORITY_META[item.priority] || PRIORITY_META.low
                  return (
                    <span className="ds-roadmap-priority-badge" style={{ background: pm.bg, color: pm.color, fontSize: 12 }}>
                      {pm.icon} {pm.label}
                    </span>
                  )
                })()}
                <h2 className="ds-detail-title" style={{ marginTop: 6 }}>{item.title}</h2>
              </div>
              <button className="ds-detail-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="ds-detail-section">
              <h3 className="ds-detail-section-title">❓ Por qué importa</h3>
              <p className="ds-roadmap-body">{item.why}</p>
            </div>

            <div className="ds-detail-section">
              <h3 className="ds-detail-section-title">🎯 Impacto esperado</h3>
              <p className="ds-roadmap-body">{item.impact}</p>
            </div>

            <div className="ds-detail-section">
              <h3 className="ds-detail-section-title">🔧 Cómo implementarlo</h3>
              <p className="ds-roadmap-body">{item.how}</p>
            </div>

            {item.tables.length > 0 && (
              <div className="ds-detail-section">
                <h3 className="ds-detail-section-title">🗄️ Tablas involucradas</h3>
                <div className="qa-proto-tables">
                  {item.tables.map(t => <code key={t} className="qa-proto-table-chip">{t}</code>)}
                </div>
              </div>
            )}

            <div className="ds-detail-section">
              <h3 className="ds-detail-section-title">📊 Complejidad de implementación</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {['low','medium','high'].map(c => (
                  <span key={c} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: item.complexity === c ? '#6366f1' : '#f1f5f9',
                    color: item.complexity === c ? '#fff' : '#94a3b8',
                  }}>{c === 'low' ? 'Baja' : c === 'medium' ? 'Media' : 'Alta'}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: ARQUITECTURA
// ─────────────────────────────────────────────────────────────────────────────

function ArchitectureTab() {
  const [selected, setSelected] = useState(ARCHITECTURE_SECTIONS[0].id)
  const section = ARCHITECTURE_SECTIONS.find(s => s.id === selected) || ARCHITECTURE_SECTIONS[0]

  return (
    <div className="qa-proto-layout">
      <div className="qa-proto-nav">
        {ARCHITECTURE_SECTIONS.map(s => (
          <button key={s.id}
            className={`qa-proto-nav-item ${selected === s.id ? 'active' : ''}`}
            onClick={() => setSelected(s.id)}>
            <span>{s.icon}</span>
            <span className="qa-proto-nav-name">{s.title}</span>
            {s.critical && <span className="ds-arch-critical-dot" />}
          </button>
        ))}
      </div>

      <div className="qa-proto-detail">
        <div className="ds-arch-header">
          <span className="qa-proto-icon">{section.icon}</span>
          <div>
            <h2 className="qa-proto-title">{section.title}</h2>
            {section.critical && (
              <span className="ds-arch-critical-badge">CRÍTICO — leer antes de modificar</span>
            )}
          </div>
        </div>

        <p className="qa-proto-desc">{section.description}</p>

        <div className="qa-proto-section">
          <h4>Detalles</h4>
          <div className="ds-arch-content-list">
            {section.content.map((c, i) => (
              <div key={i} className="ds-arch-content-item">
                <div className="ds-arch-content-label">{c.label}</div>
                <div className="ds-arch-content-detail">{c.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {section.never.length > 0 && (
          <div className="qa-proto-section">
            <h4>NUNCA hacer</h4>
            <ul className="ds-never-list">
              {section.never.map((n, i) => (
                <li key={i}><code>{n}</code></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: REGLAS
// ─────────────────────────────────────────────────────────────────────────────

function RulesTab() {
  const [catFilter, setCatFilter] = useState('all')
  const [onlyCritical, setOnlyCritical] = useState(false)

  const cats = ['all', ...new Set(RULES.map(r => r.category))]
  const filtered = RULES.filter(r => {
    const matchCat = catFilter === 'all' || r.category === catFilter
    const matchCrit = !onlyCritical || r.critical
    return matchCat && matchCrit
  })

  return (
    <div>
      <div className="ds-rules-intro">
        <p>Convenciones del sistema derivadas de bugs resueltos, decisiones de arquitectura y patrones que DEBEN mantenerse consistentes. Cada regla rota ha causado un problema real.</p>
      </div>

      <div className="ds-controls" style={{ marginBottom: 16 }}>
        <div className="ds-cat-pills">
          {cats.map(c => {
            const meta = RULE_CATEGORY_META[c]
            return (
              <button key={c} className={`ds-cat-pill ${catFilter === c ? 'ds-cat-pill--active' : ''}`}
                onClick={() => setCatFilter(c)}>
                {c === 'all' ? '🗂️ Todo' : `${meta?.label || c}`}
              </button>
            )
          })}
        </div>
        <label className="ds-critical-toggle">
          <input type="checkbox" checked={onlyCritical} onChange={e => setOnlyCritical(e.target.checked)} />
          Solo reglas críticas
        </label>
      </div>

      <div className="ds-rules-list">
        {filtered.map(r => {
          const catMeta = RULE_CATEGORY_META[r.category]
          return (
            <div key={r.id} className={`ds-rule-card ${r.critical ? 'ds-rule-card--critical' : ''}`}>
              <div className="ds-rule-header">
                <span className="ds-rule-cat" style={{ color: catMeta?.color || '#475569' }}>
                  {catMeta?.label || r.category}
                </span>
                {r.critical && <span className="ds-rule-critical-badge">CRÍTICO</span>}
              </div>
              <div className="ds-rule-text">{r.rule}</div>
              <div className="ds-rule-detail">{r.detail}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'modules',       label: 'Módulos',      icon: '📊' },
  { id: 'roadmap',       label: 'Roadmap',       icon: '🗺️' },
  { id: 'architecture',  label: 'Arquitectura',  icon: '🏗️' },
  { id: 'rules',         label: 'Reglas',        icon: '📏' },
]

export default function DevStatusPage() {
  const [activeTab, setActiveTab] = useState('modules')

  return (
    <div className="ds-page">
      <div className="ds-header">
        <div className="ds-header-left">
          <h1 className="ds-title">Hub de Desarrollo — CBF Planner</h1>
          <p className="ds-subtitle">
            Documentación viva · Roadmap estratégico · Arquitectura · Reglas del sistema
          </p>
        </div>
        <div className="ds-header-badge">SOLO DESARROLLO INTERNO</div>
      </div>

      <div className="ds-tabs-nav">
        {TABS.map(t => (
          <TabButton key={t.id} id={t.id} label={t.label} icon={t.icon}
            active={activeTab === t.id} onClick={setActiveTab} />
        ))}
      </div>

      <div className="ds-tab-body">
        {activeTab === 'modules'      && <ModulesTab />}
        {activeTab === 'roadmap'      && <RoadmapTab />}
        {activeTab === 'architecture' && <ArchitectureTab />}
        {activeTab === 'rules'        && <RulesTab />}
      </div>

      <div className="ds-footer">
        Esta página es solo para uso interno durante el desarrollo ·
        Actualizar al completar cada módulo o regla nueva ·
        Acceso: admin · rector · superadmin
      </div>
    </div>
  )
}
