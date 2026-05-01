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

  function decrement() {
    setAmount(v => Math.max(minBid, v - 1))
  }
  function increment() {
    setAmount(v => Math.min(maxBid, v + 1))
  }

  return (
    <div className="bg-gray-900/90 border border-purple-500/30 rounded-2xl p-4 space-y-3">
      {/* Current highest */}
      <div className="text-center">
        <p className="text-white/50 text-xs" style={{ fontFamily: 'Crimson Text, serif' }}>現在の最高入札</p>
        <p className="text-amber-400 text-2xl font-bold" style={{ fontFamily: 'Cinzel, serif' }}>
          {currentHighest === 0 ? '—' : `${currentHighest} 枚`}
        </p>
      </div>

      {/* Amount picker */}
      <div className="flex items-center justify-center gap-4">
        <motion.button
          onClick={decrement}
          disabled={amount <= minBid}
          className="w-10 h-10 rounded-full border border-white/20 text-white disabled:opacity-30 text-xl font-bold flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          −
        </motion.button>

        <div className="text-center min-w-[80px]">
          <span className="text-white text-3xl font-bold" style={{ fontFamily: 'Cinzel, serif' }}>
            {amount}
          </span>
          <p className="text-white/40 text-xs">枚をめくる</p>
        </div>

        <motion.button
          onClick={increment}
          disabled={amount >= maxBid}
          className="w-10 h-10 rounded-full border border-white/20 text-white disabled:opacity-30 text-xl font-bold flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          ＋
        </motion.button>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {canFold && (
          <motion.button
            onClick={onFold}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            パス
          </motion.button>
        )}
        <motion.button
          onClick={() => onBid(amount)}
          disabled={isLoading || amount > maxBid}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-500 text-white font-bold text-sm disabled:opacity-50 shadow-lg shadow-purple-500/20"
          whileTap={{ scale: 0.97 }}
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {amount} 枚と宣言
        </motion.button>
      </div>
    </div>
  )
}
