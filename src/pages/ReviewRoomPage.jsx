// ── ReviewRoomPage.jsx ────────────────────────────────────────────────────────
// /sala-revision — Vista de revisión para coordinador/rector.
//
// Flujo:
//   docente envía guía (status='submitted') → aparece en cola de revisión
//   coordinador la abre, revisa, aprueba o devuelve con feedback
//   al abrir la guía de otro docente → aviso previo + justificación al guardar
//   al aprobar → notificación al docente
//   al publicar → snapshot en lesson_plan_versions + lock

import { useState, useEffect, useCallback } from 'react'
import { createPortal }  from 'react-dom'
import { useNavigate }   from 'react-router-dom'
import { supabase }      from '../supabase'
import FeedbackModal     from '../components/FeedbackModal'
import VersionHistoryModal from '../components/VersionHistoryModal'
import { canGiveFeedback } from '../utils/roles'
import { useToast }      from '../context/ToastContext'

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META = {
  draft:     { label: 'Borrador',   bg: '#FFF8E1', color: '#7A6200', dot: '#F59E0B', border: '#FDE68A' },
  submitted: { label: 'Enviada',    bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6', border: '#BFDBFE' },
  approved:  { label: 'Aprobada',   bg: '#F0FDF4', color: '#15803D', dot: '#22C55E', border: '#BBF7D0' },
  complete:  { label: 'Completa',   bg: '#F0FDF4', color: '#15803D', dot: '#22C55E', border: '#BBF7D0' },
  published: { label: 'Publicada',  bg: '#ECFDF5', color: '#065F46', dot: '#10B981', border: '#A7F3D0' },
  archived:  { label: 'Archivada',  bg: '#F5F5F5', color: '#6B7280', dot: '#9CA3AF', border: '#E5E7EB' },
}

const STATUS_BORDER = {
  submitted: '#3B82F6',
  approved:  '#22C55E',
  published: '#10B981',
  complete:  '#22C55E',
  draft:     '#E2E8F0',
  archived:  '#E2E8F0',
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── StatTile ─────────────────────────────────────────────────────────────────
function StatTile({ value, label, color, bg, border, onClick, urgent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 120px', minWidth: 100, padding: '14px 16px',
        background: bg, border: `1.5px solid ${border}`,
        borderRadius: 12, cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', transition: 'transform .15s, box-shadow .15s',
        boxShadow: urgent ? `0 0 0 3px ${border}40` : '0 1px 3px rgba(0,0,0,.06)',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)' }}}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = urgent ? `0 0 0 3px ${border}40` : '0 1px 3px rgba(0,0,0,.06)' }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: color + 'BB', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
      {urgent && value > 0 && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          background: color, animation: 'pulse-dot 1.8s ease-in-out infinite',
        }} />
      )}
    </button>
  )
}

