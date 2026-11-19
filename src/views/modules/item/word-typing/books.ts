// 等级考试词库索引与按需加载
// 词表数据来源：qwerty-learner 公开的 CET-4 / CET-6 词表（https://github.com/Kaiyiwing/qwerty-learner），清洗后按书拆分
// 高中词库来源：人教版高中英语教材词表，按册拆分

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
  {
    key: 'GZ-B1',
    short: '高中必修一',
    title: '人教版高中英语必修第一册',
    desc: 'Welcome Unit 至 Unit 5，含课标词与短语',
    count: 383,
  },
  {
    key: 'GZ-B2',
    short: '高中必修二',
    title: '人教版高中英语必修第二册',
    desc: 'Unit 1 至 Unit 5，含课标词与短语',
    count: 401,
  },
  {
    key: 'GZ-B3',
    short: '高中必修三',
    title: '人教版高中英语必修第三册',
    desc: 'Unit 1 至 Unit 5，含课标词与短语',
    count: 471,
  },
  {
    key: 'GZ-X1',
    short: '高中选必一',
    title: '人教版高中英语选择性必修第一册',
    desc: 'Unit 1 至 Unit 5，含课标词与短语',
    count: 386,
  },
  {
    key: 'GZ-X2',
    short: '高中选必二',
    title: '人教版高中英语选择性必修第二册',
    desc: 'Unit 1 至 Unit 5，含课标词与短语',
    count: 389,
  },
  {
    key: 'GZ-X3',
    short: '高中选必三',
    title: '人教版高中英语选择性必修第三册',
    desc: 'Unit 1 至 Unit 5，含课标词与短语',
    count: 355,
  },
  {
    key: 'GZ-X4',
    short: '高中选必四',
    title: '人教版高中英语选择性必修第四册',
    desc: 'Unit 1 至 Unit 5，含课标词与短语',
    count: 339,
  },
];

/** 词表按书动态加载，Vite 会拆成独立 chunk */
const loaders: Record<string, () => Promise<{ default: WordItem[] }>> = {
  CET4: () => import('./data/cet4.json'),
  CET6: () => import('./data/cet6.json'),
  'GZ-B1': () => import('./data/gz1.json'),
  'GZ-B2': () => import('./data/gz2.json'),
  'GZ-B3': () => import('./data/gz3.json'),
  'GZ-X1': () => import('./data/gz4.json'),
  'GZ-X2': () => import('./data/gz5.json'),
  'GZ-X3': () => import('./data/gz6.json'),
  'GZ-X4': () => import('./data/gz7.json'),
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
