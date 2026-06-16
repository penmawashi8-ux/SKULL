# BOMB 実況ショート動画ジェネレーター

YouTubeショート向けの縦動画（1080×1920）を生成します。3人のプレイヤー
（リン・ソウ・カイ）が騙し合い・煽り合いながらBOMBをプレイする実況動画。

## 内容構成
1. 冒頭：超簡単なルール説明（爆弾かりんごか）
2. 本編：宣言→パス→めくりの心理戦、最後に煽ったカイが爆死
3. 最後：ボードゲーム広場で無料プレイできる宣伝

## 特徴
- 自動音声（open-jtalk、話者ごとにピッチを変えて3人を演じ分け、約1.4倍速）
- 自作のロイヤリティフリーBGM（numpy合成）
- 字幕付き

## 生成方法
```
pip install pillow numpy imageio-ffmpeg
apt-get install open-jtalk hts-voice-nitech-jp-atr503-m001 open-jtalk-mecab-naist-jdic
python3 build.py   # -> bomb_short.mp4
```

## ファイル
- `render.py` … フレーム描画（PIL）
- `script_data.py` … 台本・各プレイヤーの掛け合い
- `build.py` … TTS合成・BGM生成・動画書き出し
