import { useEffect } from 'react'
import { useCanonical } from '../useCanonical'

const GAME_EMBED: Record<string, { name: string; url: string }> = {
  'bomb':         { name: 'BOMB',         url: 'https://bomb.boardgamecat.com' },
  'pig-tail':     { name: 'ぶたのしっぽ',   url: 'https://buta.boardgamecat.com' },
  'keiba':        { name: 'バーチャル競馬', url: 'https://gamekeiba.boardgamecat.com' },
  'page-one':     { name: 'ページワン',     url: 'https://pageone.boardgamecat.com' },
  'coup':         { name: '謀略',          url: 'https://bouryaku.boardgamecat.com' },
  'racing-board': { name: '疾走',          url: 'https://g-oei1.vercel.app' },
  'g-board-app':  { name: 'MECH SIEGE',   url: 'https://g.boardgamecat.com' },
  'poko-light':   { name: 'ポコっとライト', url: 'https://poko.boardgamecat.com' },
}

export default function GameEmbed({ gameId }: { gameId: string }) {
  const game = GAME_EMBED[gameId]
  useCanonical(`/games/${gameId}`)

  useEffect(() => {
    if (game) document.title = `${game.name} | ボドゲ広場`
  }, [game])

  if (!game) {
    window.location.assign('/')
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#1a1c30' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: 'rgba(26,28,48,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => window.location.assign('/')}
          style={{
            color: 'rgba(255,255,255,0.6)',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          ← 戻る
        </button>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '15px', flex: 1 }}>
          {game.name}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
          ボドゲ広場
        </span>
      </header>
      <iframe
        src={game.url}
        title={game.name}
        style={{ flex: 1, border: 'none', width: '100%' }}
        allow="fullscreen"
      />
    </div>
  )
}
