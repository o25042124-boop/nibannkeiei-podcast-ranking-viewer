let rawData = [];
let currentFilteredData = null;
let categoryChart;
let rankingRanges = [];
let chart;

// HTML凡例プラグイン（Chart更新のたびにHTML側を再生成）
const htmlLegendPlugin = {
  id: 'htmlLegend',
  afterUpdate(chart, args, options) {
    const container = document.getElementById(options.containerID);
    if (!container) return;
    while (container.firstChild) container.firstChild.remove();

    const labels = chart.data.labels || [];
    const ds = chart.data.datasets?.[0] || { data: [], backgroundColor: [] };
    const dataArr = Array.isArray(ds.data) ? ds.data : [];
    const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [];
    const total = dataArr.reduce((a, b) => a + (Number(b) || 0), 0) || 0;

    labels.forEach((lbl, i) => {
      const value = Number(dataArr[i]) || 0;
      const pct = total ? ((value / total) * 100).toFixed(1) + "%" : "0.0%";

      const item = document.createElement('div');
      item.className = 'item';
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.backgroundColor = colors[i] ?? '#999';
      const text = document.createElement('span');
      text.textContent = `${lbl} (${pct})`;

      item.appendChild(sw);
      item.appendChild(text);
      container.appendChild(item);
    });
  }
};


function generateRankingRanges(data) {
  const maxRank = Math.max(...data.map(d => d["ランキング"]));
  rankingRanges = [];
  for (let start = 1; start <= maxRank; start += 10) {
    const end = Math.min(start + 9, maxRank);
    rankingRanges.push(`${start}-${end}位`);
  }
}

function getRankingCategory(rank) {
  for (const range of rankingRanges) {
    const [min, max] = range.replace("位", "").split("-").map(Number);
    if (rank >= min && rank <= max) return range;
  }
  return "";
}

function renderCategoryChart(data) {
  // フィルタ済みデータから範囲を再生成
  generateRankingRanges(data);

  // 区分ごとに件数集計（ランキングが不正な行は除外）
  const categoryCount = {};
  data.forEach(item => {
    const r = item["ランキング"];
    if (r == null || isNaN(r)) return;
    const cat = getRankingCategory(r) || "不明";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  // 0件は除外、昇順（1-10位→…）で並べる
  const entries = rankingRanges
    .map(r => [r, categoryCount[r] || 0])
    .filter(([, count]) => count > 0);

  const labels = entries.map(e => e[0]);
  const counts = entries.map(e => e[1]);

  const canvas = document.getElementById("category-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (categoryChart) categoryChart.destroy();
  Chart.register(htmlLegendPlugin);
  Chart.register(htmlLegendPlugin);
  categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        label: "件数",
        data: counts,
        backgroundColor: labels.map((_, i) =>
          `hsl(${(i * 360 / Math.max(labels.length, 1))}, 70%, 60%)`
        )
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      radius: "80%",
      layout: { padding: 16 },
      
      responsive: true,
      maintainAspectRatio: false,
      radius: "80%",
      layout: { padding: 16 },
      
      radius: '80%',
      layout: { padding: 16 },
      responsive: true,
      plugins: {
        legend: { display: false },
        htmlLegend: { containerID: 'category-legend' },
        tooltip: { display: false },
        htmlLegend: { containerID: 'category-legend' },
        tooltip: {
          position: "right",
          labels: {
            // 各セグメントに対応する凡例を手動生成（%付き）
            generateLabels: function(chart) {
              const lbls = chart.data.labels || [];
              const ds = chart.data.datasets?.[0] || { data: [], backgroundColor: [] };
              const dataArr = Array.isArray(ds.data) ? ds.data : [];
              const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [];
              const total = dataArr.reduce((a, b) => a + (Number(b) || 0), 0) || 0;

              return lbls.map((lbl, i) => {
                const v = Number(dataArr[i]) || 0;
                const pct = total ? ((v / total) * 100).toFixed(1) + "%" : "0.0%";
                return {
                  text: `${lbl} (${pct})`,
                  fillStyle: colors[i] ?? '#999',
                  strokeStyle: colors[i] ?? '#999',
                  lineWidth: 1,
                  index: i
                };
              });
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
              const value = Number(context.raw) || 0;
              const percentage = total ? ((value / total) * 100).toFixed(1) + "%" : "0.0%";
              return `${context.label}: ${value}件 (${percentage})`;
            }
          }
        }
      }
    }
  });
}

// データ取得と初期表示
async function fetchData() {
  try {
    const response = await fetch("spotify.json");
    rawData = await response.json();
    generateRankingRanges(rawData);
    populateDateOptions(rawData);
    renderChart(rawData);
    renderTable(rawData);
    renderCategoryChart(rawData);
    updateTimestamp();
    currentFilteredData = rawData;
    setupQuickFilters();
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
    ? new Date(startDate).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/")
    : "";
  const endStr = endDate
    ? new Date(endDate).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/")
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

  currentFilteredData = filtered;
  renderChart(filtered);
  renderTable(filtered);
  renderCategoryChart(filtered);
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
      labels,
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
        legend: { display: false },
        htmlLegend: { containerID: 'category-legend' },
        tooltip: { display: false },
        htmlLegend: { containerID: 'category-legend' },
        tooltip: { display: false }
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

      currentFilteredData = filtered;
      renderChart(filtered);
      renderTable(filtered);
      renderCategoryChart(filtered);
    });
  });
}

// ビュー切り替え
document.getElementById("btn-show-chart").onclick = () => {
  document.getElementById("chart-container").style.display = "block";
  document.getElementById("table-container").style.display = "none";
  document.getElementById("category-container").style.display = "none";
};

document.getElementById("btn-show-table").onclick = () => {
  document.getElementById("chart-container").style.display = "none";
  document.getElementById("table-container").style.display = "block";
  document.getElementById("category-container").style.display = "none";
};

document.getElementById("btn-show-category").onclick = () => {
  document.getElementById("chart-container").style.display = "none";
  document.getElementById("table-container").style.display = "none";
  document.getElementById("category-container").style.display = "block";
  renderCategoryChart(currentFilteredData || rawData);
};

// 絞り込み・リセットボタン
document.getElementById("btn-apply-filters").onclick = applyFilters;

document.getElementById("btn-reset-filters").onclick = () => {
  ["filter-year", "filter-month", "filter-start-date", "filter-end-date", "filter-weekday"]
    .forEach(id => document.getElementById(id).value = "");
  currentFilteredData = rawData;
  renderChart(rawData);
  renderTable(rawData);
  renderCategoryChart(rawData);
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
