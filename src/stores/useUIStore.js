// ── useUIStore.js ─────────────────────────────────────────────────────────────
// Zustand store for global UI state (modals, sidebars, loading states)

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useUIStore = create(
  devtools(
    (set) => ({
      // Global loading states
      globalLoading: false,
      setGlobalLoading: (loading) => set({ globalLoading: loading }),

      // Toast notification queue (alternative to ToastContext if needed)
      toasts: [],
      addToast: (message, type = 'info', duration = 3000) =>
        set((state) => ({
          toasts: [...state.toasts, { id: Date.now(), message, type, duration }],
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // Sidebar state (for mobile/responsive)
      sidebarOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),

      // Modal management (generic)
      activeModal: null,
      modalData: null,
      openModal: (modalName, data = null) =>
        set({ activeModal: modalName, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),

      // Save status indicator
      saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved' | 'error'
      setSaveStatus: (status) => set({ saveStatus: status }),
    }),
    { name: 'UIStore' }
  )
)

export default useUIStore
