import { UpdatePrompt } from './components/UpdatePrompt'
import PigTailGame from './games/PigTailGame'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'
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

const BOMB_GAME_URL = 'https://bomb.boardgamecat.com'

type GameStatus = 'available' | 'coming-soon'

interface Game {
  id: string
  name: string
  nameEn: string
  symbol: string
  description: string
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
    symbol: 'BM',
    description: '爆弾かリンゴか——ブラフと心理戦が熱いパーティゲーム。仲間を騙して爆発を回避せよ！',
    status: 'available',
    url: BOMB_GAME_URL,
    accentColor: '#dc2626',
    cardBg: 'linear-gradient(135deg, #1a0d0d 0%, #2a1111 100%)',
    players: '2〜6人',
    duration: '約20分',
    tags: ['ブラフ', '心理戦', 'パーティ'],
  },
  {
    id: 'pig-tail',
    name: 'ぶたのしっぽ',
    nameEn: "PIG'S TAIL",
    symbol: 'PT',
    description: 'カードをめくって中央に積んでいく。マークが一致したら山を全部もらい、手札を一番少なく抑えた人が勝ち。',
    status: 'available',
    url: 'https://buta.boardgamecat.com',
    accentColor: '#ec4899',
    cardBg: 'linear-gradient(135deg, #1a0d15 0%, #2a1020 100%)',
    players: '1〜6人',
    duration: '約10〜20分',
    tags: ['トランプ', 'パーティ'],
  },
  {
    id: 'keiba',
    name: 'バーチャル競馬',
    nameEn: 'VIRTUAL KEIBA',
    symbol: 'VK',
    description: '馬を選んで予想して観戦！バーチャル競馬で白熱のゴール勝負を楽しもう。',
    status: 'available',
    url: 'https://gamekeiba.boardgamecat.com',
    accentColor: '#d97706',
    cardBg: 'linear-gradient(135deg, #160e00 0%, #271a00 100%)',
    players: '1人〜',
    duration: '約5〜10分',
    tags: ['競馬', '予想', 'バーチャル'],
  },
  {
    id: 'page-one',
    name: 'ページワン',
    nameEn: 'PAGE ONE',
    symbol: 'PO',
    description: '手札のマークが合えばカードを出せる。最後の1枚になったら「ページワン！」と宣言。手札をなくした人が勝ちのトランプゲーム。',
    status: 'available',
    url: 'https://pageone.boardgamecat.com',
    accentColor: '#3b82f6',
    cardBg: 'linear-gradient(135deg, #080f1e 0%, #0d1a35 100%)',
    players: '1〜4人',
    duration: '約15〜30分',
    tags: ['トランプ', '特殊カード', 'パーティ'],
  },
  {
    id: 'coup',
    name: '謀略',
    nameEn: 'BORYAKU',
    symbol: 'BK',
    description: '嘘をついても、バレなければ勝ち。持っていないキャラクターも堂々と宣言し、ライバルを蹴落とせ！最後に生き残った者が勝者。',
    status: 'available',
    url: 'https://bouryaku.boardgamecat.com',
    accentColor: '#10b981',
    cardBg: 'linear-gradient(135deg, #081a10 0%, #0f2518 100%)',
    players: '2〜6人',
    duration: '約15〜30分',
    tags: ['ブラフ', '心理戦', '推理'],
  },
  {
    id: 'racing-board',
    name: '疾走（ベータ版）',
    nameEn: 'SHISSOU',
    symbol: 'SH',
    description: '進め！斜行して相手を止めろ。邪魔をかいくぐり、誰より先にゴールを目指せ！',
    status: 'available',
    url: 'https://g-oei1.vercel.app',
    accentColor: '#ea580c',
    cardBg: 'linear-gradient(135deg, #180800 0%, #2a1000 100%)',
    players: '2人〜',
    duration: '約10〜20分',
    tags: ['レース', 'ブロック', 'β版'],
  },
  {
    id: 'g-board-app',
    name: 'MECH SIEGE（ベータ版）',
    nameEn: 'MECH SIEGE',
    symbol: 'MS',
    description: '機械と戦略で制圧せよ。ターン制の対戦型メカバトルゲーム。',
    status: 'available',
    url: 'https://g.boardgamecat.com',
    accentColor: '#7c3aed',
    cardBg: 'linear-gradient(135deg, #160f28 0%, #22163c 100%)',
    players: '2人〜',
    duration: '約10〜20分',
    tags: ['対戦', '戦略', 'β版'],
  },
  {
    id: 'tbd-1',
    name: '？？？',
    nameEn: 'TBD',
    symbol: '?',
    description: '鋭意制作中……',
    status: 'coming-soon',
    accentColor: '#0891b2',
    cardBg: 'linear-gradient(135deg, #0a1520 0%, #0a1e2e 100%)',
    players: '未定',
    duration: '未定',
    tags: ['未定'],
  },
  {
    id: 'tbd-2',
    name: '？？？',
    nameEn: 'TBD',
    symbol: '?',
    description: '鋭意制作中……',
    status: 'coming-soon',
    accentColor: '#b45309',
    cardBg: 'linear-gradient(135deg, #150f04 0%, #221800 100%)',
    players: '未定',
    duration: '未定',
    tags: ['未定'],
  },
]

