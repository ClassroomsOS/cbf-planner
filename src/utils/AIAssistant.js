// ── AIAssistant.js ────────────────────────────────────────────────────────────
// Central utility for all AI calls in CBF Planner.
// Calls the Supabase Edge Function (claude-proxy) — API key stays on the server.

import { supabase } from '../supabase'

// ── Core caller ───────────────────────────────────────────────────────────────
async function callClaude({ type, system, message, planId, maxTokens }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa.')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        type,
        system,
        message,
        plan_id:    planId    || null,
        max_tokens: maxTokens || 2000,
      }),
    }
  )

  const data = await response.json()
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

// ── Punto 1: Sugerir actividad para una sección ───────────────────────────────
export async function suggestSectionActivity({
  section, grade, subject, objective, unit, dayName, existingContent, planId, learningTarget
}) {
  const SECTION_LIMITS = {
    'SUBJECT TO BE WORKED': '1 oración. Enuncia el tema o habilidad del día.',
    'MOTIVATION':           '1-2 oraciones. Describe la actividad de enganche (pregunta, juego corto, imagen, reto).',
    'ACTIVITY':             '2-3 oraciones. Instrucción clara de la actividad práctica con un ejemplo concreto.',
    'SKILL DEVELOPMENT':    '3-4 oraciones. Paso a paso de la actividad principal. Esta es la sección más importante.',
    'CLOSING':              '1 oración. Pregunta de reflexión o síntesis del aprendizaje.',
    'ASSIGNMENT':           '1 oración. Tarea específica y alcanzable.',
  }
  const limit = SECTION_LIMITS[section.label] || '2-3 oraciones.'

  const system = `Eres un asistente pedagógico experto para colegios bilingües colombianos.
Generas sugerencias de actividades para guías de aprendizaje autónomo (CBF).
Respondes SIEMPRE en español, con actividades concretas, prácticas y apropiadas para el nivel.
Formato: texto corrido, listo para pegar en la guía. Sin listas, sin viñetas, sin markdown.
LÍMITE ESTRICTO para esta sección: ${limit}
${learningTarget ? `
IMPORTANTE: Esta guía tiene un OBJETIVO DE DESEMPEÑO vinculado. Tu sugerencia DEBE estar alineada
a este desempeño observable. No generes actividades genéricas — genera actividades que lleven
al estudiante a demostrar este desempeño específico.` : ''}`

  const TAXONOMY_DESC = { recognize: 'Reconocer (identificar, recordar, nombrar)', apply: 'Aplicar (usar, demostrar, resolver)', produce: 'Producir (crear, diseñar, componer)' }

  const message = `Estoy escribiendo la sección "${section.label}" de una guía de aprendizaje.

Contexto:
- Grado: ${grade}
- Materia: ${subject}
- Día: ${dayName}
- Unidad/Tema: ${unit || 'No especificado'}
- Objetivo de la semana: ${objective || 'No especificado'}
- Tiempo estimado de esta sección: ${section.time}
${learningTarget ? `
🎯 OBJETIVO DE DESEMPEÑO VINCULADO:
- Desempeño: ${learningTarget.description}
- Nivel taxonómico: ${TAXONOMY_DESC[learningTarget.taxonomy] || learningTarget.taxonomy}
- La actividad debe contribuir directamente a que el estudiante logre este desempeño.` : ''}
${existingContent ? `- Lo que ya tengo escrito: "${existingContent.replace(/<[^>]+>/g,' ').slice(0,200)}"` : ''}

Sugiere una actividad para "${section.label}". Respeta el límite: ${limit}`

  return callClaude({ type: 'suggest', system, message, planId })
}

