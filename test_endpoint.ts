import axios from 'axios';
axios.post('http://localhost:3000/api/admin/test-auto-trading', {
  uid: "123", pair: "EUR/USD", decision: "BUY", price: 100, 
  metaApiAccountId: "12345678", settings: { engineRunning: true, symbolSuffix: "" }
}).then(res => console.log(res.status, res.data)).catch(e => console.error(e.response?.status, e.response?.data || e.message));
