import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const TYPE_CONFIG = {
  suggest:  { label: 'Sugerencias',  icon: '✨', color: '#8064A2' },
  analyze:  { label: 'Análisis',     icon: '🔍', color: '#4BACC6' },
  generate: { label: 'Generaciones', icon: '🤖', color: '#9BBB59' },
  unknown:  { label: 'Otros',        icon: '⚡', color: '#aaa'    },
}

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function AIUsagePage({ teacher }) {
  const isAdmin = teacher.role === 'admin'
  const [data,      setData]      = useState([])
  const [teachers,  setTeachers]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [month,     setMonth]     = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => { fetchData() }, [month])

  async function fetchData() {
    setLoading(true)

    const [y, m] = month.split('-').map(Number)
    const start  = new Date(y, m-1, 1).toISOString()
    const end    = new Date(y, m,   1).toISOString()

    let query = supabase
      .from('ai_usage')
      .select('*')
      .gte('created_at', start)
      .lt('created_at',  end)
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.eq('teacher_id', teacher.id)
    } else {
      query = query.eq('school_id', teacher.school_id)
    }

    const { data: usageData } = await query
    setData(usageData || [])

    // Fetch teacher names for admin view
    if (isAdmin && usageData?.length) {
      const ids = [...new Set(usageData.map(u => u.teacher_id))]
      const { data: tData } = await supabase
        .from('teachers')
        .select('id, full_name, initials')
        .in('id', ids)
      setTeachers(tData || [])
    }

    setLoading(false)
  }

  function getTeacherName(id) {
    const t = teachers.find(t => t.id === id)
    return t?.full_name || 'Docente'
  }

  // Aggregations
  const totalCalls    = data.length
  const totalCost     = data.reduce((s, r) => s + (r.cost_usd || 0), 0)
  const totalTokens   = data.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0)

  const byType = Object.keys(TYPE_CONFIG).reduce((acc, type) => {
    const rows = data.filter(r => r.type === type)
    acc[type] = { count: rows.length, cost: rows.reduce((s,r) => s+(r.cost_usd||0), 0) }
    return acc
  }, {})

  // By teacher (admin only)
  const byTeacher = isAdmin
    ? data.reduce((acc, r) => {
        if (!acc[r.teacher_id]) acc[r.teacher_id] = { count: 0, cost: 0 }
        acc[r.teacher_id].count++
        acc[r.teacher_id].cost += r.cost_usd || 0
        return acc
      }, {})
    : {}

  // Month options (last 6 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    return { value: `${y}-${m}`, label: `${MONTHS_ES[d.getMonth()]} ${y}` }
  })

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando estadísticas…</p>
    </div>
  )

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">⚡</div>
          Uso de IA
          {isAdmin && <span style={{ fontSize:'10px', color:'#9BBB59', fontWeight:700, marginLeft:'auto' }}>🔒 Vista admin</span>}
        </div>

        {/* Month selector */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {monthOptions.map(o => (
            <button key={o.value}
              onClick={() => setMonth(o.value)}
              style={{
                padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
                borderColor: month === o.value ? '#2E5598' : '#dde5f0',
                background:  month === o.value ? '#2E5598' : '#fff',
                color:       month === o.value ? '#fff'    : '#555',
                fontWeight: 700, fontSize: '12px', cursor: 'pointer',
              }}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Total llamadas', value: totalCalls,               icon:'⚡', color:'#2E5598' },
            { label:'Tokens usados',  value: totalTokens.toLocaleString(), icon:'📝', color:'#4BACC6' },
            { label:'Costo total',    value: `$${totalCost.toFixed(4)} USD`, icon:'💵', color:'#9BBB59' },
          ].map(c => (
            <div key={c.label} style={{
              background: '#f8faff', border: '1.5px solid #dde5f0',
              borderRadius: '10px', padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize:'22px', marginBottom:'4px' }}>{c.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize:'11px', color:'#888', marginTop:'2px' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* By type */}
        <div style={{ marginBottom:'20px' }}>
          <div className="prof-section-title" style={{ marginBottom:'10px' }}>Por tipo de acción</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
              const { count, cost } = byType[type] || { count:0, cost:0 }
              if (!count) return null
              const pct = totalCalls > 0 ? Math.round((count/totalCalls)*100) : 0
              return (
                <div key={type} style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'16px', width:'24px' }}>{cfg.icon}</span>
                  <span style={{ fontSize:'12px', fontWeight:600, color:'#1F3864', width:'110px' }}>{cfg.label}</span>
                  <div style={{ flex:1, background:'#eee', borderRadius:'10px', height:'8px', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, background: cfg.color, height:'100%', borderRadius:'10px', transition:'width .3s' }} />
                  </div>
                  <span style={{ fontSize:'11px', color:'#888', width:'30px', textAlign:'right' }}>{count}</span>
                  <span style={{ fontSize:'11px', color:'#888', width:'80px', textAlign:'right' }}>${cost.toFixed(4)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* By teacher (admin only) */}
        {isAdmin && Object.keys(byTeacher).length > 0 && (
          <div style={{ marginBottom:'20px' }}>
            <div className="prof-section-title" style={{ marginBottom:'10px' }}>Por docente</div>
            {Object.entries(byTeacher)
              .sort(([,a],[,b]) => b.cost - a.cost)
              .map(([tid, stats]) => (
                <div key={tid} style={{
                  display:'flex', alignItems:'center', gap:'12px',
                  padding:'10px 14px', marginBottom:'6px',
                  background:'#fafcff', border:'1.5px solid #dde5f0',
                  borderRadius:'8px',
                }}>
                  <div style={{
                    width:'32px', height:'32px', borderRadius:'50%',
                    background:'#9BBB59', color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:700, fontSize:'12px', flexShrink:0,
                  }}>
                    {teachers.find(t=>t.id===tid)?.initials || '?'}
                  </div>
                  <span style={{ flex:1, fontSize:'13px', fontWeight:600, color:'#1F3864' }}>
                    {getTeacherName(tid)}
                  </span>
                  <span style={{ fontSize:'12px', color:'#888' }}>{stats.count} llamadas</span>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'#2E5598' }}>
                    ${stats.cost.toFixed(4)} USD
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Recent calls */}
        {data.length > 0 && (
          <div>
            <div className="prof-section-title" style={{ marginBottom:'10px' }}>
              Historial reciente
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {data.slice(0, 20).map(row => {
                const cfg = TYPE_CONFIG[row.type] || TYPE_CONFIG.unknown
                const d   = new Date(row.created_at)
                return (
                  <div key={row.id} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'8px 12px', background:'#fafcff',
                    border:'1px solid #eee', borderRadius:'6px',
                    fontSize:'11px',
                  }}>
                    <span style={{ fontSize:'14px' }}>{cfg.icon}</span>
                    <span style={{ color: cfg.color, fontWeight:700, width:'90px' }}>{cfg.label}</span>
                    {isAdmin && (
                      <span style={{ color:'#555', flex:1 }}>{getTeacherName(row.teacher_id)}</span>
                    )}
                    <span style={{ color:'#aaa', marginLeft: isAdmin ? 0 : 'auto' }}>
                      {d.toLocaleDateString('es-CO')} {d.toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'})}
                    </span>
                    <span style={{ color:'#888', width:'60px', textAlign:'right' }}>
                      {(row.input_tokens + row.output_tokens).toLocaleString()} tok
                    </span>
                    <span style={{ color:'#2E5598', fontWeight:700, width:'70px', textAlign:'right' }}>
                      ${row.cost_usd?.toFixed(5)}
                    </span>
                  </div>
                )
              })}
            </div>
            {data.length > 20 && (
              <p style={{ fontSize:'11px', color:'#aaa', textAlign:'center', marginTop:'8px' }}>
                Mostrando los 20 más recientes de {data.length} total
              </p>
            )}
          </div>
        )}

        {data.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize:'48px' }}>⚡</div>
            <p>No hay uso de IA registrado este mes.</p>
            <p style={{ fontSize:'12px', color:'#aaa', marginTop:'6px' }}>
              Usa ✨ Sugerir, 🔍 Analizar o 🤖 Generar en el editor para ver estadísticas aquí.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
