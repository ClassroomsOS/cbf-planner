// ── roles.js ──────────────────────────────────────────────────────────────────
// Centralized role helpers for CBF Planner.
// All role-gating logic should use these helpers instead of raw string comparisons.
//
// Roles:
//   teacher       → standard teacher UX
//   admin         → school management (teachers, notifications, calendar, settings)
//   superadmin    → all admin powers + can assign any role
//   director      → read-only view of all plans in their school level
//   psicopedagoga → access to calendar for institutional events

export const ROLES = {
  TEACHER:       'teacher',
  ADMIN:         'admin',
  SUPERADMIN:    'superadmin',
  DIRECTOR:      'director',
  PSICOPEDAGOGA: 'psicopedagoga',
}

export const LEVEL_LABELS = {
  elementary: 'Primaria',
  middle:     'Bachillerato Básico',
  high:       'Bachillerato Superior',
}

// ── Permission helpers ────────────────────────────────────────────────────────

/** Can manage school: teachers, notifications, calendar, settings */
export const canManage = (role) =>
  role === 'admin' || role === 'superadmin'

/** Full superadmin — can assign any role, bypass restrictions */
export const isSuperAdmin = (role) => role === 'superadmin'

/** Director de grupo — read-only access to all school plans */
export const isDirector = (role) => role === 'director'

/** Psicopedagoga — can create institutional calendar events */
export const isPsicopedagoga = (role) => role === 'psicopedagoga'

/** Can access the calendar page */
export const canAccessCalendar = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'psicopedagoga'

/** Can read lesson plans from other teachers (director view) */
export const canReadAllPlans = (role) =>
  role === 'admin' || role === 'superadmin' || role === 'director'

/** Can change another teacher's role (admin can promote to anything except superadmin) */
export const canChangeRole = (actorRole, targetNewRole) => {
  if (actorRole === 'superadmin') return true
  if (actorRole === 'admin') return targetNewRole !== 'superadmin'
  return false
}

/** Human-readable role label */
export const roleLabel = (role) => {
  const map = {
    teacher:       'Docente',
    admin:         'Coordinador',
    superadmin:    'Superadmin',
    director:      'Director de Grupo',
    psicopedagoga: 'Psicopedagoga',
  }
  return map[role] || role
}

/** Role display config (color, bg, icon) */
export const ROLE_STYLES = {
  teacher:       { color: '#5a8a00', bg: '#eef7e0', icon: '👩‍🏫' },
  admin:         { color: '#2E5598', bg: '#EEF2FB', icon: '🏫' },
  superadmin:    { color: '#C0504D', bg: '#fdf0f0', icon: '🔑' },
  director:      { color: '#B8860B', bg: '#FFFDF0', icon: '📋' },
  psicopedagoga: { color: '#8064A2', bg: '#f3f0fa', icon: '💜' },
}
