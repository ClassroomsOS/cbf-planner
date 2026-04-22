# CBF Planner — Módulo de Evaluación Resiliente
## Registro de sesión de diseño y desarrollo
**Fecha:** 22 de abril de 2026
**Proyecto:** CBF Planner + ETA Platform · ClassroomsOS
**Repo:** `ClassroomsOS/cbf-planner`
**Supabase:** `vouxrqsiyoyllxgcriic` | **School ID:** `a21e681b-5898-4647-8ad9-bdb5f9844094`
**Autor:** Edoardo Ortiz · Colegio Boston Flexible · Barranquilla, Colombia

> *"El sistema trabaja. El maestro enseña."*
> *"Un examen siempre se puede correr. El sistema puede fallar — el evento pedagógico, no."*

---

## USO DE ESTE DOCUMENTO

Este archivo registra la sesión de diseño del 22 de abril de 2026, en la que se definió la arquitectura completa del Módulo de Evaluación Resiliente de CBF Planner. Cubre tres decisiones de producto fundamentales:

1. **Dónde vive el examen** — integrado en el sistema, nunca en plataformas externas
2. **Qué tan grande es el módulo** — taxonomía completa: tipos de contenido, respuesta, modalidad, corrección
3. **Cómo sobrevive un fallo** — doctrina de resiliencia, preflight, contingencias internas

En cualquier sesión futura, este documento + el Master Context 2026-04-21 reconstruyen el contexto completo.

---

## PARTE 1 — DECISIÓN DE PRODUCTO: DÓNDE VIVE EL EXAMEN

### 1.1 El punto de partida — HTML en GitHub Pages

Antes de esta sesión, el sistema de evaluación consistía en archivos HTML desplegados en GitHub Pages con las siguientes características:

- Autenticación por código + email
- 4–5 versiones anti-copia (variaciones estáticas)
- Notificaciones Telegram
- Generación de PDF
- Funcionamiento exclusivo en HTTPS

**Sus límites identificados:**
- Cada examen era un archivo manual — no escalable
- Sin conexión a los datos de Supabase (estudiantes, cursos, notas)
- El docente no podía crear exámenes sin intervención del desarrollador
- Las versiones eran permutaciones prediseñadas, no generación real

### 1.2 La pregunta que inició el diseño

> *"¿Sería más conveniente un link que el docente tiene que subir a GitHub, o sería mejor un lugar dentro del CBF Planner como un aula o área virtual en la que el alumno ingresa para hacer la prueba, y al ingresar se le genera la prueba según los lineamientos cargados por el docente, y así se generen de manera aleatoria no solo 4 o 5 modelos de un examen sino N exámenes con estructura y formas distintas?"*

### 1.3 La decisión

**El examen vive dentro del sistema. Siempre.**

| Criterio | GitHub Pages | Exam Player en CBF Planner |
|---|---|---|
| Exámenes únicos por estudiante | ❌ No | ✅ Sí (con IA) |
| El docente crea sin desarrollador | ❌ No | ✅ Sí |
| Notas van a Supabase | ❌ Manual | ✅ Automático |
| Multi-colegio | ❌ No | ✅ Nativo |
| Anti-trampa real | Parcial | ✅ Total (examen único) |
| Revisión humana | ❌ No | ✅ ReviewPanel |
| Escala a 10 colegios | ❌ No | ✅ Diseñado para eso |

### 1.4 El cambio conceptual clave

> En el modelo anterior (HTML), el examen **es** el instrumento.
> En el nuevo modelo, el examen **se deriva** del instrumento.
> **El blueprint es el instrumento.**

El docente define la **intención pedagógica**. El sistema genera el **instrumento**. La IA corrige **con criterio**. El docente firma **la nota**.

---

## PARTE 2 — TAXONOMÍA COMPLETA DEL MÓDULO

### 2.1 Principio rector del módulo

> *"Esto es un ribosoma. No es solo para algo."*

El módulo debe soportar cualquier materia, cualquier tipo de pregunta, cualquier tipo de respuesta, en cualquier dispositivo — "hasta con una plancha de cabello."

### 2.2 Tipos de contenido en una pregunta (estímulo)