// ── Punto 1b: Sugerir SmartBlock para una sección ────────────────────────────
export async function suggestSmartBlock({
  sectionMeta, grade, subject, objective, unit, dayName,
  existingContent, existingBlocks, learningTarget, planId
}) {
  const TAXONOMY_DESC = { recognize: 'Reconocer', apply: 'Aplicar', produce: 'Producir' }

  const blockTypes = `DICTATION: word-grid (lista de palabras), sentences (oraciones numeradas)
QUIZ: topic-card (temas a repasar), format-box (estructura del quiz con puntos)
VOCAB: cards (Word | Definition | Example), matching (términos vs significados)
WORKSHOP: stations (estaciones de trabajo), roles (roles de equipo)
SPEAKING: rubric (criterios con puntos), prep (checklist de pasos)
NOTICE: banner (aviso de ancho completo), alert (caja con prioridad info/warning/danger)
READING: comprehension (pasaje + preguntas abiertas), true-false (pasaje + afirmaciones V/F)
GRAMMAR: fill-blank (completar espacios con ___), choose (elegir la forma correcta)
EXIT_TICKET: can-do ("I can…" con escala emoji), rating (declaraciones + escala 1–5)`

  const taxonomy = learningTarget?.taxonomy
  const taxHint = taxonomy === 'recognize'
    ? 'Nivel RECONOCER: prefiere VOCAB matching, QUIZ topic-card, READING true-false.'
    : taxonomy === 'apply'
    ? 'Nivel APLICAR: prefiere DICTATION, GRAMMAR fill-blank, WORKSHOP stations, READING comprehension.'
    : taxonomy === 'produce'
    ? 'Nivel PRODUCIR: prefiere SPEAKING rubric, WORKSHOP roles, EXIT_TICKET can-do.'
    : ''

  const system = `Eres un experto pedagógico para colegios bilingües colombianos (metodología CBF).
Tu tarea: sugerir UN SmartBlock apropiado para una sección de guía.
Responde SOLO con JSON válido. Sin markdown, sin texto adicional.
Estructura exacta: {"type":"...","model":"...","data":{...}}
Los datos deben estar en inglés (colegio bilingüe) y ser realistas y listos para usar.
${taxHint}`

  const message = `Sección: ${sectionMeta?.label} (${sectionMeta?.time})
Grado: ${grade} | Materia: ${subject} | Día: ${dayName || ''}
Unidad: ${unit || 'no especificada'}
Objetivo semanal: ${objective || 'no especificado'}
${learningTarget ? `Desempeño observable: ${learningTarget.description} (${TAXONOMY_DESC[learningTarget.taxonomy] || ''})` : ''}
Contenido ya escrito: ${existingContent ? existingContent.replace(/<[^>]+>/g,' ').slice(0,200) : '(vacío)'}
Bloques ya presentes: ${existingBlocks?.length ? existingBlocks.map(b=>b.type).join(', ') : 'ninguno'}

Tipos disponibles:
${blockTypes}

Sugiere el bloque más pedagógicamente apropiado para este contexto. Incluye datos completos y realistas.`

  const raw = await callClaude({ type: 'suggest', system, message, planId, maxTokens: 1200 })
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('La IA no devolvió un bloque válido.')
  try {
    return JSON.parse(match[0].trim())
  } catch {
    throw new Error('No se pudo leer el bloque sugerido.')
  }
}

