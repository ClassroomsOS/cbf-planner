// ── exportExamDocx.js ─────────────────────────────────────────────────────────
// Generates a printable DOCX exam document with the CBF institutional header
// (CBF-G AC-01), exam info row, and all question types rendered.
//
// Usage:
//   await exportExamDocx({ assessment, questions, school, teacherName })

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  ImageRun,
} from 'docx'
import { saveAs } from 'file-saver'

// ── Constants ────────────────────────────────────────────────────────────────
const PW   = 10800 // content width DXA (Letter - margins)
const BS   = BorderStyle.SINGLE
const BN   = BorderStyle.NONE
const mkB  = (color, sz = 4) => ({ style: BS, size: sz, color })
const noB  = { style: BN, size: 0, color: 'FFFFFF' }
const bBlk = mkB('000000')
const bGray = mkB('CCCCCC')
const allB = b => ({ top: b, bottom: b, left: b, right: b })

const BIBLICAL_KEYS = ['biblical_reflection', 'verse_analysis', 'principle_application']

const TYPE_LABEL = {
  multiple_choice:      'Opción múltiple',
  true_false:           'Verdadero / Falso',
  fill_blank:           'Completar',
  matching:             'Relacionar columnas',
  short_answer:         'Respuesta corta',
  error_correction:     'Corregir el error',
  sequencing:           'Ordenar',
  open_development:     'Desarrollo',
  biblical_reflection:  'Reflexión bíblica',
  verse_analysis:       'Análisis de versículo',
  principle_application:'Aplicar el principio',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function mkP(runs, align) {
  return new Paragraph({
    alignment: align || AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    children: Array.isArray(runs) ? runs : [runs],
  })
}

function mkR(text, { bold, italic, size, color, font, underline } = {}) {
  return new TextRun({
    text: text || '',
    bold: bold || false,
    italics: italic || false,
    size: size || 20,
    color: color || '222222',
    font: font || 'Arial',
    underline: underline ? {} : undefined,
  })
}

function emptyPara(after = 60) {
  return new Paragraph({ spacing: { before: 0, after }, children: [new TextRun('')] })
}

function mkCell(children, width, { fill, borders, va, margins, span, rowSpan } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: fill } : undefined,
    borders: borders || allB(bGray),
    verticalAlign: va || VerticalAlign.CENTER,
    margins: margins || { top: 60, bottom: 60, left: 100, right: 100 },
    columnSpan: span,
    rowSpan,
    children: Array.isArray(children) ? children : [children],
  })
}

function blankLine() {
  return mkP(mkR('_'.repeat(70), { size: 18, color: 'AAAAAA' }))
}

// ── Fetch logo ───────────────────────────────────────────────────────────────
async function fetchImageData(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct  = res.headers.get('content-type') || ''
    let type = 'png'
    if (ct.includes('jpeg') || ct.includes('jpg')) type = 'jpg'
    else if (ct.includes('webp')) type = 'png' // WebP → declare as png
    return { data: new Uint8Array(buf), type }
  } catch { return null }
}

// ── Question renderers ───────────────────────────────────────────────────────
function renderQuestion(q, idx) {
  const isBiblical = BIBLICAL_KEYS.includes(q.question_type)
  const label = TYPE_LABEL[q.question_type] || q.question_type
  const accentColor = isBiblical ? '7B3F00' : '2E5598'
  const bgColor = isBiblical ? 'FDF8F0' : 'FFFFFF'

  const rows = []

  // Question header row
  rows.push(new TableRow({ children: [
    mkCell([
      mkP([
        mkR(`${idx + 1}. `, { bold: true, size: 20, color: accentColor }),
        mkR(q.stem || '', { size: 20 }),
      ]),
      mkP([
        mkR(`${isBiblical ? '✝ ' : ''}${label}`, { italic: true, size: 16, color: '888888' }),
        mkR(`  ·  ${q.points} pts`, { size: 16, color: '888888' }),
      ]),
    ], PW, { fill: bgColor, borders: { top: bBlk, left: mkB(accentColor, 12), right: bBlk, bottom: bBlk } }),
  ] }))

  // Answer area
  const answerParas = renderAnswerArea(q)
  if (answerParas.length) {
    rows.push(new TableRow({ children: [
      mkCell(answerParas, PW, {
        fill: bgColor,
        borders: { top: noB, left: mkB(accentColor, 12), right: bBlk, bottom: bBlk },
        margins: { top: 40, bottom: 100, left: 200, right: 100 },
      }),
    ] }))
  }

  return new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: [PW],
    rows,
  })
}

