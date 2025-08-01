import pandas as pd
import json
from datetime import datetime

# --- 対象ファイル ---
JSON_PATH = "apple3/apple3.json"
EXCEL_PATH = "excel/apple3.xlsx"

# --- 削除基準日・時刻 ---
CUTOFF_DATE = datetime(2024, 3, 6)
CUTOFF_HOUR = 17

# --- JSON 処理 ---
print("📦 JSON 処理中...")
with open(JSON_PATH, "r", encoding="utf-8") as f:
    json_data = json.load(f)

filtered_json = []
for entry in json_data:
    try:
        entry_date = datetime.strptime(entry["日付"], "%Y/%m/%d")
        hour = int(entry["時刻"])

        if (entry_date < CUTOFF_DATE) or (entry_date == CUTOFF_DATE and hour <= CUTOFF_HOUR):
            continue  # 削除対象
        filtered_json.append(entry)
    except Exception as e:
        print(f"⚠ パース失敗: {entry} → {e}")

# 上書き保存
with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(filtered_json, f, ensure_ascii=False, indent=2)
print(f"✅ JSONデータ更新完了 → {JSON_PATH}")

# --- Excel 処理 ---
print("📊 Excel 処理中...")
df = pd.read_excel(EXCEL_PATH)
df["日付_dt"] = pd.to_datetime(df["日付"], format="%Y/%m/%d")

# 削除条件
condition = (
    (df["日付_dt"] < CUTOFF_DATE) |
    ((df["日付_dt"] == CUTOFF_DATE) & (df["時刻"] <= CUTOFF_HOUR))
)

df_cleaned = df[~condition].copy()
df_cleaned = df_cleaned[["日付", "曜日", "時刻", "ランキング"]]  # 列順を戻す
df_cleaned.to_excel(EXCEL_PATH, index=False)
print(f"✅ Excelデータ更新完了 → {EXCEL_PATH}")
