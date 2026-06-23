// api/health.js
const { CLIENT_ID, CLIENT_SECRET, REGION, ACCOUNT_ID } = require('../lib/aps');

module.exports = async (req, res) => {
  res.json({
    ok: true,
    hasCreds: Boolean(CLIENT_ID && CLIENT_SECRET),
    region: REGION,
    accountId: ACCOUNT_ID
  });
};
