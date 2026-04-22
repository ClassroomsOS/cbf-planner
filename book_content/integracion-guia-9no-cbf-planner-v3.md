# Integración: Legacy Format de Guía Docente → CBF Planner

## Premisa fundamental

El **Legacy Format** es un **formato de exportación adicional** que se suma a lo que ya existe en el CBF Planner. No reemplaza nada. Las guías actuales de 8° (formato CBF-G AC-01 con Smart Blocks) siguen funcionando exactamente igual.

El Legacy Format responde a una necesidad concreta: el docente de 9° produce su guía semanal en un formato Word propio (sin Smart Blocks, sin colores por sección, texto libre en tablas). El Planner debe poder exportar en ese mismo formato.

**Lo que sale del Planner en Legacy Format debe ser visualmente idéntico al Word original del docente.**

---

## 1. Lo que ya existe y NO cambia

- Generación de guías CBF-G AC-01 para 8° (formato actual con Smart Blocks, colores, secciones)
- Toda la arquitectura de datos existente (`lesson_plans`, `news_projects`, `rubric_templates`, etc.)
- El flujo de creación de guía actual
- El generador de `.docx` actual para 8°

El Legacy Format se **agrega** como segunda opción de exportación. Conviven los dos.

---

## 2. Estructura real del Legacy Format (Word de 9°)

Analizando la guía de muestra (Language Arts, Week 5, 9th Grade):

```
[Párrafo]   Date: March 16th – March 20th       Level: 9th grade

[Párrafo]   SPEAKING WEEK                        ← etiqueta temática (varía)

[Párrafo]   LEARNING OBJECTIVE: [texto libre]

[Tabla 1×1] Año 2026: Año de la pureza | versículo institucional

[Párrafo]   BIBLICAL PRINCIPLE: [título]
            [cita bíblica completa]              ← varía semana a semana

[Tabla N×2] Date                | ACTIVITIES DESCRIPTION
            Monday [fecha]      | [texto libre enriquecido]
            Wednesday [fecha]   | [texto libre enriquecido]
            Thursday [fecha]    | [texto libre enriquecido]
            Friday [fecha]      | [texto libre enriquecido]
```

Sin colores. Sin iconos. Sin Smart Blocks. Texto, negritas, cursivas y tablas estándar de Word.

---

## 3. Campos adicionales necesarios para el Legacy Format

Solo se necesitan **2 campos nuevos** en `lesson_plans`. Todo lo demás ya existe.

```sql
ALTER TABLE lesson_plans
  ADD COLUMN weekly_label TEXT,                 -- ej. "SPEAKING WEEK"
  ADD COLUMN weekly_biblical_principle TEXT;    -- ej. "God's plan: A dream worth waiting for\nGénesis 50:20 (NIV)..."
```

Ambos son `TEXT`, `nullable`. No rompen nada de lo existente.

---

## 4. Cómo se integra en el flujo del Planner

### En el formulario de guía (frontend)

Se agrega una nueva sección colapsable "Legacy Format / 9°" con:
- Campo "Etiqueta temática" (texto libre, ej. "SPEAKING WEEK")
- Campo "Principio bíblico semanal" (textarea, varía por semana)

Estos campos **no aparecen en el flujo de 8°** a menos que el docente los active manualmente. No rompen la UX existente.

### En la exportación (botón "Exportar")

Actualmente existe un botón de exportar que genera el `.docx` de 8°.

Se agrega una **segunda opción**:
```
Exportar guía
  ├─ [Formato CBF-G AC-01]    ← el que ya existe, para 8°
  └─ [Legacy Format]          ← nuevo, para 9° (o cualquier grado que use ese estilo)
```

### En el generador de .docx (Edge Function o cliente)

Se crea una **segunda función generadora** independiente (`buildLegacyDocx`), separada del generador actual. No toca el código del generador de 8°.

```javascript
// Pseudocódigo de buildLegacyDocx

function buildLegacyDocx(lessonPlan) {
  return Document([
    paragraph(`Date: ${lessonPlan.week_start} – ${lessonPlan.week_end}    Level: ${lessonPlan.grade}`),
    
    lessonPlan.weekly_label
      ? paragraph(lessonPlan.weekly_label, { bold: true })
      : null,

    paragraph(`LEARNING OBJECTIVE: ${lessonPlan.objective}`),

    table1x1(yearVerseBlock),  // versículo institucional pre-llenado

    lessonPlan.weekly_biblical_principle
      ? paragraphs(lessonPlan.weekly_biblical_principle)
      : null,

    tableNx2(
      header: ["Date", "ACTIVITIES DESCRIPTION"],
      rows: lessonPlan.activities.map(day => [
        formatDate(day.date),
        day.content  // texto libre, sin estructurar
      ])
    )
  ])
}
```

---

## 5. Prompt del AI para Legacy Format

Cuando el docente usa el AI con Legacy Format activo, el contexto enviado cambia:

```
// Para 8° (formato actual — sin cambios)
Grade: 8th
Textbook: Uncover 4
Language: English
Format: CBF-G AC-01 (Smart Blocks)

// Para 9° con Legacy Format (nuevo)
Grade: 9th
Textbook: Evolve 4 (Cambridge)
Language of instruction: English (all content in English)
Format: Legacy Format (free text, no Smart Blocks)
Weekly theme: [weekly_label si existe]
Biblical principle this week: [weekly_biblical_principle si existe]
Output: Free text per day, structured as: Topics → Motivation → Assignment Check → Skill Development → Class Assignment → Closing
```

El AI genera el contenido de cada día como texto libre continuo (no como bloques separados del sistema), replicando el estilo del Word original.

---

## 6. Resumen de cambios requeridos

| Componente | Cambio | Impacto en lo existente |
|---|---|---|
| Base de datos | 2 columnas `TEXT NULL` en `lesson_plans` | Ninguno (nullable) |
| Formulario frontend | Sección colapsable opcional con 2 campos | Ninguno (no aparece por defecto en flujo de 8°) |
| Botón de exportar | Segunda opción "Legacy Format" | Ninguno (se suma, no reemplaza) |
| Generador de .docx | Nueva función `buildLegacyDocx` separada | Ninguno (el generador de 8° no se toca) |
| Prompt del AI | Contexto adicional cuando Legacy Format activo | Ninguno (el prompt de 8° no cambia) |
| Documento exportado | Idéntico al Word original del docente | No aplica |
| Smart Blocks en exportación | No aplican en Legacy Format | No aplican |
| Guías de 8° actuales | Sin cambios | Sin cambios |

**El Legacy Format es una adición quirúrgica. El sistema existente no se modifica. El docente de 9° obtiene exactamente el mismo documento que produce hoy a mano.**
