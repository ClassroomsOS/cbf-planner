# CBF Planner — Roadmap Maestro
## "Nosotros diseñamos. El docente enseña."
### v2.0 — March 31, 2026

---

## Principio rector

> El diseño de esto no debe ser abrumador para el profesor.
> El profesor debe y puede salir airoso si se implementa esto bien.
> Nosotros somos quienes diseñamos para ellos, para que sea fácil y deseable aplicar.

---

## 1. ARQUITECTURA INSTITUCIONAL (Prioridad: CRÍTICA)

Estos son los cimientos. Sin esto, lo demás son piezas sueltas.

### 1.1 Roles y perfiles del sistema

| Rol | Acceso | Responsabilidades |
|---|---|---|
| **Superusuario** | TODO. Crear, modificar, borrar sin restricción | Acceso de emergencia. No puede ser bloqueado. |
| **Coordinador** | Gestión académica completa por nivel | Inscribe profesores, asigna materias/horarios, crea calendario institucional, supervisa planificaciones |
| **Director de grupo** | Vista de su grado/sección + agenda semanal | Recibe agenda automática consolidada, devocional diario, reuniones con padres |
| **Docente** | Sus materias, guías, NEWS, AI | Planifica, ejecuta, evalúa |
| **Psicopedagoga** | Crear eventos que impactan líneas de tiempo | Charlas, dinámicas, reuniones, actividades transversales |
| **Admin (actual)** | Se convierte en Coordinador o se mantiene como rol técnico | A definir |

**Acción:** Migrar el campo `teachers.role` de `text` a un sistema más robusto que soporte estos roles. Evaluar si `role` se vuelve un array o si se crea una tabla `roles`.

### 1.2 Superusuario

- Rol: `superadmin`
- Acceso: bypass total de RLS (via service_role key o política especial)
- Caso de uso: "si alguien se lleva la contraseña y se ausenta"
- Solo puede ser asignado por otro superusuario
- Mínimo 1 superusuario siempre activo en el sistema

### 1.3 Niveles escolares

```
ELEMENTARY     → Pre-K a 5th grade
MIDDLE SCHOOL  → 6th a 8th grade  
HIGH SCHOOL    → 9th a 11th grade
```

- Los eventos creados por coordinación especifican a qué nivel(es) impactan
- Las planificaciones solo ven eventos de su nivel
- Los horarios se validan dentro de su nivel (sin solapamiento)

**Acción:** Agregar campo `level` a grades/assignments. Crear tabla `school_levels` o usar un enum.

---

## 2. CALENDARIO INSTITUCIONAL (Prioridad: CRÍTICA)

El calendario es la **línea de tiempo maestra** que gobierna todo lo demás.

### 2.1 Jerarquía de líneas de tiempo

```
CALENDARIO INSTITUCIONAL (Coordinación)
  ├── Eventos por nivel (Elementary / Middle / High)
  │     ├── Eventos de Psicopedagogía
  │     ├── Reuniones institucionales
  │     └── Actividades especiales
  │
  ├── NEWS PROJECTS (por materia/grado/sección)
  │     └── Guías semanales (experiencias significativas)
  │
  └── AGENDA SEMANAL (auto-generada por grado/sección)
        └── Consolidado para Director de Grupo
```

### 2.2 Eventos institucionales mejorados

La tabla `school_calendar` ya existe pero necesita:
- `level` (elementary, middle, high, all)
- `affects_planning` (boolean) — ¿interrumpe planificaciones?
- `created_by` (FK → teachers, para saber quién lo creó)
- `event_type` (holiday, institutional, psychopedagogy, meeting, special)
- Sistema de **notificación en cascada**: cuando se crea un evento que afecta planificaciones existentes, notificar a los docentes impactados

### 2.3 Flujo de reprogramación

1. Coordinador crea evento que afecta nivel X
2. Sistema identifica guías/NEWS afectadas
3. Notificación al docente: "El evento Y afecta tu guía de la semana Z"
4. Docente + AI reprograman fechas
5. Se registra anotación/log del cambio

---

## 3. HORARIOS (Prioridad: ALTA)

### 3.1 Estado actual

- `teacher_assignments.schedule` tiene horarios en JSONB
- No hay validación de solapamiento
- No hay vista de horario por grado/sección

### 3.2 Lo que falta

