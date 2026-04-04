/**
 * exportRubricHtml.js
 * Generates an interactive evaluation HTML from a NEWS project rubric.
 * Opens in a new tab — teacher clicks cells to score, auto-calculates grade.
 */

const SKILL_ICONS = {
  speaking:  '🎤',
  listening: '🎧',
  reading:   '📖',
  writing:   '✍️',
}

export function exportRubricHtml(project, principles, school) {
  const {
    title = 'Proyecto',
    subject = '',
    grade = '',
    section = '',
    skill = '',
    biblical_principle = '',
    due_date = '',
    rubric = [],
    target_indicador = '',
  } = project

  if (rubric.length === 0) return

  const skillIcon  = SKILL_ICONS[skill?.toLowerCase()] || '📋'
  const totalMax   = rubric.length * 5
  const schoolName = school?.name || 'Boston Flex Bilingual School'
  const logoUrl    = school?.logo_url || ''
  const yearVerse  = principles?.yearVerse || ''
  const yearVerseRef = principles?.yearVerseRef || ''
  const dueFmt     = due_date ? new Date(due_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  // Build criteria JSON for inline script
  const criteriaJSON = JSON.stringify(
    rubric.map((c, i) => ({
      id: `c${i + 1}`,
      name: `${i + 1}. ${c.name || `Criterio ${i + 1}`}`,
      desc: c.desc || '',
      levels: [
        c.levels?.[0] || '',
        c.levels?.[1] || '',
        c.levels?.[2] || '',
        c.levels?.[3] || '',
        c.levels?.[4] || '',
      ],
    }))
  )

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${skillIcon} Rúbrica — ${title} · ${grade}${section ? ' ' + section : ''} · ${schoolName}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<style>
  :root {
    --blue:   #1A3A8F;
    --blue2:  #0d2260;
    --red:    #CC1F27;
    --yellow: #F5C300;
    --green:  #1A6B3A;
    --dark:   #1A1A2E;
    --white:  #FFFFFF;
    --gray:   #F5F5F5;
    --gray2:  #E8E8E8;
    --shadow: 0 4px 20px rgba(26,58,143,0.12);
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Nunito', sans-serif; background: #ECF0F8; color: var(--dark); min-height: 100vh; padding: 24px 16px 48px; }
  .page { max-width: 1100px; margin: 0 auto; }

  /* ── HEADER ── */
  .header { background: linear-gradient(135deg, var(--blue) 0%, var(--blue2) 60%, var(--red) 100%); border-radius: 16px; overflow: hidden; margin-bottom: 20px; box-shadow: var(--shadow); position: relative; }
  .header::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(-55deg, transparent, transparent 24px, rgba(255,255,255,0.025) 24px, rgba(255,255,255,0.025) 48px); }
  .header-bar { height: 5px; background: linear-gradient(90deg, var(--yellow), #ffde59, var(--yellow)); }
  .header-inner { display: flex; align-items: center; gap: 20px; padding: 22px 32px; position: relative; z-index: 1; }
  .header-logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; flex-shrink: 0; }
  .header-text h1 { font-family: 'Playfair Display', serif; font-size: 24px; color: var(--yellow); line-height: 1.2; margin-bottom: 4px; }
  .header-text .sub { font-size: 13px; color: white; font-weight: 700; margin-bottom: 3px; }
  .header-text .meta { font-size: 11px; color: rgba(212,228,255,0.85); font-style: italic; }

  /* ── VERSE BANNER ── */
  .verse-banner { background: linear-gradient(90deg, #0d2260 0%, #1A3A8F 100%); border-radius: 12px; padding: 14px 24px; margin-bottom: 18px; display: flex; align-items: flex-start; gap: 14px; box-shadow: var(--shadow); }
  .verse-icon { font-size: 28px; flex-shrink: 0; margin-top: 2px; }
  .verse-text { color: white; }
  .verse-ref  { font-size: 10px; font-weight: 900; color: var(--yellow); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .verse-quote { font-size: 13px; font-style: italic; line-height: 1.55; color: rgba(220,230,255,0.95); }

  /* ── SCORE PANEL ── */
  .score-panel { background: white; border-radius: 14px; padding: 20px 28px; margin-bottom: 20px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 24px; flex-wrap: wrap; border-top: 4px solid var(--yellow); }
  .student-info { flex: 1; min-width: 300px; }
  .student-info h3 { font-size: 12px; font-weight: 900; color: var(--blue); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-field label { font-size: 11px; font-weight: 700; color: #888; display: block; margin-bottom: 3px; }
  .info-field input { width: 100%; border: 1.5px solid var(--gray2); border-radius: 6px; padding: 6px 10px; font-family: 'Nunito', sans-serif; font-size: 12px; color: var(--dark); transition: border-color 0.2s; }
  .info-field input:focus { outline: none; border-color: var(--blue); }
  .score-display { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .score-box { text-align: center; padding: 16px 20px; border-radius: 12px; min-width: 110px; }
  .score-box.total { background: var(--blue); }
  .score-box.grade { background: var(--green); }
  .score-box.pending { background: var(--gray); }
  .score-box .val { font-size: 36px; font-weight: 900; line-height: 1; color: white; display: block; }
  .score-box.pending .val { color: #aaa; }
  .score-box .lbl { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.75); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: block; }
  .score-box.pending .lbl { color: #bbb; }
  .progress-wrap { flex: 1; min-width: 200px; }
  .progress-wrap label { font-size: 11px; font-weight: 800; color: #888; display: block; margin-bottom: 6px; }
  .progress-bar-bg { height: 10px; background: var(--gray2); border-radius: 99px; overflow: hidden; }
  .progress-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--blue), var(--green)); border-radius: 99px; transition: width 0.4s ease, background 0.4s ease; }

  /* ── LEGEND ── */
  .legend { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; }
  .legend-dot { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }

  /* ── GRADE SCALE ── */
  .scale-bar { display: flex; border-radius: 10px; overflow: hidden; margin-bottom: 20px; box-shadow: var(--shadow); }
  .scale-item { flex: 1; padding: 10px 6px; text-align: center; color: white; }
  .scale-item .sv { font-size: 15px; font-weight: 900; display: block; }
  .scale-item .sl { font-size: 9px; font-weight: 700; opacity: 0.85; display: block; margin-top: 1px; }

  /* ── RUBRIC TABLE ── */
  .rubric-wrap { background: white; border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); margin-bottom: 20px; }
  .rubric-table { width: 100%; border-collapse: collapse; }
  .rubric-table thead th { padding: 12px 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; color: white; text-align: center; }
  .rubric-table thead th.th-criteria { background: var(--blue); text-align: left; width: 14%; }
  .rubric-table thead th.th-5 { background: #1A6B3A; }
  .rubric-table thead th.th-4 { background: #2B8A45; }
  .rubric-table thead th.th-3 { background: #B8860B; }
  .rubric-table thead th.th-2 { background: #CC4E10; }
  .rubric-table thead th.th-1 { background: var(--red); }
  .rubric-table thead th.th-score { background: var(--blue2); width: 7%; }
  .score-badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 99px; padding: 1px 8px; font-size: 13px; font-weight: 900; margin-bottom: 2px; }
  .th-sub { font-size: 9px; font-weight: 600; opacity: 0.85; display: block; margin-top: 1px; }
  .rubric-table tbody tr { transition: background 0.15s; }
  .rubric-table tbody tr:nth-child(odd)  .td-criteria { background: #EEF2FB; }
  .rubric-table tbody tr:nth-child(even) .td-criteria { background: #E4EAF7; }
  .rubric-table tbody tr:nth-child(odd)  .td-score-col { background: #F0F0F0; }
  .rubric-table tbody tr:nth-child(even) .td-score-col { background: #E8E8E8; }
  .td-criteria { padding: 10px 12px; vertical-align: top; }
  .crit-name { font-size: 11px; font-weight: 900; color: var(--blue); margin-bottom: 3px; }
  .crit-desc { font-size: 10px; color: #777; font-style: italic; }
  .td-cell { padding: 6px; vertical-align: top; border-left: 1px solid rgba(0,0,0,0.05); }
  .td-score-col { padding: 10px 6px; text-align: center; vertical-align: middle; border-left: 2px solid rgba(0,0,0,0.08); }
  .row-score { font-size: 22px; font-weight: 900; color: #ccc; transition: color 0.3s, transform 0.3s; }
  .row-score.scored { transform: scale(1.1); }
  .score-cell { cursor: pointer; border-radius: 8px; padding: 8px 6px; transition: all 0.18s; border: 2px solid transparent; height: 100%; min-height: 70px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .score-cell:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
  .score-cell .cell-score { font-size: 18px; font-weight: 900; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.18s; }
  .score-cell .cell-text { font-size: 10px; line-height: 1.4; color: #444; text-align: center; }
  .lv5 .score-cell { background: rgba(26,107,58,0.06); }
  .lv5 .score-cell:hover { background: rgba(26,107,58,0.14); border-color: #1A6B3A; }
  .lv5 .score-cell .cell-score { color: #1A6B3A; background: rgba(26,107,58,0.1); }
  .lv5 .score-cell.selected { background: #1A6B3A; border-color: #1A6B3A; }
  .lv5 .score-cell.selected .cell-score { background: rgba(255,255,255,0.25); color: white; }
  .lv5 .score-cell.selected .cell-text { color: rgba(255,255,255,0.9); }
  .lv4 .score-cell { background: rgba(43,138,69,0.06); }
  .lv4 .score-cell:hover { background: rgba(43,138,69,0.14); border-color: #2B8A45; }
  .lv4 .score-cell .cell-score { color: #2B8A45; background: rgba(43,138,69,0.1); }
  .lv4 .score-cell.selected { background: #2B8A45; border-color: #2B8A45; }
  .lv4 .score-cell.selected .cell-score { background: rgba(255,255,255,0.25); color: white; }
  .lv4 .score-cell.selected .cell-text { color: rgba(255,255,255,0.9); }
  .lv3 .score-cell { background: rgba(184,134,11,0.06); }
  .lv3 .score-cell:hover { background: rgba(184,134,11,0.14); border-color: #B8860B; }
  .lv3 .score-cell .cell-score { color: #B8860B; background: rgba(184,134,11,0.1); }
  .lv3 .score-cell.selected { background: #B8860B; border-color: #B8860B; }
  .lv3 .score-cell.selected .cell-score { background: rgba(255,255,255,0.25); color: white; }
  .lv3 .score-cell.selected .cell-text { color: rgba(255,255,255,0.9); }
  .lv2 .score-cell { background: rgba(204,78,16,0.06); }
  .lv2 .score-cell:hover { background: rgba(204,78,16,0.14); border-color: #CC4E10; }
  .lv2 .score-cell .cell-score { color: #CC4E10; background: rgba(204,78,16,0.1); }
  .lv2 .score-cell.selected { background: #CC4E10; border-color: #CC4E10; }
  .lv2 .score-cell.selected .cell-score { background: rgba(255,255,255,0.25); color: white; }
  .lv2 .score-cell.selected .cell-text { color: rgba(255,255,255,0.9); }
  .lv1 .score-cell { background: rgba(204,31,39,0.06); }
  .lv1 .score-cell:hover { background: rgba(204,31,39,0.14); border-color: var(--red); }
  .lv1 .score-cell .cell-score { color: var(--red); background: rgba(204,31,39,0.1); }
  .lv1 .score-cell.selected { background: var(--red); border-color: var(--red); }
  .lv1 .score-cell.selected .cell-score { background: rgba(255,255,255,0.25); color: white; }
  .lv1 .score-cell.selected .cell-text { color: rgba(255,255,255,0.9); }

  /* ── RESULT PANEL ── */
  .result-panel { background: white; border-radius: 14px; padding: 22px 28px; box-shadow: var(--shadow); margin-bottom: 20px; display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
  .result-grade { text-align: center; flex-shrink: 0; padding: 16px 24px; border-radius: 12px; background: var(--gray); min-width: 140px; transition: background 0.4s; }
  .result-grade .grade-num { font-size: 56px; font-weight: 900; line-height: 1; color: #ccc; transition: color 0.4s; }
  .result-grade .grade-lbl { font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .result-grade .grade-desc { font-size: 12px; font-weight: 700; color: #bbb; margin-top: 4px; }
  .result-breakdown { flex: 1; min-width: 260px; }
  .result-breakdown h3 { font-size: 12px; font-weight: 900; color: var(--blue); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .breakdown-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .breakdown-name { font-size: 11px; font-weight: 700; color: var(--dark); width: 170px; flex-shrink: 0; }
  .breakdown-bar-bg { flex: 1; height: 8px; background: var(--gray2); border-radius: 99px; overflow: hidden; }
  .breakdown-bar-fill { height: 100%; width: 0%; border-radius: 99px; transition: width 0.4s, background 0.4s; }
  .breakdown-val { font-size: 12px; font-weight: 900; width: 28px; text-align: right; color: #aaa; flex-shrink: 0; }
  .result-comments { flex: 1; min-width: 220px; }
  .result-comments h3 { font-size: 12px; font-weight: 900; color: var(--blue); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .result-comments textarea { width: 100%; border: 1.5px solid var(--gray2); border-radius: 8px; padding: 10px 12px; font-family: 'Nunito', sans-serif; font-size: 12px; resize: vertical; min-height: 120px; color: var(--dark); transition: border-color 0.2s; }
  .result-comments textarea:focus { outline: none; border-color: var(--blue); }

  /* ── ACTIONS ── */
  .actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 8px; }
  .btn { padding: 10px 22px; border: none; border-radius: 8px; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.18s; }
  .btn-primary { background: var(--blue); color: white; }
  .btn-primary:hover { background: #0d2260; transform: translateY(-1px); }
  .btn-secondary { background: var(--gray2); color: var(--dark); }
  .btn-secondary:hover { background: #d0d0d0; }
  .btn-danger { background: rgba(204,31,39,0.1); color: var(--red); }
  .btn-danger:hover { background: rgba(204,31,39,0.2); }

  /* ── PRINT ── */
  @media print {
    @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { background: white !important; padding: 0 !important; margin: 0 !important; }
    .page { max-width: 100% !important; padding: 0 !important; }
    .actions, .score-panel, .scale-bar, .legend, .verse-banner { display: none !important; }
    .header { border-radius: 8px !important; margin-bottom: 5px !important; box-shadow: none !important; page-break-inside: avoid; }
    .header::before { display: none !important; }
    .header-bar { height: 3px !important; }
    .header-inner { padding: 8px 14px !important; gap: 8px !important; }
    .header-logo { width: 36px !important; height: 36px !important; }
    .header-text h1 { font-size: 14px !important; margin-bottom: 2px !important; }
    .header-text .sub { font-size: 8px !important; margin-bottom: 1px !important; }
    .header-text .meta { font-size: 7px !important; }
    .print-info { display: grid !important; grid-template-columns: 2fr 1.4fr 0.9fr 0.7fr 0.7fr !important; gap: 0 !important; background: #EEF2FB !important; border: 1.5px solid #1A3A8F !important; border-radius: 7px !important; overflow: hidden !important; margin-bottom: 5px !important; }
    .print-info-field { display: flex !important; flex-direction: column !important; padding: 5px 8px !important; border-right: 1px solid rgba(26,58,143,0.2) !important; }
    .print-info-field:last-child { border-right: none !important; }
    .print-info-field .pi-label { font-size: 6px !important; font-weight: 900 !important; color: #1A3A8F !important; text-transform: uppercase !important; letter-spacing: 0.4px !important; margin-bottom: 3px !important; }
    .print-info-field .pi-value { font-size: 8.5px !important; font-weight: 900 !important; color: #1A1A2E !important; border-bottom: 1.5px solid #1A3A8F !important; min-height: 14px !important; padding: 1px 3px !important; background: white !important; }
    .rubric-wrap { box-shadow: none !important; border-radius: 7px !important; overflow: hidden !important; margin-bottom: 5px !important; border: 1px solid rgba(26,58,143,0.25) !important; }
    .rubric-table { font-size: 6.5px !important; }
    .rubric-table thead th { padding: 5px 3px !important; font-size: 7px !important; letter-spacing: 0.2px !important; }
    .score-badge { font-size: 10px !important; padding: 0 5px !important; }
    .th-sub { font-size: 6px !important; }
    .rubric-table tbody tr { page-break-inside: avoid !important; }
    .td-criteria { padding: 4px 5px !important; width: 12% !important; }
    .crit-name { font-size: 7px !important; margin-bottom: 1px !important; line-height: 1.2 !important; }
    .crit-desc { font-size: 6px !important; line-height: 1.2 !important; }
    .td-cell { padding: 3px 3px !important; }
    .td-score-col { padding: 3px 2px !important; }
    .score-cell { min-height: 38px !important; padding: 3px 2px !important; border-radius: 4px !important; border-width: 1.5px !important; transform: none !important; box-shadow: none !important; gap: 2px !important; }
    .score-cell .cell-score { font-size: 10px !important; width: 18px !important; height: 18px !important; }
    .score-cell .cell-text { font-size: 5.8px !important; line-height: 1.25 !important; display: block !important; }
    .lv5 .score-cell.selected { background: #1A6B3A !important; border-color: #1A6B3A !important; }
    .lv4 .score-cell.selected { background: #2B8A45 !important; border-color: #2B8A45 !important; }
    .lv3 .score-cell.selected { background: #B8860B !important; border-color: #B8860B !important; }
    .lv2 .score-cell.selected { background: #CC4E10 !important; border-color: #CC4E10 !important; }
    .lv1 .score-cell.selected { background: #CC1F27 !important; border-color: #CC1F27 !important; }
    .score-cell.selected .cell-text { color: rgba(255,255,255,0.95) !important; }
    .score-cell.selected .cell-score { color: white !important; background: rgba(255,255,255,0.2) !important; }
    .row-score { font-size: 14px !important; }
    .lv5 .score-cell:not(.selected) { background: rgba(26,107,58,0.06) !important; }
    .lv4 .score-cell:not(.selected) { background: rgba(43,138,69,0.06) !important; }
    .lv3 .score-cell:not(.selected) { background: rgba(184,134,11,0.06) !important; }
    .lv2 .score-cell:not(.selected) { background: rgba(204,78,16,0.06) !important; }
    .lv1 .score-cell:not(.selected) { background: rgba(204,31,39,0.06) !important; }
    .result-panel { display: flex !important; flex-wrap: nowrap !important; gap: 10px !important; box-shadow: none !important; border: 1.5px solid #1A3A8F !important; border-radius: 8px !important; padding: 10px 12px !important; margin-bottom: 0 !important; page-break-inside: avoid !important; align-items: stretch !important; }
    .result-grade { flex-shrink: 0 !important; min-width: 80px !important; max-width: 90px !important; padding: 8px 10px !important; }
    .result-grade .grade-num { font-size: 34px !important; }
    .result-grade .grade-lbl { font-size: 7px !important; }
    .result-grade .grade-desc { font-size: 7px !important; }
    .result-breakdown { flex: 1.2 !important; min-width: 0 !important; }
    .result-breakdown h3 { font-size: 7px !important; margin-bottom: 5px !important; }
    .breakdown-row { margin-bottom: 4px !important; gap: 5px !important; }
    .breakdown-name { font-size: 7px !important; width: 115px !important; }
    .breakdown-bar-bg { height: 6px !important; }
    .breakdown-val { font-size: 8px !important; width: 20px !important; }
    .result-comments { flex: 1.4 !important; min-width: 0 !important; }
    .result-comments h3 { font-size: 7px !important; margin-bottom: 5px !important; }
    .result-comments textarea { font-size: 7.5px !important; min-height: 90px !important; border: 1px solid #ccc !important; border-radius: 5px !important; padding: 6px 8px !important; resize: none !important; }
    .result-panel > div:last-child { display: none !important; }
    .print-footer { display: block !important; margin-top: 4px !important; text-align: center !important; font-size: 6px !important; color: #aaa !important; }
  }

  .print-info   { display: none; }
  .print-footer { display: none; }
  .pi-value { font-family: 'Nunito', sans-serif; font-size: 9px; font-weight: 900; color: #1A1A2E; }

  @media (max-width: 700px) {
    .rubric-table thead th { font-size: 9px; padding: 8px 4px; }
    .score-cell .cell-text { display: none; }
    .info-grid { grid-template-columns: 1fr; }
  }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(245,195,0,0.5); }
    70%  { box-shadow: 0 0 0 8px rgba(245,195,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(245,195,0,0); }
  }
  .score-box.updated { animation: pulse 0.6s ease; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-bar"></div>
    <div class="header-inner">
      ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="${schoolName}">` : ''}
      <div style="flex:1;">
        <div class="header-text">
          <div style="font-size:10px;font-weight:800;color:rgba(245,195,0,0.8);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${schoolName} · 2026</div>
          <h1>${skillIcon} ${title}${skill ? ' — ' + skill.charAt(0).toUpperCase() + skill.slice(1) + ' Rubric' : ' — Rúbrica'}</h1>
          <p class="sub">${subject}${grade ? ' · ' + grade : ''}${section ? ' ' + section : ''}${target_indicador ? ' · ' + target_indicador.slice(0, 80) + (target_indicador.length > 80 ? '…' : '') : ''}</p>
          <p class="meta">${biblical_principle ? '✝️ ' + biblical_principle + (dueFmt ? ' · ' : '') : ''}${dueFmt ? 'Entrega: ' + dueFmt : ''}</p>
        </div>
      </div>
    </div>
    <div class="header-bar"></div>
  </div>

  ${yearVerse ? `
  <!-- VERSE BANNER -->
  <div class="verse-banner">
    <div class="verse-icon">✝️</div>
    <div class="verse-text">
      ${yearVerseRef ? `<div class="verse-ref">Versículo del Año · ${yearVerseRef}</div>` : ''}
      <div class="verse-quote">"${yearVerse}"</div>
    </div>
  </div>` : ''}

  <!-- GRADE SCALE -->
  <div class="scale-bar">
    <div class="scale-item" style="background:#1A6B3A;"><span class="sv">5.0</span><span class="sl">Excellent</span></div>
    <div class="scale-item" style="background:#2B8A45;"><span class="sv">4.0–4.9</span><span class="sl">Good</span></div>
    <div class="scale-item" style="background:#B8860B;"><span class="sv">3.0–3.9</span><span class="sv">Satisfactory</span></div>
    <div class="scale-item" style="background:#CC4E10;"><span class="sv">2.0–2.9</span><span class="sl">Developing</span></div>
    <div class="scale-item" style="background:#CC1F27;"><span class="sv">1.0–1.9</span><span class="sl">Beginning</span></div>
  </div>

  <!-- SCORE PANEL -->
  <div class="score-panel">
    <div class="student-info">
      <h3>Información del Estudiante</h3>
      <div class="info-grid">
        <div class="info-field" style="grid-column:1/-1;">
          <label>Nombre del estudiante / Student name</label>
          <input type="text" id="student-name" placeholder="APELLIDO, Nombre" style="text-transform:uppercase;">
        </div>
        <div class="info-field">
          <label>Fecha de evaluación</label>
          <input type="date" id="eval-date">
        </div>
        <div class="info-field">
          <label>Docente</label>
          <input type="text" id="teacher-name" placeholder="Nombre del docente">
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
      <div class="score-display">
        <div class="score-box total pending" id="box-total">
          <span class="val" id="total-raw">—</span>
          <span class="lbl">Total / ${totalMax}</span>
        </div>
        <div class="score-box grade pending" id="box-grade">
          <span class="val" id="total-grade">—</span>
          <span class="lbl">Nota Final</span>
        </div>
      </div>
      <div class="progress-wrap" style="width:100%;">
        <label>Criterios evaluados: <span id="count-done">0</span> / ${rubric.length}</label>
        <div class="progress-bar-bg"><div class="progress-bar-fill" id="prog-bar"></div></div>
      </div>
    </div>
  </div>

  <!-- PRINT-ONLY INFO -->
  <div class="print-info">
    <div class="print-info-field" style="flex:2;">
      <span class="pi-label">Nombre del estudiante</span>
      <div class="pi-value" id="pi-name">&nbsp;</div>
    </div>
    <div class="print-info-field" style="flex:1.2;">
      <span class="pi-label">Docente</span>
      <div class="pi-value" id="pi-teacher">&nbsp;</div>
    </div>
    <div class="print-info-field" style="flex:0.8;">
      <span class="pi-label">Fecha</span>
      <div class="pi-value" id="pi-date">&nbsp;</div>
    </div>
    <div class="print-info-field" style="flex:0.6;">
      <span class="pi-label">Total / ${totalMax}</span>
      <div class="pi-value" id="pi-total">&nbsp;</div>
    </div>
    <div class="print-info-field" style="flex:0.6;">
      <span class="pi-label">Nota Final</span>
      <div class="pi-value" id="pi-grade">&nbsp;</div>
    </div>
  </div>

  <!-- LEGEND -->
  <div class="legend">
    <span style="font-size:11px;font-weight:800;color:#888;margin-right:4px;">Niveles:</span>
    <div class="legend-item"><div class="legend-dot" style="background:#1A6B3A;"></div>5 — Excellent</div>
    <div class="legend-item"><div class="legend-dot" style="background:#2B8A45;"></div>4 — Good</div>
    <div class="legend-item"><div class="legend-dot" style="background:#B8860B;"></div>3 — Satisfactory</div>
    <div class="legend-item"><div class="legend-dot" style="background:#CC4E10;"></div>2 — Developing</div>
    <div class="legend-item"><div class="legend-dot" style="background:#CC1F27;"></div>1 — Beginning</div>
  </div>

  <!-- RUBRIC TABLE -->
  <div class="rubric-wrap">
    <table class="rubric-table" id="rubric">
      <thead>
        <tr>
          <th class="th-criteria">Criterio</th>
          <th class="th-5"><span class="score-badge">5</span><span class="th-sub">Excellent</span></th>
          <th class="th-4"><span class="score-badge">4</span><span class="th-sub">Good</span></th>
          <th class="th-3"><span class="score-badge">3</span><span class="th-sub">Satisfactory</span></th>
          <th class="th-2"><span class="score-badge">2</span><span class="th-sub">Developing</span></th>
          <th class="th-1"><span class="score-badge">1</span><span class="th-sub">Beginning</span></th>
          <th class="th-score">Score</th>
        </tr>
      </thead>
      <tbody id="rubric-body"></tbody>
    </table>
  </div>

  <!-- RESULT PANEL -->
  <div class="result-panel">
    <div class="result-grade" id="grade-box">
      <div class="grade-num" id="grade-big">—</div>
      <div class="grade-lbl">Nota Final</div>
      <div class="grade-desc" id="grade-desc">Evalúa todos los criterios</div>
    </div>
    <div class="result-breakdown">
      <h3>Desglose por Criterio</h3>
      <div id="breakdown-list"></div>
    </div>
    <div class="result-comments">
      <h3>Comentarios del Docente</h3>
      <textarea id="comments" placeholder="Escribe tu retroalimentación aquí...&#10;&#10;Fortalezas:&#10;Aspectos a mejorar:&#10;Recomendación:"></textarea>
    </div>
    <div style="min-width:180px;flex-shrink:0;">
      <h3 style="font-size:12px;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Override / Ajuste</h3>
      <div style="background:#FFFDF0;border:2px solid var(--yellow);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Nota calculada</div>
        <div id="calc-display" style="font-size:24px;font-weight:900;color:#ccc;margin-bottom:10px;transition:color 0.3s;">—</div>
        <div style="width:100%;height:1px;background:var(--gray2);margin-bottom:10px;"></div>
        <div style="font-size:10px;font-weight:800;color:var(--blue);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Nota definitiva</div>
        <input type="number" id="override-grade" min="1.0" max="5.0" step="0.1" placeholder="ej. 4.5" oninput="applyOverride()"
          style="width:100%;border:2px solid var(--yellow);border-radius:8px;padding:10px;font-family:'Nunito',sans-serif;font-size:26px;font-weight:900;color:var(--blue);text-align:center;background:white;outline:none;"
          onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--yellow)'">
        <div style="font-size:10px;color:#888;margin-top:6px;font-style:italic;">Escala 1.0 – 5.0</div>
        <button onclick="clearOverride()" style="margin-top:10px;width:100%;padding:7px;border:none;border-radius:6px;background:rgba(204,31,39,0.08);color:var(--red);font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;cursor:pointer;">✕ Limpiar override</button>
      </div>
    </div>
  </div>

  <!-- PRINT FOOTER -->
  <div class="print-footer">
    Nota final = (Total / ${totalMax}) × 4 + 1 &nbsp;·&nbsp; Escala 1.0 – 5.0 &nbsp;·&nbsp;
    ${schoolName} · ${subject}${grade ? ' · ' + grade : ''}${section ? ' ' + section : ''} · ${title} · 2026
  </div>

  <!-- ACTIONS -->
  <div class="actions">
    <button class="btn btn-danger" onclick="resetAll()">🔄 Reiniciar</button>
    <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimir / PDF</button>
    <button class="btn btn-primary" onclick="copyResults()">📋 Copiar resultados</button>
  </div>

</div>

<script>
const criteria = ${criteriaJSON};
const TOTAL_MAX = ${totalMax};
const scores = {};

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const tbody = document.getElementById('rubric-body');
const lvClasses = ['lv5','lv4','lv3','lv2','lv1'];
const lvScores  = [5, 4, 3, 2, 1];
const lvColors  = ['#1A6B3A','#2B8A45','#B8860B','#CC4E10','#CC1F27'];

criteria.forEach((c, ci) => {
  const tr = document.createElement('tr');
  const tdC = document.createElement('td');
  tdC.className = 'td-criteria';
  tdC.innerHTML = '<div class="crit-name">' + esc(c.name) + '</div><div class="crit-desc">' + esc(c.desc) + '</div>';
  tr.appendChild(tdC);

  lvScores.forEach((lv, li) => {
    const td = document.createElement('td');
    td.className = 'td-cell ' + lvClasses[li];
    const cell = document.createElement('div');
    cell.className = 'score-cell';
    cell.dataset.cid = c.id;
    cell.dataset.score = lv;
    cell.innerHTML =
      '<div class="cell-score">' + lv + '</div>' +
      '<div class="cell-text">' + esc(c.levels[li]) + '</div>';
    cell.addEventListener('click', () => selectScore(c.id, lv, ci));
    td.appendChild(cell);
    tr.appendChild(td);
  });

  const tdS = document.createElement('td');
  tdS.className = 'td-score-col';
  tdS.innerHTML = '<div class="row-score" id="rs-' + esc(c.id) + '">—</div>';
  tr.appendChild(tdS);
  tbody.appendChild(tr);
});

// Breakdown list
const breakdownEl = document.getElementById('breakdown-list');
criteria.forEach(c => {
  const row = document.createElement('div');
  row.className = 'breakdown-row';
  row.innerHTML =
    '<div class="breakdown-name">' + esc(c.name) + '</div>' +
    '<div class="breakdown-bar-bg"><div class="breakdown-bar-fill" id="bb-' + esc(c.id) + '"></div></div>' +
    '<div class="breakdown-val" id="bv-' + esc(c.id) + '">—</div>';
  breakdownEl.appendChild(row);
});

function selectScore(cid, score, ci) {
  scores[cid] = score;
  document.querySelectorAll('[data-cid="' + cid + '"]').forEach(el => el.classList.remove('selected'));
  const selected = document.querySelector('[data-cid="' + cid + '"][data-score="' + score + '"]');
  if (selected) selected.classList.add('selected');
  const rs = document.getElementById('rs-' + cid);
  if (rs) { rs.textContent = score; rs.className = 'row-score scored'; rs.style.color = lvColors[lvScores.indexOf(score)]; }
  updateTotals();
}

function updateTotals() {
  const keys = Object.keys(scores);
  const done = keys.length;
  const total = keys.reduce((sum, k) => sum + scores[k], 0);
  const pct = done / criteria.length;
  const progBar = document.getElementById('prog-bar');
  if (progBar) progBar.style.width = (pct * 100) + '%';
  document.getElementById('count-done').textContent = done;

  criteria.forEach(c => {
    const bv = document.getElementById('bv-' + c.id);
    const bb = document.getElementById('bb-' + c.id);
    if (bv) bv.textContent = scores[c.id] !== undefined ? scores[c.id] : '—';
    if (bv) bv.style.color = scores[c.id] !== undefined ? lvColors[lvScores.indexOf(scores[c.id])] : '#aaa';
    if (bb) { bb.style.width = (scores[c.id] !== undefined ? scores[c.id] / 5 * 100 : 0) + '%'; bb.style.background = scores[c.id] !== undefined ? lvColors[lvScores.indexOf(scores[c.id])] : '#ccc'; }
  });

  const boxTotal = document.getElementById('box-total');
  const boxGrade = document.getElementById('box-grade');
  const totalRaw = document.getElementById('total-raw');
  const totalGrade = document.getElementById('total-grade');
  const calcDisplay = document.getElementById('calc-display');
  const gradeBig = document.getElementById('grade-big');
  const gradeBox = document.getElementById('grade-box');
  const gradeDesc = document.getElementById('grade-desc');

  if (done === criteria.length) {
    const grade = Math.round(((total / TOTAL_MAX) * 4 + 1) * 10) / 10;
    if (totalRaw)   totalRaw.textContent   = total;
    if (totalGrade) totalGrade.textContent = grade.toFixed(1);
    if (calcDisplay) calcDisplay.textContent = grade.toFixed(1);
    if (calcDisplay) calcDisplay.style.color  = gradeColor(grade);
    if (gradeBig) { gradeBig.textContent = grade.toFixed(1); gradeBig.style.color = gradeColor(grade); }
    if (gradeDesc) gradeDesc.textContent = gradeLabel(grade);
    if (boxTotal) { boxTotal.classList.remove('pending'); boxTotal.classList.add('updated'); setTimeout(() => boxTotal.classList.remove('updated'), 700); }
    if (boxGrade) { boxGrade.classList.remove('pending'); boxGrade.style.background = gradeColor(grade); }
    if (gradeBox) { gradeBox.style.background = gradeColor(grade) + '15'; }
    document.getElementById('pi-total').textContent = total + '/' + TOTAL_MAX;
    document.getElementById('pi-grade').textContent = grade.toFixed(1);
  } else {
    if (totalRaw)   totalRaw.textContent   = done > 0 ? total : '—';
    if (totalGrade) totalGrade.textContent = '—';
    if (calcDisplay) calcDisplay.textContent = '—';
    if (gradeBig) { gradeBig.textContent = '—'; gradeBig.style.color = '#ccc'; }
    if (gradeDesc) gradeDesc.textContent = 'Evalúa todos los criterios';
    if (boxGrade) { boxGrade.classList.add('pending'); boxGrade.style.background = ''; }
  }
}

function gradeColor(g) {
  if (g >= 4.5) return '#1A6B3A';
  if (g >= 3.5) return '#2B8A45';
  if (g >= 3.0) return '#B8860B';
  if (g >= 2.0) return '#CC4E10';
  return '#CC1F27';
}
function gradeLabel(g) {
  if (g >= 4.5) return 'Excelente';
  if (g >= 3.5) return 'Bueno';
  if (g >= 3.0) return 'Satisfactorio';
  if (g >= 2.0) return 'En Desarrollo';
  return 'Inicial';
}

function applyOverride() {
  const v = parseFloat(document.getElementById('override-grade').value);
  if (isNaN(v) || v < 1 || v > 5) return;
  const grade = Math.round(v * 10) / 10;
  const gradeBig = document.getElementById('grade-big');
  const totalGrade = document.getElementById('total-grade');
  const gradeBox = document.getElementById('grade-box');
  const gradeDesc = document.getElementById('grade-desc');
  if (gradeBig) { gradeBig.textContent = grade.toFixed(1); gradeBig.style.color = gradeColor(grade); }
  if (totalGrade) totalGrade.textContent = grade.toFixed(1);
  if (gradeBox) gradeBox.style.background = gradeColor(grade) + '15';
  if (gradeDesc) gradeDesc.textContent = gradeLabel(grade) + ' (ajustado)';
  document.getElementById('pi-grade').textContent = grade.toFixed(1) + '*';
}

function clearOverride() {
  document.getElementById('override-grade').value = '';
  updateTotals();
}

function resetAll() {
  if (!confirm('¿Reiniciar todas las calificaciones?')) return;
  Object.keys(scores).forEach(k => delete scores[k]);
  document.querySelectorAll('.score-cell').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.row-score').forEach(el => { el.textContent = '—'; el.className = 'row-score'; el.style.color = ''; });
  document.getElementById('override-grade').value = '';
  document.getElementById('comments').value = '';
  updateTotals();
}

function copyResults() {
  const name = document.getElementById('student-name').value || '(sin nombre)';
  const teacher = document.getElementById('teacher-name').value || '';
  const comments = document.getElementById('comments').value;
  const grade = document.getElementById('total-grade').textContent;
  const total = document.getElementById('total-raw').textContent;
  let text = '📊 RÚBRICA — ${title.replace(/'/g, "\\'")}\\n';
  text += '${subject}${grade ? ' · ' + grade : ''}${section ? ' ' + section : ''}\\n';
  text += 'Estudiante: ' + name + '\\n';
  if (teacher) text += 'Docente: ' + teacher + '\\n';
  text += '\\nCRITERIOS:\\n';
  criteria.forEach(c => { text += '  ' + c.name + ': ' + (scores[c.id] !== undefined ? scores[c.id] : '—') + '/5\\n'; });
  text += '\\nTotal: ' + total + '/' + TOTAL_MAX;
  text += '\\nNota Final: ' + grade;
  if (comments) text += '\\n\\nComentarios:\\n' + comments;
  navigator.clipboard.writeText(text).then(() => alert('✅ Resultados copiados al portapapeles')).catch(() => alert('No se pudo copiar. Usa Ctrl+C.'));
}

// Sync print fields
document.getElementById('student-name').addEventListener('input', e => { document.getElementById('pi-name').textContent = e.target.value || '\\u00a0'; });
document.getElementById('teacher-name').addEventListener('input', e => { document.getElementById('pi-teacher').textContent = e.target.value || '\\u00a0'; });
document.getElementById('eval-date').addEventListener('input', e => {
  const d = e.target.value ? new Date(e.target.value + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '\\u00a0';
  document.getElementById('pi-date').textContent = d;
});
<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
