# Análisis de Implementación: Indicadores de Logro, Indicadores y Actividades Evaluativas
**CBF Planner — Documento interno de referencia técnico-pedagógica**
**Versión 1.0 — Abril 2026**
**Generado a partir del Marco Teórico CBF v1.0**

---

> **Propósito:** Este documento traduce el Marco Teórico CBF a decisiones concretas de arquitectura de datos y UX para el CBF Planner. Es la referencia definitiva para cualquier cambio en el flujo de Indicadores de Logro, Indicadores, NEWS y evaluación. Debe actualizarse cada vez que el marco teórico cambie.

---

## 📐 Diagrama de la Máquina Encadenada (Modelo B)

> Esta es la secuencia obligatoria. El sistema bloquea cada paso si el anterior no está completo.

```
╔══════════════════════════════════════════════════════════════════════╗
║         PASO 1 — Modal: Indicadores de Logro                         ║
║              (inicio del período — INMUTABLE al publicar)            ║
╚══════════════════════════════════════════════════════════════════════╝

  Una unidad por habilidad — 4 en total:

  ┌─────────────────────────────────────────────────────────────────┐
  │  🎤 SPEAKING                                                    │
  │  ├── Nivel taxonómico        → ej: apply                       │
  │  ├── Indicador (texto_en)    → "Present information clearly…"  │
  │  ├── Principio bíblico       → versículo específico            │
  │  └── ES Embebida             → título + descripción + grupo    │
  ├─────────────────────────────────────────────────────────────────┤
  │  🎧 LISTENING  (misma estructura)                               │
  ├─────────────────────────────────────────────────────────────────┤
  │  📖 READING    (misma estructura)                               │
  ├─────────────────────────────────────────────────────────────────┤
  │  ✍️  WRITING    (misma estructura)                               │
  └─────────────────────────────────────────────────────────────────┘

  Al guardar → sistema auto-crea 4 proyectos NEWS vinculados (target_id)
  con título, descripción, condiciones y principio bíblico pre-poblados.

                          │
                          │  target_id  (vínculo permanente)
                          ▼

╔══════════════════════════════════════════════════════════════════════╗
║         PASO 2 — Modal: NEWS                                         ║
║     (completa lo que faltaba — INMUTABLE al publicar)                ║
║     BLOQUEADO si no existen Indicadores de Logro                     ║
╚══════════════════════════════════════════════════════════════════════╝

  Un proyecto por habilidad — 4 en total (ya creados en Paso 1):

  ┌─────────────────────────────────────────────────────────────────┐
  │  Proyecto Speaking                                              │
  │  ├── 🔒 Título / Descripción / Condiciones  (read-only, Paso 1)│
  │  ├── 🔒 Principio bíblico / Reflexión       (read-only, Paso 1)│
  │  ├── due_date              → fecha de presentación [EDITABLE]  │
  │  ├── Actividades evaluativas → [{nombre, desc, %, fecha}, …]  │
  │  └── Rúbrica               → 8 criterios × 5 niveles          │
  ├─────────────────────────────────────────────────────────────────┤
  │  Proyecto Listening  (misma estructura)                         │
  ├─────────────────────────────────────────────────────────────────┤
  │  Proyecto Reading    (misma estructura)                         │
  ├─────────────────────────────────────────────────────────────────┤
  │  Proyecto Writing    (misma estructura)                         │
  └─────────────────────────────────────────────────────────────────┘

  Regla: TODA actividad evaluativa debe tener fecha. Sin fecha = sin estructura.

                          │
                          │  target_id + due_date + actividades fechadas
                          ▼

╔══════════════════════════════════════════════════════════════════════╗
║         PASO 3 — Guías Semanales (lesson_plans)                      ║
║     BLOQUEADO si no existen proyectos NEWS para ese grado+materia    ║
╚══════════════════════════════════════════════════════════════════════╝

  Semana X → busca proyecto con due_date más próxima desde esa semana
           → toma indicador (texto_en + taxonomía + principio bíblico)
           → label read-only en modal de generación IA
           → IA genera contenido alineado a ese indicador + habilidad
           → docente edita, ajusta, decide qué usar

                          │
                          ▼

╔══════════════════════════════════════════════════════════════════════╗
║         PASO 4 — Evaluación                                          ║
╚══════════════════════════════════════════════════════════════════════╝

  Semana del due_date → alumno ejecuta el proyecto
                     → docente evalúa con la rúbrica
                     → checkpoint: ¿alcanzó el indicador?
                     → siguiente segmento arranca con el hito siguiente
```

---

