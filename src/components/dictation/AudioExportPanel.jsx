import { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

/**
 * AudioExportPanel — download individual MP3s or all as ZIP.
 * Renders below TTS generate button when audioUrls has content.
 */
export default function AudioExportPanel({ audioUrls, sections, title, showToast }) {
  const [downloading, setDownloading] = useState(false)

  // Build sectionMap dynamically from sections prop (handles any audio-type sections)
  const sectionMap = {}
  const SECTION_LABELS = {
    listen_type: 'S1_ListenType',
    listen_identify: 'S2_ListenIdentify',
    listen_comprehension: 'S3_Comprehension',
  }
  ;(sections || []).forEach(sec => {
    if (SECTION_LABELS[sec.type]) {
      sectionMap[sec.type] = { label: SECTION_LABELS[sec.type], items: sec.items || [] }
    }
  })

  const allUrls = []
  Object.entries(audioUrls).forEach(([type, urls]) => {
    const info = sectionMap[type]
    if (!info) return
    urls.forEach((url, i) => {
      if (!url) return
      const item = info.items[i]
      const word = (item?.correct_answer || item?.audio_text || `item_${i + 1}`)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30)
      allUrls.push({
        url,
        folder: info.label,
        filename: `${String(i + 1).padStart(2, '0')}_${word}.mp3`,
      })
    })
  })

  if (allUrls.length === 0) return null

  async function downloadZip() {
    setDownloading(true)
    try {
      const zip = new JSZip()
      const safeName = (title || 'Dictation').replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 40)
      const folder = zip.folder(`DictationAudio_${safeName}`)

      await Promise.all(allUrls.map(async ({ url, folder: subFolder, filename }) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return
          const blob = await res.blob()
          folder.folder(subFolder).file(filename, blob)
        } catch {
          // skip failed downloads
        }
      }))

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `DictationAudio_${safeName}.zip`)
      showToast('Audio ZIP descargado', 'success')
    } catch (err) {
      showToast('Error al descargar ZIP', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="dict-audio-export">
      <h4>Exportar audio generado</h4>
      <div className="dict-audio-export-actions">
        <button
          onClick={downloadZip}
          disabled={downloading}
          className="dict-btn secondary"
        >
          {downloading ? '📦 Empaquetando...' : '📦 Descargar todo (ZIP)'}
        </button>
      </div>

      <div className="dict-audio-export-list">
        {Object.entries(audioUrls).map(([type, urls]) => {
          const info = sectionMap[type]
          if (!info || !urls?.length) return null
          return (
            <div key={type} className="dict-audio-export-section">
              <strong style={{ fontSize: 12, color: '#666' }}>{info.label}</strong>
              <div className="dict-audio-export-items">
                {urls.map((url, i) => {
                  if (!url) return null
                  const item = info.items[i]
                  const label = item?.correct_answer || item?.audio_text || `Item ${i + 1}`
                  return (
                    <a
                      key={i}
                      href={url}
                      download={`${String(i + 1).padStart(2, '0')}_${type}.mp3`}
                      className="dict-audio-export-link"
                    >
                      🔊 {i + 1}. {label.slice(0, 30)}
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
