// import html2canvas from 'html2canvas';
import { useState } from 'preact/hooks';
import styles from './DailyLuckCard.module.less';
import { getFormatDate } from '@/utils/utils';
import { Divider, Tag } from 'antd';
import {
  luckThemes,
  luckQuotes,
  colors,
  zodiacSigns,
  directions,
  foods,
  objects,
  keywords,
  doThings,
  dontThings,
} from './luck_data';

const LOCAL_KEY = 'daily_luck_data';

/**
 * 从给定的只读数组中随机选择一个元素
 * @param arr - 一个只读数组，包含任何类型的元素
 * @returns 数组中的一个随机元素
 */
function getRandomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 从给定的数组中随机选择多个不重复的元素
 * @param arr - 一个数组，包含任何类型的元素
 * @param count - 要选择的元素数量
 * @returns 包含随机选择元素的新数组
 */
function getRandomItems<T>(arr: readonly T[], count = 3): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 生成每日幸运运势
 * @param date - 缓存键，自然日（yyyy-MM-dd）
 * @returns 包含每日幸运运势的对象
 */
function generateLuck(date: string) {
  const theme = getRandomItem<(typeof luckThemes)[number]>(luckThemes);
  return {
    date,
    number: Math.floor(Math.random() * 100),
    theme,
    quote: luckQuotes[theme],
    color: getRandomItem(colors),
    zodiac: getRandomItem(zodiacSigns),
    direction: getRandomItem(directions),
    food: getRandomItem(foods),
    object: getRandomItem(objects),
    keyword: getRandomItem(keywords),
    good: getRandomItems(doThings, 3),
    bad: getRandomItems(dontThings, 3),
  };
};

type LuckData = ReturnType<typeof generateLuck>;

const getTodayKey = () => getFormatDate('yyyy-MM-dd');

/**
 * 读取当日运势：同一自然日命中缓存直接复用，否则生成并落盘
 */
function readLuck(): LuckData {
  const today = getTodayKey();
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as LuckData;
      if (parsed?.date === today) return parsed;
    }
  } catch (e) {
    // 缓存损坏或不可用时忽略，重新生成
  }
  const newLuck = generateLuck(today);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(newLuck));
  } catch (e) {
    // 隐私模式等写入失败时不影响展示
  }
  return newLuck;
}

function DailyLuckCard() {
  const [luck] = useState<LuckData>(readLuck);
  // const cardRef = useRef<HTMLDivElement>(null);

  // const handleDownload = async () => {
  //   if (!cardRef.current) return;
  //   const canvas = await html2canvas(cardRef.current, {
  //     backgroundColor: null,
  //     useCORS: true,
  //   });
  //   const link = document.createElement('a');
  //   link.download = `今日运势_${luck.date}.png`;
  //   link.href = canvas.toDataURL('image/png');
  //   link.click();
  // };

  return (
    <div className={styles.cardWrapper}>
      <div className={styles.title}>{luck.theme}</div>
      <div className={styles.quote}>{luck.quote}</div>

      <Divider>幸运元素</Divider>
      <div className={styles.luckRow}>
        <span>幸运数字：</span>
        <Tag color="gold">{luck.number}</Tag>
      </div>
      <div className={styles.luckRow}>
        <span>幸运颜色：</span>
        <Tag color="purple">{luck.color}</Tag>
      </div>
      <div className={styles.luckRow}>
        <span>星座：</span>
        <Tag color="magenta">{luck.zodiac}</Tag>
      </div>
      <div className={styles.luckRow}>
        <span>方位：</span>
        <Tag color="cyan">{luck.direction}</Tag>
      </div>
      <div className={styles.luckRow}>
        <span>食物：</span>
        <Tag color="orange">{luck.food}</Tag>
      </div>
      <div className={styles.luckRow}>
        <span>物品：</span>
        <Tag color="blue">{luck.object}</Tag>
      </div>
      <div className={styles.luckRow}>
        <span>关键词：</span>
        <Tag color="lime">{luck.keyword}</Tag>
      </div>

      <Divider>今日宜忌</Divider>
      <div className={styles.luckRow}>
        ✅ 宜：
        {luck.good.map((item: string) => (
          <Tag color="green" key={item}>{item}</Tag>
        ))}
      </div>
      <div className={styles.luckRow}>
        ❌ 忌：
        {luck.bad.map((item: string) => (
          <Tag color="red" key={item}>{item}</Tag>
        ))}
      </div>
    </div>
  );
};

export default DailyLuckCard;
