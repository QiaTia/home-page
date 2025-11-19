import http from "axios-fetch-mini";

http.defaults.baseUrl = 'https://tia.deno.dev';
http.interceptors.response.use(({ data })=> data, e => e);

export default http;

// export default fetch;