// ── roles.js ──────────────────────────────────────────────────────────────────
// Centralized role helpers for CBF Planner.
// All role-gating logic should use these helpers instead of raw string comparisons.
//
// Roles:
//   teacher       → standard teacher UX
//   admin         → Coordinador Académico — manages teachers, agendas, all documents
//   superadmin    → all admin powers + can assign any role
//   rector        → school principal — same admin powers as Coordinador (manages teachers, roles, documents)
//   psicopedagoga → access to calendar for institutional events
//
// NOTE: "Director de Grupo" is NOT a role — it is a teacher with a homeroom
// assignment stored in teachers.homeroom_grade + teachers.homeroom_section.
// NOTE: "Co-teacher" is NOT a role — it is a teacher with coteacher_grade +
// coteacher_section + director_absent_until. Write access only when absence is active.

export const ROLES = {
  TEACHER:       'teacher',
  ADMIN:         'admin',
  SUPERADMIN:    'superadmin',
  RECTOR:        'rector',
  PSICOPEDAGOGA: 'psicopedagoga',
}

export const LEVEL_LABELS = {
  elementary: 'Primaria',
  middle:     'Bachillerato Básico',
  high:       'Bachillerato Superior',
}

// ── Permission helpers ────────────────────────────────────────────────────────

/** Can manage school: teachers, notifications, calendar, settings.
 *  Rector has the same admin powers as Coordinador — they cover for each other. */
export const canManage = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'rector'

/** Full superadmin — can assign any role, bypass restrictions */
export const isSuperAdmin = (role) => role === 'superadmin'

/** Rector (school principal) — read-only access to all school plans */
export const isRector = (role) => role === 'rector'

/** Psicopedagoga — can create institutional calendar events */
export const isPsicopedagoga = (role) => role === 'psicopedagoga'

/** Can access the calendar page */
export const canAccessCalendar = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'psicopedagoga'

/** Can read lesson plans from other teachers (rector view) */
export const canReadAllPlans = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'rector'

/** Can view the institutional schedule grid */
export const canViewSchedule = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'rector' || role === 'psicopedagoga'

/** Can create/edit weekly agendas for parents */
export const canManageAgendas = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'rector'

/** Rector or coordinator — can leave feedback on guides, NEWS, and agendas */
export const canGiveFeedback = (role) =>
  role === 'rector' || role === 'admin' || role === 'superadmin'

/** Coordinator/Rector — can edit documents belonging to other teachers */
export const canEditOthersDocs = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'rector'

/** Returns true if the teacher currently has active co-teacher access (absence window is open) */
export const isCoteacherActive = (teacher) => {
  if (!teacher?.coteacher_grade) return false
  if (!teacher?.director_absent_until) return false
  return new Date(teacher.director_absent_until + 'T23:59:59') >= new Date()
}

/** Can change another teacher's role.
 *  Superadmin: any role. Admin/Rector: any role except superadmin. */
export const canChangeRole = (actorRole, targetNewRole) => {
  if (actorRole === 'superadmin') return true
  if (actorRole === 'admin' || actorRole === 'rector') return targetNewRole !== 'superadmin'
  return false
}

/** Human-readable role label */
export const roleLabel = (role) => {
  const map = {
    teacher:       'Docente',
    admin:         'Coordinador',
    superadmin:    'Superadmin',
    rector:        'Rector',
    psicopedagoga: 'Psicopedagoga',
  }
  return map[role] || role
}

/** Role display config (color, bg, icon) */
export const ROLE_STYLES = {
  teacher:       { color: '#5a8a00', bg: '#eef7e0', icon: '👩‍🏫' },
  admin:         { color: '#2E5598', bg: '#EEF2FB', icon: '🏫' },
  superadmin:    { color: '#C0504D', bg: '#fdf0f0', icon: '🔑' },
  rector:        { color: '#B8860B', bg: '#FFFDF0', icon: '🎓' },
  psicopedagoga: { color: '#8064A2', bg: '#f3f0fa', icon: '💜' },
}
