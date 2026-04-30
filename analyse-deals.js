// require('dotenv').config();
// const fs = require('fs');

// const SYSTEM_PROMPT = fs.readFileSync('prompts/deal-analysis.md', 'utf8');

// async function analyseDeals(deals) {
//   const res = await fetch('https://api.anthropic.com/v1/messages', {
//     method: 'POST',
//     headers: {
//       'x-api-key':        process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//       'content-type':     'application/json'
//     },
//     body: JSON.stringify({
//       model:      'claude-sonnet-4-20250514',
//       max_tokens: 8000,
//       system:     SYSTEM_PROMPT,
//       messages: [{
//         role:    'user',
//         content: `Analyse these Salesforce opportunities and return
// structured JSON intelligence:\n\n` + JSON.stringify(deals, null, 2)
//       }]
//     })
//   });

//   const data = await res.json();
//   if (res.status !== 200) throw new Error(`Claude API error: ${data.error?.message}`);

//   // Claude returns JSON inside a text block — parse it out
//   let text = data.content[0].text;
//   const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
//   if (jsonMatch) text = jsonMatch[1];
//   return JSON.parse(text);
// }

// async function main() {
//   const deals = JSON.parse(fs.readFileSync('output/sf-deals.json', 'utf8'));
//   console.log(`🤖 Sending ${deals.length} deals to Claude...`);

//   const analysis = await analyseDeals(deals);
//   console.log(`✅ Analysis complete: ${analysis.red_flags?.length} red flags`);

//   fs.writeFileSync('output/analysis.json', JSON.stringify(analysis, null, 2));
//   console.log('📁 Saved → output/analysis.json');
// }

// main().catch(e => { console.error(e.message); process.exit(1); });



require('dotenv').config();
const fs = require('fs');

const SYSTEM_PROMPT = fs.readFileSync('prompts/deal-analysis.md', 'utf8');

async function analyseDeals(deals) {
  const userPrompt = `Analyse these Salesforce opportunities and return structured JSON intelligence:\n\n${JSON.stringify(deals, null, 2)}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.3
    })
  });

  const data = await res.json();

  if (res.status !== 200) {
    throw new Error(`Groq API error: ${JSON.stringify(data)}`);
  }

  let text = data.choices[0].message.content;

  // Strip markdown fences if model wraps response in ```json ... ```
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) text = jsonMatch[1];

  const fenceMatch = text.match(/```\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1];

  return JSON.parse(text.trim());
}

async function main() {
  const deals = JSON.parse(fs.readFileSync('output/sf-deals.json', 'utf8'));

  console.log(`🤖 Sending ${deals.length} deals to Groq (llama-3.3-70b)...`);

  const analysis = await analyseDeals(deals);

  console.log(`✅ Analysis complete: ${analysis.red_flags?.length || 0} red flags found`);

  fs.writeFileSync('output/analysis.json', JSON.stringify(analysis, null, 2));
  console.log('📁 Saved → output/analysis.json');
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});