// ── IntentModal — shown before opening another teacher's guide ────────────────
function IntentModal({ plan, ownerName, onConfirm, onCancel }) {
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16,
      animation: 'fade-up .2s ease',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 460, maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#92400E,#B45309)',
          padding: '18px 22px', color: '#fff',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>✏️ Editar guía de otro docente</div>
          <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>
            Esta acción quedará registrada y el docente será notificado.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            Estás a punto de abrir la guía de{' '}
            <strong style={{ color: '#1F3864' }}>{ownerName}</strong>
            {plan && <>
              {' '}—{' '}
              <span style={{ color: '#64748B' }}>
                {plan.subject}, {plan.grade}, Sem. {plan.week_number}
              </span>
            </>}.
          </p>

          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
            padding: '12px 14px', fontSize: 13, color: '#78350F', lineHeight: 1.5,
          }}>
            <strong>Al guardar cambios</strong> se te pedirá una justificación y{' '}
            <strong>{ownerName?.split(' ')[0]}</strong> recibirá una notificación inmediata.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end',
          borderTop: '1px solid #F1F5F9',
        }}>
          <button type="button" onClick={onCancel}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid #D0D5DD',
              background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: '#B45309', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            Entendido · Abrir guía →
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan, teacherMap, feedbackCounts, currentTeacher,
  changingId, onChangeStatus, onPublish, onUnlock,
  onOpenEditor, onFeedback, onVersionHistory,
  canFeedback, compact,
}) {
  const t       = teacherMap[plan.teacher_id]
  const fb      = feedbackCounts[plan.id]
  const isOwn   = plan.teacher_id === currentTeacher.id
  const preview = (() => {
    try { return (plan.content?.objetivo?.general || '').replace(/<[^>]+>/g, '').slice(0, 100) }
    catch { return '' }
  })()
  const isBusy = changingId === plan.id

  return (
    <div style={{
      border: `1.5px solid ${STATUS_BORDER[plan.status] || '#E2E8F0'}`,
      borderRadius: 12, padding: compact ? '10px 14px' : '14px 16px',
      background: isOwn ? '#FAFEFF' : '#fff',
      transition: 'box-shadow .15s',
      boxShadow: plan.status === 'submitted' ? '0 2px 8px rgba(59,130,246,.12)' : '0 1px 3px rgba(0,0,0,.04)',
      animation: 'fade-up .2s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Left: content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>{plan.subject}</span>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>
              Sem. {plan.week_number}{plan.week_count === 2 ? '–' + (plan.week_number + 1) : ''} · P{plan.period}
            </span>
            <StatusBadge status={plan.status} />
            {plan.locked && (
              <span style={{
                background: '#FEF9C3', color: '#854D0E',
                borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                border: '1px solid #FDE047',
              }}>🔒 Bloqueada</span>
            )}
            {isOwn && (
              <span style={{ background: '#E0F2FE', color: '#0369A1', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                Mi guía
              </span>
            )}
            {fb?.open > 0 && (
              <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                💬 {fb.open} pendiente{fb.open !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {preview && !compact && (
            <p style={{
              margin: '0 0 6px', fontSize: 12, color: '#64748B',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{preview}</p>
          )}

          {t && (
            <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: '#E2E8F0', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#475569', flexShrink: 0,
              }}>
                {(t.initials || t.full_name?.slice(0,2) || '??').toUpperCase()}
              </span>
              {t.full_name?.split(' ').slice(0,2).join(' ')}
              <span style={{ color: '#CBD5E1' }}>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{formatDateTime(plan.updated_at)}</span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>

          {/* submitted → approve / return */}
          {plan.status === 'submitted' && (
            <>
              <button type="button" disabled={isBusy}
                onClick={() => onChangeStatus(plan, 'approved')}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: '#15803D', color: '#fff', border: 'none',
                  cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? .5 : 1,
                  transition: 'opacity .15s',
                }}>
                {isBusy ? '…' : '✓ Aprobar'}
              </button>
              <button type="button" disabled={isBusy}
                onClick={() => { onFeedback(plan); onChangeStatus(plan, 'draft') }}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: '#FEF2F2', color: '#DC2626',
                  border: '1px solid #FCA5A5',
                  cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? .5 : 1,
                }}>
                ↩ Devolver
              </button>
            </>
          )}

          {/* approved → publish / re-open */}
          {(plan.status === 'approved' || plan.status === 'complete') && !plan.locked && (
            <>
              <button type="button" disabled={isBusy}
                onClick={() => onPublish(plan)}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: '#065F46', color: '#fff', border: 'none',
                  cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? .5 : 1,
                }}>
                {isBusy ? '…' : '📦 Publicar'}
              </button>
              <button type="button" disabled={isBusy}
                onClick={() => onChangeStatus(plan, 'submitted')}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                  cursor: isBusy ? 'default' : 'pointer',
                }}>
                ↩ Reabrir
              </button>
            </>
          )}

          {/* published + locked → unlock */}
          {plan.status === 'published' && plan.locked && (
            <button type="button" disabled={isBusy}
              onClick={() => onUnlock(plan)}
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047',
                cursor: isBusy ? 'default' : 'pointer',
              }}>
              🔓 Desbloquear
            </button>
          )}

          <button type="button" onClick={() => onOpenEditor(plan)}
            style={{
              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: '#1F3864', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
            ✏️ Abrir
          </button>

          <button type="button" onClick={() => onVersionHistory(plan)}
            title="Historial de versiones"
            style={{
              padding: '6px 10px', borderRadius: 7, fontSize: 13,
              background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', cursor: 'pointer',
            }}>
            📋
          </button>

          {canFeedback && (
            <button type="button" onClick={() => onFeedback(plan)}
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: fb?.open > 0 ? '#FEF2F2' : '#F8FAFC',
                color: fb?.open > 0 ? '#DC2626' : '#374151',
                border: `1px solid ${fb?.open > 0 ? '#FCA5A5' : '#E2E8F0'}`,
                cursor: 'pointer',
              }}>
              💬 Feedback
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReviewRoomPage({ teacher }) {
  const navigate      = useNavigate()
  const { showToast } = useToast()
  const canFeedback   = canGiveFeedback(teacher.role)

  const [plans,          setPlans]          = useState([])
  const [teacherMap,     setTeacherMap]     = useState({})
  const [feedbackCounts, setFeedbackCounts] = useState({})
  const [loading,        setLoading]        = useState(true)
  const [expanded,       setExpanded]       = useState({})

  // filters
  const [filterStatus,    setFilterStatus]    = useState('')
  const [filterSubject,   setFilterSubject]   = useState('')
  const [filterTeacherId, setFilterTeacherId] = useState('')
  const [filterGrade,     setFilterGrade]     = useState('')

  // modals
  const [feedbackPlan,   setFeedbackPlan]   = useState(null)
  const [versionPlan,    setVersionPlan]    = useState(null)
  const [intentPlan,     setIntentPlan]     = useState(null)  // pre-editor confirmation
  const [intentOwner,    setIntentOwner]    = useState(null)

  const [changingId,     setChangingId]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)

    const { data: trows } = await supabase
      .from('teachers')
      .select('id, full_name, initials, role')
      .eq('school_id', teacher.school_id)

    const tmap = {}
    for (const t of trows || []) tmap[t.id] = t
    setTeacherMap(tmap)

    const { data: prows } = await supabase
      .from('lesson_plans')
      .select('id, grade, subject, week_number, week_count, period, status, locked, updated_at, teacher_id, content')
      .order('updated_at', { ascending: false })
      .limit(400)

    const schoolPlans = (prows || []).filter(p => tmap[p.teacher_id])
    setPlans(schoolPlans)

    // Auto-expand grades with submitted plans first
    const submittedGrades = [...new Set(schoolPlans.filter(p => p.status === 'submitted').map(p => p.grade))]
    const otherGrades     = [...new Set(schoolPlans.map(p => p.grade))].filter(g => !submittedGrades.includes(g))
    const initExpand = {}
    for (const g of submittedGrades) initExpand[g] = true
    for (const g of otherGrades.slice(0, 2)) initExpand[g] = true
    setExpanded(initExpand)

    // Feedback counts
    if (schoolPlans.length) {
      const ids = schoolPlans.map(p => p.id)
      const { data: fbrows } = await supabase
        .from('document_feedback')
        .select('entity_id, resolved')
        .in('entity_id', ids)
        .eq('entity_type', 'guide')
      const counts = {}
      for (const fb of fbrows || []) {
        if (!counts[fb.entity_id]) counts[fb.entity_id] = { total: 0, open: 0 }
        counts[fb.entity_id].total++
        if (!fb.resolved) counts[fb.entity_id].open++
      }
      setFeedbackCounts(counts)
    }

    setLoading(false)
  }, [teacher.school_id])

  useEffect(() => { load() }, [load])

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleChangeStatus(plan, newStatus) {
    setChangingId(plan.id)
    const { error } = await supabase.from('lesson_plans').update({ status: newStatus }).eq('id', plan.id)
    if (error) { showToast('Error: ' + error.message, 'error'); setChangingId(null); return }

    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: newStatus } : p))
    const planTitle = `${plan.subject} — ${plan.grade}, Sem. ${plan.week_number}`
    const t = teacherMap[plan.teacher_id]

    if (newStatus === 'approved') {
      await supabase.from('notifications').insert({
        school_id: teacher.school_id, from_id: teacher.id,
        to_id: plan.teacher_id, to_role: 'teacher',
        type: 'plan_approved', plan_id: plan.id,
        message: `Tu guía "${planTitle}" fue aprobada ✅ por ${teacher.full_name}.`,
      })
      showToast(`✓ Aprobada · ${t?.full_name?.split(' ')[0] || ''} notificado`, 'success')
    } else if (newStatus === 'draft') {
      await supabase.from('notifications').insert({
        school_id: teacher.school_id, from_id: teacher.id,
        to_id: plan.teacher_id, to_role: 'teacher',
        type: 'plan_returned', plan_id: plan.id,
        message: `Tu guía "${planTitle}" fue devuelta para correcciones por ${teacher.full_name}. Revisa el feedback.`,
      })
      showToast(`↩ Devuelta · ${t?.full_name?.split(' ')[0] || ''} notificado`, 'info')
    } else {
      showToast('Estado actualizado', 'success')
    }
    setChangingId(null)
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  async function handlePublish(plan) {
    setChangingId(plan.id)

    const { count } = await supabase
      .from('lesson_plan_versions').select('id', { count: 'exact', head: true }).eq('plan_id', plan.id)
    const nextVersion = (count || 0) + 1

    const { error: verErr } = await supabase.from('lesson_plan_versions').insert({
      plan_id: plan.id, school_id: teacher.school_id,
      version: nextVersion, status: 'published',
      content: plan.content, archived_by: teacher.id,
    })

    if (verErr) { showToast('Error al crear snapshot: ' + verErr.message, 'error'); setChangingId(null); return }

    const { error: planErr } = await supabase.from('lesson_plans')
      .update({ status: 'published', locked: true }).eq('id', plan.id)

    if (planErr) { showToast('Error al publicar: ' + planErr.message, 'error'); setChangingId(null); return }

    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'published', locked: true } : p))

    const t = teacherMap[plan.teacher_id]
    await supabase.from('notifications').insert({
      school_id: teacher.school_id, from_id: teacher.id,
      to_id: plan.teacher_id, to_role: 'teacher',
      type: 'plan_published', plan_id: plan.id,
      message: `Tu guía "${plan.subject} — ${plan.grade}" fue publicada 📦 (v${nextVersion}) por ${teacher.full_name}.`,
    })
    showToast(`📦 Publicada v${nextVersion} · ${t?.full_name?.split(' ')[0] || ''} notificado`, 'success')
    setChangingId(null)
  }

  // ── Unlock ────────────────────────────────────────────────────────────────
  async function handleUnlock(plan) {
    setChangingId(plan.id)
    const { error } = await supabase.from('lesson_plans').update({ locked: false, status: 'approved' }).eq('id', plan.id)
    if (error) { showToast('Error al desbloquear', 'error'); setChangingId(null); return }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, locked: false, status: 'approved' } : p))
    showToast('Guía desbloqueada — puede editarse y re-publicarse', 'info')
    setChangingId(null)
  }

  // ── Open editor — gate if it's another teacher's guide ────────────────────
  async function handleOpenEditor(plan) {
    const isOtherTeacher = plan.teacher_id !== teacher.id
    if (!isOtherTeacher) { navigate(`/editor/${plan.id}`); return }

    // Fetch owner name then show intent modal
    const t = teacherMap[plan.teacher_id]
    if (t) {
      setIntentPlan(plan)
      setIntentOwner(t.full_name)
    } else {
      navigate(`/editor/${plan.id}`)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const filtered = plans.filter(p => {
    if (filterStatus    && p.status     !== filterStatus)    return false
    if (filterSubject   && p.subject    !== filterSubject)   return false
    if (filterTeacherId && p.teacher_id !== filterTeacherId) return false
    if (filterGrade     && p.grade      !== filterGrade)     return false
    return true
  })

  const submittedQueue = filtered.filter(p => p.status === 'submitted')
  const restOfPlans    = filtered.filter(p => p.status !== 'submitted')

  const byGrade = {}
  for (const p of restOfPlans) (byGrade[p.grade] = byGrade[p.grade] || []).push(p)
  const grades  = Object.keys(byGrade).sort()

  const subjects    = [...new Set(plans.map(p => p.subject).filter(Boolean))].sort()
  const gradesAll   = [...new Set(plans.map(p => p.grade).filter(Boolean))].sort()
  const totalOpen   = Object.values(feedbackCounts).reduce((n, c) => n + c.open, 0)

  // Stats
  const stats = plans.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  const sharedCardProps = {
    teacherMap, feedbackCounts, currentTeacher: teacher,
    changingId, canFeedback,
    onChangeStatus: handleChangeStatus,
    onPublish: handlePublish,
    onUnlock: handleUnlock,
    onOpenEditor: handleOpenEditor,
    onFeedback: setFeedbackPlan,
    onVersionHistory: setVersionPlan,
  }

  function Skeleton() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12, animationDelay: `${i*0.08}s` }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--navy-900)', fontWeight: 800, letterSpacing: '-.02em' }}>
            🏛 Sala de Revisión
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: 13 }}>
            {loading ? 'Cargando…' : `${plans.length} guías en el colegio`}
            {totalOpen > 0 && (
              <span style={{
                marginLeft: 10, background: '#C0504D', color: '#fff',
                borderRadius: 10, padding: '1px 9px', fontSize: 11, fontWeight: 700,
              }}>{totalOpen} feedback abierto</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
            background: '#fff', color: '#64748B', fontSize: 12, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', opacity: loading ? .5 : 1,
          }}>
          {loading ? '⏳' : '↺'} Actualizar
        </button>
      </div>

      {/* ── Stats tiles ── */}
      {!loading && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <StatTile
            value={stats.submitted || 0} label="Enviadas — pendientes"
            color="#1D4ED8" bg="#EFF6FF" border="#BFDBFE"
            urgent={(stats.submitted || 0) > 0}
            onClick={() => setFilterStatus(filterStatus === 'submitted' ? '' : 'submitted')}
          />
          <StatTile
            value={stats.approved || 0} label="Aprobadas"
            color="#15803D" bg="#F0FDF4" border="#BBF7D0"
            onClick={() => setFilterStatus(filterStatus === 'approved' ? '' : 'approved')}
          />
          <StatTile
            value={stats.published || 0} label="Publicadas"
            color="#065F46" bg="#ECFDF5" border="#A7F3D0"
            onClick={() => setFilterStatus(filterStatus === 'published' ? '' : 'published')}
          />
          <StatTile
            value={stats.draft || 0} label="En borrador"
            color="#7A6200" bg="#FFF8E1" border="#FDE68A"
            onClick={() => setFilterStatus(filterStatus === 'draft' ? '' : 'draft')}
          />
          <StatTile
            value={plans.length} label="Total"
            color="#374151" bg="#F8FAFC" border="#E2E8F0"
          />
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { val: filterStatus,    set: setFilterStatus,    label: 'Estado',  opts: ['submitted','approved','published','complete','draft','archived'].map(s => ({ val: s, label: STATUS_META[s]?.label || s })) },
          { val: filterSubject,   set: setFilterSubject,   label: 'Materia', opts: subjects.map(s => ({ val: s, label: s })) },
          { val: filterGrade,     set: setFilterGrade,     label: 'Grado',   opts: gradesAll.map(g => ({ val: g, label: g })) },
        ].map(({ val, set, label, opts }) => (
          <select key={label} value={val} onChange={e => set(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD',
              fontSize: 13, background: '#fff', color: '#374151',
              boxShadow: val ? '0 0 0 2px #BFDBFE' : 'none',
            }}>
            <option value="">{label}: todos</option>
            {opts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        ))}
        <select value={filterTeacherId} onChange={e => setFilterTeacherId(e.target.value)}
          style={{
            padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD',
            fontSize: 13, background: '#fff', color: '#374151',
            boxShadow: filterTeacherId ? '0 0 0 2px #BFDBFE' : 'none',
          }}>
          <option value="">Docente: todos</option>
          {Object.values(teacherMap).sort((a, b) => a.full_name.localeCompare(b.full_name)).map(t => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        {(filterStatus || filterSubject || filterTeacherId || filterGrade) && (
          <button type="button"
            onClick={() => { setFilterStatus(''); setFilterSubject(''); setFilterTeacherId(''); setFilterGrade('') }}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid #FCA5A5',
              background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>✕ Limpiar</button>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && <Skeleton />}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '48px 24px', textAlign: 'center', color: '#94A3B8',
          animation: 'scale-in .2s ease',
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>
            No hay guías que coincidan con los filtros
          </div>
          <div style={{ fontSize: 12 }}>
            Los docentes envían sus guías desde "Mis Guías" → botón Enviar para revisión.
          </div>
        </div>
      )}

      {/* ── Priority queue: submitted plans ── */}
      {!loading && submittedQueue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <div style={{
              background: '#EFF6FF', border: '1.5px solid #BFDBFE',
              borderRadius: 10, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#3B82F6',
                animation: 'pulse-dot 1.8s ease-in-out infinite',
              }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1D4ED8' }}>
                Enviadas — requieren revisión
              </span>
              <span style={{
                background: '#1D4ED8', color: '#fff',
                borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 800,
              }}>{submittedQueue.length}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submittedQueue.map((plan, i) => (
              <div key={plan.id} style={{ animationDelay: `${i * 0.05}s` }}>
                <PlanCard plan={plan} {...sharedCardProps} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Grade accordion ── */}
      {!loading && grades.length > 0 && (
        <div>
          {submittedQueue.length > 0 && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase',
              letterSpacing: '.06em', marginBottom: 10,
            }}>
              Resto de guías por grado
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grades.map(grade => {
              const gradePlans = byGrade[grade]
              const isOpen     = !!expanded[grade]
              const openFb     = gradePlans.reduce((n, p) => n + (feedbackCounts[p.id]?.open || 0), 0)

              return (
                <div key={grade} style={{
                  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                  overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(prev => ({ ...prev, [grade]: !prev[grade] }))}
                    style={{
                      width: '100%', padding: '12px 16px',
                      background: isOpen ? '#F0F4FF' : '#F8FAFC',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderBottom: isOpen ? '1px solid #E2E8F0' : 'none',
                      transition: 'background .15s',
                    }}
                  >
                    <span style={{
                      background: '#1F3864', color: '#fff',
                      borderRadius: 7, padding: '4px 12px', fontWeight: 800, fontSize: 13,
                    }}>{grade}</span>
                    <span style={{ color: '#64748B', fontSize: 12 }}>
                      {gradePlans.length} guía{gradePlans.length !== 1 ? 's' : ''}
                    </span>
                    {openFb > 0 && (
                      <span style={{
                        background: '#C0504D', color: '#fff',
                        borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                      }}>{openFb} feedback</span>
                    )}
                    <span style={{
                      marginLeft: 'auto', color: '#94A3B8', fontSize: 18,
                      transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .18s',
                      display: 'inline-block',
                    }}>›</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {gradePlans.map((plan, i) => (
                        <div key={plan.id} style={{ animationDelay: `${i * 0.04}s` }}>
                          <PlanCard plan={plan} {...sharedCardProps} compact />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Intent modal (pre-editor gate) ── */}
      {intentPlan && (
        <IntentModal
          plan={intentPlan}
          ownerName={intentOwner}
          onConfirm={() => { navigate(`/editor/${intentPlan.id}`); setIntentPlan(null) }}
          onCancel={() => { setIntentPlan(null); setIntentOwner(null) }}
        />
      )}

      {/* ── Feedback modal ── */}
      {feedbackPlan && (
        <FeedbackModal
          entityType="guide"
          entityId={feedbackPlan.id}
          entityTitle={`${feedbackPlan.grade} · ${feedbackPlan.subject} · Sem. ${feedbackPlan.week_number}`}
          teacher={teacher}
          onClose={() => { setFeedbackPlan(null); load() }}
        />
      )}

      {/* ── Version history modal ── */}
      {versionPlan && (
        <VersionHistoryModal
          planId={versionPlan.id}
          planTitle={`${versionPlan.grade} · ${versionPlan.subject} · Sem. ${versionPlan.week_number}`}
          teacher={teacher}
          onClose={() => setVersionPlan(null)}
          onRestored={() => { setVersionPlan(null); load() }}
        />
      )}
    </div>
  )
}