## 0. Flujo Pedagógico del Sistema — La Lógica que lo Explica Todo

> **Esta sección es la referencia obligatoria para cualquier desarrollador que trabaje en el CBF Planner.** Todo lo técnico del documento — tablas, brechas, fases — existe para sostener este flujo. Si algo en el sistema contradice esta lógica, el sistema está mal.

---

### 0.1 La Pregunta Central del Sistema

**¿Cómo sabe un docente que su alumno realmente aprendió?**

La respuesta CBF es: porque el alumno fue capaz de ejecutar un proyecto real, medible, ante otros — y lo hizo bien. Ese proyecto no apareció de la nada. Fue el destino al que el docente lo condujo, semana a semana, con intención.

El CBF Planner existe para que ese camino esté planificado, visible y medible.

---

### 0.2 El Flujo Completo — De la Meta a la Evidencia

```
[1] INDICADOR DE LOGRO
      └── Define QUÉ debe demostrar el alumno al final del trimestre.
          Es mensurable, usa verbo cognitivo observable.
          Ejemplo: "Produce textos instructivos claros usando conectores de secuencia."

          │
          ▼

[2] PROYECTO (NEWS) — con fecha de entrega
      └── Es la EVIDENCIA principal del Indicador de Logro.
          Tiene una fecha concreta en el calendario.
          El alumno demuestra el indicador ejecutando este proyecto.
          Ejemplo: "Escribe y presenta una receta con pasos ordenados. Semana 10."

          │  ← La fecha del proyecto ancla todo lo que viene después
          ▼

[3] GUÍAS SEMANALES (lesson_plans)
      └── Son el camino hacia el proyecto.
          Cada guía construye UNA competencia o habilidad que el alumno necesitará
          para llegar al proyecto y ejecutarlo bien.
          No son contenido suelto: cada semana tiene un propósito en función del proyecto.

          Semana 1 → Introduce el tema y activa conocimientos previos
          Semana 2 → Trabaja la habilidad A (necesaria para el proyecto)
          Semana 3 → Trabaja la habilidad B (necesaria para el proyecto)
          Semana 4 → Practica integrando A + B (mini-tarea formativa)
          ...
          Semana N → El alumno ejecuta el PROYECTO y demuestra el Indicador de Logro

          │
          ▼

[4] EVALUACIÓN — cierre del ciclo
      └── La rúbrica mide el desempeño en el proyecto.
          El resultado se mapea al Indicador de Logro: ¿lo alcanzó o no?
          Las notas parciales (formativas) ya se acumularon semana a semana.
          Pesos: 30% formativas + 20% proceso ES + 20% escrita + 30% ES final.
```

---

### 0.3 La Relación Crítica: Indicador de Logro ↔ Proyecto (NEWS)

El Indicador de Logro y el Proyecto no son dos cosas paralelas. Son la misma intención expresada de dos formas:

| | Indicador de Logro | Proyecto (NEWS) |
|---|---|---|
| **Qué es** | La meta pedagógica en lenguaje curricular | La tarea concreta que el alumno ejecuta |
| **Quién lo escribe** | El docente al planificar el trimestre | El docente al diseñar la experiencia |
| **Cuándo se define** | Antes de planificar las guías | Antes de planificar las guías |
| **Cuándo se evalúa** | Al finalizar el proyecto | En la fecha de entrega definida |
| **Cómo se relacionan** | El proyecto ES la evidencia del indicador | El indicador ES el criterio de éxito del proyecto |

**En el sistema:** `news_projects.target_id` es la FK que une estos dos. Es el vínculo más importante de toda la base de datos.

---

### 0.4 El Rol de Cada Guía Semanal

Cada `lesson_plan` no es una clase aislada. Es un **paso deliberado hacia el proyecto**.

El docente, al crear una guía, debe poder responder: *¿qué competencia o habilidad estoy desarrollando esta semana que el alumno necesitará para el proyecto?*

Esto implica que:

- **Las guías tienen dirección.** Van de lo simple a lo complejo, de lo guiado a lo autónomo.
- **Los SmartBlocks son los ladrillos.** Cada bloque de actividad en la guía entrena una micro-habilidad que se acumula.
- **El checkpoint entre guías** verifica si el alumno va en camino antes de que sea tarde para corregir.
- **La última guía antes del proyecto** debe funcionar como preparación directa — el alumno ya sabe lo que va a hacer, ya tiene los insumos, ya practicó.

---

### 0.5 Modelo B — El Mismo Flujo, por Habilidad

En las materias de Modelo B (Language Arts, Social Studies, Science), el flujo se repite **cuatro veces en paralelo**, una por habilidad lingüística:

