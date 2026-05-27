// dictationAI.js — Generación de dictation/vocabulary assessment via Claude
// Importa callClaude de aiClient.js (nunca de AIAssistant.js)

import { callClaude } from './aiClient'
import { QUESTION_POINTS, ASSESSMENT_MODES, getQuestionCounts } from './dictationUtils'

/**
 * Genera un assessment completo desde vocabulario.
 * Soporta 3 modos: dictation (audio), vocab_quiz (Linguaskill), combined (ambos).
 *
 * @param {Object} params
 * @param {string[]} params.vocabulary     — lista de palabras/frases
 * @param {string}   params.unitReference  — referencia del libro/unidad
 * @param {string}   params.grade          — grado (ej. "8.° Blue")
 * @param {string}   params.subject        — materia
 * @param {string}   params.difficulty     — 'Basico' | 'Intermedio' | 'Avanzado'
 * @param {string}   params.assessmentMode — 'dictation' | 'vocab_quiz' | 'combined'
 * @returns {Promise<Object>} — { sections, title, instructions, generatedQuestions }
 */
export async function generateDictation({ vocabulary, unitReference, grade, subject, difficulty, assessmentMode = 'dictation' }) {
  const mode = ASSESSMENT_MODES[assessmentMode] || ASSESSMENT_MODES.dictation
  const counts = getQuestionCounts(difficulty, assessmentMode)

  const system = `You are an expert English language assessment designer for Colegio Boston Flexible (Barranquilla, Colombia). You create vocabulary and listening assessments aligned with Cambridge Linguaskill and PET standards. Your output is ALWAYS valid JSON — no markdown, no explanation, no code fences.`

  // Build section instructions dynamically based on which types are in the mode
  const sectionPrompts = []
  let sectionNum = 1

  if (counts.listen_type > 0) {
    sectionPrompts.push(`SECTION ${sectionNum} — LISTEN & TYPE (${counts.listen_type} items)
The student hears a word and must type it correctly (USE CAPITAL LETTERS).
For each item generate:
- "audio_text": what the TTS will say (format: "Number [N]... [word]... [word]" — say the word twice with a pause)
- "correct_answer": the exact word/phrase to type
- "max_score": ${QUESTION_POINTS.listen_type}`)
    sectionNum++
  }

  if (counts.listen_identify > 0) {
    sectionPrompts.push(`SECTION ${sectionNum} — LISTEN & IDENTIFY (${counts.listen_identify} items)
The student hears a sentence containing one of the vocabulary words and must identify WHICH word was used.
For each item generate:
- "audio_text": the full sentence to be read by TTS
- "options": array of exactly 3 vocabulary words as choices (one correct, two distractors from the vocabulary list)
- "correct_answer": the vocabulary word used in the sentence
- "max_score": ${QUESTION_POINTS.listen_identify}`)
    sectionNum++
  }

  if (counts.matching > 0) {
    sectionPrompts.push(`SECTION ${sectionNum} — MATCHING (${counts.matching} items)
Linguaskill-style: the student reads a vocabulary word and must match it to its correct DEFINITION.
For each item generate:
- "word": the vocabulary word/phrase
- "options": array of exactly 4 definitions (one correct, three distractors — distractors must be plausible but clearly wrong definitions)
- "correct_answer": the correct definition (must match one of the options exactly)
- "max_score": ${QUESTION_POINTS.matching}

IMPORTANT for matching:
- Definitions must be clear, concise (1 short sentence or phrase)
- Distractors must be definitions of OTHER vocabulary words from the list (not made-up)
- Each word should have a unique, unambiguous correct definition`)
    sectionNum++
  }

  if (counts.fill_blank > 0) {
    sectionPrompts.push(`SECTION ${sectionNum} — FILL THE BLANK (${counts.fill_blank} items)
A written sentence with a blank (___) where a vocabulary word fits. No audio needed.
For each item generate:
- "sentence": the sentence with ___ for the blank
- "options": array of exactly 3 vocabulary words as choices
- "correct_answer": the correct vocabulary word
- "max_score": ${QUESTION_POINTS.fill_blank}`)
    sectionNum++
  }

  if (counts.writing > 0) {
    sectionPrompts.push(`SECTION ${sectionNum} — WRITING COMPOSITION (${counts.writing} items)
Linguaskill-style: the student writes a short paragraph using vocabulary words.
For each item generate:
- "prompt": a clear writing prompt that naturally requires using the vocabulary (e.g. "Write 3-5 sentences about your ideal career using at least 5 of the following words: salary, trade, commission, benefits, overtime.")
- "required_words": array of 5-8 vocabulary words the student should use
- "correct_answer": "" (writing is scored by vocabulary usage, not exact match)
- "max_score": ${QUESTION_POINTS.writing}

IMPORTANT for writing:
- The prompt must be engaging and age-appropriate for ${grade}
- Required words should be achievable within 3-5 sentences
- The topic should naturally incorporate the vocabulary theme`)
    sectionNum++
  }

  const message = `Generate a vocabulary assessment with the following sections.

VOCABULARY (${vocabulary.length} words/phrases):
${vocabulary.map((w, i) => `${i + 1}. ${w}`).join('\n')}

UNIT REFERENCE: ${unitReference || 'General vocabulary'}
GRADE: ${grade}
SUBJECT: ${subject}
DIFFICULTY: ${difficulty}
ASSESSMENT MODE: ${mode.label}
${difficulty === 'Basico' ? '→ Use short, simple sentences with literal vocabulary usage.' : ''}
${difficulty === 'Intermedio' ? '→ Use compound sentences with real-world context.' : ''}
${difficulty === 'Avanzado' ? '→ Use complex sentences with inferential/figurative vocabulary usage.' : ''}

${sectionPrompts.join('\n\n')}

IMPORTANT RULES:
- Use ONLY words from the provided vocabulary list
- Distribute vocabulary evenly across all sections (don't repeat the same word too often)
- Distractors must be other words from the vocabulary list (for MC) or definitions of other vocab words (for matching)
- All sentences must be in English
- Section audio_text (if any) must sound natural when read aloud by TTS
- Fill the blank sentences must have exactly one clear answer
- Matching definitions must be clear and unambiguous

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "title": "${assessmentMode === 'dictation' ? 'Dictation' : assessmentMode === 'vocab_quiz' ? 'Vocabulary Quiz' : 'Assessment'}: [unit reference]",
  "instructions": "Complete each section carefully.",
  "sections": [
    ${mode.types.filter(t => (counts[t] || 0) > 0).map(t => {
      if (t === 'listen_type') return `{
      "type": "listen_type",
      "title": "Section: Listen and Type",
      "instructions": "Listen carefully and write down the correct words. USE CAPITAL LETTERS.",
      "items": [
        { "audio_text": "Number 1... salary cut... salary cut", "correct_answer": "SALARY CUT", "max_score": ${QUESTION_POINTS.listen_type} }
      ]
    }`
      if (t === 'listen_identify') return `{
      "type": "listen_identify",
      "title": "Section: Listen and Identify",
      "instructions": "Listen and identify the vocabulary term in the sentence.",
      "items": [
        { "audio_text": "She was worried about the rising cost of living.", "options": ["Salary cut", "Cost of living", "Trade"], "correct_answer": "Cost of living", "max_score": ${QUESTION_POINTS.listen_identify} }
      ]
    }`
      if (t === 'matching') return `{
      "type": "matching",
      "title": "Part A: Matching",
      "instructions": "Match each word with its correct definition.",
      "items": [
        { "word": "Wage", "options": ["Money paid for work, usually hourly", "A type of investment", "A formal agreement", "The cost of goods"], "correct_answer": "Money paid for work, usually hourly", "max_score": ${QUESTION_POINTS.matching} }
      ]
    }`
      if (t === 'fill_blank') return `{
      "type": "fill_blank",
      "title": "Section: Fill the Blank",
      "instructions": "Choose the correct word to complete the sentence.",
      "items": [
        { "sentence": "Her monthly ___ barely covered expenses.", "options": ["Wage", "Budget", "Salary cut"], "correct_answer": "Wage", "max_score": ${QUESTION_POINTS.fill_blank} }
      ]
    }`
      if (t === 'writing') return `{
      "type": "writing",
      "title": "Part C: Writing Composition",
      "instructions": "Write a short paragraph using the required vocabulary words.",
      "items": [
        { "prompt": "Write 3-5 sentences about your dream job using at least 5 of these words: salary, trade, commission, benefits, overtime.", "required_words": ["salary", "trade", "commission", "benefits", "overtime"], "correct_answer": "", "max_score": ${QUESTION_POINTS.writing} }
      ]
    }`
      return ''
    }).join(',\n    ')}
  ]
}`

  const text = await callClaude({
    type: 'dictation_generate',
    system,
    message,
    maxTokens: 5000,
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
      throw new Error('La IA no devolvió JSON válido para el assessment.')
    }
  }

  // Validate structure
  const expectedTypes = mode.types.filter(t => (counts[t] || 0) > 0)
  if (!parsed.sections || parsed.sections.length < expectedTypes.length) {
    throw new Error(`La IA generó ${parsed.sections?.length || 0} secciones, se esperaban ${expectedTypes.length}.`)
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
        word: item.word || null,
        prompt: item.prompt || null,
        required_words: item.required_words || null,
        options: item.options || null,
        correct_answer: item.correct_answer,
        max_score: item.max_score || QUESTION_POINTS[section.type] || 1,
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
