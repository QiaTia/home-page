/**
 * Base64转文件
 * @param { string } payload 
 */
function Base64ToBlob (payload) {
  if(!/data:[\w\/-]+;base64/.test(payload)) throw '未找到文件MIME, 请检查内容!'; 
  const [ dataType, content ] = payload.split(',');
  const bstr = self.atob(content);
  let n = bstr.length;
  const u8arr = new Uint8Array(new ArrayBuffer(n)); // 创建初始化为0的，包含length个元素的无符号整型数组
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: dataType.match(/[\w\/-]+(?=;)/)[0] });
}
/**
 * String To Blob
 * @param { string } str 
 */
function StringToBlob (str) {
  let n = str.length;
  const u8arr = new Uint8Array(new ArrayBuffer(n)); // 创建初始化为0的，包含length个元素的无符号整型数组
  while (n--) {
    u8arr[n] = str.charCodeAt(n);
  }
  return new Blob([u8arr], { type: 'text/plain' });
}

/** 接收主线程发来的消息 */
self.onmessage = function (e) {
  const { payload, event } = e.data;
  console.log('Child process received task -> ', event);
  switch(event) {
    case 'ftob': {
      const reader = new FileReader();
      reader.onload = () => {
        const params = { event };
        if(payload.size >= 1024 * 1024 * 2) {
          params.event = 'btof';
          params.payload = StringToBlob( reader.result)
          params.notify = '文件体积过大, 自动生成文本文件!'
        }
        else params.payload = reader.result
        self.postMessage(params);
      };
      reader.onerror = error => self.postMessage({ error, event });
      reader.readAsDataURL(payload);
      break;
    }
    case 'btoa': {
      const param = { event };
      try{
        param.payload = self.btoa(payload);
      } catch (e) {
        param.error = e;
      }
      self.postMessage(param);
      break;
    }
    case 'atob': {
      const param = { event };
      try{
        param.payload = self.atob(self.decodeURIComponent(payload));
      } catch (e) {
        param.error = e;
      }
      self.postMessage(param);
      break;
    }
    case 'btof': {
      const param = { event };
      try{
        param.payload = Base64ToBlob(payload);
      } catch(e) {
        param.error = e;
      }
      self.postMessage(param);
      break;
    }
    default:{
      console.log(e.data);
      throw e.data;
    }
  }
};
