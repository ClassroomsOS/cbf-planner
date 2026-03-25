import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUS_LABELS = {
  draft:     { label: 'Borrador',   color: '#aaa' },
  complete:  { label: 'Completa',   color: '#4BACC6' },
  submitted: { label: 'Enviada',    color: '#F79646' },
  approved:  { label: 'Aprobada',   color: '#9BBB59' },
}

export default function MyPlansPage({ teacher }) {
  const [plans, setPlans]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('lesson_plans')
      .select('*')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPlans(data || []); setLoading(false) })
  }, [teacher.id])

  async function deletePlan(id) {
    if (!confirm('¿Eliminar esta guía?')) return
    await supabase.from('lesson_plans').delete().eq('id', id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="loading-text">Cargando guías...</div>

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📚</div>
          Mis Guías ({plans.length})
        </div>

        {plans.length === 0 ? (
          <div className="empty-state">
            <div style={{fontSize:'48px'}}>📋</div>
            <p>Aún no tienes guías guardadas.</p>
            <p style={{fontSize:'12px',color:'#aaa'}}>Crea tu primera guía desde "Nueva Guía"</p>
          </div>
        ) : (
          <div className="plans-list">
            {plans.map(plan => {
              const st = STATUS_LABELS[plan.status] || STATUS_LABELS.draft
              return (
                <div key={plan.id} className="plan-card">
                  <div className="plan-card-left">
                    <div className="plan-title">{plan.title}</div>
                    <div className="plan-meta">
                      {plan.date_range && <span>📅 {plan.date_range}</span>}
                      <span>· {plan.period}</span>
                    </div>
                  </div>
                  <div className="plan-card-right">
                    <span className="status-badge" style={{background: st.color + '22', color: st.color, border: `1px solid ${st.color}`}}>
                      {st.label}
                    </span>
                    <button className="btn-icon-danger" onClick={() => deletePlan(plan.id)} title="Eliminar">
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
