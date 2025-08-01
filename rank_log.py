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

# --- 設定 ---
URL_CONFIGS = [
    {"name": "apple1", "url": "https://podcastranking.jp/1734101813/chart.json?page=1&category=1321", "display_title": "ApplePodcast 「ビジネス」カテゴリー"},
    {"name": "apple2", "url": "https://podcastranking.jp/1734101813/chart.json?page=1&category=26", "display_title": "ApplePodcast 総合ランキング"},
    {"name": "apple3", "url": "https://podcastranking.jp/1734101813/chart.json?page=1&category=1491", "display_title": "ApplePodcast 「マネージメント」カテゴリー"},
    {"name": "spotify", "url": "https://podcastranking.jp/1734101813/chart.spotify.json?page=1&category=人気のポッドキャスト", "display_title": "Spotify 人気ランキング"},
    {"name": "amazon", "url": "https://podcastranking.jp/1734101813/chart.amazon.json?page=1&category=人気のポッドキャスト", "display_title": "Amazon Music 人気ランキング"},
]

EXCEL_DIR = "excel"
os.makedirs(EXCEL_DIR, exist_ok=True)

# --- Selenium ログイン ---
options = Options()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1920,1080")
service = Service()
driver = webdriver.Chrome(service=service, options=options)
wait = WebDriverWait(driver, 20)

try:
    driver.get("https://podcastranking.jp/login")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))).send_keys("yasuhide.katsumi@o2-inc.com")
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("o2pkudanshita")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait.until(EC.url_contains("/dashboard"))
    print("✅ ログイン成功")
    cookies = {c['name']: c['value'] for c in driver.get_cookies()}
except Exception as e:
    print(f"❌ ログイン失敗: {e}")
    cookies = {}
finally:
    driver.quit()

# --- 曜日取得関数 ---
def compute_weekday_jp(date_str):
    try:
        dt = datetime.strptime(date_str, "%Y/%m/%d")
        return ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
    except:
        return ""

# --- 各チャートの処理 ---
for config in URL_CONFIGS:
    name = config["name"]
    url = config["url"]
    title = config["display_title"]

    print(f"\n📥 {title} のデータ取得中...")
    response = requests.get(url, cookies=cookies)
    if response.status_code != 200:
        print(f"❌ データ取得失敗 ({response.status_code})")
        continue

    try:
        json_data = response.json()
    except Exception as e:
        print(f"⚠ JSONパースエラー: {e}")
        continue

    entries = []
    for time_str, rank in json_data.items():
        try:
            match = re.match(r"(\d{2}/\d{2})\([^)]+\)\s*(\d{2}):\d{2}", time_str)
            if not match:
                match = re.match(r"(\d{2}/\d{2})\s*(\d{2}):\d{2}", time_str)
            if not match:
                print(f"⚠ パース失敗: {time_str}")
                continue

            date_part, hour = match.groups()
            dt = datetime.strptime(date_part, "%m/%d").replace(year=datetime.now().year)
            date_str = dt.strftime("%Y/%m/%d")
            weekday = compute_weekday_jp(date_str)

            entries.append({
                "日付": date_str,
                "曜日": weekday,
                "時刻": int(hour),
                "ランキング": int(rank)
            })
        except Exception as e:
            print(f"⚠ パースエラー: {time_str} → {e}")

    if not entries:
        print(f"⚠ {name} にデータなし")
        continue

    df_new = pd.DataFrame(entries).sort_values(by=["日付", "時刻"])

    # --- チャート別フォルダ作成 ---
    os.makedirs(name, exist_ok=True)

    # --- JSON出力 ---
    json_path = os.path.join(name, f"{name}.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)
            df_old = pd.DataFrame(old_data)
            df_new = pd.concat([df_old, df_new], ignore_index=True)
            df_new.drop_duplicates(subset=["日付", "時刻"], inplace=True)
            df_new.sort_values(by=["日付", "時刻"], inplace=True)
        except Exception as e:
            print(f"⚠ 旧JSON読み込みエラー: {e}")

    df_new.to_json(json_path, orient="records", force_ascii=False, indent=2)
    print(f"✅ JSON保存完了: {json_path}")

    # --- Excel出力 ---
    excel_path = os.path.join(EXCEL_DIR, f"{name}.xlsx")
    if os.path.exists(excel_path):
        df_existing = pd.read_excel(excel_path)
        df_new = pd.concat([df_existing, df_new], ignore_index=True)
        df_new.drop_duplicates(subset=["日付", "時刻"], inplace=True)
        df_new.sort_values(by=["日付", "時刻"], inplace=True)

    df_new = df_new[["日付", "曜日", "時刻", "ランキング"]]
    df_new.to_excel(excel_path, index=False)
    print(f"✅ Excel保存完了: {excel_path}")

print("\n🎉 全チャートの処理が完了しました。")
