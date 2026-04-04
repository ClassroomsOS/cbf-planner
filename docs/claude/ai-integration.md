# AI Integration

All AI calls go through a **Supabase Edge Function** (`supabase/functions/claude-proxy/index.ts`) that proxies to `claude-sonnet-4-20250514`. The API key never touches the client. The Edge Function uses `body.max_tokens` directly — there is no type-based switch, so new AI functions only need a new export in `AIAssistant.js`.

Client-side entry point is `src/utils/AIAssistant.js`, which exposes:

| Function | Purpose | `maxTokens` |
|---|---|---|
| `suggestSectionActivity()` | Suggest HTML content for a single guide section | 2000 |
| `analyzeGuide()` | Pedagogical analysis of a complete guide | 4000 |
| `generateGuideStructure()` | Generate full week structure as JSON (includes SmartBlocks) | 16000 |
| `suggestSmartBlock()` | Suggest one SmartBlock for a section based on context + taxonomy | 1200 |
| `generateRubric()` | Generate complete 5-level rubric (**exactly 8 criteria**) for NEWS project | 4000 |
| `generateIndicadores()` | Generate indicators per Temática (Modelo A) or per habilidad (Modelo B) | 1500/2000 |
| `importGuideFromDocx()` | Parse .docx text (via mammoth) into CBF lesson_plan content JSON | 8000 |

`setAIContext({ schoolId, teacherId, monthlyLimit })` — must be called on login (DashboardPage). Enables usage logging to `ai_usage` table and monthly token limit enforcement. Pricing: input $3/MTok, output $15/MTok.

`generateGuideStructure` auto-retries with a more concise prompt when the response is truncated (JSON parse failure). It also asks Claude to include an optional `smartBlock` field in `activity` and `skill` sections (max 2 per day).

`generateGuideStructure` recibe `activeNewsProject` y construye un bloque `📋 CONTEXTO DEL PROYECTO NEWS` que incluye: título, descripción, condiciones de entrega, `due_date`, libro/unidades/gramática/vocab del textbook, competencias, operadores intelectuales, habilidades, principio y reflexión bíblica, y **`actividades_evaluativas`** — las actividades que caen en la semana actual se marcan con `⚠️` para que la IA las priorice; las próximas se listan como contexto.

**`AIGeneratorModal` — fuente de verdad del objetivo:**
El modal (`src/components/AIComponents.jsx`) nunca pide al docente que reescriba el indicador. El `objective` que se pasa a `generateGuideStructure` se deriva en `handleGenerate` en este orden de prioridad:
1. `activeIndicator.texto_en || activeIndicator.habilidad` (indicador detectado automáticamente por semana)
2. Indicador del `selectedSkill` elegido en el skill picker (Modelo B sin `activeIndicator`)
3. `learningTarget.description` (Modelo A)

**Estados del modal:**
- **Sin `learningTarget`** → muestra mensaje ámbar *"Ve al panel 1 · Indicador"* y oculta el formulario.
- **Modelo B sin skill seleccionada** → skill picker visible, botón deshabilitado hasta elegir habilidad.
- **Con indicador resuelto** → card verde read-only + campo Unidad/Tema/Libro + botón activo.

`suggestSmartBlock` receives `{ sectionMeta, grade, subject, objective, unit, dayName, existingContent, existingBlocks, learningTarget, planId }` and returns `{ type, model, data }` ready to insert. It aligns the suggestion to the learning target's taxonomy level:
- `recognize` → VOCAB matching, QUIZ topic-card, READING true-false
- `apply` → DICTATION, GRAMMAR fill-blank, WORKSHOP stations, READING comprehension
- `produce` → SPEAKING rubric, WORKSHOP roles, EXIT_TICKET can-do

`generateIndicadores()` has 3 modes: **Modelo B** (`isModeloB=true`) → 4 objects `{habilidad, texto_en, principio_biblico}`; **Modelo A + tematicaNames** → N strings, one per Temática; **Modelo A fallback** → 3 generic strings. The `getIndText(ind)` helper (exported from `LearningTargetsPage.jsx`) normalizes either format to a display string — use it everywhere indicators may be objects.

`extractJSONArray(text)` — internal helper in `AIAssistant.js` that first tries `JSON.parse(text)`, then falls back to regex `/\[[\s\S]*\]/` extraction. Used in `generateIndicadores()` to handle responses where Claude wraps JSON in markdown code fences.

`callClaude()` reads the response as text first (`response.text()`), then parses JSON — this prevents cryptic "Unexpected token" errors when the Edge Function returns a non-JSON error message.

## Principios Rectores Institucionales

CBF es una **escuela cristiana confesional**. Los tres principios son el norte de toda planificación, IA y evaluación. Son no negociables.

| Principio | Quién lo establece | Dónde vive | Ciclo |
|---|---|---|---|
| **Versículo del Año** | Capellán (hoy: cualquier docente) | `schools.year_verse` + `year_verse_ref` | Anual |
| **Versículo del Mes** | Capellán (hoy: cualquier docente) | `school_monthly_principles.month_verse` + `month_verse_ref` | Mensual |
| **Principio del Indicador** | Docentes | `school_monthly_principles.indicator_principle` | Mensual |

**Página:** `/principles` — `PrinciplesPage.jsx`. Accesible desde el sidebar (primer ítem). Gestión por mes del año en curso.

**Flujo en IA:** Todas las funciones de `AIAssistant.js` reciben un objeto `principles: { yearVerse, monthVerse, indicatorPrinciple }` y lo inyectan via `biblicalBlock()`. En `GuideEditorPage`, los principios se cargan automáticamente según el mes de la primera jornada activa de la guía.

**Futuros roles:** Cuando exista el perfil de Capellán, podrá editar `year_verse` y `month_verse`. Los docentes siempre controlan `indicator_principle`.