```
TEXTO
  → Enunciado plano
  → Enunciado con formato (negrita, listas)
  → Pasaje de lectura (reading comprehension)
  → Instrucciones por sección

IMAGEN
  → Fotografía / ilustración
  → Diagrama etiquetado (cuerpo libre, circuitos)
  → Gráfico (barras, líneas, dispersión)
  → Modelo molecular (2D estructural)
  → Mapa / plano

AUDIO
  → Clip de listening (Language Arts)
  → Pronunciación modelo
  → Instrucción hablada

VIDEO
  → Segmento corto como estímulo
  → Demostración de experimento

FÓRMULA / NOTACIÓN
  → LaTeX renderizado (matemáticas, física, química)
  → Estequiometría
  → Ecuaciones con superíndices/subíndices

INTERACTIVO
  → Arrastra y suelta
  → Ordena secuencia
  → Completa tabla
  → Dibuja / anota sobre imagen
```

### 2.3 Tipos de respuesta del estudiante

```
SELECCIÓN
  → Multiple choice (1 correcta)
  → Multiple select (N correctas)
  → Verdadero / Falso con justificación
  → Matching (relaciona columnas)

CONSTRUCCIÓN ESCRITA
  → Respuesta corta (1–3 oraciones)
  → Párrafo / ensayo
  → Fill in the blank
  → Completar tabla

CONSTRUCCIÓN ORAL
  → Speaking: graba audio en el navegador (MediaRecorder API)
  → Read aloud: lee un texto y graba

CONSTRUCCIÓN VISUAL
  → Sube foto de trabajo en papel
  → Dibuja sobre canvas
  → Anota sobre imagen dada

NUMÉRICA / SIMBÓLICA
  → Respuesta numérica exacta
  → Respuesta con unidades
  → Escribe ecuación / fórmula
```

### 2.4 Modalidades de entrega

```
DIGITAL COMPLETO
  → Estudiante responde en pantalla
  → Cualquier dispositivo con navegador + internet

IMPRESO
  → Sistema genera PDF desde el blueprint
  → Estudiante responde en papel
  → Docente sube foto o ingresa respuestas después
  → Corrección IA ocurre igual

HÍBRIDO
  → Secciones digitales + sección impresa
  → Ejemplo: MC digital, ensayo en papel
```

### 2.5 Corrección y feedback por nivel

```
AUTOMÁTICA (sin IA)
  → Multiple choice, matching, fill-in exacto
  → Resultado instantáneo

IA — NIVEL 1: semántica
  → Respuesta corta, párrafo
  → Feedback: qué conceptos logró, qué faltó
  → Confianza + flag si necesita revisión humana

IA — NIVEL 2: oral
  → Audio de speaking transcrito
  → Evaluado por criterios: fluidez, pronunciación, contenido
  → Rubric-based score

IA — NIVEL 3: visual
  → Foto de diagrama, gráfico dibujado, trabajo en papel
  → Claude multimodal evalúa la imagen

REVISIÓN HUMANA
  → Docente ve respuesta + feedback IA + score propuesto
  → Ajusta con override
  → Firma la nota — esa es la definitiva
```

### 2.6 Stack de tecnologías por necesidad

| Necesidad | Ya existe | Falta |
|---|---|---|
| Renderizar LaTeX | — | KaTeX (1 librería) |
| Reproducir audio | HTML5 nativo | Storage en Supabase |
| Grabar speaking | MediaRecorder API ✅ | UI + upload a Storage |
| Ver imagen en pregunta | — | UI + Storage |
| Corrección IA texto | exam-ai-corrector v3 ✅ | Prompt por materia |
| Corrección IA imagen | Claude multimodal ✅ | Integración |
| Transcripción audio | — | Whisper (Edge Function) |
| PDF impreso | — | PDF generation por blueprint |
| Blueprint docente | — | ExamCreator UI + tabla |
| Feedback por pregunta | Estructura en BD ✅ | UI ReviewPanel |

### 2.7 Plan de sprints del módulo

| Sprint | Contenido |
|---|---|
| **A** | Blueprint → generación IA → respuesta texto/MC → corrección → feedback → nota |
| **B** | Audio en pregunta → Speaking → imagen en pregunta → upload foto de papel |
| **C** | LaTeX → modelos moleculares → diagramas interactivos |
| **D** | PDF generation desde blueprint → ingreso respuestas papel → corrección IA igual |

