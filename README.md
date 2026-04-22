# CBF Planner
### La plataforma pedagógica que le devuelve el tiempo al docente.

> *"Nosotros diseñamos. El docente enseña."*

---

## ¿Qué problema resuelve?

Un docente colombiano de secundaria puede tener hasta 8 cursos simultáneos, dos materias diferentes, y la responsabilidad de planear, ejecutar, evaluar, y reportar — todo en el mismo día.

El tiempo que un docente invierte en diseñar una guía, construir un examen, o corregir 100 respuestas de desarrollo es tiempo que no está frente a sus estudiantes. **CBF Planner existe para eliminar esa fricción.**

No es una plataforma de contenido. Es una plataforma de diseño pedagógico con inteligencia artificial integrada — construida desde adentro de un colegio real, por alguien que enseña todos los días.

---

## ¿Qué hace?

CBF Planner es un sistema institucional de planificación pedagógica que cubre el ciclo completo de la práctica docente:

**Planificación**
El docente describe su objetivo de aprendizaje. El sistema genera la guía semanal completa en el formato institucional, con actividades por fecha, indicadores de logro (cognitivo, procedimental, actitudinal), y principio bíblico de la semana — lista para imprimir o exportar a Word.

**Evaluación**
El docente describe el tema y el grado. El sistema genera el examen completo con preguntas de selección múltiple, verdadero/falso, y desarrollo — diferenciado por estudiante para hacer la copia estructuralmente imposible. La corrección de preguntas abiertas es automática, con rúbrica pedagógica y nota en escala colombiana (1.0–5.0).

**Seguridad académica**
Durante el examen, el sistema detecta cambios de pestaña, intentos de copia, y pérdida de foco — y notifica al docente en tiempo real por Telegram. El docente siempre tiene la última palabra.

**Observabilidad**
El sistema se monitorea a sí mismo. Cada error tiene un código único (`CBF-[MÓDULO]-[TIPO]-[NNN]`), una severidad, y un protocolo de resolución. Los errores críticos notifican automáticamente al administrador. El sistema sabe cuándo algo falla antes de que alguien lo reporte.

---

## ¿Por qué CBF Planner y no otra herramienta?

La mayoría de plataformas educativas están diseñadas para estudiantes. CBF Planner está diseñado para docentes — específicamente para docentes que no tienen tiempo.

**El docente no configura rúbricas. El AI las genera y el docente las aprueba.**
**El docente no sube archivos a GitHub. El sistema publica los exámenes automáticamente.**
**El docente no lee 100 respuestas de desarrollo. El AI las corrige y el docente revisa los casos dudosos.**

