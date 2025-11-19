// import html2canvas from 'html2canvas';
import { useEffect, useState } from 'preact/hooks';
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
 * @returns 包含每日幸运运势的对象
 */
function generateLuck() {
  const theme = getRandomItem<(typeof luckThemes)[number]>(luckThemes);
  return {
    date: getFormatDate('yyyy年MM月dd日'),
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

function DailyLuckCard() {
  const [luck, setLuck] = useState(generateLuck());
  // const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = getFormatDate('YYYY年M月D日');
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        setLuck(parsed);
        return;
      }
    }
    const newLuck = generateLuck();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(newLuck));
    setLuck(newLuck);
  }, []);

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
