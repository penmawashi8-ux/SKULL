import { UpdatePrompt } from './components/UpdatePrompt'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'
import About from './pages/About'
import { Component, useState, type ReactNode } from 'react'

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
type Genre = 'all' | 'trump' | 'bluff' | 'other'

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

const GENRES: { id: Genre; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'bluff', label: 'ブラフ' },
  { id: 'trump', label: 'トランプ' },
  { id: 'other', label: 'その他' },
]

function matchGenre(game: Game, genre: Genre): boolean {
  if (genre === 'all') return true
  if (genre === 'bluff') return game.tags.includes('ブラフ')
  if (genre === 'trump') return game.tags.includes('トランプ')
  return !game.tags.includes('ブラフ') && !game.tags.includes('トランプ')
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
    cardBg: 'linear-gradient(135deg, #2e1515 0%, #3d1a1a 100%)',
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
    cardBg: 'linear-gradient(135deg, #2e1525 0%, #3d1832 100%)',
    players: '1〜6人',
    duration: '約10〜20分',
    tags: ['トランプ', 'パーティ'],
  },
  {
    id: 'keiba',
    name: 'バーチャル競馬',
    nameEn: 'VIRTUAL KEIBA',
    symbol: 'VK',
    description: '馬を選んで予想して観戦！バーチャル競馬で白熱のゴール勝負を楽しもう。実際の賭けや金銭のやりとりは一切なく、純粋にゲームとして楽しめます。',
    status: 'available',
    url: 'https://gamekeiba.boardgamecat.com',
    accentColor: '#d97706',
    cardBg: 'linear-gradient(135deg, #261800 0%, #382400 100%)',
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
    cardBg: 'linear-gradient(135deg, #0f1e3a 0%, #162848 100%)',
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
    cardBg: 'linear-gradient(135deg, #0f2d1e 0%, #163d28 100%)',
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
    cardBg: 'linear-gradient(135deg, #2a1200 0%, #3d1c00 100%)',
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
    cardBg: 'linear-gradient(135deg, #1e1540 0%, #2a1c54 100%)',
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
    cardBg: 'linear-gradient(135deg, #0f2030 0%, #102a3e 100%)',
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
    cardBg: 'linear-gradient(135deg, #221808 0%, #302200 100%)',
    players: '未定',
    duration: '未定',
    tags: ['未定'],
  },
]

function Tag({ text }: { text: string }) {
  return (
    <span
      className="font-sans-jp inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.65)' }}
    >
      {text}
    </span>
  )
}

function GenreFilter({ selected, onChange }: { selected: Genre; onChange: (g: Genre) => void }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-1 mb-4"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {GENRES.map(g => {
        const active = g.id === selected
        return (
          <button
            key={g.id}
            onClick={() => onChange(g.id)}
            className="font-sans-jp flex-shrink-0 text-[12px] font-bold px-4 py-1.5 rounded-full transition-all duration-150"
            style={{
              background: active ? 'rgba(184,146,42,0.9)' : 'rgba(255,255,255,0.08)',
              color: active ? '#fff' : 'rgba(255,255,255,0.5)',
              border: active ? '1px solid #b8922a' : '1px solid rgba(255,255,255,0.1)',
              boxShadow: active ? '0 0 12px rgba(184,146,42,0.4)' : 'none',
            }}
          >
            {g.label}
          </button>
        )
      })}
    </div>
  )
}