Cada decisión de diseño tiene una justificación pedagógica. No construimos features — construimos tiempo para los docentes.

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  CBF Planner                     │
│              React + Vite (SPA)                  │
│         classroomsos.github.io/cbf-planner       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                 Supabase                         │
│                                                  │
│  PostgreSQL         Auth          Storage        │
│  (40+ tablas)    (docentes)    (imágenes/docs)   │
│                                                  │
│  Edge Functions:                                 │
│  ├── claude-proxy        AI generation           │
│  ├── exam-ai-corrector   Cola de corrección AI   │
│  ├── cbf-logger          Observabilidad          │
│  └── admin-create-teacher  Gestión de usuarios   │
│                                                  │
│  pg_cron:                                        │
│  ├── exam-ai-corrector-0   Cada minuto           │
│  ├── cbf-health-snapshot   Cada hora             │
│  └── auto-confirm-overrides  Cada hora           │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              Anthropic Claude                    │
│         claude-sonnet-4-20250514                 │
│                                                  │
│  · Generación de guías pedagógicas               │
│  · Generación de exámenes diferenciados          │
│  · Corrección de preguntas de desarrollo         │
│  · Generación de rúbricas                        │
└─────────────────────────────────────────────────┘
```

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Anthropic Claude Sonnet |
| Storage | Supabase Storage |
| Deploy | GitHub Pages (frontend) + Supabase (backend) |
| Notificaciones | Telegram Bot API |
| Crons | pg_cron + pg_net |

---

## Estructura del repositorio

```
cbf-planner/
├── src/
│   ├── components/         Componentes React
│   │   ├── auth/           Login y autenticación
│   │   ├── planner/        Módulo de planificación
│   │   ├── exams/          Módulo de evaluación
│   │   └── shared/         Componentes comunes
│   ├── lib/
│   │   ├── supabase.ts     Cliente Supabase
│   │   └── constants.ts    Constantes del sistema
│   ├── hooks/              Custom hooks
│   ├── types/              TypeScript types
│   └── utils/              Utilidades
├── supabase/
│   ├── functions/          Edge Functions (Deno)
│   │   ├── claude-proxy/
│   │   ├── exam-ai-corrector/
│   │   ├── cbf-logger/
│   │   └── admin-create-teacher/
│   └── migrations/         Migraciones SQL ordenadas
├── docs/
│   ├── CBF-Quality-Standard-v1.0.md
│   ├── CBF-TestCases-ExamModule-v1.0.md
│   ├── CBF-Deploy-Checklist-v1.0.md
│   └── ROADMAP.md
├── public/
├── index.html
├── vite.config.ts
└── README.md
```

---

## Variables de entorno

### Frontend (`.env.local`)
```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

### Edge Functions (Supabase Secrets)
```
ANTHROPIC_API_KEY      API key de Anthropic Claude
TELEGRAM_BOT_TOKEN     Token del bot de notificaciones
SUPABASE_URL           URL del proyecto (automática)
SUPABASE_SERVICE_ROLE_KEY  Service role key (automática)
```

---

## Deploy

### Frontend
```bash
npm install
npm run build
# GitHub Actions despliega automáticamente a GitHub Pages en push a main
```

### Base de datos
Las migraciones se aplican en orden desde `supabase/migrations/`. Cada migración tiene nombre descriptivo y es idempotente.

### Edge Functions
```bash
supabase functions deploy claude-proxy
supabase functions deploy exam-ai-corrector
supabase functions deploy cbf-logger
supabase functions deploy admin-create-teacher
```

---

## Jerarquía pedagógica del sistema

```
Institución
  └── Nivel educativo (Primaria / Básica / Media)
        └── Asignación docente (materia + grado)
              └── NEWS (proyecto de aprendizaje backward design)
                    └── Learning Targets (objetivos específicos)
                          └── Guides (guías semanales)
                                └── Checkpoints (evaluaciones formativas)
                                      └── Assessments (exámenes formales)
```

---

## Estado actual del sistema

Lo que existe hoy en producción. Verificado y funcionando.

| Módulo | Estado | Descripción |
|---|---|---|
| Autenticación | ✅ Producción | Roles: superadmin, coordinador, director de grupo, psicopedagogo, docente |
| Calendario institucional | ✅ Producción | Festivos, semanas, notificaciones en cascada |
| Horario | ✅ Producción | Constructor con validación de cruces |
| Agenda semanal | ✅ Producción | Generación automática desde el horario |
| NEWS | ✅ Producción | Framework de diseño backward design |
| Generador de guías | ✅ Producción | AI + exportación DOCX en formato institucional y formato CBF |
| Observabilidad | ✅ Producción | CBF Observability Layer — códigos de error CBF-[MOD]-[TYPE]-[NNN], alertas automáticas, health snapshots |
| Módulo de evaluación — Backend | ✅ Producción | 10 tablas, triggers, cola AI, corrección con Claude, escala colombiana |
| Módulo de evaluación — Frontend | 🔨 En desarrollo | Pantalla de creación, dashboard de resultados, revisión humana |

---

## Lo que viene

Funcionalidades comprometidas en desarrollo activo o planificadas formalmente. Ver `/docs/ROADMAP.md` para el detalle completo.

