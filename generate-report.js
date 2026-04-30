require('dotenv').config();
const fs = require('fs');

function generateReport(analysis) {
  const { pipeline_summary, red_flags, next_best_actions, data_quality } = analysis;

  const redFlagCards = red_flags.map(f => `
    <div class="card ${f.severity}">
      <div class="flag-type">${f.flag_type}</div>
      <div class="deal-name">${f.deal_name}</div>
      <div class="account">${f.account}</div>
      <p class="explanation">${f.explanation}</p>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>GTM Intelligence Report</title>
  <style>
    body { background: #0d1117; color: #e6edf3; font-family: system-ui; }
    .card { background: #161b22; border-radius: 10px; padding: 16px; margin: 10px 0; }
    .high { border-left: 4px solid #f85149; }
    .medium { border-left: 4px solid #f0883e; }
    .low { border-left: 4px solid #3fb950; }
    /* ... add full CSS here ... */
  </style>
</head>
<body>
  <h1>GTM Intelligence — ${new Date().toDateString()}</h1>
  <section id="pipeline">
    <h2>Pipeline Summary</h2>
    <div>Total: $${(pipeline_summary.total_open_pipeline/1e6).toFixed(1)}M</div>
  </section>
  <section id="red-flags">
    <h2>Red Flags (${red_flags.length})</h2>
    ${redFlagCards}
  </section>
</body></html>`;
}

const analysis = JSON.parse(fs.readFileSync('output/analysis.json', 'utf8'));
const html = generateReport(analysis);
fs.writeFileSync('output/report.html', html);
console.log('📄 Report generated → output/report.html');