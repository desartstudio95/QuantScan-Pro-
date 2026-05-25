import { createRequire } from "module";
const require = createRequire(import.meta.url);
const metaApiPkg = require("metaapi.cloud-sdk");
const MetaApi = typeof metaApiPkg === "function" ? metaApiPkg : metaApiPkg.default || metaApiPkg;
async function test() {
  try {
    const api = new MetaApi('fake_token_123');
    await api.metatraderAccountApi.createAccount({
      name: 'Test',
      login: '123123',
      password: 'password',
      server: 'Server-1',
      platform: 'mt4',
      magic: 1000
    });
  } catch (err) {
    console.log("Error details:", err.message, err.response?.data || err.details || err);
  }
}
test();
