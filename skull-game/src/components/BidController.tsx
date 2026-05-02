import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  currentHighest: number
  totalDiscs: number
  onBid: (amount: number) => void
  onFold: () => void
  canFold: boolean
  isLoading: boolean
}

export function BidController({ currentHighest, totalDiscs, onBid, onFold, canFold, isLoading }: Props) {
  const [amount, setAmount] = useState(currentHighest + 1)

  const minBid = currentHighest + 1
  const maxBid = totalDiscs

  function decrement() { setAmount(v => Math.max(minBid, v - 1)) }
  function increment() { setAmount(v => Math.min(maxBid, v + 1)) }

  return (
    <div className="bg-gray-900/90 border border-purple-500/30 rounded-xl px-3 py-2">
      <div className="flex items-center gap-2">
        {/* Current highest */}
        <div className="text-xs text-white/40 whitespace-nowrap" style={{ fontFamily: 'Crimson Text, serif' }}>
          最高: <span className="text-amber-400 font-bold">{currentHighest === 0 ? '—' : currentHighest}</span>
        </div>

        <div className="flex-1" />

        {/* Amount picker */}
        <motion.button
          onClick={decrement}
          disabled={amount <= minBid}
          className="w-8 h-8 rounded-full border border-white/20 text-white disabled:opacity-30 text-lg font-bold flex items-center justify-center flex-shrink-0"
          whileTap={{ scale: 0.9 }}
        >−</motion.button>

        <div className="text-center min-w-[52px]">
          <span className="text-white text-2xl font-bold" style={{ fontFamily: 'Cinzel, serif' }}>{amount}</span>
          <p className="text-white/40 text-xs leading-none">枚</p>
        </div>

        <motion.button
          onClick={increment}
          disabled={amount >= maxBid}
          className="w-8 h-8 rounded-full border border-white/20 text-white disabled:opacity-30 text-lg font-bold flex items-center justify-center flex-shrink-0"
          whileTap={{ scale: 0.9 }}
        >＋</motion.button>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex gap-1.5">
          {canFold && (
            <motion.button
              onClick={onFold}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl border border-white/20 text-white/70 text-sm disabled:opacity-50"
              whileTap={{ scale: 0.97 }}
              style={{ fontFamily: 'Crimson Text, serif' }}
            >
              パス
            </motion.button>
          )}
          <motion.button
            onClick={() => onBid(amount)}
            disabled={isLoading || amount > maxBid}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-700 to-purple-500 text-white font-bold text-sm disabled:opacity-50 shadow-lg shadow-purple-500/20 whitespace-nowrap"
            whileTap={{ scale: 0.97 }}
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {amount}枚宣言
          </motion.button>
        </div>
      </div>
    </div>
  )
}
