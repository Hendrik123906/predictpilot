const { ProxyAgent, setGlobalDispatcher } = require("undici");
if (process.env.https_proxy) setGlobalDispatcher(new ProxyAgent(process.env.https_proxy));
