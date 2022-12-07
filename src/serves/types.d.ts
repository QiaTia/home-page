declare namespace API {
  type RequestResult<T> = {
    data: T;
    code: number;
    msg?: string;
  };
  type PageResult<T> = {
    data: T;
    count: number;
    page?: number | string;
    page_size?: number | string;
  };
  /** 随机句子 */

  type sentenceProps = { content: string; note: string };
  /** 随机单词 */

  type wordsProps = {
    k: string;
    v: string;
    cate_name: string;
  };
}
