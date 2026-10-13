// 全ページ共通のフッターナビ。
//
// これまでゲームページ・記事ページから辿れる内部リンクが14本しかなく、
// サイトのどこに何があるかがページ単体からは分からなかった。
// 収録ゲーム全部・探し方の一覧・主な記事・サイト情報をここにまとめて、
// どのページからでもサイト全体へ入れるようにする。
//
// 記事（public/blog/*.html）は素のHTMLなので、同じ内容を
// scripts/blog-nav.mjs が静的HTML側へ差し込んでいる。
// 片方だけ直すとズレるので、変更時は両方を更新すること。

import { games } from '../games'
import { GAME_LISTS } from '../gameLists'

/** フッターに載せる主な記事。全記事はブログ一覧から辿れる。 */
const FOOTER_ARTICLES = [
  { href: '/blog/daifugo-rules.html', label: '大富豪のルール完全ガイド' },
  { href: '/blog/sevens-rules.html', label: '7並べのルールと勝ち方' },
  { href: '/blog/babanuki-rules.html', label: 'ババ抜きのルールとコツ' },
  { href: '/blog/pageone-rules.html', label: 'ページワンのルール' },
  { href: '/blog/trump-games-guide.html', label: 'トランプゲームの選び方' },
  { href: '/blog/free-online-boardgames.html', label: '無料で遊べるボードゲーム' },
]

const INFO_LINKS = [
  { href: '/blog/', label: 'ブログ' },
  { href: '/about', label: '企業情報' },
  { href: '/privacy-policy', label: 'プライバシーポリシー' },
  { href: '/terms', label: '利用規約' },
  { href: '/contact', label: 'お問い合わせ' },
]

const linkStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.5)',
  textDecoration: 'none',
  lineHeight: 1.9,
  whiteSpace: 'nowrap',
}

const headingStyle: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.12em',
  color: 'rgba(255,255,255,0.32)',
  fontWeight: 700,
  marginBottom: '8px',
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: '140px' }}>
      <p style={headingStyle}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {children}
      </div>
    </div>
  )
}

export default function SiteFooter() {
  const playable = games.filter(g => g.status === 'available')

  return (
    <footer
      style={{
        borderTop: '2px solid rgba(255,255,255,0.06)',
        padding: '36px 20px 28px',
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '28px 40px',
          justifyContent: 'flex-start',
          textAlign: 'left',
        }}
      >
        <Column title="収録ゲーム">
          {playable.map(g => (
            <a key={g.id} href={`/games/${g.id}`} style={linkStyle}>
              {g.name}
            </a>
          ))}
        </Column>

        <Column title="ゲームを探す">
          <a href="/list/" style={linkStyle}>収録ゲーム一覧</a>
          {GAME_LISTS.map(l => (
            <a key={l.slug} href={`/list/${l.slug}`} style={linkStyle}>
              {l.label}
            </a>
          ))}
        </Column>

        <Column title="ルール・攻略">
          {FOOTER_ARTICLES.map(a => (
            <a key={a.href} href={a.href} style={linkStyle}>
              {a.label}
            </a>
          ))}
        </Column>

        <Column title="サイト情報">
          {INFO_LINKS.map(l => (
            <a key={l.href} href={l.href} style={linkStyle}>
              {l.label}
            </a>
          ))}
        </Column>
      </div>

      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <a
          href="/"
          style={{ fontSize: '14px', fontWeight: 700, color: '#ffd43b', textDecoration: 'none' }}
        >
          ボドゲ広場
        </a>
        <p
          style={{
            fontSize: '8px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
            margin: '4px 0 10px',
          }}
        >
          ✦ Board Game Collection ✦
        </p>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)' }}>© 2026 ボドゲ広場</p>
      </div>
    </footer>
  )
}
