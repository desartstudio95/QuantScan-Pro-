import axios from 'axios';
axios.get("https://financialmodelingprep.com/api/v3/economic_calendar?from=2024-01-01&to=2024-01-10&apikey=e3143522be4c4aac89e1f9a39925ed80")
.then(r => console.log('FMP success', r.status, Object.keys(r.data[0] || {})))
.catch(e => console.log('FMP error', e.response?.status));
