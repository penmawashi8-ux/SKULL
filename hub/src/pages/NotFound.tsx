// 存在しないURL向けのページ。
// 以前は vercel.json のキャッチオール rewrite で、どんなURLでもトップページの
// 内容を HTTP 200 で返していた（ソフト404）。実体のないURLが無限に「中身のある
// ページ」として存在する状態は検索品質・広告審査の両方で不利なため、
// 404.html として出力し Vercel に 404 ステータスで返させる。
import { useCanonical } from '../useCanonical'

const LINKS = [
  { href: '/', label: 'トップページ（ゲーム一覧）' },
  { href: '/blog/', label: 'ルール・攻略の記事一覧' },
  { href: '/about', label: '運営者情報' },
  { href: '/contact', label: 'お問い合わせ' },
]

export default function NotFound() {
  useCanonical('/404')
  return (
    <div className="min-h-screen" style={{ background: '#1a1c30' }}>
      <header
        className="sticky top-0 z-20 flex items-center px-4 py-3 gap-3"
        style={{
          background: 'rgba(26, 28, 48, 0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '2px solid rgba(255,255,255,0.07)',
        }}
      >
        <a
          href="/"
          className="w-9 h-9 flex items-center justify-center rounded-2xl text-white/55 hover:text-white/85 transition-colors text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.07)' }}
          aria-label="ホームに戻る"
        >
          ←
        </a>
        <div>
          <p className="font-cinzel text-[8px] font-bold tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
            ✦ ボドゲ広場
          </p>
          <h1 className="font-serif-jp font-bold text-[13px] text-white">ページが見つかりません</h1>
        </div>
      </header>

      <main className="px-5 pt-16 pb-20 max-w-xl mx-auto text-center">
        <div className="text-6xl mb-6">🎲</div>
        <p className="font-serif-jp text-white text-lg font-bold mb-3">404 — ページが見つかりません</p>
        <p className="font-sans-jp text-[13px] leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
          お探しのページは削除されたか、URLが変更された可能性があります。
        </p>

        <ul className="flex flex-col gap-3 text-left">
          {LINKS.map(link => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-sans-jp block px-4 py-3 rounded-xl text-[14px] text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {link.label} →
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