```
Indicador de Logro — Speaking  →  Proyecto Speaking  →  Guías que desarrollan Speaking
Indicador de Logro — Listening →  Proyecto Listening →  Guías que desarrollan Listening
Indicador de Logro — Reading   →  Proyecto Reading   →  Guías que desarrollan Reading
Indicador de Logro — Writing   →  Proyecto Writing   →  Guías que desarrollan Writing
```

Cada uno tiene su propia fecha, su propio principio bíblico, y su propia ES Embebida. Las guías semanales integran las cuatro habilidades pero cada semana tiene un énfasis según qué proyecto se aproxima.

---

### 0.6 Lo que el Sistema Debe Hacer Posible (Resumen Funcional)

Para que este flujo funcione en el CBF Planner, el sistema debe permitir:

1. **Crear un Indicador de Logro** → mensurable, con verbo cognitivo, vinculado a un trimestre y materia.
2. **Crear un Proyecto (NEWS)** → vinculado al indicador, con fecha de entrega, habilidad (Modelo B) o temática (Modelo A), y rúbrica de 8 criterios.
3. **Crear guías semanales** → vinculadas al mismo indicador, con SmartBlocks que desarrollan las competencias necesarias para el proyecto.
4. **Ver el progreso en el tiempo** → el docente puede ver qué semanas faltan para el proyecto y si las guías están cubriendo lo necesario.
5. **Cerrar el ciclo** → al final, la nota del proyecto se registra y el sistema indica si el alumno alcanzó el Indicador de Logro.

---

### 0.7 La Cadena de Hitos — Cómo la IA Genera las Guías Automáticamente

> **Esta es la lógica de generación automática.** El trimestre no es un bloque uniforme de semanas: es una cadena de segmentos, donde cada segmento termina en un hito (proyecto/NEWS) y el siguiente segmento arranca inmediatamente después.

---

#### La estructura encadenada del trimestre

```
TRIMESTRE
  │
  ├── [Guías semanas 1–3] → desarrollan Temática 1
  │         └── HITO 1: Proyecto Temática 1
  │                       fecha_entrega: semana 3
  │                       (fin de Temática 1 / inicio de Temática 2)
  │
  ├── [Guías semanas 4–6] → desarrollan Temática 2
  │         └── HITO 2: Proyecto Temática 2
  │                       fecha_entrega: semana 6
  │                       (fin de Temática 2 / inicio de Temática 3)
  │
  └── [Guías semanas 7–10] → desarrollan Temática 3
            └── HITO 3: Experiencia Significativa Final (integradora)
                          fecha_entrega: semana 10
                          (cierre del trimestre — evalúa el Indicador de Logro completo)
```

**Regla fundamental:** La fecha de entrega de cada NEWS (hito) es el ancla. Todo lo que la IA genera en guías semanales está calculado hacia atrás desde esa fecha.

---

#### Qué necesita saber la IA para generar las guías de un segmento

Para generar las guías entre un hito y el anterior (o el inicio del trimestre), la IA necesita exactamente estos inputs:

| Input | De dónde viene | Por qué lo necesita |
|---|---|---|
| Indicador de Logro del trimestre | `learning_targets.description` | Es la meta final que todo debe servir |
| Nombre de la Temática actual | `learning_targets.tematica_names[n]` | Define el contenido del segmento |
| Indicador de la Temática actual | `learning_targets.indicadores[n]` | Define qué debe demostrar el alumno en este hito |
| Fecha del hito actual (NEWS) | `news_projects.fecha_entrega` | Sabe cuándo termina el segmento |
| Fecha del hito anterior (o inicio trimestre) | NEWS anterior o fecha de inicio | Sabe cuántas semanas tiene disponibles |
| Semanas disponibles (calculado) | fecha_hito_actual − fecha_hito_anterior | Determina cuántas guías generar |
| Modelo (A o B) | `news_projects.news_model` | Determina la estructura de cada guía |
| Habilidad activa (solo Modelo B) | `news_projects.skill` | Focaliza el contenido de las guías |

---

#### Cómo la IA distribuye las guías dentro de un segmento

Con las semanas disponibles calculadas, la IA sigue esta progresión pedagógica fija:

