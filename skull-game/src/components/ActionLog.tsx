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
  const [visible, setVisible] = useState<LogEntry[]>([])

  useEffect(() => {
    const latest = [...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
    setVisible(latest)
  }, [entries])

  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none fixed top-4 left-0 right-0 z-40 flex flex-col items-center gap-1 px-4">
      <AnimatePresence mode="popLayout">
        {visible.map(entry => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`bg-black/80 backdrop-blur-sm border-l-4 ${TYPE_COLOR[entry.type] ?? TYPE_COLOR.flip} px-3 py-1.5 rounded-r-lg text-sm max-w-sm w-full`}
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {entry.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
