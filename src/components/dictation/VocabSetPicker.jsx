import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

export default function VocabSetPicker({ teacher, onLoadSet, showToast }) {
  const [sets, setSets] = useState([])
  const [selectedSetId, setSelectedSetId] = useState('')

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
    onLoadSet(set.vocabulary, set.name)
    showToast(`Vocabulario "${set.name}" cargado`, 'success')
  }

  /** Count real words (expanding any comma-joined entries) */
  function realWordCount(vocab) {
    return vocab.flatMap(w =>
      /[,;]/.test(w) ? w.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [w]
    ).length
  }

  return (
    <div className="dict-vocab-picker">
      <div className="dict-vocab-picker-row">
        <select value={selectedSetId} onChange={e => setSelectedSetId(e.target.value)}>
          <option value="">— Seleccionar vocabulario —</option>
          {sets.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({realWordCount(s.vocabulary)} palabras)
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
      </div>

      {sets.length === 0 && (
        <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
          No tienes vocabularios guardados. Crea uno en la pestaña <strong>Biblioteca</strong>.
        </p>
      )}
    </div>
  )
}