---

## PARTE 3 — DOCTRINA DE RESILIENCIA

### 3.1 El principio que lo cambia todo

> *"Las fallas deben generar alternativas autogeneradas por nosotros. Un sistema de respaldo tan bueno como el principal. Nadie va a ir a Kahoot, Quizizz — esto en este colegio sería el fin de la plataforma."*

**No existe:** "usa Kahoot mientras tanto"
**No existe:** "llena el Google Form"
**No existe:** "espera a que vuelva el internet"
**Existe:** El examen corre. Siempre. Dentro del sistema.

### 3.2 Los tres niveles de fallo

```
NIVEL 1 — Degradación parcial
  El sistema funciona pero algo específico falla
  Ejemplos: IA no responde, audio no carga, Storage lento
  Respuesta: fallback automático dentro del sistema
  El estudiante ni se entera

NIVEL 2 — Degradación severa
  El módulo de evaluación no está disponible
  Ejemplos: Supabase down, Edge Functions caídas
  Respuesta: contingencia funcional activa — dentro del sistema
  El docente recibe alerta + instrucciones en <30 segundos

NIVEL 3 — Catástrofe
  Sin internet, sin dispositivos, sin nada
  Respuesta: contingencia offline — dentro del sistema
  El evento pedagógico ocurre igual
```

### 3.3 Los modos de resiliencia

| Modo | Cuándo activa | Experiencia del estudiante |
|---|---|---|
| `full` | Todo funcionando | Experiencia completa |
| `no_realtime_ai` | claude-proxy caído | Examen normal, corrección diferida post-examen |
| `offline_sync` | Sin internet | Examen completo desde caché, sync al recuperar |
| `pdf_fallback` | Storage + IA caídos | PDF pre-generado, papel, foto después |
| `hybrid_recovery` | Combinación de fallos | Mezcla de los anteriores según disponibilidad |

### 3.4 Las contingencias — todas dentro del sistema

**Contingencia 1 — IA diferida (`delayed_ai`)**
La IA no corrige en tiempo real pero el examen corre completo. Las respuestas quedan guardadas. La corrección ocurre cuando el servicio vuelve. El docente recibe notificación cuando las notas están listas.

**Contingencia 2 — Modo offline (`offline_mode`)**
El examen se precarga completo al abrir (Service Worker). Respuestas en IndexedDB mientras trabaja. Sincronización automática al recuperar conexión. El docente ve en su monitor: "12 online, 3 en modo offline — sincronizando."

**Contingencia 3 — Modo papel (`pdf_mode`)**
El sistema pre-generó N PDFs (uno por estudiante) en T-24h, guardados en Supabase Storage. Cada PDF tiene el nombre del estudiante y una versión distinta (generada desde el blueprint). Código QR para subir foto de respuestas después. La corrección IA procesa la foto (Claude multimodal).

**Contingencia 4 — Importación manual (`manual_import`)**
Peor escenario absoluto. El docente tiene los PDFs pre-descargados. Imprime o proyecta. Estudiante responde en papel. Docente sube foto después. IA corrige la foto. La nota entra al sistema igual.

### 3.5 El panel de control del docente durante un examen

```
┌─────────────────────────────────────────────────┐
│  EXAMEN EN CURSO — 9° Rojo — Período 2          │
│  ⏱ 00:34:12 transcurridos                       │
├─────────────────────────────────────────────────┤
│  ESTUDIANTES                                     │
│  ✅ 18 activos    ⏳ 3 sin abrir    ⚠️ 1 error   │
│  📤 4 enviados                                   │
├─────────────────────────────────────────────────┤
│  SALUD DEL SISTEMA                               │
│  🟢 Supabase      🟢 IA corrector   🟢 Storage   │
│  🟡 claude-proxy  (latencia alta)               │
├─────────────────────────────────────────────────┤
│  CONTINGENCIAS LISTAS                            │
│  🔄 IA diferida   📄 PDFs (26)   📶 Modo offline │
└─────────────────────────────────────────────────┘
```

---

## PARTE 4 — ARQUITECTURA DE DATOS

### 4.1 Las tablas nuevas

