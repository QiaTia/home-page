import http from "axios-fetch-mini";

http.defaults.baseUrl = 'https://api.qiatia.cn';
http.interceptors.response.use(({ data })=> data, e => e);

export default http;

// export default fetch;