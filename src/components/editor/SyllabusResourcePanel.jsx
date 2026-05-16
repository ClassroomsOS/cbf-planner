/**
 * SyllabusResourcePanel — GXE Sprint 5
 *
 * Convierte el panel "solo lectura" de temas del syllabus en un panel activo.
 * Permite al docente:
 *   1. Llenar el campo "Tema del día" con un clic desde el syllabus.
 *   2. Insertar la descripción del tema en la sección correcta del día activo.
 *   3. Ver y usar los recursos de Biblioteca vinculados al syllabus de esta semana.
 *
 * Props:
 *   plan               — lesson_plan con week_number
 *   linkedSyllabusTopics — array de syllabus_topics para esta semana
 *   syllabusBookPages  — array de topics con library_doc vinculado
 *   activeDayISO       — la fecha YYYY-MM-DD del día activo en el editor
 *   content            — content object completo de la guía
 *   setContentField    — mutación (path[], value) => void
 */

// content_type → sección pedagógica donde va ese contenido
const TYPE_TO_SECTION = {
  grammar:    { key: 'skill',      label: 'Habilidad',  icon: '🎓' },
  vocabulary: { key: 'motivation', label: 'Encuentro',  icon: '📖' },
  skill:      { key: 'skill',      label: 'Habilidad',  icon: '🎓' },
  concept:    { key: 'activity',   label: 'Motivación', icon: '⚡' },
  value:      { key: 'closing',    label: 'Cierre',     icon: '🚪' },
  other:      { key: 'skill',      label: 'Habilidad',  icon: '🎓' },
}

function descToHtml(description) {
  if (!description?.trim()) return ''
  return description
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p}</p>`)
    .join('')
}

export default function SyllabusResourcePanel({
  plan,
  linkedSyllabusTopics = [],
  syllabusBookPages = [],
  activeDayISO,
  content,
  setContentField,
}) {
  const hasTopics = linkedSyllabusTopics.length > 0
  const hasBooks  = syllabusBookPages.length > 0

  if (!hasTopics && !hasBooks) return null

  const dayEnabled = !!activeDayISO

  // ── Actions ──────────────────────────────────────────────────────
  function fillUnit(topic) {
    if (!dayEnabled) return
    setContentField(['days', activeDayISO, 'unit'], topic.topic)
  }

  function fillSection(topic, sectionKey) {
    if (!dayEnabled || !topic.description) return
    const html = descToHtml(topic.description)
    if (!html) return
    // Append si ya hay contenido, reemplazar si está vacío
    const current = content?.days?.[activeDayISO]?.sections?.[sectionKey]?.content || ''
    setContentField(
      ['days', activeDayISO, 'sections', sectionKey, 'content'],
      current ? current + html : html
    )
  }

  function openDoc(url) {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function insertRef(doc, pages) {
    if (!dayEnabled) return
    const label = pages?.length ? `${doc.title || 'Recurso'}, p.${pages.join(', ')}` : (doc.title || 'Recurso')
    const ref   = `<p><em>📖 Ref.: ${label}</em></p>`
    const current = content?.days?.[activeDayISO]?.sections?.skill?.content || ''
    setContentField(
      ['days', activeDayISO, 'sections', 'skill', 'content'],
      current + ref
    )
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>

      {/* ── Syllabus topics ── */}
      {hasTopics && (
        <div style={{
          background: '#f8f6ff',
          border: '1px solid #d4c8f0',
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#5a3a8a',
            textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8,
          }}>
            📚 Syllabus — Semana {plan?.week_number}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linkedSyllabusTopics.map(st => {
              const meta = TYPE_TO_SECTION[st.content_type] || TYPE_TO_SECTION.other
              return (
                <div key={st.id} style={{
                  background: '#fff',
                  border: '1px solid #e8e0f5',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}>
                  {/* Topic header */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 5 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#8a6aaa',
                      background: '#ece8f8', padding: '2px 6px', borderRadius: 3,
                      textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      {st.content_type}
                    </span>
                    <span style={{ fontSize: 12, color: '#2a1a4a', fontWeight: 600, lineHeight: 1.35 }}>
                      {st.topic}
                    </span>
                  </div>

                  {/* Description preview */}
                  {st.description && (
                    <div style={{
                      fontSize: 11, color: '#666', marginBottom: 6,
                      lineHeight: 1.4, overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {st.description}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <QuickBtn
                      color="#6d28d9"
                      disabled={!dayEnabled}
                      title={dayEnabled ? `Llenar "Unidad" del día activo con "${st.topic}"` : 'Selecciona un día primero'}
                      onClick={() => fillUnit(st)}
                    >
                      📅 → Tema del día
                    </QuickBtn>

                    {st.description && (
                      <QuickBtn
                        color="#2E5598"
                        disabled={!dayEnabled}
                        title={dayEnabled ? `Insertar descripción en sección "${meta.label}"` : 'Selecciona un día primero'}
                        onClick={() => fillSection(st, meta.key)}
                      >
                        {meta.icon} → {meta.label}
                      </QuickBtn>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {!dayEnabled && (
            <p style={{ fontSize: 10, color: '#8a6aaa', marginTop: 6, fontStyle: 'italic' }}>
              Selecciona un día en el navegador para activar el relleno rápido.
            </p>
          )}
        </div>
      )}

      {/* ── Library resources ── */}
      {hasBooks && (
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#15803D',
            textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8,
          }}>
            📖 Biblioteca — Semana {plan?.week_number}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {syllabusBookPages.map(t => (
              <div key={t.id} style={{
                background: '#fff',
                border: '1px solid #BBF7D0',
                borderRadius: 6,
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#15803D', marginBottom: 3 }}>
                  {t.library_doc?.title || 'Documento'}
                </div>
                {t.library_pages?.length > 0 && (
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                    Páginas: {t.library_pages.join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {t.library_doc?.file_url && (
                    <QuickBtn
                      color="#15803D"
                      onClick={() => openDoc(t.library_doc.file_url)}
                    >
                      👁 Ver PDF
                    </QuickBtn>
                  )}
                  <QuickBtn
                    color="#0891b2"
                    disabled={!dayEnabled}
                    title={dayEnabled ? 'Insertar referencia bibliográfica en sección Habilidad' : 'Selecciona un día primero'}
                    onClick={() => insertRef(t.library_doc || {}, t.library_pages)}
                  >
                    📌 Insertar referencia
                  </QuickBtn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small helper button ────────────────────────────────────────────
function QuickBtn({ children, color, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontSize: 10,
        padding: '4px 8px',
        borderRadius: 5,
        border: `1px solid ${disabled ? '#ddd' : color}`,
        background: disabled ? '#f5f5f5' : `${color}14`,
        color: disabled ? '#aaa' : color,
        cursor: disabled ? 'default' : 'pointer',
        fontWeight: 600,
        lineHeight: 1.4,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}