```
exam_blueprints          ← El docente configura la intención pedagógica
exam_sessions            ← El evento pedagógico vivo
exam_instances           ← El examen único de cada estudiante (generado por IA)
exam_responses           ← Respuestas por pregunta (polimórficas)
exam_results             ← Resultado final calculado automáticamente
exam_preflight_log       ← Log forense de verificaciones (INMUTABLE)
exam_offline_queue       ← Respuestas offline esperando sincronización
```

### 4.2 Decisiones de arquitectura clave

| Decisión | Razón |
|---|---|
| `exam_blueprints` separado de `exam_sessions` | Un blueprint puede tener N sesiones (distintos grupos, distintos períodos) |
| `generated_questions` INMUTABLE después de generación | El examen pre-generado en T-24h siempre está disponible aunque falle la IA el día del evento |
| `response_type` como TEXT (no enum) | Extensible sin migración — mañana añades `ar_model` sin tocar el schema |
| `final_score` como columna GENERATED en PostgreSQL | `COALESCE(human_score, ai_score, auto_score)` — el docente siempre gana, garantizado por la BD |
| `response_origin` en cada respuesta | Cada respuesta sabe de dónde vino — la corrección IA es idéntica sin importar el canal |
| `resilience_mode` en `exam_sessions` | La sesión sabe en qué modo está — el panel del docente lo muestra en tiempo real |
| `exam_preflight_log` nunca se borra | Evidencia forense completa — protege al docente institucionalmente |
| `delivery_mode` en `exam_instances` | Digital, papel, offline y manual coexisten en la misma sesión |

### 4.3 Escala colombiana en la BD

```sql
-- Calculada automáticamente como columna GENERATED
colombian_grade = ROUND((1 + (total_points_earned / total_points_possible) * 4) * 10) / 10
-- 0%  → 1.0
-- 60% → 3.4
-- 100% → 5.0

-- Nivel de desempeño también calculado automáticamente
performance_level:
  S  → 4.50 – 5.00  (Superior)
  A  → 4.00 – 4.49  (Alto)
  B  → 3.50 – 3.99  (Básico)
  DB → 1.00 – 3.49  (Bajo)
```

### 4.4 Nuevos códigos de error (extienden los 16 existentes)

| Código | Severidad | Descripción |
|---|---|---|
| CBF-EXAM-PRE-001 | critical | Preflight falló el día del examen |
| CBF-EXAM-PRE-002 | warn | Preflight con advertencias — monitorear |
| CBF-EXAM-GEN-001 | error | Generación de instancia fallida |
| CBF-EXAM-GEN-002 | warn | Generación de instancia lenta (>15s) |
| CBF-EXAM-OFF-001 | info | Estudiante en modo offline — IndexedDB activo |
| CBF-EXAM-OFF-002 | warn | Sync offline fallida — reintentando |
| CBF-EXAM-OFF-003 | error | Sync offline falló todos los intentos |
| CBF-EXAM-PDF-001 | error | Generación de PDFs pre-examen fallida |
| CBF-EXAM-RES-001 | warn | Modo resiliente activado — IA diferida |
| CBF-EXAM-RES-002 | critical | Contingencia activada durante examen en vivo |
| CBF-EXAM-IMG-001 | warn | Procesamiento de foto de papel fallido |
| CBF-EXAM-HB-001 | warn | Estudiante sin heartbeat >2 minutos |

---

## PARTE 5 — SISTEMA DE PREFLIGHT (A2)

### 5.1 Los tres momentos automáticos

```
T-24h (8:00 PM noche anterior)
  → Preflight inicial
  → Auto-reparación si hay faltantes
  → Telegram con veredicto completo

T-0h (6:00 AM día del examen)
  → Preflight de confirmación
  → Verifica que las reparaciones se mantienen
  → Alerta si algo cambió

T-30min (30 minutos antes del inicio)
  → Preflight crítico pre-examen
  → Último momento de auto-reparación
  → Si falla algo aquí: modo resiliente activado automáticamente
```

### 5.2 Los 6 checks del preflight

