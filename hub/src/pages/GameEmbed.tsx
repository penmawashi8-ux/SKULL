import { useEffect, useState, useCallback } from 'react'
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

  const [visible, setVisible] = useState(true)

  const show = useCallback(() => {
    setVisible(true)
  }, [])

  useEffect(() => {
    if (game) document.title = `${game.name} | ボドゲ広場`
  }, [game])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(t)
  }, [visible])

  if (!game) {
    window.location.assign('/')
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#1a1c30' }}>
      {/* タップ感知エリア（ヘッダー非表示中も上部をタップで再表示） */}
      {!visible && (
        <div
          onClick={show}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '32px', zIndex: 50 }}
        />
      )}

      <header
        onClick={show}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          background: 'rgba(26,28,48,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.4s ease',
        }}
      >
        <button
          onClick={e => { e.stopPropagation(); window.location.assign('/') }}
          style={{
            color: 'rgba(255,255,255,0.6)',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ← 戻る
        </button>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '13px', flex: 1 }}>
          {game.name}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
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
