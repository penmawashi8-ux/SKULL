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

export default function Terms() {
  return (
    <div className="min-h-screen" style={{ background: '#09090f', color: 'rgba(255,255,255,0.82)' }}>
      <PageHeader title="利用規約" />

      <main className="px-5 pt-8 pb-16 max-w-2xl mx-auto">
        <p className="font-sans-jp text-[11px] mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          最終更新日：{LAST_UPDATED}
        </p>

        <div className="font-sans-jp text-[13px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          この利用規約（以下「本規約」）は、ボドゲ広場（以下「当サイト」）が提供するすべてのサービスの利用条件を定めるものです。
          当サイトをご利用になる前に、本規約をよくお読みください。
          当サイトにアクセス・利用することで、本規約に同意したものとみなします。
        </div>

        <Section title="1. サービスの概要">
          <p>
            当サイト「ボドゲ広場」は、ブラウザ上で無料でプレイできるオンラインボードゲームを提供するウェブサービスです。
            一人プレイ・多人数オンラインプレイに対応したゲームを随時追加・提供しています。
          </p>
        </Section>

        <Section title="2. 利用環境">
          <p className="mb-3">
            当サイトの利用には、インターネットに接続可能な端末および対応するウェブブラウザが必要です。
            通信費・機器費用はユーザーの負担となります。
          </p>
          <p>
            当サイトはモバイル端末・PC双方での利用を想定していますが、
            環境によって一部機能が正常に動作しない場合があります。
          </p>
        </Section>

        <Section title="3. アカウント・プレイヤー名">
          <p className="mb-3">
            当サイトの多人数ゲームでは、プレイヤー名を入力してゲームに参加できます。
            プレイヤー名に関して以下の事項を遵守してください。
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>他者を訹謗中傷・差別する表現を含まないこと</li>
            <li>わいせつ・暴力的な表現を含まないこと</li>
            <li>他者を騙す目的で第三者の名称・商標を使用しないこと</li>
            <li>個人情報（氏名・電話番号・住所等）を含まないこと</li>
          </ul>
        </Section>

        <Section title="4. 禁止事項">
          <p className="mb-3">当サイトの利用において、以下の行為を禁止します。</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>当サイトのサーバーやネットワークに過度な負荷をかける行為</li>
            <li>チート行為・不正なツールの使用によるゲームの改ざん</li>
            <li>他のユーザーへのハラスメント・嫌がらせ行為</li>
            <li>当サイトのコンテンツの無断複製・転用・商業利用</li>
            <li>リバースエンジニアリング・逆コンパイル・逆アセンブル</li>
            <li>法令または公序良俗に反する行為</li>
            <li>その他、当サイトの運営を妨げる行為</li>
          </ul>
        </Section>

        <Section title="5. 知的財産権">
          <p>
            当サイトに憂載されているコンテンツ（テキスト・画像・ゲームプログラム・デザインを含む）の著作権・
            その他の知的財産権は当サイトの運営者に帰属します。
            本規約で明示的に許可された場合を除き、無断での複製・改変・配布・公開を禁じます。
          </p>
        </Section>

        <Section title="6. 広告">
          <p>
            当サイトではGoogle AdSenseをはじめとする第三者の広告サービスを利用する場合があります。
            これらの広告はCookieを使用してユーザーの興味に合わせた広告を表示することがあります。
            詳細は
            <a
              href="/privacy-policy"
              onClick={e => { e.preventDefault(); window.location.assign('/privacy-policy') }}
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: '#b8922a' }}
            >
              プライバシーポリシー
            </a>
            をご参照ください。
          </p>
        </Section>

        <Section title="7. サービスの変更・停止">
          <p>
            当サイトは、ユーザーへの事前通知なく、サービス内容の変更・追加・削除、
            またはサービスの一時停止・終了を行う場合があります。
            これらの措置によってユーザーに生じた損害について、当サイトは責任を負いません。
          </p>
        </Section>

        <Section title="8. 免責事項">
          <p className="mb-3">
            当サイトは可能な限り正確な情報の提供に努めますが、
            コンテンツの正確性・完全性・有用性について保証しません。
          </p>
          <p className="mb-3">
            当サイトの利用によってユーザーに生じた損害（直接的・間接的を問わず）について、
            当サイトは一切の責任を負いません。
          </p>
          <p>
            通信環境・端末環境・サーバー障害等により生じた損害、
            および外部リンク先のサービスに起因する損害についても同様とします。
          </p>
        </Section>

        <Section title="9. リンクについて">
          <p>
            当サイトへのリンクは原則として自由です。ただし、フレーム内での表示や、
            当サイトのコンテンツを自サイトのものと誤認させる方法でのリンクは禁止します。
          </p>
        </Section>

        <Section title="10. 準拠法・裁判管轄">
          <p>
            本規約は日本法に準拠し、これに従って解釈されます。
            当サイトに関して紛争が生じた場合は、当サイト運営者の所在地を管轄する裁判所を
            第一審の専属的合意管轄裁判所とします。
          </p>
        </Section>

        <Section title="11. 規約の変更" last>
          <p>
            当サイトは、必要に応じて本規約を予告なく変更する場合があります。
            変更後の利用規約は当ページに憂載された時点から効力を生じます。
            ご不明な点は
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
