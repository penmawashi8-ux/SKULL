import { UpdatePrompt } from './components/UpdatePrompt'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'
import About from './pages/About'
import GameEmbed from './pages/GameEmbed'
import { useCanonical } from './useCanonical'
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
type Genre = 'all' | 'trump' | 'bluff' | 'solo' | 'other'

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
  { id: 'all',   label: 'すべて' },
  { id: 'bluff', label: 'ブラフ' },
  { id: 'trump', label: 'トランプ' },
  { id: 'solo',  label: '1人用' },
  { id: 'other', label: 'その他' },
]

const GENRE_COLORS: Record<Genre, string> = {
  all:   '#ffd43b',
  bluff: '#c084fc',
  trump: '#60a5fa',
  solo:  '#fde68a',
  other: '#34d399',
}

function matchGenre(game: Game, genre: Genre): boolean {
  if (genre === 'all') return true
  if (genre === 'bluff') return game.tags.includes('ブラフ')
  if (genre === 'trump') return game.tags.includes('トランプ')
  if (genre === 'solo') return game.tags.includes('1人用')
  return !game.tags.includes('ブラフ') && !game.tags.includes('トランプ') && !game.tags.includes('1人用')
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
    accentColor: '#f87171',
    cardBg: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)',
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
    accentColor: '#f9a8d4',
    cardBg: 'linear-gradient(135deg, #831843 0%, #be185d 100%)',
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
    accentColor: '#6ee7b7',
    cardBg: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
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
    accentColor: '#93c5fd',
    cardBg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
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
    accentColor: '#86efac',
    cardBg: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
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
    accentColor: '#fdba74',
    cardBg: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)',
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
    accentColor: '#c4b5fd',
    cardBg: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)',
    players: '2人〜',
    duration: '約10〜20分',
    tags: ['対戦', '戦略', 'β版'],
  },
  {
    id: 'poko-light',
    name: 'ポコっとライト',
    nameEn: 'POKO LIGHT',
    symbol: 'PL',
    description: '全部のライトを点けたらクリア！完全1人用パズルゲーム。',
    status: 'available',
    url: 'https://poko.boardgamecat.com',
    accentColor: '#fde68a',
    cardBg: 'linear-gradient(135deg, #3d2900 0%, #b45309 100%)',
    players: '1人',
    duration: '数分〜',
    tags: ['パズル', '1人用'],
  },
  {
    id: 'tbd-1',
    name: '？？？',
    nameEn: 'TBD',
    symbol: '?',
    description: '鋭意制作中……',
    status: 'coming-soon',
    accentColor: '#7dd3fc',
    cardBg: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
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
    accentColor: '#fcd34d',
    cardBg: 'linear-gradient(135deg, #451a03 0%, #b45309 100%)',
    players: '未定',
    duration: '未定',
    tags: ['未定'],
  },
]

