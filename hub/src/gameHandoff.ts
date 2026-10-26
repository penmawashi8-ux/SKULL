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
// そこで保存領域の共有に頼らず、iframe から教えてもらった識別子を
// リンクのURLに載せて渡す。やりとりは次の2種類だけ。
//   こちら → iframe : { type: 'bodoge:whoami' }   「今だれ？」
//   iframe → こちら : { type: 'bodoge:session', sessionId, name }
//
// ゲーム側が未対応なら何も返ってこないので、リンクは今までどおりになる。

/** iframe に「今だれ？」と聞くときの合図。ゲーム側と揃えること。 */
const ASK = 'bodoge:whoami'
/** iframe が答えてくるときの合図。 */
const TELL = 'bodoge:session'

export type Handoff = { sessionId: string; name: string }

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

function isHandoff(data: unknown): data is { type: string; sessionId: unknown; name?: unknown } {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === TELL
}

/**
 * iframe からの申告を待ち受ける。受け取るたびに onHandoff を呼ぶ。
 * 戻り値は後片付けの関数。
 */
export function listenForHandoff(origin: string, onHandoff: (h: Handoff) => void): () => void {
  const onMessage = (ev: MessageEvent) => {
    // 名乗ってきたオリジンが埋め込んでいるゲームのものか確かめる。
    // 他のサイトを埋め込んだ広告などから偽の識別子を入れられないように。
    if (ev.origin !== origin) return
    if (!isHandoff(ev.data)) return
    const sessionId = ev.data.sessionId
    if (typeof sessionId !== 'string' || !sessionId) return
    const name = typeof ev.data.name === 'string' ? ev.data.name : ''
    onHandoff({ sessionId, name })
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

/** 引き継ぎを載せたURLを作る。まだ何も受け取っていなければ元のURLのまま。 */
export function handoffUrl(url: string, handoff: Handoff | null): string {
  if (!handoff) return url
  const q = new URLSearchParams({ sid: handoff.sessionId })
  if (handoff.name) q.set('name', handoff.name)
  return `${url}${url.includes('?') ? '&' : '?'}${q.toString()}`
}