- **Constructor de horarios** para el coordinador
- **Validación de solapamiento**: mismo profesor, misma hora, diferente sección = error
- **Vista de grilla**: horario semanal por grado/sección y por profesor
- **Aulas**: agregar campo de aula a la asignación para detectar conflictos de espacio

### 3.3 Tabla propuesta: `schedule_blocks`

```sql
schedule_blocks (
  id, school_id, period,
  teacher_id, subject, grade, section, level,
  day_of_week (1-5),
  start_time, end_time,
  classroom
)
```

Con constraints de unicidad para evitar solapamientos.

---

## 4. FLUJO VISUAL DEL DOCENTE (Prioridad: ALTA)

### 4.1 Orden actual (incorrecto)
```
Sidebar: Nueva Guía → Mis Guías → NEWS → Objetivos → ...
```

### 4.2 Orden correcto (flujo pedagógico)
```
Sidebar:
  🎯 Objetivos          ← Primero: qué quiero lograr
  📋 NEWS Projects       ← Segundo: proyectos con fechas y rúbricas
  📝 Nueva Guía          ← Tercero: planificación semanal (atraída por NEWS)
  📂 Mis Guías           ← Cuarto: historial
```

### 4.3 Flujo de creación de guía (mejorado)

1. Docente selecciona grado/sección/materia
2. Sistema muestra NEWS activos para esa combinación
3. Docente selecciona el NEWS al que apunta esta guía
4. Se cargan automáticamente: objetivos, textbook reference, principio bíblico
5. AI genera experiencias significativas alineadas a todo ese contexto

---

## 5. AGENDA SEMANAL AUTOMÁTICA (Prioridad: MEDIA-ALTA)

### 5.1 Concepto

Cada jueves, los directores de grupo necesitan una agenda consolidada de la semana siguiente para comunicar a padres y estudiantes.

### 5.2 Flujo

1. Cada docente crea su guía semanal por materia para un grado/sección
2. El sistema agrupa todas las guías de ese grado/sección
3. Se genera automáticamente la agenda semanal:
   - Lunes: Matemáticas → Quiz Unit 3 / Ciencias → Lab ecosistemas
   - Martes: Language Arts → Speaking practice / ...
4. El director de grupo recibe esta agenda consolidada
5. Puede editarla antes de enviar (agregar devocional, notas)

### 5.3 Tabla propuesta: `weekly_agendas`

```sql
weekly_agendas (
  id, school_id, grade, section, level,
  week_start_date,
  director_id (FK → teachers),
  content (JSONB — consolidado de guías),
  notes (text — notas del director),
  devotional (text),
  status (draft/sent),
  created_at, sent_at
)
```

---

## 6. MEJORAS INMEDIATAS (Prioridad: ALTA — se pueden hacer ya)

### 6.1 Modales: no cerrar al hacer clic fuera
- Todos los modales solo se cierran con la X
- Prevenir cierre accidental de formularios con datos

### 6.2 AI en rúbricas: auto-generar niveles intermedios
- El docente llena nivel 1 (no cumple) y nivel 5 (cumple todo)
- La AI genera niveles 2, 3 y 4 automáticamente
- Botón: "✨ Generar niveles intermedios"
- Crítico para docentes con 10+ grados

### 6.3 AI en guías: limitar caracteres por sección
- `Subject to be worked`: máx ~50 caracteres (mención corta)
- `Motivation`: 1 actividad concreta, ~150 caracteres
- `Activity`: actividad preparadora, ~200 caracteres
- `Skill Development`: la sección más larga, ~300 caracteres
- `Closing`: ~100 caracteres
- `Assignment`: ~100 caracteres
- Estos límites van al prompt del AI para que no genere bloques gigantes
- Resolver el problema de Skill Development saliendo en blanco (probablemente tokens)

### 6.4 NEWS modal: dropdowns inteligentes
- Grado: dropdown con grados ya existentes en `teacher_assignments`
- Sección: dropdown filtrado por grado seleccionado
- Materia: dropdown filtrado por grado+sección
- Evitar escritura manual, reducir errores

### 6.5 NEWS: subir imágenes del contenido programático
- En la pestaña Textbook, permitir subir fotos/scans del scope & sequence del libro
- Se guardan en Supabase Storage (`guide-images` bucket ya existe)
- La AI puede leerlas para entender qué viene en cada unidad

