const LAST_UPDATED = '2026年5月22日'

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

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: '#09090f', color: 'rgba(255,255,255,0.82)' }}>
      <PageHeader title="プライバシーポリシー" />

      <main className="px-5 pt-8 pb-16 max-w-2xl mx-auto">
        <p className="font-sans-jp text-[11px] mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          最終更新日：{LAST_UPDATED}
        </p>

        <Section title="1. はじめに">
          <p>
            ボドゲ広場（以下「当サイト」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
            本プライバシーポリシーは、当サイトが収集する情報、その利用方法、およびユーザーの権利について説明します。
            当サイトをご利用になることで、本ポリシーに同意したものとみなします。
          </p>
        </Section>

        <Section title="2. 収集する情報">
          <p className="mb-3">当サイトは以下の情報を収集することがあります。</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>アクセスログ（IPアドレス、ブラウザの種類、参照元URL、アクセス日時）</li>
            <li>Cookieおよびこれに類する技術を通じて収集される利用状況データ</li>
            <li>お問い合わせフォームに入力された情報（氏名、メールアドレス、メッセージ）</li>
            <li>オンラインゲームプレイ時のゲームセッション情報（プレイヤー名、ゲーム進行データ）</li>
          </ul>
        </Section>

        <Section title="3. 情報の利用目的">
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>サービスの提供・維持・改善</li>
            <li>お問い合わせへの対応</li>
            <li>不正利用の検知・防止</li>
            <li>利用状況の分析によるコンテンツの最適化</li>
            <li>広告配信の最適化（詳細は下記「広告について」を参照）</li>
          </ul>
        </Section>

        <Section title="4. Cookieについて">
          <p className="mb-3">
            当サイトはCookieを使用します。Cookieとは、ウェブサイトがブラウザに保存する小さなテキストファイルで、
            サービス品質の向上や広告配信の最適化に役立てています。
          </p>
          <p>
            ほとんどのブラウザはデフォルトでCookieを受け入れますが、ブラウザの設定からCookieを無効にすることができます。
            ただし、Cookieを無効にした場合、当サイトの一部機能が正常に動作しないことがあります。
          </p>
        </Section>

        <Section title="5. 広告について">
          <p className="mb-3">
            当サイトでは、Google Inc.（以下「Google」）が提供するGoogle AdSense広告サービスを利用しています。
            Google AdSenseは、ユーザーの興味や過去の訪問に基づいたパーソナライズ広告を表示するために
            Cookieを使用することがあります。
          </p>
          <p className="mb-3">
            Google AdSenseにおけるCookieの利用に関しては、
            <ExternalLink href="https://policies.google.com/technologies/ads">
              Googleのポリシーと規約
            </ExternalLink>
            をご確認ください。
          </p>
          <p>
            パーソナライズ広告を無効にしたい場合は、
            <ExternalLink href="https://www.google.com/settings/ads">
              Google広告設定ページ
            </ExternalLink>
            から設定を変更できます。また、
            <ExternalLink href="https://optout.aboutads.info/">
              aboutads.info
            </ExternalLink>
            にアクセスすることで、第三者広告事業者のCookie利用をオプトアウトすることもできます。
          </p>
        </Section>

        <Section title="6. アクセス解析ツールについて">
          <p>
            当サイトでは、サービス改善のためにGoogle Analyticsなどのアクセス解析ツールを使用することがあります。
            これらのツールはCookieを使用してデータを収集しますが、個人を特定する情報は含まれません。
            収集されたデータはGoogleのプライバシーポリシーに従って管理されます。
          </p>
        </Section>

        <Section title="7. 第三者への情報提供">
          <p className="mb-3">当サイトは、以下の場合を除き、収集した情報を第三者に提供しません。</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づき開示が必要な場合</li>
            <li>人の生命・身体・財産の保護のために必要な場合</li>
          </ul>
        </Section>

        <Section title="8. 外部リンクについて">
          <p>
            当サイトには外部サイトへのリンクが含まれる場合があります。
            リンク先のウェブサイトにおける個人情報の取り扱いについては、各サイトのプライバシーポリシーをご参照ください。
            当サイトは外部サイトの内容・プライバシー慣行について責任を負いません。
          </p>
        </Section>

        <Section title="9. 未成年者の利用">
          <p>
            当サイトは全年齢を対象としています。13歳未満のお子様が当サイトを利用する場合は、
            保護者の同意のもとでご利用ください。
            13歳未満の子供から故意に個人情報を収集することはありません。
          </p>
        </Section>

        <Section title="10. プライバシーポリシーの変更">
          <p>
            当サイトは、法令の変更やサービスの改善に伴い、本プライバシーポリシーを予告なく変更する場合があります。
            変更後のポリシーは当ページに掲載し、掲載時点から効力を生じます。
            定期的に本ページをご確認いただくことをお勧めします。
          </p>
        </Section>

        <Section title="11. お問い合わせ" last>
          <p>
            本プライバシーポリシーに関するご質問・ご意見は、
            <a
              href="/contact"
              onClick={e => { e.preventDefault(); window.location.assign('/contact') }}
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: '#b8922a' }}
            >
              お問い合わせページ
            </a>
            よりご連絡ください。
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

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:opacity-80 transition-opacity"
      style={{ color: '#b8922a' }}
    >
      {children}
    </a>
  )
}
