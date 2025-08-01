import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import os
from datetime import datetime
import re
import json
import time


# --- 設定 ---
# データ取得対象のURLと表示タイトルを定義
URL_CONFIGS = [
    {"name": "apple1", "url": "https://podcastranking.jp/1734101813/chart.json?page=1&category=1321", "display_title": "ApplePodcast 「ビジネス」カテゴリーランキング遷移"},
    {"name": "apple2", "url": "https://podcastranking.jp/1734101813/chart.json?page=1&category=26", "display_title": "ApplePodcast 総合ランキング遷移"},
    {"name": "apple3", "url": "https://podcastranking.jp/1734101813/chart.json?page=1&category=1491", "display_title": "ApplePodcast 「マネージメント」カテゴリーランキング遷移"},
    {"name": "spotify", "url": "https://podcastranking.jp/1734101813/chart.spotify.json?page=1&category=%E4%BA%BA%E6%B0%97%E3%81%AE%E3%83%9D%E3%83%83%E3%83%89%E3%82%AD%E3%83%A3%E3%82%B9%E3%83%88", "display_title": "Spotify 「人気のポッドキャスト」ランキング遷移"},
    {"name": "amazon", "url": "https://podcastranking.jp/1734101813/chart.amazon.json?page=1&category=%E4%BA%BA%E6%B0%97%E3%81%AE%E3%83%9D%E3%83%83%E3%83%89%E3%82%AD%E3%83%A3%E3%82%B9%E3%83%88", "display_title": "Amazon Music 「人気のポッドキャスト」ランキング遷移"},
]

DATA_DIR = "data" # JSONファイルを保存するディレクトリ
EXCEL_PATH_COMBINED = "ranking_hover_data_combined.xlsx" # 全データを統合したExcelファイル

# データディレクトリが存在しない場合は作成
os.makedirs(DATA_DIR, exist_ok=True)

# --- Seleniumのセットアップとログイン ---
options = Options()
options.add_argument("--headless") # ヘッドレスモードで実行（ブラウザGUIを表示しない）
options.add_argument("--no-sandbox") # サンドボックスを無効化（一部環境で必要）
options.add_argument("--disable-dev-shm-usage") # /dev/shm の使用を無効化（Dockerなど一部環境で必要）
options.add_argument("--window-size=1920,1080") # デフォルトのウィンドウサイズを設定
service = Service() # ChromeDriverのサービスを初期化
driver = webdriver.Chrome(service=service, options=options)
wait = WebDriverWait(driver, 20) # 待機時間を20秒に設定

try:
    # ログインページにアクセス
    driver.get("https://podcastranking.jp/login")
    # メールアドレスとパスワードを入力し、ログインボタンをクリック
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))).send_keys("yasuhide.katsumi@o2-inc.com")
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("o2pkudanshita")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    # ダッシュボードURLへの遷移を待機
    wait.until(EC.url_contains("/dashboard"))
    print("✅ ログイン成功")

    # ログイン後のクッキーを取得
    cookies = {c['name']: c['value'] for c in driver.get_cookies()}

except Exception as e:
    print(f"❌ ログイン失敗: {e}")
    cookies = {} # ログイン失敗時はクッキーを空にする
finally:
    driver.quit() # 常にドライバーを終了する

# --- 各URLからのデータ取得と処理 ---
all_combined_entries = [] # 結合されたExcelファイル用の全データを格納するリスト

for config in URL_CONFIGS:
    source_name = config["name"]
    json_url = config["url"]
    display_title = config["display_title"]
    print(f"\n📥 データ取得中: {display_title} ({json_url})")
    response = requests.get(json_url, cookies=cookies)
    if response.status_code != 200:
        print(f"❌ データ取得失敗: {display_title} (ステータスコード: {response.status_code})")
        continue
    try:
        json_data = response.json()
    except Exception as e:
        print(f"⚠ JSONパースエラー: {display_title} → {e}")
        continue
    current_source_entries = []
    for time_str, rank in json_data.items():
        try:
            match = re.match(r"(\d{2}/\d{2})\([^)]+\)\s*(\d{2}):\d{2}", time_str)
            if not match:
                match_no_weekday = re.match(r"(\d{2}/\d{2})\s*(\d{2}):\d{2}", time_str)
                if match_no_weekday:
                    date_part, hour = match_no_weekday.groups()
                else:
                    print(f"⚠ パース失敗: {time_str} (フォーマット不一致)")
                    continue
            else:
                date_part, hour = match.groups()
            dt = datetime.strptime(date_part, "%m/%d").replace(year=datetime.now().year)
            ymd_str = dt.strftime("%Y/%m/%d")
            weekday_jp = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
            current_source_entries.append({
                "ソース名": source_name,
                "日付": ymd_str,
                "曜日": weekday_jp,
                "時刻": int(hour),
                "ランキング": int(rank)
            })
        except Exception as e:
            print(f"⚠ パース失敗: {time_str} → {e}")
    df_current_source = pd.DataFrame(current_source_entries)
    if not df_current_source.empty:
        df_current_source.sort_values(by=["日付", "時刻"], inplace=True)
        all_combined_entries.extend(current_source_entries)

        # ✅ Web用JSON出力（ループ内に配置）
        individual_json_path = os.path.join(source_name, f"{source_name}.json")
        df_current_source_for_web = df_current_source.drop(columns=["ソース名"])
        if os.path.exists(individual_json_path):
            try:
                with open(individual_json_path, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                df_old = pd.DataFrame(old_data)
                df_current_source_for_web = pd.concat([df_old, df_current_source_for_web], ignore_index=True)
                df_current_source_for_web.drop_duplicates(subset=["日付", "時刻"], inplace=True)
                df_current_source_for_web.sort_values(by=["日付", "時刻"], inplace=True)
            except Exception as e:
                print(f"⚠ 過去JSONの読み込みに失敗: {individual_json_path} → {e}")
        df_current_source_for_web.to_json(individual_json_path, orient="records", force_ascii=False, indent=2)
        print(f"✅ JSON出力完了: {individual_json_path}")
    else:
        print(f"⚠️ {display_title} のデータがありませんでした。")

if all_combined_entries:
    df_all_combined = pd.DataFrame(all_combined_entries)
    if os.path.exists(EXCEL_PATH_COMBINED):
        df_existing = pd.read_excel(EXCEL_PATH_COMBINED)
        df_all_combined = pd.concat([df_existing, df_all_combined], ignore_index=True)
    df_all_combined.drop_duplicates(subset=["ソース名", "日付", "時刻"], inplace=True)
    def compute_weekday_jp(date_str):
        if pd.isna(date_str) or str(date_str).strip() == "":
            return ""
        try:
            dt = datetime.strptime(str(date_str), "%Y/%m/%d")
            return ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
        except ValueError:
            return ""
    df_all_combined["曜日"] = df_all_combined["日付"].apply(compute_weekday_jp)
    df_all_combined.loc[df_all_combined["日付"].isna(), "ランキング"] = pd.NA
    df_all_combined.loc[df_all_combined["日付"] == "", "ランキング"] = pd.NA
    df_all_combined.sort_values(by=["ソース名", "日付", "時刻"], inplace=True)
    df_all_combined = df_all_combined[["ソース名", "日付", "曜日", "時刻", "ランキング"]]
    df_all_combined.to_excel(EXCEL_PATH_COMBINED, index=False)
    print(f"\n✅ 全データ統合Excel保存完了: {EXCEL_PATH_COMBINED}")
else:
    print("\n⚠️ 取得するデータがありませんでした。結合Excelは作成されません。")


