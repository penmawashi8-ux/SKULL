import { UpdatePrompt } from './components/UpdatePrompt'
import PigTailGame from './games/PigTailGame'
import { Component, type ReactNode } from 'react'

class SafeRender extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: unknown) { console.error('SafeRender caught:', error) }
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
    description: '爆弾かリンゴか——ブラフと心理戦が熱いパーティゲーム。仲間を騙して爆発を回避せよ！',
    icon: '💣',
    status: 'available',
    url: BOMB_GAME_URL,
    accentColor: '#dc2626',
    cardBg: 'linear-gradient(135deg, #1c1010 0%, #2d1515 100%)',
    players: '2〜6人',
    duration: '約20分',
    tags: ['ブラフ', '心理戦', 'パーティ'],
  },
  {
    id: 'pig-tail',
    name: 'ぶたのしっぽ',
    nameEn: "PIG'S TAIL",
    description: 'カードをめくって中央に積んでいく。マークが一致したら山を全部もらい、手札を一番少なく抑えた人が勝ち。',
    icon: '🐷',
    status: 'available',
    url: 'https://buta-steel.vercel.app',
    accentColor: '#ec4899',
    cardBg: 'linear-gradient(135deg, #1a0d15 0%, #2d1020 100%)',
    players: '1〜6人',
    duration: '約10〜20分',
    tags: ['反射神経', 'トランプ', 'パーティ'],
  },
  {
    id: 'keiba',
    name: 'バーチャル競馬',
    nameEn: 'VIRTUAL KEIBA',
    description: '馬を選んで予想して観戦！バーチャル競馬で白熱のゴール勝負を楽しもう。',
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
    id: 'page-one',
    name: 'ページワン',
    nameEn: 'PAGE ONE',
    description: '手札のマークが合えばカードを出せる。最後の1枚になったら「ページワン！」と宣言。手札をなくした人が勝ちのトランプゲーム。',
    icon: '🃏',
    status: 'available',
    url: 'https://pageone-wine.vercel.app',
    accentColor: '#2563eb',
    cardBg: 'linear-gradient(135deg, #0a0f1e 0%, #0f1f40 100%)',
    players: '1〜4人',
    duration: '約15〜30分',
    tags: ['トランプ', '特殊カード', 'パーティ'],
  },
  {
    id: 'coup',
    name: '謀略',
    nameEn: 'BORYAKU',
    description: '嘘をついても、バレなければ勝ち。持っていないキャラクターも堂々と宣言し、ライバルを蹴落とせ！最後に生き残った者が勝者。',
    icon: '👑',
    status: 'available',
    url: 'https://coup-two.vercel.app',
    accentColor: '#10b981',
    cardBg: 'linear-gradient(135deg, #0a1f15 0%, #122b1e 100%)',
    players: '2〜6人',
    duration: '約15〜30分',
    tags: ['ブラフ', '心理戦', '推理'],
  },
  {
    id: 'racing-board',
    name: '疾走（ベータ版）',
    nameEn: 'SHISSOU',
    description: '進め！斜行して相手を止めろ。邪魔をかいくぐり、誰より先にゴールを目指せ！',
    icon: '🏇',
    status: 'available',
    url: 'https://g-oei1.vercel.app',
    accentColor: '#ea580c',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 100%)',
    players: '2人〜',
    duration: '約10〜20分',
    tags: ['レース', 'ブロック', 'β版'],
  },
  {
    id: 'g-board-app',
    name: 'G Umber（ベータ版）',
    nameEn: 'G UMBER',
    description: '戦略とひらめきで勝負する対戦型ウェブアプリ。',
    icon: '🧠',
    status: 'available',
    url: 'https://g-umber-tau.vercel.app',
    accentColor: '#7c3aed',
    cardBg: 'linear-gradient(135deg, #1e1b2e 0%, #2e1a47 100%)',
    players: '2人〜',
    duration: '約10〜20分',
    tags: ['対戦', '戦略', 'β版'],
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

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white/60"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
      {text}
    </span>
  )
}

