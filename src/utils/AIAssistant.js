// ── AIAssistant.js ────────────────────────────────────────────────────────────
// Re-export barrel — preserves all existing import paths across the codebase.
// Internal modules: aiClient.js · guideAI.js · examAI.js

export { setAIContext } from './aiClient'

export {
  suggestSectionActivity,
  suggestSmartBlock,
  analyzeGuide,
  generateGuideStructure,
  generateRubric,
  generateIndicadores,
  importGuideFromDocx,
  analyzeGuideCoverage,
  generateStudentRubric,
} from './guideAI'

export { generateExamQuestions } from './examAI'