```
Semana 1 del segmento  →  ACTIVACIÓN
                           Introduce la temática, conecta con conocimientos previos,
                           presenta el hito que se aproxima (el alumno sabe a dónde va).

Semanas intermedias    →  CONSTRUCCIÓN PROGRESIVA
                           Cada guía desarrolla una micro-habilidad o sub-contenido
                           que el alumno necesitará para el proyecto.
                           Van de lo guiado → lo colaborativo → lo autónomo.
                           Incluyen actividades formativas (30% de la nota).

Semana N-1 del segmento → PREPARACIÓN DIRECTA
                           El alumno ya conoce el proyecto, practica el formato,
                           organiza sus insumos, recibe retroalimentación previa.

Semana N del segmento  →  HITO (ejecución del NEWS)
                           El alumno demuestra el indicador de la temática.
                           Se evalúa con la rúbrica. Se cierra el segmento.
                           La siguiente guía ya arranca la Temática siguiente.
```

---

#### El encadenamiento entre segmentos

El fin de un hito y el inicio del siguiente no son eventos separados — son la misma semana vista desde dos ángulos:

```
... Semana 6: El alumno ejecuta el Proyecto de Temática 2 (HITO 2)
    Semana 7: La guía ya introduce Temática 3, referenciando lo aprendido en Temática 2
              ↑ la IA debe generar esta guía sabiendo que el alumno acaba de completar el hito anterior
```

Esto significa que la IA, al generar el primer `lesson_plan` de un segmento nuevo, debe recibir como contexto el hito anterior — qué se hizo, qué se evaluó — para que la transición sea coherente y no un reinicio abrupto.

---

#### Lo que falta en el sistema para que esto funcione (pendientes técnicos)

| Pendiente | Impacto en la generación automática |
|---|---|
| `news_projects.fecha_entrega` — **campo no existe** | Sin fecha, la IA no puede calcular semanas disponibles ni distribuir guías |
| `learning_targets.tematica_names[]` — **tabla/campo no existe** | Sin nombres de temáticas, la IA genera guías genéricas sin ancla de contenido |
| Contexto del hito anterior en el payload de generación | Sin esto, la transición entre segmentos es abrupta |
| `generateGuideStructure()` no recibe `semanas_disponibles` ni `posicion_en_segmento` | La IA no sabe si está generando la guía de activación, construcción o preparación |

**Estos son los pendientes que desbloquean la generación continua y automática de guías.** Sin ellos, la IA puede generar guías individuales razonables, pero no la cadena coherente del trimestre completo.

---

## 1. El Hallazgo Central: Dos Modelos Pedagógicos, Una Sola App

El sistema CBF opera con **dos modelos pedagógicos estructuralmente distintos**:

### Modelo A — Estándar (materias en español)
Aplica a: Español, Matemáticas, Cosmovisión Bíblica, y demás asignaturas en español.

```
TRIMESTRE
  └── INDICADOR DE LOGRO (1 por trimestre/área)
        ├── TEMÁTICA 1 → INDICADOR 1 → Actividades Evaluativas
        ├── TEMÁTICA 2 → INDICADOR 2 → Actividades Evaluativas
        └── EXPERIENCIA SIGNIFICATIVA (1 sola, al final, integradora)
              └── RÚBRICA (8 criterios × 5 niveles)
```

### Modelo B — Lengua (materias en inglés)
Aplica a: Language Arts, Social Studies, Science (materias enseñadas en inglés).

```
TRIMESTRE — LENGUA
  ├── COMPETENCIAS (Sociolingüística / Lingüística / Pragmática)
  ├── HABILIDADES (Speaking / Listening / Reading / Writing)
  ├── OPERADORES INTELECTUALES (Deducir / Generalizar / Sintetizar / Retener / Evaluar)
  │
  ├── INDICADOR 1 — Speaking
  │     ├── PRINCIPIO BÍBLICO PROPIO (versículo específico del indicador)
  │     ├── ENUNCIADO: inglés + traducción al español
  │     ├── ES EMBEBIDA (proyecto + tamaño de grupo + criterios)
  │     └── ACTIVIDADES ESTÁNDAR (Dictados, Quiz, Cambridge One, Plan Lector, PET Prep)
  │
  ├── INDICADOR 2 — Listening  (misma estructura)
  ├── INDICADOR 3 — Reading    (misma estructura)
  └── INDICADOR 4 — Writing    (misma estructura)
        └── RÚBRICA FINAL (organizada por habilidad)
```

**Materias por modelo en CBF:**

| Modelo | Materias |
|--------|----------|
| **A — Estándar** | Español, Matemáticas, Cosmovisión Bíblica, Ed. Física, Arte, y demás en español |
| **B — Lengua** | Language Arts, Social Studies, Science |

---

## 2. Estado Actual del Sistema vs. Marco Teórico

### 2.1 Qué tiene el sistema hoy

