// ── exportLegacyDocx.js ──────────────────────────────────────────────────────
// Generates a "Legacy Format" DOCX — plain Word tables, no Smart Blocks, no
// colors — matching the hand-made Word template used at CBF for all grades.
//
// Structure:
//   [Paragraph]  Date: Mon dd – Mon dd          Level: Xth grade
//   [Paragraph]  WEEKLY_LABEL  (bold, if set)
//   [Paragraph]  LEARNING OBJECTIVE: …
//   [1×1 Table]  Año 2026: Año de la Pureza | year verse
//   [Paragraphs] BIBLICAL PRINCIPLE: title + full citation  (if set)
//   [N×2 Table]  Date | ACTIVITIES DESCRIPTION  — one row per active day
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ImageRun, UnderlineType, ShadingType,
} from 'docx'
import { saveAs } from 'file-saver'

// ── Constants ─────────────────────────────────────────────────────────────────
const PW   = 10800   // content width DXA (Letter − margins)
const BS   = BorderStyle.SINGLE
const BN   = BorderStyle.NONE
const mkB  = (color, sz = 4) => ({ style: BS, size: sz, color })
const noB  = { style: BN, size: 0, color: 'FFFFFF' }
const bGray = mkB('BBBBBB')
const allB  = b => ({ top: b, bottom: b, left: b, right: b })

// ── Paragraph helpers ─────────────────────────────────────────────────────────
function mkP(runs, align) {
  return new Paragraph({
    alignment: align || AlignmentType.LEFT,
    spacing:   { before: 0, after: 120 },
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

function blankP() {
  return new Paragraph({ spacing: { before: 0, after: 120 }, children: [] })
}

// ── Table helpers ─────────────────────────────────────────────────────────────
function mkCell(children, width, { va, borders, margins, fill } = {}) {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    borders:       borders || allB(bGray),
    verticalAlign: va || VerticalAlign.TOP,
    margins:       margins || { top: 80, bottom: 80, left: 120, right: 120 },
    shading:       fill ? { fill, type: ShadingType.CLEAR, color: fill } : undefined,
    children:      Array.isArray(children) ? children : [children],
  })
}

// ── HTML → plain text (strip tags) ───────────────────────────────────────────
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Fetch image as ArrayBuffer for DOCX ──────────────────────────────────────
async function fetchImageData(url) {
  try {
    const res   = await fetch(url)
    if (!res.ok) return null
    const buf   = await res.arrayBuffer()
    const lower = url.toLowerCase().split('?')[0]
    const type  = lower.endsWith('.png') ? 'png'
      : lower.endsWith('.webp') ? 'png'   // Word doesn't support webp — treat as png
      : 'jpg'
    return { data: buf, type }
  } catch { return null }
}

// ── Section keys + labels ─────────────────────────────────────────────────────
const SECTION_ORDER = ['subject', 'motivation', 'activity', 'skill', 'closing', 'assignment']
const SECTION_LABELS = {
  subject:    'SUBJECT TO BE WORKED',
  motivation: 'MOTIVATION',
  activity:   'ACTIVITY',
  skill:      'SKILL DEVELOPMENT',
  closing:    'CLOSING',
  assignment: 'ASSIGNMENT',
}

// Builds paragraph array for one day: section label (bold) + text + images, per section
async function dayContentParas(day) {
  const paras = []

  for (const key of SECTION_ORDER) {
    const sec    = day.sections?.[key]
    if (!sec) continue
    const text   = stripHtml(sec.content || '')
    const images = (sec.images || []).slice(0, 6)
    if (!text && !images.length) continue

    // Section label — plain bold, no color
    paras.push(mkP(mkR(SECTION_LABELS[key], { bold: true, size: 19 })))

    // Text content
    if (text) {
      for (const line of text.split('\n')) {
        paras.push(mkP(mkR(line)))
      }
    }

    // Images — two per row at 190px, single image at 380px
    const imgList = []
    for (const img of images) {
      const d = await fetchImageData(img.url)
      if (d) imgList.push(d)
    }
    for (let i = 0; i < imgList.length; i += 2) {
      const pair = imgList.slice(i, i + 2)
      const w = pair.length === 1 ? 380 : 190
      const h = Math.round(w * 3 / 4)
      paras.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        children: pair.map(d => new ImageRun({ data: d.data, type: d.type, transformation: { width: w, height: h } })),
      }))
    }

    paras.push(blankP())
  }

  return paras.length ? paras : [blankP()]
}