### 6.6 Consumo de AI por usuario
- Pendiente de sesiones anteriores
- Tracking de tokens usados por docente
- Límites configurables por el coordinador

---

## 7. FUNCIONALIDADES FUTURAS (Prioridad: MEDIA)

### 7.1 Importar guías existentes
- Subir guías .docx ya hechas
- AI las parsea y extrae: objetivos, actividades, fechas
- Se mapean al sistema para que la AI entienda "por dónde vamos"
- Permite un inicio no desde cero

### 7.2 Malla curricular integrada
- Subir o configurar la malla curricular por materia
- La AI recomienda contenidos basándose en lo que falta cubrir
- Tracking de cobertura curricular por período

### 7.3 Responsive design
- El sistema debe funcionar en celular
- Edoardo ya trabaja desde móvil para planificación
- Priorizar: NewsPage, GuideEditor, Agenda

---

## 8. LOGIN Y ONBOARDING (Prioridad: MEDIA)

### 8.1 Flujo actual
```
Login → Profile Setup → Pending Approval → Dashboard
```

### 8.2 Flujo mejorado
```
Login → 
  Si es nuevo → el COORDINADOR lo inscribe (no self-service)
  Si ya existe → Dashboard con su rol
  
Coordinador:
  Inscribe docente → Asigna materias → Asigna horario → Docente activo
```

### 8.3 Revisión de integridad
- Verificar que ProfileSetupPage funciona correctamente
- Verificar flujo de aprobación
- Verificar que roles se respetan en toda la UI

---

## 9. PSICOPEDAGOGÍA (Prioridad: MEDIA)

### 9.1 Perfil

- Rol: `psychopedagogue`
- Acceso: crear eventos por nivel/grado
- Los eventos aparecen en el calendario institucional
- Tipos: charla, dinámica, reunión, actividad

### 9.2 Impacto

- Cuando se crea un evento de psicopedagogía para 8th grade
- Todos los docentes de 8th grade reciben notificación
- Las guías afectadas se marcan
- Se sugiere reprogramación

---

## 10. ORDEN DE IMPLEMENTACIÓN SUGERIDO

### Sprint 1: Estabilización (ahora)
- [ ] Fix: modales no se cierran al clic fuera
- [ ] Fix: NEWS modal con dropdowns de grados existentes
- [ ] Fix: reordenar sidebar (Objetivos → NEWS → Nueva Guía → Mis Guías)
- [ ] AI: auto-generar niveles intermedios de rúbrica
- [ ] AI: límites de caracteres por sección en guías

### Sprint 2: Roles y estructura
- [ ] Superusuario
- [ ] Niveles escolares (Elementary/Middle/High)
- [ ] Migrar sistema de roles
- [ ] Director de grupo como rol

### Sprint 3: Calendario institucional
- [ ] Mejorar tabla school_calendar
- [ ] Eventos por nivel
- [ ] Notificación en cascada a docentes
- [ ] Eventos de psicopedagogía

### Sprint 4: Horarios
- [ ] Constructor de horarios para coordinador
- [ ] Validación de solapamiento
- [ ] Vista de grilla

### Sprint 5: Agenda automática
- [ ] Consolidación de guías por grado/sección
- [ ] Vista de director de grupo
- [ ] Exportar/enviar agenda

### Sprint 6: AI avanzado
- [ ] Consumo por usuario
- [ ] Importar guías existentes
- [ ] Malla curricular
- [ ] NEWS con imágenes de textbook

### Sprint 7: Responsive
- [ ] Mobile-first para las vistas principales
- [ ] PWA consideration

---

## 11. NOTAS TÉCNICAS

### Base de datos actual (Supabase)
```
schools
teachers (roles: teacher, admin → expandir)
teacher_assignments (schedule JSONB)
lesson_plans (content JSONB, news_project_id FK)
rubric_templates (NEW)
news_projects (NEW)
school_calendar
learning_targets
notifications
messages
plan_comments
correction_requests
announcements
checkpoints
```

### Stack
- Frontend: React + Vite, GitHub Pages
- Backend: Supabase (DB + Auth + Storage + Edge Functions)
- AI: Groq (temporal) → Anthropic Claude API (pendiente)
- Org: github.com/ClassroomsOS

---

*Documento maestro para Edoardo Ortiz · CBF Planner · ClassroomsOS*
*Actualizado: March 31, 2026*
