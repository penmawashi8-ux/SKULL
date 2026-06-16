# BOMB 実況ショート動画ジェネレーター

YouTubeショート向けの縦動画（1080×1920）を生成します。3人のプレイヤー
（リン・ソウ・カイ）が騙し合い・煽り合いながらBOMBをプレイする実況動画。

**ゲーム本編は実際のゲーム画面**を使用します。dev サーバーで動かした本物の
アプリに、台本どおりの盤面（store 状態）を注入して各シーンをスクショし、
そこに話者ごとの色付き吹き出しを重ねています。イントロ・ルール説明・最後の
宣伝だけは専用デザイン画面です。

## 内容構成
1. 冒頭：超簡単なルール説明（爆弾かりんごか）
2. 本編：宣言→パス→めくりの心理戦。最後に煽ったカイがリンの爆弾を踏んで自爆
3. 最後：ボードゲーム広場で無料プレイできる宣伝

## 特徴
- **実際のゲームUIをキャプチャ**（CPUモードはローカル完結＝バックエンド不要）
- 自動音声（open-jtalk、話者ごとにピッチを変えて3人を演じ分け、約1.4倍速）
- 話者を指す**色付き吹き出し**（誰が喋っているか一目で分かる）
- 単一音声トラック＋尺一致クリップで**音ズレなし**
- 自作のロイヤリティフリーBGM（numpy合成）

## 必要なもの
```
pip install pillow numpy imageio-ffmpeg
apt-get install open-jtalk hts-voice-nitech-jp-atr503-m001 open-jtalk-mecab-naist-jdic
apt-get install fluidsynth fluid-soundfont-gm   # BGM（実楽器GM音源）
# Node + playwright（実画面キャプチャ用）
```

## 生成手順
```
# 1) ゲームアプリの dev サーバーを起動（別ターミナル）
cd ../bomb-game && npm run dev          # 例: http://localhost:5174

# 2) 実画面をキャプチャ（盤面を注入してスクショ + メタ出力）
APP_URL=http://localhost:5174 node capture.mjs

# 3) 音声合成・吹き出し合成・BGM・書き出し
python3 build.py                        # -> bomb_short.mp4
```

## ファイル
- `capture.mjs` … 実アプリに盤面を注入して各シーンをスクショ＋メタ生成（Playwright）
- `render.py` … 吹き出し・イントロ/ルール/宣伝画面の描画（PIL）
- `music.py` … BGMをMIDIで作曲し fluidsynth で実楽器音にレンダリング
- `build.py` … 音声合成・合成・BGM・動画書き出し
- `build/beats_meta.json` … キャプチャ結果（台本・スクショ・カード座標）

## 台本の編集
掛け合いや展開は `capture.mjs` 内の `BEATS` 配列を編集して調整します
（各 beat の `text`＝セリフ、`stacks`＝盤面、`bid`/`bidder`/`folded`/`emote` など）。
編集後は手順 2→3 を再実行してください。

## 補足（音声について）
当環境ではオンライン音声合成（edge-tts / Google TTS）がネットワークポリシーで
ブロックされていたため、オフラインの open-jtalk を使用しています。VOICEVOX の
ような自然な声にしたい場合は、その音声エンジンが使える環境で `build.py` の
`synth()` を差し替えてください。
