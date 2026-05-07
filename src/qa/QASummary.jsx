// QASummary — resultados al terminar una suite
import { useQA } from './QAContext'

const STATUS = {
  pass: { label: 'Pasa',  color: '#16a34a', bg: '#f0fdf4', icon: '✓' },
  fail: { label: 'Falla', color: '#dc2626', bg: '#fef2f2', icon: '✗' },
  skip: { label: 'Skip',  color: '#d97706', bg: '#fffbeb', icon: '⏭' },
}

export default function QASummary({ onClose, onStoreLast }) {
  const { suite, results, reset } = useQA()

  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  const total  = results.length
  const pct    = total > 0 ? Math.round((passed / total) * 100) : 0

  function handleClose() {
    if (onStoreLast && suite) {
      onStoreLast(suite.id, { pass: passed, fail: failed, skip: skipped })
    }
    reset()
    onClose()
  }

  function handlePrint() {
    window.print()
  }

  const overallOk = failed === 0

  return (
    <div className="qa-summary-overlay">
      <div className="qa-summary-modal">

        {/* Header */}
        <div className={`qa-summary-header ${overallOk ? 'qa-summary-header--ok' : 'qa-summary-header--fail'}`}>
          <div className="qa-summary-result-icon">{overallOk ? '✅' : '⚠️'}</div>
          <div>
            <h2 className="qa-summary-title">
              {overallOk ? 'Suite completada sin fallos' : `${failed} paso${failed !== 1 ? 's' : ''} con fallo`}
            </h2>
            <p className="qa-summary-suite-name">{suite?.name}</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="qa-summary-stats">
          <div className="qa-stat qa-stat--pass">
            <span className="qa-stat-num">{passed}</span>
            <span className="qa-stat-lbl">Pasaron</span>
          </div>
          <div className="qa-stat qa-stat--fail">
            <span className="qa-stat-num">{failed}</span>
            <span className="qa-stat-lbl">Fallaron</span>
          </div>
          <div className="qa-stat qa-stat--skip">
            <span className="qa-stat-num">{skipped}</span>
            <span className="qa-stat-lbl">Saltados</span>
          </div>
          <div className="qa-stat">
            <span className="qa-stat-num">{pct}%</span>
            <span className="qa-stat-lbl">Aprobación</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="qa-summary-bar-wrap">
          <div className="qa-summary-bar">
            <div className="qa-summary-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Steps table */}
        <div className="qa-summary-table-wrap">
          <table className="qa-summary-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Paso</th>
                <th>Resultado</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const s = STATUS[r.status] || STATUS.skip
                return (
                  <tr key={r.stepId}>
                    <td className="qa-summary-num">{i + 1}</td>
                    <td className="qa-summary-step-title">{r.title}</td>
                    <td>
                      <span className="qa-badge" style={{ color: s.color, background: s.bg }}>
                        {s.icon} {s.label}
                      </span>
                    </td>
                    <td className="qa-summary-note">{r.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="qa-summary-footer">
          <button className="qa-btn-outline" onClick={handlePrint}>🖨 Imprimir</button>
          <div style={{ flex: 1 }} />
          <button className="qa-btn-secondary" onClick={handleClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