| Check | Qué verifica | Fallo crítico | Fallo tolerable |
|---|---|---|---|
| Supabase | Latencia de BD | >2000ms | 500–2000ms |
| claude-proxy | IA disponible | No responde | Latencia >3s |
| Storage | Bucket accesible | No accesible | Latencia >1s |
| Instancias | N instancias generadas | 0 instancias | Algunas faltantes (auto-repara) |
| PDFs | N PDFs pre-generados | No aplica | Faltantes (auto-repara si Storage OK) |
| AI Corrector | exam-ai-corrector vivo | No aplica | Latencia alta (corrección diferida) |

### 5.3 La auto-reparación en cadena

```
Preflight detecta instancias faltantes
  → Llama a exam-instance-generator con los student_codes faltantes
  → Re-verifica instancias
  → Si OK: warning "reparado automáticamente"
  → Si falla: critical failure

Preflight detecta PDFs faltantes (y Storage OK)
  → Llama a exam-pdf-generator con los instance_ids sin PDF
  → Si OK: warning "PDFs generados durante preflight"
  → Si falla: warning "solo modo digital disponible"
```

### 5.4 El mensaje Telegram por veredicto

```
✅ PREFLIGHT — PASSED
  → Todo verde, latencias dentro del SLA
  → "El examen puede correr. Nada más que hacer."

⚠️ PREFLIGHT — PASSED WITH WARNINGS
  → Algo tolerable detectado (latencia alta, reparación exitosa)
  → Lista de advertencias específicas
  → Modo de resiliencia activo indicado

🚨 PREFLIGHT — FAILED
  → Fallo crítico no reparable
  → Lista de fallas con detalle
  → "Ingresa al sistema para ver opciones de contingencia."
```

### 5.5 Los 3 cron jobs

| Job | Schedule | Propósito |
|---|---|---|
| `exam-preflight-scheduler` | `0 * * * *` | Cada hora — detecta sesiones en ventana de 24h |
| `exam-preflight-pre-exam` | `*/5 * * * *` | Cada 5 min — detecta sesiones en ventana de 30min |
| (heredado) `cbf-health-snapshot` | Cada hora | Foto del estado general del sistema |

### 5.6 Reglas de alerta nuevas

| Regla | Condición | Severidad | Cooldown |
|---|---|---|---|
| `exam_preflight_failed` | Sesión con preflight failed en <24h | critical | 60 min |
| `exam_preflight_warned_close` | Sesión con warned en <2h | warn | 30 min |
| `exam_no_preflight_before_start` | Sesión sin preflight en <1h | error | 15 min |

---

## PARTE 6 — ARCHIVOS GENERADOS EN ESTA SESIÓN

| Archivo | Descripción | Destino |
|---|---|---|
| `exam-resilience-schema.sql` | Migración completa — 7 tablas, triggers, vistas, índices, códigos de error | `supabase/migrations/20260422000001_exam_resilience_layer.sql` |
| `exam-preflight/index.ts` | Edge Function completa — 6 checks, auto-reparación, Telegram, cbf-logger | `supabase/functions/exam-preflight/index.ts` |
| `exam-preflight/migration-cron.sql` | Cron jobs + reglas de alerta | `supabase/migrations/20260422000002_setup_preflight_cron.sql` |
| `exam-preflight/test-cases.sql` | 10 casos de prueba en estándar CBF | `docs/CBF-TestCases-PreflightModule-v1.0.sql` |

### Instrucciones de deploy

```
1. SQL Editor → ejecutar exam-resilience-schema.sql
   (verificar que no choca con tablas existentes del módulo anterior)

2. Configurar variables de entorno en PostgreSQL:
   ALTER DATABASE postgres SET app.supabase_url = 'https://vouxrqsiyoyllxgcriic.supabase.co';
   ALTER DATABASE postgres SET app.service_role_key = '<SERVICE_ROLE_KEY>';

3. Subir Edge Function:
   supabase/functions/exam-preflight/index.ts
   → supabase functions deploy exam-preflight

4. SQL Editor → ejecutar migration-cron.sql

5. Verificar crons activos:
   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'exam-%';

6. Test manual: llamar exam-preflight con session_id real
   → Verificar mensaje en Telegram
   → Verificar registro en exam_preflight_log
```

---

## PARTE 7 — SECUENCIA DE CONSTRUCCIÓN (ABC)

### Por qué el orden es irrompible

