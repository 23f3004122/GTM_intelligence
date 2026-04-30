require('dotenv').config();
const fs = require('fs');
async function getSalesforceToken() {
  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET
  });

  const res = await fetch(
    `${process.env.SF_LOGIN_URL}/services/oauth2/token`,
    { method: 'POST', body: params }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`SF Auth failed: ${JSON.stringify(data)}`);
  return data;
}


async function fetchOpportunities(token, instanceUrl) {
  const soql = `SELECT Id, Name, AccountId, Account.Name, Amount,
    StageName, CloseDate, OwnerId, Owner.Name, NextStep,
    LastActivityDate, CreatedDate, Probability
    FROM Opportunity WHERE IsClosed = false
    ORDER BY Amount DESC NULLS LAST`;

  const url = `${instanceUrl}/services/data/v59.0/query?q=` +
    encodeURIComponent(soql);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.records;
}

async function main() {
  console.log('🔐 Authenticating with Salesforce...');
  const { access_token, instance_url } = await getSalesforceToken();
  console.log('✅ Auth success');

  const deals = await fetchOpportunities(access_token, instance_url);
  console.log(`✅ Fetched ${deals.length} open opportunities`);

  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync('output/sf-deals.json', JSON.stringify(deals, null, 2));
  console.log('📁 Saved → output/sf-deals.json');
}

main().catch(e => { console.error(e.message); process.exit(1); });