function Tag({ text }: { text: string }) {
  return (
    <span
      className="font-sans-jp inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}
    >
      {text}
    </span>
  )
}

function GameIcon({ game, available }: { game: Game; available: boolean }) {
  const color = available ? game.accentColor : 'rgba(255,255,255,0.15)'
  const imgSrc = `/icons/${game.id}.svg`

  return (
    <div
      className="w-[62px] h-[62px] rounded-full flex items-center justify-center flex-shrink-0 select-none relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at 38% 32%, ${available ? game.accentColor + '18' : 'rgba(255,255,255,0.03)'} 0%, rgba(0,0,0,0.55) 100%)`,
        border: `1.5px solid ${color}55`,
        boxShadow: available
          ? `0 0 0 3px rgba(0,0,0,0.5), 0 0 0 4.5px ${game.accentColor}22, inset 0 1px 0 rgba(255,255,255,0.07)`
          : `0 0 0 3px rgba(0,0,0,0.3)`,
        filter: available ? 'none' : 'brightness(0.4)',
      }}
    >
      <img
        src={imgSrc}
        alt={game.name}
        className="w-full h-full object-cover rounded-full"
        onError={e => {
          const el = e.currentTarget
          el.style.display = 'none'
          const fallback = el.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      {/* Fallback monogram shown only if image fails */}
      <span
        className="font-cinzel absolute inset-0 items-center justify-center text-[13px] font-black tracking-wider"
        style={{ display: 'none', color, textShadow: available ? `0 0 18px ${game.accentColor}90` : 'none' }}
      >
        {game.symbol}
      </span>
    </div>
  )
}

