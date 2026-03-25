import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, HeadingLevel,
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
  { key: 'subject',    label: 'SUBJECT TO BE WORKED', hex: '4F81BD', time: '~8 min'  },
  { key: 'motivation', label: 'MOTIVATION',            hex: '4BACC6', time: '~8 min'  },
  { key: 'activity',   label: 'ACTIVITY',              hex: 'F79646', time: '~15 min' },
  { key: 'skill',      label: 'SKILL DEVELOPMENT',     hex: '8064A2', time: '~40 min' },
  { key: 'closing',    label: 'CLOSING',               hex: '9BBB59', time: '~8 min'  },
  { key: 'assignment', label: 'ASSIGNMENT',             hex: '4E84A2', time: '~5 min'  },
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

// ── Section row builder ───────────────────────────────────────────────────────

function buildSectionRow(s, sectionData) {
  const dCols = [1760, 9040]
  const content = sectionData?.content || ''
  const time    = sectionData?.time    || s.time

  const labelCell = mkCell([
    mkP(mkR(s.label, { bold: true, size: 17, color: 'FFFFFF' })),
    mkP(mkR(time,    { size: 15,   color: 'FFFFFF', italic: true })),
  ], dCols[0], {
    fill:    s.hex,
    borders: allB(bGray),
    va:      VerticalAlign.TOP,
    margins: { top: 100, bottom: 80, left: 100, right: 80 },
  })

  const contentParas = htmlToParas(content, 18)

  const contentCell = mkCell(contentParas, dCols[1], {
    borders: allB(bGray),
    va:      VerticalAlign.TOP,
    margins: { top: 100, bottom: 80, left: 140, right: 120 },
  })

  return new TableRow({ children: [labelCell, contentCell] })
}

// ── Day table builder ─────────────────────────────────────────────────────────

function buildDayTable(iso, day) {
  const dCols  = [1760, 9040]
  const dTotal = 10800

  const dayName  = day.date_label || iso
  const periods  = day.class_periods || ''
  const unit     = day.unit || ''

  // Day header row
  const headerRow = new TableRow({
    children: [
      mkCell([
        mkP([
          mkR(`📅 ${dayName}`, { bold: true, size: 22, color: 'FFFFFF' }),
          ...(periods ? [mkR(`  ·  ${periods}`, { size: 18, color: 'BBCCEE' })] : []),
        ], AlignmentType.LEFT),
      ], dTotal, {
        fill:    '1F3864',
        borders: allB(bBlue),
        span:    2,
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
      }),
    ],
  })

  // Unit subheader
  const unitRow = new TableRow({
    children: [
      mkCell([
        mkP(mkR(unit ? `📚 ${unit}` : '', { size: 18, color: '1F3864', bold: true })),
      ], dTotal, {
        fill:    'D6E4F0',
        borders: allB(bBlue),
        span:    2,
        margins: { top: 60, bottom: 60, left: 160, right: 160 },
      }),
    ],
  })

  // Section rows
  const sectionRows = SECTIONS.map(s =>
    buildSectionRow(s, day.sections?.[s.key])
  )

  return new Table({
    width:        { size: dTotal, type: WidthType.DXA },
    columnWidths: [dCols[0], dCols[1]],
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
  const headerTable = new Table({
    width:        { size: PW, type: WidthType.DXA },
    columnWidths: hCols,
    rows: [
      new TableRow({ children: [
        mkCell([mkP(mkR('LOGO', { size: 18, color: '999999' }), AlignmentType.CENTER)],
          hCols[0], { borders: allB(bBlue), margins: { top: 200, bottom: 200, left: 100, right: 100 } }),
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

  // ── TABLE 2b: Objetivo ──
  if (o.general || o.indicador) {
    const halfW = Math.floor(PW / 2)
    const objTable = new Table({
      width:        { size: PW, type: WidthType.DXA },
      columnWidths: [halfW, PW - halfW],
      rows: [
        new TableRow({ children: [
          mkCell([mkP(mkR('🎯  OBJETIVO DE APRENDIZAJE', { bold: true, size: 20, color: 'FFFFFF' }), AlignmentType.CENTER)],
            PW, { fill: '9BBB59', borders: allB(bBlue), span: 2 }),
        ]}),
        new TableRow({ children: [
          mkCell([
            mkP(mkR('Objetivo General', { bold: true, size: 16, color: '9BBB59' })),
            emptyPara(),
            ...htmlToParas(o.general, 18),
          ], halfW, { borders: allB(bGray), va: VerticalAlign.TOP, margins: { top: 100, bottom: 100, left: 140, right: 100 } }),
          mkCell([
            mkP(mkR('Indicador de Logro', { bold: true, size: 16, color: '9BBB59' })),
            emptyPara(),
            ...htmlToParas(o.indicador, 18),
          ], PW - halfW, { borders: allB(bGray), va: VerticalAlign.TOP, margins: { top: 100, bottom: 100, left: 140, right: 120 } }),
        ]}),
        ...(o.principio ? [new TableRow({ children: [
          mkCell([mkP([
            mkR('Principio: ', { bold: true, size: 16, color: '9BBB59' }),
            mkR(o.principio, { italic: true, size: 16, color: '444444' }),
          ])], PW, { fill: 'F2F7F0', borders: allB(bGray), span: 2, margins: { top: 80, bottom: 80, left: 140, right: 120 } }),
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

  sortedDays.forEach(([iso, day], idx) => {
    children.push(buildDayTable(iso, day))
    children.push(emptyPara())
    // Page break between days (except last)
    if (idx < sortedDays.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
  })

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
