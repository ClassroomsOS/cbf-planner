# Auditoría Integral del Sistema — 2026-05-16

> **Alcance:** Frontend (bugs, React), Seguridad, Arquitectura/Performance, Base de Datos/Edge Functions
> **Ejecutada por:** Claude Opus 4.6 — análisis automatizado de código fuente
> **Fecha:** 16 de mayo de 2026

---

## Resumen Ejecutivo

| Severidad | Cantidad | Corregidos | Estado |
|-----------|----------|------------|--------|
| CRÍTICA   | 5        | 5 ✅       | Completado |
| ALTA      | 12       | 11 ✅      | 1 falso positivo (A-5) |
| MEDIA     | 16       | 11 ✅      | 3 backlog (M-2, M-9, M-11), 2 N/A (M-1 masked, M-5 correct) |
| BAJA      | 5        | 3 ✅       | 2 son Fase 3 (props drilling, multi-school) |
| **Total** | **38**   | **30 corregidos** | |

---

## 🔴 HALLAZGOS CRÍTICOS (5)

### C-1. Componentes anidados en ExamPlayerV2Page causan remontaje constante

**Archivo:** `src/pages/ExamPlayerV2Page.jsx` — líneas 194, 358, 429, 1013
**Tipo:** Bug de React / Integridad de examen

`ExamPhase`, `EntryPhase`, `InstructionsPhase` y `SubmittedPhase` están definidos como funciones dentro del componente padre. React ve una referencia de componente nueva en cada re-render → desmonta y remonta el componente hijo en cada cambio de estado.

**Impacto:**
- Los event listeners anti-trampa (visibility, blur, fullscreen, keydown) se desmontan y remontan en cada respuesta del estudiante. Durante el gap, violaciones pueden no detectarse.
- El `setInterval` del timer se destruye y recrea cada segundo.
- Degradación de performance significativa.

**Fix:** Extraer `ExamPhase`, `EntryPhase`, `InstructionsPhase`, `SubmittedPhase` como componentes separados fuera del cuerpo del componente padre (archivos separados o al menos definidos fuera de la función).

---

### C-2. RLS de exam_instances permite lectura anónima sin filtro de sesión

**Archivo:** `supabase/migrations/20260422000003_exam_player_anon_rls.sql` — línea 13
**Tipo:** Seguridad / Exposición de datos

```sql
CREATE POLICY "exam_instances_anon_read" ON exam_instances
  FOR SELECT TO anon
  USING (instance_status IN ('ready', 'started', 'submitted'));
```

Cualquier usuario anónimo puede leer TODAS las instancias de examen con esos estados, sin importar a qué sesión o estudiante pertenecen.

**Fix:** Deshabilitar esta policy y forzar lectura solo vía RPC `get_exam_instance_safe()`, o agregar filtro por `session_id`.

---

### C-3. Policies anon de exam_responses con `WITH CHECK (true)`

**Archivo:** `supabase/migrations/20260422000003_exam_player_anon_rls.sql` — líneas 24-35
**Tipo:** Seguridad

```sql
CREATE POLICY "exam_responses_anon_insert" ON exam_responses
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "exam_offline_queue_anon_insert" ON exam_offline_queue
  FOR INSERT TO anon WITH CHECK (true);
```

Un usuario anónimo puede insertar respuestas para CUALQUIER instancia de examen.

**Fix:** Agregar validación que la instancia pertenezca a una sesión activa y esté asociada al estudiante autenticado via entry.

---

### C-4. Columnas incorrectas en query de ExamCreatorPage

**Archivo:** `src/pages/ExamCreatorPage.jsx` — línea 131
**Tipo:** Bug funcional

`.select('week, content')` consulta columnas que no existen en `syllabus_topics`. Las columnas reales son `week_number` y `topic`. Supabase no da error pero retorna null.

**Impacto:** El contexto de syllabus que se pasa a la IA para generar exámenes siempre está vacío → exámenes generados sin contexto temático.

**Fix:** Cambiar a `.select('week_number, topic, indicator_id')`.

---

### C-5. Race condition en registro de violaciones del ExamPlayer

**Archivo:** `src/pages/ExamPlayerV2Page.jsx` — líneas 854-861
**Tipo:** Integridad de datos

Las actualizaciones de `tab_switches` e `integrity_flags` se hacen "fire and forget" sin orden garantizado. Múltiples violaciones simultáneas pueden sobreescribirse mutuamente.

**Impacto:** El conteo de violaciones puede ser menor al real; falsos negativos en detección de trampa.

**Fix:** Implementar cola secuencial de updates o usar `tab_switches = tab_switches + 1` en SQL con RPC.

---

## 🟠 HALLAZGOS DE SEVERIDAD ALTA (12)

### A-1. innerHTML sin sanitización en AgendaPage

**Archivo:** `src/pages/AgendaPage.jsx` — líneas 51-56
**Tipo:** XSS

`htmlToText()` usa `div.innerHTML = html` para extraer texto. Aunque el resultado final usa `textContent`, el parsing ejecuta scripts durante la asignación a innerHTML.

