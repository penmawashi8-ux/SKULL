# PWA自動更新UIの適用指示プロンプト

以下をそのまま実装指示として使ってください。

---
このプロジェクトに、**新バージョン公開時に「更新」ボタンを自動表示するPWA更新導線**を追加してください。

## 要件
1. `vite-plugin-pwa` の `registerType` は `prompt` を使う。
2. `useRegisterSW`（`virtual:pwa-register/react`）を使って `needRefresh` を監視する。
3. `needRefresh === true` のときだけ、画面下部に更新バナーを表示する。
4. 更新バナーのボタン押下で `updateServiceWorker(true)` を実行する。
5. キャッシュ残りで更新検知が遅れないよう、Service Worker の更新確認を定期実行する。
   - 例: `onRegisteredSW` で `registration.update()` を 60秒間隔で実行。
6. 既存UIのトーンに合わせたスタイルで実装する（固定表示・高z-index・視認性高め）。

## 実装イメージ（要点）
- `src/components/UpdatePrompt.tsx` を作成または更新
- アプリルート（例: `App.tsx`）で `<UpdatePrompt />` を常時マウント
- 本番ビルドでPWAが有効な状態で動作確認

## 受け入れ条件
- 新バージョン配布後、クライアント側で `needRefresh` が立ったら更新バナーが表示される。
- バナーの「更新」クリックで最新版へ切り替わる。
- 再訪問待ちではなく、定期チェックで更新検知できる。
---