```
Sin A → no sabes si el sistema está listo para correr B
Sin B → no hay instancias que el ExamPlayer pueda mostrar
Sin C → el estudiante no tiene donde responder lo que B generó
```

### El mapa completo

```
A1 — Schema con resiliencia ✅ COMPLETO
A2 — exam-preflight Edge Function ✅ COMPLETO

B1 — exam-instance-generator Edge Function ← SIGUIENTE
     → Recibe blueprint_id + session_id + lista de estudiantes
     → Construye prompt pedagógico por materia
     → Llama a Claude Sonnet
     → Guarda generated_questions en exam_instances
     → Dispara generación de PDFs
     → Arma service_worker_payload en exam_sessions

B2 — exam-pdf-generator Edge Function
     → Recibe instance_id
     → Genera PDF con jsPDF desde generated_questions
     → Sube a Supabase Storage
     → Actualiza pdf_url en exam_instances

C1 — ExamPlayer — estructura base con Service Worker + IndexedDB
     → Carga instancia por student_code + access_code
     → Cachea todo al abrir (funciona offline desde ese momento)
     → Guarda respuestas en IndexedDB cada 30s
     → Sube a exam_responses al enviar

C2 — ExamPlayer — tipos de pregunta
     → MC, short answer, fill-in (Sprint C1)
     → Audio stimulus, speaking response (Sprint C2)
     → Imagen, fórmula LaTeX, diagrama (Sprint C3)

C3 — Sync engine
     → Detecta reconexión
     → Procesa exam_offline_queue
     → Notifica al panel del docente
```

---

## PARTE 8 — GLOSARIO TÉCNICO DE ESTA SESIÓN

| Término | Significado en este contexto |
|---|---|
| **Blueprint** | La intención pedagógica del docente — qué evaluar, no cómo |
| **Instance** | El examen único generado por IA para un estudiante específico |
| **Session** | El evento pedagógico — el examen en vivo con su grupo |
| **Preflight** | Verificación pre-examen automatizada con auto-reparación |
| **Resilience mode** | Estado operativo del sistema cuando algo falla |
| **Deno** | Runtime de TypeScript usado por Supabase Edge Functions — importaciones por URL, sin node_modules |
| **Service Worker** | Mecanismo del navegador que permite funcionar offline cacheando el examen completo |
| **IndexedDB** | Base de datos del navegador que guarda respuestas offline |
| **Circuit breaker** | Patrón que detecta fallos repetidos y activa el modo degradado automáticamente |
| **Heartbeat** | Ping cada 30s por estudiante para detectar desconexiones en tiempo real |
| **COALESCE** | Función SQL que elige el primer valor no nulo — `human_score` gana sobre `ai_score` |
| **GENERATED ALWAYS AS** | Columna calculada automáticamente por PostgreSQL — sin lógica en el frontend |

---

## NOTAS DE ARQUITECTURA — PRINCIPIOS QUE GUIARON ESTA SESIÓN

1. **La resiliencia es un supuesto de diseño, no una feature.** El Service Worker y el IndexedDB van desde el Sprint C1, no después.

2. **El docente siempre tiene la última palabra.** `human_score` tiene precedencia sobre `ai_score` a nivel de base de datos — no es una regla de negocio en el frontend que alguien puede saltarse.

3. **La corrección es asíncrona por naturaleza.** El examen no espera a la IA para completarse. Las respuestas se guardan, la IA corrige cuando puede, el docente firma cuando está listo.

4. **Cada respuesta sabe de dónde vino.** `response_origin` permite que la corrección IA sea idéntica sin importar si la respuesta llegó en tiempo real, por sync offline, por foto de papel, o por importación manual.

5. **El log forense nunca se borra.** `exam_preflight_log` y `system_events` son registros inmutables. Si algo sale mal, hay evidencia completa que protege al docente institucionalmente.

6. **Un blueprint, N sesiones, N² instancias.** El mismo blueprint puede usarse para 9° Rojo y 9° Azul, en el período 2 y en el período 3. Cada combinación es una sesión distinta con instancias únicas por estudiante.

---

*Documento generado el 22 de abril de 2026*
*CBF Planner + ETA Platform · ClassroomsOS · Colegio Boston Flexible · Barranquilla, Colombia*
*"El que concibe bien y construye con orden, escala."*
