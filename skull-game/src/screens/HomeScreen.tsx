import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

// Deterministic floating card data (no Math.random in render)
const CARDS = [
  { id: 0, icon: '💣', left: '8%',  duration: 14, delay: 0,    drift: 18,  rotate: 12  },
  { id: 1, icon: '🌸', left: '22%', duration: 11, delay: -3.5, drift: -14, rotate: -10 },
  { id: 2, icon: '🌸', left: '38%', duration: 16, delay: -7,   drift: 22,  rotate: 8   },
  { id: 3, icon: '💣', left: '54%', duration: 12, delay: -1.5, drift: -20, rotate: -15 },
  { id: 4, icon: '🌸', left: '68%', duration: 15, delay: -5,   drift: 16,  rotate: 10  },
  { id: 5, icon: '💣', left: '82%', duration: 13, delay: -9,   drift: -12, rotate: -8  },
  { id: 6, icon: '🌸', left: '14%', duration: 17, delay: -4,   drift: 24,  rotate: 6   },
  { id: 7, icon: '💣', left: '46%', duration: 10, delay: -11,  drift: -18, rotate: -12 },
  { id: 8, icon: '🌸', left: '74%', duration: 14, delay: -2,   drift: 14,  rotate: 9   },
  { id: 9, icon: '💣', left: '90%', duration: 12, delay: -6,   drift: -22, rotate: -7  },
]

export function HomeScreen() {
  const navigate = useNavigate()

  return (
    <div
      className="h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #1a0a2e 0%, #030712 65%)' }}
    >
      {/* Floating background cards */}
      {CARDS.map(card => (
        <motion.div
          key={card.id}
          className="absolute text-5xl pointer-events-none select-none"
          style={{ left: card.left, top: '-10%', opacity: 0.12 }}
          animate={{
            y: ['0vh', '115vh'],
            x: [0, card.drift, 0],
            rotate: [0, card.rotate],
          }}
          transition={{
            duration: card.duration,
            delay: card.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {card.icon}
        </motion.div>
      ))}

      {/* Main content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8 px-6 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        {/* Bomb icon */}
        <motion.div
          className="text-8xl"
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          💣
        </motion.div>

        {/* Title */}
        <div>
          <h1
            className="text-7xl font-bold tracking-widest text-white"
            style={{
              fontFamily: 'Cinzel, serif',
              textShadow: '0 0 40px rgba(139,92,246,0.6), 0 2px 8px rgba(0,0,0,0.8)',
              letterSpacing: '0.2em',
            }}
          >
            BOMB
          </h1>
          <p
            className="text-purple-300/70 text-lg mt-2"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            ～ 嘘と駆け引きのカードゲーム ～
          </p>
        </div>

        {/* Decorative divider */}
        <div className="flex items-center gap-3 w-48">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-purple-500/50" />
          <span className="text-purple-400/50 text-xs">✦</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-purple-500/50" />
        </div>

        {/* Start button */}
        <motion.button
          onClick={() => navigate('/menu')}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white relative overflow-hidden"
          style={{
            fontFamily: 'Cinzel, serif',
            background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
            boxShadow: '0 0 30px rgba(109,40,217,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '1px solid rgba(139,92,246,0.4)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          <motion.div
            className="absolute inset-0 bg-white/10"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 1 }}
          />
          ゲームを始める
        </motion.button>

        <p
          className="text-white/20 text-sm"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          3〜6人 • スマートフォン対応
        </p>
      </motion.div>
    </div>
  )
}
