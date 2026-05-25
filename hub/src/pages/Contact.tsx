const CONTACT_EMAIL = 'boardgamecat@yahoo.co.jp'
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScgSAt1yIK0c71bqyfjSdxJejm8sUWkzzebX1d_7-uEFZsv9g/viewform'

function PageHeader({ title }: { title: string }) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center px-4 py-3 gap-3"
      style={{
        background: 'rgba(9,9,15,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <a
        href="/"
        onClick={e => { e.preventDefault(); window.location.assign('/') }}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white/80 transition-colors text-sm"
        style={{ background: 'rgba(255,255,255,0.05)' }}
        aria-label="ホームに戻る"
      >
        ←
      </a>
      <div>
        <p className="font-cinzel text-[8px] font-bold tracking-[0.25em] uppercase" style={{ color: '#b8922a' }}>
          ボドゲ広場
        </p>
        <h1 className="font-serif-jp font-bold text-[13px] text-white">{title}</h1>
      </div>
    </header>
  )
}

export default function Contact() {
  return (
    <div className="min-h-screen" style={{ background: '#09090f' }}>
      <PageHeader title="お問い合わせ" />

      <main className="px-5 pt-10 pb-16 max-w-xl mx-auto">
        <p className="font-sans-jp text-[13px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          ボドゲ広場へのご質問・ご意見・不具合報告など、お気軽にお問い合わせください。
          通常3〜5営業日以内にご返信いたします。
        </p>

        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif-jp block w-full py-4 rounded-xl text-[15px] font-bold text-white text-center transition-opacity hover:opacity-90 active:opacity-75 mb-6"
          style={{
            background: 'linear-gradient(135deg, #b8922a, #d4a93a)',
            boxShadow: '0 0 28px rgba(184,146,42,0.35)',
          }}
        >
          お問い合わせフォームを開く →
        </a>

        <div
          className="font-sans-jp text-[12px] px-4 py-3 rounded-xl"
          style={{ background: 'rgba(184,146,42,0.08)', border: '1px solid rgba(184,146,42,0.2)', color: 'rgba(255,255,255,0.45)' }}
        >
          メールでのご連絡はこちら：
          <a href={`mailto:${CONTACT_EMAIL}`} className="ml-1 underline" style={{ color: '#b8922a' }}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="mt-10 flex flex-col gap-4">
          {[
            { icon: '🐛', label: '不具合・バグ報告' },
            { icon: '💬', label: 'ゲームに関するご質問' },
            { icon: '💡', label: 'ご要望・ご提案' },
            { icon: '📣', label: '広告・掲載に関するご相談' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-xl">{icon}</span>
              <span className="font-sans-jp text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
            </div>
          ))}
        </div>

        <p className="font-sans-jp text-[11px] mt-8 leading-relaxed text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
          送信いただいた内容は
          <a
            href="/privacy-policy"
            onClick={e => { e.preventDefault(); window.location.assign('/privacy-policy') }}
            className="underline mx-0.5"
            style={{ color: 'rgba(184,146,42,0.6)' }}
          >
            プライバシーポリシー
          </a>
          に従って取り扱います。
        </p>
      </main>
    </div>
  )
}
