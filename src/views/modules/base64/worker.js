/** 接收主线程发来的消息 */
self.onmessage = function (e) {
  console.log('子线程接收到数据-->>：', e);
  const reader = new FileReader();
  reader.onload = () => postMessage(reader.result);
  reader.onerror = error => postMessage(error);
  reader.readAsDataURL(e.data);
  console.log(reader);
}
