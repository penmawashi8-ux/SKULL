import { useCanonical } from '../useCanonical'

const LAST_UPDATED = '2026年8月12日'
const CONTACT_EMAIL = 'boardgamecat@yahoo.co.jp'

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

export default function About() {
  useCanonical('/about')
  return (
    <div className="min-h-screen" style={{ background: '#1a1c30', color: 'rgba(255,255,255,0.82)' }}>
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
                ['ボードゲーム歴', '10年以上'],
                ['開発経験', 'Webゲーム・スマホアプリの個人開発'],
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
                      <a href={`mailto:${value}`} className="underline" style={{ color: '#ffd43b' }}>
                        {value}
                      </a>
                    ) : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="ボドゲ広場を作った理由">
          <p>
            もともとボードゲームが好きで、友達と集まるたびに「スカル」「クー」「ぶたのしっぽ」などを遊んでいました。でも、オンラインで気軽に遊べるものが少なく、インストール不要でURLを送るだけで始められるゲームが欲しいと思ったのがきっかけです。
          </p>
          <p>
            最初に作ったのがBOMBで、SKULLにインスパイアされたブラフゲームです。「これをブラウザで友達と遊べたら楽しいな」という気持ちだけで作りました。反響があったので、ぶたのしっぽ・ページワン・謀略と少しずつ増やしていきました。
          </p>
          <p>
            その後、大富豪・ババ抜き・7並べ・神経衰弱・リバーシ・五目並べ・まるばつ・すごろくといった定番ゲームも自分で実装しました。定番ゲームは「知っているはずなのに、細かいルールが人によって違う」ことが多く、遊ぶ前に揉めがちです。そこでボドゲ広場では、ローカルルールを一つひとつオン・オフで選べるようにしています。大富豪の21種のローカルルールや、7並べのパス回数・A-K連結などがその例です。
          </p>
          <p>
            複雑なルール説明なしに、URLを送るだけで5分後には遊べる——そんなシンプルさを一番大切にしています。
          </p>
        </Section>

        <Section title="コンテンツの制作方針">
          <p>
            当サイトのゲームはすべて運営者本人が設計・実装しています。ブログのルール解説・攻略記事も、実際にゲームを実装しながら各ルールの挙動を検証した内容にもとづいて、運営者が執筆しています。
          </p>
          <p>
            大富豪や7並べのように地域差の大きいゲームについては、「これが正式ルール」と断定せず、<strong>どのルールが一般的で、どこに地域差があるのか</strong>を明示する方針で書いています。遊ぶ前に決めておくべき項目を記事内で示しているのも同じ理由です。
          </p>
          <p>
            誤りのご指摘や、お住まいの地域のローカルルールの情報は、お問い合わせからお寄せください。内容を確認のうえ記事に反映します。
          </p>
        </Section>

        <Section title="提供ゲーム一覧">
          <p className="mb-3">
            2026年8月現在、14タイトルを公開しています。すべて自作のオリジナル実装で、他サイトのゲームを転載・埋め込みしたものではありません。
          </p>
          {[
            {
              heading: 'オリジナルゲーム',
              items: [
                'BOMB（ブラフ・心理戦パーティゲーム／2〜6人）',
                '謀略（ブラフ・推理ゲーム／2〜6人）',
                'バーチャル競馬（予想・観戦ゲーム／金銭のやりとりなし）',
                'ポコっとライト（1人用パズル／3×3〜6×6）',
              ],
            },
            {
              heading: '定番トランプゲーム',
              items: [
                '大富豪（ローカルルール21種＋自作ルール機能／1〜4人）',
                'ババ抜き（オリジナルルール「にせジョーカー」／1〜4人）',
                '7並べ（パス3回制・A-K連結・ジョーカー／1〜4人）',
                '神経衰弱（オリジナルルール「泥棒セブン」／1〜2人）',
                'ぶたのしっぽ（1〜6人）',
                'ページワン（1〜4人）',
              ],
            },
            {
              heading: '定番ボードゲーム',
              items: [
                'リバーシ（オリジナルルール「おかわりマス」／1〜2人）',
                '五目並べ（オリジナルルール「クラッシュマス」／1〜2人）',
                'まるばつ（オリジナルルール「消えるまるばつ」／1〜2人）',
                'すごろく（オリジナルルール「ドッスン」／1〜4人）',
              ],
            },
          ].map(group => (
            <div key={group.heading} className="mb-4">
              <p className="font-bold text-[12px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {group.heading}
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                {group.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
          <p className="mt-3">
            すべてのゲームはブラウザで動作し、登録・インストール不要で無料でお楽しみいただけます。各ゲームのルール・遊び方・攻略は
            <a
              href="/blog/"
              className="underline mx-1"
              style={{ color: '#ffd43b' }}
            >
              ブログ
            </a>
            で解説しています。
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
              style={{ color: '#ffd43b' }}
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
              style={{ color: '#ffd43b' }}
            >
              お問い合わせページ
            </a>
            または
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline ml-1" style={{ color: '#ffd43b' }}>
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
        style={{ color: '#fde68a', borderBottom: '1px solid rgba(255,212,59,0.2)' }}
      >
        {title}
      </h2>
      <div className="font-sans-jp text-[13px] leading-relaxed space-y-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {children}
      </div>
    </section>
  )
}
