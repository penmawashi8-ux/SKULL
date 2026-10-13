// 記事（public/blog/*.html）のフッターに、サイト共通のナビを差し込む。
//
// 記事は素のHTMLで、これまでフッターのリンクが6本しかなかった。
// ゲームページや一覧ページへ辿れないので、記事だけ読んでサイトを
// 離れる作りになっていた。Reactページ側の SiteFooter と同じ内容を
// ここで静的HTMLへ入れる。
//
// src/components/SiteFooter.tsx と対になっているので、
// 載せるリンクを変えるときは両方を直すこと。
//
// 既に差し込み済みのブロックは <!-- site-nav --> 〜 <!-- /site-nav -->
// で囲ってあり、毎回まるごと置き換えるので何度実行してもよい。

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const blogDir = resolve(root, 'public/blog')

const { GAME_LISTS } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)
const { games } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)

const ARTICLES = [
  ['/blog/daifugo-rules.html', '大富豪のルール完全ガイド'],
  ['/blog/sevens-rules.html', '7並べのルールと勝ち方'],
  ['/blog/babanuki-rules.html', 'ババ抜きのルールとコツ'],
  ['/blog/pageone-rules.html', 'ページワンのルール'],
  ['/blog/trump-games-guide.html', 'トランプゲームの選び方'],
  ['/blog/free-online-boardgames.html', '無料で遊べるボードゲーム'],
]

const INFO = [
  ['/blog/', 'ブログ'],
  ['/about', '企業情報'],
  ['/privacy-policy', 'プライバシーポリシー'],
  ['/terms', '利用規約'],
  ['/contact', 'お問い合わせ'],
]

const CSS = `
    .site-nav { max-width: 900px; margin: 0 auto 28px; display: flex; flex-wrap: wrap;
      gap: 24px 40px; text-align: left; }
    .site-nav-col { min-width: 140px; }
    .site-nav-col p { font-size: 11px; letter-spacing: 0.12em; color: rgba(255,255,255,0.32);
      font-weight: 700; margin-bottom: 8px; }
    .site-nav-col a { display: block; font-size: 12px; color: rgba(255,255,255,0.5);
      line-height: 1.9; white-space: nowrap; }
    .site-nav-col a:hover { color: rgba(255,255,255,0.8); }`

/** 現在のページ自身へのリンクは出さない（自己リンクは意味がないため）。 */
function column(title, links, self) {
  const items = links
    .filter(([href]) => href !== self)
    .map(([href, label]) => `        <a href="${href}">${label}</a>`)
    .join('\n')
  return `      <div class="site-nav-col">\n        <p>${title}</p>\n${items}\n      </div>`
}

function navHtml(self) {
  const playable = games.filter(g => g.status === 'available')
  return [
    '  <!-- site-nav -->',
    '  <nav class="site-nav">',
    column('収録ゲーム', playable.map(g => [`/games/${g.id}`, g.name]), self),
    column(
      'ゲームを探す',
      [['/list/', '収録ゲーム一覧'], ...GAME_LISTS.map(l => [`/list/${l.slug}`, l.label])],
      self,
    ),
    column('ルール・攻略', ARTICLES, self),
    column('サイト情報', INFO, self),
    '  </nav>',
    '  <!-- /site-nav -->',
  ].join('\n')
}

let changed = 0
for (const name of readdirSync(blogDir).sort()) {
  if (!name.endsWith('.html')) continue
  const file = resolve(blogDir, name)
  let html = readFileSync(file, 'utf8')
  const self = name === 'index.html' ? '/blog/' : `/blog/${name}`

  // 既存ブロックがあれば剥がしてから入れ直す
  html = html.replace(/\n? *<!-- site-nav -->[\s\S]*?<!-- \/site-nav -->\n?/, '\n')

  if (!html.includes('.site-nav {')) {
    const before = html
    html = html.replace(/(\n *)(<\/style>)/, `${CSS}$1$2`)
    if (html === before) {
      console.warn(`blog-nav: ${name} に <style> が無いのでCSSを入れられない`)
      continue
    }
  }

  const withNav = html.replace(
    /(\n( *)<footer>\n)/,
    (_m, _all, indent) => `\n${navHtml(self).replace(/^ {2}/gm, indent)}\n${_all.slice(1)}`,
  )
  if (withNav === html) {
    console.warn(`blog-nav: ${name} に <footer> が見つからない`)
    continue
  }
  writeFileSync(file, withNav)
  changed++
}
console.log(`blog-nav: 記事 ${changed} 件にサイト共通ナビを差し込み`)
