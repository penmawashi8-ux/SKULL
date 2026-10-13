// 「ひとりで遊べる」「オンライン対戦」などの軸でゲームを並べた一覧ページ。
// slug を省略すると収録ゲーム全部の一覧になる。

import { useEffect } from 'react'
import SiteFooter from '../components/SiteFooter'
import { useCanonical } from '../useCanonical'
import { games, type Game } from '../games'
import { GAME_LISTS, findList, gamesInList } from '../gameLists'

const ALL_TITLE = '収録ゲーム一覧｜無料で遊べるボードゲーム全14種 - ボドゲ広場'
const ALL_DESCRIPTION =
  'ボドゲ広場で遊べる無料オンラインボードゲームの全一覧。大富豪・7並べ・ババ抜きなどのトランプゲームから、ブラフ・パズル・すごろくまで。登録不要・インストール不要でブラウザからすぐ遊べます。'
const ALL_LEAD =
  'ボドゲ広場で遊べるゲームの全一覧です。どれもアカウント登録もアプリのインストールも要らず、ページを開いた時点ですぐ始められます。ひとりでCPUと遊ぶこともできますし、招待URLを送れば離れた友達とそのまま対戦できるゲームもあります。遊ぶ人数や気分から探したいときは、下の「別の探し方」から辿ってください。'

function setTitle(title: string) {
  document.title = title
}

function setMeta(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = name
    document.head.appendChild(tag)
  }
  tag.content = content
}

function GameRow({ game }: { game: Game }) {
  return (
    <a
      href={`/games/${game.id}`}
      style={{
        display: 'block',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        padding: '16px 18px',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: game.accentColor }}>
          {game.name}
        </span>
        <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
          {game.nameEn}
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
        {game.description}
      </p>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '8px' }}>
        プレイ人数 {game.players} ／ 目安 {game.duration}
      </p>
    </a>
  )
}

export default function GameList({ slug }: { slug?: string }) {
  const list = slug ? findList(slug) : undefined
  const missing = Boolean(slug) && !list

  const path = list ? `/list/${list.slug}` : '/list/'
  const title = list ? list.title : ALL_TITLE
  const description = list ? list.description : ALL_DESCRIPTION
  const lead = list ? list.lead : ALL_LEAD
  const heading = list ? list.heading + '一覧' : '収録ゲーム一覧'
  const shown = list ? gamesInList(list) : games.filter(g => g.status === 'available')

  useCanonical(path)
  useEffect(() => {
    if (missing) return
    setTitle(title)
    setMeta('description', description)
  }, [missing, title, description])

  if (missing) {
    window.location.assign('/list/')
    return null
  }

  return (
    <div
      style={{
        background: 'radial-gradient(ellipse at top, #1e2244 0%, #1a1c30 55%, #161824 100%)',
        minHeight: '100dvh',
        color: '#fff',
      }}
    >
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
          style={{
            color: 'rgba(255,255,255,0.6)',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '5px 12px',
            fontSize: '12px',
            textDecoration: 'none',
          }}
        >
          ← トップ
        </a>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '14px', flex: 1 }}>
          {heading}
        </span>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px 48px' }}>
        <nav style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            ボドゲ広場
          </a>
          {' ＞ '}
          {list ? (
            <>
              <a href="/list/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
                収録ゲーム一覧
              </a>
              {' ＞ ' + list.label}
            </>
          ) : (
            '収録ゲーム一覧'
          )}
        </nav>

        <h1 style={{ fontSize: '23px', fontWeight: 900, lineHeight: 1.4, marginBottom: '14px' }}>
          {heading}
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.9,
            background: 'rgba(255,255,255,0.04)',
            borderLeft: '3px solid #ffd43b',
            borderRadius: '0 8px 8px 0',
            padding: '14px 16px',
            marginBottom: '20px',
          }}
        >
          {lead}
        </p>

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '14px' }}>
          このページのゲーム：{shown.length}種
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {shown.map(g => (
            <GameRow key={g.id} game={g} />
          ))}
        </div>

        <section style={{ marginTop: '40px', paddingTop: '26px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>別の探し方</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {!list && null}
            {[{ slug: '', label: '収録ゲーム一覧' }, ...GAME_LISTS]
              .filter(l => l.slug !== (list?.slug ?? ''))
              .map(l => (
                <a
                  key={l.slug || 'all'}
                  href={`/list/${l.slug}`}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.75)',
                    textDecoration: 'none',
                  }}
                >
                  {l.label}
                </a>
              ))}
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  )
}
