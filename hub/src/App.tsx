import { UpdatePrompt } from './components/UpdatePrompt'
import PigTailGame from './games/PigTailGame'
import { Component, type ReactNode } from 'react'

class SafeRender extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('SafeRender caught an error:', error)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

const BOMB_GAME_URL = import.meta.env.VITE_BOMB_GAME_URL as string | undefined

type GameStatus = 'available' | 'coming-soon'

interface Game {
  id: string
  name: string
  nameEn: string
  description: string
  icon: string
  status: GameStatus
  url?: string
  accentColor: string
  cardBg: string
  players: string
  duration: string
  tags: string[]
}

const games: Game[] = [
  {
    id: 'bomb',
    name: 'BOMB',
    nameEn: 'BOMB',
    description:
      '爆弾かリンゴか——ブラフと心理戦が熱いパーティゲーム。仲間を騙して爆発を回避せよ！',
    icon: '💣',
    status: 'available',
    url: BOMB_GAME_URL,
    accentColor: '#dc2626',
    cardBg: 'linear-gradient(135deg, #1c1c1e 0%, #2d1515 100%)',
    players: '2〜6人',
    duration: '約20分',
    tags: ['ブラフ', '心理戦', 'パーティ'],
  },
  {
    id: 'g-board-app',
    name: 'G Umber',
    nameEn: 'G UMBER',
    description: '戦略とひらめきで勝負する対戦型ウェブアプリ。気軽に遊べる新作タイトル！',
    icon: '🧠',
    status: 'available',
    url: 'https://g-umber-tau.vercel.app',
    accentColor: '#7c3aed',
    cardBg: 'linear-gradient(135deg, #1e1b2e 0%, #2e1a47 100%)',
    players: '2人〜',
    duration: '約10〜20分',
    tags: ['対戦', '戦略', '新作'],
  },
  {
    id: 'pig-tail',
    name: 'ぶたのしっぽ',
    nameEn: "PIG'S TAIL",
    description:
      'カードをめくって中央に積んでいく。色か数字が一致したら山を全部もらい！手札を一番少なく抑えた人が勝ち。',
    icon: '🐷',
    status: 'available',
    url: '/pig-tail',
    accentColor: '#ec4899',
    cardBg: 'linear-gradient(135deg, #1a0d15 0%, #2d1020 100%)',
    players: '2〜4人',
    duration: '約10〜20分',
    tags: ['反射神経', 'トランプ', 'パーティ'],
  },
  {
    id: 'keiba',
    name: 'バーチャル競馬',
    nameEn: 'VIRTUAL KEIBA',
    description:
      '馬を選んで予想して観戦！バーチャル競馬で白熱のゴール勝負を楽しもう。',
    icon: '🐎',
    status: 'available',
    url: 'https://gamekeiba.vercel.app',
    accentColor: '#f59e0b',
    cardBg: 'linear-gradient(135deg, #150f00 0%, #2a1e00 100%)',
    players: '1人〜',
    duration: '約5〜10分',
    tags: ['競馬', '予想', 'バーチャル'],
  },
  {
    id: 'tbd-1',
    name: '？？？',
    nameEn: 'TBD',
    description: '鋭意制作中……',
    icon: '❓',
    status: 'coming-soon',
    accentColor: '#0891b2',
    cardBg: 'linear-gradient(135deg, #0c1a2e 0%, #0a2540 100%)',
    players: '未定',
    duration: '未定',
    tags: ['未定'],
  },
  {
    id: 'tbd-2',
    name: '？？？',
    nameEn: 'TBD',
    description: '鋭意制作中……',
    icon: '❓',
    status: 'coming-soon',
    accentColor: '#d97706',
    cardBg: 'linear-gradient(135deg, #1c1208 0%, #2e1f00 100%)',
    players: '未定',
    duration: '未定',
    tags: ['未定'],
  },
]

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70">
      {text}
    </span>
  )
}

