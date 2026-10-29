// ゲームのアイコンを src/gameIcons.ts に焼き込む。
//
// 目的はリクエスト数を減らすこと。
// アイコンは public/icons/<id>.svg に置いてあり、App.tsx が実行時に
// パスを組み立てて <img src> に入れていた。そのため1ページ表示するたびに
// 14枚ぶんのリクエストが Vercel に飛んでいた。本番で測ったところ、
// ボドゲ広場へのリクエスト18件のうち14件がこれだった。
//
// CDNリクエストはキャッシュに当たった分も数えられるので、
// 「ブラウザがリクエストを出さない」形にしないと減らない。
// そこで中身をHTMLとバンドルに持たせる。
//
// インラインの <svg> ではなく data: URI にしてあるのは、
// SVGの中で id="bg" や id="g" のような短い名前が使われていて、
// 14枚を同じページに展開すると id がぶつかり、グラデーションや
// フィルターが他のアイコンのものを拾って絵が壊れるため。
// <img> なら1枚ずつ別の文書として描かれるのでぶつからない。
//
// 実行: npm run icons:build （public/icons/ を変更したら流し直すこと）

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 焼き込むのは games.ts に載っているゲームのぶんだけ。
// 使われていないアイコンまで入れるとバンドルが太る。
const gamesSrc = readFileSync(resolve(root, 'src/games.ts'), 'utf8')
const ids = [...gamesSrc.matchAll(/^\s{4}id: '([^']+)',$/gm)].map(m => m[1])
if (ids.length === 0) throw new Error('build-icons: games.ts から id を読み取れませんでした')

/** コメントと字下げを落とす。data: URI にすると記号が %XX に膨らむため、先に削る。 */
function shrink(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const entries = []
const missing = []
for (const id of ids) {
  const file = resolve(root, 'public/icons', `${id}.svg`)
  if (!existsSync(file)) {
    missing.push(id)
    continue
  }
  const uri = `data:image/svg+xml,${encodeURIComponent(shrink(readFileSync(file, 'utf8')))}`
  entries.push([id, uri])
}

const out = `// 自動生成。直接編集しないこと。
// 作り直す: npm run icons:build （元は public/icons/<id>.svg）
//
// アイコンを別ファイルとして取りに行くと、1ページ表示ごとに
// ${entries.length}件のリクエストが増える。中身をここに持たせてそれを無くしている。
// 詳しい経緯は scripts/build-icons.mjs の先頭に書いてある。

export const GAME_ICONS: Record<string, string> = {
${entries.map(([id, uri]) => `  ${JSON.stringify(id)}: ${JSON.stringify(uri)},`).join('\n')}
}
`

writeFileSync(resolve(root, 'src/gameIcons.ts'), out)

const bytes = entries.reduce((n, [, uri]) => n + uri.length, 0)
console.log(`icons: ${entries.length}枚を焼き込み（${(bytes / 1024).toFixed(1)}KB）`)
if (missing.length) console.log(`icons: 画像が無いゲーム: ${missing.join(', ')}（従来どおりURLで読み込む）`)
