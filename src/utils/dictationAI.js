// dictationAI.js — Generación de dictation via Claude
// Importa callClaude de aiClient.js (nunca de AIAssistant.js)

import { callClaude } from './aiClient'
import { DIFFICULTY_CONFIG, QUESTION_POINTS } from './dictationUtils'

/**
 * Genera un dictation completo con 3 secciones a partir de vocabulario.
 *
 * @param {Object} params
 * @param {string[]} params.vocabulary     — lista de palabras/frases de vocabulario
 * @param {string}   params.unitReference  — referencia del libro/unidad
 * @param {string}   params.grade          — grado (ej. "8.° Blue")
 * @param {string}   params.subject        — materia
 * @param {string}   params.difficulty     — 'Basico' | 'Intermedio' | 'Avanzado'
 * @returns {Promise<Object>} — { sections: [...], title, instructions }
 */
export async function generateDictation({ vocabulary, unitReference, grade, subject, difficulty }) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.Intermedio

  const system = `You are an expert English language assessment designer for Colegio Boston Flexible (Barranquilla, Colombia). You create dictation exams that test vocabulary listening and recognition skills. Your output is ALWAYS valid JSON — no markdown, no explanation, no code fences.`

  const message = `Generate a dictation exam with exactly 3 sections.

VOCABULARY (${vocabulary.length} words/phrases):
${vocabulary.map((w, i) => `${i + 1}. ${w}`).join('\n')}

UNIT REFERENCE: ${unitReference || 'General vocabulary'}
GRADE: ${grade}
SUBJECT: ${subject}
DIFFICULTY: ${difficulty}
${difficulty === 'Basico' ? '→ Use short, simple sentences with literal vocabulary usage.' : ''}
${difficulty === 'Intermedio' ? '→ Use compound sentences with real-world context.' : ''}
${difficulty === 'Avanzado' ? '→ Use complex sentences with inferential/figurative vocabulary usage.' : ''}

SECTION 1 — LISTEN & TYPE (${config.listenType} items)
The student hears a word and must type it correctly (USE CAPITAL LETTERS).
For each item generate:
- "audio_text": what the TTS will say (format: "Number [N]... [word]... [word]" — say the word twice with a pause)
- "correct_answer": the exact word/phrase to type
- "max_score": ${QUESTION_POINTS.listen_type}

SECTION 2 — LISTEN & IDENTIFY (${config.listenIdentify} items)
The student hears a sentence containing one of the vocabulary words and must identify WHICH word was used.
For each item generate:
- "audio_text": the full sentence to be read by TTS
- "options": array of exactly 3 vocabulary words as choices (one correct, two distractors from the vocabulary list)
- "correct_answer": the vocabulary word used in the sentence
- "max_score": ${QUESTION_POINTS.listen_identify}

SECTION 3 — FILL THE BLANK (${config.fillBlank} items)
A written sentence with a blank (___) where a vocabulary word fits. No audio needed.
For each item generate:
- "sentence": the sentence with ___ for the blank
- "options": array of exactly 3 vocabulary words as choices
- "correct_answer": the correct vocabulary word
- "max_score": ${QUESTION_POINTS.fill_blank}

IMPORTANT RULES:
- Use ONLY words from the provided vocabulary list
- Distribute vocabulary evenly across all sections (don't repeat the same word too often)
- Distractors must be other words from the vocabulary list
- All sentences must be in English
- Section 1 audio_text must say each word TWICE with a natural pause
- Section 2 sentences must sound natural when read aloud by TTS
- Fill the blank sentences must have exactly one clear answer

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "title": "Dictation: [unit reference]",
  "instructions": "Listen carefully and answer each section. Use CAPITAL LETTERS when typing words.",
  "sections": [
    {
      "type": "listen_type",
      "title": "Section 1: Listen and Type",
      "instructions": "Listen carefully and write down the correct words from the vocabulary. USE CAPITAL LETTERS.",
      "items": [
        { "audio_text": "Number 1... salary cut... salary cut", "correct_answer": "SALARY CUT", "max_score": ${QUESTION_POINTS.listen_type} }
      ]
    },
    {
      "type": "listen_identify",
      "title": "Section 2: Listen and Identify",
      "instructions": "Listen carefully and identify the vocabulary terms within the sentences. USE CAPITAL LETTERS.",
      "items": [
        { "audio_text": "She was worried about the rising cost of living in her city.", "options": ["Salary cut", "Cost of living", "Trade"], "correct_answer": "Cost of living", "max_score": ${QUESTION_POINTS.listen_identify} }
      ]
    },
    {
      "type": "fill_blank",
      "title": "Section 3: Fill the Blank",
      "instructions": "Multiple choice: select the correct answer.",
      "items": [
        { "sentence": "Her monthly ___ barely covered the expenses of her small apartment.", "options": ["Wage", "Budget", "Salary cut"], "correct_answer": "Wage", "max_score": ${QUESTION_POINTS.fill_blank} }
      ]
    }
  ]
}`

  const text = await callClaude({
    type: 'dictation_generate',
    system,
    message,
    maxTokens: 4000,
  })

  // Parse JSON — handle markdown fences if present
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      parsed = JSON.parse(match[0])
    } else {
      throw new Error('La IA no devolvió JSON válido para el dictation.')
    }
  }

  // Validate structure
  if (!parsed.sections || parsed.sections.length !== 3) {
    throw new Error('La IA no generó las 3 secciones requeridas.')
  }

  // Flatten to generated_questions format for storage
  const generatedQuestions = []
  let index = 0

  for (const section of parsed.sections) {
    for (const item of section.items) {
      generatedQuestions.push({
        index,
        question_type: section.type,
        section_title: section.title,
        audio_text: item.audio_text || null,
        sentence: item.sentence || null,
        options: item.options || null,
        correct_answer: item.correct_answer,
        max_score: item.max_score || 1,
      })
      index++
    }
  }

  return {
    title: parsed.title,
    instructions: parsed.instructions,
    sections: parsed.sections,
    generatedQuestions,
  }
}
