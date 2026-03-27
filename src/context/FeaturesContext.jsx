// ── FeaturesContext.jsx ───────────────────────────────────────────────────────
// Carga las features del colegio una vez y las comparte en toda la app.

import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DEFAULT_FEATURES = {
  messages:           true,
  comments:           true,
  corrections:        true,
  announcements:      true,
  ai_generate:        true,
  ai_analyze:         true,
  ai_suggest:         true,
  wysiwyg:            true,
  admin_see_messages: false,
}

const FeaturesContext = createContext(DEFAULT_FEATURES)

export function FeaturesProvider({ schoolId, children }) {
  const [features, setFeatures] = useState(DEFAULT_FEATURES)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!schoolId) { setLoading(false); return }
    loadFeatures()
  }, [schoolId])

  async function loadFeatures() {
    const { data } = await supabase
      .from('schools')
      .select('features')
      .eq('id', schoolId)
      .single()
    if (data?.features) {
      setFeatures({ ...DEFAULT_FEATURES, ...data.features })
    }
    setLoading(false)
  }

  async function updateFeature(key, value) {
    const updated = { ...features, [key]: value }
    setFeatures(updated)
    await supabase
      .from('schools')
      .update({ features: updated })
      .eq('id', schoolId)
  }

  return (
    <FeaturesContext.Provider value={{ features, loading, updateFeature }}>
      {children}
    </FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
