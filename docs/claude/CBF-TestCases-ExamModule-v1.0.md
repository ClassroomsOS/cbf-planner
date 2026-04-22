# CBF Test Cases — Módulo de Evaluación
**Versión:** 1.0.0
**Fecha:** Abril 2026
**Sistema:** CBF Planner — Exam Module
**Ambiente de prueba:** Producción (Supabase: vouxrqsiyoyllxgcriic)

---

## CONVENCIONES

**Estado:** ⬜ PENDIENTE | ✅ PASS | ❌ FAIL | 🔒 BLOCKED
**Prioridad:** 🔴 CRÍTICO | 🟠 ALTO | 🟡 MEDIO

---

## BLOQUE 1 — BASE DE DATOS (Pruebas Unitarias)

### TC-DB-001 🔴
**Descripción:** Las 10 tablas del módulo existen con sus columnas correctas
**Precondición:** Migración `create_exam_module` aplicada
**Pasos:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'assessments','assessment_versions','questions',
  'question_criteria','student_exam_sessions','submissions',
  'ai_evaluation_queue','ai_evaluations',
  'human_overrides','assessment_results'
)
ORDER BY table_name;
```
**Resultado esperado:** 10 filas, una por tabla
**Resultado real:** ___________
**Estado:** ⬜
**Evidencia:** ___________

---

### TC-DB-002 🔴
**Descripción:** RLS está habilitado en todas las tablas del módulo
**Precondición:** TC-DB-001 PASS
**Pasos:**
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'assessments','assessment_versions','questions',
  'question_criteria','student_exam_sessions','submissions',
  'ai_evaluation_queue','ai_evaluations',
  'human_overrides','assessment_results'
)
ORDER BY tablename;
```
**Resultado esperado:** 10 filas con `rowsecurity = true`
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-DB-003 🔴
**Descripción:** Los triggers de updated_at existen y están activos
**Precondición:** TC-DB-001 PASS
**Pasos:**
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_%'
AND trigger_schema = 'public'
ORDER BY event_object_table;
```
**Resultado esperado:** Al menos 7 triggers (5 updated_at + enqueue_ai + deactivate_prev)
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-DB-004 🔴
**Descripción:** El catálogo de error_codes tiene los 16 códigos iniciales
**Precondición:** Migración `create_observability_layer` aplicada
**Pasos:**
```sql
SELECT code, severity FROM error_codes ORDER BY code;
```
**Resultado esperado:** 16 filas con códigos CBF-*
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-DB-005 🟠
**Descripción:** La vista `exam_dashboard` se puede consultar sin error
**Precondición:** TC-DB-001 PASS
**Pasos:**
```sql
SELECT * FROM exam_dashboard LIMIT 1;
```
**Resultado esperado:** Sin error (puede devolver 0 filas si no hay assessments)
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-DB-006 🟠
**Descripción:** La vista `system_health` se puede consultar sin error
**Precondición:** Migración observabilidad aplicada
**Pasos:**
```sql
SELECT * FROM system_health;
```
**Resultado esperado:** Una fila con métricas en cero o null (sistema vacío)
**Resultado real:** ___________
**Estado:** ⬜

---

## BLOQUE 2 — TRIGGERS (Pruebas de Integración)

### TC-TRG-001 🔴
**Descripción:** Al insertar una submission de tipo `open_development`, el trigger la encola automáticamente
**Precondición:** Datos de prueba insertados (assessment + version + question + criteria + session)
**Pasos:**
```sql
-- 1. Insertar assessment de prueba
INSERT INTO assessments (school_id, created_by, title, subject, grade, total_points, status)
VALUES (
  'a21e681b-5898-4647-8ad9-bdb5f9844094',
  auth.uid(),
  '[TEST] Examen de prueba QA',
  'Language Arts', '9°', 10, 'active'
) RETURNING id;

-- 2. Insertar pregunta de desarrollo (usar el id del paso anterior)
INSERT INTO questions (assessment_id, school_id, position, question_type, stem, points)
VALUES ('[assessment_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094', 1, 'open_development', 'Explica qué es la fotosíntesis.', 5)
RETURNING id;

-- 3. Insertar criterios
INSERT INTO question_criteria (question_id, school_id, model_answer, key_concepts, rubric, rigor_level)
VALUES (
  '[question_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094',
  'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía.',
  ARRAY['luz solar', 'clorofila', 'glucosa', 'CO2', 'oxígeno'],
  '{"levels": [{"score": 5, "label": "Excelente", "descriptor": "Menciona todos los elementos clave con precisión"}, {"score": 3, "label": "Suficiente", "descriptor": "Menciona los conceptos principales pero incompleto"}, {"score": 1, "label": "Insuficiente", "descriptor": "Menciona el concepto pero sin desarrollo"}, {"score": 0, "label": "No responde", "descriptor": "En blanco o ininteligible"}]}',
  'flexible'
);

