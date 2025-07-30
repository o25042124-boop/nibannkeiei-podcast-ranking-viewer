document.addEventListener("DOMContentLoaded", function () {
  const chartContainer = document.getElementById("chart-container");
  const tableContainer = document.getElementById("table-container");
  const btnChart = document.getElementById("btn-show-chart");
  const btnTable = document.getElementById("btn-show-table");
  const filterDate = document.getElementById("filter-date");
  const filterWeekday = document.getElementById("filter-weekday");
  const btnApply = document.getElementById("btn-apply-filters");
  const btnReset = document.getElementById("btn-reset-filters");
  const lastUpdated = document.getElementById("last-updated");

  let originalData = [];

  fetch("data.json")
    .then((res) => res.json())
    .then((data) => {
      originalData = data;
      populateDateFilter(data);
      drawChart(data);
      populateTable(data);
      updateLastUpdated();
    });

  function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = "最終更新日時: " + now.toLocaleString();
  }

  function populateDateFilter(data) {
    const dates = [...new Set(data.map((d) => d["日付"]))];
    dates.sort();
    filterDate.innerHTML = '<option value="">すべて</option>' + dates.map((d) => `<option value="${d}">${d}</option>`).join("");
  }

  function filterData() {
    const selectedDate = filterDate.value;
    const selectedWeekday = filterWeekday.value;
    return originalData.filter((item) => {
      return (!selectedDate || item["日付"] === selectedDate) &&
             (!selectedWeekday || item["曜日"] === selectedWeekday);
    });
  }

  btnApply.addEventListener("click", () => {
    const filtered = filterData();
    drawChart(filtered);
    populateTable(filtered);
  });

  btnReset.addEventListener("click", () => {
    filterDate.value = "";
    filterWeekday.value = "";
    drawChart(originalData);
    populateTable(originalData);
  });

  btnChart.addEventListener("click", () => {
    chartContainer.style.display = "block";
    tableContainer.style.display = "none";
  });

  btnTable.addEventListener("click", () => {
    chartContainer.style.display = "none";
    tableContainer.style.display = "block";
  });

  function drawChart(data) {
    if (window.chartInstance) window.chartInstance.destroy();
    const ctx = document.getElementById("chart").getContext("2d");
    const labels = data.map((d) => d["時刻"] + " " + d["日付"]);
    const values = data.map((d) => d["ランキング"]);
    window.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "ランキング",
          data: values,
          fill: false,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            reverse: true,
            beginAtZero: false
          }
        }
      }
    });
  }

  function populateTable(data) {
    const tbody = document.getElementById("ranking-table-body");
    tbody.innerHTML = "";
    data.forEach((d) => {
      const row = document.createElement("tr");
      ["日付", "曜日", "時刻", "ランキング"].forEach((key) => {
        const cell = document.createElement("td");
        cell.textContent = d[key];
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  }
});
