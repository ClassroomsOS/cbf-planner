# Pedagogical Models & Vocabulary

## Vocabulario UI — Convención de Términos

**"Logro"** fue eliminado del vocabulario visible. El término correcto en toda la UI es **"Indicador de Logro"** (singular) / **"Indicadores de Logro"** (plural).

- La tabla `learning_targets` sigue llamándose igual en DB, pero en UI = "Indicador de Logro"
- El sidebar nav muestra "🎯 Indicadores de Logro"
- El panel del editor muestra "1 · Indicador"
- Los indicadores en la guía son **read-only** — se editan en `/targets`, no en el editor

## Marco Pedagógico: Dos Modelos de NEWS

**Referencia completa:** `theoric mark/CBF_Marco_Teorico_Sistema_Educativo.md`
**Análisis de implementación:** `theoric mark/CBF_Analisis_Implementacion_Sistema.md`

### Modelo A — Estándar
Materias en español: Español, Matemáticas, Cosmovisión Bíblica, etc.
```
LOGRO (1 por trimestre/área)
  ├── TEMÁTICA 1 → INDICADOR 1 → Actividades Evaluativas
  ├── TEMÁTICA 2 → INDICADOR 2 → Actividades Evaluativas
  └── EXPERIENCIA SIGNIFICATIVA (1 sola, al final, integradora)
        └── RÚBRICA (8 criterios × 5 niveles)
```

### Modelo B — Lengua
Materias en inglés: **Language Arts, Social Studies, Science, Lingua Skill** (definido en `MODELO_B_SUBJECTS` en `constants.js`)
```
COMPETENCIAS (Sociolingüística / Lingüística / Pragmática)
OPERADORES INTELECTUALES (Deducir / Generalizar / Sintetizar / Retener / Evaluar)
  ├── INDICADOR 1 — Speaking
  │     ├── PRINCIPIO BÍBLICO PROPIO
  │     ├── ENUNCIADO: solo en inglés (texto_en)
  │     ├── ES EMBEBIDA (proyecto + tamaño de grupo + criterios)
  │     └── ACTIVIDADES ESTÁNDAR (Dictados, Quiz, Cambridge One, Plan Lector, PET Prep)
  ├── INDICADOR 2 — Listening / 3 — Reading / 4 — Writing (misma estructura)
  └── RÚBRICA FINAL (organizada por habilidad)
```

**UI del modal Logros — Modelo B:** El campo "Logro del Período" NO aparece. En su lugar, 4 pestañas fijas:
- 🎤 **Speaking** — púrpura `#8064A2`
- 🎧 **Listening** — teal `#4BACC6`
- 📖 **Reading** — naranja `#F79646`
- ✍️ **Writing** — verde `#9BBB59`

Cada pestaña tiene: selector taxonómico propio + campo EN + principio bíblico (título, referencia, cita) + ES embebida. **No hay generación por IA** — docentes llenan los indicadores que ya tienen. `texto_es` no se captura en UI (campo persiste en DB por compatibilidad).

**Auto-creación de proyectos NEWS al crear Logro Modelo B** (`handleSave` en `LearningTargetsPage.jsx`):
> ⚠️ **Gotcha:** La validación `if (!form.description.trim()) return` debe ejecutarse **después** de calcular `isModeloB` — en Modelo B `description` siempre está vacío.

1. Inserta el `learning_targets` row y obtiene su `id`
2. Auto-inserta 4 `news_projects` rows — uno por habilidad (Speaking / Listening / Reading / Writing)
3. Cada proyecto pre-cargado con: condiciones, principio bíblico, `skill` (lowercase), `target_id`, `news_model: 'language'`, `status: 'draft'`
4. `due_date` queda null — el docente la completa al abrir el proyecto en NEWS.

**Flujo docente Modelo B:**
- Crear Logro → 4 proyectos NEWS nacen automáticamente vinculados
- Abrir NEWS → ver los 4 proyectos organizados por habilidad
- Editar cada proyecto → completar: textbook reference, **actividades evaluativas**, rúbrica

## NewsProjectEditor — Steps

**Flujo de navegación:** Identificación → Indicador → [Marco — solo Modelo B] → Contenido → Fechas → Textbook → **Actividades → Línea de Tiempo** → Rúbrica.

**Step "Actividades" (ambos modelos):**
- UI: formulario para agregar actividades `{nombre, descripcion, porcentaje}` + lista con eliminar
- Indicador de total % con validación (verde = 100%, rojo = excede 100%, amarillo = incompleto)
- Estado en `form.actividades_evaluativas[]`, persistido en `news_projects.actividades_evaluativas` (JSONB)
- `NewsProjectCard` muestra chip "📋 N actividades"
- Estructura de cada actividad: `{ nombre, descripcion, porcentaje, fecha: 'YYYY-MM-DD' | null }`
- Lista ordenada cronológicamente por `fecha`; items sin fecha marcados en gris

**Step "📅 Línea de Tiempo":**
- Agrupa actividades por semana ISO (lunes–viernes)
- `SKILL_COLOR: { Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59' }`
- `due_date` del proyecto aparece como hito 🏁 rojo en su semana
- Panel ámbar para actividades sin fecha + botón "Asignar fechas" → vuelve al step Actividades

**Migración SQL requerida:**
```sql
ALTER TABLE news_projects
ADD COLUMN IF NOT EXISTS actividades_evaluativas jsonb DEFAULT '[]'::jsonb;
```

## Rúbrica CBF (especificación obligatoria)
**Siempre 8 criterios × 5 niveles** (Superior/Alto/Básico/Bajo/Muy Bajo):
- 3 Cognitivos (comprensión, aplicación, análisis)
- 2 Comunicativos (claridad, organización/presentación)
- 1 Actitudinal (responsabilidad, participación)
- 1 Bíblico/Valorativo (conexión con versículo/principio)
- 1 Técnico específico de la ES

Escalas: Boston Flex → 1.0–5.0 | Boston International → 0–100

## Taxonomía (mapping)
`taxonomy` field (3 niveles, para SmartBlocks — NO cambiar):
- `recognize` ≈ Bloom: Recordar / Comprender
- `apply` ≈ Bloom: Aplicar / Analizar
- `produce` ≈ Bloom: Evaluar / Crear

Los prompts de IA para Logros e Indicadores deben usar los 6 verbos de Bloom completos.

## Roadmap — Pendiente

- **🔴 Capa 2 — Tracking de completitud SmartBlocks** — evaluar si el virtual campus ya trackea HTML; si no, botón "Enviar resultados" → Edge Function → dashboard docente.
- **🟢 Capa 3 — SCORM/xAPI** — largo plazo, proyecto separado.
- **🟡 NEWS Modelo A** — agregar sección educativa en `NewsProjectEditor` para `news_model === 'standard'`.
- **🟡 Calendario** — reprogramación asistida por IA cuando `affects_planning=true`.