function GameCard({ game }: { game: Game }) {
  const isAvailable = game.status === 'available'

  const cardContent = (
    <div
      className={`
        relative rounded-2xl overflow-hidden h-full flex flex-col
        border border-white/10 shadow-xl
        transition-all duration-300
        ${isAvailable ? 'hover:scale-[1.03] hover:shadow-2xl cursor-pointer' : 'opacity-75 cursor-not-allowed'}
      `}
      style={{ background: game.cardBg }}
    >
      {/* Top accent line */}
      <div className="h-1 w-full" style={{ backgroundColor: game.accentColor }} />

      {/* Coming soon ribbon */}
      {!isAvailable && (
        <div
          className="absolute top-4 right-4 text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase"
          style={{ backgroundColor: game.accentColor + '33', color: game.accentColor, border: `1px solid ${game.accentColor}66` }}
        >
          COMING SOON
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Icon */}
        <div
          className={`text-5xl mb-3 select-none ${isAvailable ? 'float' : ''}`}
          style={{ filter: isAvailable ? 'none' : 'grayscale(80%) brightness(0.5)' }}
        >
          {game.icon}
        </div>

        {/* Name */}
        <div className="mb-1">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: game.accentColor }}>
            {game.nameEn}
          </span>
        </div>
        <h2 className="text-xl font-black text-white mb-3">{game.name}</h2>

        {/* Description */}
        <p className="text-sm text-white/60 leading-relaxed flex-1 mb-4">{game.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {game.tags.map((tag) => (
            <Badge key={tag} text={tag} />
          ))}
        </div>

        {/* Meta info */}
        <div className="flex gap-4 text-xs text-white/40 mb-5">
          <span>👥 {game.players}</span>
          <span>⏱ {game.duration}</span>
        </div>

        {/* CTA */}
        {isAvailable ? (
          <div
            className="py-3 rounded-xl text-center text-sm font-black text-white tracking-wider transition-opacity hover:opacity-90"
            style={{ backgroundColor: game.accentColor }}
          >
            今すぐ遊ぶ →
          </div>
        ) : (
          <div className="py-3 rounded-xl text-center text-sm font-bold text-white/20 bg-white/5 border border-white/10">
            準備中...
          </div>
        )}
      </div>
    </div>
  )

  if (isAvailable && game.url) {
    return (
      <a
        href={game.url}
        target="_self"
        rel="noopener"
        className="block h-full no-underline"
        onClick={(event) => {
          event.preventDefault()
          window.location.assign(game.url!)
        }}
      >
        {cardContent}
      </a>
    )
  }

  return <div className="h-full">{cardContent}</div>
}

function Decoration({ emoji, className }: { emoji: string; className: string }) {
  return (
    <div className={`absolute select-none pointer-events-none opacity-20 text-4xl ${className}`}>
      {emoji}
    </div>
  )
}

export default function App() {
  if (window.location.pathname === '/pig-tail') {
    return (
      <SafeRender>
        <PigTailGame />
      </SafeRender>
    )
  }

  const availableCount = games.filter((g) => g.status === 'available').length

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}
    >
      <SafeRender>
        <UpdatePrompt />
      </SafeRender>
      {/* Background decorations */}
      <Decoration emoji="🎲" className="top-12 left-8 spin-slow text-6xl" />
      <Decoration emoji="🃏" className="top-24 right-16 float" />
      <Decoration emoji="♟️" className="top-64 left-24 float text-5xl" />
      <Decoration emoji="🎯" className="bottom-32 right-8 spin-slow" />
      <Decoration emoji="⭐" className="bottom-16 left-12 float text-5xl" />

      {/* Header */}
      <header className="relative z-10 pt-14 pb-10 text-center px-4">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 mb-6 border border-white/20">
          <span className="text-[11px] font-black tracking-[0.2em] uppercase text-white/70">
            Board Game Collection
          </span>
          <span className="text-[10px] font-bold bg-green-400 text-black rounded-full px-2 py-0.5">
            {availableCount} 本公開中
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tight">
          🎲 ボドゲ広場
        </h1>
        <p className="text-white/50 text-sm md:text-base max-w-md mx-auto leading-relaxed">
          ブラウザで遊べるオンラインボードゲームが集まった広場。
          <br />
          友達と、家族と、見知らぬ誰かと。
        </p>
      </header>

      {/* Game grid */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-white/25 text-xs mt-14 tracking-wider">
          新しいゲームを随時追加予定 ✨
        </p>
      </main>
    </div>
  )
}