// ── Punto 2: Análisis completo de la guía ────────────────────────────────────
export async function analyzeGuide(content, planId) {
  const system = `Eres un asesor pedagógico experto en diseño curricular para colegios bilingües.
Analizas guías de aprendizaje autónomo y das retroalimentación constructiva y específica.
Respondes en español. Sé directo, práctico y amable.
Estructura tu respuesta con estas secciones exactas (usa estos emojis como títulos):
✅ Fortalezas
⚠️ Alertas
💡 Sugerencias
📊 Balance de tiempos`

  const i = content.info    || {}
  const o = content.objetivo || {}
  const days = Object.entries(content.days || {})
    .filter(([,d]) => d.active !== false)
    .map(([iso, d]) => ({
      date: d.date_label || iso,
      unit: d.unit || '',
      sections: Object.entries(d.sections || {}).map(([key, s]) => ({
        name:    key,
        time:    s.time || '',
        content: (s.content || '').replace(/<[^>]+>/g,' ').slice(0, 300),
        hasSmartBlocks: (s.smartBlocks || []).length > 0,
        hasImages:      (s.images || []).length > 0,
      }))
    }))

  const message = `Analiza esta guía de aprendizaje:

ENCABEZADO:
- Grado: ${i.grado} | Materia: ${i.asignatura} | Semana: ${i.semana}
- Período: ${i.periodo} | Fechas: ${i.fechas}

OBJETIVO:
- General: ${o.general?.replace(/<[^>]+>/g,' ') || 'No especificado'}
- Indicador: ${o.indicador?.replace(/<[^>]+>/g,' ') || 'No especificado'}
- Principio: ${o.principio || ''}

DÍAS Y ACTIVIDADES:
${days.map(d => `
📅 ${d.date}${d.unit ? ` — ${d.unit}` : ''}
${d.sections.map(s => `  [${s.name}] ${s.time}: ${s.content || '(vacío)'} ${s.hasSmartBlocks?'[+bloques]':''} ${s.hasImages?'[+imágenes]':''}`).join('\n')}`).join('\n')}

RESUMEN:
- Lo trabajado: ${(content.summary?.done || '').replace(/<[^>]+>/g,' ').slice(0,200) || 'No especificado'}
- Próxima semana: ${(content.summary?.next || '').replace(/<[^>]+>/g,' ').slice(0,200) || 'No especificado'}

Dame un análisis pedagógico completo.`

  return callClaude({ type: 'analyze', system, message, planId, maxTokens: 4000 })
}