function GameIcon({ game, available }: { game: Game; available: boolean }) {
  const color = available ? game.accentColor : 'rgba(255,255,255,0.2)'
  const imgSrc = `/icons/${game.id}.svg`

  return (
    <div
      className="w-[62px] h-[62px] rounded-full flex items-center justify-center flex-shrink-0 select-none relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at 38% 32%, ${available ? game.accentColor + '22' : 'rgba(255,255,255,0.05)'} 0%, rgba(0,0,0,0.4) 100%)`,
        border: `1.5px solid ${color}66`,
        boxShadow: available
          ? `0 0 0 3px rgba(0,0,0,0.4), 0 0 0 4.5px ${game.accentColor}28, inset 0 1px 0 rgba(255,255,255,0.1)`
          : `0 0 0 3px rgba(0,0,0,0.2)`,
        filter: available ? 'none' : 'brightness(0.5)',
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
      <span
        aria-hidden="true"
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
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: isAvailable ? '0 2px 20px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      <div
        className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full"
        style={{ backgroundColor: isAvailable ? game.accentColor : 'rgba(255,255,255,0.1)' }}
      />

      <GameIcon game={game} available={isAvailable} />

      <div className="flex-1 min-w-0">
        <p
          className="font-cinzel text-[9px] font-bold tracking-[0.22em] uppercase mb-0.5"
          style={{ color: isAvailable ? game.accentColor : 'rgba(255,255,255,0.25)' }}
        >
          {game.nameEn}
        </p>
        <h2 className="font-serif-jp font-bold text-[15px] leading-snug mb-1.5 text-white truncate pr-1">
          {game.name}
        </h2>
        <p
          className="font-sans-jp text-[11px] leading-relaxed mb-2"
          style={{ color: 'rgba(255,255,255,0.58)' }}
        >
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {game.tags.map(tag => <Tag key={tag} text={tag} />)}
        </div>
        <div
          className="font-sans-jp flex gap-3 text-[10px]"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <span>👥 {game.players}</span>
          <span>⏱ {game.duration}</span>
        </div>
      </div>

      <div className="flex-shrink-0">
        {isAvailable ? (
          <div
            className="font-cinzel px-3 py-2.5 rounded-xl text-[11px] font-bold text-white text-center leading-snug min-w-[58px]"
            style={{
              backgroundColor: game.accentColor,
              boxShadow: `0 0 18px ${game.accentColor}66`,
            }}
          >
            今すぐ<br />遊ぶ →
          </div>
        ) : (
          <div
            className="font-sans-jp px-3 py-2.5 rounded-xl text-[11px] text-center leading-snug min-w-[58px]"
            style={{
              color: 'rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
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

const NOTICES = [
  {
    id: 1,
    date: '2026.05.22',
    title: 'ジャンルフィルター追加',
    body: 'ゲーム一覧にジャンル別フィルター（ブラフ・トランプ・その他）を追加しました。',
  },
  {
    id: 2,
    date: '2026.05.20',
    title: 'バーチャル競馬 公開',
    body: '馬を選んで予想して観戦！バーチャル競馬を新たに追加しました。',
  },
  {
    id: 3,
    date: '2026.05.15',
    title: '謀略 公開',
    body: 'ブラフ系の新ゲーム「謀略」を公開しました。嘘をついて生き残れ！',
  },
  {
    id: 4,
    date: '2026.05.10',
    title: 'ぶたのしっぽ 公開',
    body: 'トランプゲーム「ぶたのしっぽ」を公開しました。',
  },
]

function NoticeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.6)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col"
        style={{
          width: '82vw',
          maxWidth: '320px',
          background: 'linear-gradient(180deg, #1e1b3a 0%, #16162a 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="font-serif-jp font-bold text-[15px] text-white">お知らせ</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {NOTICES.map(n => (
            <div
              key={n.id}
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="font-cinzel text-[9px] font-bold tracking-widest mb-1" style={{ color: '#b8922a' }}>
                {n.date}
              </p>
              <p className="font-serif-jp font-bold text-[13px] text-white mb-1.5">{n.title}</p>
              <p className="font-sans-jp text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {n.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = (path: string) => { onClose(); window.location.assign(path) }
  const availableGames = games.filter(g => g.status === 'available')

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.6)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        className="fixed top-0 left-0 h-full z-40 flex flex-col"
        style={{
          width: '72vw',
          maxWidth: '300px',
          background: 'linear-gradient(180deg, #1e1b3a 0%, #16162a 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <p className="font-cinzel text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: '#b8922a' }}>
              Board Game Collection
            </p>
            <p className="font-serif-jp font-bold text-[15px] text-white mt-0.5">ボドゲ広場</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            ✕
          </button>
        </div>

        {/* Games section */}
        <div className="px-5 pt-5 pb-3">
          <p className="font-cinzel text-[8px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Games
          </p>
          <div className="flex flex-col gap-1">
            {availableGames.map(g => (
              <button
                key={g.id}
                onClick={() => g.url && window.location.assign(g.url)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: g.accentColor }}
                />
                <span className="font-sans-jp text-[13px] text-white/80">{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 my-2" style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

        {/* Info section */}
        <div className="px-5 pt-3">
          <p className="font-cinzel text-[8px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Info
          </p>
          <div className="flex flex-col gap-1">
            {[
              { label: 'ブログ', path: '/blog/' },
              { label: '企業情報', path: '/about' },
              { label: 'プライバシーポリシー', path: '/privacy-policy' },
              { label: '利用規約', path: '/terms' },
              { label: 'お問い合わせ', path: '/contact' },
            ].map(({ label, path }) => (
              <a
                key={path}
                href={path}
                onClick={e => { e.preventDefault(); navigate(path) }}
                className="font-sans-jp text-left px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 active:scale-[0.98]"
                style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', display: 'block' }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-5">
          <p className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © 2026 ボドゲ広場
          </p>
        </div>
      </div>
    </>
  )
}

export default function App() {
  const path = window.location.pathname

  if (path === '/privacy-policy') return <PrivacyPolicy />
  if (path === '/terms') return <Terms />
  if (path === '/contact') return <Contact />
  if (path === '/about') return <About />

  const [genre, setGenre] = useState<Genre>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const available = games.filter(g => g.status === 'available' && matchGenre(g, genre))
  const comingSoon = games.filter(g => g.status === 'coming-soon')

  return (
    <div className="min-h-screen" style={{ background: '#16162a' }}>
      <SafeRender>
        <UpdatePrompt />
      </SafeRender>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <NoticeDrawer open={noticeOpen} onClose={() => setNoticeOpen(false)} />

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(22,22,42,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          className="w-9 h-9 flex items-center justify-center text-white/60 text-xl"
          onClick={() => setDrawerOpen(true)}
        >
          ☰
        </button>
        <div className="text-center">
          <p
            className="font-cinzel text-[8px] font-bold tracking-[0.3em] uppercase"
            style={{ color: '#b8922a' }}
          >
            Board Game Collection
          </p>
          <div className="flex items-center justify-center gap-2 my-0.5">
            <div style={{ height: '1px', width: '28px', background: 'linear-gradient(to right, transparent, #b8922a66)' }} />
            <div style={{ width: '4px', height: '4px', background: '#b8922a99', transform: 'rotate(45deg)' }} />
            <div style={{ height: '1px', width: '28px', background: 'linear-gradient(to left, transparent, #b8922a66)' }} />
          </div>
          <h1 className="font-serif-jp font-bold text-[14px] text-white tracking-widest">
            ボドゲ広場
          </h1>
        </div>
        <button
          className="w-9 h-9 flex items-center justify-center text-white/60 text-xl"
          onClick={() => setNoticeOpen(true)}
        >
          🔔
        </button>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-10 pb-7 overflow-hidden">
        <div
          className="absolute right-[-8px] top-[-4px] text-[110px] select-none pointer-events-none leading-none"
          style={{ opacity: 0.1 }}
        >
          🃏
        </div>
        <div
          className="absolute left-[-12px] top-8 text-[88px] select-none pointer-events-none leading-none"
          style={{ opacity: 0.08, transform: 'rotate(-18deg)' }}
        >
          🎲
        </div>

        <p
          className="font-sans-jp text-xs mb-1.5 relative z-10"
          style={{ color: 'rgba(255,255,255,0.55)' }}
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
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          友達と、家族と、見知らぬ誰かと。<br />
          オンラインでつながるボードゲームの世界。
        </p>
      </section>

      {/* Separator */}
      <div
        className="mx-5 mb-4"
        style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)' }}
      />

      {/* Genre filter */}
      <GenreFilter selected={genre} onChange={setGenre} />

      {/* Game list */}
      <main className="px-4 pb-8 max-w-xl mx-auto">
        <div className="flex flex-col gap-3">
          {available.length > 0
            ? available.map(game => <GameRow key={game.id} game={game} />)
            : (
              <p
                className="font-sans-jp text-center text-[12px] py-10"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                このジャンルのゲームは準備中です
              </p>
            )
          }
        </div>

        {genre === 'all' && comingSoon.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span
                className="font-cinzel text-[9px] font-bold tracking-[0.3em] uppercase"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                Coming Soon
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <p
              className="font-sans-jp text-center text-[11px] mb-4"
              style={{ color: 'rgba(255,255,255,0.25)' }}
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
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="font-cinzel text-[10px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#b8922a' }}>
          ボドゲ広場
        </p>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2.5 mb-4">
          {[
            { label: 'ブログ', path: '/blog/' },
            { label: '企業情報', path: '/about' },
            { label: 'プライバシーポリシー', path: '/privacy-policy' },
            { label: '利用規約', path: '/terms' },
            { label: 'お問い合わせ', path: '/contact' },
          ].map(({ label, path }) => (
            <a
              key={path}
              href={path}
              onClick={e => { e.preventDefault(); window.location.assign(path) }}
              className="font-sans-jp text-[11px] hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2026 ボドゲ広場
        </p>
      </footer>
    </div>
  )
}