**Próximas 2 semanas:**
- Frontend completo del módulo de evaluación (creación de examen con AI, dashboard de resultados, revisión humana)
- Exam player integrado al flujo del Planner
- Primer examen real aplicado en clase

**Próximo mes:**
- Exámenes diferenciados por estudiante (N versiones del mismo examen)
- Dashboard de salud del sistema visible para superadmin
- Auditoría formal de seguridad del exam player

**Visión estratégica — ETA Platform:**
CBF Planner es la primera capa de la Experiencia Total de Aprendizaje. Las capas siguientes — producción multimedia, experiencias interactivas para estudiantes, evaluación con memoria acumulada, e instrucción diferenciada por AI — están definidas arquitecturalmente pero no tienen fecha de desarrollo comprometida.

---

## Estándar de calidad

Este proyecto implementa el **CBF Quality Standard v1.0** — un estándar formal que define qué significa "terminado", cómo se clasifican los bugs, y qué protocolos aplican en cada falla.

Ver `/docs/CBF-Quality-Standard-v1.0.md` para el estándar completo.

Cada error del sistema tiene un código único con formato `CBF-[MÓDULO]-[TIPO]-[NNN]` y un protocolo de resolución documentado. El sistema se monitorea a sí mismo y notifica al administrador antes de que un usuario reporte un problema.

---

## Decisiones de arquitectura

Esta sección documenta las decisiones técnicas más importantes del sistema, el razonamiento detrás de cada una, y los compromisos que implican. Un sistema que no puede explicar sus propias decisiones no es un sistema maduro.

---

### ADR-001 — React + Vite sobre Next.js o frameworks más completos
**Decisión:** SPA con React y Vite, desplegada en GitHub Pages.
**Por qué:** CBF Planner es una aplicación de uso interno institucional, no un sitio público indexable. No necesita SSR ni SEO. GitHub Pages es gratuito, confiable, y elimina la fricción de deploy para un equipo pequeño.
**Compromiso:** Sin routing server-side. Sin deploy automático de backend. Aceptado conscientemente.

---

### ADR-002 — Supabase sobre Firebase, PlanetScale, u otras alternativas
**Decisión:** Supabase como backend completo (PostgreSQL + Auth + Storage + Edge Functions).
**Por qué:** PostgreSQL permite Row Level Security nativo — la única forma confiable de garantizar aislamiento de datos entre colegios a nivel de base de datos, no de aplicación. Firebase no tiene RLS. El aislamiento multi-tenant es un requerimiento no negociable.
**Compromiso:** Vendor lock-in parcial con Supabase. Mitigado por el hecho de que el core es PostgreSQL estándar y las migraciones son SQL puro exportable.

---

### ADR-003 — `school_id` en absolutamente todas las tablas
**Decisión:** Cada tabla del sistema tiene `school_id` con política RLS que filtra por `get_my_school_id()`.
**Por qué:** Multi-tenancy desde el diseño, no como feature posterior. Un segundo colegio es una fila en `schools`. No hay riesgo de que los datos de un colegio sean visibles desde otro — la restricción vive en la base de datos, no en el código de la aplicación.
**Compromiso:** Mayor complejidad en migraciones. Aceptado porque el costo de añadir multi-tenancy después es exponencialmente mayor.

---

### ADR-004 — `question_type` como TEXT abierto, no como ENUM
**Decisión:** El tipo de pregunta en el módulo de evaluación es un campo TEXT sin restricción de enum.
**Por qué:** Los enums en PostgreSQL son costosos de modificar en producción con datos reales. Mañana podemos añadir `audio_response`, `image_annotation`, o cualquier tipo nuevo sin una migración destructiva. La validación ocurre en la aplicación, no en la base de datos.
**Compromiso:** Menos garantía de integridad a nivel de DB. Compensado con validación en Edge Functions y tipos TypeScript estrictos en el frontend.

---

