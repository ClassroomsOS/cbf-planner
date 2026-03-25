import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function PlannerPage({ teacher }) {
  const school        = teacher.schools || {}
  const classSubjects = teacher.class_subjects || []
  const allSubjects   = teacher.subjects || []

  // Derive class labels from class_subjects
  const classLabels = classSubjects.map(cs => `${cs.grade} ${cs.section}`)

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [grade,   setGrade]   = useState(teacher.default_class   || '')
  const [subject, setSubject] = useState(teacher.default_subject || '')
  const [period,  setPeriod]  = useState(teacher.default_period  || '1.er Período 2026')
  const [week,    setWeek]    = useState('')
  const [dates,   setDates]   = useState('')

  // Subjects available for the selected class
  const selectedEntry     = classSubjects.find(cs => `${cs.grade} ${cs.section}` === grade)
  const availableSubjects = selectedEntry?.subjects?.length ? selectedEntry.subjects : allSubjects

  // Reset subject when class changes (if current subject not in new list)
  useEffect(() => {
    if (subject && !availableSubjects.includes(subject)) {
      setSubject('')
    }
  }, [grade])

  async function saveDraft() {
    setSaving(true)
    const { error } = await supabase.from('lesson_plans').insert({
      teacher_id:  teacher.id,
      school_id:   teacher.school_id,
      grade, subject, period,
      week_number: parseInt(week) || null,
      date_range:  dates,
      status:      'draft',
      content:     { grade, subject, period, week, dates },
    })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📋</div>
          Nueva Guía de Aprendizaje
        </div>

        <div className="g4">
          {/* Grado/Clase */}
          <div className="field">
            <label>Grado / Clase</label>
            <select value={grade} onChange={e => setGrade(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {classLabels.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Asignatura — filtrada por clase */}
          <div className="field">
            <label>Asignatura</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {availableSubjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Período */}
          <div className="field">
            <label>Período</label>
            <select value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="1.er Período 2026">1.er Período 2026</option>
              <option value="2.do Período 2026">2.do Período 2026</option>
              <option value="3.er Período 2026">3.er Período 2026</option>
              <option value="4.to Período 2026">4.to Período 2026</option>
            </select>
          </div>

          {/* Semana */}
          <div className="field">
            <label>Semana N°</label>
            <input type="number" value={week} onChange={e => setWeek(e.target.value)}
              placeholder="Ej: 5" min={1} max={40} />
          </div>
        </div>

        <div className="field">
          <label>Rango de fechas</label>
          <input value={dates} onChange={e => setDates(e.target.value)}
            placeholder="Ej: Mar. 24–28, 2026" />
        </div>

        {/* Versículo */}
        <div className="verse-box">
          {school.year_verse}
          <span className="verse-ref">— {school.year_verse_ref}</span>
        </div>

        {/* Coming soon */}
        <div className="coming-soon-notice">
          🚧 El editor completo de actividades por día estará aquí.
          Por ahora puedes guardar el encabezado como borrador.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <button className="btn-primary" onClick={saveDraft} disabled={saving || !grade || !subject}>
            {saving ? '⏳ Guardando...' : '💾 Guardar borrador'}
          </button>
          {saved && <span style={{ color: '#9BBB59', fontWeight: 600, alignSelf: 'center' }}>✅ Guardado</span>}
        </div>
      </div>
    </div>
  )
}