**Fix:** Usar DOMPurify o asignar directamente a `textContent` si solo se quiere texto plano.

---

### A-2. innerHTML concatenado en smartBlockHtml.js (11+ instancias)

**Archivo:** `src/utils/smartBlockHtml.js` — líneas 600, 606, 645, 651, 702, 709, 755-756, 798-799
**Tipo:** XSS potencial

Aunque actualmente los valores son numéricos/controlados, si los datos de SmartBlocks son modificados por fuente no confiable, XSS es posible.

**Fix:** Usar `textContent` para actualizaciones simples; DOMPurify para HTML.

---

### A-3. Anon key expuesta en headers de fetch (ExamPlayer + AdminTeachers)

**Archivos:** `src/pages/ExamPlayerV2Page.jsx:840`, `src/pages/AdminTeachersPage.jsx:296`
**Tipo:** Seguridad

La anon key se pasa manualmente en headers de fetch a Edge Functions. Aunque tiene permisos limitados por RLS, expone la key a manipulación.

**Fix:** Usar `supabase.functions.invoke()` que maneja auth automáticamente.

---

### A-4. N+1 queries en GuideEditorPage (handleRelinkIndicator)

**Archivo:** `src/pages/GuideEditorPage.jsx` — líneas 1192-1199
**Tipo:** Performance

Loop que ejecuta una query por `achievement_goal` para obtener indicadores.

**Fix:** Usar `.in('goal_id', goalIds)` en una sola query.

---

### A-5. N+1 queries en NewsProjectEditor

**Archivo:** `src/components/news/NewsProjectEditor.jsx` — líneas 126-128
**Tipo:** Performance

Loop que ejecuta una query por cada grado en `gradesToTry`.

**Fix:** Usar `.in('grade', gradesArray)` en una sola query.

---

### A-6. Missing NOT NULL en exam_instances.student_email

**Archivo:** `supabase/migrations/20260422000004_school_students_roster.sql` — línea 66
**Tipo:** Integridad de datos

Columna añadida como nullable pero el RPC `get_exam_instance_safe()` requiere email válido. Valores NULL rompen silenciosamente el filtro.

**Fix:** `ALTER TABLE exam_instances ALTER COLUMN student_email SET NOT NULL;` (previa limpieza de datos).

---

### A-7. Missing index en exam_instances(school_id, instance_status)

**Tipo:** Performance

Las RLS policies usan `school_id` frecuentemente pero no hay índice compuesto. Causa full table scans.

**Fix:** `CREATE INDEX idx_exam_instances_school_status ON exam_instances(school_id, instance_status);`

---

### A-8. Policy instances_school demasiado amplia

**Archivo:** `supabase/migrations/20260422000001_exam_resilience_layer.sql` — línea 615
**Tipo:** Seguridad

```sql
CREATE POLICY "instances_school" ON exam_instances FOR ALL
  USING (school_id = get_my_school_id());
```

Da acceso total a TODAS las instancias de la escuela a cualquier docente. Teacher A puede ver/modificar datos de exámenes de Teacher B.

**Fix:** Restringir a owner de la sesión + admins para SELECT.

---

### A-9. `colombian_grade` no existe en student_activity_grades

**Archivo:** `src/pages/GradingSessionPage.jsx` — línea 116
**Tipo:** Bug funcional

El cálculo de promedios usa `g.colombian_grade` que no existe en la tabla. Siempre retorna `undefined` → promedio = 0 o NaN.

**Fix:** Usar `(g.score / g.max_score) * 4 + 1` según la fórmula CBF.

---

### A-10. beforeunload nunca se remueve correctamente

**Archivo:** `src/pages/ExamPlayerV2Page.jsx` — línea 926
**Tipo:** Bug

`window.removeEventListener('beforeunload', () => {})` crea función anónima nueva → no matchea el handler original → never removed.

**Fix:** Almacenar referencia del handler y usar esa referencia en `removeEventListener`.

---

### A-11. Library shares RLS permite revocar shares de admin

**Archivo:** `supabase/migrations/20260508000002_library_sharing_history.sql` — líneas 48-56
**Tipo:** Seguridad

La policy `shares_owner_manage` permite al dueño del documento gestionar shares creados por un admin.

**Fix:** Restringir a `shared_by = auth.uid()` sin la segunda condición.

---

### A-12. Error handling ausente en fetch de school_calendar

**Archivo:** `src/pages/GuideEditorPage.jsx` — líneas 880-900
**Tipo:** Resiliencia

Query usa `.then()` sin `.catch()`. Si la red falla, `dayCalendarEvents` queda vacío sin indicación al usuario.

**Fix:** Agregar manejo de error con toast de advertencia.

---

## 🟡 HALLAZGOS DE SEVERIDAD MEDIA (16)

