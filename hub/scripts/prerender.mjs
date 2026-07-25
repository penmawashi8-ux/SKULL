// ビルド後に全ルートを静的HTMLへプリレンダリングするスクリプト。
// AdSense等のクローラーがJSを実行しなくても本文が見えるようにするのが目的。
//
// 実行順: vite build（クライアント）→ vite build --ssr（dist-ssr）→ 本スクリプト
// 出力:
//   dist/index.html                … トップページ（本文注入済みで上書き）
//   dist/games/<id>.html           … 各ゲームページ
//   dist/about.html ほか静的ページ  … vercel.json の rewrites で拡張子なしURLに対応
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const { render, GAME_CONTENT, COMMON_FAQ } = await import(
  new URL('../dist-ssr/entry-server.js', import.meta.url).href
)

// ベータ版で内容が薄いページは検索エンジンにインデックスさせない。
// GameEmbed.tsx の NOINDEX_GAMES と同期させること。
const NOINDEX_GAMES = new Set(['racing-board', 'g-board-app'])

const ORIGIN = 'https://boardgamecat.com'
const template = readFileSync(resolve(dist, 'index.html'), 'utf8')

function escapeAttr(s) {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function replaceOrThrow(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`prerender: ${label} が index.html に見つかりません`)
  return html.replace(pattern, replacement)
}

function buildPage({ path, title, description, jsonLd, noindex = false }) {
  const body = render(path)
  const url = `${ORIGIN}${path}`
  let out = template

  out = replaceOrThrow(out, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, '<title>')
  out = replaceOrThrow(
    out,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(description)}" />` +
      (noindex ? '\n    <meta name="robots" content="noindex, follow" />' : ''),
    'meta description',
  )
  out = replaceOrThrow(
    out,
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}" />`,
    'canonical',
  )
  out = replaceOrThrow(
    out,
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${url}" />`,
    'og:url',
  )
  out = replaceOrThrow(
    out,
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    'og:title',
  )
  out = replaceOrThrow(
    out,
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    'og:description',
  )
  out = replaceOrThrow(
    out,
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    'twitter:title',
  )
  out = replaceOrThrow(
    out,
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    'twitter:description',
  )
  // トップページ用のJSON-LDをルート固有のものに差し替え
  out = replaceOrThrow(
    out,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    'JSON-LD',
  )
  // 本文が静的HTMLとして入るためnoscriptフォールバックは不要
  out = out.replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '')
  out = replaceOrThrow(
    out,
    /<div id="root"><\/div>/,
    `<div id="root">${body}</div>`,
    '<div id="root">',
  )
  return out
}

// ── トップページ: head はテンプレートのまま、本文だけ注入 ──
{
  const body = render('/')
  let out = template.replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '')
  out = replaceOrThrow(out, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, '<div id="root">')
  writeFileSync(resolve(dist, 'index.html'), out)
  console.log('prerender: / -> dist/index.html')
}

// ── 各ゲームページ ──
mkdirSync(resolve(dist, 'games'), { recursive: true })
for (const [id, game] of Object.entries(GAME_CONTENT)) {
  const path = `/games/${id}`
  const players = game.info.find(i => i.label === 'プレイ人数')?.value ?? ''
  const genre = game.info.find(i => i.label === 'ジャンル')?.value ?? ''
  const title = `${game.name}を無料でオンラインプレイ｜遊び方・ルール解説 - ボドゲ広場`
  const description = `${game.name}（${game.nameEn}）はブラウザで無料で遊べるオンラインゲーム（${genre}）。${game.tagline}。プレイ人数${players}。登録不要・インストール不要でスマホからもすぐ遊べます。遊び方・ルールも解説。`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Game',
        name: game.name,
        alternateName: game.nameEn,
        description: `${game.tagline}。ブラウザで無料で遊べるオンラインゲーム。`,
        url: `${ORIGIN}${path}`,
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
          { '@type': 'ListItem', position: 1, name: 'ボドゲ広場', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: game.name, item: `${ORIGIN}${path}` },
        ],
      },
    ],
  }
  writeFileSync(
    resolve(dist, `games/${id}.html`),
    buildPage({ path, title, description, jsonLd, noindex: NOINDEX_GAMES.has(id) }),
  )
  console.log(`prerender: ${path} -> dist/games/${id}.html`)
}

// ── 静的情報ページ ──
const INFO_PAGES = [
  {
    path: '/about',
    title: '企業情報・運営者情報 - ボドゲ広場',
    description:
      'ボドゲ広場の運営者情報。ブラウザで無料で遊べるオンラインボードゲームを提供する個人運営サイトです。サイト概要・運営方針・広告掲載についてご案内します。',
  },
  {
    path: '/privacy-policy',
    title: 'プライバシーポリシー - ボドゲ広場',
    description:
      'ボドゲ広場のプライバシーポリシー。Cookieの利用、Google AdSense・Googleアナリティクスによるデータ取得、個人情報の取り扱いについて説明します。',
  },
  {
    path: '/terms',
    title: '利用規約 - ボドゲ広場',
    description:
      'ボドゲ広場の利用規約。無料オンラインボードゲームをご利用いただく際の禁止事項・免責事項・知的財産権についてご案内します。',
  },
  {
    path: '/contact',
    title: 'お問い合わせ - ボドゲ広場',
    description:
      'ボドゲ広場へのお問い合わせページ。ゲームの不具合報告・ご質問・ご要望・広告掲載のご相談はお問い合わせフォームまたはメールでご連絡ください。',
  },
]
for (const page of INFO_PAGES) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: `${ORIGIN}${page.path}`,
    description: page.description,
    inLanguage: 'ja',
    isPartOf: { '@type': 'WebSite', name: 'ボドゲ広場', url: ORIGIN },
  }
  writeFileSync(resolve(dist, `${page.path.slice(1)}.html`), buildPage({ ...page, jsonLd }))
  console.log(`prerender: ${page.path} -> dist${page.path}.html`)
}

console.log('prerender: 完了')
