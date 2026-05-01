import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak,
} from 'docx'
import { saveAs } from 'file-saver'

// ── Constants ────────────────────────────────────────────────────────────────
const PW    = 10800  // content width in DXA (Letter - margins)
const BS    = BorderStyle.SINGLE
const BN    = BorderStyle.NONE

const mkB   = (color, sz = 4) => ({ style: BS, size: sz, color })
const noB   = { style: BN, size: 0, color: 'FFFFFF' }
const bBlue = mkB('2E5598')
const bGray = mkB('CCCCCC')
const allB  = b => ({ top: b, bottom: b, left: b, right: b })

const SECTIONS = [
  { key: 'subject',    label: 'ENCUENTRO · VOCABULARY LIST', hex: 'C0504D', time: '~8 min'  },
  { key: 'motivation', label: 'TEMA DEL DÍA',                hex: '4F81BD', time: '~7 min'  },
  { key: 'activity',   label: 'MOTIVACIÓN',                  hex: 'F79646', time: '~10 min' },
  { key: 'skill',      label: 'DESARROLLO DE HABILIDADES',   hex: '8064A2', time: '~25 min' },
  { key: 'closing',    label: 'CIERRE Y REFLEXIÓN',          hex: '9BBB59', time: '~5 min'  },
  { key: 'assignment', label: 'TAREA / ASSIGNMENT',          hex: '4BACC6', time: '~3 min'  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkCell(children, width, { fill, borders, va, margins, span } = {}) {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    shading:       fill ? { fill, type: ShadingType.CLEAR, color: fill } : undefined,
    borders:       borders || allB(bGray),
    verticalAlign: va || VerticalAlign.CENTER,
    margins:       margins || { top: 80, bottom: 80, left: 120, right: 120 },
    columnSpan:    span,
    children:      Array.isArray(children) ? children : [children],
  })
}

function mkP(runs, align) {
  return new Paragraph({
    alignment: align || AlignmentType.LEFT,
    spacing:   { before: 0, after: 0 },
    children:  Array.isArray(runs) ? runs : [runs],
  })
}

function mkR(text, { bold, italic, size, color, font } = {}) {
  return new TextRun({
    text:    text || '',
    bold:    bold    || false,
    italics: italic  || false,
    size:    size    || 20,
    color:   color   || '222222',
    font:    font    || 'Arial',
  })
}

function emptyPara() {
  return new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun('')] })
}

// ── HTML → DOCX text parser ───────────────────────────────────────────────────
// Converts Tiptap HTML (bold, italic, underline, lists, paragraphs) to
// an array of Paragraph objects safe for DOCX.

function htmlToParas(html, baseSize = 20) {
  if (!html || !html.trim()) return [mkP(mkR('', { size: baseSize }))]

  // Use DOMParser when available (browser); fallback to regex for SSR
  let paragraphs = []

  try {
    const parser = new DOMParser()
    const doc    = parser.parseFromString(`<div>${html}</div>`, 'text/html')
    const root   = doc.querySelector('div')

    function nodeToRuns(node, state = {}) {
      const runs = []
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent
          if (text) {
            runs.push(mkR(text, {
              bold:   state.bold,
              italic: state.italic,
              size:   baseSize,
              color:  state.color || '222222',
            }))
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase()
          const newState = { ...state }
          if (tag === 'strong' || tag === 'b') newState.bold   = true
          if (tag === 'em'     || tag === 'i') newState.italic = true
          if (tag === 's')                     newState.strike = true
          const style = child.getAttribute('style') || ''
          const colorMatch = style.match(/color:\s*([#\w]+)/)
          if (colorMatch) newState.color = colorMatch[1].replace('#', '')
          runs.push(...nodeToRuns(child, newState))
        }
      })
      return runs
    }

    function walkBlock(node) {
      const tag = node.tagName?.toLowerCase()
      if (!tag) return

      if (tag === 'p' || tag === 'div') {
        const runs = nodeToRuns(node)
        paragraphs.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 60 },
          children: runs.length ? runs : [mkR('', { size: baseSize })],
        }))
      } else if (tag === 'ul' || tag === 'ol') {
        node.querySelectorAll('li').forEach(li => {
          const runs = nodeToRuns(li)
          paragraphs.push(new Paragraph({
            bullet: tag === 'ul' ? { level: 0 } : undefined,
            numbering: tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
            spacing: { before: 0, after: 40 },
            children: runs.length ? runs : [mkR('', { size: baseSize })],
          }))
        })
      } else if (tag === 'br') {
        paragraphs.push(emptyPara())
      } else {
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) walkBlock(child)
        })
      }
    }

    root.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) walkBlock(child)
      else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
        paragraphs.push(mkP(mkR(child.textContent, { size: baseSize })))
      }
    })
  } catch (e) {
    // Fallback: strip tags
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
    paragraphs = [mkP(mkR(plain, { size: baseSize }))]
  }

  return paragraphs.length ? paragraphs : [mkP(mkR('', { size: baseSize }))]
}

// ── SmartBlock → DOCX elements ────────────────────────────────────────────────

function mkNestedCell(children, opts = {}) {
  return new TableCell({
    width:         opts.pct ? { size: opts.pct, type: WidthType.PERCENTAGE } : undefined,
    shading:       opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: opts.fill } : undefined,
    borders:       opts.borders || allB(bGray),
    verticalAlign: VerticalAlign.TOP,
    margins:       { top: 40, bottom: 40, left: 80, right: 80 },
    columnSpan:    opts.span,
    children:      Array.isArray(children) ? children : [children],
  })
}

function mkNested(rows, pct = 100) {
  return new Table({
    width: { size: pct, type: WidthType.PERCENTAGE },
    rows,
  })
}

