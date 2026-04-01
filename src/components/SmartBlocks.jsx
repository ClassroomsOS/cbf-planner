import { useState } from 'react'
import { createPortal } from 'react-dom'

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
    const topics = (data.topics||'').split('\n').filter(Boolean)
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
      return `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr style="background:#9BBB59;color:#fff">
          <th style="padding:4px 8px;text-align:left">Word</th>
          <th style="padding:4px 8px;text-align:left">Definition</th>
          <th style="padding:4px 8px;text-align:left">Example</th>
        </tr>
        ${(data.words||[]).map((wd,i) => `<tr style="background:${i%2?'#f9fff4':'#fff'};border-bottom:1px solid #eee">
          <td style="padding:4px 8px;font-weight:700">${wd.w}</td>
          <td style="padding:4px 8px">${wd.d}</td>
          <td style="padding:4px 8px;color:#666">${wd.e}</td>
        </tr>`).join('')}
      </table>`
    }
    const half  = Math.ceil((data.words||[]).length / 2)
    const left  = (data.words||[]).slice(0, half)
    const right = (data.words||[]).slice(half)
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:11px">
      <div><div style="font-weight:700;border-bottom:2px solid #9BBB59;margin-bottom:4px;padding-bottom:2px">TERMS</div>
        ${left.map((wd,i) => `<div style="padding:3px 0">${i+1}. ${wd.w}</div>`).join('')}
      </div>
      <div><div style="font-weight:700;border-bottom:2px solid #9BBB59;margin-bottom:4px;padding-bottom:2px">MEANINGS</div>
        ${right.map((wd,i) => `<div style="padding:3px 0">${String.fromCharCode(65+i)}. ${wd.d||wd.w}</div>`).join('')}
      </div>
    </div>`
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

  return '<span style="color:#aaa">Vista previa no disponible</span>'
}

// ── SmartBlocks list + add button ─────────────────────────────────────────────
export function SmartBlocksList({ blocks = [], onChange }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editId,    setEditId]    = useState(null)

  function handleDelete(id) {
    onChange(blocks.filter(b => b.id !== id))
  }

  function handleEdit(id) {
    setEditId(id)
    setModalOpen(true)
  }

  function handleSave(block) {
    if (editId != null) {
      onChange(blocks.map(b => b.id === editId ? { ...block, id: editId } : b))
    } else {
      onChange([...blocks, { ...block, id: Date.now() }])
    }
    setModalOpen(false)
    setEditId(null)
  }

  const editingBlock = editId != null ? blocks.find(b => b.id === editId) : null

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
                <button onClick={() => handleEdit(b.id)}>✏️ editar</button>
                <button onClick={() => handleDelete(b.id)}>🗑️</button>
              </div>
            </div>
            <div className="sb-chip-preview"
              dangerouslySetInnerHTML={{ __html: blockPreviewHTML(b) }} />
          </div>
        )
      })}

      <button className="sb-add-btn" onClick={() => { setEditId(null); setModalOpen(true) }}>
        <span>＋</span> Agregar Bloque Inteligente
      </button>

      {modalOpen && (
        <SmartBlockModal
          initial={editingBlock}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditId(null) }}
        />
      )}
    </div>
  )
}

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
    const words = data.words || [{w:'',d:'',e:''},{w:'',d:'',e:''}]
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
            <span>WORD</span><span>DEFINITION</span><span>{model==='cards'?'EXAMPLE':'TRANSLATION'}</span><span />
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

  return <p style={{ color: '#aaa' }}>Formulario no disponible</p>
}

export default SmartBlocksList
