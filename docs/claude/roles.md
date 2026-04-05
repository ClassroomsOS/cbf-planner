# Roles y Permisos

> Decisiones de diseño extraídas de `CLAUDE.md` — última actualización 2026-04-05.

---

## Mapa completo de perfiles

| Perfil | Rol DB | Flag extra | Capacidades clave |
|---|---|---|---|
| Docente | `teacher` | — | Guías propias, NEWS propio, mensajes |
| Dir. de grupo | `teacher` | `homeroom_grade/section` | + Agenda de su grupo (siempre editable) |
| Co-teacher | `teacher` | `coteacher_grade/section` | + Ver agenda del grupo; editar solo si `director_absent_until` activo |
| Psicopedagoga | `psicopedagoga` | — | + Calendario institucional, horario, ver todos los planes |
| Rector | `rector` | — | = Coordinador completo + vista Director + feedback/revisión |
| Coordinador | `admin` | — | Gestión docentes, roles, feature flags, revisión documentos, agendas |
| Superadmin | `superadmin` | — | Todo lo anterior + identidad institucional + seguridad (`/superadmin`) |

**Decisión confirmada 2026-04-05:** Rector y Coordinador comparten **todas** las capacidades de gestión. Superadmin tendrá toggles de diferenciación fina en el futuro.

---

## Helpers de roles (`src/utils/roles.js`) — ✅ implementado

| Helper | Cubre | Notas |
|---|---|---|
| `canManage(role)` | admin, superadmin, rector | Gestión docentes, notificaciones, calendar, settings |
| `isSuperAdmin(role)` | superadmin | Panel `/superadmin`, asignar rol superadmin |
| `isRector(role)` | rector | Vista director standalone |
| `isPsicopedagoga(role)` | psicopedagoga | Calendar institucional |
| `canAccessCalendar(role)` | admin, superadmin, psicopedagoga | — |
| `canReadAllPlans(role)` | admin, superadmin, rector | Ver planes de otros docentes |
| `canViewSchedule(role)` | admin, superadmin, rector, psicopedagoga | — |
| `canManageAgendas(role)` | admin, superadmin, rector | CRUD agendas de cualquier grado |
| `canGiveFeedback(role)` | rector, admin, superadmin | FeedbackModal en DirectorPage |
| `canEditOthersDocs(role)` | admin, superadmin, rector | Editar guías/NEWS de otros |
| `isCoteacherActive(teacher)` | — | `director_absent_until` no vencida |
| `canChangeRole(actorRole, targetNewRole)` | — | Superadmin: cualquier rol. Admin/Rector: cualquier rol excepto superadmin |
| `roleLabel(role)` | — | Etiqueta legible: "Coordinador", "Rector", etc. |
| `ROLE_STYLES` | — | `{ color, bg, icon }` por rol — usado en sidebar y badges |

---

## Paneles de administración

### `/teachers` — AdminTeachersPage ✅
Accesible para `canManage()` (admin + superadmin + rector).
- Ver lista de docentes del colegio con rol, estado, asignaciones
- **Crear docente** → Edge Fn `admin-create-teacher` → recovery link
- **Editar docente** → `TeacherProfileEditor`: full_name, initials (email: read-only)
- **Eliminar docente** → `DeleteTeacherZone`: solo si 0 guías + 0 NEWS; elimina assignments + teachers row
- **CoteacherEditor** → asignar grado/sección co-teacher + fecha `director_absent_until`
- **AssignmentModal** → asignar materias/grados; conflictos de duplicado se muestran como toast externo

### `/settings` — SettingsPage ✅ (solo Coordinador/Superadmin)
- Franjas del horario (`schedule_slots`): CRUD por nivel
- Feature flags: toggles por grupo (Comunicación, IA, Editor)
- Acceso rápido a `/teachers`

### `/superadmin` — SuperAdminPage ✅ (solo Superadmin)
- Identidad institucional: nombre, DANE, resolución, código, versión, logo
- Seguridad: toggle `restrict_email_domain` + campo `email_domain`

---

## Features de revisión pendientes

### Sala de Revisión de Guías Publicadas *(pendiente)*
Lugar donde descansan las guías publicadas, organizadas por grado.
- Ruta propuesta: `/sala-revision`
- Ambos docente y coordinador/rector pueden editar, corregir, dar feedback y notificar al otro
- RLS: UPDATE en `lesson_plans` para `admin` y `rector`
- Banner "Estás editando la guía de [docente]" cuando otro perfil edita
- Modal de justificación obligatorio antes de guardar cambios de otro
- Notificación automática al dueño cuando hay cambios o feedback

### Interfaz de revisión del Coordinador *(pendiente)*
Cuando coordinador/rector edita el documento de otro:
- Modal de justificación antes de guardar
- Notificación automática al docente dueño
- Alternativa: dejar correcciones para que el docente las aplique (FeedbackModal ya existe)

### Mensajería expandida *(pendiente)*
`MessagesPage` actual → sala de chat completa: mensajes 1-a-1 + salas grupales.

→ Ver [`roadmap.md`](roadmap.md) para priorización.
