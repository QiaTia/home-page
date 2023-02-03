import imageTiny from './image-tiny';

/** 接收主线程发来的消息 */
self.onmessage = function (e) {
  const { payload, event } = e.data;
  console.log('Child process received task -> ', event);
  imageTiny(payload.file)
    .then(file => {
      payload.file = file;
      self.postMessage(payload);
    }).catch(error => {
      delete payload.file;
      payload.error = error;
      self.postMessage(payload);
    });
}