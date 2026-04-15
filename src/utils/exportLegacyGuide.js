// exportLegacyGuide.js — Formato institucional CBF-G AC-01
// Builds a raw .docx (ZIP + Word XML) using JSZip — no docx.js dependency.

import JSZip from 'jszip'
import { SECTIONS } from './constants'
import HEADER_XML from '../assets/cbf-template/header1.xml?raw'

// ── Constants ──────────────────────────────────────────────────────────────────

const WEEK_TYPE_MAP = {
  speaking:  'SPEAKING & LISTENING WEEK',
  listening: 'SPEAKING & LISTENING WEEK',
  reading:   'READING & WRITING WEEK',
  writing:   'READING & WRITING WEEK',
  general:   'INTRODUCTORY & REVIEW WEEK',
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DAY_NAMES = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']

// ── Helpers ────────────────────────────────────────────────────────────────────

function xe(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ordSuffix(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
}

function parseDateDocx(iso) {
  const d = new Date(iso + 'T12:00:00')
  const dayNum = d.getDate()
  return {
    dayName:   DAY_NAMES[d.getDay()],
    monthName: MONTHS[d.getMonth()].toUpperCase(),
    dayNum,
    ordinal:   ordSuffix(dayNum),
    year:      d.getFullYear(),
  }
}

function parseGrade(gradeStr) {
  const match = gradeStr?.match(/(\d+)/)
  if (!match) return { num: '', ordinal: 'th' }
  const n = parseInt(match[1])
  return { num: String(n), ordinal: ordSuffix(n) }
}

// Strip HTML tags to plain text, preserving line breaks from block elements
function htmlToText(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Word XML primitives ────────────────────────────────────────────────────────

const FONT = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>`
const SZ   = `<w:sz w:val="20"/><w:szCs w:val="20"/>`
const SP   = `<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>`

function emptyP() {
  return `<w:p><w:pPr>${SP}</w:pPr></w:p>`
}

// Colored bold section header paragraph
function sectionHeader(label, hexColor) {
  return `<w:p>
    <w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
    <w:r><w:rPr>${FONT}<w:b/><w:color w:val="${hexColor}"/>${SZ}</w:rPr>
      <w:t xml:space="preserve">${xe(label)}</w:t>
    </w:r>
  </w:p>`
}

// Convert HTML content to a series of Word paragraphs
function contentParas(html) {
  if (!html) return emptyP()
  const text = htmlToText(html)
  const lines = text.split('\n')
  if (!lines.some(l => l.trim())) return emptyP()
  return lines.map(line =>
    line.trim()
      ? `<w:p><w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
          <w:r><w:rPr>${FONT}${SZ}</w:rPr>
            <w:t xml:space="preserve">${xe(line)}</w:t>
          </w:r>
        </w:p>`
      : emptyP()
  ).join('\n')
}

// ── Day row (activities table row) ────────────────────────────────────────────

function buildDayRow(iso, day) {
  const { dayName, monthName, dayNum, ordinal } = parseDateDocx(iso)

  const leftCell = `<w:tc>
    <w:tcPr>
      <w:tcW w:w="1413" w:type="dxa"/>
      <w:shd w:val="clear" w:color="auto" w:fill="D7E3BC"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p><w:pPr>${SP}<w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr><w:t>${xe(dayName)}</w:t></w:r>
    </w:p>
    <w:p><w:pPr>${SP}<w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr>
        <w:t xml:space="preserve">${xe(monthName + ' ' + dayNum)}</w:t>
      </w:r>
      <w:r><w:rPr>${FONT}<w:b/>${SZ}<w:vertAlign w:val="superscript"/></w:rPr>
        <w:t>${xe(ordinal)}</w:t>
      </w:r>
    </w:p>
  </w:tc>`

  const sections = day.sections || {}
  let rightContent = ''

  for (const s of SECTIONS) {
    const section  = sections[s.key] || {}
    const hexColor = s.hex.replace('#', '')
    const time     = section.time || s.time

    // Header label — SKILLS DEVELOPMENT uses blank time per institutional rule
    const headerLabel = s.key === 'skill'
      ? `${s.label} (___min)`
      : `${s.label} (${time})`

    rightContent += sectionHeader(headerLabel, hexColor)
    rightContent += emptyP()

    if (s.sublevel) {
      rightContent += `<w:p><w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
        <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr>
          <w:t xml:space="preserve">${xe(s.sublevel + ': ')}</w:t>
        </w:r>
      </w:p>`
    }

    rightContent += contentParas(section.content)
    rightContent += emptyP()
  }

  const rightCell = `<w:tc>
    <w:tcPr>
      <w:tcW w:w="8651" w:type="dxa"/>
      <w:vAlign w:val="top"/>
    </w:tcPr>
    ${rightContent}
  </w:tc>`

  return `<w:tr>${leftCell}${rightCell}</w:tr>`
}

// ── Week block ─────────────────────────────────────────────────────────────────

function buildWeekXml({ plan, newsProject, indicator }) {
  const content = plan?.content || {}
  const days    = content.days || {}

  const activeDayKeys = Object.keys(days)
    .filter(k => days[k].active !== false)
    .sort()

  if (activeDayKeys.length === 0) return ''

  const first     = parseDateDocx(activeDayKeys[0])
  const last      = parseDateDocx(activeDayKeys[activeDayKeys.length - 1])
  const grade     = parseGrade(plan?.grade || '')
  const weekType  = WEEK_TYPE_MAP[newsProject?.skill] || 'WEEKLY GUIDE'
  const principle = (newsProject?.biblical_principle || '').toUpperCase()
  const verseRef  = newsProject?.indicator_verse_ref || ''
  const verseText = newsProject?.biblical_reflection || ''
  const objective = indicator?.text || content.objetivo?.general || ''

  // ── Date line
  const dateLine = `<w:p>
    <w:pPr>${SP}</w:pPr>
    <w:r><w:rPr>${FONT}<w:b/><w:color w:val="1F497D"/>${SZ}</w:rPr><w:t>Date:</w:t></w:r>
    <w:r><w:rPr>${FONT}${SZ}</w:rPr>
      <w:t xml:space="preserve"> ${xe(first.monthName + ' ' + first.dayNum)}</w:t>
    </w:r>
    <w:r><w:rPr>${FONT}${SZ}<w:vertAlign w:val="superscript"/></w:rPr>
      <w:t>${xe(first.ordinal)}</w:t>
    </w:r>
    ${activeDayKeys.length > 1 ? `
    <w:r><w:rPr>${FONT}${SZ}</w:rPr>
      <w:t xml:space="preserve"> &amp; ${xe(last.monthName + ' ' + last.dayNum)}</w:t>
    </w:r>
    <w:r><w:rPr>${FONT}${SZ}<w:vertAlign w:val="superscript"/></w:rPr>
      <w:t>${xe(last.ordinal)}</w:t>
    </w:r>` : ''}
    <w:r><w:rPr>${FONT}${SZ}</w:rPr>
      <w:t xml:space="preserve">, ${xe(String(first.year))}                                                    </w:t>
    </w:r>
    <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr><w:t>Level</w:t></w:r>
    <w:r><w:rPr>${FONT}${SZ}</w:rPr><w:t xml:space="preserve">: </w:t></w:r>
    <w:r><w:rPr>${FONT}${SZ}<w:u w:val="single"/></w:rPr><w:t>${xe(grade.num)}</w:t></w:r>
    <w:r><w:rPr>${FONT}${SZ}<w:u w:val="single"/><w:vertAlign w:val="superscript"/></w:rPr>
      <w:t>${xe(grade.ordinal)}</w:t>
    </w:r>
    <w:r><w:rPr>${FONT}${SZ}<w:u w:val="single"/></w:rPr>
      <w:t xml:space="preserve"> grade</w:t>
    </w:r>
  </w:p>`

  // ── Week type
  const weekTypePara = `<w:p>
    <w:pPr>${SP}</w:pPr>
    <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr><w:t>${xe(weekType)}</w:t></w:r>
  </w:p>`

  // ── Year verse box (institutional — hardcoded per CLAUDE.md)
  const verseBox = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10064" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="10064"/></w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="10064" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr>${SP}<w:ind w:hanging="2"/><w:jc w:val="center"/></w:pPr>
          <w:r><w:rPr><w:b/><w:bCs/>${SZ}</w:rPr><w:t>Año 2026: Año de la Pureza</w:t></w:r>
        </w:p>
        ${emptyP()}
        <w:p><w:pPr>${SP}<w:ind w:hanging="2"/></w:pPr>
          <w:r><w:rPr><w:b/><w:bCs/>${SZ}</w:rPr><w:t>Génesis 1: 26 – 27</w:t></w:r>
        </w:p>
        <w:p><w:pPr>${SP}<w:ind w:hanging="2"/><w:jc w:val="both"/></w:pPr>
          <w:r><w:rPr>${SZ}</w:rPr><w:t>"Entonces dijo Dios: Hagamos al hombre a nuestra imagen, conforme a nuestra semejanza; y señoree en los peces del mar, en las aves de los cielos, en las bestias, en toda la tierra, y en todo animal que se arrastra sobre la tierra. Y creó Dios al hombre a su imagen, a imagen de Dios lo creó; varón y hembra los creó".</w:t></w:r>
        </w:p>
        ${emptyP()}
      </w:tc>
    </w:tr>
  </w:tbl>`

  // ── Biblical principle block
  const principleBlock = principle ? `
    <w:p><w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
      <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr>
        <w:t xml:space="preserve">BIBLICAL PRINCIPLE:  </w:t>
      </w:r>
      <w:r><w:rPr>${FONT}<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>${xe(principle)}</w:t>
      </w:r>
    </w:p>
    ${emptyP()}
    ${verseRef ? `<w:p><w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
      <w:r><w:rPr>${FONT}<w:b/><w:bCs/>${SZ}</w:rPr><w:t>${xe(verseRef)}</w:t></w:r>
    </w:p>${emptyP()}` : ''}
    ${verseText ? `<w:p><w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
      <w:r><w:rPr>${FONT}<w:i/>${SZ}</w:rPr><w:t>${xe(verseText)}</w:t></w:r>
    </w:p>${emptyP()}` : ''}
  ` : ''

  // ── Learning objective
  const objectivePara = objective ? `<w:p><w:pPr>${SP}<w:jc w:val="both"/></w:pPr>
    <w:r><w:rPr>${FONT}<w:b/>${SZ}</w:rPr>
      <w:t xml:space="preserve">LEARNING OBJECTIVE: </w:t>
    </w:r>
    <w:r><w:rPr>${FONT}${SZ}</w:rPr><w:t>${xe(objective)}</w:t></w:r>
  </w:p>${emptyP()}` : ''

  // ── Activities table
  const tableHeaderRow = `<w:tr>
    <w:trPr><w:trHeight w:val="500"/></w:trPr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="1413" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="D7E3BC"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p><w:pPr>${SP}<w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr><w:b/>${SZ}</w:rPr><w:t>Date</w:t></w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="8651" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="D7E3BC"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p><w:pPr>${SP}<w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr><w:b/>${SZ}</w:rPr><w:t>ACTIVITIES DESCRIPTION</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>`

  const dayRows = activeDayKeys.map(k => buildDayRow(k, days[k])).join('\n')

  const activitiesTable = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10064" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="1413"/>
      <w:gridCol w:w="8651"/>
    </w:tblGrid>
    ${tableHeaderRow}
    ${dayRows}
  </w:tbl>`

  return [dateLine, weekTypePara, emptyP(), verseBox, emptyP(), principleBlock, objectivePara, activitiesTable].join('\n')
}

// ── Minimal supporting Word XML files ──────────────────────────────────────────

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
          xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
          mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        <w:sz w:val="20"/><w:szCs w:val="20"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`

const WEB_SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:webSettings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`

const FOOTNOTES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
</w:footnotes>`

const ENDNOTES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:endnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:endnote>
  <w:endnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:endnote>
</w:endnotes>`

const FONT_TABLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Arial">
    <w:panose1 w:val="020B0604020202020204"/>
    <w:charset w:val="00"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
    <w:sig w:usb0="E0002EFF" w:usb1="C000785B" w:usb2="00000009" w:usb3="00000000" w:csb0="000001FF" w:csb1="00000000"/>
  </w:font>
</w:fonts>`

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr lastClr="000000" val="windowText"/></a:dk1>
      <a:lt1><a:sysClr lastClr="ffffff" val="window"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A9D18E"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`

// ── Document namespaces ────────────────────────────────────────────────────────

const DOCX_NS = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex wp14"`

const SECT_PR = `<w:sectPr>
  <w:headerReference w:type="default" r:id="rId25"/>
  <w:pgSz w:w="12240" w:h="20160" w:code="171"/>
  <w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
  <w:pgNumType w:start="1"/>
  <w:cols w:space="720"/>
  <w:docGrid w:linePitch="299"/>
</w:sectPr>`

const PAGE_BREAK = `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>`

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * buildWeeklyGuideDocx(weeks) → Blob (.docx)
 *
 * @param {Array<{ plan, newsProject, indicator, teacher }>} weeks
 */
export async function buildWeeklyGuideDocx(weeks) {
  const zip = new JSZip()

  // Fetch logo — embed as word/media/image7.png
  let hasLogo = false
  const logoUrl = weeks[0]?.plan?.content?.header?.logo_url
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl)
      if (res.ok) {
        zip.file('word/media/image7.png', await res.arrayBuffer())
        hasLogo = true
      }
    } catch (_) { /* logo unavailable — header renders without image */ }
  }

  // Build document body
  const weekBlocks = weeks.map(w => buildWeekXml(w)).filter(Boolean)
  const bodyContent = weekBlocks.join(`\n${PAGE_BREAK}\n`)

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${DOCX_NS}>
  <w:body>
    ${bodyContent}
    ${SECT_PR}
  </w:body>
</w:document>`

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
  <Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
  <Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`)

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

  // word/document.xml
  zip.file('word/document.xml', documentXml)

  // word/header1.xml — exact institutional header (CBF-G AC-01)
  zip.file('word/header1.xml', HEADER_XML)

  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId25" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>
  <Relationship Id="rId26" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  <Relationship Id="rId27" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`)

  // word/_rels/header1.xml.rels — points to logo if fetched
  zip.file('word/_rels/header1.xml.rels', hasLogo
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image7.png"/>
</Relationships>`
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`)

  // Minimal supporting files
  zip.file('word/styles.xml',     STYLES_XML)
  zip.file('word/settings.xml',   SETTINGS_XML)
  zip.file('word/webSettings.xml',WEB_SETTINGS_XML)
  zip.file('word/footnotes.xml',  FOOTNOTES_XML)
  zip.file('word/endnotes.xml',   ENDNOTES_XML)
  zip.file('word/fontTable.xml',  FONT_TABLE_XML)
  zip.file('word/numbering.xml',  NUMBERING_XML)
  zip.file('word/theme/theme1.xml', THEME_XML)

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
