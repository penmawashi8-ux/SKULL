// 記事（public/blog/*.html）に BreadcrumbList の構造化データを足す。
//
// 記事には Article しか入っていなかったため、検索結果に
// 「ボドゲ広場 › ブログ › 記事名」のパンくずが出ていなかった。
// ゲームページ（GameEmbed）や一覧ページには既に入れてあるので、
// 素のHTMLである記事側にもここで揃える。
//
// 既存の <script type="application/ld+json"> はそのまま残し、
// パンくず用のブロックを別に追加する（Googleは複数ブロックを読む）。
// <!-- breadcrumb-jsonld --> 〜 で囲ってあり、何度実行してもよい。

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const blogDir = resolve(root, 'public/blog')
const ORIGIN = 'https://boardgamecat.com'

/**
 * 記事名を取る。
 * <h1> は見た目のために2行に分けてあり、タグを落とすと
 * 「大富豪のルール完全ガイド基本ルールと…」のように繋がってしまうので、
 * 記事が既に持っている Article の headline を優先して使う。
 */
function headline(html) {
  for (const blob of html.matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(blob[1])
      if (data['@type'] === 'Article' && data.headline) return data.headline
    } catch {
      // 壊れたJSON-LDはここでは直さない。次のブロックを見る。
    }
  }
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

let changed = 0
let skipped = []
for (const name of readdirSync(blogDir).sort()) {
  if (!name.endsWith('.html') || name === 'index.html') continue
  const file = resolve(blogDir, name)
  let html = readFileSync(file, 'utf8')

  // 入れ直せるように既存ブロックを剥がす
  html = html.replace(/\n? *<!-- breadcrumb-jsonld -->[\s\S]*?<!-- \/breadcrumb-jsonld -->\n?/, '\n')

  const title = headline(html)
  if (!title) { skipped.push(`${name}（h1が無い）`); continue }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ボドゲ広場', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'ブログ', item: `${ORIGIN}/blog/` },
      { '@type': 'ListItem', position: 3, name: title, item: `${ORIGIN}/blog/${name}` },
    ],
  }
  const block =
    '  <!-- breadcrumb-jsonld -->\n' +
    `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n` +
    '  <!-- /breadcrumb-jsonld -->\n'

  const out = html.replace(/(\n)(<\/head>)/, `\n${block}$2`)
  if (out === html) { skipped.push(`${name}（</head>が見つからない）`); continue }
  writeFileSync(file, out)
  changed++
}

console.log(`blog-breadcrumb: 記事 ${changed} 件に BreadcrumbList を追加`)
if (skipped.length) console.warn('  処理しなかったもの:', skipped.join(', '))
