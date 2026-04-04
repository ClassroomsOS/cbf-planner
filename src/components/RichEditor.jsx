import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { Extension } from '@tiptap/core'
import { useEffect } from 'react'

// ── Custom FontSize extension ─────────────────────────────────────────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize || null,
          renderHTML: attrs => {
            if (!attrs.fontSize) return {}
            return { style: `font-size: ${attrs.fontSize}` }
          },
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

const FONTS = [
  { label: 'Por defecto', value: '' },
  { label: 'Arial',        value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Georgia',      value: 'Georgia, serif' },
  { label: 'Verdana',      value: 'Verdana, sans-serif' },
  { label: 'Courier New',  value: "'Courier New', monospace" },
  { label: 'Calibri',      value: 'Calibri, sans-serif' },
]

const SIZES = ['8px','9px','10px','11px','12px','14px','16px','18px','20px','24px','28px','32px','36px']

export default function RichEditor({ value, onChange, placeholder, minHeight = 100 }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
      FontSize,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rte-content',
        style: `min-height: ${minHeight}px`,
        'data-placeholder': placeholder || '',
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. loading from DB)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '', false)
    }
  }, [value])

  if (!editor) return null

  function isActive(type, attrs) {
    return editor.isActive(type, attrs) ? 'rte-btn active' : 'rte-btn'
  }

  function setLink() {
    const prev = editor.getAttributes('link').href || ''
    const url  = window.prompt('URL del enlace:', prev)
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    // Block dangerous protocols
    const proto = url.trim().toLowerCase()
    if (proto.startsWith('javascript:') || proto.startsWith('vbscript:') || proto.startsWith('data:')) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  const currentFont = editor.getAttributes('textStyle').fontFamily || ''
  const currentSize = editor.getAttributes('textStyle').fontSize   || ''

  return (
    <div className="rte-wrap">
      {/* ── Toolbar ── */}
      <div className="rte-toolbar">

        {/* Font family */}
        <select
          className="rte-select"
          value={currentFont}
          title="Fuente"
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontFamily(v).run()
            else   editor.chain().focus().unsetFontFamily().run()
          }}
        >
          {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Font size */}
        <select
          className="rte-select rte-select-size"
          value={currentSize}
          title="Tamaño"
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontSize(v).run()
            else   editor.chain().focus().unsetFontSize().run()
          }}
        >
          <option value="">Tam.</option>
          {SIZES.map(s => <option key={s} value={s}>{s.replace('px','')}</option>)}
        </select>

        <div className="rte-sep" />

        {/* Text style */}
        <button type="button" className={isActive('bold')}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          title="Negrita"><b>N</b></button>
        <button type="button" className={isActive('italic')}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          title="Cursiva"><i>K</i></button>
        <button type="button" className={isActive('underline')}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}
          title="Subrayado" style={{ textDecoration: 'underline' }}>S</button>

        <div className="rte-sep" />

        {/* Lists */}
        <button type="button" className={isActive('bulletList')}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          title="Lista con viñetas">• lista</button>
        <button type="button" className={isActive('orderedList')}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          title="Lista numerada">1. lista</button>

        <div className="rte-sep" />

        {/* Alignment */}
        <button type="button" className={isActive({ textAlign: 'left' })}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run() }}
          title="Alinear izquierda">⬤◻◻</button>
        <button type="button" className={isActive({ textAlign: 'center' })}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run() }}
          title="Centrar">◻⬤◻</button>

        <div className="rte-sep" />

        {/* Color */}
        <label className="rte-color-btn" title="Color de texto">
          <span style={{ fontWeight: 700 }}>A</span>
          <input type="color" defaultValue="#000000"
            onInput={e => editor.chain().focus().setColor(e.target.value).run()} />
        </label>

        {/* Highlight */}
        <label className="rte-color-btn" title="Resaltar">
          <span>🖊</span>
          <input type="color" defaultValue="#ffff00"
            onInput={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
        </label>

        <div className="rte-sep" />

        {/* Link */}
        <button type="button" className={isActive('link')}
          onMouseDown={e => { e.preventDefault(); setLink() }}
          title="Insertar enlace">🔗</button>
        <button type="button" className="rte-btn"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetLink().run() }}
          title="Quitar enlace" style={{ opacity: .6, fontSize: '11px', textDecoration: 'line-through' }}>🔗</button>

        <div className="rte-sep" />

        {/* Clear */}
        <button type="button" className="rte-btn"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().clearNodes().unsetAllMarks().run() }}
          title="Quitar formato" style={{ fontSize: '11px' }}>Sin fmt</button>
      </div>

      {/* ── Editor area ── */}
      <EditorContent editor={editor} className="rte-editor-wrap" />
    </div>
  )
}
