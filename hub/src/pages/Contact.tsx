import { useCanonical } from '../useCanonical'

const CONTACT_EMAIL = 'boardgamecat@yahoo.co.jp'
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScgSAt1yIK0c71bqyfjSdxJejm8sUWkzzebX1d_7-uEFZsv9g/viewform'

function PageHeader({ title }: { title: string }) {
  return (
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
        onClick={e => { e.preventDefault(); window.location.assign('/') }}
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
        <h1 className="font-serif-jp font-bold text-[13px] text-white">{title}</h1>
      </div>
    </header>
  )
}

export default function Contact() {
  useCanonical('/contact')
  return (
    <div className="min-h-screen" style={{ background: '#1a1c30' }}>
      <PageHeader title="お問い合わせ" />

      <main className="px-5 pt-10 pb-16 max-w-xl mx-auto">
        <p className="font-sans-jp text-[13px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          ボドゲ広場へのご質問・ご意見・不具合報告など、お気軽にお問い合わせください。
        </p>

        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif-jp block w-full py-4 rounded-2xl text-[15px] font-bold text-white text-center transition-all hover:opacity-90 hover:-translate-y-0.5 active:opacity-75 mb-6"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            boxShadow: '0 0 28px rgba(251,191,36,0.35)',
          }}
        >
          お問い合わせフォームを開く →
        </a>

        <div
          className="font-sans-jp text-[12px] px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,212,59,0.07)', border: '1px solid rgba(255,212,59,0.18)', color: 'rgba(255,255,255,0.45)' }}
        >
          メールでのご連絡はこちら：
          <a href={`mailto:${CONTACT_EMAIL}`} className="ml-1 underline" style={{ color: '#ffd43b' }}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="mt-10">
          <p className="font-sans-jp text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>対応内容</p>
          <ul className="flex flex-col gap-2">
            {['不具合・バグ報告', 'ゲームに関するご質問', 'ご要望・ご提案', '広告・掲載に関するご相談'].map(label => (
              <li
                key={label}
                className="font-sans-jp text-[13px] flex items-center gap-2"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                <span style={{ color: '#ffd43b' }}>·</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-sans-jp text-[11px] mt-8 leading-relaxed text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
          送信いただいた内容は
          <a
            href="/privacy-policy"
            onClick={e => { e.preventDefault(); window.location.assign('/privacy-policy') }}
            className="underline mx-0.5"
            style={{ color: 'rgba(255,212,59,0.65)' }}
          >
            プライバシーポリシー
          </a>
          に従って取り扱います。
        </p>
      </main>
    </div>
  )
}
