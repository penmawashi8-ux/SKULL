import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface LogEntry {
  id: string
  message: string
  type: 'place' | 'bid' | 'fold' | 'flip' | 'result'
  timestamp: number
}

interface Props {
  entries: LogEntry[]
}

const TYPE_COLOR: Record<string, string> = {
  place:  'border-l-blue-400 text-blue-200',
  bid:    'border-l-amber-400 text-amber-200',
  fold:   'border-l-gray-400 text-gray-300',
  flip:   'border-l-purple-400 text-purple-200',
  result: 'border-l-emerald-400 text-emerald-200',
}

export function ActionLog({ entries }: Props) {
  const [shown, setShown] = useState<LogEntry | null>(null)

  useEffect(() => {
    const latest = entries[0]
    if (!latest) return
    setShown(latest)
    const t = setTimeout(() => setShown(null), 2500)
    return () => clearTimeout(t)
  }, [entries[0]?.id])

  return (
    <div className="pointer-events-none fixed top-2 left-0 right-0 z-40 flex justify-center px-4">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`bg-black/85 backdrop-blur-sm border-l-4 ${TYPE_COLOR[shown.type] ?? TYPE_COLOR.flip} px-3 py-1.5 rounded-r-lg text-sm max-w-xs`}
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {shown.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