-- 4. Insertar sesión de estudiante
INSERT INTO student_exam_sessions (assessment_id, school_id, student_name, status)
VALUES ('[assessment_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094', 'Estudiante QA Test', 'in_progress')
RETURNING id;

-- 5. Insertar submission
INSERT INTO submissions (session_id, question_id, assessment_id, school_id, answer)
VALUES (
  '[session_id]', '[question_id]', '[assessment_id]',
  'a21e681b-5898-4647-8ad9-bdb5f9844094',
  '{"text": "La fotosíntesis es el proceso mediante el cual las plantas usan la luz solar y el CO2 para producir glucosa y oxígeno usando la clorofila."}'
);

-- 6. Verificar que el trigger encoló
SELECT * FROM ai_evaluation_queue ORDER BY queued_at DESC LIMIT 1;
```
**Resultado esperado:** Una fila en `ai_evaluation_queue` con `status = 'pending'` y `priority = 1`
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-TRG-002 🟠
**Descripción:** Una submission de tipo `multiple_choice` NO se encola en AI
**Precondición:** TC-TRG-001 PASS, datos de prueba disponibles
**Pasos:**
```sql
-- Insertar pregunta de selección múltiple
INSERT INTO questions (assessment_id, school_id, position, question_type, stem, points, options, correct_answer)
VALUES (
  '[assessment_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094',
  2, 'multiple_choice',
  '¿Cuál es la capital de Colombia?', 2,
  '[{"id":"a","text":"Bogotá","is_correct":true},{"id":"b","text":"Medellín","is_correct":false}]',
  '{"option_id":"a"}'
) RETURNING id;

-- Insertar submission de selección múltiple
INSERT INTO submissions (session_id, question_id, assessment_id, school_id, answer, auto_score, auto_correct)
VALUES ('[session_id]', '[mc_question_id]', '[assessment_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094', '{"selected_option_id":"a"}', 2, true);

-- Verificar que NO se encoló
SELECT COUNT(*) FROM ai_evaluation_queue WHERE submission_id = (SELECT id FROM submissions ORDER BY submitted_at DESC LIMIT 1);
```
**Resultado esperado:** COUNT = 0 (no encolado)
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-TRG-003 🟠
**Descripción:** El trigger `deactivate_previous_evaluations` marca evaluaciones anteriores como inactivas
**Precondición:** TC-TRG-001 PASS, al menos una evaluación AI insertada
**Pasos:**
```sql
-- Insertar evaluación manual de prueba
INSERT INTO ai_evaluations (submission_id, question_id, school_id, score_awarded, max_score, feedback, reasoning, confidence, is_active)
VALUES ('[submission_id]', '[question_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094', 3, 5, 'Primera evaluación', 'Test', 0.8, true);

-- Insertar segunda evaluación
INSERT INTO ai_evaluations (submission_id, question_id, school_id, score_awarded, max_score, feedback, reasoning, confidence, is_active)
VALUES ('[submission_id]', '[question_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094', 4, 5, 'Segunda evaluación', 'Test', 0.9, true);

-- Verificar que solo la segunda está activa
SELECT id, score_awarded, is_active FROM ai_evaluations WHERE submission_id = '[submission_id]' ORDER BY evaluated_at;
```
**Resultado esperado:** Primera evaluación con `is_active = false`, segunda con `is_active = true`
**Resultado real:** ___________
**Estado:** ⬜

---

## BLOQUE 3 — EDGE FUNCTIONS (Pruebas de Integración)

### TC-FN-001 🔴
**Descripción:** `cbf-logger` registra un evento correctamente
**Precondición:** Edge Function desplegada y activa
**Pasos:**
```bash
curl -X POST https://vouxrqsiyoyllxgcriic.supabase.co/functions/v1/cbf-logger \
  -H "Content-Type: application/json" \
  -d '{
    "module": "TEST",
    "function_name": "qa_test",
    "message": "Prueba de calidad TC-FN-001",
    "severity": "info",
    "step": "test_execution"
  }'
```
**Resultado esperado:** `{"success": true, "event_id": "[uuid]"}`
**Verificación:**
```sql
SELECT * FROM system_events WHERE module = 'TEST' ORDER BY created_at DESC LIMIT 1;
```
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-FN-002 🔴
**Descripción:** `cbf-logger` dispara alerta Telegram cuando se registra error crítico con regla activa
**Precondición:** TC-FN-001 PASS, Telegram bot token configurado
**Pasos:**
```bash
curl -X POST https://vouxrqsiyoyllxgcriic.supabase.co/functions/v1/cbf-logger \
  -H "Content-Type: application/json" \
  -d '{
    "module": "CORE",
    "function_name": "qa_test",
    "message": "Test de alerta crítica TC-FN-002",
    "severity": "critical",
    "error_code": "CBF-CORE-DB-001",
    "step": "test_alert"
  }'