function buildSmartBlockDocx(block) {
  const { type, model, data } = block
  if (!data) return []

  const COLORS = {
    DICTATION:            '4BACC6', QUIZ:                 'C0504D',
    VOCAB:                '9BBB59', WORKSHOP:             'F79646',
    SPEAKING:             '8064A2', NOTICE:               '1F3864',
    READING:              '17375E', GRAMMAR:              '375623',
    EXIT_TICKET:          'C55A11', WRITING:              '70AD47',
    SELF_ASSESSMENT:      'E1A24A', PEER_REVIEW:          'C3785B',
    DIGITAL_RESOURCE:     '4BACC6', COLLABORATIVE_TASK:   '4F81BD',
    REAL_LIFE_CONNECTION: '70AD47', TEACHER_NOTE:         '767171',
  }
  const LABELS = {
    DICTATION:            'Dictation / Listening',    QUIZ:                 'Quiz / Evaluación',
    VOCAB:                'Vocabulary List',           WORKSHOP:             'Workshop / Stations',
    SPEAKING:             'Speaking Project',          NOTICE:               'Announcement / Notice',
    READING:              'Reading Comprehension',     GRAMMAR:              'Grammar Practice',
    EXIT_TICKET:          'Exit Ticket',               WRITING:              'Writing Task',
    SELF_ASSESSMENT:      'Self-Assessment',           PEER_REVIEW:          'Peer Review',
    DIGITAL_RESOURCE:     'Digital Resource',          COLLABORATIVE_TASK:   'Collaborative Task',
    REAL_LIFE_CONNECTION: 'Real-Life Connection',      TEACHER_NOTE:         'Teacher Note',
  }
  const color = COLORS[type] || '333333'
  const label = LABELS[type] || type

  const elements = [emptyPara()]

  // Colored block header strip
  elements.push(mkNested([new TableRow({ children: [
    mkNestedCell([mkP(mkR(label, { bold: true, size: 17, color: 'FFFFFF' }))], { fill: color, borders: allB(mkB(color)) }),
  ]})]))

  if (type === 'NOTICE') {
    if (model === 'banner') {
      elements.push(mkNested([new TableRow({ children: [
        mkNestedCell([
          mkP(mkR(`${data.title || ''}`, { bold: true, size: 20, color: 'FFFFFF' }), AlignmentType.CENTER),
          ...(data.message ? [mkP(mkR(data.message, { size: 16, color: 'BBCCEE' }), AlignmentType.CENTER)] : []),
        ], { fill: '1F3864', borders: allB(mkB('1F3864')) }),
      ]})]))
    } else {
      const priority = data.priority || 'warning'
      const fill = priority === 'danger' ? 'FFECEC' : priority === 'info' ? 'E8F4FF' : 'FFF3CD'
      const brd  = priority === 'danger' ? 'CC3333' : priority === 'info' ? '4BACC6' : 'C9A84C'
      elements.push(mkNested([new TableRow({ children: [
        mkNestedCell([
          mkP(mkR(`${data.icon||'⚠️'} ${data.title||''}`, { bold: true, size: 17, color: '333333' })),
          ...(data.message ? [mkP(mkR(data.message, { size: 16, color: '444444' }))] : []),
        ], { fill, borders: { left: mkB(brd, 10), top: { style: BN, size: 0, color: fill }, bottom: { style: BN, size: 0, color: fill }, right: { style: BN, size: 0, color: fill } } }),
      ]})]))
    }
  }

  else if (type === 'QUIZ') {
    const topics = Array.isArray(data.topics) ? data.topics.filter(Boolean) : (data.topics||'').split('\n').filter(Boolean)
    const rows = [
      mkP(mkR(`📝 QUIZ — ${data.unit||''}${data.date ? ' · ' + data.date : ''}`, { bold: true, size: 18, color: 'C0504D' })),
      ...topics.map(t => mkP([mkR('▪ ', { bold: true, size: 16, color: 'F79646' }), mkR(t, { size: 16 })])),
    ]
    if (model === 'format-box' && data.format) {
      rows.push(emptyPara())
      data.format.split('\n').filter(Boolean).forEach(f => rows.push(mkP(mkR(f, { size: 16, color: '555555' }))))
    }
    if (data.note) rows.push(mkP(mkR(`ℹ️ ${data.note}`, { size: 14, italic: true, color: '888888' })))
    elements.push(mkNested([new TableRow({ children: [
      mkNestedCell(rows, { fill: 'FFF0F0', borders: { left: mkB('C0504D', 10), top: { style: BN, size: 0, color: 'FFF0F0' }, bottom: { style: BN, size: 0, color: 'FFF0F0' }, right: { style: BN, size: 0, color: 'FFF0F0' } } }),
    ]})]))
  }

  else if (type === 'VOCAB') {
    const words = data.words || []
    if (model === 'cards') {
      const hdFill = '9BBB59'
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('WORD',       { bold: true, size: 16, color: 'FFFFFF' }))], { fill: hdFill, borders: allB(mkB(hdFill)), pct: 25 }),
          mkNestedCell([mkP(mkR('DEFINITION', { bold: true, size: 16, color: 'FFFFFF' }))], { fill: hdFill, borders: allB(mkB(hdFill)), pct: 40 }),
          mkNestedCell([mkP(mkR('EXAMPLE',    { bold: true, size: 16, color: 'FFFFFF' }))], { fill: hdFill, borders: allB(mkB(hdFill)), pct: 35 }),
        ]}),
        ...words.map((wd, i) => {
          const fill = i % 2 ? 'F9FFF4' : 'FFFFFF'
          return new TableRow({ children: [
            mkNestedCell([mkP(mkR(wd.w||'', { bold: true, size: 16 }))], { fill, pct: 25 }),
            mkNestedCell([mkP(mkR(wd.d||'', { size: 16 }))],             { fill, pct: 40 }),
            mkNestedCell([mkP(mkR(wd.e||'', { size: 16, color: '555555' }))], { fill, pct: 35 }),
          ]})
        }),
      ]))
    } else {
      const hdFill = '9BBB59'
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('TERMS',      { bold: true, size: 16, color: 'FFFFFF' }))], { fill: hdFill, borders: allB(mkB(hdFill)), pct: 18 }),
          mkNestedCell([mkP(mkR('MEANINGS',   { bold: true, size: 16, color: 'FFFFFF' }))], { fill: hdFill, borders: allB(mkB(hdFill)), pct: 42 }),
          mkNestedCell([mkP(mkR('IN CONTEXT', { bold: true, size: 16, color: 'FFFFFF' }))], { fill: hdFill, borders: allB(mkB(hdFill)), pct: 40 }),
        ]}),
        ...words.map((wd, i) => {
          const fill = i % 2 ? 'F9FFF4' : 'FFFFFF'
          return new TableRow({ children: [
            mkNestedCell([mkP(mkR(`${i+1}. ${wd.w}`, { bold: true, size: 16 }))],              { fill, pct: 18 }),
            mkNestedCell([mkP(mkR(wd.d||'',           { size: 16 }))],                          { fill, pct: 42 }),
            mkNestedCell([mkP(mkR(wd.e||'',           { size: 16, italic: true, color: '555555' }))], { fill, pct: 40 }),
          ]})
        }),
      ]))
    }
  }

  else if (type === 'DICTATION') {
    if (data.instructions) elements.push(mkP(mkR(data.instructions, { size: 16, italic: true, color: '555555' })))
    const words = data.words || []
    if (model === 'word-grid') {
      const pairs = []
      for (let i = 0; i < words.length; i += 2) pairs.push([words[i], words[i+1]])
      elements.push(mkNested(pairs.map((pair, ri) =>
        new TableRow({ children: pair.map((w, ci) => {
          const num = ri * 2 + ci + 1
          return mkNestedCell([mkP([
            mkR(`${num}. `, { bold: true, size: 16, color: '4BACC6' }),
            mkR(w || '',    { bold: true, size: 16 }),
          ])], { pct: 50 })
        })})
      )))
    } else {
      words.forEach((s, i) => elements.push(mkP([
        mkR(`${i+1}. `, { bold: true, size: 16, color: '4BACC6' }),
        mkR(s, { size: 16 }),
      ])))
    }
    if (data.time) elements.push(mkP(mkR(`⏱ ${data.time}`, { size: 14, color: '888888', italic: true })))
  }

  else if (type === 'WORKSHOP') {
    const stColors = ['4F81BD', 'F79646', '9BBB59', '8064A2', '4BACC6']
    if (model === 'stations') {
      const stations = data.stations || [];
      elements.push(mkNested(stations.map((st, i) => {
        const c = stColors[i % stColors.length]
        return new TableRow({ children: [
          mkNestedCell([
            mkP(mkR(st.name, { bold: true, size: 18, color: 'FFFFFF' })),
            mkP(mkR(`⏱ ${st.time}`, { size: 14, color: 'FFFFFF' })),
            mkP(mkR(st.desc, { size: 16, color: 'FFFFFF' })),
          ], { fill: c, borders: allB(mkB(c)) }),
        ]})
      })))
    } else {
      const icons = ['👑','✍️','🗣️','🔍','🎨','🧪']
      const roles = data.roles || []
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('ROLE',           { bold: true, size: 16, color: 'FFFFFF' }))], { fill: 'F79646', borders: allB(mkB('F79646')), pct: 35 }),
          mkNestedCell([mkP(mkR('RESPONSIBILITY', { bold: true, size: 16, color: 'FFFFFF' }))], { fill: 'F79646', borders: allB(mkB('F79646')), pct: 65 }),
        ]}),
        ...roles.map((r, i) => new TableRow({ children: [
          mkNestedCell([mkP([mkR(`${icons[i%icons.length]} `, { size: 16 }), mkR(r.role, { bold: true, size: 16 })])], { pct: 35 }),
          mkNestedCell([mkP(mkR(r.task, { size: 16 }))],                                                                { pct: 65 }),
        ]})),
      ]))
    }
  }

  else if (type === 'READING') {
    const passageParas = data.passage
      ? [mkP(mkR(data.passage, { size: 17 }))]
      : [mkP(mkR('', { size: 17 }))]
    elements.push(mkNested([new TableRow({ children: [
      mkNestedCell(passageParas, { fill: 'EEF3FF', borders: { left: mkB('17375E', 10), top: { style: BN, size: 0, color: 'EEF3FF' }, bottom: { style: BN, size: 0, color: 'EEF3FF' }, right: { style: BN, size: 0, color: 'EEF3FF' } } }),
    ]})]))
    if (model === 'comprehension') {
      ;(data.questions || []).forEach((q, i) => {
        elements.push(mkP([mkR(`${i+1}. `, { bold: true, size: 16, color: '17375E' }), mkR(q.q || '', { size: 16 })]))
        for (let l = 0; l < (q.lines || 2); l++) {
          elements.push(new Paragraph({ spacing: { before: 0, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } }, children: [mkR('', { size: 16 })] }))
        }
      })
    } else {
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('#',         { bold: true, size: 16, color: 'FFFFFF' }))], { fill: '17375E', borders: allB(mkB('17375E')), pct: 8 }),
          mkNestedCell([mkP(mkR('Statement', { bold: true, size: 16, color: 'FFFFFF' }))], { fill: '17375E', borders: allB(mkB('17375E')), pct: 76 }),
          mkNestedCell([mkP(mkR('T',         { bold: true, size: 16, color: 'FFFFFF' }), AlignmentType.CENTER)], { fill: '17375E', borders: allB(mkB('17375E')), pct: 8 }),
          mkNestedCell([mkP(mkR('F',         { bold: true, size: 16, color: 'FFFFFF' }), AlignmentType.CENTER)], { fill: '17375E', borders: allB(mkB('17375E')), pct: 8 }),
        ]}),
        ...(data.statements || []).map((s, i) => new TableRow({ children: [
          mkNestedCell([mkP(mkR(String(i+1), { size: 16, color: '888888' }))],     { pct: 8 }),
          mkNestedCell([mkP(mkR(s.s || '',   { size: 16 }))],                       { pct: 76 }),
          mkNestedCell([mkP(mkR('⬜', { size: 16 }), AlignmentType.CENTER)],        { pct: 8 }),
          mkNestedCell([mkP(mkR('⬜', { size: 16 }), AlignmentType.CENTER)],        { pct: 8 }),
        ]})),
      ]))
    }
  }

  else if (type === 'GRAMMAR') {
    if (data.grammar_point) elements.push(mkP(mkR(data.grammar_point, { bold: true, size: 16, color: '375623' })))
    if (data.instructions)  elements.push(mkP(mkR(data.instructions,  { size: 16, italic: true, color: '666666' })))
    if (model === 'fill-blank') {
      ;(data.sentences || []).forEach((s, i) => {
        const parts = (s.sent || '').split('___')
        const runs = []
        parts.forEach((part, pi) => {
          if (part) runs.push(mkR(part, { size: 16 }))
          if (pi < parts.length - 1) {
            runs.push(mkR(`${i+1}. `, { bold: true, size: 16, color: '375623' }))
            runs.push(new TextRun({ text: '          ', size: 16, underline: { type: 'single' } }))
          }
        })
        if (runs.length) {
          elements.push(new Paragraph({
            spacing: { before: 40, after: 40 },
            border:  { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' } },
            children: [mkR(`${i+1}. `, { bold: true, size: 16, color: '375623' }), ...runs],
          }))
        }
      })
    } else {
      ;(data.items || []).forEach((item, i) => {
        elements.push(mkP([mkR(`${i+1}. `, { bold: true, size: 16, color: '375623' }), mkR(item.sentence || '', { size: 16 })]))
        elements.push(mkP(mkR((item.options || []).map((o, oi) => `  ${String.fromCharCode(65+oi)}) ${o}`).join('   '), { size: 15, color: '555555' })))
      })
    }
  }

  else if (type === 'EXIT_TICKET') {
    if (model === 'can-do') {
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR(`🚪 EXIT TICKET${data.date ? ' · ' + data.date : ''}`, { bold: true, size: 17, color: 'FFFFFF' }))], { fill: 'C55A11', borders: allB(mkB('C55A11')) }),
        ]}),
        ...(data.skills || []).map(s => new TableRow({ children: [
          mkNestedCell([mkP([mkR('I can ', { size: 16 }), mkR(s, { bold: true, size: 16 })])], { fill: 'FFF8E6', pct: 70 }),
          mkNestedCell([mkP(mkR('😊   😐   😕', { size: 18 }), AlignmentType.CENTER)], { fill: 'FFF8E6', pct: 30 }),
        ]})),
      ]))
    } else {
      const rows = [
        new TableRow({ children: [
          mkNestedCell([mkP(mkR(`🚪 SELF-RATING${data.date ? ' · ' + data.date : ''}`, { bold: true, size: 17, color: 'FFFFFF' }))], { fill: 'C55A11', borders: allB(mkB('C55A11')), span: 2 }),
        ]}),
        ...(data.statements || []).map((s, i) => new TableRow({ children: [
          mkNestedCell([mkP(mkR(`${i+1}. ${s}`, { size: 16 }))], { fill: 'FFF8E6', pct: 70 }),
          mkNestedCell([mkP(mkR('1   2   3   4   5', { size: 16, color: 'C55A11', bold: true }), AlignmentType.CENTER)], { fill: 'FFF8E6', pct: 30 }),
        ]})),
      ]
      elements.push(mkNested(rows))
    }
  }

  else if (type === 'SPEAKING') {
    if (model === 'rubric') {
      const criteria = data.criteria || []
      const total = criteria.reduce((s, c) => s + (parseInt(c.pts) || 0), 0)
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('CRITERION', { bold: true, size: 16, color: 'FFFFFF' }))],                   { fill: '8064A2', borders: allB(mkB('8064A2')), pct: 80 }),
          mkNestedCell([mkP(mkR('PTS',       { bold: true, size: 16, color: 'FFFFFF' }), AlignmentType.RIGHT)], { fill: '8064A2', borders: allB(mkB('8064A2')), pct: 20 }),
        ]}),
        ...criteria.map(c => new TableRow({ children: [
          mkNestedCell([mkP(mkR(c.name, { size: 16 }))],                                                      { pct: 80 }),
          mkNestedCell([mkP(mkR(c.pts,  { bold: true, size: 16 }), AlignmentType.RIGHT)],                     { pct: 20 }),
        ]})),
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('TOTAL', { bold: true, size: 16 }))],                                          { fill: 'F0EAFF', pct: 80 }),
          mkNestedCell([mkP(mkR(String(total), { bold: true, size: 16 }), AlignmentType.RIGHT)],               { fill: 'F0EAFF', pct: 20 }),
        ]}),
      ]))
      if (data.date) elements.push(mkP(mkR(`📅 ${data.date}`, { size: 14, color: '888888', italic: true })))
    } else {
      const steps = data.steps || []
      steps.forEach((s, i) => elements.push(mkP([
        mkR(`${i+1}. `, { bold: true, size: 16, color: '8064A2' }),
        mkR(s, { size: 16 }),
      ])))
      if (data.date) elements.push(mkP(mkR(`📅 ${data.date}`, { size: 14, color: '888888', italic: true })))
    }
  }

  // ── New block types (Sesión D) ────────────────────────────────────────────
  else if (type === 'WRITING') {
    if (model === 'guided') {
      if (data.prompt) elements.push(mkP(mkR(data.prompt, { size: 17, italic: true })))
      if (data.sentence_starters?.length) {
        elements.push(mkP(mkR('SENTENCE STARTERS', { bold: true, size: 15, color: '3d7a20' })))
        data.sentence_starters.forEach(s => elements.push(mkP([mkR('→ ', { bold: true, size: 15, color: '70AD47' }), mkR(s, { size: 15 })])))
      }
      if (data.checklist?.length) {
        elements.push(emptyPara())
        elements.push(mkP(mkR('SUCCESS CHECKLIST', { bold: true, size: 15, color: '3d7a20' })))
        data.checklist.forEach(c => elements.push(mkP([mkR('☐ ', { size: 15, color: '70AD47' }), mkR(c, { size: 15 })])))
      }
    } else {
      if (data.topic) elements.push(mkP(mkR(data.topic, { size: 17, italic: true })))
      if (data.word_count) elements.push(mkP(mkR(`Word count: ${data.word_count}`, { size: 15, color: '666666' })))
      if (data.instructions) elements.push(mkP(mkR(data.instructions, { size: 15, color: '555555' })))
    }
  }

  else if (type === 'SELF_ASSESSMENT') {
    if (model === 'checklist') {
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('I can…', { bold: true, size: 16, color: 'FFFFFF' }))],  { fill: 'E1A24A', borders: allB(mkB('E1A24A')), pct: 60 }),
          mkNestedCell([mkP(mkR('Yes',    { bold: true, size: 15, color: 'FFFFFF' }), AlignmentType.CENTER)], { fill: 'E1A24A', borders: allB(mkB('E1A24A')), pct: 13 }),
          mkNestedCell([mkP(mkR('Partly', { bold: true, size: 15, color: 'FFFFFF' }), AlignmentType.CENTER)], { fill: 'E1A24A', borders: allB(mkB('E1A24A')), pct: 14 }),
          mkNestedCell([mkP(mkR('Not yet',{ bold: true, size: 15, color: 'FFFFFF' }), AlignmentType.CENTER)], { fill: 'E1A24A', borders: allB(mkB('E1A24A')), pct: 13 }),
        ]}),
        ...(data.skills || []).map(s => new TableRow({ children: [
          mkNestedCell([mkP(mkR(s, { size: 16 }))], { fill: 'FFF9EE', pct: 60 }),
          mkNestedCell([mkP(mkR('⬜', { size: 16 }), AlignmentType.CENTER)], { fill: 'FFF9EE', pct: 13 }),
          mkNestedCell([mkP(mkR('⬜', { size: 16 }), AlignmentType.CENTER)], { fill: 'FFF9EE', pct: 14 }),
          mkNestedCell([mkP(mkR('⬜', { size: 16 }), AlignmentType.CENTER)], { fill: 'FFF9EE', pct: 13 }),
        ]})),
      ]))
    } else {
      ;(data.questions || []).forEach((q, i) => {
        elements.push(mkP([mkR(`${i+1}. `, { bold: true, size: 16, color: 'E1A24A' }), mkR(q, { size: 16 })]))
        for (let l = 0; l < 2; l++) {
          elements.push(new Paragraph({ spacing: { before: 0, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } }, children: [mkR('', { size: 16 })] }))
        }
      })
    }
  }

  else if (type === 'PEER_REVIEW') {
    if (model === 'rubric') {
      const criteria = data.criteria || []
      const total = criteria.reduce((s, c) => s + (parseInt(c.pts) || 0), 0)
      elements.push(mkNested([
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('CRITERION', { bold: true, size: 16, color: 'FFFFFF' }))], { fill: 'C3785B', borders: allB(mkB('C3785B')), pct: 80 }),
          mkNestedCell([mkP(mkR('PTS', { bold: true, size: 16, color: 'FFFFFF' }), AlignmentType.RIGHT)], { fill: 'C3785B', borders: allB(mkB('C3785B')), pct: 20 }),
        ]}),
        ...criteria.map(c => new TableRow({ children: [
          mkNestedCell([mkP(mkR(c.name, { size: 16 }))], { pct: 80 }),
          mkNestedCell([mkP(mkR(c.pts || '', { bold: true, size: 16 }), AlignmentType.RIGHT)], { pct: 20 }),
        ]})),
        new TableRow({ children: [
          mkNestedCell([mkP(mkR('TOTAL', { bold: true, size: 16 }))], { fill: 'F9EDE8', pct: 80 }),
          mkNestedCell([mkP(mkR(String(total), { bold: true, size: 16 }), AlignmentType.RIGHT)], { fill: 'F9EDE8', pct: 20 }),
        ]}),
      ]))
    } else {
      elements.push(mkP(mkR(`⭐ Stars: ${data.stars_prompt || 'What did your peer do well?'}`, { size: 16, bold: true, color: 'C3785B' })))
      elements.push(new Paragraph({ spacing: { before: 0, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } }, children: [mkR('', { size: 16 })] }))
      elements.push(mkP(mkR(`🌟 Wishes: ${data.wishes_prompt || 'What could your peer improve?'}`, { size: 16, bold: true, color: 'C3785B' })))
      elements.push(new Paragraph({ spacing: { before: 0, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } }, children: [mkR('', { size: 16 })] }))
    }
  }

  else if (type === 'DIGITAL_RESOURCE') {
    if (data.title) elements.push(mkP(mkR(data.title, { bold: true, size: 17 })))
    if (data.url) elements.push(mkP(mkR(`🔗 ${data.url}`, { size: 15, color: '4BACC6' })))
    if (data.platform_name) elements.push(mkP(mkR(`Platform: ${data.platform_name}`, { bold: true, size: 16 })))
    if (data.activity) elements.push(mkP(mkR(data.activity, { size: 16 })))
    if (data.instructions) elements.push(mkP(mkR(data.instructions, { size: 15, color: '555555', italic: true })))
  }

  else if (type === 'COLLABORATIVE_TASK') {
    if (model === 'jigsaw') {
      const stColors = ['4F81BD','F79646','9BBB59','8064A2','C0504D']
      elements.push(mkNested((data.groups || []).map((g, i) => {
        const c = stColors[i % stColors.length]
        return new TableRow({ children: [
          mkNestedCell([
            mkP(mkR(g.name || `Group ${i+1}`, { bold: true, size: 16, color: 'FFFFFF' })),
            mkP(mkR(g.topic || '',              { size: 15, color: 'FFFFFF' })),
          ], { fill: c, borders: allB(mkB(c)) }),
        ]})
      })))
    } else {
      if (data.prompt) elements.push(mkP(mkR(data.prompt, { size: 16, italic: true })))
      if (data.pair_time || data.share_time) {
        elements.push(mkP([
          mkR('Pair: ', { bold: true, size: 15, color: '4F81BD' }),
          mkR(data.pair_time || '3 min', { size: 15 }),
          mkR('   Share: ', { bold: true, size: 15, color: '4F81BD' }),
          mkR(data.share_time || '5 min', { size: 15 }),
        ]))
      }
    }
  }

  else if (type === 'REAL_LIFE_CONNECTION') {
    if (data.context) elements.push(mkP(mkR(data.context, { size: 16, italic: true })))
    ;(data.questions || []).forEach((q, i) =>
      elements.push(mkP([mkR(`${i+1}. `, { bold: true, size: 16, color: '3d7a20' }), mkR(q, { size: 16 })]))
    )
    if (data.prompt) elements.push(mkP(mkR(data.prompt, { size: 16 })))
    if (data.example) elements.push(mkP(mkR(`e.g. ${data.example}`, { size: 15, color: '666666', italic: true })))
  }

  else if (type === 'TEACHER_NOTE') {
    if (model === 'observation') {
      const levelText = data.for_level && data.for_level !== 'all' ? ` [${data.for_level}]` : ''
      elements.push(mkP(mkR(`📌 Nota pedagógica${levelText}`, { bold: true, size: 16, color: '767171' })))
      if (data.note) elements.push(mkP(mkR(data.note, { size: 16, italic: true, color: '555555' })))
    } else {
      ;(data.adaptations || []).forEach(a =>
        elements.push(mkP([
          mkR(a.student ? `${a.student}: ` : '', { bold: true, size: 16, color: '767171' }),
          mkR(a.note || '', { size: 16, italic: true }),
        ]))
      )
    }
  }

  return elements
}

