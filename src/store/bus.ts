type Fn<T> = (data: T) => void;

export type defaultBusEvent = { ev: 'paste'; type: string; payload: string | File };

class TiaBus<T = defaultBusEvent> {
  private fn = new Set<Fn<T>>();
  subscribe(callback: Fn<T>) {
    // 订阅
    this.fn.add(callback);
  }
  publish(data: T) {
    // 发布
    this.fn.forEach((fn) => fn(data));
  }
  unsubscribe(cb: Fn<T>) {
    // 取消订阅
    this.fn.delete(cb);
  }
}
export default new TiaBus();
