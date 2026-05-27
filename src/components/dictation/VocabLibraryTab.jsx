import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

export default function VocabLibraryTab({ teacher, showToast }) {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editWords, setEditWords] = useState([])
  const [addWordInput, setAddWordInput] = useState('')
  const [editGrade, setEditGrade] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editPeriod, setEditPeriod] = useState('')

  // New set form
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWordsInput, setNewWordsInput] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newPeriod, setNewPeriod] = useState('')

  useEffect(() => {
    loadSets()
  }, [teacher])

  async function loadSets() {
    setLoading(true)
    const { data } = await supabase
      .from('dictation_vocab_sets')
      .select('*')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
    setSets(data || [])
    setLoading(false)
  }

  // ── Create ──
  async function handleCreate() {
    if (!newName.trim()) {
      showToast('Ingresa un nombre', 'warning')
      return
    }
    const words = newWordsInput
      .split(/[,\n;]+/)
      .map(w => w.trim())
      .filter(Boolean)
    if (words.length === 0) {
      showToast('Ingresa al menos una palabra', 'warning')
      return
    }
    const { error } = await supabase
      .from('dictation_vocab_sets')
      .insert({
        school_id: teacher.school_id,
        teacher_id: teacher.id,
        name: newName.trim(),
        vocabulary: words,
        grade: newGrade || null,
        subject: newSubject || null,
        period: newPeriod ? parseInt(newPeriod) : null,
      })
    if (error) {
      showToast('Error al crear vocabulario', 'error')
    } else {
      showToast('Vocabulario creado', 'success')
      setShowNew(false)
      setNewName('')
      setNewWordsInput('')
      setNewGrade('')
      setNewSubject('')
      setNewPeriod('')
      loadSets()
    }
  }

  // ── Edit ──
  function startEdit(set) {
    setEditingId(set.id)
    setEditName(set.name)
    setEditWords([...set.vocabulary])
    setEditGrade(set.grade || '')
    setEditSubject(set.subject || '')
    setEditPeriod(set.period ? String(set.period) : '')
    setAddWordInput('')
  }

  function addEditWord() {
    const w = addWordInput.trim()
    if (!w || editWords.includes(w)) return
    setEditWords(prev => [...prev, w])
    setAddWordInput('')
  }

  async function saveEdit() {
    if (!editName.trim() || editWords.length === 0) {
      showToast('Nombre y al menos una palabra son obligatorios', 'warning')
      return
    }
    const { error } = await supabase
      .from('dictation_vocab_sets')
      .update({
        name: editName.trim(),
        vocabulary: editWords,
        grade: editGrade || null,
        subject: editSubject || null,
        period: editPeriod ? parseInt(editPeriod) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId)
    if (error) {
      showToast('Error al guardar', 'error')
    } else {
      showToast('Vocabulario actualizado', 'success')
      setEditingId(null)
      loadSets()
    }
  }

  // ── Delete ──
  async function handleDelete(id, name) {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase
      .from('dictation_vocab_sets')
      .delete()
      .eq('id', id)
    if (error) {
      showToast('Error al eliminar', 'error')
    } else {
      showToast('Vocabulario eliminado', 'success')
      loadSets()
    }
  }

  if (loading) return <div className="dict-loading">Cargando vocabularios...</div>

  return (
    <div className="dict-vocab-library">
      <div className="dict-vocab-library-header">
        <h2>📚 Biblioteca de Vocabulario</h2>
        <button onClick={() => setShowNew(!showNew)} className="dict-btn primary">
          {showNew ? 'Cancelar' : '+ Nuevo vocabulario'}
        </button>
      </div>

      {/* New set form */}
      {showNew && (
        <div className="dict-vocab-new-form">
          <div className="dict-form-grid">
            <div className="dict-field">
              <label>Nombre del vocabulario</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Unit 4 — Jobs" />
            </div>
            <div className="dict-field">
              <label>Grado (opcional)</label>
              <input value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="Ej: 8.° Blue" />
            </div>
            <div className="dict-field">
              <label>Materia (opcional)</label>
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Ej: Language Arts" />
            </div>
            <div className="dict-field">
              <label>Período (opcional)</label>
              <select value={newPeriod} onChange={e => setNewPeriod(e.target.value)}>
                <option value="">—</option>
                <option value="1">Período 1</option>
                <option value="2">Período 2</option>
                <option value="3">Período 3</option>
                <option value="4">Período 4</option>
              </select>
            </div>
          </div>
          <div className="dict-field" style={{ marginTop: 12 }}>
            <label>Palabras (separadas por coma o salto de línea)</label>
            <textarea
              value={newWordsInput}
              onChange={e => setNewWordsInput(e.target.value)}
              rows={4}
              placeholder="salary, commission, overtime, bonus, benefits..."
            />
          </div>
          <div className="dict-actions" style={{ marginTop: 12 }}>
            <button onClick={handleCreate} className="dict-btn primary">✓ Crear vocabulario</button>
          </div>
        </div>
      )}

      {/* List */}
      {sets.length === 0 && !showNew ? (
        <div className="dict-empty">
          <p>No tienes vocabularios guardados.</p>
          <p>Crea uno para reutilizarlo en futuros dictados.</p>
        </div>
      ) : (
        <div className="dict-vocab-list">
          {sets.map(set => (
            <div key={set.id} className="dict-vocab-card">
              {editingId === set.id ? (
                /* ── Edit mode ── */
                <div className="dict-vocab-edit">
                  <div className="dict-form-grid">
                    <div className="dict-field">
                      <label>Nombre</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="dict-field">
                      <label>Grado</label>
                      <input value={editGrade} onChange={e => setEditGrade(e.target.value)} />
                    </div>
                    <div className="dict-field">
                      <label>Materia</label>
                      <input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
                    </div>
                    <div className="dict-field">
                      <label>Período</label>
                      <select value={editPeriod} onChange={e => setEditPeriod(e.target.value)}>
                        <option value="">—</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                  </div>
                  <div className="dict-vocab-chips" style={{ marginTop: 8 }}>
                    {editWords.map(w => (
                      <span key={w} className="dict-chip">
                        {w}
                        <button onClick={() => setEditWords(prev => prev.filter(x => x !== w))} className="dict-chip-x">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="dict-vocab-row" style={{ marginTop: 8 }}>
                    <input
                      value={addWordInput}
                      onChange={e => setAddWordInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addEditWord()}
                      placeholder="Agregar palabra..."
                    />
                    <button onClick={addEditWord} className="dict-btn-sm">+</button>
                  </div>
                  <div className="dict-actions" style={{ marginTop: 12 }}>
                    <button onClick={saveEdit} className="dict-btn primary">💾 Guardar</button>
                    <button onClick={() => setEditingId(null)} className="dict-btn secondary">Cancelar</button>
                  </div>
                </div>
              ) : (
                /* ── Display mode ── */
                <>
                  <div className="dict-vocab-card-header">
                    <h3>{set.name}</h3>
                    <span className="dict-vocab-card-count">{set.vocabulary.length} palabras</span>
                  </div>
                  <div className="dict-vocab-card-meta">
                    {set.grade && <span>📚 {set.grade}</span>}
                    {set.subject && <span>📝 {set.subject}</span>}
                    {set.period && <span>📅 P{set.period}</span>}
                  </div>
                  <div className="dict-vocab-chips">
                    {set.vocabulary.slice(0, 12).map(w => (
                      <span key={w} className="dict-chip readonly">{w}</span>
                    ))}
                    {set.vocabulary.length > 12 && (
                      <span className="dict-chip readonly more">+{set.vocabulary.length - 12} más</span>
                    )}
                  </div>
                  <div className="dict-card-actions">
                    <button onClick={() => startEdit(set)} className="dict-btn-sm">✏️ Editar</button>
                    <button onClick={() => handleDelete(set.id, set.name)} className="dict-btn-sm secondary">🗑 Eliminar</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
