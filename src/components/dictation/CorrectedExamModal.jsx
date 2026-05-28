// ── CorrectedExamModal.jsx ────────────────────────────────────────────────────
// Reusable modal for viewing corrected dictation responses.
// Used by both SessionControlPage (Sala de Control) and MonitorTab.

import { createPortal } from 'react-dom'
import { supabase } from '../../supabase'
import { gradeColor, SECTION_META } from '../../utils/dictationUtils'
import { printCorrectedHtml } from '../../utils/exportDictationHtml'

export default function CorrectedExamModal({
  view,          // { inst, responses }
  result,        // dictation_results row for this instance (or null)
  blueprint,     // dictation_blueprints row
  teacher,       // teacher object (for school_id + teacherName)
  onClose,
  emailSent,     // Set of instance IDs already emailed
  emailLoading,  // instance ID currently being emailed (or null)
  onEmail,       // (inst) => void
}) {
  if (!view) return null

  async function handlePrint() {
    if (!blueprint) return
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', teacher.school_id)
      .single()
    printCorrectedHtml({
      blueprint,
      instance:    view.inst,
      responses:   view.responses,
      result:      result || null,
      school,
      teacherName: teacher.full_name || teacher.email,
    })
  }

  const inst = view.inst
  const g = result ? parseFloat(result.colombian_grade) : null

  return createPortal(
    <div className="ctrl-corrected-overlay" onClick={onClose}>
      <div className="ctrl-corrected-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ctrl-corrected-header">
          <div>
            <h3 className="ctrl-corrected-title">📋 Respuestas Corregidas</h3>
            <p className="ctrl-corrected-meta">
              {inst.student_name} · {inst.student_section}
              {inst.student_code && ` · ${inst.student_code}`}
            </p>
          </div>
          <div className="ctrl-corrected-actions-top">
            <button className="ctrl-corrected-print-btn" onClick={handlePrint}>
              🖨️ PDF corregido
            </button>
            <button
              className="ctrl-corrected-email-btn"
              onClick={() => onEmail(inst)}
              disabled={emailLoading === inst.id || emailSent.has(inst.id)}
            >
              {emailLoading === inst.id
                ? '📡 Enviando...'
                : emailSent.has(inst.id)
                ? '✅ Email enviado'
                : '📧 Representante'}
            </button>
            <button className="ctrl-corrected-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Result bar */}
        {result && (
          <div className="ctrl-corrected-result-bar" style={{ borderLeftColor: gradeColor(g) }}>
            <span className="ctrl-corrected-grade" style={{ color: gradeColor(g) }}>
              {result.colombian_grade}/5.0
            </span>
            <span className="ctrl-corrected-level" style={{ color: gradeColor(g) }}>
              {result.grade_level}
            </span>
            <span className="ctrl-corrected-pts">
              {result.total_score}/{result.max_score} pts
            </span>
          </div>
        )}

        {/* Questions */}
        <div className="ctrl-corrected-body">
          {view.responses.length === 0 ? (
            <p className="ctrl-corrected-empty">No hay respuestas registradas aún.</p>
          ) : (() => {
            const questions = inst.generated_questions || []
            const secMap = {}
            const secOrder = []
            questions.forEach((q, idx) => {
              const type = q.question_type || 'unknown'
              if (!secMap[type]) {
                secMap[type] = { type, title: q.section_title || type, items: [] }
                secOrder.push(type)
              }
              const resp = view.responses.find(r => r.question_index === idx) || {}
              secMap[type].items.push({ ...q, globalIndex: idx, resp })
            })
            let num = 1
            return secOrder.map(type => {
              const sec = secMap[type]
              const meta = SECTION_META[type] || {}
              const correctCount = sec.items.filter(it => it.resp?.is_correct).length
              return (
                <div key={type} className="ctrl-corrected-section">
                  <div className="ctrl-corrected-sec-header" style={{ background: meta.color || '#666' }}>
                    <span>{meta.icon} {sec.title}</span>
                    <span className="ctrl-corrected-sec-score">{correctCount}/{sec.items.length}</span>
                  </div>
                  {sec.items.map(item => {
                    const isOk = item.resp?.is_correct
                    const n = num++
                    return (
                      <div key={item.globalIndex} className={`ctrl-corrected-q ${isOk ? 'ctrl-corrected-q-ok' : 'ctrl-corrected-q-wrong'}`}>
                        <div className="ctrl-corrected-q-num">{n}. {isOk ? '✓' : '✗'}</div>
                        <div className="ctrl-corrected-q-body">
                          {item.audio_text && (
                            <div className="ctrl-corrected-q-ctx">🔊 "{item.audio_text}"</div>
                          )}
                          {item.sentence && (
                            <div className="ctrl-corrected-q-ctx">{item.sentence}</div>
                          )}
                          {item.options?.length > 0 && (
                            <div className="ctrl-corrected-q-opts">{item.options.join('  ·  ')}</div>
                          )}
                          <div className="ctrl-corrected-q-answer" style={{ color: isOk ? '#15803D' : '#DC2626' }}>
                            <span className="ctrl-corrected-q-label">Respuesta:</span>
                            {item.resp?.answer || '(en blanco)'}
                          </div>
                          {!isOk && item.resp?.correct_answer && (
                            <div className="ctrl-corrected-q-answer" style={{ color: '#15803D' }}>
                              <span className="ctrl-corrected-q-label">Correcta:</span>
                              {item.resp.correct_answer}
                            </div>
                          )}
                        </div>
                        <div className="ctrl-corrected-q-pts" style={{ color: isOk ? '#15803D' : '#DC2626' }}>
                          {item.resp?.score ?? 0}/{item.resp?.max_score ?? 1}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>

      </div>
    </div>,
    document.body
  )
}
