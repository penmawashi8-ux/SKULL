import { useEffect } from 'react'
import { useCanonical } from '../useCanonical'
import { COMMON_FAQ, GAME_CONTENT } from '../gameContent'

/** ベータ版で内容が薄いページは検索エンジンにインデックスさせない。 */
const NOINDEX_GAMES = new Set<string>()

function setMeta(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = name
    document.head.appendChild(tag)
  }
  tag.content = content
}

function setGameJsonLd(json: object) {
  let tag = document.querySelector<HTMLScriptElement>('script#game-jsonld')
  if (!tag) {
    tag = document.createElement('script')
    tag.id = 'game-jsonld'
    tag.type = 'application/ld+json'
    document.head.appendChild(tag)
  }
  tag.textContent = JSON.stringify(json)
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

  useEffect(() => {
    if (!game) return
    const players = game.info.find(i => i.label === 'プレイ人数')?.value ?? ''
    const genre = game.info.find(i => i.label === 'ジャンル')?.value ?? ''
    document.title = `${game.name}を無料でオンラインプレイ｜遊び方・ルール解説 - ボドゲ広場`
    setMeta(
      'description',
      `${game.name}（${game.nameEn}）はブラウザで無料で遊べるオンラインゲーム（${genre}）。${game.tagline}。プレイ人数${players}。登録不要・インストール不要でスマホからもすぐ遊べます。遊び方・ルールも解説。`,
    )
    if (NOINDEX_GAMES.has(gameId)) setMeta('robots', 'noindex, follow')
    setGameJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Game',
          name: game.name,
          alternateName: game.nameEn,
          description: `${game.tagline}。ブラウザで無料で遊べるオンラインゲーム。`,
          url: `https://boardgamecat.com/games/${gameId}`,
          gamePlatform: 'Webブラウザ',
          inLanguage: 'ja',
          isAccessibleForFree: true,
          genre: genre.split('・'),
        },
        {
          '@type': 'FAQPage',
          mainEntity: [...game.faq, ...COMMON_FAQ].map(item => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'ボドゲ広場', item: 'https://boardgamecat.com/' },
            { '@type': 'ListItem', position: 2, name: game.name, item: `https://boardgamecat.com/games/${gameId}` },
          ],
        },
      ],
    })
  }, [game, gameId])

  if (!game) {
    window.location.assign('/')
    return null
  }

  const accent = game.accent

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

      {/* ── Lead (記事としての導入。埋め込みより先に本文を見せる) ── */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px 4px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, fontWeight: 700, marginBottom: '6px' }}>
          {game.nameEn}
        </p>
        <h1 style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1.4, marginBottom: '10px' }}>
          {game.name}を無料でオンラインプレイ
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '14px' }}>
          {game.tagline}
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.85, background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${accent}`, borderRadius: '0 8px 8px 0', padding: '14px 16px' }}>
          {game.intro[0]}
        </p>
      </div>

      {/* ── Play area (embedded, playable immediately) ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '12px 12px 0' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: '14px',
            overflow: 'hidden',
            border: `1.5px solid ${accent}44`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
            background: '#0e0f1a',
          }}
        >
          <iframe
            src={game.url}
            title={`${game.name}をプレイ`}
            style={{ display: 'block', width: '100%', height: '68dvh', minHeight: '440px', border: 'none' }}
            allow="fullscreen"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px 0' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
            登録不要・無料でそのまま遊べます
          </p>
          <a
            href={game.url}
            target="_blank"
            rel="noopener"
            style={{ fontSize: '11px', color: accent, textDecoration: 'none', fontWeight: 700 }}
          >
            別タブで大きく開く ↗
          </a>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px 64px' }}>
        {/* ── Overview ── */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: '12px', marginBottom: '14px' }}>
            {game.name}とは？
          </h2>
          {game.intro.slice(1).map((p, i) => (
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

        {/* ── Tips ── */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: '12px', marginBottom: '8px' }}>
            {game.name}に勝つためのコツ
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, marginBottom: '16px' }}>
            ルールを覚えたら、次は勝ち方です。{game.name}で差がつくポイントをまとめました。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {game.tips.map((tip, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px 18px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                  <span style={{ color: accent, marginRight: '8px' }}>{i + 1}.</span>
                  {tip.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.85 }}>{tip.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: '12px', marginBottom: '16px' }}>
            {game.name}のよくある質問
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...game.faq, ...COMMON_FAQ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px 18px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.65, marginBottom: '8px' }}>
                  <span style={{ color: accent, marginRight: '6px' }}>Q.</span>
                  {item.q}
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.85 }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginRight: '6px' }}>A.</span>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

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
