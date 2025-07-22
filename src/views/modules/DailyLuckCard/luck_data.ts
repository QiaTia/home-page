// src/utils/luckData.ts

export const luckThemes = ['关系运', '财运', '事业运', '健康运', '桃花运'] as const;

export const luckQuotes: Record<(typeof luckThemes)[number], string> = {
  '关系运': '信任度上升，适合建立关系或请求帮助。',
  '财运': '有意外收获机会，注意小财运。',
  '事业运': '适合提出计划或推进项目，容易被看见。',
  '健康运': '适合锻炼、调整作息，注意饮食。',
  '桃花运': '易受欢迎，适合社交与表白。',
};

export const colors = ['红色', '蓝色', '紫色', '绿色', '黄色'] as const;
export const zodiacSigns = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座'] as const;
export const directions = ['正东', '西北', '东南', '正北', '东微南'] as const;
export const foods = ['口香糖', '咖啡', '抹茶', '酸奶', '饼干'] as const;
export const objects = ['手表', '笔记本', '钥匙扣', '香水', '背包'] as const;
export const keywords = ['低调', '专注', '放松', '自律', '灵感'] as const;
export const doThings = ['写计划', '见朋友', '补钙', '整理房间', '阅读', '看电影', '运动', '学习', '睡觉', '工作'] as const;
export const dontThings = ['迟到', '争执', '分心', '舞弊', '焦虑', '不开心', '不喜欢'] as const;
