import { useEffect, useState } from 'react'
import { useCanonical } from '../useCanonical'
import { GAME_CONTENT } from '../gameContent'

function setMeta(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = name
    document.head.appendChild(tag)
  }
  tag.content = content
}

const INFO_LINKS = [
  { label: 'ブログ', path: '/blog/' },
  { label: '企業情報', path: '/about' },
  { label: 'プライバシーポリシー', path: '/privacy-policy' },
  { label: '利用規約', path: '/terms' },
  { label: 'お問い合わせ', path: '/contact' },
]

export default function GameEmbed({ gameId }: { gameId: string }) {
  const game = GAME_CONTENT[gameId]
  useCanonical(`/games/${gameId}`)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!game) return
    document.title = `${game.name}の遊び方・ルール｜ブラウザで無料プレイ | ボドゲ広場`
    setMeta(
      'description',
      `${game.name}（${game.nameEn}）の遊び方・ルールを解説。${game.tagline}。登録不要・無料でブラウザからすぐ遊べます。`,
    )
  }, [game])

  // プレイ中は背面のスクロールを止める
  useEffect(() => {
    if (!playing) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [playing])

  if (!game) {
    window.location.assign('/')
    return null
  }

  const accent = game.accent

  // ── プレイ中：全画面オーバーレイ（動作実績のあるフルスクリーンiframe構成） ──
  if (playing) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', height: '100dvh', background: '#1a1c30' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: 'calc(env(safe-area-inset-top) + 8px) 14px 8px',
            background: 'rgba(26,28,48,0.96)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {game.name}
          </span>
          <button
            onClick={() => setPlaying(false)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '999px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ 終了
          </button>
        </header>
        <iframe
          src={game.url}
          title={`${game.name}をプレイ`}
          style={{ flex: 1, width: '100%', border: 'none' }}
          allow="fullscreen"
        />
      </div>
    )
  }

  // ── 通常：解説付きランディングページ ──
  const PlayButton = ({ marginTop }: { marginTop: number }) => (
    <button
      onClick={() => setPlaying(true)}
      style={{
        display: 'block',
        width: '100%',
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        color: '#1a1c30',
        textAlign: 'center',
        padding: '18px 24px',
        borderRadius: '999px',
        fontWeight: 700,
        fontSize: '16px',
        marginTop: `${marginTop}px`,
        border: 'none',
        cursor: 'pointer',
        boxShadow: `0 6px 20px ${accent}66`,
      }}
    >
      ▶ 今すぐ{game.name}を遊ぶ
    </button>
  )

  return (
    <div style={{ background: 'radial-gradient(ellipse at top, #1e2244 0%, #1a1c30 55%, #161824 100%)', minHeight: '100dvh', color: '#fff' }}>
      {/* ── Header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          background: 'rgba(26,28,48,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <a
          href="/"
          onClick={e => { e.preventDefault(); window.location.assign('/') }}
          style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', textDecoration: 'none' }}
        >
          ← 戻る
        </a>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '14px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {game.name}
        </span>
        <a href="/" onClick={e => { e.preventDefault(); window.location.assign('/') }} style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', textDecoration: 'none' }}>
          ボドゲ広場
        </a>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px 64px' }}>
        {/* ── Title block ── */}
        <div style={{ padding: '24px 4px 8px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, fontWeight: 700, marginBottom: '6px' }}>
            {game.nameEn}
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1.4, marginBottom: '8px' }}>
            {game.name}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
            {game.tagline}
          </p>
        </div>

        {/* ── Play button ── */}
        <PlayButton marginTop={16} />
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '10px' }}>
          登録不要・無料でそのまま遊べます
        </p>

        {/* ── Overview ── */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: '12px', marginBottom: '14px' }}>
            {game.name}とは？
          </h2>
          {game.intro.map((p, i) => (
            <p key={i} style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, marginBottom: '14px' }}>
              {p}
            </p>
          ))}

          {/* Info table */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '6px 18px', marginTop: '8px' }}>
            {game.info.map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── How to play ── */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: '12px', marginBottom: '16px' }}>
            遊び方
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {game.howTo.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 18px' }}>
                <span style={{ background: accent, color: '#1a1c30', fontSize: '13px', fontWeight: 700, width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  {i + 1}
                </span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{step.title}</p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: '12px', marginBottom: '16px' }}>
            このゲームの特徴
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {game.features.map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px 18px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: accent, marginBottom: '6px' }}>{f.title}</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Play button (bottom) ── */}
        <PlayButton marginTop={32} />

        {/* ── Related articles ── */}
        {game.related.length > 0 && (
          <section style={{ marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', marginBottom: '14px' }}>
              関連記事
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {game.related.map(a => (
                <a
                  key={a.href}
                  href={a.href}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.78)', textDecoration: 'none', lineHeight: 1.6 }}
                >
                  📖 {a.title}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '2px solid rgba(255,255,255,0.06)', padding: '32px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffd43b', marginBottom: '4px' }}>ボドゲ広場</p>
        <p style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '16px' }}>
          ✦ Board Game Collection ✦
        </p>
        <nav style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 20px', marginBottom: '14px' }}>
          {INFO_LINKS.map(({ label, path }) => (
            <a
              key={path}
              href={path}
              onClick={e => { e.preventDefault(); window.location.assign(path) }}
              style={{ fontSize: '11px', color: 'rgba(255,255,255,0.42)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              {label}
            </a>
          ))}
        </nav>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)' }}>© 2026 ボドゲ広場</p>
      </footer>
    </div>
  )
}
