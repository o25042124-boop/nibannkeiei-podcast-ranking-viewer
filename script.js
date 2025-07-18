let rawData = [];
let chart; // Chart.js グラフ保持用

// データ取得と初期表示
async function fetchData() {
  try {
    const response = await fetch("data.json");
    rawData = await response.json();
    renderChart(rawData);
    renderTable(rawData);
  } catch (error) {
    document.getElementById("chart").innerHTML =
      `<p style="color:red;">データ読み込みエラー: ${error}</p>`;
  }
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
  const date = document.getElementById("filter-date").value;
  const weekday = document.getElementById("filter-weekday").value;

  const filtered = rawData.filter(d =>
    (!date || d["日付"] === date) &&
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

// 初回読み込み
window.onload = fetchData;
