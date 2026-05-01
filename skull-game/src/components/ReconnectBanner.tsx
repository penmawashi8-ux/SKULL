import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

export function ReconnectBanner() {
  const isReconnecting = useGameStore(s => s.isReconnecting)

  return (
    <AnimatePresence>
      {isReconnecting && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-sm"
          style={{
            background: 'rgba(180, 83, 9, 0.95)',
            fontFamily: 'Crimson Text, serif',
            paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          }}
        >
          <span className="animate-spin inline-block">⟳</span>
          <span className="text-white">接続を再試行しています...</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
