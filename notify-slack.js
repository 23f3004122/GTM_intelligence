require('dotenv').config();
const fs = require('fs');

async function postSlackMessage(analysis) {
  const { pipeline_summary, red_flags } = analysis;
  const blocks = [
    { type: "header", text: { type: "plain_text",
        text: `🎯 GTM Intelligence — ${new Date().toDateString()}` }},
    { type: "section", fields: [
      { type: "mrkdwn", text: `*Total Pipeline*\n$${(pipeline_summary.total_open_pipeline/1e6).toFixed(1)}M` },
      { type: "mrkdwn", text: `*Weighted Forecast*\n$${(pipeline_summary.weighted_forecast/1e6).toFixed(1)}M` },
      { type: "mrkdwn", text: `*Red Flags*\n${red_flags.length} deals need attention` },
      { type: "mrkdwn", text: `*Closing This Month*\n${pipeline_summary.closing_this_month} deals` }
    ]},
    { type: "divider" }
  ];

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ channel: process.env.SLACK_CHANNEL_ID, blocks })
  });
  const data = await res.json();
  return data.ts; // message timestamp — use for threaded file reply
}
async function uploadReportFile(messageTs) {
  const fileContent = fs.readFileSync('output/report.html');
  const fileSize = Buffer.byteLength(fileContent); // ✅ use Buffer.byteLength, not statSync

  // Step 1: Get upload URL — must be form-encoded, not JSON
  const urlRes = await fetch('https://slack.com/api/files.getUploadURLExternal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded' // ✅ fix: was application/json
    },
    body: new URLSearchParams({
      filename: 'gtm-report.html',
      length: String(fileSize)  // ✅ must be a string-encoded integer
    })
  });

  const urlData = await urlRes.json();

  if (!urlData.ok) {
    throw new Error(`files.getUploadURLExternal failed: ${urlData.error}`);
  }

  const { upload_url, file_id } = urlData;

  // Step 2: Upload file content
  const uploadRes = await fetch(upload_url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: fileContent
  });

  if (!uploadRes.ok) {
    throw new Error(`File upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  // Step 3: Complete upload — this one is fine as JSON
  const completeRes = await fetch('https://slack.com/api/files.completeUploadExternal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: [{ id: file_id }],
      channel_id: process.env.SLACK_CHANNEL_ID,
      thread_ts: messageTs
    })
  });

  const completeData = await completeRes.json();
  if (!completeData.ok) {
    throw new Error(`files.completeUploadExternal failed: ${completeData.error}`);
  }

  console.log('✅ File uploaded successfully');
}

async function main() {
  const analysis = JSON.parse(fs.readFileSync('output/analysis.json', 'utf8'));
  const ts = await postSlackMessage(analysis);
  await uploadReportFile(ts);
  console.log('✅ Slack notification sent');
}
main().catch(e => { console.error(e.message); process.exit(1); });