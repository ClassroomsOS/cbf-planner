import { useState, useRef, useCallback, memo } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { imageUploadSchema } from '../utils/validationSchemas'

const ImageUploader = memo(function ImageUploader({ planId, dayIso, sectionKey, pathPrefix, images = [], onChange, maxImages, showLink = true }) {
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  // images = [{ url, path, name }]

  async function handleFiles(e) {
    const limit = maxImages ?? MAX_IMAGES
    const remaining = limit - images.length
    const files = Array.from(e.target.files).slice(0, remaining)
    if (!files.length) return

    // Validate each file
    const validFiles = []
    for (const file of files) {
      const validation = imageUploadSchema.safeParse({ file, name: file.name })
      if (!validation.success) {
        const error = validation.error.errors[0]
        showToast(`${file.name}: ${error.message}`, 'error')
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) {
      e.target.value = ''
      return
    }

    setUploading(true)

    const uploaded = []
    for (const file of validFiles) {
      const ext  = file.name.split('.').pop()
      const slug = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const path = pathPrefix
        ? `${pathPrefix}/${slug}`
        : `${planId}/${dayIso}/${sectionKey}/${slug}`

      try {
        // Compress before upload
        const compressed = await compressImage(file)

        const { data, error } = await supabase.storage
          .from('guide-images')
          .upload(path, compressed.blob, { contentType: compressed.type, upsert: false })

        if (error) {
          showToast(`Error al subir ${file.name}: ${error.message}`, 'error')
          continue
        }

        const { data: urlData } = supabase.storage
          .from('guide-images')
          .getPublicUrl(path)
        uploaded.push({ url: urlData.publicUrl, path, name: file.name })
      } catch (err) {
        showToast(`Error al procesar ${file.name}: ${err.message}`, 'error')
      }
    }

    if (uploaded.length > 0) {
      onChange([...images, ...uploaded])
      showToast(`${uploaded.length} imagen${uploaded.length > 1 ? 'es' : ''} subida${uploaded.length > 1 ? 's' : ''} exitosamente`, 'success')
    }

    setUploading(false)
    e.target.value = ''
  }

  async function removeImage(img) {
    await supabase.storage.from('guide-images').remove([img.path])
    onChange(images.filter(i => i.path !== img.path))
  }

  function updateLink(img, link) {
    onChange(images.map(i => i.path === img.path ? { ...i, link } : i))
  }

  const limit = maxImages ?? MAX_IMAGES
  const atMax = images.length >= limit

  return (
    <div className="img-uploader">
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="img-thumbs">
          {images.map(img => (
            <div key={img.path} className="img-thumb-wrap" style={{ position: 'relative' }}>
              <img src={img.url} alt={img.name} className="img-thumb" />
              <button
                className="img-thumb-del"
                onClick={() => removeImage(img)}
                title="Eliminar imagen">✕</button>
              {showLink && (
                <input
                  type="url"
                  placeholder="🔗 Link (opcional)"
                  value={img.link || ''}
                  onChange={e => updateLink(img, e.target.value)}
                  style={{
                    display: 'block', width: '100%', marginTop: '4px',
                    fontSize: '11px', padding: '3px 6px', borderRadius: '5px',
                    border: '1px solid #c5d5f0', boxSizing: 'border-box',
                    color: '#2E5598',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Avisos de cantidad */}
      {images.length === limit && (
        <div style={{
          fontSize: '11px', color: '#8a5c00', background: '#fff8e6',
          border: '1px solid #f5c300', borderRadius: '6px',
          padding: '6px 10px', marginBottom: '6px',
        }}>
          🚫 Límite de {limit} imágenes alcanzado.
        </div>
      )}

      {/* Upload area — oculta al llegar al máximo */}
      {!atMax && (
        <div
          className={`img-upload-area ${uploading ? 'uploading' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFiles}
          />
          {uploading
            ? <span>⏳ Subiendo…</span>
            : <span>🖼️ {images.length > 0 ? `+ Agregar (${images.length}/${limit})` : `Clic para subir imágenes (máx. ${limit})`}</span>
          }
        </div>
      )}
    </div>
  )
})

export default ImageUploader

// ── Image compression ─────────────────────────────────────────────────────────
const MAX_PX   = 900
const QUALITY  = 0.82

function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_PX || height > MAX_PX) {
          if (width >= height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
          else                 { width = Math.round(width * MAX_PX / height); height = MAX_PX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const outType = file.type === 'image/png' && file.size < 100*1024 ? 'image/png' : 'image/jpeg'
        canvas.toBlob(blob => resolve({ blob, type: outType }), outType, QUALITY)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
