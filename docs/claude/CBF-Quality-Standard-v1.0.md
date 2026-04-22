# CBF Quality Standard
## Estándar de Calidad del Sistema CBF Planner + Módulo de Evaluación
**Versión:** 1.0.0
**Fecha:** Abril 2026
**Propietario:** ClassroomsOS / Edoardo Ortiz
**Principio rector:** *"Nosotros diseñamos. El docente enseña. El sistema responde."*

---

## 1. FILOSOFÍA DE CALIDAD

La calidad en CBF no es una revisión al final del desarrollo. Es una condición de existencia de cada componente. Un módulo que no cumple el estándar no existe — no va a producción.

La referencia es simple: **si un docente con 8 cursos puede usarlo sin ayuda, y si falla le avisamos antes de que él lo note — el estándar está cumplido.**

---

## 2. DEFINICIÓN DE "TERMINADO" (Definition of Done)

Una feature, módulo, o corrección está **terminada** cuando cumple TODOS los siguientes criterios sin excepción:

### 2.1 Código
- [ ] El código fue revisado y no tiene console.log de depuración en producción
- [ ] No hay credenciales, tokens, ni IDs hardcodeados en el código
- [ ] Todas las operaciones asíncronas tienen manejo de error explícito
- [ ] No hay `any` en TypeScript sin justificación documentada
- [ ] El código nuevo reutiliza funciones existentes cuando aplica

### 2.2 Base de datos
- [ ] Toda tabla nueva tiene `school_id` y RLS habilitado
- [ ] Toda tabla nueva tiene política de aislamiento por colegio
- [ ] Los índices están creados para los campos de búsqueda frecuente
- [ ] Las migraciones tienen nombre descriptivo en snake_case
- [ ] Las migraciones son idempotentes (pueden correr dos veces sin error)

### 2.3 Observabilidad
- [ ] Toda Edge Function nueva llama a `cbf-logger` en sus pasos críticos
- [ ] Los errores tienen código `CBF-[MOD]-[TYPE]-[NNN]` asignado
- [ ] Los errores nuevos están registrados en el catálogo `error_codes`
- [ ] Existe al menos una regla de alerta para errores críticos nuevos

### 2.4 Pruebas
- [ ] Los casos de prueba del componente están documentados (ver Documento 2)
- [ ] Los casos de prueba nivel 1 (unitario) fueron ejecutados: PASS
- [ ] Los casos de prueba nivel 2 (integración) fueron ejecutados: PASS
- [ ] El flujo E2E fue verificado al menos una vez en producción con datos reales

### 2.5 Seguridad
- [ ] Ningún dato sensible (nombres de estudiantes, notas) es accesible sin autenticación
- [ ] Las políticas anon solo permiten lo estrictamente necesario
- [ ] El componente fue revisado contra los escenarios de abuso más obvios

### 2.6 Deploy
- [ ] El Deploy Checklist fue completado (ver Documento 3)
- [ ] El sistema de observabilidad no reporta errores nuevos post-deploy
- [ ] Hay un plan de rollback documentado si algo falla

---

## 3. CLASIFICACIÓN DE BUGS

### 🔴 CRÍTICO — Respuesta en menos de 2 horas
Afecta directamente a docentes o estudiantes en uso activo. El sistema no puede continuar.
- Examen en vivo que no guarda respuestas
- Corrección AI que no funciona en absoluto
- Brecha de seguridad que expone datos de estudiantes
- Sistema completamente caído durante horario escolar (7am–3pm)

**Protocolo:** Notificación Telegram inmediata → rollback si aplica → fix → redeploy → verificación E2E → informe post-mortem.

### 🟠 ALTO — Respuesta en menos de 24 horas
Afecta funcionalidad importante pero hay workaround.
- Corrección AI con tasa de error > 20%
- Notificaciones Telegram no llegan
- Dashboard de resultados muestra datos incorrectos
- Score calculado incorrectamente

**Protocolo:** Documentar en `system_events` → fix en desarrollo → pruebas → deploy.

