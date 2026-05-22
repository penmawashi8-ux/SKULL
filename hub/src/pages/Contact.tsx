import { useState } from 'react'

const CONTACT_EMAIL = 'contact@boardgamecat.com'

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

type FormState = 'idle' | 'submitting' | 'sent' | 'error'

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'お名前を入力してください'
    if (!email.trim()) e.email = 'メールアドレスを入力してください'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = '正しいメールアドレスを入力してください'
    if (!category) e.category = 'お問い合わせ種別を選択してください'
    if (!message.trim()) e.message = 'お問い合わせ内容を入力してください'
    else if (message.trim().length < 10) e.message = '10文字以上で入力してください'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setFormState('submitting')

    const subject = encodeURIComponent(`[ボドゲ広場] ${category}のお問い合わせ - ${name}様`)
    const body = encodeURIComponent(
      `【お名前】\n${name}\n\n【メールアドレス】\n${email}\n\n【お問い合わせ種別】\n${category}\n\n【内容】\n${message}`
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`

    setTimeout(() => setFormState('sent'), 500)
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.85)',
    outline: 'none',
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    fontFamily: "'Noto Sans JP', sans-serif",
    transition: 'border-color 0.2s',
  }

  const errorStyle: React.CSSProperties = {
    color: '#f87171',
    fontSize: '11px',
    marginTop: '4px',
    fontFamily: "'Noto Sans JP', sans-serif",
  }

  if (formState === 'sent') {
    return (
      <div className="min-h-screen" style={{ background: '#09090f' }}>
        <PageHeader title="お問い合わせ" />
        <div className="flex flex-col items-center justify-center px-5 pt-20 pb-16 text-center">
          <div className="text-5xl mb-5">✉️</div>
          <h2 className="font-serif-jp font-bold text-xl text-white mb-3">
            メールアプリが開きました
          </h2>
          <p className="font-sans-jp text-[13px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            メールアプリからそのまま送信してください。<br />
            お問い合わせ内容は自動的に入力されています。<br />
            通常3　5営業日以内にご返信いたします。
          </p>
          <button
            onClick={() => window.location.assign('/')}
            className="font-sans-jp px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: '#b8922a' }}
          >
            ホームに戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#09090f' }}>
      <PageHeader title="お問い合わせ" />

      <main className="px-5 pt-8 pb-16 max-w-xl mx-auto">
        <div className="mb-8">
          <p className="font-sans-jp text-[13px] leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
            ボドゲ広場へのご質問・ご意見・不具合報告など、お気軽にお問い合わせください。
            通常3　5営業日以内にご返信いたします。
          </p>
          <div
            className="font-sans-jp text-[12px] px-4 py-3 rounded-xl"
            style={{ background: 'rgba(184,146,42,0.08)', border: '1px solid rgba(184,146,42,0.2)', color: 'rgba(255,255,255,0.45)' }}
          >
            直接メールでのご連絡も受け付けています：
            <a href={`mailto:${CONTACT_EMAIL}`} className="ml-1 underline" style={{ color: '#b8922a' }}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label className="font-sans-jp text-[12px] font-bold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
              お名前 <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="山田 太郎"
              style={{ ...inputStyle, ...(errors.name ? { borderColor: '#f87171' } : {}) }}
              onFocus={e => { e.currentTarget.style.borderColor = '#b8922a' }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.name ? '#f87171' : 'rgba(255,255,255,0.12)' }}
            />
            {errors.name && <p style={errorStyle}>{errors.name}</p>}
          </div>

          <div className="mb-5">
            <label className="font-sans-jp text-[12px] font-bold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
              メールアドレス <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={{ ...inputStyle, ...(errors.email ? { borderColor: '#f87171' } : {}) }}
              onFocus={e => { e.currentTarget.style.borderColor = '#b8922a' }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.email ? '#f87171' : 'rgba(255,255,255,0.12)' }}
            />
            {errors.email && <p style={errorStyle}>{errors.email}</p>}
          </div>

          <div className="mb-5">
            <label className="font-sans-jp text-[12px] font-bold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
              お問い合わせ種別 <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                ...inputStyle,
                ...(errors.category ? { borderColor: '#f87171' } : {}),
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                paddingRight: '40px',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#b8922a' }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.category ? '#f87171' : 'rgba(255,255,255,0.12)' }}
            >
              <option value="" style={{ background: '#1a1a2e' }}>選択してください</option>
              <option value="不具合・バグ報告" style={{ background: '#1a1a2e' }}>不具合・バグ報告</option>
              <option value="ゲームに関するご質問" style={{ background: '#1a1a2e' }}>ゲームに関するご質問</option>
              <option value="ご要望・ご提案" style={{ background: '#1a1a2e' }}>ご要望・ご提案</option>
              <option value="広告・憂載に関するご相談" style={{ background: '#1a1a2e' }}>広告・憂載に関するご相談</option>
              <option value="その他" style={{ background: '#1a1a2e' }}>その他</option>
            </select>
            {errors.category && <p style={errorStyle}>{errors.category}</p>}
          </div>

          <div className="mb-7">
            <label className="font-sans-jp text-[12px] font-bold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
              お問い合わせ内容 <span style={{ color: '#f87171' }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="お問い合わせ内容を詳しくご記入ください..."
              rows={6}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '140px',
                ...(errors.message ? { borderColor: '#f87171' } : {}),
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#b8922a' }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.message ? '#f87171' : 'rgba(255,255,255,0.12)' }}
            />
            <div className="flex justify-between items-start mt-1">
              {errors.message
                ? <p style={errorStyle}>{errors.message}</p>
                : <span />
              }
              <span className="font-sans-jp text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {message.length} 文字
              </span>
            </div>
          </div>

          <p className="font-sans-jp text-[11px] mb-5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
            送信することで
            <a
              href="/privacy-policy"
              onClick={e => { e.preventDefault(); window.location.assign('/privacy-policy') }}
              className="underline mx-0.5"
              style={{ color: 'rgba(184,146,42,0.7)' }}
            >
              プライバシーポリシー
            </a>
            に同意したものとみなします。
          </p>

          <button
            type="submit"
            disabled={formState === 'submitting'}
            className="font-serif-jp w-full py-3.5 rounded-xl text-[15px] font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #b8922a, #d4a93a)', boxShadow: '0 0 24px rgba(184,146,42,0.3)' }}
          >
            {formState === 'submitting' ? '送信中...' : 'メールで送信する'}
          </button>
        </form>
      </main>
    </div>
  )
}
