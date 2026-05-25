const LAST_UPDATED = '2026年5月25日'
const CONTACT_EMAIL = 'boardgamecat@yahoo.co.jp'

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

export default function About() {
  return (
    <div className="min-h-screen" style={{ background: '#09090f', color: 'rgba(255,255,255,0.82)' }}>
      <PageHeader title="企業情報・運営者情報" />

      <main className="px-5 pt-8 pb-16 max-w-2xl mx-auto">
        <p className="font-sans-jp text-[11px] mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          最終更新日：{LAST_UPDATED}
        </p>

        <Section title="サイト概要">
          <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['サイト名', 'ボドゲ広場'],
                ['サイトURL', 'https://boardgamecat.com'],
                ['サービス内容', 'ブラウザで無料で遊べるオンラインボードゲームの提供'],
                ['開設年', '2026年'],
                ['対応環境', 'PC・スマートフォン・タブレット（モダンブラウザ対応）'],
                ['利用料金', '無料（一部広告を表示）'],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td
                    className="font-sans-jp py-3 pr-4 text-[12px] font-bold whitespace-nowrap align-top"
                    style={{ color: 'rgba(255,255,255,0.45)', width: '120px' }}
                  >
                    {label}
                  </td>
                  <td className="font-sans-jp py-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="運営者情報">
          <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['運営形態', '個人運営'],
                ['運営者', 'ボドゲ広場 管理人'],
                ['連絡先', CONTACT_EMAIL],
                ['所在地', '日本'],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td
                    className="font-sans-jp py-3 pr-4 text-[12px] font-bold whitespace-nowrap align-top"
                    style={{ color: 'rgba(255,255,255,0.45)', width: '120px' }}
                  >
                    {label}
                  </td>
                  <td className="font-sans-jp py-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {label === '連絡先' ? (
                      <a href={`mailto:${value}`} className="underline" style={{ color: '#b8922a' }}>
                        {value}
                      </a>
                    ) : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="提供ゲーム一覧">
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>BOMB（ブラフ・心理戦パーティゲーム）</li>
            <li>ぶたのしっぽ（トランプゲーム）</li>
            <li>バーチャル競馬（仮想ゲーム・金銭のやりとりなし）</li>
            <li>ページワン（トランプゲーム）</li>
            <li>謀略（ブラフ・推理ゲーム）</li>
            <li>疾走（レースゲーム・ベータ版）</li>
            <li>MECH SIEGE（対戦戦略ゲーム・ベータ版）</li>
          </ul>
          <p className="mt-3">
            すべてのゲームはブラウザで動作し、登録・インストール不要で無料でお楽しみいただけます。
          </p>
        </Section>

        <Section title="広告について">
          <p>
            当サイトでは、Google AdSense（Google Inc.）による広告を掲載しています。
            広告の配信にはCookieが使用される場合があります。詳細は
            <a
              href="/privacy-policy"
              onClick={e => { e.preventDefault(); window.location.assign('/privacy-policy') }}
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: '#b8922a' }}
            >
              プライバシーポリシー
            </a>
            をご確認ください。
          </p>
        </Section>

        <Section title="お問い合わせ" last>
          <p>
            サービスに関するご質問・ご意見・不具合報告は、
            <a
              href="/contact"
              onClick={e => { e.preventDefault(); window.location.assign('/contact') }}
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: '#b8922a' }}
            >
              お問い合わせページ
            </a>
            または
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline ml-1" style={{ color: '#b8922a' }}>
              {CONTACT_EMAIL}
            </a>
            までお気軽にご連絡ください。
          </p>
        </Section>
      </main>
    </div>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={last ? 'mb-0' : 'mb-8'}>
      <h2
        className="font-serif-jp font-bold text-[15px] mb-3 pb-2"
        style={{ color: '#e2c97e', borderBottom: '1px solid rgba(184,146,42,0.2)' }}
      >
        {title}
      </h2>
      <div className="font-sans-jp text-[13px] leading-relaxed space-y-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {children}
      </div>
    </section>
  )
}
