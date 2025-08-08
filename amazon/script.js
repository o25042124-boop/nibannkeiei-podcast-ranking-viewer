let rawData = [];
let currentFilteredData = null;
let categoryChart;
let rankingRanges = [];
let chart;

/* ===== 外側HTML凡例プラグイン ===== */
const htmlLegendPlugin = {
  id: 'htmlLegend',
  afterUpdate(chart, args, options) {
    const container = document.getElementById(options.containerID);
    if (!container) return;

    // ULの用意
    let ul = container.querySelector('ul');
    if (!ul) {
      ul = document.createElement('ul');
      container.appendChild(ul);
    }
    while (ul.firstChild) ul.firstChild.remove();

    // データ
    const labels = chart.data.labels || [];
    const ds = chart.data.datasets?.[0] || { data: [], backgroundColor: [] };
    const dataArr = Array.isArray(ds.data) ? ds.data : [];
    const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [];
    const total = dataArr.reduce((a, b) => a + (Number(b) || 0), 0) || 0;

    labels.forEach((lbl, i) => {
      const li = document.createElement('li');

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = colors[i] ?? '#999';
      li.appendChild(sw);

      const v = Number(dataArr[i]) || 0;
      const pct = total ? ((v / total) * 100).toFixed(1) + '%' : '0.0%';
      li.appendChild(document.createTextNode(`${lbl} (${pct})`));

      ul.appendChild(li);
    });
  }
};
/* ================================= */

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
  // キャンバスサイズ（PC：直径=折れ線高さ、スマホ：100%）
  const canvas = document.getElementById("category-chart");
  if (!canvas) return;
  const isSmallScreen = window.innerWidth < 768;
  const chartContainer = document.getElementById("chart-container");
  const diameter = (chartContainer?.clientHeight) || 500;

  if (isSmallScreen) {
  canvas.style.width = "100%";
  canvas.style.height = "";  // 高さはChart.jsに任せる
  if (legendEl) {
    legendEl.style.maxHeight = "70vh";  // 高さだけ管理
    // 幅はCSSのflexで管理
  }
  } else {
    canvas.style.width  = `${diameter}px`;
    canvas.style.height = `${diameter}px`;
    if (legendEl) {
      legendEl.style.maxHeight = `${diameter}px`;
      legendEl.style.width = "280px";
    }
  }


  // 区分集計
  generateRankingRanges(data);
  const categoryCount = {};
  data.forEach(item => {
    const r = item["ランキング"];
    if (r == null || isNaN(r)) return;
    const cat = getRankingCategory(r) || "不明";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  const entries = rankingRanges
    .map(r => [r, categoryCount[r] || 0])
    .filter(([, c]) => c > 0);

  const labels = entries.map(e => e[0]);
  const counts = entries.map(e => e[1]);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (categoryChart) categoryChart.destroy();

  Chart.register(htmlLegendPlugin);

  const pieRadius = isSmallScreen ? '80%' : '65%';

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
      radius: pieRadius,
      layout: { padding: 16 },
      responsive: true,
      plugins: {
        legend: { display: false },                     // ← 内蔵凡例 Off
        htmlLegend: { containerID: 'category-legend' }, // ← 外側DOM凡例も維持
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

// ===== 以降は既存処理（フィルタ・折れ線・表など） =====
async function fetchData() {
  try {
    const response = await fetch("amazon.json");
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
    const opt = document.createElement("option"); opt.value = year; opt.textContent = year; yearSelect.appendChild(opt);
  });
  months.forEach(month => {
    const opt = document.createElement("option"); opt.value = month; opt.textContent = month; monthSelect.appendChild(opt);
  });
}

function applyFilters() {
  const year = document.getElementById("filter-year").value;
  const month = document.getElementById("filter-month").value;
  const startDate = document.getElementById("filter-start-date").value;
  const endDate = document.getElementById("filter-end-date").value;
  const weekday = document.getElementById("filter-weekday").value;

  const startStr = startDate ? new Date(startDate).toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\//g,"/") : "";
  const endStr   = endDate   ? new Date(endDate).toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\//g,"/")   : "";

  const filtered = rawData.filter(d => {
    const dDateStr = d["日付"];
    const matchYear = !year || dDateStr.startsWith(year);
    const matchMonth = !month || dDateStr.slice(5,7) === month;
    const matchStart = !startStr || dDateStr >= startStr;
    const matchEnd   = !endStr   || dDateStr <= endStr;
    const matchWeekday = !weekday || d["曜日"] === weekday;
    return matchYear && matchMonth && matchStart && matchEnd && matchWeekday;
  });

  currentFilteredData = filtered;
  renderChart(filtered);
  renderTable(filtered);
  renderCategoryChart(filtered);
}

function renderTable(data) {
  const tbody = document.getElementById("ranking-table-body");
  tbody.innerHTML = "";
  const sorted = [...data].sort((a,b)=> new Date(`${b["日付"]} ${b["時刻"]}:00`) - new Date(`${a["日付"]} ${a["時刻"]}:00`));
  for (const item of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item["日付"]}</td>
      <td>${item["曜日"]}</td>
      <td>${item["時刻"].toString().padStart(2,'0')}:00</td>
      <td>${item["ランキング"]}</td>`;
    tbody.appendChild(tr);
  }
}

function getWeekdayJP(dateStr) {
  const date = new Date(dateStr);
  return ["日","月","火","水","木","金","土"][date.getDay()];
}

function renderChart(data) {
  const canvas = document.getElementById("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const labels = data.map(d => `${d["日付"]}(${getWeekdayJP(d["日付"])})${d["時刻"].toString().padStart(2,'0')}:00`);
  const values = data.map(d => d["ランキング"]);
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label:"ランキング", data: values, borderColor: "steelblue", fill:false, tension:0.3, pointRadius:2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { reverse: true, title:{display:true,text:"ランキング"}, ticks:{stepSize:1} },
        x: { title:{display:true,text:"日時"}, ticks:{maxRotation:45,minRotation:45,autoSkip:true} }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function setupQuickFilters() {
  document.querySelectorAll(".quick-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(today);
      let end = new Date(today);
      switch (btn.dataset.range) {
        case "week": {
          const day = today.getDay(); start.setDate(today.getDate() - day); end.setDate(today.getDate() + (6 - day)); break;
        }
        case "month": start.setDate(1); end = new Date(today.getFullYear(), today.getMonth()+1, 0); break;
        case "year":  start.setMonth(0,1); end = new Date(today.getFullYear(), 11, 31); break;
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

// ビュー切替
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

// リセット
document.getElementById("btn-apply-filters").onclick = applyFilters;
document.getElementById("btn-reset-filters").onclick = () => {
  ["filter-year","filter-month","filter-start-date","filter-end-date","filter-weekday"].forEach(id => document.getElementById(id).value = "");
  currentFilteredData = rawData;
  renderChart(rawData); renderTable(rawData); renderCategoryChart(rawData);
};

// リサイズ時も再レイアウト
window.addEventListener('resize', () => {
  renderCategoryChart(currentFilteredData || rawData);
});

function updateTimestamp() {
  const now = new Date();
  const formatted = now.toLocaleString("ja-JP",{ year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false });
  document.getElementById("last-updated").innerText = `最終更新日時: ${formatted}`;
}

window.onload = fetchData;
setInterval(fetchData, 300000);