```
**Resultado esperado:** Mensaje Telegram recibido en chat 2041749428 + registro en `system_alerts`
**Verificación:**
```sql
SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 1;
```
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-FN-003 🔴
**Descripción:** `exam-ai-corrector` procesa un item de la cola y guarda la evaluación
**Precondición:** TC-TRG-001 PASS (hay items en cola), ANTHROPIC_API_KEY configurada
**Pasos:**
```bash
# Invocar el corrector manualmente
curl -X POST https://vouxrqsiyoyllxgcriic.supabase.co/functions/v1/exam-ai-corrector \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Resultado esperado:**
```json
{
  "processed": 1,
  "success": 1,
  "failed": 0
}
```
**Verificación:**
```sql
-- Cola procesada
SELECT status FROM ai_evaluation_queue ORDER BY queued_at DESC LIMIT 1;
-- Evaluación guardada
SELECT score_awarded, confidence, feedback FROM ai_evaluations ORDER BY evaluated_at DESC LIMIT 1;
-- Resultado calculado
SELECT total_score, percentage, final_grade, status FROM assessment_results ORDER BY calculated_at DESC LIMIT 1;
```
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-FN-004 🟠
**Descripción:** `exam-ai-corrector` registra evento en observabilidad al procesar
**Precondición:** TC-FN-003 PASS
**Pasos:**
```sql
SELECT severity, message, step, duration_ms
FROM system_events
WHERE function_name = 'exam-ai-corrector'
ORDER BY created_at DESC LIMIT 5;
```
**Resultado esperado:** Al menos 1 evento con severity = 'info' y message sobre corrección completada
**Resultado real:** ___________
**Estado:** ⬜

---

## BLOQUE 4 — SEGURIDAD (Pruebas de Seguridad)

### TC-SEC-001 🔴
**Descripción:** Un usuario no puede acceder a assessments de otro school_id
**Precondición:** Usuario autenticado con school_id de Boston
**Pasos:**
```sql
-- Intentar ver todos los assessments sin filtro (RLS debe filtrar automáticamente)
SELECT id, school_id FROM assessments;
-- Todos los resultados deben ser del school_id del usuario autenticado
```
**Resultado esperado:** Solo filas con `school_id = 'a21e681b-5898-4647-8ad9-bdb5f9844094'`
**Resultado real:** ___________
**Estado:** ⬜

---

### TC-SEC-002 🔴
**Descripción:** Un anon puede insertar session solo si el assessment está 'active'
**Pasos:**
```sql
-- Intentar insertar session en assessment con status 'draft' (debe fallar)
INSERT INTO student_exam_sessions (assessment_id, school_id, student_name)
VALUES ('[draft_assessment_id]', 'a21e681b-5898-4647-8ad9-bdb5f9844094', 'Test anon');
```
**Resultado esperado:** Error de RLS (violación de política)
**Resultado real:** ___________
**Estado:** ⬜

---

## BLOQUE 5 — FLUJO E2E (Prueba de Punta a Punta)

### TC-E2E-001 🔴
**Descripción:** Flujo completo de examen con pregunta de desarrollo
**Este es el caso de prueba más importante. Si pasa, el sistema funciona.**

**Precondición:** Todos los casos anteriores en PASS

**Flujo:**
1. ⬜ Docente crea assessment con status 'active'
2. ⬜ Docente crea pregunta de tipo 'open_development' con criterios completos
3. ⬜ Estudiante crea session (simula acceso al exam player)
4. ⬜ Estudiante inserta submission con respuesta de texto
5. ⬜ Trigger encola la corrección automáticamente
6. ⬜ Edge Function procesa la cola (manual o por cron)
7. ⬜ Evaluación AI guardada en `ai_evaluations`
8. ⬜ Resultado calculado en `assessment_results` con nota colombiana
9. ⬜ Evento registrado en `system_events`
10. ⬜ Dashboard muestra el resultado correctamente

**Resultado esperado:** Los 10 pasos en verde
**Tiempo total del flujo:** ___________ segundos
**Nota AI asignada:** ___________
**Confianza AI:** ___________
**Nota colombiana:** ___________
**Estado general:** ⬜

---

### TC-E2E-002 🟠
**Descripción:** Flujo de corrección con baja confianza activa revisión humana
**Pasos:**
1. Insertar submission con respuesta ambigua o en idioma diferente
2. Ejecutar corrector
3. Verificar que `requires_review = true` y `confidence < 0.65`
4. Verificar evento `CBF-AI-VAL-002` en system_events

**Resultado esperado:** Evaluación marcada para revisión humana
**Estado:** ⬜

---

## REGISTRO DE EJECUCIÓN

| Fecha | Ejecutado por | Ambiente | Casos ejecutados | PASS | FAIL | BLOCKED |
|---|---|---|---|---|---|---|
| __________ | Edoardo Ortiz | Producción | ___ | ___ | ___ | ___ |

---

## LIMPIEZA POST-PRUEBA

Después de ejecutar los casos, limpiar los datos de prueba:

```sql
-- Eliminar datos de prueba (en cascada por FK)
DELETE FROM assessments WHERE title LIKE '[TEST]%';
-- Los system_events de prueba se conservan — son parte del historial
```