function Tag({ text, accentColor }: { text: string; accentColor?: string }) {
  return (
    <span
      className="font-sans-jp inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full"
      style={{
        background: accentColor ? `${accentColor}28` : 'rgba(255,255,255,0.15)',
        color: accentColor || 'rgba(255,255,255,0.82)',
        border: `1px solid ${accentColor ? accentColor + '55' : 'rgba(255,255,255,0.14)'}`,
      }}
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
        const color = GENRE_COLORS[g.id]
        return (
          <button
            key={g.id}
            onClick={() => onChange(g.id)}
            className="font-sans-jp flex-shrink-0 text-[12px] font-bold px-5 py-2 transition-all duration-150 active:scale-95"
            style={{
              borderRadius: '999px',
              background: active ? color : `${color}22`,
              color: active ? '#1a1c30' : color,
              border: `2px solid ${color}55`,
              boxShadow: active ? `0 4px 14px ${color}55` : 'none',
              transform: active ? 'translateY(-1px)' : 'translateY(0)',
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
      className="w-[64px] h-[64px] rounded-full flex items-center justify-center flex-shrink-0 select-none relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at 38% 32%, ${available ? game.accentColor + '30' : 'rgba(255,255,255,0.05)'} 0%, rgba(0,0,0,0.35) 100%)`,
        border: `2px solid ${color}66`,
        boxShadow: available
          ? `0 0 0 3px rgba(0,0,0,0.3), 0 0 0 5px ${game.accentColor}22, 0 4px 16px ${game.accentColor}33`
          : `0 0 0 3px rgba(0,0,0,0.2)`,
        filter: available ? 'none' : 'brightness(0.45)',
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
      className="relative flex items-center gap-3.5 px-4 py-4 transition-all duration-200 active:scale-[0.985] active:brightness-90"
      style={{
        borderRadius: '22px',
        background: game.cardBg,
        border: '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: isAvailable
          ? '0 4px 24px rgba(0,0,0,0.30), 0 1px 0 rgba(255,255,255,0.06) inset'
          : 'none',
      }}
    >
      {/* left accent stripe */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[4px] rounded-r-full"
        style={{ backgroundColor: isAvailable ? game.accentColor : 'rgba(255,255,255,0.08)' }}
      />

      <GameIcon game={game} available={isAvailable} />

      <div className="flex-1 min-w-0">
        <p
          className="font-cinzel text-[9px] font-bold tracking-[0.2em] uppercase mb-0.5"
          style={{ color: isAvailable ? game.accentColor : 'rgba(255,255,255,0.22)' }}
        >
          {game.nameEn}
        </p>
        <h2 className="font-serif-jp font-bold text-[15px] leading-snug mb-1.5 text-white truncate pr-1">
          {game.name}
        </h2>
        <p
          className="font-sans-jp text-[11px] leading-relaxed mb-2"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {game.tags.map(tag => (
            <Tag key={tag} text={tag} accentColor={isAvailable ? game.accentColor : undefined} />
          ))}
        </div>
        <div
          className="font-sans-jp flex gap-3 text-[10px]"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <span>👥 {game.players}</span>
          <span>⏱ {game.duration}</span>
        </div>
      </div>

      <div className="flex-shrink-0">
        {isAvailable ? (
          <div
            className="play-btn font-serif-jp px-3 py-2.5 text-[11px] font-bold text-white text-center leading-snug min-w-[58px]"
            style={{
              borderRadius: '999px',
              background: `linear-gradient(135deg, ${game.accentColor}cc, ${game.accentColor})`,
              color: '#fff',
              boxShadow: `0 4px 14px ${game.accentColor}66`,
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            今すぐ<br />遊ぶ →
          </div>
        ) : (
          <div
            className="font-sans-jp px-3 py-2.5 text-[11px] text-center leading-snug min-w-[58px]"
            style={{
              borderRadius: '999px',
              color: 'rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.08)',
            }}
          >
            準備<br />中…
          </div>
        )}
      </div>
    </div>
  )

  if (isAvailable) {
    const gamePath = `/games/${game.id}`
    return (
      <a
        href={gamePath}
        className="block no-underline card-enter"
        onClick={e => { e.preventDefault(); window.location.assign(gamePath) }}
      >
        {inner}
      </a>
    )
  }
  return <div className="card-enter">{inner}</div>
}

const NOTICES = [
  {
    id: 0,
    date: '2026.05.28',
    title: 'ポコっとライト 公開',
    body: '完全1人用パズルゲーム「ポコっとライト」を公開しました。全部のライトを点けてクリアを目指せ！',
  },
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

const BLOG_POSTS = [
  {
    href: '/blog/free-online-boardgames.html',
    tag: 'まとめ',
    color: '#ffd43b',
    title: '無料で遊べるオンラインボードゲームおすすめ5選',
    desc: 'ブラウザだけで今すぐ遊べる無料ゲームを厳選紹介。友達や家族と楽しめるゲームを探している方へ。',
    date: '2026.05.24',
  },
  {
    href: '/blog/bomb-online-free.html',
    tag: 'ブラフ・遊び方',
    color: '#f87171',
    title: 'BOMBのルールと遊び方｜エモートで相手を揺さぶれ',
    desc: '爆弾かりんごか——ブラフをかます心理戦ゲーム「BOMB」のルールとエモート活用法を解説。',
    date: '2026.05.27',
  },
  {
    href: '/blog/bluff-game-tips.html',
    tag: 'コツ・戦略',
    color: '#ef4444',
    title: 'ブラフゲームで勝つ5つのコツ｜心理戦の基本',
    desc: 'BOMBや謀略に共通する勝ち方のコツ。読まれない方法、ブラフの頻度、告発のタイミングを解説。',
    date: '2026.06.02',
  },
  {
    href: '/blog/poko-light-strategy.html',
    tag: 'パズル・攻略',
    color: '#fde68a',
    title: 'ポコっとライト攻略ガイド｜全点灯を狙う基本戦術',
    desc: 'タップで周囲が切り替わるパズルの攻略法。追いかけ法の基本とパターン別戦術を総合解説。',
    date: '2026.06.02',
  },
]

function BlogSection() {
  return (
    <section className="px-4 pb-10 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <span className="font-cinzel text-[9px] font-bold tracking-[0.28em] uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>
          ✦ Blog ✦
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <p className="font-serif-jp text-center text-[15px] font-bold text-white mb-1">
        ルール・遊び方解説ブログ
      </p>
      <p className="font-sans-jp text-center text-[11px] mb-5" style={{ color: 'rgba(255,255,255,0.42)' }}>
        各ゲームのルール・攻略・コツをくわしく紹介
      </p>
      <div className="flex flex-col gap-3">
        {BLOG_POSTS.map(post => (
          <a
            key={post.href}
            href={post.href}
            className="block no-underline"
            style={{
              background: 'linear-gradient(135deg, #1e2248 0%, #181b38 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px',
              padding: '16px 18px',
            }}
          >
            <span className="font-cinzel text-[9px] font-bold tracking-[0.2em] uppercase block mb-1.5" style={{ color: post.color }}>
              {post.tag}
            </span>
            <p className="font-serif-jp text-[14px] font-bold text-white leading-snug mb-1.5">{post.title}</p>
            <p className="font-sans-jp text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {post.desc}
            </p>
            <p className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{post.date}</p>
          </a>
        ))}
      </div>
      <a
        href="/blog/"
        className="block no-underline text-center mt-5 font-sans-jp text-[12px] font-bold py-3 rounded-full"
        style={{
          background: 'rgba(255,212,59,0.12)',
          border: '1.5px solid rgba(255,212,59,0.4)',
          color: '#ffd43b',
        }}
      >
        ブログの記事をすべて見る →
      </a>
    </section>
  )
}

function NoticeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.55)',
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
          background: 'linear-gradient(180deg, #1e2248 0%, #181b38 100%)',
          borderLeft: '2px solid rgba(255,255,255,0.08)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="font-serif-jp font-bold text-[15px] text-white">🔔 お知らせ</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full font-bold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {NOTICES.map(n => (
            <div
              key={n.id}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="font-cinzel text-[9px] font-bold tracking-widest mb-1" style={{ color: '#ffd43b' }}>
                {n.date}
              </p>
              <p className="font-serif-jp font-bold text-[13px] text-white mb-1.5">{n.title}</p>
              <p className="font-sans-jp text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.52)' }}>
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
      <div
        className="fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 left-0 h-full z-40 flex flex-col"
        style={{
          width: '72vw',
          maxWidth: '300px',
          background: 'linear-gradient(180deg, #1e2248 0%, #181b38 100%)',
          borderRight: '2px solid rgba(255,255,255,0.08)',
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
            <p className="font-cinzel text-[8px] font-bold tracking-[0.28em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
              ✦ Board Game Collection ✦
            </p>
            <p className="font-serif-jp font-bold text-[16px] text-white mt-0.5 tracking-[0.08em]">ボドゲ広場</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full font-bold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            ✕
          </button>
        </div>

        {/* Games section */}
        <div className="px-5 pt-5 pb-3">
          <p className="font-cinzel text-[8px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            🎮 Games
          </p>
          <div className="flex flex-col gap-1">
            {availableGames.map(g => (
              <button
                key={g.id}
                onClick={() => window.location.assign(`/games/${g.id}`)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-150 active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: g.accentColor }}
                />
                <span className="font-sans-jp text-[13px] text-white/80">{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mx-5 my-2" style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

        {/* Info section */}
        <div className="px-5 pt-3">
          <p className="font-cinzel text-[8px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            📋 Info
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
                className="font-sans-jp text-left px-3 py-2.5 rounded-2xl text-[13px] transition-all duration-150 active:scale-[0.98] block"
                style={{ color: 'rgba(255,255,255,0.52)', background: 'rgba(255,255,255,0.04)' }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

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

  const gamesMatch = path.match(/^\/games\/(.+)$/)
  if (gamesMatch) return <GameEmbed gameId={gamesMatch[1]} />

  useCanonical('/')
  const [genre, setGenre] = useState<Genre>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const available = games.filter(g => g.status === 'available' && matchGenre(g, genre))
  const comingSoon = games.filter(g => g.status === 'coming-soon')

  return (
    <div
      className="min-h-screen"
      style={{ background: 'radial-gradient(ellipse at top, #1e2244 0%, #1a1c30 55%, #161824 100%)' }}
    >
      <SafeRender>
        <UpdatePrompt />
      </SafeRender>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <NoticeDrawer open={noticeOpen} onClose={() => setNoticeOpen(false)} />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(26, 28, 48, 0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '2px solid rgba(255,255,255,0.07)',
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
            className="font-cinzel text-[8px] font-bold tracking-[0.28em] uppercase"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            ✦ BOARD GAME COLLECTION ✦
          </p>
          <h1
            className="font-serif-jp font-bold text-[15px] text-white tracking-[0.1em]"
          >
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

      {/* ── Hero ── */}
      <section className="relative px-5 pt-10 pb-8 overflow-hidden">
        {/* decorative background elements */}
        <div
          className="absolute right-[-4px] top-[-4px] text-[105px] select-none pointer-events-none leading-none"
          style={{ opacity: 0.12 }}
        >
          🃏
        </div>
        <div
          className="absolute left-[-10px] top-8 text-[85px] select-none pointer-events-none leading-none float-deco"
          style={{ opacity: 0.1 }}
        >
          🎲
        </div>

        {/* sparkle decorations */}
        <span className="absolute right-16 top-4 text-[16px] select-none pointer-events-none sparkle-1">⭐</span>
        <span className="absolute right-8 top-14 text-[12px] select-none pointer-events-none sparkle-2">✨</span>
        <span className="absolute left-16 top-3 text-[13px] select-none pointer-events-none sparkle-3">⭐</span>

        <p
          className="font-sans-jp text-xs mb-1.5 relative z-10"
          style={{ color: 'rgba(255,255,255,0.52)' }}
        >
          ブラウザで遊べる
        </p>

        <div className="relative z-10">
          <h2
            className="font-serif-jp font-bold text-[38px] leading-tight tracking-[0.06em] text-white"
          >
            ボドゲ広場
          </h2>
          {/* wave + sparkle decoration below title */}
          <div className="flex items-center gap-2 mt-1 mb-3">
            <span style={{ color: '#ffd43b', fontSize: '13px' }}>✦</span>
            <svg width="80" height="8" viewBox="0 0 80 8" fill="none">
              <path
                d="M0 4Q10 0 20 4Q30 8 40 4Q50 0 60 4Q70 8 80 4"
                stroke="#ffd43b"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
            <span style={{ color: '#ffd43b', fontSize: '13px' }}>✦</span>
            <svg width="80" height="8" viewBox="0 0 80 8" fill="none">
              <path
                d="M0 4Q10 0 20 4Q30 8 40 4Q50 0 60 4Q70 8 80 4"
                stroke="#ffd43b"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
            <span style={{ color: '#ffd43b', fontSize: '13px' }}>✦</span>
          </div>
        </div>

        <p
          className="font-sans-jp text-[12px] leading-relaxed relative z-10"
          style={{ color: 'rgba(255,255,255,0.52)' }}
        >
          友達と、家族と、見知らぬ誰かと。<br />
          オンラインでつながるボードゲームの世界。
        </p>
      </section>

      {/* decorative separator */}
      <div className="flex items-center gap-3 mx-5 mb-5">
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <span className="font-cinzel text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.22)' }}>
          ✦ Games ✦
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

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
                このジャンルのゲームは準備中です 🎲
              </p>
            )
          }
        </div>

        {genre === 'all' && comingSoon.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span
                className="font-cinzel text-[9px] font-bold tracking-[0.28em] uppercase"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                ✦ Coming Soon ✦
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <p
              className="font-sans-jp text-center text-[11px] mb-4"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              新しいゲームを続々追加予定 🎉
            </p>
            <div className="flex flex-col gap-3">
              {comingSoon.map(game => (
                <GameRow key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Blog */}
      <BlogSection />

      {/* Footer */}
      <footer
        className="px-5 py-8 text-center"
        style={{ borderTop: '2px solid rgba(255,255,255,0.06)' }}
      >
        <p className="font-serif-jp text-[14px] font-bold mb-1" style={{ color: '#ffd43b' }}>
          ボドゲ広場
        </p>
        <p className="font-cinzel text-[8px] tracking-[0.2em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          ✦ Board Game Collection ✦
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
              style={{ color: 'rgba(255,255,255,0.42)' }}
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
          © 2026 ボドゲ広場
        </p>
      </footer>
    </div>
  )
}