// ── Punto 3: Generar estructura completa desde objetivo ───────────────────────
export async function generateGuideStructure({
  grade, subject, objective, unit, activeDays, period, planId, learningTarget
}) {
  const TAXONOMY_DESC = { recognize: 'Reconocer (identificar, recordar, nombrar)', apply: 'Aplicar (usar, demostrar, resolver)', produce: 'Producir (crear, diseñar, componer)' }

  const system = `Eres un experto en diseño de guías de aprendizaje autónomo para colegios bilingües colombianos.
Generas estructuras completas de guías semanales siguiendo el modelo CBF con 6 secciones por día:
1. SUBJECT TO BE WORKED (~8 min): introducción al tema del día
2. MOTIVATION (~8 min): actividad de enganche/warm-up
3. ACTIVITY (~15 min): actividad principal de práctica
4. SKILL DEVELOPMENT (~40 min): desarrollo profundo de la habilidad
5. CLOSING (~8 min): cierre y reflexión
6. ASSIGNMENT (~5 min): tarea o extensión
${learningTarget ? `
PRINCIPIO PEDAGÓGICO CENTRAL:
Esta guía tiene un OBJETIVO DE DESEMPEÑO específico vinculado. Todo el contenido que generes
debe estar diseñado para que el estudiante progrese hacia ese desempeño observable.
Nivel taxonómico del objetivo: ${TAXONOMY_DESC[learningTarget.taxonomy] || learningTarget.taxonomy}.
- Si el nivel es "Reconocer": enfoca las actividades en identificación, clasificación, y recuerdo activo.
- Si el nivel es "Aplicar": enfoca en práctica guiada, resolución de problemas, y uso contextualizado.
- Si el nivel es "Producir": enfoca en creación, composición, y producción autónoma.
Las actividades deben progresar durante la semana HACIA el desempeño, no solo "cubrir el tema".` : ''}

Respondes ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown.
El JSON debe tener exactamente esta estructura:
{
  "days": {
    "YYYY-MM-DD": {
      "unit": "string",
      "sections": {
        "subject":    {"content": "string"},
        "motivation": {"content": "string"},
        "activity":   {"content": "string", "smartBlock": {"type":"...","model":"...","data":{}}},
        "skill":      {"content": "string", "smartBlock": {"type":"...","model":"...","data":{}}},
        "closing":    {"content": "string"},
        "assignment": {"content": "string"}
      }
    }
  },
  "objetivo": {
    "general":   "string",
    "indicador": "string"
  },
  "summary": {
    "next": "string"
  }
}
El campo "smartBlock" es OPCIONAL y solo debe incluirse en las secciones "activity" y "skill" cuando
sea pedagógicamente relevante (máximo 1 bloque por sección, máximo 2 bloques por día).
Tipos de SmartBlock disponibles:
- VOCAB: cards {words:[{w,d,e}]} | matching {words:[{w,d,e}]}
- DICTATION: word-grid {words:string[],instructions:string} | sentences {words:string[],instructions:string}
- GRAMMAR: fill-blank {grammar_point,instructions,sentences:[{sent,answer}]} | choose {grammar_point,instructions,items:[{sentence,options:[],answer}]}
- READING: comprehension {passage,questions:[{q,lines}]} | true-false {passage,statements:[{s}]}
- SPEAKING: rubric {criteria:[{name,pts}],date?} | prep {steps:string[],date?}
- EXIT_TICKET: can-do {skills:string[],date?} | rating {statements:string[],date?}
- QUIZ: topic-card {unit,date,topics,note?} | format-box {unit,date,topics,format,note?}
- NOTICE: banner {title,message,icon} | alert {title,message,icon,priority}
Usa inglés en los datos del bloque (colegio bilingüe). Si no hay un bloque claramente apropiado para una sección, omite "smartBlock".`

  const daysStr = activeDays.map((iso, i) => {
    const d = new Date(iso + 'T12:00:00')
    const names = ['Lunes','Martes','Miércoles','Jueves','Viernes']
    return `Día ${i+1} (${names[d.getDay()-1]}, ${iso})`
  }).join(', ')

  const message = `Genera una guía de aprendizaje completa con estos datos:

- Grado: ${grade}
- Materia: ${subject}
- Período: ${period}
- Unidad/Tema: ${unit || 'No especificado'}
- Objetivo del docente: ${objective}
- Días de clase esta semana: ${daysStr}
${learningTarget ? `
🎯 OBJETIVO DE DESEMPEÑO VINCULADO:
- Desempeño observable: ${learningTarget.description}
- Nivel taxonómico: ${TAXONOMY_DESC[learningTarget.taxonomy] || learningTarget.taxonomy}
- TODA la semana debe construir hacia este desempeño. El viernes (o último día), el estudiante
  debería estar en capacidad de demostrar este desempeño.` : ''}

Genera contenido específico, concreto y apropiado para el nivel.
Las actividades deben progresar lógicamente durante la semana.
El contenido debe estar en el idioma apropiado para la materia (inglés para Language Arts, español para otras).
Usa texto plano, no HTML.

LÍMITES DE EXTENSIÓN POR SECCIÓN (sé conciso y específico):
- SUBJECT (~8 min): 1 oración. Enuncia el tema o habilidad del día.
- MOTIVATION (~8 min): 1-2 oraciones. Describe la actividad de enganche (pregunta, juego corto, imagen, reto).
- ACTIVITY (~15 min): 2-3 oraciones. Instrucción clara de la actividad práctica con un ejemplo concreto.
- SKILL DEVELOPMENT (~40 min): 3-4 oraciones. Paso a paso de la actividad principal. Esta es la sección más importante.
- CLOSING (~8 min): 1 oración. Pregunta de reflexión o síntesis del aprendizaje.
- ASSIGNMENT (~5 min): 1 oración. Tarea específica y alcanzable.
No uses listas con viñetas dentro del contenido. Texto corrido, directo al punto.`

  const raw = await callClaude({ type: 'generate', system, message, planId, maxTokens: 16000 })

  // Try to parse JSON, if truncated retry once with concise instruction
  function tryParseJSON(text) {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0].trim())
    } catch {
      return null
    }
  }

  const result = tryParseJSON(raw)
  if (result) return result

  // Retry: ask for more compact content
  const retryMessage = `${message}

IMPORTANTE: Tu respuesta anterior fue cortada. Sé más breve:
- SUBJECT, MOTIVATION, CLOSING, ASSIGNMENT: 1 oración cada uno.
- ACTIVITY: 2 oraciones.
- SKILL DEVELOPMENT: 3 oraciones.
- Responde SOLO con el JSON, sin texto antes ni después.`

  const retryRaw = await callClaude({ type: 'generate', system, message: retryMessage, planId, maxTokens: 16000 })
  const retryResult = tryParseJSON(retryRaw)
  if (retryResult) return retryResult

  throw new Error(`No se pudo generar la guía. Intenta con menos días o un objetivo más específico.`)
}
