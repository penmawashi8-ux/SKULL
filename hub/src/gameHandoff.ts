// 「別タブで大きく開く」を押したときに、iframe の中で遊んでいた続きから
// 始められるようにするための引き継ぎ。
//
// ゲーム本体は bomb.boardgamecat.com のように別のサブドメインにあり、
// このページとは別オリジンである。ブラウザによっては埋め込みの保存領域を
// 親サイトごとに切り分けるため、iframe の中で保存した識別子が
// 同じURLを直接開いたタブからは見えないことがある。
// （バーチャル競馬で、別タブを開くと名前の入力に戻り所持金も消えて見える、
//   という報告が実際に出た）
//
// そこで保存領域の共有に頼らず、iframe から教えてもらった内容を
// リンクのURLに載せて渡す。やりとりは次の2種類だけ。
//   こちら → iframe : { type: 'bodoge:whoami' }   「今だれ？どこ？」
//   iframe → こちら : { type: 'bodoge:session', sessionId, name, path }
//
// path は iframe が今開いているページ。オンライン対戦のあるゲームは
// iframe の中でルームへ移動しているので、これが無いと別タブはトップページに
// 戻ってしまい、せっかく識別子を渡してもルームに入り直せない。
//
// ゲーム側が未対応なら何も返ってこないので、リンクは今までどおりになる。

/** iframe に「今だれ？」と聞くときの合図。ゲーム側と揃えること。 */
const ASK = 'bodoge:whoami'
/** iframe が答えてくるときの合図。 */
const TELL = 'bodoge:session'

export type Handoff = { sessionId: string; name: string; path: string }

/**
 * ゲームのURLのオリジン。相対URL（同一オリジンの /play/ 配下）なら null。
 * プリレンダリング（Node上でのSSR）では window が無いので null を返す。
 * 返すのは受け取りの仕掛けに使う値だけで、描画される内容は変わらない。
 */
export function externalOrigin(url: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const origin = new URL(url, window.location.href).origin
    return origin === window.location.origin ? null : origin
  } catch {
    return null
  }
}

type Told = { type?: unknown; sessionId?: unknown; name?: unknown; path?: unknown }

function isTell(data: unknown): data is Told {
  return !!data && typeof data === 'object' && (data as Told).type === TELL
}

/**
 * 申告された移動先を受け取ってよいか。
 * 「/」で始まり「//」で始まらない相対パスだけ通す。
 * これを確かめないと、別オリジンのURLを渡されてリンク先をすり替えられる。
 */
function safePath(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  if (/[\s\\]/.test(value)) return ''
  return value
}

/**
 * iframe からの申告を待ち受ける。受け取るたびに onHandoff を呼ぶ。
 *
 * 渡すものが無くなった（部屋から出た等）ときは null を渡す。
 * 前の申告を残したままにすると、リンクが居もしない部屋を指し続けてしまう。
 *
 * 戻り値は後片付けの関数。
 */
export function listenForHandoff(origin: string, onHandoff: (h: Handoff | null) => void): () => void {
  const onMessage = (ev: MessageEvent) => {
    // 名乗ってきたオリジンが埋め込んでいるゲームのものか確かめる。
    // 他のサイトを埋め込んだ広告などから偽の識別子を入れられないように。
    if (ev.origin !== origin) return
    if (!isTell(ev.data)) return
    const { sessionId, name, path } = ev.data
    // 識別子が無くても、どのページに居るかだけで引き継ぐ価値がある
    // （部屋の中の誰なのかをURLで持っているゲームがある）
    const id = typeof sessionId === 'string' ? sessionId : ''
    const p = safePath(path)
    onHandoff(id || p ? { sessionId: id, name: typeof name === 'string' ? name : '', path: p } : null)
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

/** 読み込みが終わった iframe に「今だれ？」と聞く。 */
export function askIframe(frame: HTMLIFrameElement | null, origin: string): void {
  try {
    frame?.contentWindow?.postMessage({ type: ASK }, origin)
  } catch {
    // 聞けなくても、ゲーム側から送られてくる経路が残っている
  }
}

/**
 * 引き継ぎを載せたURLを作る。まだ何も受け取っていなければ元のURLのまま。
 * iframe の中でルームへ移動していれば、そのページを開くURLにする。
 */
export function handoffUrl(url: string, handoff: Handoff | null): string {
  if (!handoff) return url
  let base: URL
  try {
    base = new URL(url, window.location.href)
  } catch {
    return url
  }
  if (handoff.path) {
    const moved = new URL(handoff.path, base)
    // パスだけ差し替える。オリジンが変わる申告は safePath で弾いてある
    base = new URL(moved.pathname + moved.search, base)
  }
  if (handoff.sessionId) base.searchParams.set('sid', handoff.sessionId)
  if (handoff.name) base.searchParams.set('name', handoff.name)
  return base.toString()
}
