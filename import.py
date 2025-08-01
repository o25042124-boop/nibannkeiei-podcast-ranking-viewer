import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import os
import re
from datetime import datetime

# --- 設定 ---
LOGIN_URL = "https://podcastranking.jp/login"
BASE_URL = "https://podcastranking.jp/1734101813/chart.json?page={page}&category=1491"
OUTPUT_DIR = "apple3"
OUTPUT_JSON_PATH = os.path.join(OUTPUT_DIR, "apple3.json")
EMAIL = "yasuhide.katsumi@o2-inc.com"
PASSWORD = "o2pkudanshita"

# --- ログインしてCookie取得 ---
options = Options()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1920,1080")
driver = webdriver.Chrome(service=Service(), options=options)
wait = WebDriverWait(driver, 20)

try:
    driver.get(LOGIN_URL)
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))).send_keys(EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait.until(EC.url_contains("/dashboard"))
    print("✅ ログイン成功")
    cookies_list = driver.get_cookies()
    cookies = {c['name']: c['value'] for c in cookies_list}
except Exception as e:
    print(f"❌ ログイン失敗: {e}")
    driver.quit()
    exit()
finally:
    driver.quit()

# --- ページ取得 ---
combined_data = {}
page = 1

while True:
    url = BASE_URL.format(page=page)
    print(f"📥 ページ {page} を取得中...")
    response = requests.get(url, cookies=cookies)

    if response.status_code != 200:
        print(f"⚠ ページ {page} の取得に失敗 (status: {response.status_code})")
        break

    try:
        data = response.json()
        if not data:
            print(f"ℹ ページ {page} にデータなし。終了。")
            break
        combined_data.update(data)
    except Exception as e:
        print(f"⚠ JSONパース失敗（page={page}）: {e}")
        break

    page += 1

print(f"\n✅ 全ページ取得完了（{page - 1}ページ）")
print(f"📦 合計エントリ数: {len(combined_data)}")

# --- apple1形式に変換 ---
entries = []
current_year = datetime.now().year  # 例：2025
last_month = None
year_switched = False

for time_str, rank in combined_data.items():
    try:
        match = re.match(r"(\d{2}/\d{2})\([^)]+\)\s*(\d{2}):\d{2}", time_str)
        if not match:
            match = re.match(r"(\d{2}/\d{2})\s*(\d{2}):\d{2}", time_str)
        if not match:
            print(f"⚠ パース失敗: {time_str}")
            continue

        date_part, hour = match.groups()
        parsed_date = datetime.strptime(date_part, "%m/%d")
        hour_int = int(hour)
        month = parsed_date.month

        # 年切り替え検出：月が「進む → 戻る」（例：1 → 12）
        if last_month is not None and not year_switched:
            if month > last_month:
                current_year -= 1
                year_switched = True
                print(f"🔄 年度切り替え検出 → 年: {current_year}")

        last_month = month

        # 完成日時生成
        dt = parsed_date.replace(year=current_year, hour=hour_int)

        if dt < datetime(2024, 3, 5):
            continue  # このデータはスキップ（転記しない）

        date_str = dt.strftime("%Y/%m/%d")
        weekday = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]

        entries.append({
            "日付": date_str,
            "曜日": weekday,
            "時刻": hour_int,
            "ランキング": int(rank)
        })

    except Exception as e:
        print(f"⚠ パースエラー: {time_str} → {e}")


# --- 保存 ---
os.makedirs(OUTPUT_DIR, exist_ok=True)
entries.sort(key=lambda x: (x["日付"], x["時刻"]))  # 昇順：古い→新しい

with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=2)

print(f"\n✅ apple3.json 保存完了: {OUTPUT_JSON_PATH}")