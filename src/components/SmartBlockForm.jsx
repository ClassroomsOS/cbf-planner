// ── SmartBlockForm.jsx ────────────────────────────────────────────────────────
// Form UI for each SmartBlock type/model combination.
// Pure presentational component — no hooks, no context, no side effects.

import { normalizeVocabWords } from '../utils/smartBlockHtml'

export default function SmartBlockForm({ type, model, data, onChange }) {
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

  if (type === 'WRITING') {
    if (model === 'guided') {
      return (
        <div>
          <div className="ge-field">
            <label>✍️ Prompt de escritura</label>
            <textarea rows={3} value={data.prompt||''} placeholder="Write a paragraph about a time when you helped someone…"
              onChange={e => set('prompt', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>🚀 Sentence Starters (uno por línea)</label>
            <textarea rows={4} value={(data.sentence_starters||[]).join('\n')}
              placeholder="One time, I helped…&#10;I decided to… because…&#10;As a result, I felt…"
              onChange={e => set('sentence_starters', e.target.value.split('\n').map(s=>s.trim()).filter(Boolean))} />
          </div>
          <div className="ge-field">
            <label>✅ Success Checklist (uno por línea)</label>
            <textarea rows={3} value={(data.checklist||[]).join('\n')}
              placeholder="I used 3 or more sentences&#10;I used past tense verbs&#10;I included a conclusion"
              onChange={e => set('checklist', e.target.value.split('\n').map(s=>s.trim()).filter(Boolean))} />
          </div>
        </div>
      )
    }
    return (
      <div>
        <div className="ge-field">
          <label>📌 Tema / Topic</label>
          <input type="text" value={data.topic||''} placeholder="My favorite place in Colombia…"
            onChange={e => set('topic', e.target.value)} />
        </div>
        <div className="ge-grid-2">
          <div className="ge-field">
            <label>🔢 Conteo de palabras</label>
            <input type="text" value={data.word_count||''} placeholder="80–100 words"
              onChange={e => set('word_count', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>📌 Instrucciones adicionales</label>
            <input type="text" value={data.instructions||''} placeholder="Use present tense"
              onChange={e => set('instructions', e.target.value)} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'SELF_ASSESSMENT') {
    if (model === 'checklist') {
      const skills = data.skills || ['']
      return (
        <div className="ge-field">
          <label>🪞 "I can…" statements (uno por línea)</label>
          <textarea rows={5} value={skills.join('\n')}
            placeholder="use past tense to describe events&#10;understand the main idea of a text&#10;write a coherent paragraph"
            onChange={e => set('skills', e.target.value.split('\n').map(s=>s.trim()).filter(Boolean))} />
        </div>
      )
    }
    const questions = data.questions || ['']
    return (
      <div className="ge-field">
        <label>🪞 Preguntas de reflexión (una por línea)</label>
        <textarea rows={5} value={questions.join('\n')}
          placeholder="What was the most challenging part of today?&#10;What strategy helped you most?&#10;What do you still need to practice?"
          onChange={e => set('questions', e.target.value.split('\n').map(s=>s.trim()).filter(Boolean))} />
      </div>
    )
  }

  if (type === 'PEER_REVIEW') {
    if (model === 'rubric') {
      const criteria = data.criteria || [{name:'Content & Ideas',pts:'10'},{name:'Language Use',pts:'10'},{name:'Organization',pts:'10'}]
      function updateCriterion(i, field, val) {
        const next = [...criteria]; next[i] = { ...next[i], [field]: val }; set('criteria', next)
      }
      return (
        <div className="ge-field">
          <label>📋 Criterios de coevaluación</label>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#666', marginBottom: '4px' }}>
            <span>CRITERIO</span><span>PUNTOS</span><span />
          </div>
          {criteria.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: '6px', marginBottom: '4px' }}>
              <input type="text" value={c.name} placeholder="Criterio" onChange={e => updateCriterion(i,'name',e.target.value)} />
              <input type="text" value={c.pts} placeholder="Pts" onChange={e => updateCriterion(i,'pts',e.target.value)} />
              <button style={{ background:'none',border:'none',color:'#cc4444',cursor:'pointer',fontSize:'16px' }}
                onClick={() => set('criteria', criteria.filter((_,j)=>j!==i))}>✕</button>
            </div>
          ))}
          <button style={{ padding:'5px 12px',background:'#1F3864',color:'#fff',border:'none',borderRadius:'4px',fontSize:'11px',cursor:'pointer',marginTop:'6px' }}
            onClick={() => set('criteria', [...criteria, {name:'',pts:'10'}])}>＋ Agregar criterio</button>
        </div>
      )
    }
    return (
      <div>
        <div className="ge-field">
          <label>⭐ Prompt "Stars" (fortalezas)</label>
          <input type="text" value={data.stars_prompt||'What did your peer do well?'}
            onChange={e => set('stars_prompt', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>🌟 Prompt "Wishes" (mejoras)</label>
          <input type="text" value={data.wishes_prompt||'What could your peer improve?'}
            onChange={e => set('wishes_prompt', e.target.value)} />
        </div>
      </div>
    )
  }

  if (type === 'DIGITAL_RESOURCE') {
    if (model === 'link') {
      return (
        <div>
          <div className="ge-field">
            <label>🏷️ Título del recurso</label>
            <input type="text" value={data.title||''} placeholder="Khan Academy — Present Perfect"
              onChange={e => set('title', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>🔗 URL</label>
            <input type="url" value={data.url||''} placeholder="https://..."
              onChange={e => set('url', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>📌 Instrucciones para el estudiante</label>
            <textarea rows={3} value={data.instructions||''} placeholder="Watch the video and take notes on the 3 main uses…"
              onChange={e => set('instructions', e.target.value)} />
          </div>
        </div>
      )
    }
    return (
      <div>
        <div className="ge-field">
          <label>💻 Nombre de la plataforma</label>
          <input type="text" value={data.platform_name||''} placeholder="Cambridge One / Duolingo / Quizlet…"
            onChange={e => set('platform_name', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>📋 Actividad asignada</label>
          <input type="text" value={data.activity||''} placeholder="Unit 4 — Listening Practice (15 min)"
            onChange={e => set('activity', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>📌 Instrucciones adicionales</label>
          <textarea rows={2} value={data.instructions||''} placeholder="Take a screenshot of your score when done."
            onChange={e => set('instructions', e.target.value)} />
        </div>
      </div>
    )
  }

  if (type === 'COLLABORATIVE_TASK') {
    if (model === 'jigsaw') {
      const groups = data.groups || [{name:'Expert Group A',topic:''},{name:'Expert Group B',topic:''},{name:'Expert Group C',topic:''}]
      function updateGroup(i, field, val) {
        const next = [...groups]; next[i] = { ...next[i], [field]: val }; set('groups', next)
      }
      return (
        <div className="ge-field">
          <label>👥 Grupos expertos</label>
          {groups.map((g, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 28px', gap: '6px', marginBottom: '6px' }}>
              <input type="text" value={g.name} placeholder={`Group ${i+1}`} onChange={e => updateGroup(i,'name',e.target.value)} />
              <input type="text" value={g.topic} placeholder="Topic / assigned section" onChange={e => updateGroup(i,'topic',e.target.value)} />
              <button style={{ background:'none',border:'none',color:'#cc4444',cursor:'pointer',fontSize:'16px' }}
                onClick={() => set('groups', groups.filter((_,j)=>j!==i))}>✕</button>
            </div>
          ))}
          <button style={{ padding:'5px 12px',background:'#1F3864',color:'#fff',border:'none',borderRadius:'4px',fontSize:'11px',cursor:'pointer' }}
            onClick={() => set('groups', [...groups, {name:`Expert Group ${String.fromCharCode(65+groups.length)}`,topic:''}])}>
            ＋ Agregar grupo
          </button>
        </div>
      )
    }
    return (
      <div>
        <div className="ge-field">
          <label>💬 Pregunta o prompt (Think)</label>
          <textarea rows={3} value={data.prompt||''} placeholder="Think about a time when you had to make a difficult decision…"
            onChange={e => set('prompt', e.target.value)} />
        </div>
        <div className="ge-grid-2">
          <div className="ge-field">
            <label>⏱ Tiempo Pair</label>
            <input type="text" value={data.pair_time||'3 min'} onChange={e => set('pair_time', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>📣 Tiempo Share</label>
            <input type="text" value={data.share_time||'5 min'} onChange={e => set('share_time', e.target.value)} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'REAL_LIFE_CONNECTION') {
    if (model === 'scenario') {
      const questions = data.questions || ['']
      return (
        <div>
          <div className="ge-field">
            <label>🌍 Situación / Contexto real</label>
            <textarea rows={3} value={data.context||''} placeholder="Imagine you are applying for a part-time job at a local café…"
              onChange={e => set('context', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>❓ Preguntas de análisis (una por línea)</label>
            <textarea rows={4} value={questions.join('\n')}
              placeholder="What skills would you need for this job?&#10;How would you describe yourself in English?&#10;What challenges might you face?"
              onChange={e => set('questions', e.target.value.split('\n').map(s=>s.trim()).filter(Boolean))} />
          </div>
        </div>
      )
    }
    return (
      <div>
        <div className="ge-field">
          <label>🌍 Prompt de conexión</label>
          <textarea rows={3} value={data.prompt||''} placeholder="Think of a situation in your daily life where you use or could use the language from today's lesson…"
            onChange={e => set('prompt', e.target.value)} />
        </div>
        <div className="ge-field">
          <label>💡 Ejemplo</label>
          <input type="text" value={data.example||''} placeholder="When I go shopping, I could say…"
            onChange={e => set('example', e.target.value)} />
        </div>
      </div>
    )
  }

  if (type === 'TEACHER_NOTE') {
    if (model === 'observation') {
      return (
        <div>
          <div className="ge-field">
            <label>📌 Nota pedagógica</label>
            <textarea rows={4} value={data.note||''} placeholder="Asegurarse de modelar el proceso antes de que los estudiantes trabajen en parejas. Nivel Azul puede usar el diccionario."
              onChange={e => set('note', e.target.value)} />
          </div>
          <div className="ge-field">
            <label>🎯 Aplica a</label>
            <select value={data.for_level||'all'} onChange={e => set('for_level', e.target.value)}>
              <option value="all">Todos</option>
              <option value="azul">Nivel Azul</option>
              <option value="rojo">Nivel Rojo</option>
            </select>
          </div>
        </div>
      )
    }
    const adaptations = data.adaptations || [{student:'',note:''}]
    function updateAdaptation(i, field, val) {
      const next = [...adaptations]; next[i] = { ...next[i], [field]: val }; set('adaptations', next)
    }
    return (
      <div className="ge-field">
        <label>🧩 Adaptaciones por estudiante / nivel</label>
        {adaptations.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 28px', gap: '6px', marginBottom: '6px' }}>
            <input type="text" value={a.student} placeholder="Nombre / nivel"
              onChange={e => updateAdaptation(i,'student',e.target.value)} />
            <input type="text" value={a.note} placeholder="Adaptación específica"
              onChange={e => updateAdaptation(i,'note',e.target.value)} />
            <button style={{ background:'none',border:'none',color:'#cc4444',cursor:'pointer',fontSize:'16px' }}
              onClick={() => set('adaptations', adaptations.filter((_,j)=>j!==i))}>✕</button>
          </div>
        ))}
        <button style={{ padding:'5px 12px',background:'#1F3864',color:'#fff',border:'none',borderRadius:'4px',fontSize:'11px',cursor:'pointer' }}
          onClick={() => set('adaptations', [...adaptations, {student:'',note:''}])}>
          ＋ Agregar adaptación
        </button>
      </div>
    )
  }

  return <p style={{ color: '#aaa' }}>Formulario no disponible</p>
}
