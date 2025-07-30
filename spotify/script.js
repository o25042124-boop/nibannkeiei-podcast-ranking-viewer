fetch('data.json')
  .then(response => response.json())
  .then(data => {
    const labels = data.map(d => `${d["日付"]} ${d["時刻"]}:00`);
    const values = data.map(d => d["ランキング"]);
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'ランキング',
          data: values,
          borderWidth: 2
        }]
      },
      options: {
        scales: {
          y: { reverse: true, beginAtZero: false, title: { display: true, text: '順位' } },
          x: { title: { display: true, text: '日時' } }
        }
      }
    });
  });