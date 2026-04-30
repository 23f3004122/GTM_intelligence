require('dotenv').config();
const fs = require('fs');

function generateReport(analysis) {
  const {
    pipeline_summary = {},
    red_flags = [],
    next_best_actions = [],
    data_quality = []
  } = analysis;

  const totalM = ((pipeline_summary.total_open_pipeline || 0) / 1e6).toFixed(1);
  const forecastM = ((pipeline_summary.weighted_forecast || 0) / 1e6).toFixed(1);
  const closingCount = pipeline_summary.closing_this_month || 0;
  const today = new Date().toDateString();

  // ── Red flag cards ──────────────────────────────────────────────
  const redFlagCards = red_flags.length
    ? red_flags.map(f => `
      <div class="card ${f.severity || 'low'}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span class="badge ${f.severity || 'low'}">${(f.severity || 'low').toUpperCase()}</span>
          <span class="flag-type">${(f.flag_type || '').replace(/_/g,' ')}</span>
        </div>
        <div class="deal-name">${f.deal_name || 'Unknown Deal'}</div>
        <div class="account">${f.account || ''}</div>
        <p class="explanation">${f.explanation || ''}</p>
      </div>`).join('')
    : '<p class="empty">No red flags detected ✅</p>';

  // ── Next best action cards ───────────────────────────────────────
  const actionCards = next_best_actions.length
    ? next_best_actions.map((a, i) => `
      <div class="action-card">
        <div class="action-num">${i + 1}</div>
        <div>
          <div class="deal-name">${a.deal_name || ''}</div>
          <div class="action-text">${a.action || ''}</div>
        </div>
      </div>`).join('')
    : '<p class="empty">No actions generated</p>';

  // ── Data quality rows ────────────────────────────────────────────
  const qualityRows = data_quality.length
    ? data_quality.map(d => {
        const score = d.score || 0;
        const color = score >= 80 ? '#3fb950' : score >= 50 ? '#f0883e' : '#f85149';
        return `
        <tr>
          <td>${d.deal_name || ''}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;background:#30363d;border-radius:4px;height:8px">
                <div style="width:${score}%;background:${color};height:8px;border-radius:4px"></div>
              </div>
              <span style="color:${color};font-weight:700;min-width:36px">${score}%</span>
            </div>
          </td>
          <td style="color:#8b949e">${(d.missing_fields || []).join(', ') || '—'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="3" style="text-align:center;color:#8b949e">No data quality issues</td></tr>';

  // ── Stage breakdown ──────────────────────────────────────────────
  const stageBreakdown = pipeline_summary.stage_breakdown
    ? Object.entries(pipeline_summary.stage_breakdown).map(([stage, count]) => `
        <div class="stage-row">
          <span class="stage-name">${stage}</span>
          <span class="stage-count">${count}</span>
        </div>`).join('')
    : '';

  // ── Top 5 deals ──────────────────────────────────────────────────
  const top5Rows = (pipeline_summary.top_5_deals || []).map(d => `
    <tr>
      <td>${d.name || ''}</td>
      <td>${d.account || ''}</td>
      <td style="color:#3fb950;font-weight:700">$${((d.amount || 0)/1000).toFixed(0)}K</td>
      <td><span class="stage-pill">${d.stage || ''}</span></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GTM Intelligence Report — ${today}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      line-height: 1.6;
      padding: 0;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #161b22 0%, #0d1117 100%);
      border-bottom: 1px solid #30363d;
      padding: 32px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header h1 { font-size: 24px; font-weight: 700; color: #e6edf3; }
    .header .date { font-size: 13px; color: #8b949e; margin-top: 4px; }
    .header .logo {
      background: #1f6feb;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 20px;
    }

    /* ── Layout ── */
    .container { max-width: 1100px; margin: 0 auto; padding: 32px 40px; }
    .section { margin-bottom: 40px; }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #e6edf3;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #21262d;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title .count {
      background: #21262d;
      color: #8b949e;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
    }

    /* ── Summary cards ── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 20px;
    }
    .summary-card .label { font-size: 12px; color: #8b949e; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; }
    .summary-card .value { font-size: 28px; font-weight: 700; color: #e6edf3; }
    .summary-card .sub { font-size: 12px; color: #8b949e; margin-top: 4px; }

    /* ── Red flag cards ── */
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 10px;
    }
    .card.high   { border-left: 4px solid #f85149; }
    .card.medium { border-left: 4px solid #f0883e; }
    .card.low    { border-left: 4px solid #3fb950; }

    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .badge.high   { background: #3d1a1a; color: #f85149; }
    .badge.medium { background: #3d2a1a; color: #f0883e; }
    .badge.low    { background: #1a3d1a; color: #3fb950; }

    .flag-type { font-size: 12px; color: #8b949e; text-transform: capitalize; }
    .deal-name { font-size: 14px; font-weight: 600; color: #e6edf3; margin-bottom: 2px; }
    .account   { font-size: 12px; color: #8b949e; margin-bottom: 6px; }
    .explanation { font-size: 13px; color: #c9d1d9; }

    /* ── Action cards ── */
    .action-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 8px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    .action-num {
      width: 28px; height: 28px;
      background: #1f6feb;
      color: #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .action-text { font-size: 13px; color: #c9d1d9; margin-top: 4px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      padding: 10px 14px;
      background: #161b22;
      color: #8b949e;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      border-bottom: 1px solid #30363d;
    }
    td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid #21262d;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #161b22; }

    /* ── Stage breakdown ── */
    .stage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .stage-row {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stage-name { font-size: 12px; color: #8b949e; }
    .stage-count { font-size: 18px; font-weight: 700; color: #e6edf3; }
    .stage-pill {
      background: #21262d;
      color: #8b949e;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .empty { color: #8b949e; font-size: 13px; padding: 12px 0; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding: 24px;
      color: #8b949e;
      font-size: 12px;
      border-top: 1px solid #21262d;
      margin-top: 40px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>🎯 GTM Intelligence Report</h1>
      <div class="date">Generated on ${today} · CloudColon Technologies</div>
    </div>
    <div class="logo">Powered by AI</div>
  </div>

  <div class="container">

    <!-- ── Summary ── -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Total Pipeline</div>
        <div class="value">$${totalM}M</div>
        <div class="sub">All open opportunities</div>
      </div>
      <div class="summary-card">
        <div class="label">Weighted Forecast</div>
        <div class="value">$${forecastM}M</div>
        <div class="sub">Probability-adjusted</div>
      </div>
      <div class="summary-card">
        <div class="label">Closing This Month</div>
        <div class="value">${closingCount}</div>
        <div class="sub">Deals due within 30 days</div>
      </div>
      <div class="summary-card">
        <div class="label">Red Flags</div>
        <div class="value" style="color:#f85149">${red_flags.length}</div>
        <div class="sub">Deals needing attention</div>
      </div>
    </div>

    <!-- ── Stage Breakdown ── -->
    ${stageBreakdown ? `
    <div class="section">
      <div class="section-title">📊 Pipeline by Stage</div>
      <div class="stage-grid">${stageBreakdown}</div>
    </div>` : ''}

    <!-- ── Top 5 Deals ── -->
    ${top5Rows ? `
    <div class="section">
      <div class="section-title">💰 Top Deals</div>
      <table>
        <thead>
          <tr>
            <th>Deal Name</th><th>Account</th><th>Amount</th><th>Stage</th>
          </tr>
        </thead>
        <tbody>${top5Rows}</tbody>
      </table>
    </div>` : ''}

    <!-- ── Red Flags ── -->
    <div class="section">
      <div class="section-title">
        🚨 Red Flags
        <span class="count">${red_flags.length}</span>
      </div>
      ${redFlagCards}
    </div>

    <!-- ── Next Best Actions ── -->
    <div class="section">
      <div class="section-title">
        ⚡ Next Best Actions
        <span class="count">${next_best_actions.length}</span>
      </div>
      ${actionCards}
    </div>

    <!-- ── Data Quality ── -->
    <div class="section">
      <div class="section-title">
        📋 Data Quality
        <span class="count">${data_quality.length}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Deal Name</th><th>Quality Score</th><th>Missing Fields</th>
          </tr>
        </thead>
        <tbody>${qualityRows}</tbody>
      </table>
    </div>

  </div>

  <div class="footer">
    GTM Intelligence · Generated ${today} · CloudColon Technologies
  </div>

</body>
</html>`;
}

async function main() {
  const analysis = JSON.parse(fs.readFileSync('output/analysis.json', 'utf8'));
  const html = generateReport(analysis);
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync('output/report.html', html);
  console.log('📄 Report generated → output/report.html');
}

main().catch(e => { console.error(e.message); process.exit(1); });