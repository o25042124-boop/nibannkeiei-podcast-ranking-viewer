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
import pandas as pd

# --- 設定 ---
LOGIN_URL = "https://podcastranking.jp/login"
BASE_URL = "https://podcastranking.jp/1734101813/chart.json?page={page}&category=1491"
OUTPUT_DIR = "apple3"
OUTPUT_JSON_PATH = os.path.join(OUTPUT_DIR, "apple3.json")
EXCEL_OUTPUT_PATH = "apple3.xlsx"
EMAIL = "yasuhide.katsumi@o2-inc.com"
PASSWORD = "o2pkudanshita"
MAX_PAGE = 74
CUTOFF_DATETIME = datetime(2024, 3, 6, 17, 0)  # ← 17:00 未満は除外

# --- SeleniumでログインしてCookie取得 ---
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

while page <= MAX_PAGE:
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

# --- apple形式に変換 ---
entries = []
current_year = datetime.now().year  # 通常は 2025
last_month = None
year_switched = False

for time_str, rank in combined_data.items():
    try:
        # "08/01(木) 14:00" または "08/01 14:00"
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

        # 年度切り替え（1月→12月への戻りを検出）
        if last_month is not None and not year_switched:
            if month > last_month:
                current_year -= 1
                year_switched = True
                print(f"🔄 年度切り替え検出 → 年: {current_year}")
        last_month = month

        dt = parsed_date.replace(year=current_year, hour=hour_int)

        # ✅ 2024/3/6 17:00 未満は除外
        if dt < CUTOFF_DATETIME:
            continue

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

# --- 並べ替え＆保存準備 ---
entries.sort(key=lambda x: (x["日付"], x["時刻"]))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- JSON保存（上書き） ---
with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=2)
print(f"✅ JSON保存完了（{len(entries)}件）: {OUTPUT_JSON_PATH}")

# --- Excel保存（上書き） ---
df = pd.DataFrame(entries)
df = df[["日付", "曜日", "時刻", "ランキング"]]
df.sort_values(by=["日付", "時刻"], inplace=True)
df.to_excel(EXCEL_OUTPUT_PATH, index=False)
print(f"✅ Excel保存完了（{len(df)}件）: {EXCEL_OUTPUT_PATH}")
