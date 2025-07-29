let rawData = [];
let chart; // Chart.js グラフ保持用

// データ取得と初期表示
async function fetchData() {
  try {
    const response = await fetch("data_podcast2.json");
    rawData = await response.json();
    populateDateOptions(rawData); // ★ここで呼び出す
    renderChart(rawData);
    renderTable(rawData);
    updateTimestamp(); // ← データ取得後に更新時刻表示

  } catch (error) {
    document.getElementById("chart").innerHTML = `<p style="color:red;">データ読み込みエラー: ${error}</p>`;
  }
}

function populateDateOptions(data) {
  const dateSet = new Set(data.map(d => d["日付"]));
  const select = document.getElementById("filter-date");

  select.innerHTML = '<option value="">すべて</option>'; // 初期化

  Array.from(dateSet)
    .sort((a, b) => new Date(b) - new Date(a)) // 新しい日付順
    .forEach(date => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      select.appendChild(option);
    });
}


// グラフ描画
function renderChart(data) {
  const ctx = document.getElementById("chart").getContext("2d");

  const labels = data.map(d => `${d["日付"]} ${d["時刻"].toString().padStart(2, '0')}:00`);
  const values = data.map(d => d["ランキング"]);

  if (chart) chart.destroy(); // 既存グラフ破棄

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

// 表描画
function renderTable(data) {
  const tableBody = document.getElementById("ranking-table-body");
  tableBody.innerHTML = "";

  const sorted = [...data].sort((a, b) => {
    const dtA = new Date(`${a["日付"]} ${a["時刻"]}:00`);
    const dtB = new Date(`${b["日付"]} ${b["時刻"]}:00`);
    return dtB - dtA; // 新しい順
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

// 絞り込みフィルタ
function applyFilters() {
  const dateInput = document.getElementById("filter-date").value;
  const weekday = document.getElementById("filter-weekday").value;

  // "2025-07-29" → "2025/07/29"
  const formattedDate = dateInput
    ? new Date(dateInput).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, "/")  // スラッシュ形式に変換
    : "";

  const filtered = rawData.filter(d =>
    (!formattedDate || d["日付"] === formattedDate) &&
    (!weekday || d["曜日"] === weekday)
  );

  renderChart(filtered);
  renderTable(filtered);
}

// 表とグラフの切り替えボタン
document.getElementById("btn-show-chart").onclick = () => {
  document.getElementById("chart-container").style.display = "block";
  document.getElementById("table-container").style.display = "none";
};

document.getElementById("btn-show-table").onclick = () => {
  document.getElementById("chart-container").style.display = "none";
  document.getElementById("table-container").style.display = "block";
};

document.getElementById("btn-apply-filters").onclick = applyFilters;

document.getElementById("btn-reset-filters").onclick = () => {
  document.getElementById("filter-date").value = "";
  document.getElementById("filter-weekday").value = "";
  renderChart(rawData);
  renderTable(rawData);
};


// 初回読み込み
window.onload = fetchData;

// データ更新時間を表示する関数
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

// ページ読み込み時に一度データ取得
window.onload = fetchData;

// 5分おき（300000ミリ秒）に自動更新
setInterval(fetchData, 300000);



