import { useState, useRef } from 'react'
import { supabase } from '../supabase'

export default function ImageUploader({ planId, dayIso, sectionKey, images = [], onChange }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  // images = [{ url, path, name }]

  async function handleFiles(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    const uploaded = []
    for (const file of files) {
      const ext  = file.name.split('.').pop()
      const path = `${planId}/${dayIso}/${sectionKey}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      // Compress before upload
      const compressed = await compressImage(file)

      const { data, error } = await supabase.storage
        .from('guide-images')
        .upload(path, compressed.blob, { contentType: compressed.type, upsert: false })

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('guide-images')
          .getPublicUrl(path)
        uploaded.push({ url: urlData.publicUrl, path, name: file.name })
      }
    }

    onChange([...images, ...uploaded])
    setUploading(false)
    e.target.value = ''
  }

  async function removeImage(img) {
    await supabase.storage.from('guide-images').remove([img.path])
    onChange(images.filter(i => i.path !== img.path))
  }

  return (
    <div className="img-uploader">
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="img-thumbs">
          {images.map(img => (
            <div key={img.path} className="img-thumb-wrap">
              <img src={img.url} alt={img.name} className="img-thumb" />
              <button
                className="img-thumb-del"
                onClick={() => removeImage(img)}
                title="Eliminar imagen">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
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
          : <span>🖼️ {images.length > 0 ? '+ Agregar más imágenes' : 'Clic para subir imagen(es)'}</span>
        }
      </div>
    </div>
  )
}

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