```
TABLA: learning_targets
  - id
  - description        ← usado como "Indicador de Logro" (correcto en intención)
  - taxonomy           ← recognize | apply | produce (simplificación Bloom)
  - indicadores[]      ← array de strings (indicadores por temática)
  - grade, subject, school_id, group_name
  - prerequisite_ids

TABLA: news_projects
  - id
  - target_id          ← FK a learning_targets
  - target_indicador   ← indicador seleccionado (texto)
  - rubric_template_id ← FK a rubric_templates
  - skill              ← Speaking/Listening/Reading/Writing/Grammar/Vocabulary
  - [otros campos de metadatos del proyecto]

TABLA: lesson_plans
  - target_id          ← FK a learning_targets
  - [content JSONB con días/secciones]
```

### 2.2 Brechas identificadas

#### BRECHA 1 — CRÍTICA: No existe la entidad "Temática"
**Qué dice el marco:** Indicador de Logro → Temáticas → Indicadores (cada temática tiene su indicador)
**Qué tiene el sistema:** `learning_targets.indicadores[]` es un array plano de strings
**Impacto:** El sistema no puede mostrar a qué contenido/unidad pertenece cada indicador.
**Riesgo:** El docente ve una lista de indicadores sin saber en qué semanas aplican ni a qué contenido corresponden.

#### BRECHA 2 — ALTA: No hay distinción Modelo A / Modelo B
**Qué dice el marco:** Language Arts, Social Studies y Science usan una estructura radicalmente diferente.
**Qué tiene el sistema:** Un solo tipo de NEWS y un solo tipo de learning_target.
**Impacto:** El NEWS de Science se construye igual que el de Español — pierda toda la riqueza del Modelo B (competencias, operadores, principio bíblico por indicador, ES embebida).

#### BRECHA 3 — ALTA: Rúbrica no cumple la especificación
**Qué dice el marco:** 8 criterios × 5 niveles de desempeño (analítica).
**Qué tiene el sistema:** `generateRubric()` genera 3–5 criterios.
**Impacto:** Las rúbricas exportadas no cumplen el estándar CBF.

#### BRECHA 4 — MEDIA: Taxonomía incompleta para redacción de indicadores de logro
**Qué dice el marco:** Bloom adaptado CBF con 6 niveles (Recordar, Comprender, Aplicar, Analizar, Evaluar, Crear) con verbos específicos por nivel.
**Qué tiene el sistema:** `taxonomy: recognize | apply | produce` (3 niveles, útil para SmartBlocks pero insuficiente para orientar la redacción de Indicadores de Logro).
**Impacto:** La IA puede sugerir indicadores genéricos sin alineación al nivel cognitivo correcto.

#### BRECHA 5 — MEDIA: No hay campo trimestre en learning_targets
**Qué dice el marco:** El Indicador de Logro es del TRIMESTRE (1 por área/trimestre/grado).
**Qué tiene el sistema:** `learning_targets` no tiene campo `trimestre`. Se infiere del NEWS al que está vinculado.
**Impacto:** No se puede ver "todos los indicadores de logro del Trimestre 2" sin cruzar con news_projects.

#### BRECHA 6 — MEDIA: No hay pesos de evaluación configurables
**Qué dice el marco:** 30% formativas + 20% proceso ES + 20% escrita + 30% ES final.
**Qué tiene el sistema:** Sin campo de pesos. La nota no se calcula en el sistema.
**Impacto:** El sistema planifica pero no cierra el ciclo evaluativo.

#### BRECHA 7 — BAJA: Actividades evaluativas no son entidades
**Qué dice el marco:** Cada Temática tiene Actividades Evaluativas con fechas y tipo.
**Qué tiene el sistema:** Las actividades son texto libre dentro del NEWS editor.
**Impacto:** No se pueden consultar ni rastrear las actividades programadas.

---

## 3. Lo Que Está Bien y No Debe Cambiarse

Antes de definir qué implementar, es crítico proteger lo que funciona:

| Elemento | Por qué funciona | Riesgo si se toca |
|----------|-----------------|-------------------|
| `taxonomy: recognize/apply/produce` | Alinea SmartBlocks con nivel cognitivo del indicador | Si se expande, rompe la lógica de sugerencia de IA |
| `target_id` en lesson_plans y news_projects | Conecta el Indicador de Logro con todo el trabajo semanal | Cambiar la FK rompería el checkpoint y el planner |
| `indicadores[]` como array en learning_targets | Simple, funciona para el flujo actual | Migrar a tabla separada requiere migración de datos |
| Principios bíblicos en AI (yearVerse, monthVerse, indicatorPrinciple) | Correctamente integrados | No tocar |
| Checkpoint flow (evaluación al abrir nueva guía) | Cierra el ciclo de tracking | No tocar |