// ── Date label helpers ────────────────────────────────────────────────────────
const DAYS_EN   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatLegacyDate(iso) {
  // "2026-03-16" → "Monday, March 16"
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`
}

// ── Multi-line text → paragraphs ──────────────────────────────────────────────
function textToParagraphs(text, opts = {}) {
  if (!text) return []
  return text.split('\n').map(line =>
    mkP(mkR(line.trim(), opts))
  )
}

// ── Institutional header table (3 cols: logo | school info | code/version) ────
async function buildHeaderTable(header) {
  const h      = header || {}
  const hCols  = [1440, 7560, 1800]  // logo | center | right (total = 10800)
  const bGrayH = mkB('AAAAAA', 4)
  const allBH  = b => ({ top: b, bottom: b, left: b, right: b })

  // Logo cell
  let logoCell
  if (h.logo_url) {
    try {
      const logoData = await fetchImageData(h.logo_url)
      if (logoData) {
        logoCell = new TableCell({
          width: { size: hCols[0], type: WidthType.DXA },
          borders: allBH(bGrayH),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new ImageRun({
              data: logoData.data,
              type: logoData.type,
              transformation: { width: 80, height: 80 },
            })],
          })],
        })
      }
    } catch {}
  }
  if (!logoCell) {
    logoCell = new TableCell({
      width: { size: hCols[0], type: WidthType.DXA },
      borders: allBH(bGrayH),
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [mkP(mkR('CBF', { size: 18, color: '999999', bold: true }), AlignmentType.CENTER)],
    })
  }

  // Center cell: school name / DANE-resolución / PROCESO (underlined) / tipo de guía
  const schoolName = h.school  || 'COLEGIO BOSTON FLEXIBLE'
  const daneText   = h.dane    || 'DANE: 308001800455 — RESOLUCIÓN 09685 DE 2019'
  const procesoRaw = h.proceso || 'GESTIÓN ACADÉMICA Y CURRICULAR'
  // Strip "PROCESO:" prefix if already present; always render it separately
  const procesoBody = procesoRaw.replace(/^PROCESO:\s*/i, '').trim()

  const centerCell = new TableCell({
    width: { size: hCols[1], type: WidthType.DXA },
    borders: allBH(bGrayH),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: schoolName, bold: true, size: 24, font: 'Arial', color: '1F3864' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: daneText, size: 16, font: 'Arial', color: '555555' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({ text: 'PROCESO: ', bold: true, size: 17, font: 'Arial', color: '222222' }),
          new TextRun({
            text: procesoBody, bold: true, size: 17, font: 'Arial', color: '222222',
            underline: { type: UnderlineType.SINGLE },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: 'Guía de Aprendizaje Autónomo', size: 17, font: 'Arial', color: '444444' })],
      }),
    ],
  })

  // Right cell: código / versión / página
  const codText = h.codigo  || 'CBF-G AC-01'
  const verText = h.version || 'Versión 02 Febrero 2022'

  const rightCell = new TableCell({
    width: { size: hCols[2], type: WidthType.DXA },
    borders: allBH(bGrayH),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: `CÓD: ${codText}`, bold: true, size: 16, font: 'Arial', color: '1F3864' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: verText, size: 15, font: 'Arial', color: '666666' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: 'Página 1', size: 15, font: 'Arial', color: '666666' })],
      }),
    ],
  })

  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: hCols,
    rows: [new TableRow({ children: [logoCell, centerCell, rightCell] })],
  })
}

// ── Main builder ──────────────────────────────────────────────────────────────
async function buildLegacyDocx(content, plan) {
  const info = content.info || {}
  const obj  = content.objetivo || {}

  // --- 1. Date + Level paragraph ---
  const dateText    = info.fechas || plan?.date_range || ''
  const gradeText   = info.grado  || plan?.grade || ''
  const dateLevelP  = mkP([
    mkR(`Date: ${dateText}`, { bold: true }),
    mkR('          '),
    mkR(`Level: ${gradeText}`, { bold: true }),
  ])

  // --- 2. Weekly label (optional, bold) ---
  const weeklyLabelP = (plan?.weekly_label)
    ? mkP(mkR(plan.weekly_label, { bold: true, size: 24 }), AlignmentType.CENTER)
    : null

  // --- 3. Learning objective ---
  const objectiveText = (() => {
    const inds = obj.indicadores || []
    if (inds.length > 0) {
      // Pick first non-empty indicator
      for (const ind of inds) {
        const t = typeof ind === 'string' ? ind : (ind.texto_en || ind.texto_es || ind.habilidad || '')
        if (t.trim()) return t.trim()
      }
    }
    return obj.general || ''
  })()
  const objectiveP = mkP([
    mkR('LEARNING OBJECTIVE: ', { bold: true }),
    mkR(objectiveText),
  ])

  // --- 4. Year verse 1×1 table ---
  const verse       = content.verse || {}
  const yearVerse   = verse.text   || 'Génesis 1:27-28a (TLA)'
  const yearVerseRef = verse.ref   || ''
  const verseCell   = mkCell(
    [
      mkP([
        mkR('Año 2026: ', { bold: true }),
        mkR('Año de la Pureza', { bold: true }),
      ], AlignmentType.CENTER),
      mkP(mkR(stripHtml(yearVerse), { italic: true, size: 18 }), AlignmentType.CENTER),
      yearVerseRef ? mkP(mkR(yearVerseRef, { size: 18, color: '555555' }), AlignmentType.CENTER) : blankP(),
    ],
    PW,
    { borders: allB(bGray) }
  )
  const verseTable = new Table({
    width: { size: PW, type: WidthType.DXA },
    rows: [new TableRow({ children: [verseCell] })],
  })

  // --- 5. Biblical principle (optional) ---
  const biblicalParagraphs = plan?.weekly_biblical_principle
    ? [
        blankP(),
        mkP(mkR('BIBLICAL PRINCIPLE:', { bold: true, size: 22 })),
        ...textToParagraphs(plan.weekly_biblical_principle, { italic: true }),
      ]
    : []

  // --- 6. Days table N×2 ---
  const activeDays = Object.entries(content.days || {})
    .filter(([, d]) => d.active !== false)
    .sort(([a], [b]) => a.localeCompare(b))

  const DATE_COL  = Math.round(PW * 0.22)
  const ACT_COL   = Math.round(PW * 0.78)
  const DATE_FILL = 'D7E3BC'   // same green as hand-made Word template

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      mkCell(mkP(mkR('Date', { bold: true })), DATE_COL, { borders: allB(bGray), fill: DATE_FILL }),
      mkCell(mkP(mkR('ACTIVITIES DESCRIPTION', { bold: true })), ACT_COL, { borders: allB(bGray) }),
    ],
  })

  const dayRows = await Promise.all(activeDays.map(async ([iso, day]) => {
    const dateLabel    = day.date_label || formatLegacyDate(iso)
    const contentParas = await dayContentParas(day)

    return new TableRow({
      children: [
        mkCell(
          mkP(mkR(dateLabel, { bold: true })),
          DATE_COL,
          { va: VerticalAlign.TOP, borders: allB(bGray), fill: DATE_FILL }
        ),
        mkCell(
          contentParas,
          ACT_COL,
          { va: VerticalAlign.TOP, borders: allB(bGray) }
        ),
      ],
    })
  }))

  const daysTable = activeDays.length > 0
    ? new Table({
        width: { size: PW, type: WidthType.DXA },
        rows:  [headerRow, ...dayRows],
      })
    : null

  // --- Header table ---
  const headerTable = await buildHeaderTable(content.header)

  // --- Assemble document ---
  const bodyChildren = [
    headerTable,
    blankP(),
    dateLevelP,
    ...(weeklyLabelP ? [blankP(), weeklyLabelP] : []),
    blankP(),
    objectiveP,
    blankP(),
    verseTable,
    ...biblicalParagraphs,
    blankP(),
    ...(daysTable ? [daysTable] : []),
  ]

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      children: bodyChildren,
    }],
  })
}

// ── Public export function ────────────────────────────────────────────────────
export async function exportLegacyDocx(content, plan) {
  try {
    const doc    = await buildLegacyDocx(content, plan)
    const blob   = await Packer.toBlob(doc)
    const grade  = (content?.info?.grado || plan?.grade || 'guia').replace(/[^\w°\s-]/g, '').trim()
    const week   = content?.info?.semana || plan?.week_number || ''
    const subject = (content?.info?.asignatura || plan?.subject || '').replace(/[^\w\s-]/g, '').trim()
    const filename = `Legacy_${grade}_${subject}_Sem${week}.docx`
    saveAs(blob, filename)
  } catch (err) {
    console.error('exportLegacyDocx error', err)
    throw err
  }
}
