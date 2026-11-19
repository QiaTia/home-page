import http from "axios-fetch-mini";

http.defaults.baseUrl = 'https://tia.deno.dev';
// 错误必须继续抛出，返回 e 会把失败变成 resolve，调用方拿到 Error 后渲染会崩溃
http.interceptors.response.use(({ data }) => data, e => Promise.reject(e));

export default http;

// export default fetch;