---

## 4. Plan de Implementación por Fases

### FASE 1 — Correcciones inmediatas (sin migración de DB)

**4.1 Rúbrica: forzar 8 criterios**
- Cambiar `generateRubric()` en AIAssistant.js para que siempre genere exactamente 8 criterios.
- Los 8 deben cubrir las dimensiones: Cognitiva (3-4), Comunicativa (2-3), Actitudinal (1), Bíblica/Valorativa (1).
- Los descriptores deben ser observables (no adjetivos vagos como "bueno").

**4.2 Identificar materias de Modelo B en el sistema**
- En `constants.js`, agregar un set/array `MODELO_B_SUBJECTS` con los valores exactos: `['Language Arts', 'Social Studies', 'Science']`.
- Usar esto en NewsPage y LearningTargetsPage para mostrar UI diferente.
- No requiere cambio de DB.

**4.3 UI de learning_targets: mostrar el Indicador de Logro correctamente**
- En `LearningTargetsPage`, renombrar "Desempeño Observable" → "Indicador de Logro del Trimestre".
- Aclarar visualmente que `description` = Indicador de Logro (la meta mensurable) y `indicadores[]` = indicadores por temática.
- Agregar tooltip/ayuda con la anatomía del Indicador de Logro (verbo cognitivo + contenido + condición + dimensión valorativa).

---

### FASE 2 — Evolución del modelo de datos (requiere migración)

**4.4 Agregar `trimestre` a learning_targets**
```sql
ALTER TABLE learning_targets ADD COLUMN trimestre smallint CHECK (trimestre IN (1, 2, 3));
```
- Permite filtrar Indicadores de Logro por período sin cruzar con news_projects.
- Retrocompatible: campo nullable.

**4.5 Agregar `tematica_names` a learning_targets**
```sql
ALTER TABLE learning_targets ADD COLUMN tematica_names jsonb DEFAULT '[]';
```
- Array paralelo a `indicadores[]`.
- `tematica_names[n]` es el nombre de la Temática cuyo indicador está en `indicadores[n]`.
- Ejemplo: `tematica_names = ["Abecedario y mayúsculas", "Texto instructivo: receta"]`
- El editor de learning_targets muestra ambos arrays en paralelo.
- Retrocompatible: si `tematica_names` está vacío, el sistema funciona como antes.

**4.6 Agregar `news_model` a news_projects y learning_targets**
```sql
ALTER TABLE news_projects ADD COLUMN news_model text DEFAULT 'standard' CHECK (news_model IN ('standard', 'language'));
ALTER TABLE learning_targets ADD COLUMN news_model text DEFAULT 'standard' CHECK (news_model IN ('standard', 'language'));
```
- Se puede auto-detectar al crear: si la materia está en `MODELO_B_SUBJECTS`, preseleccionar 'language'.
- Desbloquea el Modelo B completo en el editor del NEWS.

**4.7 Agregar campos del Modelo B a news_projects**
```sql
ALTER TABLE news_projects ADD COLUMN competencias jsonb DEFAULT '[]';
-- ['Sociolingüística', 'Lingüística', 'Pragmática']

ALTER TABLE news_projects ADD COLUMN operadores_intelectuales jsonb DEFAULT '[]';
-- ['Deducir', 'Generalizar', 'Sintetizar', 'Retener', 'Evaluar']

ALTER TABLE news_projects ADD COLUMN habilidades jsonb DEFAULT '[]';
-- ['Speaking', 'Listening', 'Reading', 'Writing']
```

**4.8 Enriquecer el formato de indicadores para Modelo B**
Para Modelo B, `learning_targets.indicadores[]` debe evolucionar de:
```json
["El estudiante presenta información claramente..."]
```
A:
```json
[
  {
    "habilidad": "Speaking",
    "texto_en": "Present information, findings, and supporting evidence clearly...",
    "texto_es": "Presenta información, hallazgos y evidencias de forma clara...",
    "principio_biblico": {
      "titulo": "God's plan: A dream worth waiting for!",
      "referencia": "Génesis 50:20 (NIV)",
      "cita": "You intended to harm me, but God intended it for good..."
    },
    "es_titulo": "How do my dreams line up with God's plan?",
    "es_descripcion": "Vision Board: hablar de sueños comparándolos con un líder bíblico.",
    "es_grupo": "2 estudiantes"
  }
]
```
- Retrocompatible: si el ítem es string, el sistema lo trata como Modelo A.
- Si es objeto, activa el renderizado del Modelo B.

