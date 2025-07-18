let rawData = [];
let chart; // Chart.jsインスタンス保持

async function fetchData() {
  try {
    const response = await fetch("data.json");
    rawData = await response.json();
    renderChart(rawData);
    renderTable(rawData);
  } catch (error) {
    document.getElementById("chart").innerHTML = `<p style="color:red;">データ読み込みエラー: ${error}</p>`;
  }
}

function renderChart(data) {
  const ctx = document.getElementById("chart").getContext("2d");

  // 日付+時刻を横軸ラベルに
  const labels = data.map(d => `${d["日付"]} ${d["時刻"]}`);

  // ランキング（順位）をプロット
  const values = data.map(d => d["ランキング"]);

  // グラフインスタンスがあれば削除
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "ランキング",
        data: values,
        fill: false,
        borderColor: "blue",
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          reverse: true, // 1位が上に来るように
          title: { display: true, text: "ランキング" },
          ticks: { stepSize: 1 }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderTable(data) {
  const tableBody = document.getElementById("ranking-table-body");
  tableBody.innerHTML = "";

  // 新しい順に表示
  const sorted = [...data].sort((a, b) => {
    const dtA = new Date(`${a["日付"]} ${a["時刻"]}`);
    const dtB = new Date(`${b["日付"]} ${b["時刻"]}`);
    return dtB - dtA;
  });

  for (const item of sorted) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item["日付"]}</td>
      <td>${item["曜日"]}</td>
      <td>${item["時刻"]}</td>
      <td>${item["ランキング"]}</td>
    `;
    tableBody.appendChild(row);
  }
}

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

document.getElementById("btn-show-chart").onclick = () => {
  document.getElementById("chart-container").style.display = "block";
  document.getElementById("table-container").style.display = "none";
};
document.getElementById("btn-show-table").onclick = () => {
  document.getElementById("chart-container").style.display = "none";
  document.getElementById("table-container").style.display = "block";
};
document.getElementById("btn-apply-filters").onclick = applyFilters;

// ページ読み込み時にデータ取得
window.onload = fetchData;
