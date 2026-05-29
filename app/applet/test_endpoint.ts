import axios from 'axios';
axios.post('http://127.0.0.1:3000/api/admin/test-auto-trading', {
  uid: "123", pair: "EUR/USD", decision: "BUY", price: 100
}).then(res => console.log(res.data)).catch(e => console.error(e.response?.data || e.message));
