import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

export default function VocabSetPicker({ teacher, vocabulary, onLoadSet, showToast }) {
  const [sets, setSets] = useState([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSave, setShowSave] = useState(false)

  useEffect(() => {
    if (!teacher) return
    supabase
      .from('dictation_vocab_sets')
      .select('id, name, vocabulary, grade, subject, period')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSets(data || []))
  }, [teacher])

  function handleLoad() {
    const set = sets.find(s => s.id === selectedSetId)
    if (!set) return
    onLoadSet(set.vocabulary)
    showToast(`Vocabulario "${set.name}" cargado (${set.vocabulary.length} palabras)`, 'success')
  }

  async function handleSave() {
    if (!saveName.trim()) {
      showToast('Ingresa un nombre para el set', 'warning')
      return
    }
    if (vocabulary.length === 0) {
      showToast('No hay palabras para guardar', 'warning')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('dictation_vocab_sets')
      .insert({
        school_id: teacher.school_id,
        teacher_id: teacher.id,
        name: saveName.trim(),
        vocabulary,
      })
      .select('id, name, vocabulary, grade, subject, period')
      .single()
    setSaving(false)
    if (error) {
      showToast('Error al guardar vocabulario', 'error')
    } else {
      setSets(prev => [data, ...prev])
      setSaveName('')
      setShowSave(false)
      showToast(`Vocabulario "${data.name}" guardado`, 'success')
    }
  }

  return (
    <div className="dict-vocab-picker">
      <div className="dict-vocab-picker-row">
        <select value={selectedSetId} onChange={e => setSelectedSetId(e.target.value)}>
          <option value="">— Cargar vocabulario guardado —</option>
          {sets.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.vocabulary.length} palabras)
            </option>
          ))}
        </select>
        <button
          onClick={handleLoad}
          disabled={!selectedSetId}
          className="dict-btn-sm"
        >
          📂 Cargar
        </button>
        <button
          onClick={() => setShowSave(!showSave)}
          className="dict-btn-sm secondary"
          disabled={vocabulary.length === 0}
        >
          💾 Guardar lista
        </button>
      </div>

      {showSave && (
        <div className="dict-vocab-picker-save">
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="Nombre del set (ej: Unit 4 — Jobs)"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave} disabled={saving} className="dict-btn-sm">
            {saving ? 'Guardando...' : '✓ Guardar'}
          </button>
          <button onClick={() => setShowSave(false)} className="dict-btn-sm secondary">Cancelar</button>
        </div>
      )}
    </div>
  )
}