// ── Section row builder ───────────────────────────────────────────────────────

async function fetchImageData(url) {
  try {
    const res  = await fetch(url)
    if (!res.ok) return null
    const buf  = await res.arrayBuffer()
    const lower = url.toLowerCase().split('?')[0]  // strip query params before checking ext
    const type = lower.endsWith('.png') ? 'png'
      : lower.endsWith('.webp') ? 'png'  // docx doesn't support webp — re-declare as png; Word renders it
      : 'jpg'
    return { data: buf, type }
  } catch { return null }
}

// Returns [bannerRow, contentRow] — banner is full-width colored header, content holds text + images
// Uses a single-column outer table (PW wide) to avoid Word column-span rendering issues.
// Side layout uses a nested 2-column table inside the content cell.
async function buildSectionRow(s, sectionData) {
  const text        = sectionData?.content      || ''
  const time        = sectionData?.time         || s.time
  const images      = (sectionData?.images      || []).slice(0, 6)
  const smartBlocks = sectionData?.smartBlocks  || []

  // Resolve layout
  const rawLayout = sectionData?.image_layout ||
    (sectionData?.layout_mode === 'side' ? 'right' : 'below')
  const layout    = images.length > 0 ? rawLayout : 'below'
  const isVertical = layout === 'right' || layout === 'left'

  // ── Row 1: Section banner (full-width, colored) ──────────────────────────
  const bannerRow = new TableRow({
    children: [
      mkCell([
        mkP([
          mkR(s.label, { bold: true, size: 22, color: 'FFFFFF' }),
          mkR(`   ·   ${time}`, { size: 17, color: 'DDEEFF', italic: true }),
        ]),
      ], PW, {
        fill:    s.hex,
        borders: allB(mkB(s.hex)),
        margins: { top: 80, bottom: 80, left: 160, right: 160 },
      }),
    ],
  })

  // ── Parse content & fetch images ─────────────────────────────────────────
  const contentParas  = htmlToParas(text, 18)
  const smartElements = smartBlocks.flatMap(b => buildSmartBlockDocx(b))

  const imgDataList = []
  for (const img of images) {
    const d = await fetchImageData(img.url)
    if (d) imgDataList.push(d)
  }

  // Build image paragraphs
  function makeImageParas(isVert) {
    if (!imgDataList.length) return []
    const n = imgDataList.length

    if (isVert) {
      // Image column ~240px: 1-2 stacked (220px), 3+ two per row (106px)
      if (n <= 2) {
        const w = 220, h = Math.round(w * 3 / 4)
        return imgDataList.map(d => new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [new ImageRun({ data: d.data, type: d.type, transformation: { width: w, height: h } })],
        }))
      }
      const rows = []
      for (let i = 0; i < imgDataList.length; i += 2) {
        rows.push(new Paragraph({
          spacing: { before: 30, after: 30 },
          children: imgDataList.slice(i, i + 2).map(d =>
            new ImageRun({ data: d.data, type: d.type, transformation: { width: 106, height: 106 } })
          ),
        }))
      }
      return rows
    }

    // Below layout: 1→640, 2→310, 3→202, 4→2×2 (310), 5-6→3×2 (202)
    if (n === 1) {
      return [new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [new ImageRun({ data: imgDataList[0].data, type: imgDataList[0].type, transformation: { width: 640, height: Math.round(640 * 9 / 16) } })],
      })]
    }
    if (n <= 3) {
      const w = n === 2 ? 310 : 202, h = Math.round(w * 3 / 4)
      return [new Paragraph({
        spacing: { before: 80, after: 40 },
        children: imgDataList.map(d => new ImageRun({ data: d.data, type: d.type, transformation: { width: w, height: h } })),
      })]
    }
    const w4 = 310, h4 = Math.round(w4 * 3 / 4)
    const w6 = 202, h6 = Math.round(w6 * 3 / 4)
    if (n === 4) {
      return [
        new Paragraph({ spacing: { before: 80, after: 4 }, children: imgDataList.slice(0, 2).map(d => new ImageRun({ data: d.data, type: d.type, transformation: { width: w4, height: h4 } })) }),
        new Paragraph({ spacing: { before: 4,  after: 40 }, children: imgDataList.slice(2, 4).map(d => new ImageRun({ data: d.data, type: d.type, transformation: { width: w4, height: h4 } })) }),
      ]
    }
    return [
      new Paragraph({ spacing: { before: 80, after: 4 }, children: imgDataList.slice(0, 3).map(d => new ImageRun({ data: d.data, type: d.type, transformation: { width: w6, height: h6 } })) }),
      new Paragraph({ spacing: { before: 4,  after: 40 }, children: imgDataList.slice(3, Math.min(n, 6)).map(d => new ImageRun({ data: d.data, type: d.type, transformation: { width: w6, height: h6 } })) }),
    ]
  }

  const imgParas = makeImageParas(isVertical)

  // ── Row 2: Content ────────────────────────────────────────────────────────
  let contentRow

  if (isVertical && imgDataList.length) {
    // Side layout: nested table [text 7200 | images 3600] inside a full-width outer cell
    const TEXT_W = 7200
    const IMG_W  = 3600
    const textCell = mkCell([...contentParas, ...smartElements], TEXT_W, {
      borders: allB(noB), va: VerticalAlign.TOP,
      margins: { top: 80, bottom: 80, left: 120, right: 80 },
    })
    const imgCell = mkCell(imgParas.length ? imgParas : [mkP(mkR(''))], IMG_W, {
      borders: allB(noB), va: VerticalAlign.TOP,
      margins: { top: 80, bottom: 80, left: 80, right: 120 },
    })
    const nestedTable = new Table({
      width:        { size: PW, type: WidthType.DXA },
      columnWidths: layout === 'left' ? [IMG_W, TEXT_W] : [TEXT_W, IMG_W],
      rows: [new TableRow({
        children: layout === 'left' ? [imgCell, textCell] : [textCell, imgCell],
      })],
    })
    contentRow = new TableRow({
      cantSplit: true,
      children: [
        mkCell([nestedTable], PW, {
          borders: allB(bGray),
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ],
    })
  } else {
    // Below layout (or side layout with no images): all content in one full-width cell
    contentRow = new TableRow({
      cantSplit: true,
      children: [
        mkCell([...contentParas, ...imgParas, ...smartElements], PW, {
          borders: allB(bGray), va: VerticalAlign.TOP,
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
        }),
      ],
    })
  }

  return [bannerRow, contentRow]
}

// ── Day table builder ─────────────────────────────────────────────────────────

async function buildDayTable(iso, day) {
  // Single-column table (PW wide) — no column spans needed, avoids Word compat issues
  const dayName = day.date_label || iso
  const periods = day.class_periods || ''
  const unit    = day.unit || ''

  // Day header row
  const headerRow = new TableRow({
    children: [
      mkCell([
        mkP([
          mkR(`📅 ${dayName}`, { bold: true, size: 22, color: 'FFFFFF' }),
          ...(periods ? [mkR(`  ·  ${periods}`, { size: 18, color: 'BBCCEE' })] : []),
        ], AlignmentType.LEFT),
      ], PW, {
        fill:    '1F3864',
        borders: allB(bBlue),
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
      }),
    ],
  })

  // Unit subheader
  const unitRow = new TableRow({
    children: [
      mkCell([
        mkP(mkR(unit ? `📚 ${unit}` : '', { size: 18, color: '1F3864', bold: true })),
      ], PW, {
        fill:    'D6E4F0',
        borders: allB(bBlue),
        margins: { top: 60, bottom: 60, left: 160, right: 160 },
      }),
    ],
  })

  // Section rows: each buildSectionRow returns [bannerRow, contentRow]
  const sectionRowPairs = await Promise.all(
    SECTIONS.map(s => buildSectionRow(s, day.sections?.[s.key]))
  )
  const sectionRows = sectionRowPairs.flat()

  return new Table({
    width:        { size: PW, type: WidthType.DXA },
    columnWidths: [PW],
    rows:         [headerRow, unitRow, ...sectionRows],
  })
}

// ── Main export function ──────────────────────────────────────────────────────

export async function exportGuideDocx(content, filename) {
  const h = content.header  || {}
  const i = content.info    || {}
  const o = content.objetivo || {}
  const v = content.verse   || {}
  const s = content.summary || {}

  const children = []

  // ── TABLE 0: Institutional header ──
  const hCols = [1400, 8000, 1400]

  // Fetch logo if available
  let logoCell
  if (h.logo_url) {
    try {
      const logoData = await fetchImageData(h.logo_url)
      if (logoData) {
        logoCell = mkCell([new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new ImageRun({
            data: logoData.data,
            type: logoData.type,
            transformation: { width: 80, height: 80 },
          })],
        })], hCols[0], { borders: allB(bBlue), margins: { top: 60, bottom: 60, left: 80, right: 80 } })
      }
    } catch { /* logo image failed to load — falls back to text placeholder below */ }
  }
  if (!logoCell) {
    logoCell = mkCell([mkP(mkR('LOGO', { size: 18, color: '999999' }), AlignmentType.CENTER)],
      hCols[0], { borders: allB(bBlue), margins: { top: 200, bottom: 200, left: 100, right: 100 } })
  }

  const headerTable = new Table({
    width:        { size: PW, type: WidthType.DXA },
    columnWidths: hCols,
    rows: [
      new TableRow({ children: [
        logoCell,
        mkCell([
          mkP(mkR(h.school || 'COLEGIO BOSTON FLEXIBLE', { bold: true, size: 24, color: '1F3864' }), AlignmentType.CENTER),
          mkP(mkR(h.dane   || '', { size: 16, color: '666666' }), AlignmentType.CENTER),
          emptyPara(),
          mkP(mkR(h.proceso || '', { size: 17, color: '2E5598', bold: true }), AlignmentType.CENTER),
        ], hCols[1], { borders: allB(bBlue) }),
        mkCell([
          mkP(mkR(h.codigo  || 'CBF-G AC-01',          { bold: true, size: 17, color: '1F3864' }), AlignmentType.CENTER),
          mkP(mkR(h.version || 'Versión 02 Feb 2022',  { size: 15, color: '888888' }), AlignmentType.CENTER),
        ], hCols[2], { borders: allB(bBlue) }),
      ]}),
    ],
  })
  children.push(headerTable, emptyPara())

  // ── TABLE 1: Info row ──
  const iCols  = [2700, 2700, 2700, 2700]
  const infoTable = new Table({
    width:        { size: PW, type: WidthType.DXA },
    columnWidths: iCols,
    rows: [new TableRow({ children: [
      mkCell([mkP([mkR('GRADO: ',    { bold: true, size: 18, color: '2E5598' }), mkR(i.grado      || '', { size: 18 })])], iCols[0], { fill: 'D6E4F0', borders: allB(bBlue) }),
      mkCell([mkP([mkR('PERÍODO: ',  { bold: true, size: 18, color: '2E5598' }), mkR(i.periodo    || '', { size: 18 })])], iCols[1], { fill: 'D6E4F0', borders: allB(bBlue) }),
      mkCell([mkP([mkR('SEMANA: ',   { bold: true, size: 18, color: '2E5598' }), mkR(i.semana     || '', { size: 18 })])], iCols[2], { fill: 'D6E4F0', borders: allB(bBlue) }),
      mkCell([mkP([mkR('DOCENTE: ',  { bold: true, size: 18, color: '2E5598' }), mkR(i.docente    || '', { size: 18 })])], iCols[3], { fill: 'D6E4F0', borders: allB(bBlue) }),
    ]})],
  })
  children.push(infoTable, emptyPara())

  // Info row 2: asignatura + fechas
  const iCols2 = [5400, 5400]
  const infoTable2 = new Table({
    width:        { size: PW, type: WidthType.DXA },
    columnWidths: iCols2,
    rows: [new TableRow({ children: [
      mkCell([mkP([mkR('ASIGNATURA: ', { bold: true, size: 18, color: '2E5598' }), mkR(i.asignatura || '', { size: 18 })])], iCols2[0], { fill: 'D6E4F0', borders: allB(bBlue) }),
      mkCell([mkP([mkR('FECHAS: ',     { bold: true, size: 18, color: '2E5598' }), mkR(i.fechas     || '', { size: 18 })])], iCols2[1], { fill: 'D6E4F0', borders: allB(bBlue) }),
    ]})],
  })
  children.push(infoTable2, emptyPara())

  // ── TABLE 2b: Logro ──
  const rawInds = o.indicadores?.length ? o.indicadores : o.indicador ? [o.indicador] : []
  const _indicadores = rawInds.map(ind => typeof ind === 'object' ? (ind.texto_es || ind.texto_en || ind.habilidad || '') : (ind || '')).filter(Boolean)
  if (_indicadores.length) {
    const indParas = _indicadores.flatMap((ind, idx) => [
      mkP([
        mkR(`${idx + 1}.  `, { bold: true, size: 18, color: '9BBB59' }),
        mkR(ind, { size: 18 }),
      ]),
    ])
    const objTable = new Table({
      width:        { size: PW, type: WidthType.DXA },
      columnWidths: [PW],
      rows: [
        new TableRow({ children: [
          mkCell([mkP(mkR('🎯  INDICADORES DE LOGRO', { bold: true, size: 20, color: 'FFFFFF' }), AlignmentType.CENTER)],
            PW, { fill: '9BBB59', borders: allB(bBlue) }),
        ]}),
        new TableRow({ children: [
          mkCell([
            emptyPara(),
            ...indParas,
          ], PW, { borders: allB(bGray), va: VerticalAlign.TOP, margins: { top: 100, bottom: 100, left: 140, right: 120 } }),
        ]}),
        ...(o.principio ? [new TableRow({ children: [
          mkCell([mkP([
            mkR('Principio: ', { bold: true, size: 16, color: '9BBB59' }),
            mkR(o.principio, { italic: true, size: 16, color: '444444' }),
          ])], PW, { fill: 'F2F7F0', borders: allB(bGray), margins: { top: 80, bottom: 80, left: 140, right: 120 } }),
        ]})] : []),
      ],
    })
    children.push(objTable, emptyPara())
  }

  // ── TABLE 2: Versículo ──
  const verseText = v.text || ''
  const verseRef  = v.ref  || ''
  if (verseText) {
    const verseTable = new Table({
      width:        { size: PW, type: WidthType.DXA },
      columnWidths: [PW],
      rows: [new TableRow({ children: [
        mkCell([
          mkP(mkR(`«${verseText}»`, { italic: true, size: 20, color: '5a4000' }), AlignmentType.CENTER),
          mkP(mkR(`— ${verseRef}`,  { bold: true,  size: 18, color: 'C9A84C' }), AlignmentType.CENTER),
        ], PW, { fill: 'FFF2CC', borders: allB(bBlue), margins: { top: 120, bottom: 120, left: 200, right: 200 } }),
      ]}),
    ]})
    children.push(verseTable, emptyPara())
  }

  // ── Activities header ──
  const actTable = new Table({
    width:        { size: PW, type: WidthType.DXA },
    columnWidths: [PW],
    rows: [new TableRow({ children: [
      mkCell([mkP(mkR('DESCRIPCIÓN DE ACTIVIDADES', { bold: true, size: 22, color: 'FFFFFF' }), AlignmentType.CENTER)],
        PW, { fill: '2E5598', borders: allB(bBlue), margins: { top: 100, bottom: 100, left: 200, right: 200 } }),
    ]}),
  ]})
  children.push(actTable, emptyPara())

  // ── Day tables ──
  const sortedDays = Object.entries(content.days || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, day]) => day.active !== false)

  for (let idx = 0; idx < sortedDays.length; idx++) {
    const [iso, day] = sortedDays[idx]
    children.push(await buildDayTable(iso, day))
    children.push(emptyPara())
    // Page break between days (except last)
    if (idx < sortedDays.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
  }

  // ── Summary ──
  if (s.done || s.next) {
    const summTable = new Table({
      width:        { size: PW, type: WidthType.DXA },
      columnWidths: [PW],
      rows: [
        new TableRow({ children: [
          mkCell([mkP(mkR('RESUMEN DE LA SEMANA', { bold: true, size: 20, color: 'FFFFFF' }), AlignmentType.CENTER)],
            PW, { fill: '333333', borders: allB(bBlue), margins: { top: 80, bottom: 80, left: 200, right: 200 } }),
        ]}),
        new TableRow({ children: [
          mkCell([
            mkP(mkR('Lo trabajado:', { bold: true, size: 18, color: '222222' })),
            ...htmlToParas(s.done, 18),
            emptyPara(),
            mkP(mkR('Próxima semana:', { bold: true, size: 18, color: '222222' })),
            ...htmlToParas(s.next, 18),
          ], PW, { borders: allB(bGray), va: VerticalAlign.TOP, margins: { top: 120, bottom: 120, left: 160, right: 160 } }),
        ]}),
      ],
    })
    children.push(summTable, emptyPara())
  }

  // ── Footer ──
  children.push(mkP(
    mkR(`Generado con CBF Planner · ${new Date().toLocaleDateString('es-CO')}`,
      { size: 16, color: 'AAAAAA', italic: true }),
    AlignmentType.CENTER,
  ))

  // ── Build & save ──
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const name = filename ||
    `Guia_${(i.grado || 'CBF').replace(/\s/g, '_')}_${i.asignatura || ''}_Sem${i.semana || 'X'}_${i.periodo || ''}.docx`
  saveAs(blob, name)
}