function GameRow({ game }: { game: Game }) {
  const isAvailable = game.status === 'available'

  const inner = (
    <div
      className="relative flex items-center gap-3.5 px-4 py-4 rounded-2xl transition-all duration-200 active:scale-[0.985] active:brightness-90"
      style={{
        background: game.cardBg,
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: isAvailable ? '0 2px 24px rgba(0,0,0,0.45)' : 'none',
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full"
        style={{ backgroundColor: isAvailable ? game.accentColor : 'rgba(255,255,255,0.07)' }}
      />

      <GameIcon game={game} available={isAvailable} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="font-cinzel text-[9px] font-bold tracking-[0.22em] uppercase mb-0.5"
          style={{ color: isAvailable ? game.accentColor : 'rgba(255,255,255,0.18)' }}
        >
          {game.nameEn}
        </p>
        <h2 className="font-serif-jp font-bold text-[15px] leading-snug mb-1.5 text-white truncate pr-1">
          {game.name}
        </h2>
        <p
          className="font-sans-jp text-[11px] leading-relaxed mb-2"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {game.tags.map(tag => <Tag key={tag} text={tag} />)}
        </div>
        <div
          className="font-sans-jp flex gap-3 text-[10px]"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          <span>👥 {game.players}</span>
          <span>⏱ {game.duration}</span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0">
        {isAvailable ? (
          <div
            className="font-cinzel px-3 py-2.5 rounded-xl text-[11px] font-bold text-white text-center leading-snug min-w-[58px]"
            style={{
              backgroundColor: game.accentColor,
              boxShadow: `0 0 18px ${game.accentColor}55`,
            }}
          >
            今すぐ<br />遊ぶ →
          </div>
        ) : (
          <div
            className="font-sans-jp px-3 py-2.5 rounded-xl text-[11px] text-center leading-snug min-w-[58px]"
            style={{
              color: 'rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            準備<br />中…
          </div>
        )}
      </div>
    </div>
  )

  if (isAvailable && game.url) {
    return (
      <a
        href={game.url}
        className="block no-underline card-enter"
        onClick={e => { e.preventDefault(); window.location.assign(game.url!) }}
      >
        {inner}
      </a>
    )
  }
  return <div className="card-enter">{inner}</div>
}

export default function App() {
  const path = window.location.pathname

  if (path === '/pig-tail') {
    return (
      <SafeRender>
        <PigTailGame />
      </SafeRender>
    )
  }
  if (path === '/privacy-policy') return <PrivacyPolicy />
  if (path === '/terms') return <Terms />
  if (path === '/contact') return <Contact />

  const available = games.filter(g => g.status === 'available')
  const comingSoon = games.filter(g => g.status === 'coming-soon')

  return (
    <div className="min-h-screen" style={{ background: '#09090f' }}>
      <SafeRender>
        <UpdatePrompt />
      </SafeRender>

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(9,9,15,0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="w-9 h-9 flex items-center justify-center text-white/40 text-xl font-light">
          ☰
        </div>
        <div className="text-center">
          <p
            className="font-cinzel text-[8px] font-bold tracking-[0.3em] uppercase"
            style={{ color: '#b8922a' }}
          >
            Board Game Collection
          </p>
          {/* Diamond separator */}
          <div className="flex items-center justify-center gap-2 my-0.5">
            <div style={{ height: '1px', width: '28px', background: 'linear-gradient(to right, transparent, #b8922a55)' }} />
            <div style={{ width: '4px', height: '4px', background: '#b8922a88', transform: 'rotate(45deg)' }} />
            <div style={{ height: '1px', width: '28px', background: 'linear-gradient(to left, transparent, #b8922a55)' }} />
          </div>
          <h1 className="font-serif-jp font-bold text-[14px] text-white tracking-widest">
            ボドゲ広場
          </h1>
        </div>
        <div className="w-9 h-9 flex items-center justify-center text-white/40 text-xl">
          🔔
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-10 pb-7 overflow-hidden">
        <div
          className="absolute right-[-8px] top-[-4px] text-[110px] select-none pointer-events-none leading-none"
          style={{ opacity: 0.07 }}
        >
          🃏
        </div>
        <div
          className="absolute left-[-12px] top-8 text-[88px] select-none pointer-events-none leading-none"
          style={{ opacity: 0.055, transform: 'rotate(-18deg)' }}
        >
          🎲
        </div>

        <p
          className="font-sans-jp text-xs mb-1.5 relative z-10"
          style={{ color: 'rgba(255,255,255,0.38)' }}
        >
          ブラウザで遊べる
        </p>
        <h2
          className="font-serif-jp font-bold text-[32px] leading-tight mb-3 relative z-10"
          style={{ color: '#e2c97e' }}
        >
          ボドゲ広場
        </h2>
        <p
          className="font-sans-jp text-[12px] leading-relaxed relative z-10"
          style={{ color: 'rgba(255,255,255,0.32)' }}
        >
          友達と、家族と、見知らぬ誰かと。<br />
          オンラインでつながるボードゲームの世界。
        </p>
      </section>

      {/* Separator */}
      <div
        className="mx-5 mb-5"
        style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)' }}
      />

      {/* Game list */}
      <main className="px-4 pb-8 max-w-xl mx-auto">
        <div className="flex flex-col gap-3">
          {available.map(game => (
            <GameRow key={game.id} game={game} />
          ))}
        </div>

        {comingSoon.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <span
                className="font-cinzel text-[9px] font-bold tracking-[0.3em] uppercase"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                Coming Soon
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            </div>
            <p
              className="font-sans-jp text-center text-[11px] mb-4"
              style={{ color: 'rgba(255,255,255,0.18)' }}
            >
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

      {/* Footer */}
      <footer
        className="px-5 py-8 text-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <p className="font-cinzel text-[10px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#b8922a' }}>
          ボドゲ広場
        </p>
        <nav className="flex justify-center gap-5 mb-4">
          {[
            { label: 'プライバシーポリシー', path: '/privacy-policy' },
            { label: '利用規約', path: '/terms' },
            { label: 'お問い合わせ', path: '/contact' },
          ].map(({ label, path }) => (
            <a
              key={path}
              href={path}
              onClick={e => { e.preventDefault(); window.location.assign(path) }}
              className="font-sans-jp text-[11px] hover:opacity-80 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
          © 2026 ボドゲ広場
        </p>
      </footer>
    </div>
  )
}
