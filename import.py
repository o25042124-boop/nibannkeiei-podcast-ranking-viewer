import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json, os, re
from datetime import datetime
import pandas as pd

# ---------- 設定 ----------
LOGIN_URL   = "https://podcastranking.jp/login"
BASE_URL    = "https://podcastranking.jp/1734101813/chart.spotify.json?page={page}&category=%E4%BA%BA%E6%B0%97%E3%81%AE%E3%83%9D%E3%83%83%E3%83%89%E3%82%AD%E3%83%A3%E3%82%B9%E3%83%88"
OUTPUT_DIR  = "spotify"
JSON_PATH   = os.path.join(OUTPUT_DIR, "spotify.json")
EXCEL_PATH  = "spotify.xlsx"

EMAIL       = "yasuhide.katsumi@o2-inc.com"
PASSWORD    = "o2pkudanshita"

MAX_PAGE        = 126
CUTOFF_DATETIME = datetime(2024, 3, 6, 17, 0)
YEAR_SPLIT_PAGE = 83  # このページ以降を2024年とみなす
# ------------------------------------

# ---------- Selenium ログイン ----------
opt = Options()
opt.add_argument("--headless")
opt.add_argument("--no-sandbox")
opt.add_argument("--disable-dev-shm-usage")
opt.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(service=Service(), options=opt)
wait   = WebDriverWait(driver, 20)

try:
    driver.get(LOGIN_URL)
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))).send_keys(EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait.until(EC.url_contains("/dashboard"))
    print("✅ ログイン成功")
    cookies = {c["name"]: c["value"] for c in driver.get_cookies()}
finally:
    driver.quit()

# ---------- ページ巡回 ----------
raw_data = []
for page in range(1, MAX_PAGE + 1):
    url = BASE_URL.format(page=page)
    print(f"📥 page {page} 取得中...")
    r = requests.get(url, cookies=cookies)
    if r.status_code != 200:
        print(f"⚠ ページ取得失敗 ({r.status_code}) → 終了")
        break
    try:
        page_json = r.json()
    except Exception as e:
        print(f"⚠ JSONパース失敗: {e} → 終了")
        break
    if not page_json:
        print("ℹ データなし → 終了")
        break
    for time_str, rank in page_json.items():
        raw_data.append((page, time_str, rank))

print(f"✅ 収集完了: {len(raw_data)} 件")

# ---------- 年度推定ロジック ----------
entries = []
for page, time_str, rank in raw_data:
    m = re.match(r"(\d{2}/\d{2})\([^)]*\)\s*(\d{2}):\d{2}", time_str) \
        or re.match(r"(\d{2}/\d{2})\s*(\d{2}):\d{2}", time_str)
    if not m:
        print(f"⚠ パース失敗: {time_str}")
        continue

    md_part, hour = m.groups()
    try:
        dt_tmp = datetime.strptime(f"2024/{md_part}", "%Y/%m/%d").replace(hour=int(hour))
    except ValueError:
        print(f"⚠ 日付変換失敗: {md_part} → スキップ")
        continue

    # 年度決定
    if page > YEAR_SPLIT_PAGE:
        year = 2024
    elif page < YEAR_SPLIT_PAGE:
        year = 2025
    else:  # page == YEAR_SPLIT_PAGE
        if dt_tmp.month == 1:
            year = 2025
        else:
            year = 2024

    try:
        dt_tmp = dt_tmp.replace(year=year)
    except ValueError:
        print(f"⚠ 年度再設定失敗: {dt_tmp} → スキップ")
        continue

    # 除外条件
    if dt_tmp < CUTOFF_DATETIME:
        continue

    entries.append({
        "日付": dt_tmp.strftime("%Y/%m/%d"),
        "曜日": "月火水木金土日"[dt_tmp.weekday()],
        "時刻": dt_tmp.hour,
        "ランキング": int(rank)
    })

# ---------- 保存 ----------
entries.sort(key=lambda x: (x["日付"], x["時刻"]))
os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=2)
print(f"✅ JSON保存完了: {JSON_PATH}（{len(entries)}件）")

df = pd.DataFrame(entries)[["日付", "曜日", "時刻", "ランキング"]]
df.to_excel(EXCEL_PATH, index=False)
print(f"✅ Excel保存完了: {EXCEL_PATH}（{len(df)}件）")