| # | Archivo | Descripción | Estado |
|---|---------|-------------|--------|
| M-1 | `ExamPlayerV2Page.jsx:583` | Timer useEffect con stale closure de `handleSubmit` (masked by C-1) | ⚪ Masked por C-1 fix |
| M-2 | `ExamCreatorPage.jsx:132` | Query a syllabus_topics sin filtrar por `teacher_id` | 🟡 Backlog — requiere análisis de permisos |
| M-3 | `PlannerPage.jsx:267-269` | useEffect con deps incompletas (no incluye `availableSubjects`) | ✅ Corregido |
| M-4 | `GuideEditorPage.jsx:496-518` | Cancelled flag no cancela fetch in-flight (necesita AbortController) | ✅ Corregido |
| M-5 | `GuideEditorPage.jsx:242` | Dependencia inestable `Object.keys().sort().join()` causa re-fetches | ⚪ Ya correcto (primitivo estable) |
| M-6 | `LibraryPage.jsx` | Queries sin `.limit()` — carga TODOS los docs sin paginación | ✅ Corregido (.limit(200)) |
| M-7 | `StudentsPage.jsx` | Sin paginación en roster (500+ students = memory bloat) | ✅ Corregido (.limit(500)) |
| M-8 | `LibraryPage.jsx:779` | PDFJS_WORKER_URL hardcodeado — silent fail si se actualiza pdfjs-dist | ✅ Corregido (import version) |
| M-9 | Múltiples archivos | `confirm()` nativo viola Rule #10 (NUNCA window.alert) | 🟡 Backlog — 16 archivos, refactor extenso |
| M-10 | `exam-integrity-alert/index.ts:97` | `event_type` no validado contra whitelist → inyección en Telegram | ✅ Corregido |
| M-11 | Múltiples archivos | Saves multi-paso sin transaccionalidad (partial corruption posible) | 🟡 Backlog — requiere RPCs en DB |
| M-12 | `GuideEditorPage.jsx` | Auto-save cada 30s incluso sin cambios (writes innecesarios) | ✅ Ya tenía guard (dirtyRef.current) |
| M-13 | `vite.config.js` | Sin code-splitting para páginas grandes (bundle inicial inflado) | ✅ Corregido (React.lazy) |
| M-14 | `AchievementsPage.jsx:670-678` | `connectionsCache` stale en closure de `loadConnections` | ✅ Corregido (useRef) |
| M-15 | `exam_sessions.access_code` | Sin UNIQUE constraint — colisión teórica posible | ✅ Corregido (migración) |
| M-16 | `library_fragments.created_by` | FK sin ON DELETE SET NULL — orphan si teacher se elimina | ✅ Corregido (migración) |

---

## 🟢 HALLAZGOS DE SEVERIDAD BAJA (5)

| # | Descripción |
|---|-------------|
| L-1 | Props drilling de `teacher` por 15+ páginas (TeacherContext pendiente — Fase 3) |
| L-2 | Magic numbers hardcodeados (60000ms, 1_500_000 bytes, etc.) sin constantes |
| L-3 | Realtime subscription solo filtra un school_id (edge case multi-school) |
| L-4 | `admin-create-teacher` no instrumenta con cbf-logger |
| L-5 | `library_rollback` RPC — cast `file_size::bigint` falla si es NULL en snapshot |

---

## Plan de Acción Recomendado

### Sprint Inmediato (antes del próximo deploy)

| Prioridad | Issue | Esfuerzo | Impacto |
|-----------|-------|----------|---------|
| 1 | C-1: Extraer componentes del ExamPlayer | 2h | Integridad examen |
| 2 | C-2 + C-3: Fix RLS anon policies | 1h | Seguridad crítica |
| 3 | C-4: Fix columnas en ExamCreator | 10min | Calidad IA |
| 4 | C-5: Cola secuencial de violations | 1h | Integridad datos |
| 5 | A-9: Fix cálculo promedio en Grading | 15min | Bug visible |

### Sprint Siguiente

| Prioridad | Issues | Esfuerzo |
|-----------|--------|----------|
| 1 | A-1, A-2: Sanitizar innerHTML | 2h |
| 2 | A-3: Migrar fetch → supabase.functions.invoke() | 1h |
| 3 | A-4, A-5: Eliminar N+1 queries | 1h |
| 4 | A-6, A-7: Migration NOT NULL + índices | 30min |
| 5 | A-8: Restringir policy instances_school | 30min |
| 6 | M-6, M-7: Paginación en Library y Students | 3h |

### Backlog (Fase 3)

- Code splitting con lazy imports
- TeacherContext para eliminar props drilling
- Auto-save basado en cambios (debounce) vs polling
- AbortController en fetches cancelables
- Transaccionalidad via RPCs para saves multi-paso

---

## Notas Metodológicas

- Análisis estático de código fuente — no se ejecutaron tests de penetración reales
- Las severidades de seguridad asumen que RLS está activo y configurado (lo cual mitiga varios hallazgos)
- Los hallazgos de performance son estimaciones basadas en patrones de código, no mediciones reales de latencia
- Se recomienda validar C-2 y C-3 con un test manual: intentar leer instancias ajenas con un anon token

---

*Auditoría generada el 2026-05-16 por Claude Opus 4.6*
*CBF Planner · ETA Platform · Barranquilla, Colombia*
