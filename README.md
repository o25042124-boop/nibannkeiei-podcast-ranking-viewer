# Podcastランキングビューア

このプロジェクトは、Podcastのランキング（Apple、Spotify、Amazon）を自動収集し、ExcelやJSONで記録・Webページで可視化する仕組みです。

## ✨ 特徴

* GitHub Actionsによりランキングを自動取得
* JSONとExcel形式でランキング履歴を保存
* GitHub PagesでWebビューアとして公開
* セキュアなログイン情報（環境変数で管理）

## 🌐 公開サイト

[Podcastランキングビューア](https://o25042124-boop.github.io/nibannkeiei-podcast-ranking-viewer/)

* Apple Podcast ビジネス
* Apple Podcast 総合
* Apple Podcast マネージメント
* Spotify 総合
* AmazonMusic 総合

## 📁 ディレクトリ構成

```
.
├── apple1/        # AppleビジネスカテゴリのJSONとWebビューア
├── apple2/        # Apple総合カテゴリ
├── apple3/        # Appleマネージメントカテゴリ
├── spotify/       # Spotifyランキング
├── amazon/        # Amazon Musicランキング
├── excel/         # 各カテゴリのExcelデータ
├── .github/workflows/update.yml   # 自動更新ワークフロー
├── rank_log.py    # ランキング取得・保存スクリプト
└── README.md
```

## 🔧 使用技術

* Python（Selenium, pandas, requests）
* GitHub Actions（自動実行）
* GitHub Pages（公開）
* Excel / JSON（データ保存）

## 📝 実行の流れ

1. `rank_log.py` によりランキングを取得
2. ログイン情報はGitHub Actionsの環境変数で管理
3. データを追記し、ExcelとJSONで保存
4. 更新されたWebビューアをGitHub Pagesにpush

## 🔒 セキュリティ

* ログイン情報（メール・パスワード）は、リポジトリのSecretsとして設定

  * `PODCAST_EMAIL`
  * `PODCAST_PASSWORD`