function renderAnswerArea(q) {
  switch (q.question_type) {
    case 'multiple_choice':
      return (q.options || []).map(opt =>
        mkP([
          mkR('○  ', { size: 22, color: '555555' }),
          mkR(opt, { size: 20 }),
        ])
      )

    case 'true_false':
      return [mkP([
        mkR('○  Verdadero', { size: 20, bold: true }),
        mkR('          ', { size: 20 }),
        mkR('○  Falso', { size: 20, bold: true }),
      ])]

    case 'matching': {
      const cols = q.options?.col_a && q.options?.col_b ? q.options : null
      if (!cols) return [blankLine(), blankLine(), blankLine(), blankLine()]
      const matchRows = Math.max(cols.col_a?.length || 0, cols.col_b?.length || 0)
      const mCols = [4800, 1200, 4800]
      const tRows = [
        new TableRow({ children: [
          mkCell([mkP(mkR('Columna A', { bold: true, size: 18, color: 'FFFFFF' }), AlignmentType.CENTER)], mCols[0], { fill: '2E5598', borders: allB(bBlk) }),
          mkCell([mkP(mkR('→', { bold: true, size: 18, color: 'FFFFFF' }), AlignmentType.CENTER)], mCols[1], { fill: '2E5598', borders: allB(bBlk) }),
          mkCell([mkP(mkR('Columna B', { bold: true, size: 18, color: 'FFFFFF' }), AlignmentType.CENTER)], mCols[2], { fill: '2E5598', borders: allB(bBlk) }),
        ] }),
      ]
      for (let i = 0; i < matchRows; i++) {
        tRows.push(new TableRow({ children: [
          mkCell([mkP(mkR(`${i + 1}. ${cols.col_a?.[i] || ''}`, { size: 18 }))], mCols[0], { borders: allB(bGray) }),
          mkCell([mkP(mkR('___', { size: 18, color: 'AAAAAA' }), AlignmentType.CENTER)], mCols[1], { borders: allB(bGray) }),
          mkCell([mkP(mkR(`${String.fromCharCode(65 + i)}. ${cols.col_b?.[i] || ''}`, { size: 18 }))], mCols[2], { borders: allB(bGray) }),
        ] }))
      }
      return [new Table({ width: { size: PW - 200, type: WidthType.DXA }, columnWidths: mCols, rows: tRows })]
    }

    case 'sequencing':
      return [
        mkP(mkR('Escribe el número del orden correcto en el recuadro:', { italic: true, size: 16, color: '666666' })),
        ...(q.options || []).map((step, i) =>
          mkP([
            mkR(`□  ${String.fromCharCode(65 + i)}. `, { bold: true, size: 20 }),
            mkR(step, { size: 20 }),
          ])
        ),
      ]

    case 'fill_blank':
      return [
        mkP([
          mkR('Respuesta: ', { size: 18, color: '555555' }),
          mkR('_'.repeat(50), { size: 18, color: 'AAAAAA' }),
        ]),
      ]

    case 'error_correction':
      return [
        mkP(mkR('Encierra o tacha los errores y escribe la versión corregida:', { italic: true, size: 16, color: '666666' })),
        blankLine(), blankLine(), blankLine(), blankLine(),
      ]

    case 'short_answer':
      return [blankLine(), blankLine(), blankLine(), blankLine()]

    case 'open_development':
      return [blankLine(), blankLine(), blankLine(), blankLine(), blankLine(), blankLine(), blankLine(), blankLine()]

    case 'biblical_reflection':
    case 'verse_analysis':
    case 'principle_application':
      return [blankLine(), blankLine(), blankLine(), blankLine(), blankLine(), blankLine()]

    default:
      return [blankLine(), blankLine(), blankLine(), blankLine()]
  }
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function exportExamDocx({ assessment, questions, school, teacherName }) {
  const s = school || {}
  const dane  = s.dane || '308001800455'
  const resol = s.resolution || '09685 DE 2019'
  const version = s.doc_version || s.plan_version || '02 — 2022'
  const schoolName = s.name || 'COLEGIO BOSTON FLEXIBLE'

  // Fetch logo
  const logoData = s.logo_url ? await fetchImageData(s.logo_url) : null

  const children = []

  // ── Institutional Header CBF-G AC-01 ─────────────────────────────────────
  const hCols = [1650, 6600, 2550]

  let logoCell
  if (logoData) {
    try {
      logoCell = mkCell([new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          data: logoData.data,
          type: logoData.type,
          transformation: { width: 70, height: 70 },
        })],
      })], hCols[0], { borders: allB(bBlk), margins: { top: 40, bottom: 40, left: 60, right: 60 }, rowSpan: 3 })
    } catch { /* fallback below */ }
  }
  if (!logoCell) {
    logoCell = mkCell([mkP(mkR('LOGO', { size: 16, color: '999999' }), AlignmentType.CENTER)],
      hCols[0], { borders: allB(bBlk), margins: { top: 150, bottom: 150, left: 60, right: 60 }, rowSpan: 3 })
  }

  const headerTable = new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: hCols,
    rows: [
      // Row 1: Logo | School name + DANE | Código
      new TableRow({ children: [
        logoCell,
        mkCell([
          mkP(mkR(schoolName, { bold: true, size: 24 }), AlignmentType.CENTER),
          mkP(mkR(`DANE: ${dane} - RESOLUCIÓN ${resol}`, { size: 16, color: '444444' }), AlignmentType.CENTER),
        ], hCols[1], { fill: 'DBE5F1', borders: allB(bBlk) }),
        mkCell([
          mkP(mkR('CÓD: CBF - G AC - 01', { bold: true, size: 16 }), AlignmentType.CENTER),
        ], hCols[2], { borders: allB(bBlk) }),
      ] }),
      // Row 2: (logo continues) | PROCESO + subtítulo | Versión
      new TableRow({ children: [
        mkCell([
          mkP([mkR('PROCESO', { bold: true, size: 16, underline: true }), mkR(': GESTIÓN ACADÉMICA Y CURRICULAR', { bold: true, size: 16 })], AlignmentType.CENTER),
          mkP(mkR('Evaluación', { bold: true, size: 16 }), AlignmentType.CENTER),
        ], hCols[1], { borders: allB(bBlk), rowSpan: 2 }),
        mkCell([
          mkP([mkR('Versión ', { bold: true, size: 16 }), mkR(version, { size: 16 })], AlignmentType.CENTER),
        ], hCols[2], { borders: allB(bBlk) }),
      ] }),
      // Row 3: (logo continues) | (proceso continues) | Página
      new TableRow({ children: [
        mkCell([
          mkP(mkR('Página ___ de ___', { size: 16, color: '888888' }), AlignmentType.CENTER),
        ], hCols[2], { borders: allB(bBlk) }),
      ] }),
    ],
  })
  children.push(headerTable, emptyPara(40))

  // ── Exam info row ────────────────────────────────────────────────────────
  const iCols = [2700, 2700, 2700, 2700]
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: iCols,
    rows: [new TableRow({ children: [
      mkCell([mkP([mkR('Grado: ', { bold: true, size: 18, color: '2E5598' }), mkR(assessment.grade || '', { size: 18 })])], iCols[0], { fill: 'DBE5F1', borders: allB(bBlk) }),
      mkCell([mkP([mkR('Período: ', { bold: true, size: 18, color: '2E5598' }), mkR(assessment.period ? `${assessment.period}` : '—', { size: 18 })])], iCols[1], { fill: 'DBE5F1', borders: allB(bBlk) }),
      mkCell([mkP([mkR('Asignatura: ', { bold: true, size: 18, color: '2E5598' }), mkR(assessment.subject || '', { size: 18 })])], iCols[2], { fill: 'DBE5F1', borders: allB(bBlk) }),
      mkCell([mkP([mkR('Docente: ', { bold: true, size: 18, color: '2E5598' }), mkR(teacherName || '', { size: 18 })])], iCols[3], { fill: 'DBE5F1', borders: allB(bBlk) }),
    ] })],
  }))

  // Student name + date row
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: [PW],
    rows: [new TableRow({ children: [
      mkCell([mkP([
        mkR('Nombre: ', { bold: true, size: 18 }),
        mkR('____________________________________________', { size: 18, color: 'AAAAAA' }),
        mkR('     Fecha: ', { bold: true, size: 18 }),
        mkR('________________', { size: 18, color: 'AAAAAA' }),
      ])], PW, { fill: 'DBE5F1', borders: allB(bBlk) }),
    ] })],
  }))
  children.push(emptyPara(100))

  // ── Instructions ─────────────────────────────────────────────────────────
  if (assessment.instructions) {
    children.push(
      mkP(mkR('INSTRUCCIONES', { bold: true, size: 20, color: '1F3864' })),
      mkP(mkR(assessment.instructions, { size: 18, italic: true, color: '444444' })),
      emptyPara(100),
    )
  }

  // ── Questions ────────────────────────────────────────────────────────────
  const academic = (questions || []).filter(q => !BIBLICAL_KEYS.includes(q.question_type))
  const biblical = (questions || []).filter(q => BIBLICAL_KEYS.includes(q.question_type))

  if (biblical.length > 0 && academic.length > 0) {
    // Section header for academic
    children.push(mkP(mkR(`SECCIÓN ACADÉMICA — ${academic.length} preguntas`, { bold: true, size: 20, color: '1F3864' })))
    children.push(emptyPara(60))
  }

  let qIdx = 0
  for (const q of academic) {
    children.push(renderQuestion(q, qIdx++))
    children.push(emptyPara(80))
  }

  if (biblical.length > 0) {
    children.push(emptyPara(60))
    children.push(mkP(mkR(`✝ SECCIÓN BÍBLICA — ${biblical.length} preguntas`, { bold: true, size: 20, color: '7B3F00' })))
    children.push(emptyPara(60))
    for (const q of biblical) {
      children.push(renderQuestion(q, qIdx++))
      children.push(emptyPara(80))
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  children.push(emptyPara(200))
  children.push(mkP(mkR(
    `${schoolName} · ${assessment.subject || ''} · ${assessment.grade || ''} · ${assessment.title || ''} · ${new Date().getFullYear()}`,
    { size: 14, color: 'AAAAAA', italic: true }
  ), AlignmentType.CENTER))

  // ── Build document ───────────────────────────────────────────────────────
  const doc = new Document({
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
  const safeTitle = (assessment.title || 'Examen').replace(/[^\w\s-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_')
  const grade = (assessment.grade || '').replace(/[^\w°]/g, '').trim()
  saveAs(blob, `Examen_${grade}_${assessment.subject || ''}_${safeTitle}.docx`)
}
