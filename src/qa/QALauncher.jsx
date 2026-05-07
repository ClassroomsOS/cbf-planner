// QALauncher — modal para seleccionar y arrancar una suite de pruebas
import { useQA } from './QAContext'
import { QA_SUITES } from './suites/index'

const STATUS_COLORS = { pass: '#16a34a', fail: '#dc2626', skip: '#d97706' }

export default function QALauncher({ onClose, lastResults }) {
  const { startSuite } = useQA()

  function handleStart(suite) {
    startSuite(suite)
    onClose()
  }

  return (
    <div className="qa-launcher-overlay" onClick={onClose}>
      <div className="qa-launcher-modal" onClick={e => e.stopPropagation()}>
        <div className="qa-launcher-header">
          <div>
            <span className="qa-launcher-icon">🧪</span>
            <h2>Modo QA</h2>
          </div>
          <button className="qa-launcher-close" onClick={onClose}>✕</button>
        </div>

        <p className="qa-launcher-desc">
          Selecciona una suite para iniciar la verificación guiada. El panel QA aparecerá
          encima de la app y te irá indicando cada paso a verificar.
        </p>

        <div className="qa-suite-list">
          {QA_SUITES.map(suite => {
            const last = lastResults[suite.id]
            return (
              <div key={suite.id} className="qa-suite-card">
                <div className="qa-suite-card-left">
                  <span className="qa-suite-icon">{suite.icon}</span>
                  <div>
                    <div className="qa-suite-name">{suite.name}</div>
                    <div className="qa-suite-meta">
                      {suite.steps.length} pasos · ~{suite.estimatedMin} min
                    </div>
                    <div className="qa-suite-desc">{suite.description}</div>
                  </div>
                </div>
                <div className="qa-suite-card-right">
                  {last && (
                    <div className="qa-suite-last">
                      <span style={{ color: STATUS_COLORS.pass }}>✓{last.pass}</span>
                      {last.fail > 0 && <span style={{ color: STATUS_COLORS.fail }}>✗{last.fail}</span>}
                      {last.skip > 0 && <span style={{ color: STATUS_COLORS.skip }}>⏭{last.skip}</span>}
                    </div>
                  )}
                  <button className="qa-suite-start-btn" onClick={() => handleStart(suite)}>
                    Iniciar →
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="qa-launcher-footer">
          <span className="qa-launcher-note">
            Solo visible para administradores · Los datos de prueba son reales
          </span>
        </div>
      </div>
    </div>
  )
}
