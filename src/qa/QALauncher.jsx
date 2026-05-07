// QALauncher — selector de suites + historial de runs desde Supabase
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useQA } from './QAContext'
import { QA_SUITES } from './suites/index'

const STATUS_COLORS = { pass: '#16a34a', fail: '#dc2626', skip: '#d97706' }

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default function QALauncher({ onClose, lastResults, teacher }) {
  const { startSuite } = useQA()
  const [history,      setHistory]      = useState([])
  const [loadingHist,  setLoadingHist]  = useState(true)
  const [activeTab,    setActiveTab]    = useState('suites')   // 'suites' | 'history'
  const [expandedRun,  setExpandedRun]  = useState(null)

  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    setLoadingHist(true)
    const { data } = await supabase
      .from('qa_runs')
      .select('*, runner:runner_id(full_name, initials)')
      .eq('school_id', teacher.school_id)
      .order('ran_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
    setLoadingHist(false)
  }

  function handleStart(suite) {
    startSuite(suite)
    onClose()
  }

  return (
    <div className="qa-launcher-overlay" onClick={onClose}>
      <div className="qa-launcher-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="qa-launcher-header">
          <div>
            <span className="qa-launcher-icon">🧪</span>
            <h2>Modo QA</h2>
          </div>
          <button className="qa-launcher-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="qa-launcher-tabs">
          <button
            className={`qa-launcher-tab ${activeTab === 'suites' ? 'active' : ''}`}
            onClick={() => setActiveTab('suites')}>
            Suites
          </button>
          <button
            className={`qa-launcher-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}>
            Historial {history.length > 0 && <span className="qa-hist-count">{history.length}</span>}
          </button>
        </div>

        {/* ── Tab: Suites ── */}
        {activeTab === 'suites' && (
          <>
            <p className="qa-launcher-desc">
              Selecciona una suite para iniciar la verificación guiada. El panel QA
              aparecerá encima de la app indicándote cada paso.
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
          </>
        )}

        {/* ── Tab: Historial ── */}
        {activeTab === 'history' && (
          <div className="qa-history">
            {loadingHist ? (
              <div className="qa-history-empty">Cargando historial…</div>
            ) : history.length === 0 ? (
              <div className="qa-history-empty">
                Aún no hay runs guardados. Completa una suite y aparecerá aquí.
              </div>
            ) : (
              <div className="qa-history-list">
                {history.map(run => {
                  const hasFailures = run.failed > 0
                  const isOpen = expandedRun === run.id
                  return (
                    <div key={run.id} className={`qa-hist-row ${hasFailures ? 'qa-hist-row--fail' : 'qa-hist-row--ok'}`}>
                      <div className="qa-hist-row-main" onClick={() => setExpandedRun(isOpen ? null : run.id)}>
                        <div className="qa-hist-left">
                          <span className="qa-hist-icon">{hasFailures ? '⚠️' : '✅'}</span>
                          <div>
                            <div className="qa-hist-suite">{run.suite_name}</div>
                            <div className="qa-hist-meta">
                              {run.runner?.full_name || 'Desconocido'} · {formatDate(run.ran_at)}
                            </div>
                          </div>
                        </div>
                        <div className="qa-hist-right">
                          <span className="qa-hist-stat qa-hist-stat--pass">✓{run.passed}</span>
                          {run.failed > 0 && <span className="qa-hist-stat qa-hist-stat--fail">✗{run.failed}</span>}
                          {run.skipped > 0 && <span className="qa-hist-stat qa-hist-stat--skip">⏭{run.skipped}</span>}
                          <span className="qa-hist-chevron">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expandable detail */}
                      {isOpen && run.results && (
                        <div className="qa-hist-detail">
                          {run.results.map((r, i) => {
                            const isPass = r.status === 'pass'
                            const isFail = r.status === 'fail'
                            return (
                              <div key={r.stepId} className={`qa-hist-step ${isFail ? 'qa-hist-step--fail' : ''}`}>
                                <span className="qa-hist-step-num">{i + 1}</span>
                                <span className="qa-hist-step-icon">
                                  {isPass ? '✓' : isFail ? '✗' : '⏭'}
                                </span>
                                <div className="qa-hist-step-body">
                                  <span className="qa-hist-step-title">{r.title}</span>
                                  {r.note && <span className="qa-hist-step-note">"{r.note}"</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="qa-launcher-footer">
          <span className="qa-launcher-note">
            Solo visible para administradores · Los runs se guardan en la base de datos
          </span>
        </div>
      </div>
    </div>
  )
}
