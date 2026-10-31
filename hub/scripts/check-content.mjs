// ページの中で同じことを言い直していないかを、ビルドのたびに確かめる。
//
// AdSenseの不合格理由が2回続けて「有用性の低いコンテンツ」だったとき、
// 本文を調べたらゲームページ14枚中13枚で同じ事実を言い回しだけ変えて
// 繰り返していた（36組）。文字数は稼げても、上から読むと同じ話が
// 3〜4回出てくるので水増しに見える。
//
// 直したあと同じことが起きないように、ここで止める。
// 原因はたいてい「コツ」と「つまずくポイント」に同じネタを書くこと。
// 引っかかったら、片方を別の話に差し替えること（消すだけでも可）。
//
// 記事（public/blog）は止めない。手順書のように構造が似ているのが
// 正しい文章があり、機械的に判定できないため、数を出すだけにする。

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 2-gramの一致率がこれ以上なら「言い直し」とみなす。
// 言い回しを変えていても拾えるが、別のゲームの似た説明までは拾わない値。
const THRESHOLD = 0.45
const MIN_LENGTH = 20

function toText(html) {
  return html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')          // Reactの区切りで語が割れないよう先に消す
    .replace(/<[^>]+>/g, '\n')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t ]+/g, ' ')
}

function sentences(text) {
  const out = []
  for (const line of text.split('\n')) {
    for (const part of line.split(/(?<=[。！？])/)) {
      const t = part.trim()
      if (t.length >= MIN_LENGTH) out.push(t)
    }
  }
  return out
}

function bigrams(s) {
  const t = s.replace(/[、。！？「」（）\s]/g, '')
  const set = new Set()
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
  return set
}

function similarity(a, b) {
  const x = bigrams(a), y = bigrams(b)
  if (!x.size || !y.size) return 0
  let shared = 0
  for (const g of x) if (y.has(g)) shared++
  return shared / (x.size + y.size - shared)
}

function findRepeats(html) {
  const ss = sentences(toText(html))
  const pairs = []
  for (let i = 0; i < ss.length; i++) {
    for (let j = i + 1; j < ss.length; j++) {
      const v = similarity(ss[i], ss[j])
      if (v >= THRESHOLD) pairs.push({ v, a: ss[i], b: ss[j] })
    }
  }
  return pairs
}

const gamesDir = resolve(root, 'dist/games')
if (!existsSync(gamesDir)) {
  console.log('check-content: dist/games が無いので省略')
  process.exit(0)
}

const problems = []
for (const file of readdirSync(gamesDir).filter(f => f.endsWith('.html'))) {
  const pairs = findRepeats(readFileSync(resolve(gamesDir, file), 'utf8'))
  if (pairs.length) problems.push({ file, pairs })
}

if (problems.length) {
  console.error('\ncheck-content: ゲームページで同じことを言い直しています。\n')
  for (const { file, pairs } of problems) {
    console.error(`  ${file}（${pairs.length}組）`)
    for (const { v, a, b } of pairs.sort((x, y) => y.v - x.v).slice(0, 3)) {
      console.error(`    [${v.toFixed(2)}] ${a.slice(0, 64)}`)
      console.error(`           ${b.slice(0, 64)}`)
    }
  }
  console.error('\n  src/gameContent.ts で、どちらかを別の話に差し替えてください。')
  console.error('  「コツ」と「つまずくポイント」が同じネタになっていないか確認を。\n')
  process.exit(1)
}

const total = readdirSync(gamesDir).filter(f => f.endsWith('.html')).length
console.log(`check-content: ゲームページ${total}枚に言い直しなし`)

// 記事は参考値として出すだけ（止めない）
const blogDir = resolve(root, 'public/blog')
if (existsSync(blogDir)) {
  let files = 0, pairs = 0
  for (const f of readdirSync(blogDir).filter(f => f.endsWith('.html'))) {
    // 本文（<p>）だけを見る。見出しと目次が同じ文字列になるのは構造上そうなるだけ
    const src = readFileSync(resolve(blogDir, f), 'utf8')
    const paras = [...src.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => toText(m[1]))
    const n = findRepeats(paras.join('\n')).length
    if (n) { files++; pairs += n }
  }
  console.log(`check-content: 記事 ${files}本に ${pairs}組（手順書など構造が似て当然のものを含む。参考値）`)
}
