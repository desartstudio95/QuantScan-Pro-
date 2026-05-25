const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/metaapi/provision', {
      platform: 'mt4',
      login: '123456',
      password: 'mypassword',
      serverName: 'Broker-Server'
    });
    console.log("SUCCESS:", res.data);
  } catch (e) {
    console.log("ERROR:", e.response?.data || e.message);
  }
}
test();