---

### FASE 3 — Funcionalidades evaluativas (futuro)

**4.9 Pesos de evaluación por NEWS**
```sql
ALTER TABLE news_projects ADD COLUMN evaluation_weights jsonb DEFAULT '{
  "formativas": 30,
  "proceso_es": 20,
  "escrita": 20,
  "es_final": 30
}';
```
- El docente puede ajustar los porcentajes.
- La suma debe ser 100 (validación en UI).

**4.10 Actividades evaluativas como entidades**
Nueva tabla `evaluative_activities`:
```sql
CREATE TABLE evaluative_activities (
  id uuid PRIMARY KEY,
  news_project_id uuid REFERENCES news_projects,
  tematica_index smallint,  -- índice en learning_targets.indicadores[]
  tipo text,                -- 'taller' | 'quiz' | 'debate' | 'exposicion' | 'entrega' | 'paso_es'
  descripcion text,
  fecha_estimada date,
  peso_porcentaje numeric,
  created_at timestamptz DEFAULT now()
);
```

---

## 5. Impacto en la IA del Sistema

### 5.1 `generateRubric()` — cambio obligatorio
**Antes:** 3–5 criterios libres
**Después:** Exactamente 8 criterios distribuidos:
- 3 Cognitivos (comprensión, aplicación, análisis del contenido)
- 2 Comunicativos (claridad de expresión, organización y presentación)
- 1 Actitudinal (responsabilidad, participación, disposición)
- 1 Bíblico/Valorativo (conexión con el versículo/principio del trimestre)
- 1 Técnico específico de la ES (varía según tipo de producto/proceso/actuación)

Cada criterio con descriptores observables en los 5 niveles (Superior/Alto/Básico/Bajo/Muy Bajo).

### 5.2 `generateIndicadores()` — actualizar prompt
**Antes:** Genera 3 indicadores genéricos.
**Después:**
- Recibir el nombre de cada Temática como contexto.
- Generar 1 indicador por Temática (no 3 genéricos).
- Para Modelo A: verbo observable en español + contenido + condición.
- Para Modelo B: texto en inglés + traducción + habilidad lingüística asociada.
- Verificar contra la lista de errores comunes (Apéndice B del Marco Teórico).

### 5.3 `generateGuideStructure()` — consciencia del modelo
- Recibir `news_model: 'standard' | 'language'` en el payload.
- Para Modelo B: las actividades de `skill` deben incluir elementos de la habilidad del indicador activo (Speaking → speaking activities, etc.).
- Para Modelo B: el bloque de DICTATION/VOCAB en la guía debe referenciarse al vocabulario del indicador.

### 5.4 `suggestSmartBlock()` — sin cambios necesarios
La taxonomía `recognize|apply|produce` funciona correctamente para SmartBlock. Mantener.

---

## 6. Mapa de Taxonomías: Marco Teórico vs. Sistema

```
MARCO TEÓRICO (Bloom adaptado CBF)    →    SISTEMA (taxonomy field)
───────────────────────────────────────────────────────────────────
Recordar / Identificar / Nombrar      →    recognize
Comprender / Describir / Relacionar   →    recognize
Aplicar / Construir / Demostrar       →    apply
Analizar / Distinguir / Inferir       →    apply
Evaluar / Valorar / Defender          →    produce
Crear / Diseñar / Elaborar            →    produce
```

**Decisión de diseño:** La simplificación 3-niveles se mantiene para SmartBlocks (es correcta y funcional). Para la redacción asistida por IA de Indicadores de Logro, el prompt debe usar los 6 niveles del Marco Teórico con sus verbos específicos.

---

## 7. Checklist de Validación para el Sistema (basado en Apéndice A del Marco)

El sistema debe validar (idealmente con IA, mínimamente con UI) antes de publicar un NEWS:

### Para Modelo A:
- [ ] El Indicador de Logro usa un verbo cognitivo (no solo sustantivos)
- [ ] El Indicador de Logro cubre todo el trimestre (no una sola semana)
- [ ] Hay al menos 2 Temáticas con su Indicador correspondiente
- [ ] Cada Indicador tiene verbo observable
- [ ] La ES está descrita (nombre + descripción + pasos)
- [ ] La Rúbrica tiene exactamente 8 criterios con 5 niveles
- [ ] El Versículo del año está incluido

