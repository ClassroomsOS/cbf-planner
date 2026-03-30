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
  const system = `Eres un asistente pedagógico experto para colegios bilingües colombianos.
Generas sugerencias de actividades para guías de aprendizaje autónomo (CBF).
Respondes SIEMPRE en español, con actividades concretas, prácticas y apropiadas para el nivel.
Formato: texto corrido, listo para pegar en la guía. Sin marcadores markdown excesivos.
Sé conciso pero específico. Máximo 150 palabras.
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

Sugiere una actividad específica para la sección "${section.label}" que sea coherente con el objetivo y apropiada para el tiempo disponible.`

  return callClaude({ type: 'suggest', system, message, planId })
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
        "activity":   {"content": "string"},
        "skill":      {"content": "string"},
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
}`

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
Usa texto plano, no HTML.`

  const raw = await callClaude({ type: 'generate', system, message, planId, maxTokens: 4000 })

  try {
    // Extraer JSON aunque Groq agregue texto extra alrededor
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found')
    const clean = match[0].trim()
    return JSON.parse(clean)
  } catch (e) {
    throw new Error(`JSON inválido. Raw: ${raw?.slice(0, 200)}`)
  }
}
