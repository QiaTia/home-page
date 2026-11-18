// 等级考试词库索引与按需加载
// 词表数据来源：qwerty-learner 公开的 CET-4 / CET-6 词表（https://github.com/Kaiyiwing/qwerty-learner），清洗后按书拆分

export interface WordItem {
  /** 单词（小写字母） */
  w: string;
  /** 中文释义 */
  t: string;
  /** 美式音标 */
  p: string;
}

export interface BookMeta {
  key: string;
  /** 简称，如 CET-4 */
  short: string;
  /** 词库名称 */
  title: string;
  /** 简介 */
  desc: string;
  /** 词数 */
  count: number;
}

/** 词库索引：进入页面即可渲染，无需下载词表 */
export const books: BookMeta[] = [
  {
    key: 'CET4',
    short: 'CET-4',
    title: '大学英语四级词库',
    desc: 'CET-4 核心词汇，覆盖四级高频考点',
    count: 2602,
  },
  {
    key: 'CET6',
    short: 'CET-6',
    title: '大学英语六级词库',
    desc: 'CET-6 核心词汇，进阶阅读与写作',
    count: 2340,
  },
];

/** 词表按书动态加载，Vite 会拆成独立 chunk */
const loaders: Record<string, () => Promise<{ default: WordItem[] }>> = {
  CET4: () => import('./data/cet4.json'),
  CET6: () => import('./data/cet6.json'),
};

const cache = new Map<string, WordItem[]>();
const pending = new Map<string, Promise<WordItem[]>>();

/** 同步读取已加载的词表，命中时可直接渲染 */
export function getCachedBook(key: string): WordItem[] | undefined {
  return cache.get(key);
}

/** 加载指定词库，同一本书并发请求只会发起一次 */
export function loadBook(key: string): Promise<WordItem[]> {
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const load = loaders[key];
  if (!load) return Promise.reject(new Error(`未知词库：${key}`));

  const task = load()
    .then((mod) => {
      const words = mod.default;
      cache.set(key, words);
      pending.delete(key);
      return words;
    })
    .catch((error) => {
      pending.delete(key);
      throw error;
    });

  pending.set(key, task);
  return task;
}