### Para Modelo B:
- [ ] Las 3 Competencias están declaradas
- [ ] Los Operadores Intelectuales están listados
- [ ] Hay 4 Indicadores (uno por habilidad: Speaking/Listening/Reading/Writing)
- [ ] Cada Indicador tiene texto en inglés + traducción al español
- [ ] Cada Indicador tiene su Principio Bíblico propio
- [ ] Cada Indicador tiene su ES Embebida con tamaño de grupo
- [ ] Las Actividades Estándar están referenciadas (Dictados, Quiz, Cambridge One, Plan Lector, PET Prep)
- [ ] La Rúbrica está organizada por habilidad

---

## 8. Tabla de Decisiones de Implementación

| Decisión | Opción elegida | Razón |
|----------|----------------|-------|
| ¿Crea nueva tabla `tematicas`? | No (Fase 2: array paralelo) | Minimiza migración, retrocompatible |
| ¿Crea nueva tabla `indicadores`? | No (Fase 2: array enriquecido) | Mismo motivo |
| ¿Cambia `taxonomy` de 3 a 6 niveles? | No | Rompería SmartBlocks sin beneficio claro |
| ¿Dónde vive el `news_model`? | En news_projects Y learning_targets | NEWS tiene su modelo; Indicadores de Logro también lo conocen |
| ¿Cómo se detecta el modelo? | Auto por materia + override manual | Science/Social Studies/Language Arts = B por defecto |
| ¿Rubrica en rubric_templates o en news_projects? | Sigue en rubric_templates | Ya existe, no migrar |
| ¿Indicadores del Modelo B como string o object? | Object (retrocompatible: string = Modelo A) | Elegante, sin migración forzada |

---

## 9. Orden de Implementación Recomendado

### Ahora (sin migración DB):
1. Corregir `generateRubric()` → 8 criterios (impacto alto, sin riesgo)
2. Agregar `MODELO_B_SUBJECTS` a constants.js (base para todo lo demás)
3. Mejorar UI de LearningTargetsPage: mostrar Temáticas + Indicadores en paralelo

### Próxima sesión (con migración DB):
4. `ALTER TABLE learning_targets ADD COLUMN trimestre smallint`
5. `ALTER TABLE learning_targets ADD COLUMN tematica_names jsonb`
6. `ALTER TABLE learning_targets ADD COLUMN news_model text`
7. `ALTER TABLE news_projects ADD COLUMN news_model text`
8. Actualizar LearningTargetSelector para filtrar por trimestre
9. Actualizar NewsProjectEditor para mostrar UI de Modelo B cuando corresponde

### Sprint dedicado:
10. Modelo B completo: competencias, operadores, indicadores por habilidad con principio bíblico
11. ES Embebida por indicador en Modelo B
12. Pesos de evaluación configurables
13. Validación automática del checklist antes de publicar

---

## 10. Glosario de Mapeo: Marco Teórico ↔ Base de Datos

| Término Marco Teórico | Tabla / Campo en DB | Estado |
|----------------------|---------------------|--------|
| Indicador de Logro del Trimestre | `learning_targets.description` | ✅ Existe |
| Trimestre | `learning_targets.trimestre` | ❌ Falta (Fase 2) |
| Temática | `learning_targets.tematica_names[]` | ❌ Falta (Fase 2) |
| Indicador de Logro | `learning_targets.indicadores[]` | ✅ Existe (como string) |
| Indicador enriquecido (B) | `learning_targets.indicadores[]` como object | ❌ Falta (Fase 2) |
| Experiencia Significativa | `news_projects` | ✅ Existe (parcialmente) |
| ES Embebida (Modelo B) | dentro del object indicador | ❌ Falta (Fase 2) |
| Rúbrica | `rubric_templates` | ✅ Existe (incompleta: <8 criterios) |
| Modelo A / B | `news_projects.news_model` | ❌ Falta (Fase 2) |
| Competencias (B) | `news_projects.competencias` | ❌ Falta (Fase 2) |
| Operadores Intelectuales (B) | `news_projects.operadores_intelectuales` | ❌ Falta (Fase 2) |
| Habilidades (B) | `news_projects.habilidades` | ❌ Falta (Fase 2) |
| Principio Bíblico por Indicador (B) | dentro del object indicador | ❌ Falta (Fase 2) |
| Pesos de Evaluación | `news_projects.evaluation_weights` | ❌ Falta (Fase 3) |
| Actividades Evaluativas | texto libre en editor | ⚠️ Parcial (Fase 3) |
| Paso de ES | `news_projects` (campos de texto) | ⚠️ Parcial |

---

*Documento generado en sesión de diseño — Abril 2026*
*Referencia: CBF_Marco_Teorico_Sistema_Educativo.md v1.0*
*Próxima revisión: cuando el Marco Teórico se actualice o cuando inicie Fase 2*
