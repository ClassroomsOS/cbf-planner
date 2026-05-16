// ── activityPatterns.js ───────────────────────────────────────────────────────
// Catalog of proven instructional activity patterns for CBF Guide Experience Engine.
//
// Philosophy:
//   Teachers don't invent activities — they apply proven patterns to their content.
//   Each pattern is a reusable interaction structure with defined inputs, steps,
//   and rendering hints for ClassroomOS and DOCX export.
//
//   AI uses this catalog to suggest the right pattern for a given learning objective.
//   AI NEVER invents resources — it fills patterns using verified content from the
//   guide's Syllabus, Library, and teacher-provided data.
//
// Pattern families:
//   INPUT      — Student receives and processes information (I DO)
//   PROCESSING — Student manipulates information with peers (WE DO)
//   OUTPUT     — Student produces independently (YOU DO)
//   ACTIVATION — Energizes prior knowledge (Momento 3 / transitions)
//   ASSESSMENT — Verifies and closes learning (Momento 5)
// ─────────────────────────────────────────────────────────────────────────────

// ── Pattern families ──────────────────────────────────────────────────────────
export const PATTERN_FAMILIES = /** @type {const} */ ({
  INPUT:      'input',
  PROCESSING: 'processing',
  OUTPUT:     'output',
  ACTIVATION: 'activation',
  ASSESSMENT: 'assessment',
})

// ── Scaffold phases each family naturally belongs to ─────────────────────────
export const FAMILY_PHASE = {
  [PATTERN_FAMILIES.INPUT]:      'i-do',
  [PATTERN_FAMILIES.PROCESSING]: 'we-do',
  [PATTERN_FAMILIES.OUTPUT]:     'you-do',
  [PATTERN_FAMILIES.ACTIVATION]: null,     // Momento 3 or any transition
  [PATTERN_FAMILIES.ASSESSMENT]: null,     // Momento 5
}

// ── Skill labels (for matching and filtering) ─────────────────────────────────
export const SKILLS = /** @type {const} */ ({
  SPEAKING:  'speaking',
  LISTENING: 'listening',
  READING:   'reading',
  WRITING:   'writing',
  GRAMMAR:   'grammar',
  VOCAB:     'vocabulary',
  CRITICAL:  'critical-thinking',
  KINETIC:   'kinesthetic',
})

// ── Thinking types (Bloom-adjacent) ──────────────────────────────────────────
export const THINKING = /** @type {const} */ ({
  RECALL:      'recall',
  UNDERSTAND:  'understand',
  APPLY:       'apply',
  ANALYZE:     'analyze',
  EVALUATE:    'evaluate',
  CREATE:      'create',
})

// ── Pattern input field types ─────────────────────────────────────────────────
// Used by the editor to render the correct form control for each pattern's inputs.
export const INPUT_FIELD_TYPES = /** @type {const} */ ({
  TEXT:           'text',           // Short text
  TEXTAREA:       'textarea',       // Long text
  TEXT_LIST:      'text-list',      // Ordered list of text items (add/remove)
  RICH_LIST:      'rich-list',      // List of items with text + optional image
  PAIR_LIST:      'pair-list',      // List of { a, b } pairs
  NUMBER:         'number',
  SELECT:         'select',         // Dropdown with options
  ANNOTATED_IMAGE:'annotated-image',// Image + annotation canvas
  MEDIA_URL:      'media-url',      // YouTube/Vimeo/upload URL
})

// ── Pattern catalog ───────────────────────────────────────────────────────────
// Each entry is a fully self-describing pattern definition.
// The `inputs` field defines the form the teacher fills when selecting this pattern.
// The `teacherSteps` and `studentSteps` power the contextual help panel.
// The `aiTriggers` tell the AI matching engine when to suggest this pattern.