function GameRow({ game }: { game: Game }) {
  const isAvailable = game.status === 'available'

  const inner = (
    <div
      className="relative flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.985]"
      style={{
        background: game.cardBg,
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
        style={{ backgroundColor: isAvailable ? game.accentColor : 'rgba(255,255,255,0.1)' }}
      />

      {/* Icon */}
      <div
        className="text-4xl w-14 h-14 flex items-center justify-center flex-shrink-0 rounded-xl select-none ml-1"
        style={{
          background: 'rgba(0,0,0,0.25)',
          filter: isAvailable ? 'none' : 'grayscale(80%) brightness(0.4)',
        }}
      >
        {game.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] font-black tracking-[0.18em] mb-0.5 uppercase"
          style={{ color: isAvailable ? game.accentColor : 'rgba(255,255,255,0.2)' }}
        >
          {game.nameEn}
        </p>
        <h2 className="text-base font-black text-white leading-tight mb-1.5 truncate pr-1">
          {game.name}
        </h2>
        <p className="text-[11px] text-white/45 leading-relaxed line-clamp-2 mb-2">
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {game.tags.map(tag => <Tag key={tag} text={tag} />)}
        </div>
        <div className="flex gap-3 text-[10px] text-white/25">
          <span>👥 {game.players}</span>
          <span>⏱ {game.duration}</span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0 ml-1">
        {isAvailable ? (
          <div
            className="px-3 py-2.5 rounded-xl text-[11px] font-black text-white text-center leading-tight min-w-[60px]"
            style={{ backgroundColor: game.accentColor }}
          >
            今すぐ<br />遊ぶ →
          </div>
        ) : (
          <div className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-white/20 text-center bg-white/5 border border-white/8 min-w-[60px] leading-tight">
            準備<br />中...
          </div>
        )}
      </div>
    </div>
  )

  if (isAvailable && game.url) {
    return (
      <a
        href={game.url}
        className="block no-underline"
        onClick={e => { e.preventDefault(); window.location.assign(game.url!) }}
      >
        {inner}
      </a>
    )
  }
  return <div>{inner}</div>
}

export default function App() {
  if (window.location.pathname === '/pig-tail') {
    return (
      <SafeRender>
        <PigTailGame />
      </SafeRender>
    )
  }

  const available = games.filter(g => g.status === 'available')
  const comingSoon = games.filter(g => g.status === 'coming-soon')

  return (
    <div className="min-h-screen" style={{ background: '#08080f' }}>
      <SafeRender>
        <UpdatePrompt />
      </SafeRender>

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center px-4 py-3"
        style={{
          background: 'rgba(8,8,15,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="w-10" />
        <div className="flex-1 text-center">
          <p className="text-[9px] font-black tracking-[0.25em] uppercase" style={{ color: '#b8922a' }}>
            Board Game Collection
          </p>
          <h1 className="text-sm font-black text-white tracking-wide">ボドゲ広場</h1>
        </div>
        <div className="w-10 h-10 flex items-center justify-center rounded-full text-white/40 text-lg">
          🔔
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-8 pb-6 overflow-hidden">
        <div className="absolute right-2 top-0 text-[90px] opacity-[0.07] select-none pointer-events-none leading-none">
          🃏
        </div>
        <div className="absolute left-[-10px] top-6 text-[80px] opacity-[0.06] select-none pointer-events-none leading-none rotate-[-15deg]">
          🎲
        </div>
        <p className="text-white/40 text-sm mb-1 relative z-10">ブラウザで遊べる</p>
        <h2
          className="text-3xl font-black mb-3 relative z-10"
          style={{ color: '#e8d5a0' }}
        >
          ボドゲ広場
        </h2>
        <p className="text-white/35 text-xs leading-relaxed relative z-10">
          友達と、家族と、見知らぬ誰かと。<br />
          オンラインでつながるボードゲームの世界。
        </p>
      </section>

      {/* Divider */}
      <div className="mx-5 mb-5" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* Game list */}
      <main className="px-4 pb-6 max-w-2xl mx-auto">
        <div className="flex flex-col gap-3">
          {available.map(game => (
            <GameRow key={game.id} game={game} />
          ))}
        </div>

        {/* Coming soon */}
        {comingSoon.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <span className="text-[10px] font-black tracking-[0.2em] text-white/20 uppercase">Coming Soon</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            </div>
            <p className="text-center text-white/20 text-xs tracking-wider mb-4">
              新しいゲームを続々追加予定
            </p>
            <div className="flex flex-col gap-3">
              {comingSoon.map(game => (
                <GameRow key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