### 🟡 MEDIO — Respuesta en menos de 72 horas
Afecta experiencia pero no bloquea el flujo principal.
- UI con comportamiento inesperado pero funcional
- Mensajes de error poco claros para el docente
- Performance lenta (> 5 segundos en operaciones normales)

**Protocolo:** Registrar → planificar en el siguiente sprint → fix → prueba.

### 🟢 BAJO — Backlog
Mejoras, inconsistencias visuales, optimizaciones.

**Protocolo:** Registrar en backlog → priorizar cuando aplique.

---

## 4. ESTÁNDAR DE PERFORMANCE

| Operación | Tiempo máximo aceptable | Tiempo ideal |
|---|---|---|
| Cargar CBF Planner | 3 segundos | < 1.5s |
| Generar guía con AI | 15 segundos | < 8s |
| Crear examen con AI | 20 segundos | < 10s |
| Estudiante abre examen | 3 segundos | < 1.5s |
| Guardar respuesta | 1 segundo | < 500ms |
| Corrección AI (desarrollo) | 60 segundos | < 30s |
| Cargar dashboard de resultados | 3 segundos | < 1.5s |

Si una operación supera el tiempo máximo aceptable en producción, se registra automáticamente como `CBF-CORE-PERF-001` y entra al backlog de optimización.

---

## 5. ESTÁNDAR DE DISPONIBILIDAD

**Horario crítico:** Lunes a viernes, 6:30am – 3:30pm (hora Colombia)
**Disponibilidad mínima en horario crítico:** 99.5%
**Disponibilidad mínima fuera de horario:** 95%

Cualquier caída en horario crítico es un bug **CRÍTICO** independientemente de su causa.

---

## 6. ESTÁNDAR DE CORRECCIÓN AI

La corrección AI es el componente más sensible del sistema porque afecta directamente las notas de los estudiantes. El estándar es:

| Métrica | Mínimo aceptable | Objetivo |
|---|---|---|
| Tasa de éxito de corrección | 95% | > 99% |
| Tiempo de corrección P95 | 60 segundos | < 30s |
| Confianza promedio | > 0.70 | > 0.85 |
| Correcciones que requieren revisión humana | < 20% | < 10% |

Si la tasa de éxito cae por debajo del 95% en cualquier período de 1 hora, se dispara alerta `CBF-OBS-PERF-001`.

---

## 7. ESTÁNDAR DE SEGURIDAD ACADÉMICA

El sistema de detección de trampa es una herramienta de apoyo al docente, no un juez automático. El estándar es:

- El sistema **detecta y registra** — nunca **sanciona automáticamente**
- Toda alerta de integridad llega al docente con contexto, no solo con un número
- El docente siempre tiene la última palabra sobre la validez de un examen
- Los falsos positivos son preferibles a los falsos negativos en detección de trampa

---

## 8. ESTÁNDAR DE DATOS

- Ningún dato de estudiante menor de edad puede salir del sistema Supabase hacia servicios externos, excepto: nombre y nota hacia Telegram del docente autorizado
- Los datos de un colegio nunca son accesibles desde otro colegio, en ninguna circunstancia
- Los backups de Supabase deben estar verificados activos (verificar mensualmente)
- Los datos de exámenes se conservan mínimo 1 año académico completo

---

## 9. ESTÁNDAR DE DOCUMENTACIÓN

Todo componente nuevo debe tener documentado:
1. **Qué hace** — una oración
2. **Por qué existe** — decisión pedagógica o técnica que lo justifica
3. **Cómo falla** — qué errores puede generar y cuáles son sus códigos
4. **Cómo se prueba** — referencia al caso de prueba correspondiente

Este estándar aplica a: tablas de base de datos, Edge Functions, componentes React, y reglas de negocio.

---

## 10. CONTROL DE VERSIONES DE ESTE DOCUMENTO

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0.0 | Abril 2026 | Versión inicial — CBF Planner + Módulo de Evaluación |

*Este documento se revisa al inicio de cada trimestre académico o cuando se incorpora un módulo mayor al sistema.*