export const ACTIVITY_PATTERNS = [

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY: INPUT (I DO)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id:     'guided-noticing',
    family: PATTERN_FAMILIES.INPUT,
    name:   { es: 'Observación Guiada', en: 'Guided Noticing' },
    icon:   '🔍',
    skills: [SKILLS.GRAMMAR, SKILLS.VOCAB, SKILLS.CRITICAL],
    thinking: THINKING.ANALYZE,
    grouping: 'whole-class',
    duration: { min: 5, typical: 10, max: 15 },

    description: {
      es: 'El docente presenta 4-6 ejemplos del patrón objetivo. Los estudiantes observan, comparan y deducen la regla por sí mismos.',
      en: 'The teacher presents 4-6 examples of the target pattern. Students observe, compare, and deduce the rule themselves.',
    },

    whyItWorks: {
      es: 'La deducción activa la memoria profunda. Cuando el estudiante descubre la regla en vez de recibirla, la retiene mejor y puede aplicarla en nuevos contextos.',
      en: 'Deduction activates deep memory. When students discover the rule instead of receiving it, retention is higher and transfer to new contexts is stronger.',
    },

    inputs: {
      required: [
        {
          key:   'examples',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Ejemplos (4-6 oraciones que muestran el patrón)', en: 'Examples (4-6 sentences showing the pattern)' },
          hint:  { es: 'Escribe oraciones que ilustren claramente el patrón. Subraya o marca la parte clave.', en: 'Write sentences that clearly illustrate the pattern. Underline or mark the key part.' },
          min: 3, max: 6,
        },
        {
          key:   'question',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Pregunta guía', en: 'Guiding question' },
          hint:  { es: 'Ej: "¿Qué tienen en común estos verbos?" / "What do you notice about the verbs?"', en: 'E.g. "What do these verbs have in common?" / "What pattern do you notice?"' },
        },
      ],
      optional: [
        {
          key:   'grammarTarget',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Estructura objetivo (se resalta en ClassroomOS)', en: 'Target structure (highlighted in ClassroomOS)' },
        },
        {
          key:   'counterExamples',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Contraejemplos (opcional)', en: 'Counter-examples (optional)' },
          hint:  { es: 'Ejemplos que NO siguen el patrón — ayudan a delimitar la regla.', en: 'Examples that do NOT follow the pattern — help define the rule\'s limits.' },
          max: 3,
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Prepara 4-6 oraciones/ejemplos que contengan el patrón objetivo. Asegúrate de que el patrón sea claro pero no lo expliques aún.',
        en: 'Prepare 4-6 sentences/examples containing the target pattern. Make sure the pattern is clear but do not explain it yet.',
      },
      during: {
        es: 'Proyecta los ejemplos uno a uno. Pide a los estudiantes que identifiquen qué tienen en común. Usa la pregunta guía. Escucha las respuestas — no confirmes ni niegues de inmediato.',
        en: 'Project examples one by one. Ask students to identify what they have in common. Use the guiding question. Listen to answers — do not confirm or deny immediately.',
      },
      after: {
        es: 'Una vez que emerja la regla correcta, confírmala y escríbela en el tablero. Conecta con los ejemplos que vieron.',
        en: 'Once the correct rule emerges, confirm it and write it on the board. Connect back to the examples they saw.',
      },
    },

    studentSteps: [
      { es: 'Observa los ejemplos en pantalla', en: 'Look at the examples on screen' },
      { es: 'Piensa: ¿qué tienen en común?', en: 'Think: what do they have in common?' },
      { es: 'Comparte tu hipótesis con la clase', en: 'Share your hypothesis with the class' },
      { es: 'Escribe la regla que descubriste', en: 'Write the rule you discovered' },
    ],

    aiTriggers: ['grammar', 'rule', 'pattern', 'inductive', 'discover', 'notice'],

    classroomDisplay: {
      layout:          'examples-reveal',
      revealMode:      'step-by-step',   // Show one example at a time
      showQuestion:    true,
      highlightTarget: true,             // Auto-highlight grammarTarget in examples
      showTimer:       false,
    },

    printLayout: {
      style:   'examples-table',
      caption: 'Observa y descubre la regla / Observe and discover the rule',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────

  {
    id:     'model-text',
    family: PATTERN_FAMILIES.INPUT,
    name:   { es: 'Texto Modelo', en: 'Model Text' },
    icon:   '📄',
    skills: [SKILLS.WRITING, SKILLS.READING, SKILLS.GRAMMAR],
    thinking: THINKING.UNDERSTAND,
    grouping: 'whole-class',
    duration: { min: 5, typical: 8, max: 15 },

    description: {
      es: 'Se presenta un texto modelo que demuestra la tarea de escritura objetivo. Los estudiantes analizan su estructura antes de producir el suyo.',
      en: 'A model text that demonstrates the target writing task is presented. Students analyze its structure before producing their own.',
    },

    whyItWorks: {
      es: 'Ver el producto final antes de crearlo reduce la ansiedad y clarifica las expectativas. El modelo es el andamio más poderoso para la escritura.',
      en: 'Seeing the final product before creating it reduces anxiety and clarifies expectations. The model text is the most powerful scaffold for writing.',
    },

    inputs: {
      required: [
        {
          key:   'text',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Texto modelo', en: 'Model text' },
          hint:  { es: 'Escribe el texto de ejemplo. Debe demostrar claramente la estructura y el lenguaje objetivo.', en: 'Write the example text. It should clearly demonstrate the target structure and language.' },
        },
      ],
      optional: [
        {
          key:   'annotations',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Anotaciones de estructura (ej: "Introducción", "Argumento 1")', en: 'Structure annotations (e.g. "Introduction", "Argument 1")' },
        },
        {
          key:   'grammarTarget',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Estructura gramatical a resaltar', en: 'Grammar structure to highlight' },
        },
        {
          key:   'source',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Fuente / atribución', en: 'Source / attribution' },
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Prepara o selecciona un texto modelo de alta calidad. Idealmente cerca del nivel de producción esperado del estudiante — ni demasiado simple ni inalcanzable.',
        en: 'Prepare or select a high-quality model text. Ideally close to the expected student production level — neither too simple nor unattainable.',
      },
      during: {
        es: 'Lee el texto en voz alta una vez (o pide a un estudiante que lo lea). Luego analícenlo juntos: ¿qué hace el autor? ¿cómo está organizado?',
        en: 'Read the text aloud once (or ask a student to read it). Then analyze it together: what does the author do? how is it organized?',
      },
      after: {
        es: 'Deja el texto modelo visible en pantalla mientras los estudiantes escriben. Es su referencia, no una respuesta a copiar.',
        en: 'Keep the model text visible on screen while students write. It is their reference, not an answer to copy.',
      },
    },

    studentSteps: [
      { es: 'Lee el texto modelo en silencio', en: 'Read the model text silently' },
      { es: 'Identifica la estructura: ¿cómo empieza? ¿cómo se desarrolla? ¿cómo cierra?', en: 'Identify the structure: how does it start? how does it develop? how does it close?' },
      { es: 'Subraya frases o palabras que quieras usar en tu propio texto', en: 'Underline phrases or words you want to use in your own text' },
    ],

    aiTriggers: ['writing', 'paragraph', 'essay', 'letter', 'text', 'model', 'structure'],

    classroomDisplay: {
      layout:          'full-text',
      revealMode:      'all-at-once',
      highlightTarget: true,
      showAnnotations: true,
      showTimer:       false,
    },

    printLayout: {
      style:   'framed-box',
      caption: 'Texto modelo / Model text',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────

  {
    id:     'picture-narration',
    family: PATTERN_FAMILIES.INPUT,
    name:   { es: 'Narración con Imagen', en: 'Picture Narration' },
    icon:   '🖼️',
    skills: [SKILLS.LISTENING, SKILLS.VOCAB, SKILLS.SPEAKING],
    thinking: THINKING.UNDERSTAND,
    grouping: 'whole-class',
    duration: { min: 5, typical: 8, max: 12 },

    description: {
      es: 'Una imagen anotada sirve como ancla visual mientras el docente explica o narra. Las etiquetas en la imagen refuerzan el vocabulario en contexto.',
      en: 'An annotated image serves as a visual anchor while the teacher explains or narrates. Labels on the image reinforce vocabulary in context.',
    },

    whyItWorks: {
      es: 'La memoria dual (imagen + texto) es más fuerte que cualquiera de las dos por separado. Las anotaciones dirigen la atención del estudiante exactamente al elemento correcto en el momento correcto.',
      en: 'Dual coding (image + text) creates stronger memory than either channel alone. Annotations direct student attention to exactly the right element at the right moment.',
    },

    inputs: {
      required: [
        {
          key:   'image',
          type:  INPUT_FIELD_TYPES.ANNOTATED_IMAGE,
          label: { es: 'Imagen con anotaciones', en: 'Image with annotations' },
          hint:  { es: 'Sube la imagen y agrega etiquetas, flechas o zonas resaltadas. Las anotaciones aparecerán en ClassroomOS.', en: 'Upload the image and add labels, arrows, or highlighted zones. Annotations will appear in ClassroomOS.' },
        },
      ],
      optional: [
        {
          key:   'script',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Guión del docente (no se proyecta)', en: 'Teacher script (not projected)' },
          hint:  { es: 'Lo que dirás mientras señalas la imagen. Visible solo en modo docente.', en: 'What you will say while pointing to the image. Visible only in teacher mode.' },
        },
        {
          key:   'questions',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Preguntas para hacer durante la narración', en: 'Questions to ask during narration' },
          max: 4,
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Carga la imagen y agrega anotaciones con etiquetas del vocabulario clave. No sobrecargues la imagen — 5-8 etiquetas máximo.',
        en: 'Upload the image and add annotations with key vocabulary labels. Do not overcrowd the image — 5-8 labels maximum.',
      },
      during: {
        es: 'Proyecta la imagen a pantalla completa. Narra señalando cada elemento anotado. Haz las preguntas de comprensión en los momentos clave.',
        en: 'Project the image full screen. Narrate while pointing to each annotated element. Ask comprehension questions at key moments.',
      },
      after: {
        es: 'Deja la imagen visible mientras los estudiantes hacen una tarea de producción oral o escrita relacionada.',
        en: 'Keep the image visible while students complete a related oral or written production task.',
      },
    },

    studentSteps: [
      { es: 'Mira la imagen en pantalla', en: 'Look at the image on screen' },
      { es: 'Escucha y sigue las etiquetas mientras el docente narra', en: 'Listen and follow the labels as the teacher narrates' },
      { es: 'Responde las preguntas que se hacen durante la narración', en: 'Answer the questions asked during the narration' },
    ],

    aiTriggers: ['image', 'diagram', 'picture', 'photo', 'illustration', 'label', 'annotate', 'vocab'],

    classroomDisplay: {
      layout:          'fullscreen-image',
      revealMode:      'on-tap',   // Teacher taps to reveal each annotation
      showAnnotations: true,
      showTimer:       false,
    },

    printLayout: {
      style:   'image-with-legend',
      caption: 'Imagen de referencia / Reference image',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY: PROCESSING (WE DO)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id:     'information-gap',
    family: PATTERN_FAMILIES.PROCESSING,
    name:   { es: 'Vacío de Información', en: 'Information Gap' },
    icon:   '🔄',
    skills: [SKILLS.SPEAKING, SKILLS.LISTENING, SKILLS.GRAMMAR],
    thinking: THINKING.APPLY,
    grouping: 'pairs',
    duration: { min: 8, typical: 15, max: 25 },

    description: {
      es: 'Estudiante A tiene información que Estudiante B necesita, y viceversa. Solo pueden completar la tarea comunicándose en el idioma objetivo.',
      en: 'Student A has information that Student B needs, and vice versa. They can only complete the task by communicating in the target language.',
    },

    whyItWorks: {
      es: 'Crea necesidad REAL de comunicación. El estudiante no habla porque se lo piden — habla porque genuinamente lo necesita para completar la tarea. Es la condición ideal para la adquisición de lenguaje.',
      en: 'Creates a REAL need to communicate. Students do not speak because they are told to — they speak because they genuinely need to complete the task. This is the ideal condition for language acquisition.',
    },

    inputs: {
      required: [
        {
          key:   'context',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Contexto de la actividad', en: 'Activity context' },
          hint:  { es: 'Ej: "Rutinas diarias — pasado simple" / "Daily routines — past tense"', en: 'E.g. "Daily routines — past tense" / "Describing people"' },
        },
        {
          key:   'studentA',
          type:  INPUT_FIELD_TYPES.RICH_LIST,
          label: { es: 'Información del Estudiante A', en: 'Student A information' },
          hint:  { es: 'Datos que A tiene y B necesita. Deja blancos donde B tiene la información.', en: 'Data that A has and B needs. Leave blanks where B has the information.' },
          min: 2, max: 10,
        },
        {
          key:   'studentB',
          type:  INPUT_FIELD_TYPES.RICH_LIST,
          label: { es: 'Información del Estudiante B', en: 'Student B information' },
          hint:  { es: 'Los blancos de A son los datos de B, y viceversa.', en: 'The blanks in A are B\'s data, and vice versa.' },
          min: 2, max: 10,
        },
      ],
      optional: [
        {
          key:   'usefulLanguage',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Lenguaje útil (visible en pantalla durante la actividad)', en: 'Useful language (shown on screen during the activity)' },
          hint:  { es: 'Frases clave para la interacción. Ej: "Did you...?", "What did you do at...?"', en: 'Key interaction phrases. E.g. "Did you...?", "What about...?"' },
          max: 6,
        },
        {
          key:   'image',
          type:  INPUT_FIELD_TYPES.ANNOTATED_IMAGE,
          label: { es: 'Imagen de referencia (opcional)', en: 'Reference image (optional)' },
        },
        {
          key:   'feedback',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Preguntas para el cierre de actividad', en: 'Post-activity feedback questions' },
          hint:  { es: 'Lo que preguntarás al grupo después. Ej: "¿Qué aprendiste sobre tu pareja?"', en: 'What you will ask the group after. E.g. "What did you find out about your partner?"' },
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Prepara dos sets de información que sean complementarios. Verifica que los blancos de A correspondan exactamente a los datos de B, y viceversa.',
        en: 'Prepare two sets of complementary information. Verify that A\'s blanks correspond exactly to B\'s data, and vice versa.',
      },
      during: {
        es: 'Divide la clase en parejas A/B. Dales tiempo para leer su información antes de empezar. Monitorea sin corregir — anota errores comunes para el feedback grupal. No permitas que muestren sus hojas.',
        en: 'Split the class into A/B pairs. Give them time to read their information before starting. Monitor without correcting — note common errors for group feedback. Do not allow them to show their sheets.',
      },
      after: {
        es: 'Haz un feedback grupal con los errores más comunes (sin señalar individuos). Pregunta por las respuestas correctas para verificar comprensión.',
        en: 'Do group feedback on the most common errors (without singling out individuals). Ask for the correct answers to verify comprehension.',
      },
    },

    studentSteps: [
      { es: 'Lee tu información (A o B) sin mostrársela a tu pareja', en: 'Read your information (A or B) without showing it to your partner' },
      { es: 'Haz preguntas en inglés para llenar tus espacios en blanco', en: 'Ask questions in English to fill in your blanks' },
      { es: 'Responde las preguntas de tu pareja usando solo el idioma objetivo', en: 'Answer your partner\'s questions using only the target language' },
      { es: 'Al terminar, compara tus hojas para verificar', en: 'When finished, compare sheets to verify' },
    ],

    aiTriggers: [
      'speaking', 'pair', 'communicate', 'exchange', 'interview',
      'conversation', 'past tense', 'present tense', 'descriptions', 'schedules',
    ],

    classroomDisplay: {
      layout:          'split-screen',     // Left: Student A role card | Right: Student B role card
      revealMode:      'all-at-once',
      showUsefulLanguage: true,
      showTimer:       true,
      timerSeconds:    null,               // Teacher sets dynamically
      phases:          ['setup', 'activity', 'feedback'],
    },

    printLayout: {
      style:   'two-column-table',
      caption: 'Information Gap — No muestres tu información / Don\'t show your information',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────

  {
    id:     'think-pair-share',
    family: PATTERN_FAMILIES.PROCESSING,
    name:   { es: 'Pienso · Comparto · Discutimos', en: 'Think · Pair · Share' },
    icon:   '💬',
    skills: [SKILLS.SPEAKING, SKILLS.CRITICAL, SKILLS.GRAMMAR],
    thinking: THINKING.ANALYZE,
    grouping: 'pairs',
    duration: { min: 5, typical: 10, max: 18 },

    description: {
      es: 'Reflexión individual → discusión en pareja → socialización con la clase. Tres fases con tiempo definido para cada una.',
      en: 'Individual reflection → pair discussion → class sharing. Three timed phases that progressively build confidence.',
    },

    whyItWorks: {
      es: 'El tiempo de reflexión individual antes de hablar reduce la ansiedad y da a todos los estudiantes (especialmente los introvertidos) la posibilidad de participar con confianza. La progresión 1→2→clase activa andamios sociales.',
      en: 'Individual think time before speaking reduces anxiety and gives all students (especially introverted ones) the chance to participate confidently. The 1→2→class progression activates social scaffolding.',
    },

    inputs: {
      required: [
        {
          key:   'question',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Pregunta o prompt', en: 'Question or prompt' },
          hint:  { es: 'Debe generar pensamiento genuino — no una respuesta de sí/no. Ej: "¿Cuál es la diferencia entre X e Y? ¿Cuándo usarías cada uno?"', en: 'Should generate genuine thinking — not a yes/no answer. E.g. "What is the difference between X and Y? When would you use each?"' },
        },
      ],
      optional: [
        {
          key:   'thinkTime',
          type:  INPUT_FIELD_TYPES.NUMBER,
          label: { es: 'Tiempo de reflexión individual (segundos)', en: 'Individual think time (seconds)' },
          default: 60,
          min: 20, max: 180,
        },
        {
          key:   'pairTime',
          type:  INPUT_FIELD_TYPES.NUMBER,
          label: { es: 'Tiempo en pareja (segundos)', en: 'Pair discussion time (seconds)' },
          default: 120,
          min: 60, max: 300,
        },
        {
          key:   'usefulLanguage',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Lenguaje útil para la discusión', en: 'Useful language for discussion' },
          hint:  { es: 'Ej: "I think...", "In my opinion...", "I agree/disagree because..."', en: 'E.g. "I think...", "In my opinion...", "I agree/disagree because..."' },
          max: 6,
        },
        {
          key:   'sentenceFrame',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Frame de oración para compartir con la clase', en: 'Sentence frame for class sharing' },
          hint:  { es: 'Ej: "My partner and I think that ___ because ___."', en: 'E.g. "My partner and I think that ___ because ___."' },
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Prepara una pregunta que requiera razonamiento real. Las mejores preguntas tienen múltiples respuestas válidas o requieren justificación.',
        en: 'Prepare a question that requires real reasoning. The best questions have multiple valid answers or require justification.',
      },
      during: {
        es: 'THINK: Proyecta la pregunta, activa el timer. Silencio absoluto. PAIR: Forma parejas, activa segundo timer. Circula y escucha sin intervenir. SHARE: Pide voluntarios o designa parejas. Anota respuestas en el tablero.',
        en: 'THINK: Project the question, start timer. Absolute silence. PAIR: Form pairs, start second timer. Circulate and listen without intervening. SHARE: Ask for volunteers or designate pairs. Note answers on the board.',
      },
      after: {
        es: 'Sintetiza las respuestas de la clase. Conecta con el tema del día y con el objetivo de la lección.',
        en: 'Synthesize the class responses. Connect to the day\'s topic and lesson objective.',
      },
    },

    studentSteps: [
      { es: 'PIENSA: Lee la pregunta. Escribe tu respuesta en tu cuaderno (en silencio).', en: 'THINK: Read the question. Write your answer in your notebook (silently).' },
      { es: 'COMPARTE: Discute tu respuesta con tu pareja. Escucha su perspectiva.', en: 'PAIR: Discuss your answer with your partner. Listen to their perspective.' },
      { es: 'DISCUTIMOS: Un representante de tu pareja comparte con la clase.', en: 'SHARE: One representative from your pair shares with the class.' },
    ],

    aiTriggers: [
      'discussion', 'opinion', 'critical thinking', 'compare', 'contrast',
      'reflection', 'debate', 'analyze', 'evaluate', 'speaking',
    ],

    classroomDisplay: {
      layout:     'three-phase-timer',   // Three sequential screens with countdown
      phases: [
        { key: 'think', label: { es: 'PIENSA', en: 'THINK' },   color: '#7c3aed', defaultSeconds: 60  },
        { key: 'pair',  label: { es: 'COMPARTE', en: 'PAIR' },  color: '#2563eb', defaultSeconds: 120 },
        { key: 'share', label: { es: 'DISCUTIMOS', en: 'SHARE' }, color: '#16a34a', defaultSeconds: null },
      ],
      showQuestion:       true,
      showUsefulLanguage: true,
      showSentenceFrame:  true,
    },

    printLayout: {
      style:   'three-column',
      caption: 'Think · Pair · Share',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────

  {
    id:     'dictogloss',
    family: PATTERN_FAMILIES.PROCESSING,
    name:   { es: 'Dictaglosa', en: 'Dictogloss' },
    icon:   '🎧',
    skills: [SKILLS.LISTENING, SKILLS.WRITING, SKILLS.GRAMMAR],
    thinking: THINKING.APPLY,
    grouping: 'pairs',
    duration: { min: 12, typical: 20, max: 30 },

    description: {
      es: 'El docente lee un texto corto dos veces. Los estudiantes toman notas → reconstruyen el texto → comparan con el original. La reconstrucción activa el uso del grammar objetivo.',
      en: 'The teacher reads a short text twice. Students take notes → reconstruct the text → compare with the original. Reconstruction activates target grammar use.',
    },

    whyItWorks: {
      es: 'Al reconstruir el texto, los estudiantes deben usar activamente la gramática objetivo — no pueden evitarla. La comparación con el original genera noticing natural de los propios errores.',
      en: 'When reconstructing the text, students must actively use the target grammar — they cannot avoid it. Comparison with the original generates natural noticing of their own errors.',
    },

    inputs: {
      required: [
        {
          key:   'text',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Texto para leer (60-100 palabras)', en: 'Text to read aloud (60-100 words)' },
          hint:  { es: 'Escribe un texto que use el grammar objetivo varias veces de forma natural. No más de 100 palabras. Léelo a velocidad normal — no lento.', en: 'Write a text that uses the target grammar several times naturally. No more than 100 words. Read at normal speed — not slowly.' },
        },
      ],
      optional: [
        {
          key:   'grammarTarget',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Estructura gramatical objetivo', en: 'Target grammar structure' },
          hint:  { es: 'Ej: "past simple irregular verbs". Se resalta en el original al comparar.', en: 'E.g. "past simple irregular verbs". Highlighted in the original when comparing.' },
        },
        {
          key:   'listeningTips',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Tips de escucha (visibles durante la actividad)', en: 'Listening tips (visible during activity)' },
          hint:  { es: 'Ej: "Escucha los verbos en pasado", "Focus on the main ideas"', en: 'E.g. "Listen for past tense verbs", "Focus on the main ideas"' },
          max: 3,
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Prepara el texto con antelación. Practica leerlo a velocidad natural. No lo hagas lento — los estudiantes deben escuchar lenguaje auténtico.',
        en: 'Prepare the text in advance. Practice reading it at natural speed. Do not go slowly — students should hear authentic language.',
      },
      during: {
        es: 'PRIMER ESCUCHA: Lee el texto a velocidad normal. Estudiantes solo escuchan (no escriben). SEGUNDO ESCUCHA: Lee el texto de nuevo. Estudiantes toman notas con palabras clave. RECONSTRUCCIÓN: En parejas, reconstruyen el texto con sus propias palabras usando las notas. COMPARACIÓN: Proyecta el texto original. Identifican diferencias.',
        en: 'FIRST LISTEN: Read at normal speed. Students only listen (no writing). SECOND LISTEN: Read again. Students take notes with key words. RECONSTRUCTION: In pairs, they reconstruct the text using their notes. COMPARISON: Project the original. They identify differences.',
      },
      after: {
        es: 'Discute los errores más comunes que encontraron. Enfoca en el grammar objetivo. ¿Por qué usaste esa forma? ¿Cuál es la diferencia?',
        en: 'Discuss the most common errors they found. Focus on the target grammar. Why did you use that form? What is the difference?',
      },
    },

    studentSteps: [
      { es: '1.ᵃ escucha: Solo escucha. No escribas nada.', en: '1st listen: Only listen. Do not write anything.' },
      { es: '2.ᵃ escucha: Escribe palabras clave (verbos, sustantivos, adjetivos).', en: '2nd listen: Write key words (verbs, nouns, adjectives).' },
      { es: 'Con tu pareja: reconstruye el texto usando tus notas. Escríbelo completo.', en: 'With your partner: reconstruct the text using your notes. Write it out completely.' },
      { es: 'Compara tu versión con el texto original. ¿Qué diferencias hay?', en: 'Compare your version with the original text. What differences are there?' },
    ],

    aiTriggers: [
      'listening', 'writing', 'grammar', 'reconstruct', 'notes',
      'past tense', 'present perfect', 'reported speech', 'audio',
    ],

    classroomDisplay: {
      layout: 'four-phase-sequential',
      phases: [
        { key: 'listen1',       label: { es: 'ESCUCHA 1',       en: '1ST LISTEN' },    color: '#2563eb', instruction: { es: 'Solo escucha. No escribas.', en: 'Just listen. Do not write.' } },
        { key: 'listen2',       label: { es: 'ESCUCHA 2',       en: '2ND LISTEN' },    color: '#7c3aed', instruction: { es: 'Toma notas de palabras clave.', en: 'Take notes of key words.' } },
        { key: 'reconstruct',   label: { es: 'RECONSTRUCCIÓN',  en: 'RECONSTRUCT' },   color: '#d97706', instruction: { es: 'En parejas: escribe el texto completo.', en: 'In pairs: write the full text.' } },
        { key: 'compare',       label: { es: 'COMPARACIÓN',     en: 'COMPARE' },       color: '#16a34a', showOriginalText: true },
      ],
      showTimer:       true,
      highlightTarget: true,   // Highlights grammarTarget in original text during compare phase
    },

    printLayout: {
      style:   'four-section',
      caption: 'Dictogloss — Reconstruct the text from memory',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY: OUTPUT (YOU DO)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id:     'guided-writing',
    family: PATTERN_FAMILIES.OUTPUT,
    name:   { es: 'Escritura Guiada', en: 'Guided Writing' },
    icon:   '✍️',
    skills: [SKILLS.WRITING, SKILLS.GRAMMAR, SKILLS.VOCAB],
    thinking: THINKING.CREATE,
    grouping: 'individual',
    duration: { min: 10, typical: 20, max: 35 },

    description: {
      es: 'El estudiante produce un texto siguiendo un scaffold estructurado: sentence starters, modelo visible, checklist de criterios. Produce solo pero con andamios.',
      en: 'The student produces a text following a structured scaffold: sentence starters, a visible model, criteria checklist. Produces independently but with scaffolding.',
    },

    whyItWorks: {
      es: 'Los sentence starters reducen la "página en blanco" que paraliza a los estudiantes, sin quitarles la responsabilidad de construir sus propias ideas. El checklist hace que la auto-corrección sea explícita.',
      en: 'Sentence starters eliminate the "blank page" paralysis without removing responsibility for students to build their own ideas. The checklist makes self-correction explicit.',
    },

    inputs: {
      required: [
        {
          key:   'prompt',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Tarea de escritura (¿qué debe escribir el estudiante?)', en: 'Writing task (what should the student write?)' },
          hint:  { es: 'Ej: "Write a paragraph about what you did last weekend. Use at least 5 past tense verbs."', en: 'E.g. "Write a paragraph about what you did last weekend. Use at least 5 past tense verbs."' },
        },
      ],
      optional: [
        {
          key:   'sentenceStarters',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Sentence starters / Inicio de oraciones', en: 'Sentence starters' },
          hint:  { es: 'Ej: "Last weekend I...", "First, I...", "After that, I...", "Finally, I..."', en: 'E.g. "Last weekend I...", "First, I...", "After that, I...", "Finally, I..."' },
          max: 8,
        },
        {
          key:   'checklist',
          type:  INPUT_FIELD_TYPES.TEXT_LIST,
          label: { es: 'Checklist de auto-corrección', en: 'Self-correction checklist' },
          hint:  { es: 'Ej: "Did I use past tense?", "Did I write at least 5 sentences?", "Did I check spelling?"', en: 'E.g. "Did I use past tense?", "Did I write at least 5 sentences?", "Did I check spelling?"' },
          max: 6,
        },
        {
          key:   'wordCount',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Extensión esperada', en: 'Expected length' },
          hint:  { es: 'Ej: "5-7 sentences", "80-100 words"', en: 'E.g. "5-7 sentences", "80-100 words"' },
        },
        {
          key:   'grammarTarget',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Estructura gramatical requerida', en: 'Required grammar structure' },
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Ten el texto modelo visible en pantalla antes de que los estudiantes empiecen a escribir. Es su referencia — no lo borres.',
        en: 'Have the model text visible on screen before students start writing. It is their reference — do not remove it.',
      },
      during: {
        es: 'Circula para monitorear. No corrijas en voz alta — haz preguntas: "¿Qué tiempo verbal debes usar aquí?", "¿Cómo podrías ampliar esta idea?". Identifica 2-3 ejemplos de buena escritura para compartir al final.',
        en: 'Circulate to monitor. Do not correct aloud — ask questions: "What tense should you use here?", "How could you expand this idea?". Identify 2-3 examples of good writing to share at the end.',
      },
      after: {
        es: 'Pide a 2-3 voluntarios que compartan. O proyecta fragmentos anónimos para el análisis grupal.',
        en: 'Ask 2-3 volunteers to share. Or project anonymous fragments for group analysis.',
      },
    },

    studentSteps: [
      { es: 'Lee el prompt y asegúrate de entender la tarea', en: 'Read the prompt and make sure you understand the task' },
      { es: 'Usa los sentence starters como punto de partida', en: 'Use the sentence starters as starting points' },
      { es: 'Escribe tu texto completo en tu cuaderno o hoja de trabajo', en: 'Write your complete text in your notebook or worksheet' },
      { es: 'Revisa tu texto con el checklist antes de entregarlo', en: 'Review your text with the checklist before submitting' },
    ],

    aiTriggers: [
      'writing', 'paragraph', 'essay', 'composition', 'produce',
      'create', 'write about', 'describe', 'narrate', 'argue',
    ],

    classroomDisplay: {
      layout:          'writing-scaffold',
      showPrompt:      true,
      showStarters:    true,
      showChecklist:   true,
      showTimer:       true,
      keepModelVisible: true,   // Model text from I DO remains visible
    },

    printLayout: {
      style:   'writing-worksheet',
      caption: 'Guided Writing Task',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY: ACTIVATION (Momento 3 / transitions)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id:     'hook',
    family: PATTERN_FAMILIES.ACTIVATION,
    name:   { es: 'Gancho de Atención', en: 'Engagement Hook' },
    icon:   '⚡',
    skills: [SKILLS.CRITICAL, SKILLS.SPEAKING],
    thinking: THINKING.EVALUATE,
    grouping: 'whole-class',
    duration: { min: 3, typical: 5, max: 8 },

    description: {
      es: 'Un recurso provocador (imagen sorprendente, dato estadístico, video corto, pregunta controversial) que capta la atención y conecta emocionalmente con el tema.',
      en: 'A provocative resource (surprising image, statistic, short video, controversial question) that captures attention and creates emotional connection with the topic.',
    },

    whyItWorks: {
      es: 'La atención precede al aprendizaje. El cerebro no aprende lo que no le interesa. Un hook eficaz activa la curiosidad y crea un estado mental receptivo antes de que empiece la instrucción formal.',
      en: 'Attention precedes learning. The brain does not learn what does not interest it. An effective hook activates curiosity and creates a receptive mindset before formal instruction begins.',
    },

    inputs: {
      required: [
        {
          key:   'hookType',
          type:  INPUT_FIELD_TYPES.SELECT,
          label: { es: 'Tipo de gancho', en: 'Hook type' },
          options: [
            { value: 'image',    label: { es: 'Imagen impactante',     en: 'Striking image'        } },
            { value: 'statistic',label: { es: 'Dato o estadística',    en: 'Fact or statistic'     } },
            { value: 'video',    label: { es: 'Video corto (< 2 min)', en: 'Short video (< 2 min)' } },
            { value: 'question', label: { es: 'Pregunta controversial', en: 'Controversial question' } },
            { value: 'scenario', label: { es: 'Escenario hipotético',  en: 'Hypothetical scenario' } },
          ],
        },
        {
          key:   'question',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Pregunta detonadora', en: 'Trigger question' },
          hint:  { es: 'La pregunta que lanzarás después de mostrar el gancho. Debe provocar opinión, no una respuesta de sí/no.', en: 'The question you will pose after showing the hook. Should provoke opinion, not a yes/no answer.' },
        },
      ],
      optional: [
        {
          key:   'resource',
          type:  INPUT_FIELD_TYPES.ANNOTATED_IMAGE,
          label: { es: 'Imagen del gancho', en: 'Hook image' },
          hint:  { es: 'Si elegiste "Imagen impactante"', en: 'If you chose "Striking image"' },
        },
        {
          key:   'mediaUrl',
          type:  INPUT_FIELD_TYPES.MEDIA_URL,
          label: { es: 'URL del video (YouTube/Vimeo)', en: 'Video URL (YouTube/Vimeo)' },
          hint:  { es: 'Si elegiste "Video corto". IMPORTANTE: verifica que el video existe antes de guardar.', en: 'If you chose "Short video". IMPORTANT: verify the video exists before saving.' },
        },
        {
          key:   'statText',
          type:  INPUT_FIELD_TYPES.TEXTAREA,
          label: { es: 'Texto del dato / estadística', en: 'Fact / statistic text' },
        },
        {
          key:   'connection',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: '¿Cómo conecta con el tema del día?', en: 'How does this connect to today\'s topic?' },
          hint:  { es: 'Una frase que expliques después: "Este dato se relaciona con lo que vamos a aprender hoy sobre..."', en: 'A phrase you will say after: "This connects to what we\'re learning today about..."' },
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Elige un gancho que sea genuinamente sorprendente o provocador para la edad del grupo. Verifica que el recurso funciona antes de clase.',
        en: 'Choose a hook that is genuinely surprising or provocative for the group\'s age. Verify that the resource works before class.',
      },
      during: {
        es: 'Muestra el gancho sin contexto primero — deja que reaccionen. Luego lanza la pregunta detonadora. Recoge 3-5 respuestas. No des la respuesta correcta aún.',
        en: 'Show the hook without context first — let them react. Then launch the trigger question. Collect 3-5 responses. Do not give the correct answer yet.',
      },
      after: {
        es: 'Conecta el gancho con el tema del día: "Lo que acaban de ver se relaciona con lo que vamos a aprender hoy sobre..."',
        en: 'Connect the hook to the day\'s topic: "What you just saw connects to what we\'re learning today about..."',
      },
    },

    studentSteps: [
      { es: 'Mira y reacciona al gancho', en: 'Look and react to the hook' },
      { es: 'Responde la pregunta detonadora con tu opinión', en: 'Answer the trigger question with your opinion' },
      { es: 'Escucha cómo se conecta con el tema del día', en: 'Listen to how it connects to today\'s topic' },
    ],

    aiTriggers: [
      'motivation', 'warm-up', 'engage', 'attention', 'start', 'hook',
      'curiosity', 'activate', 'pre-knowledge', 'opening', 'opening activity',
    ],

    classroomDisplay: {
      layout:       'hook-fullscreen',
      showQuestion: true,
      showTimer:    false,
    },

    printLayout: {
      style:   'callout-box',
      caption: 'Gancho de apertura / Opening hook',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY: ASSESSMENT (Momento 5)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id:     'three-two-one',
    family: PATTERN_FAMILIES.ASSESSMENT,
    name:   { es: '3 · 2 · 1 — Reflexión de Cierre', en: '3 · 2 · 1 — Closing Reflection' },
    icon:   '🚦',
    skills: [SKILLS.CRITICAL, SKILLS.WRITING],
    thinking: THINKING.EVALUATE,
    grouping: 'individual',
    duration: { min: 3, typical: 5, max: 8 },

    description: {
      es: 'Los estudiantes escriben 3 cosas que aprendieron, 2 que les resultaron interesantes, y 1 pregunta que les queda.',
      en: 'Students write 3 things they learned, 2 they found interesting, and 1 question they still have.',
    },

    whyItWorks: {
      es: 'La metacognición al final de clase consolida el aprendizaje. El "1 pregunta" revela misconceptions y orienta la siguiente clase. Es la herramienta de cierre más sencilla con mayor retorno pedagógico.',
      en: 'End-of-class metacognition consolidates learning. The "1 question" reveals misconceptions and informs the next class. It is the simplest closing tool with the highest pedagogical return.',
    },

    inputs: {
      optional: [
        {
          key:   'label3',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Personalizar el "3" (default: cosas que aprendí)', en: 'Customize the "3" (default: things I learned)' },
          hint:  { es: 'Ej: "3 palabras nuevas que aprendí hoy"', en: 'E.g. "3 new vocabulary words I learned"' },
        },
        {
          key:   'label2',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Personalizar el "2" (default: cosas que me interesaron)', en: 'Customize the "2" (default: things that interested me)' },
        },
        {
          key:   'label1',
          type:  INPUT_FIELD_TYPES.TEXT,
          label: { es: 'Personalizar el "1" (default: una pregunta que me queda)', en: 'Customize the "1" (default: one question I still have)' },
        },
      ],
    },

    teacherSteps: {
      before: {
        es: 'Ninguna preparación especial requerida. Ten el timer listo.',
        en: 'No special preparation required. Have the timer ready.',
      },
      during: {
        es: 'Proyecta el 3-2-1. Da 3-5 minutos para que escriban individualmente. Circula y lee algunas respuestas sin interrumpir.',
        en: 'Project the 3-2-1. Give 3-5 minutes for individual writing. Circulate and read some responses without interrupting.',
      },
      after: {
        es: 'Recoge las hojas o pide que compartan 2-3 "preguntas que me quedan" en voz alta. Son el punto de partida de la siguiente clase.',
        en: 'Collect the sheets or ask 2-3 students to share their "questions I still have" aloud. They are the starting point for the next class.',
      },
    },

    studentSteps: [
      { es: 'Escribe 3 cosas que aprendiste hoy', en: 'Write 3 things you learned today' },
      { es: 'Escribe 2 cosas que te resultaron interesantes', en: 'Write 2 things you found interesting' },
      { es: 'Escribe 1 pregunta que aún tienes', en: 'Write 1 question you still have' },
    ],

    aiTriggers: [
      'closing', 'cierre', 'reflection', 'assessment', 'exit', 'metacognition',
      'review', 'consolidate', 'summarize', 'end of class',
    ],

    classroomDisplay: {
      layout:    'three-step-reflection',
      showTimer: true,
      steps: [
        { number: 3, color: '#2563eb' },
        { number: 2, color: '#7c3aed' },
        { number: 1, color: '#16a34a' },
      ],
    },

    printLayout: {
      style:   'three-box',
      caption: '3 · 2 · 1 Reflection',
    },
  },

]

// ── Pattern lookup utilities ──────────────────────────────────────────────────

/**
 * Get a pattern by its id. Returns undefined if not found.
 * @param {string} id
 */
export function getPattern(id) {
  return ACTIVITY_PATTERNS.find(p => p.id === id)
}

/**
 * Get all patterns belonging to a family.
 * @param {string} family - One of PATTERN_FAMILIES values
 */
export function getPatternsByFamily(family) {
  return ACTIVITY_PATTERNS.filter(p => p.family === family)
}

/**
 * AI matching engine: suggest patterns for a given context.
 * Returns patterns ranked by relevance — most relevant first.
 *
 * @param {{ skills?: string[], keywords?: string[], family?: string, excludeIds?: string[] }} context
 * @returns {Array} Ranked pattern suggestions with a `score` field
 */
export function suggestPatterns({ skills = [], keywords = [], family = null, excludeIds = [] } = {}) {
  const kw = keywords.map(k => k.toLowerCase())

  return ACTIVITY_PATTERNS
    .filter(p => !excludeIds.includes(p.id))
    .filter(p => !family || p.family === family)
    .map(p => {
      let score = 0

      // Skill match
      const skillMatches = (p.skills || []).filter(s => skills.includes(s)).length
      score += skillMatches * 3

      // Keyword match against aiTriggers
      const triggerMatches = (p.aiTriggers || []).filter(t =>
        kw.some(k => t.toLowerCase().includes(k) || k.includes(t.toLowerCase()))
      ).length
      score += triggerMatches * 2

      return { ...p, score }
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
}

/**
 * Returns patterns suitable for a given scaffold phase.
 * @param {'i-do'|'we-do'|'you-do'} phase
 */
export function getPatternsForPhase(phase) {
  const family = Object.entries(FAMILY_PHASE).find(([, v]) => v === phase)?.[0]
  if (!family) return []
  return getPatternsByFamily(family)
}
