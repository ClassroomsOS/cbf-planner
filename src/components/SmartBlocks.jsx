import { useState, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import { suggestSmartBlock } from '../utils/AIAssistant'
import { useToast } from '../context/ToastContext'

// ── Block type definitions ────────────────────────────────────────────────────
export const BLOCK_TYPES = {
  DICTATION: {
    label: 'Dictation / Listening', icon: '🎧',
    desc:  'Lista de palabras o frases para dictado',
    color: '4BACC6',
    models: [
      { id: 'word-grid',  label: 'Word Grid',          sub: 'Vocabulario en cuadrícula numerada de 2 columnas' },
      { id: 'sentences',  label: 'Sentence Dictation',  sub: 'Oraciones numeradas con espacio para respuesta' },
    ],
  },
  QUIZ: {
    label: 'Quiz / Evaluación', icon: '📝',
    desc:  'Aviso de quiz con temas y formato',
    color: 'C0504D',
    models: [
      { id: 'topic-card', label: 'Topic Review Card', sub: 'Lista de temas con semáforo de preparación' },
      { id: 'format-box', label: 'Format Box',         sub: 'Estructura del quiz: tipos de preguntas y puntos' },
    ],
  },
  VOCAB: {
    label: 'Vocabulary List', icon: '📚',
    desc:  'Listado de vocabulario con definiciones y ejemplos',
    color: '9BBB59',
    models: [
      { id: 'cards',    label: 'Vocab Cards',   sub: 'Tabla: Palabra | Definición | Ejemplo' },
      { id: 'matching', label: 'Match Columns', sub: 'Dos columnas para emparejar término–significado' },
    ],
  },
  WORKSHOP: {
    label: 'Workshop / Stations', icon: '🛠️',
    desc:  'Día de taller con estaciones o roles de equipo',
    color: 'F79646',
    models: [
      { id: 'stations', label: 'Station Rotation', sub: 'Estaciones con tiempo y descripción' },
      { id: 'roles',    label: 'Team Roles',        sub: 'Roles de equipo asignados por grupo' },
    ],
  },
  SPEAKING: {
    label: 'Speaking Project', icon: '🎤',
    desc:  'Rúbrica o guía para presentación oral',
    color: '8064A2',
    models: [
      { id: 'rubric', label: 'Rúbrica',        sub: 'Criterios con descripción y puntaje' },
      { id: 'prep',   label: 'Prep Checklist', sub: 'Pasos numerados para preparar la presentación' },
    ],
  },
  NOTICE: {
    label: 'Announcement / Notice', icon: '📢',
    desc:  'Aviso importante: recordatorio, cambio de fecha, instrucción especial',
    color: '1F3864',
    models: [
      { id: 'banner', label: 'Banner',    sub: 'Aviso destacado de ancho completo con ícono' },
      { id: 'alert',  label: 'Alert Box', sub: 'Caja de alerta con nivel de prioridad' },
    ],
  },
  READING: {
    label: 'Reading Comprehension', icon: '📖',
    desc:  'Pasaje de lectura con preguntas abiertas o verdadero/falso',
    color: '17375E',
    models: [
      { id: 'comprehension', label: 'Open Questions', sub: 'Pasaje + preguntas con líneas de respuesta' },
      { id: 'true-false',    label: 'True / False',   sub: 'Pasaje + afirmaciones para marcar V/F' },
    ],
  },
  GRAMMAR: {
    label: 'Grammar Practice', icon: '✏️',
    desc:  'Ejercicios estructurales: completar espacios o elegir la forma correcta',
    color: '375623',
    models: [
      { id: 'fill-blank', label: 'Fill in the Blank', sub: 'Oraciones con espacio para completar (usa ___ en el texto)' },
      { id: 'choose',     label: 'Choose the Form',   sub: 'Seleccionar la opción correcta entre varias' },
    ],
  },
  EXIT_TICKET: {
    label: 'Exit Ticket', icon: '🚪',
    desc:  'Autoevaluación de salida: can-do statements o calificación 1–5',
    color: 'C55A11',
    models: [
      { id: 'can-do',  label: 'Can-Do Statements', sub: '"I can…" — el estudiante marca su nivel de logro' },
      { id: 'rating',  label: 'Self-Rating 1–5',    sub: 'El estudiante califica su comprensión del 1 al 5' },
    ],
  },
}

// ── Normalize VOCAB words from AI (handles alternative key names) ─────────────
function normalizeVocabWords(data) {
  const raw = data.words || data.vocabulary || data.word_list || data.items || []
  return raw.map(wd => {
    if (typeof wd === 'string') return { w: wd, d: '', e: '' }
    return {
      w: wd.w || wd.term   || wd.word  || wd.en   || '',
      d: wd.d || wd.definition || wd.meaning || wd.desc || '',
      e: wd.e || wd.example    || wd.context  || wd.in_context || '',
    }
  })
}

// ── Block preview HTML ────────────────────────────────────────────────────────
export function blockPreviewHTML(b) {
  const { type, model, data } = b
  if (!data) return '<span style="color:#aaa">—</span>'

  if (type === 'DICTATION') {
    if (model === 'word-grid') {
      return `<div style="font-size:10px;color:#555;margin-bottom:6px;font-style:italic">${data.instructions||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          ${(data.words||[]).map((w,i) => `
            <div style="display:flex;gap:6px;align-items:center;font-size:11px;border:1px solid #eee;border-radius:3px;padding:3px 6px">
              <span style="color:#4BACC6;font-weight:700;min-width:16px">${i+1}.</span>
              <span style="font-weight:600">${w}</span>
              <span style="flex:1;border-bottom:1px solid #ccc;margin:0 4px"></span>
            </div>`).join('')}
        </div>`
    }
    return `<div style="font-size:10px;color:#555;margin-bottom:6px;font-style:italic">${data.instructions||''}</div>`
      + (data.words||[]).map((s,i) => `<div style="font-size:11px;border-bottom:1px solid #eee;padding:5px 0">${i+1}. ${s} <span style="display:inline-block;width:200px;border-bottom:1px solid #ccc;margin-left:8px"></span></div>`).join('')
  }

  if (type === 'QUIZ') {
    const topics = Array.isArray(data.topics) ? data.topics.filter(Boolean) : (data.topics||'').split('\n').filter(Boolean)
    return `<div style="background:#fff0f0;border-left:3px solid #C0504D;padding:8px 12px;border-radius:0 4px 4px 0">
      <div style="font-weight:700;font-size:12px;color:#C0504D;margin-bottom:6px">📝 QUIZ — ${data.unit||''}${data.date?' · '+data.date:''}</div>
      ${topics.map(t => `<div style="display:flex;gap:8px;align-items:center;font-size:11px;padding:2px 0"><span style="color:#F79646">⬛</span>${t}</div>`).join('')}
      ${model==='format-box'&&data.format ? `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #eee;display:grid;grid-template-columns:1fr 1fr;gap:4px">
        ${data.format.split('\n').filter(Boolean).map(f => `<div style="background:#fff;border:1px solid #eee;border-radius:3px;padding:3px 8px;font-size:10px">${f}</div>`).join('')}
      </div>` : ''}
      ${data.note ? `<div style="margin-top:6px;font-size:10px;color:#888;font-style:italic">ℹ️ ${data.note}</div>` : ''}
    </div>`
  }

  if (type === 'VOCAB') {
    if (model === 'cards') {
      const words = normalizeVocabWords(data)
      return `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr style="background:#9BBB59;color:#fff">
          <th style="padding:4px 8px;text-align:left">Word</th>
          <th style="padding:4px 8px;text-align:left">Definition</th>
          <th style="padding:4px 8px;text-align:left">Example</th>
        </tr>
        ${words.map((wd,i) => `<tr style="background:${i%2?'#f9fff4':'#fff'};border-bottom:1px solid #eee">
          <td style="padding:4px 8px;font-weight:700">${wd.w}</td>
          <td style="padding:4px 8px">${wd.d}</td>
          <td style="padding:4px 8px;color:#666">${wd.e}</td>
        </tr>`).join('')}
      </table>`
    }
    const words = normalizeVocabWords(data)
    return `<table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:#9BBB59;color:#fff">
        <th style="padding:4px 8px;text-align:left;width:18%">TERMS</th>
        <th style="padding:4px 8px;text-align:left;width:42%">MEANINGS</th>
        <th style="padding:4px 8px;text-align:left;width:40%">IN CONTEXT</th>
      </tr>
      ${words.map((wd,i) => `<tr style="background:${i%2?'#f9fff4':'#fff'};border-bottom:1px solid #eee">
        <td style="padding:4px 8px;font-weight:700">${i+1}. ${wd.w}</td>
        <td style="padding:4px 8px">${wd.d||''}</td>
        <td style="padding:4px 8px;color:#555;font-style:italic">${wd.e||''}</td>
      </tr>`).join('')}
    </table>`
  }

  if (type === 'WORKSHOP') {
    const colors = ['#4F81BD','#F79646','#9BBB59','#8064A2','#4BACC6']
    if (model === 'stations') {
      return `<div style="display:flex;gap:6px;flex-wrap:wrap">
        ${(data.stations||[]).map((st,i) => `
          <div style="flex:1;min-width:120px;border:2px solid ${colors[i%colors.length]};border-radius:6px;overflow:hidden">
            <div style="background:${colors[i%colors.length]};color:#fff;padding:4px 8px;font-size:11px;font-weight:700">${st.name}</div>
            <div style="padding:6px 8px;font-size:10px"><div style="color:#888;margin-bottom:2px">⏱ ${st.time}</div><div>${st.desc}</div></div>
          </div>`).join('')}
      </div>`
    }
    const icons = ['👑','✍️','🗣️','🔍','🎨','🧪']
    return `<div style="font-size:11px">
      ${(data.roles||[]).map((r,i) => `
        <div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eee">
          <span style="font-size:16px">${icons[i%icons.length]}</span>
          <span><strong>${r.role}:</strong> ${r.task}</span>
        </div>`).join('')}
    </div>`
  }

  if (type === 'SPEAKING') {
    if (model === 'rubric') {
      const total = (data.criteria||[]).reduce((s,c) => s + (parseInt(c.pts)||0), 0)
      return `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr style="background:#8064A2;color:#fff">
          <th style="padding:4px 8px;text-align:left">Criterio</th>
          <th style="padding:4px 8px;text-align:right">Pts</th>
        </tr>
        ${(data.criteria||[]).map(c => `<tr style="border-bottom:1px solid #eee">
          <td style="padding:4px 8px">${c.name}</td>
          <td style="padding:4px 8px;text-align:right;font-weight:700">${c.pts}</td>
        </tr>`).join('')}
        <tr style="background:#f0eaff">
          <td style="padding:4px 8px;font-weight:700">TOTAL</td>
          <td style="padding:4px 8px;text-align:right;font-weight:700">${total}</td>
        </tr>
      </table>${data.date ? `<div style="font-size:10px;color:#888;margin-top:4px">📅 ${data.date}</div>` : ''}`
    }
    return `<div style="font-size:11px">
      ${(data.steps||[]).map((s,i) => `
        <div style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;border-bottom:1px solid #eee">
          <span style="color:#8064A2;font-weight:700;min-width:20px">${i+1}.</span>
          <span>${s}</span>
        </div>`).join('')}
      ${data.date ? `<div style="font-size:10px;color:#888;margin-top:4px">📅 ${data.date}</div>` : ''}
    </div>`
  }

  if (type === 'NOTICE') {
    const priority = data.priority || 'warning'
    const bg  = priority === 'danger' ? '#ffecec' : priority === 'info' ? '#e8f4ff' : '#FFF3CD'
    const brd = priority === 'danger' ? '#cc3333'  : priority === 'info' ? '#4BACC6'  : '#C9A84C'
    if (model === 'banner') {
      return `<div style="background:#1F3864;color:#fff;padding:10px 16px;border-radius:4px;text-align:center;font-size:12px;font-weight:700">
        ${data.icon||'📢'} ${data.title}
        ${data.message ? `<div style="font-size:11px;font-weight:400;opacity:.85;margin-top:4px">${data.message}</div>` : ''}
      </div>`
    }
    return `<div style="background:${bg};border-left:3px solid ${brd};padding:8px 12px;border-radius:0 4px 4px 0;font-size:11px">
      <strong>${data.icon||'⚠️'} ${data.title}</strong>
      ${data.message ? `<div style="margin-top:4px;color:#444">${data.message}</div>` : ''}
    </div>`
  }

  if (type === 'READING') {
    const passageBox = `<div style="font-size:11px;line-height:1.7;background:#f0f4ff;border-left:3px solid #17375E;padding:8px 10px;border-radius:0 4px 4px 0;margin-bottom:10px">${data.passage||'<em style="color:#aaa">Paste the reading passage here…</em>'}</div>`
    if (model === 'comprehension') {
      return passageBox + (data.questions||[]).map((q,i) => `
        <div style="margin-bottom:8px;font-size:11px">
          <div style="font-weight:600;margin-bottom:4px">${i+1}. ${q.q}</div>
          ${Array.from({length:q.lines||2}).map(()=>`<div style="border-bottom:1px solid #ccc;height:18px;margin-bottom:3px"></div>`).join('')}
        </div>`).join('')
    }
    return passageBox + `<table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:#17375E;color:#fff">
        <th style="padding:4px 8px;text-align:left">#</th>
        <th style="padding:4px 8px;text-align:left">Statement</th>
        <th style="padding:4px 8px;width:48px;text-align:center">T</th>
        <th style="padding:4px 8px;width:48px;text-align:center">F</th>
      </tr>
      ${(data.statements||[]).map((s,i)=>{
        const text = typeof s === 'string' ? s : (s?.s || '')
        return `<tr style="border-bottom:1px solid #eee">
          <td style="padding:4px 8px;color:#888">${i+1}</td>
          <td style="padding:4px 8px">${text}</td>
          <td style="padding:4px 8px;text-align:center">⬜</td>
          <td style="padding:4px 8px;text-align:center">⬜</td>
        </tr>`
      }).join('')}
    </table>`
  }

  if (type === 'GRAMMAR') {
    const hdr = `${data.grammar_point?`<div style="font-size:10px;font-weight:700;color:#375623;text-transform:uppercase;margin-bottom:4px">${data.grammar_point}</div>`:''}
      <div style="font-size:10px;color:#666;font-style:italic;margin-bottom:8px">${data.instructions||''}</div>`
    if (model === 'fill-blank') {
      return hdr + (data.sentences||[]).map((s,i)=>`
        <div style="font-size:11px;border:1px solid #e8f0e0;border-radius:3px;padding:5px 8px;margin-bottom:4px">
          <span style="color:#375623;font-weight:700;margin-right:4px">${i+1}.</span>
          ${(s.sent||'').replace(/___/g,'<span style="display:inline-block;min-width:60px;border-bottom:1.5px solid #375623;margin:0 4px">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>')}
        </div>`).join('')
    }
    return hdr + (data.items||[]).map((item,i)=>`
      <div style="font-size:11px;border:1px solid #e8f0e0;border-radius:3px;padding:6px 8px;margin-bottom:6px">
        <div style="margin-bottom:4px"><span style="color:#375623;font-weight:700">${i+1}.</span> ${item.sentence||''}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${(item.options||[]).map(o=>`<span style="font-size:10px;background:#f0f0f0;padding:2px 8px;border-radius:10px">${o}</span>`).join('')}
        </div>
      </div>`).join('')
  }

  if (type === 'EXIT_TICKET') {
    if (model === 'can-do') {
      return `<div style="background:#fff8e6;border:2px solid #C55A11;border-radius:6px;padding:10px">
        <div style="font-weight:700;font-size:12px;color:#C55A11;margin-bottom:8px">🚪 EXIT TICKET${data.date?' · '+data.date:''}</div>
        ${(data.skills||[]).map(s=>`<div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:5px 0;border-bottom:1px solid #ffe0b0">
          <span>I can <strong>${s}</strong></span>
          <div style="margin-left:auto;display:flex;gap:6px;font-size:18px">😊😐😕</div>
        </div>`).join('')}
      </div>`
    }
    return `<div style="background:#fff8e6;border:2px solid #C55A11;border-radius:6px;padding:10px">
      <div style="font-weight:700;font-size:12px;color:#C55A11;margin-bottom:8px">🚪 SELF-RATING${data.date?' · '+data.date:''}</div>
      ${(data.statements||[]).map((s,i)=>`<div style="margin-bottom:10px;font-size:11px">
        <div style="margin-bottom:5px">${i+1}. ${s}</div>
        <div style="display:flex;gap:6px">
          ${[1,2,3,4,5].map(n=>`<div style="width:28px;height:28px;border:2px solid #C55A11;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#C55A11">${n}</div>`).join('')}
        </div>
      </div>`).join('')}
    </div>`
  }

  return '<span style="color:#aaa">Vista previa no disponible</span>'
}

// ── Block interactive HTML (Layer 1 — exported HTML activities) ───────────────
// Returns an HTML string with a launch button + <dialog> + <script>.
// Returns null for block types with no interactive version.
export function blockInteractiveHTML(block, blockId) {
  const { type, model, data } = block
  if (!data) return null

  // Sanitize blockId to safe JS identifier
  const bid = blockId.replace(/[^a-zA-Z0-9_]/g, '_')
  const typeDef = BLOCK_TYPES[type] || {}
  const color = typeDef.color || '4F81BD'

  function dialog(title, body, footer) {
    const footerHtml = footer
      ? `<div class="sbd-f">${footer}</div>`
      : ''
    return `
<button onclick="document.getElementById('${bid}').showModal()" class="sbd-launch" style="background:#${color}">
  ▶ Realizar actividad
</button>
<dialog id="${bid}" class="sbd">
  <div class="sbd-h" style="background:#${color}">
    <span>${typeDef.icon || ''} ${title}</span>
    <button onclick="document.getElementById('${bid}').close()" class="sbd-close">✕</button>
  </div>
  <div class="sbd-b">${body}</div>
  ${footerHtml}
</dialog>`
  }

  // ── VOCAB matching ─────────────────────────────────────────────────────────
  if (type === 'VOCAB' && model === 'matching') {
    const words = normalizeVocabWords(data)
    if (!words.length) return null

    // Shuffle indices: rotate by ceil(n/3) (matches preview rotation)
    const shuffled = words.map((_, i) => i)
    const offset = Math.ceil(words.length / 3)
    for (let i = 0; i < offset; i++) shuffled.push(shuffled.shift())

    const body = `
      <div style="font-size:12px;margin-bottom:10px;color:#555;font-style:italic">
        Select the correct meaning for each term.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#9BBB59;color:#fff">
          <th style="padding:6px 8px;text-align:left;width:35%">Term</th>
          <th style="padding:6px 8px;text-align:left">Meaning</th>
        </tr>
        ${words.map((wd, i) => `
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:8px;font-weight:700">${i + 1}. ${wd.w}</td>
          <td style="padding:6px 8px">
            <select id="${bid}_s${i}" style="width:100%;padding:4px 8px;border:2px solid #ddd;border-radius:4px;font-size:12px">
              <option value="">— select —</option>
              ${shuffled.map(si => `<option value="${si}">${words[si].d}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('')}
      </table>
      <div id="${bid}_res" style="margin-top:10px;font-size:13px;font-weight:700"></div>`

    const footer = `
      <button onclick="${bid}_chk()" class="sbd-check">Verificar ✓</button>
      <button onclick="${bid}_rst()" class="sbd-reset">Reiniciar</button>`

    const script = `
<script>
function ${bid}_chk(){
  var w=${JSON.stringify(words)},ok=0;
  w.forEach(function(_,i){
    var s=document.getElementById('${bid}_s'+i);
    if(!s)return;
    if(parseInt(s.value)===i){s.style.borderColor='#9BBB59';s.style.background='#f9fff4';ok++;}
    else{s.style.borderColor='#C0504D';s.style.background='#fff0f0';}
  });
  var el=document.getElementById('${bid}_res'),pct=Math.round(ok/w.length*100);
  el.innerHTML=ok+'/'+w.length+' correct ('+pct+'%)';
  el.style.color=pct>=80?'#375623':pct>=50?'#F79646':'#C0504D';
}
function ${bid}_rst(){
  var w=${JSON.stringify(words)};
  w.forEach(function(_,i){var s=document.getElementById('${bid}_s'+i);if(s){s.value='';s.style.borderColor='#ddd';s.style.background='#fff';}});
  document.getElementById('${bid}_res').innerHTML='';
}
</script>`
    return dialog('VOCAB — Match Columns', body, footer) + script
  }

  // ── GRAMMAR fill-blank ────────────────────────────────────────────────────
  if (type === 'GRAMMAR' && model === 'fill-blank') {
    const sentences = data.sentences || []
    if (!sentences.length) return null

    const body = `
      ${data.grammar_point ? `<div style="font-size:11px;font-weight:700;color:#375623;text-transform:uppercase;margin-bottom:6px">${data.grammar_point}</div>` : ''}
      ${data.instructions ? `<div style="font-size:11px;color:#666;font-style:italic;margin-bottom:10px">${data.instructions}</div>` : ''}
      ${sentences.map((s, i) => {
        const withInput = (s.sent || '').replace(/___/g,
          `<input type="text" id="${bid}_i${i}" autocomplete="off"
            style="min-width:80px;border:none;border-bottom:2px solid #375623;padding:2px 6px;font-size:12px;outline:none;background:transparent">`)
        return `<div style="margin-bottom:10px;font-size:12px;padding:8px;border:1px solid #e8f0e0;border-radius:4px">
          <span style="color:#375623;font-weight:700;margin-right:6px">${i + 1}.</span>${withInput}
        </div>`
      }).join('')}
      <div id="${bid}_res" style="margin-top:8px;font-size:13px;font-weight:700"></div>`

    const footer = `
      <button onclick="${bid}_chk()" class="sbd-check">Verificar ✓</button>
      <button onclick="${bid}_rst()" class="sbd-reset">Reiniciar</button>`

    const script = `
<script>
function ${bid}_chk(){
  var s=${JSON.stringify(sentences)},ok=0;
  s.forEach(function(row,i){
    var inp=document.getElementById('${bid}_i'+i);if(!inp)return;
    var ans=(row.answer||'').trim().toLowerCase(),val=(inp.value||'').trim().toLowerCase();
    if(ans&&val===ans){inp.style.borderBottomColor='#9BBB59';inp.style.color='#375623';ok++;}
    else if(val){inp.style.borderBottomColor='#C0504D';inp.style.color='#C0504D';}
  });
  var el=document.getElementById('${bid}_res');
  el.innerHTML=ok+'/'+s.length+' correct';
  el.style.color=ok===s.length?'#375623':'#C0504D';
}
function ${bid}_rst(){
  var s=${JSON.stringify(sentences)};
  s.forEach(function(_,i){var inp=document.getElementById('${bid}_i'+i);if(inp){inp.value='';inp.style.borderBottomColor='#375623';inp.style.color='#222';}});
  document.getElementById('${bid}_res').innerHTML='';
}
</script>`
    return dialog('Grammar — Fill in the Blank', body, footer) + script
  }

  // ── GRAMMAR choose ────────────────────────────────────────────────────────
  if (type === 'GRAMMAR' && model === 'choose') {
    const items = data.items || []
    if (!items.length) return null

    const body = `
      ${data.grammar_point ? `<div style="font-size:11px;font-weight:700;color:#375623;text-transform:uppercase;margin-bottom:6px">${data.grammar_point}</div>` : ''}
      ${data.instructions ? `<div style="font-size:11px;color:#666;font-style:italic;margin-bottom:10px">${data.instructions}</div>` : ''}
      ${items.map((item, i) => `
        <div style="margin-bottom:12px;font-size:12px;padding:8px;border:1px solid #e8f0e0;border-radius:4px">
          <div style="margin-bottom:8px"><span style="color:#375623;font-weight:700">${i + 1}.</span> ${item.sentence || ''}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(item.options || []).map((o, j) => `
              <button id="${bid}_i${i}_${j}" onclick="${bid}_sel(${i},${j},${item.options.length})"
                style="padding:5px 14px;border:2px solid #ddd;border-radius:20px;font-size:12px;background:#f9f9f9;cursor:pointer">${o}</button>`
            ).join('')}
          </div>
        </div>`).join('')}
      <div id="${bid}_res" style="margin-top:8px;font-size:13px;font-weight:700"></div>`

    const footer = `
      <button onclick="${bid}_chk()" class="sbd-check">Verificar ✓</button>
      <button onclick="${bid}_rst()" class="sbd-reset">Reiniciar</button>`

    const script = `
<script>
var ${bid}_sel_map={};
function ${bid}_sel(i,j,tot){
  for(var k=0;k<tot;k++){var b=document.getElementById('${bid}_i'+i+'_'+k);if(b){b.style.background='#f9f9f9';b.style.borderColor='#ddd';b.style.color='#222';}}
  var s=document.getElementById('${bid}_i'+i+'_'+j);if(s){s.style.background='#375623';s.style.borderColor='#375623';s.style.color='#fff';}
  ${bid}_sel_map[i]=j;
}
function ${bid}_chk(){
  var items=${JSON.stringify(items)},ok=0;
  items.forEach(function(item,i){
    var ci=${bid}_sel_map[i];if(ci===undefined)return;
    var val=item.options[ci],btn=document.getElementById('${bid}_i'+i+'_'+ci);
    if(val===item.answer){if(btn){btn.style.background='#9BBB59';btn.style.borderColor='#9BBB59';}ok++;}
    else{
      if(btn){btn.style.background='#C0504D';btn.style.borderColor='#C0504D';}
      var ci2=(item.options||[]).indexOf(item.answer);
      if(ci2>=0){var b2=document.getElementById('${bid}_i'+i+'_'+ci2);if(b2){b2.style.background='#9BBB59';b2.style.borderColor='#9BBB59';}}
    }
  });
  var el=document.getElementById('${bid}_res');
  el.innerHTML=ok+'/'+items.length+' correct';
  el.style.color=ok===items.length?'#375623':'#C0504D';
}
function ${bid}_rst(){
  var items=${JSON.stringify(items)};
  ${bid}_sel_map={};
  items.forEach(function(item,i){(item.options||[]).forEach(function(_,j){var b=document.getElementById('${bid}_i'+i+'_'+j);if(b){b.style.background='#f9f9f9';b.style.borderColor='#ddd';b.style.color='#222';}});});
  document.getElementById('${bid}_res').innerHTML='';
}
</script>`
    return dialog('Grammar — Choose the Form', body, footer) + script
  }

  // ── READING true-false ────────────────────────────────────────────────────
  if (type === 'READING' && model === 'true-false') {
    const stmts = data.statements || []
    if (!stmts.length) return null

    const passageBox = data.passage
      ? `<div style="font-size:12px;line-height:1.7;background:#f0f4ff;border-left:3px solid #17375E;padding:10px 12px;border-radius:0 4px 4px 0;margin-bottom:14px">${data.passage}</div>`
      : ''

    const body = passageBox + stmts.map((st, i) => {
      const text = typeof st === 'string' ? st : (st?.s || '')
      return `
      <div style="margin-bottom:14px;padding:10px;background:#f7faff;border:1px solid #d0dcf0;border-radius:6px;font-size:12px">
        <div style="font-weight:600;color:#1F3864;margin-bottom:8px;line-height:1.5">${i + 1}. ${text}</div>
        <div style="display:flex;gap:8px">
          <button id="${bid}_t${i}" onclick="${bid}_pick(${i},'T')"
            style="padding:6px 20px;border:2px solid #17375E;border-radius:4px;font-size:12px;font-weight:700;background:#fff;color:#17375E;cursor:pointer">TRUE</button>
          <button id="${bid}_f${i}" onclick="${bid}_pick(${i},'F')"
            style="padding:6px 20px;border:2px solid #17375E;border-radius:4px;font-size:12px;font-weight:700;background:#fff;color:#17375E;cursor:pointer">FALSE</button>
        </div>
      </div>`
    }).join('')

    const footer = `
      <button onclick="${bid}_done()" class="sbd-check">Listo ✓</button>
      <button onclick="${bid}_rst()" class="sbd-reset">Reiniciar</button>
      <div id="${bid}_res" style="font-size:12px;margin-left:8px;align-self:center"></div>`

    const script = `
<script>
var ${bid}_ans={};
function ${bid}_pick(i,v){
  ${bid}_ans[i]=v;
  var t=document.getElementById('${bid}_t'+i),f=document.getElementById('${bid}_f'+i);
  if(v==='T'){t.style.background='#17375E';t.style.color='#fff';f.style.background='#fff';f.style.color='#17375E';}
  else{f.style.background='#17375E';f.style.color='#fff';t.style.background='#fff';t.style.color='#17375E';}
}
function ${bid}_done(){
  var tot=${stmts.length},answered=Object.keys(${bid}_ans).length;
  var el=document.getElementById('${bid}_res');
  if(answered<tot){el.innerHTML='<span style="color:#C0504D">'+(tot-answered)+' sin responder</span>';}
  else{el.innerHTML='<span style="color:#375623">¡Completado! ✓</span>';}
}
function ${bid}_rst(){
  ${bid}_ans={};
  for(var i=0;i<${stmts.length};i++){
    var t=document.getElementById('${bid}_t'+i),f=document.getElementById('${bid}_f'+i);
    if(t){t.style.background='#fff';t.style.color='#17375E';}
    if(f){f.style.background='#fff';f.style.color='#17375E';}
  }
  document.getElementById('${bid}_res').innerHTML='';
}
</script>`
    return dialog('Reading — True / False', body, footer) + script
  }

  // ── READING comprehension ─────────────────────────────────────────────────
  if (type === 'READING' && model === 'comprehension') {
    const questions = data.questions || []
    if (!questions.length) return null

    const passageBox = data.passage
      ? `<div style="font-size:12px;line-height:1.7;background:#f0f4ff;border-left:3px solid #17375E;padding:10px 12px;border-radius:0 4px 4px 0;margin-bottom:14px">${data.passage}</div>`
      : ''

    const body = passageBox + questions.map((q, i) => `
      <div style="margin-bottom:14px;font-size:12px">
        <div style="font-weight:600;margin-bottom:6px">${i + 1}. ${q.q || ''}</div>
        <textarea id="${bid}_a${i}" rows="${q.lines || 2}"
          style="width:100%;border:2px solid #ccc;border-radius:4px;padding:6px 8px;font-size:12px;font-family:Arial,sans-serif;box-sizing:border-box;resize:vertical"
          placeholder="Write your answer here…"></textarea>
      </div>`).join('')

    const footer = `
      <button onclick="${bid}_done()" class="sbd-check">Listo ✓</button>
      <div id="${bid}_res" style="font-size:12px;margin-left:8px;align-self:center"></div>`

    const script = `
<script>
function ${bid}_done(){
  var tot=${questions.length},ok=0;
  for(var i=0;i<tot;i++){var ta=document.getElementById('${bid}_a'+i);if(ta&&ta.value.trim())ok++;}
  var el=document.getElementById('${bid}_res');
  if(ok<tot){el.innerHTML='<span style="color:#C0504D">'+(tot-ok)+' pregunta(s) sin responder</span>';}
  else{el.innerHTML='<span style="color:#375623">¡Completado! ✓</span>';}
}
</script>`
    return dialog('Reading — Comprehension', body, footer) + script
  }

  // ── EXIT TICKET can-do ────────────────────────────────────────────────────
  if (type === 'EXIT_TICKET' && model === 'can-do') {
    const skills = data.skills || []
    if (!skills.length) return null

    const emojis  = ['😊', '😐', '😕']
    const labels  = ['I got it!', 'Almost', 'Need help']

    const body = `
      <div style="font-size:12px;color:#555;margin-bottom:12px">Tap the emoji that best describes how you feel about each skill.</div>
      ${skills.map((sk, i) => `
        <div style="margin-bottom:12px;padding:10px;background:#fff8e6;border-radius:6px;border:1px solid #ffe0b0">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px">I can <strong>${sk}</strong></div>
          <div style="display:flex;gap:10px">
            ${emojis.map((e, j) => `
              <button id="${bid}_e${i}_${j}" onclick="${bid}_pick(${i},${j},${emojis.length})"
                style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px;border:2px solid #ddd;border-radius:8px;background:#fff;cursor:pointer">
                <span style="font-size:22px">${e}</span>
                <span style="font-size:9px;color:#888">${labels[j]}</span>
              </button>`).join('')}
          </div>
        </div>`).join('')}
      <div id="${bid}_res" style="font-size:13px;font-weight:700;margin-top:6px"></div>`

    const footer = `
      <button onclick="${bid}_done()" class="sbd-check">Enviar ✓</button>
      <button onclick="${bid}_rst()" class="sbd-reset">Reiniciar</button>`

    const script = `
<script>
var ${bid}_picks={};
function ${bid}_pick(i,j,tot){
  for(var k=0;k<tot;k++){var b=document.getElementById('${bid}_e'+i+'_'+k);if(b){b.style.borderColor='#ddd';b.style.background='#fff';}}
  var s=document.getElementById('${bid}_e'+i+'_'+j);if(s){s.style.borderColor='#C55A11';s.style.background='#fff8e6';}
  ${bid}_picks[i]=j;
}
function ${bid}_done(){
  var tot=${skills.length},answered=Object.keys(${bid}_picks).length,el=document.getElementById('${bid}_res');
  if(answered<tot){el.innerHTML='<span style="color:#C0504D">'+(tot-answered)+' sin completar</span>';}
  else{el.innerHTML='<span style="color:#C55A11">¡Exit Ticket enviado! ✓</span>';}
}
function ${bid}_rst(){
  ${bid}_picks={};
  for(var i=0;i<${skills.length};i++)for(var j=0;j<3;j++){var b=document.getElementById('${bid}_e'+i+'_'+j);if(b){b.style.borderColor='#ddd';b.style.background='#fff';}}
  document.getElementById('${bid}_res').innerHTML='';
}
</script>`
    return dialog('Exit Ticket — Can-Do', body, footer) + script
  }

  // ── EXIT TICKET rating ────────────────────────────────────────────────────
  if (type === 'EXIT_TICKET' && model === 'rating') {
    const statements = data.statements || []
    if (!statements.length) return null

    const body = `
      <div style="font-size:12px;color:#555;margin-bottom:12px">Rate your understanding: 1 = I'm lost · 5 = I got it!</div>
      ${statements.map((st, i) => `
        <div style="margin-bottom:14px;padding:10px;background:#fff8e6;border-radius:6px;border:1px solid #ffe0b0">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px">${i + 1}. ${st}</div>
          <div style="display:flex;gap:8px">
            ${[1,2,3,4,5].map(n => `
              <button id="${bid}_r${i}_${n}" onclick="${bid}_rate(${i},${n})"
                style="width:40px;height:40px;border:2px solid #C55A11;border-radius:50%;font-size:13px;font-weight:700;color:#C55A11;background:#fff;cursor:pointer">${n}</button>`
            ).join('')}
          </div>
        </div>`).join('')}
      <div id="${bid}_res" style="font-size:13px;font-weight:700;margin-top:6px"></div>`

    const footer = `
      <button onclick="${bid}_done()" class="sbd-check">Enviar ✓</button>
      <button onclick="${bid}_rst()" class="sbd-reset">Reiniciar</button>`

    const script = `
<script>
var ${bid}_ratings={};
function ${bid}_rate(i,n){
  for(var k=1;k<=5;k++){var b=document.getElementById('${bid}_r'+i+'_'+k);if(b){b.style.background='#fff';b.style.color='#C55A11';}}
  for(var k=1;k<=n;k++){var b=document.getElementById('${bid}_r'+i+'_'+k);if(b){b.style.background='#C55A11';b.style.color='#fff';}}
  ${bid}_ratings[i]=n;
}
function ${bid}_done(){
  var tot=${statements.length},answered=Object.keys(${bid}_ratings).length,el=document.getElementById('${bid}_res');
  if(answered<tot){el.innerHTML='<span style="color:#C0504D">'+(tot-answered)+' sin calificar</span>';}
  else{el.innerHTML='<span style="color:#C55A11">¡Self-Rating enviado! ✓</span>';}
}
function ${bid}_rst(){
  ${bid}_ratings={};
  for(var i=0;i<${statements.length};i++)for(var k=1;k<=5;k++){var b=document.getElementById('${bid}_r'+i+'_'+k);if(b){b.style.background='#fff';b.style.color='#C55A11';}}
  document.getElementById('${bid}_res').innerHTML='';
}
</script>`
    return dialog('Exit Ticket — Self-Rating', body, footer) + script
  }

  return null
}

// ── SmartBlocks list + add button ─────────────────────────────────────────────
export const SmartBlocksList = memo(function SmartBlocksList({ blocks = [], onChange, aiContext }) {
  const { showToast } = useToast()
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [suggesting,   setSuggesting]   = useState(false)
  const [suggestError, setSuggestError] = useState(null)

  const handleDelete = useCallback((id) => {
    onChange(blocks.filter(b => b.id !== id))
  }, [blocks, onChange])

  const handleEdit = useCallback((id) => {
    setEditId(id)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback((block) => {
    if (editId != null) {
      onChange(blocks.map(b => b.id === editId ? { ...block, id: editId } : b))
    } else {
      onChange([...blocks, { ...block, id: Date.now() }])
    }
    setModalOpen(false)
    setEditId(null)
  }, [editId, blocks, onChange])

  const handleAISuggest = useCallback(async () => {
    if (!aiContext) return
    setSuggesting(true)
    setSuggestError(null)
    try {
      const result = await suggestSmartBlock({ ...aiContext, existingBlocks: blocks })
      if (result?.type && result?.model) {
        onChange([...blocks, { ...result, id: Date.now() }])
      }
    } catch (e) {
      const errorMsg = e.message || 'Error al sugerir bloque'
      setSuggestError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setSuggesting(false)
    }
  }, [aiContext, blocks, onChange, showToast])

  const editingBlock = useMemo(() =>
    editId != null ? blocks.find(b => b.id === editId) : null,
    [editId, blocks]
  )

  return (
    <div className="sb-list">
      {blocks.map(b => {
        const t = BLOCK_TYPES[b.type]
        if (!t) return null
        const m = t.models.find(m => m.id === b.model)
        return (
          <div key={b.id} className="sb-chip">
            <div className="sb-chip-header" style={{ background: `#${t.color}` }}>
              <span>{t.icon}</span>
              <span className="sb-chip-type">{t.label}</span>
              <span className="sb-chip-model">· {m?.label || b.model}</span>
              <div className="sb-chip-actions">
                <button onClick={() => handleEdit(b.id)} aria-label="Editar bloque">✏️ editar</button>
                <button onClick={() => handleDelete(b.id)} aria-label="Eliminar bloque">🗑️</button>
              </div>
            </div>
            <div className="sb-chip-preview"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blockPreviewHTML(b)) }} />
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="sb-add-btn" style={{ flex: 1 }} onClick={() => { setEditId(null); setModalOpen(true) }}>
          <span>＋</span> Agregar Bloque
        </button>
        {aiContext && (() => {
          const usedTypes = new Set(blocks.map(b => b.type))
          const allTypes = Object.keys(BLOCK_TYPES)
          const allCovered = allTypes.every(t => usedTypes.has(t))
          return (
            <button
              className="sb-add-btn"
              style={{ flex: 1, background: (suggesting || allCovered) ? '#e8eef8' : '#f0f4ff', borderColor: '#4BACC6', color: '#2E5598' }}
              onClick={handleAISuggest}
              disabled={suggesting || allCovered}
              title={allCovered ? 'Ya tienes todos los tipos de SmartBlocks disponibles en esta sección' : ''}>
              {suggesting ? <span>⏳ Pensando…</span> : allCovered ? <><span>✅</span> Todos los tipos usados</> : <><span>✨</span> Sugerir con IA</>}
            </button>
          )
        })()}
      </div>
      {suggestError && (
        <div style={{ fontSize: '11px', color: '#cc3333', marginTop: '4px' }}>⚠️ {suggestError}</div>
      )}

      {modalOpen && (
        <SmartBlockModal
          initial={editingBlock}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditId(null) }}
        />
      )}
    </div>
  )
})

// ── SmartBlockModal — 3-step wizard ──────────────────────────────────────────
function SmartBlockModal({ initial, onSave, onClose }) {
  const [step,  setStep]  = useState(initial ? 3 : 1)
  const [type,  setType]  = useState(initial?.type  || null)
  const [model, setModel] = useState(initial?.model || null)
  const [data,  setData]  = useState(initial?.data  || {})

  const typeDef  = type  ? BLOCK_TYPES[type]                    : null
  const modelDef = model ? typeDef?.models.find(m => m.id === model) : null

  function handleSave() {
    onSave({ type, model, data })
  }

  return createPortal(
    <div className="sb-modal-overlay">
      <div className="sb-modal">
        <div className="sb-modal-header">
          <h2>{initial ? '✏️ Editar Bloque' : '➕ Agregar Bloque Inteligente'}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Stepper */}
        <div className="sb-modal-steps">
          {['1 · Tipo','2 · Modelo','3 · Contenido'].map((label, i) => (
            <div key={i} className={`sb-step ${step > i+1 ? 'done' : step === i+1 ? 'active' : ''}`}>
              {label}
            </div>
          ))}
        </div>

        <div className="sb-modal-body">

          {/* Step 1: Type */}
          {step === 1 && (
            <div className="sb-type-grid">
              {Object.entries(BLOCK_TYPES).map(([key, t]) => (
                <div key={key}
                  className={`sb-type-card ${type === key ? 'selected' : ''}`}
                  onClick={() => setType(key)}>
                  <div className="sb-type-icon">{t.icon}</div>
                  <div className="sb-type-name">{t.label}</div>
                  <div className="sb-type-desc">{t.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Model */}
          {step === 2 && typeDef && (
            <div>
              <p style={{ fontSize: '12px', color: '#555', marginBottom: '12px' }}>
                {typeDef.icon} <strong>{typeDef.label}</strong> — Elige el modelo visual:
              </p>
              <div className="sb-model-grid">
                {typeDef.models.map(m => (
                  <div key={m.id}
                    className={`sb-model-card ${model === m.id ? 'selected' : ''}`}
                    onClick={() => setModel(m.id)}>
                    <div className="sb-model-name">{m.label}</div>
                    <div className="sb-model-sub">{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Form */}
          {step === 3 && typeDef && modelDef && (
            <BlockForm
              type={type}
              model={model}
              data={data}
              onChange={setData}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sb-modal-footer">
          {step > 1 && <button className="btn-secondary" onClick={() => setStep(s => s-1)}>← Atrás</button>}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="btn-primary"
              disabled={step === 1 && !type || step === 2 && !model}
              onClick={() => setStep(s => s+1)}>
              Continuar →
            </button>
          ) : (
            <button className="btn-primary btn-save" onClick={handleSave}>✔ Guardar bloque</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Block forms ───────────────────────────────────────────────────────────────
function BlockForm({ type, model, data, onChange }) {
  function set(key, value) { onChange({ ...data, [key]: value }) }

  if (type === 'DICTATION') {
    const words = (data.words || []).join('\n')
    return (
      <div>
        <div className="ge-field">
          <label>{model === 'word-grid' ? '📋 Palabras a dictar (una por línea)' : '📋 Oraciones a dictar (una por línea)'}</label>
          <textarea rows={6}
            value={words}
            placeholder={model === 'word-grid' ? 'house\nmountain\nfreedom\nancient\nvivid' : 'The students will present their projects.\nShe used to live in a small town.'}
            onChange={e => set('words', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
        </div>
        <div className="ge-field">
          <label>📌 Instrucciones para el estudiante</label>
          <input type="text"
            value={data.instructions || 'Listen carefully and write what you hear.'}
            onChange={e => set('instructions', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>⏱️ Tiempo estimado</label>
          <input type="text" value={data.time || '~15 min'} onChange={e => set('time', e.target.value)} />
        </div>
      </div>
    )
  }

  if (type === 'QUIZ') {
    return (
      <div>
        <div className="ge-grid-2">
          <div className="ge-field">
            <label>📅 Fecha del quiz</label>
            <input type="text" value={data.date||''} placeholder="e.g. Friday March 7"
              onChange={e => set('date', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>📖 Unidad / Tema</label>
            <input type="text" value={data.unit||'Unit 1'} onChange={e => set('unit', e.target.value)} />
          </div>
        </div>
        <div className="ge-field">
          <label>📋 Temas a evaluar (uno por línea)</label>
          <textarea rows={4}
            value={data.topics||''}
            placeholder="Grammar: used to / would&#10;Vocabulary: Unit 1 list&#10;Reading comprehension"
            onChange={e => set('topics', e.target.value)} />
        </div>
        {model === 'format-box' && (
          <div className="ge-field">
            <label>📊 Formato de puntuación (uno por línea)</label>
            <textarea rows={4}
              value={data.format||''}
              placeholder="Vocabulary: 10 pts&#10;Grammar: 10 pts&#10;Reading: 10 pts&#10;Total: 30 pts"
              onChange={e => set('format', e.target.value)} />
          </div>
        )}
        <div className="ge-field">
          <label>💬 Nota adicional (opcional)</label>
          <input type="text" value={data.note||''} placeholder="Pueden usar diccionario / cerrado"
            onChange={e => set('note', e.target.value)} />
        </div>
      </div>
    )
  }

  if (type === 'VOCAB') {
    const words = normalizeVocabWords(data).length ? normalizeVocabWords(data) : [{w:'',d:'',e:''},{w:'',d:'',e:''}]
    function updateWord(i, field, val) {
      const next = [...words]
      next[i] = { ...next[i], [field]: val }
      set('words', next)
    }
    return (
      <div>
        <div className="ge-field">
          <label>{model === 'cards' ? '🃏 Vocab Cards' : '🔀 Match Columns'}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.2fr 28px', gap: '6px', marginBottom: '4px', fontSize: '10px', fontWeight: 700, color: '#666' }}>
            <span>WORD</span><span>DEFINITION</span><span>{model==='cards'?'EXAMPLE':'IN CONTEXT'}</span><span />
          </div>
          {words.map((wd, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.2fr 28px', gap: '6px', marginBottom: '4px' }}>
              <input type="text" value={wd.w||''} placeholder="Word"       onChange={e => updateWord(i,'w',e.target.value)} />
              <input type="text" value={wd.d||''} placeholder="Definition" onChange={e => updateWord(i,'d',e.target.value)} />
              <input type="text" value={wd.e||''} placeholder="Example"    onChange={e => updateWord(i,'e',e.target.value)} />
              <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                onClick={() => set('words', words.filter((_,j) => j !== i))}>✕</button>
            </div>
          ))}
          <button style={{ marginTop: '6px', padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            onClick={() => set('words', [...words, {w:'',d:'',e:''}])}>＋ Add word</button>
        </div>
      </div>
    )
  }

  if (type === 'WORKSHOP') {
    if (model === 'stations') {
      const stations = data.stations || [{name:'Station A',time:'10 min',desc:''},{name:'Station B',time:'10 min',desc:''},{name:'Station C',time:'10 min',desc:''}]
      function updateStation(i, field, val) {
        const next = [...stations]; next[i] = { ...next[i], [field]: val }; set('stations', next)
      }
      return (
        <div className="ge-field">
          <label>🛠️ Estaciones</label>
          {stations.map((st, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
              <div className="ge-grid-2">
                <div className="ge-field">
                  <label>Nombre</label>
                  <input type="text" value={st.name} onChange={e => updateStation(i,'name',e.target.value)} />
                </div>
                <div className="ge-field">
                  <label>Tiempo</label>
                  <input type="text" value={st.time} onChange={e => updateStation(i,'time',e.target.value)} />
                </div>
              </div>
              <div className="ge-field">
                <label>Descripción / Tarea</label>
                <input type="text" value={st.desc} placeholder="¿Qué hace el estudiante aquí?"
                  onChange={e => updateStation(i,'desc',e.target.value)} />
              </div>
            </div>
          ))}
          <button style={{ padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            onClick={() => set('stations', [...stations, {name:`Station ${String.fromCharCode(65+stations.length)}`,time:'10 min',desc:''}])}>
            ＋ Agregar estación
          </button>
        </div>
      )
    }
    // Roles
    const roles = data.roles || [{role:'Leader',task:'Guides the discussion'},{role:'Writer',task:'Records the answers'},{role:'Speaker',task:'Presents to the class'},{role:'Researcher',task:'Looks up vocabulary'}]
    function updateRole(i, field, val) {
      const next = [...roles]; next[i] = { ...next[i], [field]: val }; set('roles', next)
    }
    return (
      <div className="ge-field">
        <label>👥 Roles del equipo</label>
        {roles.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 28px', gap: '6px', marginBottom: '6px' }}>
            <input type="text" value={r.role} placeholder="Rol"              onChange={e => updateRole(i,'role',e.target.value)} />
            <input type="text" value={r.task} placeholder="Responsabilidad"  onChange={e => updateRole(i,'task',e.target.value)} />
            <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
              onClick={() => set('roles', roles.filter((_,j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'SPEAKING') {
    if (model === 'rubric') {
      const criteria = data.criteria || [{name:'Fluency & Pronunciation',pts:'10'},{name:'Vocabulary Usage',pts:'10'},{name:'Content & Organization',pts:'10'},{name:'Confidence & Eye Contact',pts:'10'}]
      function updateCriterion(i, field, val) {
        const next = [...criteria]; next[i] = { ...next[i], [field]: val }; set('criteria', next)
      }
      return (
        <div>
          <div className="ge-field">
            <label>📋 Criterios de evaluación</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#666', marginBottom: '4px' }}>
              <span>CRITERIO</span><span>PUNTOS</span><span />
            </div>
            {criteria.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: '6px', marginBottom: '4px' }}>
                <input type="text" value={c.name} placeholder="Criterio" onChange={e => updateCriterion(i,'name',e.target.value)} />
                <input type="text" value={c.pts}  placeholder="Pts"      onChange={e => updateCriterion(i,'pts', e.target.value)} />
                <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                  onClick={() => set('criteria', criteria.filter((_,j) => j !== i))}>✕</button>
              </div>
            ))}
            <button style={{ padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginTop: '6px' }}
              onClick={() => set('criteria', [...criteria, {name:'',pts:'10'}])}>＋ Agregar criterio</button>
          </div>
          <div className="ge-field">
            <label>📅 Fecha de presentación</label>
            <input type="text" value={data.date||''} onChange={e => set('date', e.target.value)} />
          </div>
        </div>
      )
    }
    // Prep checklist
    return (
      <div>
        <div className="ge-field">
          <label>✅ Pasos de preparación (uno por línea)</label>
          <textarea rows={6}
            value={(data.steps||[]).join('\n')}
            placeholder="Choose your topic and do research&#10;Organize your ideas with an outline&#10;Practice 3 times out loud"
            onChange={e => set('steps', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
        </div>
        <div className="ge-field">
          <label>📅 Fecha límite</label>
          <input type="text" value={data.date||''} onChange={e => set('date', e.target.value)} />
        </div>
      </div>
    )
  }

  if (type === 'NOTICE') {
    const ICONS = ['📢','⚠️','📌','🔔','✅','❌','📅','💡','🎯']
    return (
      <div>
        <div className="ge-field">
          <label>📢 Título del aviso</label>
          <input type="text" value={data.title||''} placeholder="Ej: QUIZ THIS FRIDAY — Unit 1"
            onChange={e => set('title', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>💬 Mensaje / Detalle</label>
          <textarea rows={3} value={data.message||''} placeholder="Descripción o instrucción adicional..."
            onChange={e => set('message', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>🎨 Ícono</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {ICONS.map(ic => (
              <span key={ic}
                onClick={() => set('icon', ic)}
                style={{ fontSize: '22px', cursor: 'pointer', padding: '4px', borderRadius: '4px',
                  border: `2px solid ${data.icon===ic ? '#2E5598' : 'transparent'}` }}>
                {ic}
              </span>
            ))}
          </div>
        </div>
        {model === 'alert' && (
          <div className="ge-field">
            <label>🚦 Prioridad</label>
            <select value={data.priority||'warning'} onChange={e => set('priority', e.target.value)}>
              <option value="info">ℹ️ Info</option>
              <option value="warning">⚠️ Advertencia</option>
              <option value="danger">🔴 Urgente</option>
            </select>
          </div>
        )}
      </div>
    )
  }

  if (type === 'READING') {
    if (model === 'comprehension') {
      const questions = data.questions || [{ q: '', lines: 2 }, { q: '', lines: 2 }]
      function updateQ(i, field, val) {
        const next = [...questions]; next[i] = { ...next[i], [field]: val }; set('questions', next)
      }
      return (
        <div>
          <div className="ge-field">
            <label>📝 Pasaje de lectura</label>
            <textarea rows={5} value={data.passage || ''} placeholder="Write or paste the reading passage here…"
              onChange={e => set('passage', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>❓ Preguntas</label>
            {questions.map((q, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 28px', gap: '6px', marginBottom: '6px' }}>
                <input type="text" value={q.q || ''} placeholder={`Question ${i + 1}`}
                  onChange={e => updateQ(i, 'q', e.target.value)} />
                <select value={q.lines || 2} onChange={e => updateQ(i, 'lines', parseInt(e.target.value))}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} line{n > 1 ? 's' : ''}</option>)}
                </select>
                <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                  onClick={() => set('questions', questions.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button style={{ padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
              onClick={() => set('questions', [...questions, { q: '', lines: 2 }])}>＋ Add question</button>
          </div>
        </div>
      )
    }
    // true-false
    const statements = data.statements || [{ s: '' }, { s: '' }, { s: '' }]
    return (
      <div>
        <div className="ge-field">
          <label>📝 Pasaje de lectura</label>
          <textarea rows={5} value={data.passage || ''} placeholder="Write or paste the reading passage here…"
            onChange={e => set('passage', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>✅ Afirmaciones True / False</label>
          {statements.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: '6px', marginBottom: '6px' }}>
              <input type="text" value={s.s || ''} placeholder={`Statement ${i + 1}`}
                onChange={e => { const next = [...statements]; next[i] = { s: e.target.value }; set('statements', next) }} />
              <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                onClick={() => set('statements', statements.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button style={{ padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            onClick={() => set('statements', [...statements, { s: '' }])}>＋ Add statement</button>
        </div>
      </div>
    )
  }

  if (type === 'GRAMMAR') {
    if (model === 'fill-blank') {
      const sentences = data.sentences || [{ sent: '', answer: '' }]
      function updateSent(i, field, val) {
        const next = [...sentences]; next[i] = { ...next[i], [field]: val }; set('sentences', next)
      }
      return (
        <div>
          <div className="ge-grid-2">
            <div className="ge-field">
              <label>📐 Punto gramatical</label>
              <input type="text" value={data.grammar_point || ''} placeholder="e.g. Present Perfect vs Past Simple"
                onChange={e => set('grammar_point', e.target.value)} />
            </div>
            <div className="ge-field">
              <label>📌 Instrucciones</label>
              <input type="text" value={data.instructions || 'Complete the sentences with the correct form.'}
                onChange={e => set('instructions', e.target.value)} />
            </div>
          </div>
          <div className="ge-field">
            <label>📋 Oraciones (usa ___ para el espacio)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: '4px', marginBottom: '4px', fontSize: '10px', fontWeight: 700, color: '#666' }}>
              <span>SENTENCE (use ___)</span><span>ANSWER</span><span />
            </div>
            {sentences.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: '6px', marginBottom: '4px' }}>
                <input type="text" value={s.sent || ''} placeholder="She ___ to school yesterday."
                  onChange={e => updateSent(i, 'sent', e.target.value)} />
                <input type="text" value={s.answer || ''} placeholder="walked"
                  onChange={e => updateSent(i, 'answer', e.target.value)} />
                <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                  onClick={() => set('sentences', sentences.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button style={{ marginTop: '6px', padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
              onClick={() => set('sentences', [...sentences, { sent: '', answer: '' }])}>＋ Add sentence</button>
          </div>
        </div>
      )
    }
    // choose
    const items = data.items || [{ sentence: '', options: ['', '', ''], answer: '' }]
    function updateItem(i, field, val) {
      const next = [...items]; next[i] = { ...next[i], [field]: val }; set('items', next)
    }
    function updateOption(i, oi, val) {
      const next = [...items]; const opts = [...(next[i].options || [])]; opts[oi] = val
      next[i] = { ...next[i], options: opts }; set('items', next)
    }
    return (
      <div>
        <div className="ge-grid-2">
          <div className="ge-field">
            <label>📐 Punto gramatical</label>
            <input type="text" value={data.grammar_point || ''} placeholder="e.g. Modal Verbs"
              onChange={e => set('grammar_point', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>📌 Instrucciones</label>
            <input type="text" value={data.instructions || 'Choose the correct option.'}
              onChange={e => set('instructions', e.target.value)} />
          </div>
        </div>
        <div className="ge-field">
          <label>📋 Oraciones con opciones</label>
          {items.map((item, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: '6px', marginBottom: '6px' }}>
                <input type="text" value={item.sentence || ''} placeholder={`Sentence ${i + 1}…`}
                  onChange={e => updateItem(i, 'sentence', e.target.value)} />
                <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                  onClick={() => set('items', items.filter((_, j) => j !== i))}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '6px' }}>
                {(item.options || ['', '', '']).map((opt, oi) => (
                  <input key={oi} type="text" value={opt} placeholder={`Option ${oi + 1}`}
                    onChange={e => updateOption(i, oi, e.target.value)} />
                ))}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#375623', marginBottom: '2px' }}>Correct answer</div>
              <input type="text" value={item.answer || ''} placeholder="write the correct option exactly"
                onChange={e => updateItem(i, 'answer', e.target.value)} />
            </div>
          ))}
          <button style={{ padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            onClick={() => set('items', [...items, { sentence: '', options: ['', '', ''], answer: '' }])}>＋ Add item</button>
        </div>
      </div>
    )
  }

  if (type === 'EXIT_TICKET') {
    if (model === 'can-do') {
      const skills = data.skills || ['']
      return (
        <div>
          <div className="ge-field">
            <label>📅 Fecha (opcional)</label>
            <input type="text" value={data.date || ''} placeholder="e.g. Friday, March 7"
              onChange={e => set('date', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>✅ Declaraciones "I can…"</label>
            {skills.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: '6px', marginBottom: '6px' }}>
                <input type="text" value={s} placeholder="understand a short conversation about daily routines"
                  onChange={e => { const next = [...skills]; next[i] = e.target.value; set('skills', next) }} />
                <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                  onClick={() => set('skills', skills.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button style={{ marginTop: '4px', padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
              onClick={() => set('skills', [...skills, ''])}>＋ Add statement</button>
          </div>
        </div>
      )
    }
    // rating
    const statements = data.statements || ['']
    return (
      <div>
        <div className="ge-field">
          <label>📅 Fecha (opcional)</label>
          <input type="text" value={data.date || ''} placeholder="e.g. Friday, March 7"
            onChange={e => set('date', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>📊 Declaraciones para calificar (1–5)</label>
          {statements.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: '6px', marginBottom: '6px' }}>
              <input type="text" value={s} placeholder="I understand today's grammar topic"
                onChange={e => { const next = [...statements]; next[i] = e.target.value; set('statements', next) }} />
              <button style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: '16px' }}
                onClick={() => set('statements', statements.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button style={{ marginTop: '4px', padding: '5px 12px', background: '#1F3864', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            onClick={() => set('statements', [...statements, ''])}>＋ Add statement</button>
        </div>
      </div>
    )
  }

  return <p style={{ color: '#aaa' }}>Formulario no disponible</p>
}

export default SmartBlocksList
