let rawData = [];
let chart; // Chart.js グラフ保持用

// データ取得と初期表示
async function fetchData() {
  try {
    const response = await fetch("apple3.json");
    rawData = await response.json();
    populateDateOptions(rawData);
    renderChart(rawData);
    renderTable(rawData);
    updateTimestamp();
    setupQuickFilters();  // ← ここでボタンイベント登録
  } catch (error) {
    document.getElementById("chart").innerHTML = `<p style="color:red;">データ読み込みエラー: ${error}</p>`;
  }
}

// 年・月の選択肢生成
function populateDateOptions(data) {
  const dateSet = new Set(data.map(d => d["日付"]));
  const dates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));

  const years = new Set();
  const months = new Set();

  dates.forEach(date => {
    const dt = new Date(date);
    years.add(dt.getFullYear());
    months.add((dt.getMonth() + 1).toString().padStart(2, '0'));
  });

  const yearSelect = document.getElementById("filter-year");
  const monthSelect = document.getElementById("filter-month");

  years.forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  months.forEach(month => {
    const opt = document.createElement("option");
    opt.value = month;
    opt.textContent = month;
    monthSelect.appendChild(opt);
  });
}

// 絞り込み実行（年・月・期間・曜日）
function applyFilters() {
  const year = document.getElementById("filter-year").value;
  const month = document.getElementById("filter-month").value;
  const startDate = document.getElementById("filter-start-date").value;
  const endDate = document.getElementById("filter-end-date").value;
  const weekday = document.getElementById("filter-weekday").value;

  // 文字列のまま変換（YYYY/MM/DD）
  const startStr = startDate
    ? new Date(startDate).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, "/")
    : "";

  const endStr = endDate
    ? new Date(endDate).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, "/")
    : "";

  const filtered = rawData.filter(d => {
    const dDateStr = d["日付"];

    const matchYear = !year || dDateStr.startsWith(year);
    const matchMonth = !month || dDateStr.slice(5, 7) === month;
    const matchStart = !startStr || dDateStr >= startStr;
    const matchEnd = !endStr || dDateStr <= endStr;
    const matchWeekday = !weekday || d["曜日"] === weekday;

    return matchYear && matchMonth && matchStart && matchEnd && matchWeekday;
  });

  renderChart(filtered);
  renderTable(filtered);
}


// 表描画
function renderTable(data) {
  const tableBody = document.getElementById("ranking-table-body");
  tableBody.innerHTML = "";

  const sorted = [...data].sort((a, b) => {
    const dtA = new Date(`${a["日付"]} ${a["時刻"]}:00`);
    const dtB = new Date(`${b["日付"]} ${b["時刻"]}:00`);
    return dtB - dtA;
  });

  for (const item of sorted) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item["日付"]}</td>
      <td>${item["曜日"]}</td>
      <td>${item["時刻"].toString().padStart(2, '0')}:00</td>
      <td>${item["ランキング"]}</td>
    `;
    tableBody.appendChild(row);
  }
}

// グラフ描画（null対策あり）
function getWeekdayJP(dateStr) {
  const date = new Date(dateStr);
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function renderChart(data) {
  const canvas = document.getElementById("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const labels = data.map(d => {
    const weekday = getWeekdayJP(d["日付"]);
    return `${d["日付"]}(${weekday})${d["時刻"].toString().padStart(2, '0')}:00`;
});
  const values = data.map(d => d["ランキング"]);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "ランキング",
        data: values,
        borderColor: "steelblue",
        fill: false,
        tension: 0.3,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          reverse: true,
          title: { display: true, text: "ランキング" },
          ticks: { stepSize: 1 }
        },
        x: {
          title: { display: true, text: "日時" },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// 「今日・今週・今月・今年」ボタンの処理を登録
function setupQuickFilters() {
  document.querySelectorAll(".quick-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const start = new Date(today);
      let end = new Date(today);
      const range = btn.dataset.range;

      switch (range) {
        case "today":
          // そのまま
          break;
        case "week":
          const day = today.getDay();
          start.setDate(today.getDate() - day);       // 日曜始まり
          end.setDate(today.getDate() + (6 - day));   // 土曜まで
          break;
        case "month":
          start.setDate(1);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case "year":
          start.setMonth(0, 1);
          end = new Date(today.getFullYear(), 11, 31);
          break;
      }

      const filtered = rawData.filter(d => {
        const dDate = new Date(d["日付"]);
        return dDate >= start && dDate <= end;
      });

      renderChart(filtered);
      renderTable(filtered);
    });
  });
}

// 表とグラフの切り替え
document.getElementById("btn-show-chart").onclick = () => {
  document.getElementById("chart-container").style.display = "block";
  document.getElementById("table-container").style.display = "none";
};

document.getElementById("btn-show-table").onclick = () => {
  document.getElementById("chart-container").style.display = "none";
  document.getElementById("table-container").style.display = "block";
};

// 絞り込み・リセットボタン
document.getElementById("btn-apply-filters").onclick = applyFilters;

document.getElementById("btn-reset-filters").onclick = () => {
  ["filter-year", "filter-month", "filter-start-date", "filter-end-date", "filter-weekday"]
    .forEach(id => document.getElementById(id).value = "");
  renderChart(rawData);
  renderTable(rawData);
};

// 更新日時表示
function updateTimestamp() {
  const now = new Date();
  const formatted = now.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  document.getElementById("last-updated").innerText = `最終更新日時: ${formatted}`;
}

// ページ初期化 + 自動更新
window.onload = fetchData;
setInterval(fetchData, 300000);