### ADR-005 — Corrección AI como cola asíncrona, no síncrona
**Decisión:** Las respuestas de desarrollo se encolan en `ai_evaluation_queue` y se procesan por un cron, no en tiempo real durante el submit del estudiante.
**Por qué:** 30 estudiantes enviando simultáneamente = 30 llamadas concurrentes a Anthropic. El rate limit de la API y los tiempos de respuesta variables harían la experiencia impredecible. La cola permite procesar en lotes controlados, reintentar fallos automáticamente, y priorizar exámenes en vivo sobre revisiones tardías.
**Compromiso:** El estudiante no ve su nota inmediatamente al enviar. Ve "en revisión". Aceptado pedagógicamente — la espera de minutos es razonable para una corrección de calidad.

---

### ADR-006 — Observabilidad desde el día uno, no como feature posterior
**Decisión:** El sistema de observabilidad (CBF Observability Layer) fue construido antes del primer examen real.
**Por qué:** Un sistema sin observabilidad en producción es una caja negra. Cuando algo falla — y algo siempre falla — sin observabilidad el tiempo de diagnóstico se multiplica por 10. Los códigos de error `CBF-[MOD]-[TYPE]-[NNN]` permiten identificar, documentar, y resolver cualquier falla con precisión quirúrgica.
**Compromiso:** Tiempo de desarrollo adicional antes del primer deploy real. Recuperado en el primer incidente en producción que se resuelve en minutos en lugar de horas.

---

### ADR-007 — El docente no configura, el docente aprueba
**Decisión:** El AI genera rúbricas, criterios, y preguntas automáticamente. El docente las revisa y aprueba, no las construye desde cero.
**Por qué:** El problema de adopción de herramientas pedagógicas no es técnico — es de tiempo. Un docente con 8 cursos no tiene 20 minutos para configurar criterios. Si la herramienta requiere más tiempo que el proceso manual, nadie la usa. La UI que genera y propone es radicalmente más adoptable que la UI que solicita.
**Compromiso:** Dependencia de la calidad del AI para el primer draft. Mitigado con prompts pedagógicamente diseñados y siempre con revisión humana como paso final.

---

### Lo que el sistema NO hace (y por qué)

| Lo que no hace | Por qué es una decisión, no una limitación |
|---|---|
| No gestiona calificaciones del libro de notas | Eso lo hace el sistema institucional existente. Duplicar es un error de scope. |
| No tiene app móvil nativa | El exam player es HTML responsive. Una app nativa añade complejidad de deploy sin beneficio real para el caso de uso. |
| No almacena videos o audio de estudiantes | Implicaciones legales con menores de edad en Colombia que superan el beneficio pedagógico actual. |
| No tiene chat en tiempo real entre docentes | Fuera del scope del producto actual. Telegram cumple esa función con cero desarrollo. |

---

## Contexto institucional

CBF Planner fue desarrollado para **Colegio Boston Flexible (CBF)** en Barranquilla, Colombia — un colegio cristiano con énfasis en flexibilidad pedagógica y formación en cosmovisión bíblica. El sistema integra el versículo del año, el principio mensual, y el marco institucional en cada elemento pedagógico generado.

El diseño está pensado para ser **multi-institución** desde su arquitectura base. Cada dato está aislado por `school_id` con Row Level Security en PostgreSQL. Un segundo colegio es una fila nueva en la tabla `schools`.

---

## Visión

CBF Planner es la primera capa de la **ETA Platform** (Experiencia Total de Aprendizaje) — una arquitectura de cinco capas que progresa desde herramientas de diseño docente hasta experiencias interactivas para estudiantes, sistemas de evaluación, y finalmente AI como co-creador pedagógico con memoria acumulada por estudiante e instrucción diferenciada como destino arquitectural.

---

## Licencia y contacto

Desarrollado por **ClassroomsOS**
Propietario: Edoardo Ortiz
Barranquilla, Colombia — 2026

*Sistema propietario. Todos los derechos reservados.*
