import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import CreateTab from '../components/dictation/CreateTab'
import ListTab from '../components/dictation/ListTab'
import MonitorTab from '../components/dictation/MonitorTab'
import ConfigTab from '../components/dictation/ConfigTab'
import VocabLibraryTab from '../components/dictation/VocabLibraryTab'

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'create',  label: '✏️ Crear',        icon: '✏️' },
  { key: 'list',    label: '📋 Mis Dictados',  icon: '📋' },
  { key: 'vocab',   label: '📚 Vocabulario',   icon: '📚' },
  { key: 'monitor', label: '📡 Monitor',       icon: '📡' },
  { key: 'config',  label: '⚙️ Config',        icon: '⚙️' },
]

export default function DictationPage({ teacher }) {
  const [activeTab, setActiveTab] = useState('create')
  const { showToast } = useToast()

  return (
    <div className="dict-page">
      <header className="dict-header">
        <h1>🎧 Dictation Center</h1>
        <p className="dict-subtitle">Crea, monitorea y califica dictados automáticamente</p>
      </header>

      <nav className="dict-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`dict-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="dict-content">
        {activeTab === 'create'  && <CreateTab teacher={teacher} showToast={showToast} />}
        {activeTab === 'list'    && <ListTab teacher={teacher} showToast={showToast} />}
        {activeTab === 'vocab'   && <VocabLibraryTab teacher={teacher} showToast={showToast} />}
        {activeTab === 'monitor' && <MonitorTab teacher={teacher} />}
        {activeTab === 'config'  && <ConfigTab teacher={teacher} showToast={showToast} />}
      </div>
    </div>
  )
}
