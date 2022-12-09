import http from "./request";

/** 获取网购之家数据 */ 
export const getWgList = () => http.get<API.wgListItemProps[]>("/list")

/** 获取张大妈列表数据 */ 
export const getZdmList = (filter?: string) => http.get("/zdm", { filter })

/** 获得文字内容 */ 
export const getArticle = (id: number) => http.get("/api/article/" + id)

/** 获得文字列表 */ 
export const getArticleList = (page = 1) => http.get("/api/article/all?page=" + page)

/**  随机一句英语句子 */ 
 export const getDsapi = () => http.get<API.sentenceProps>("/tia/dsapi")

/** 随机一个英语单词 */ 
export const getRandomDict = (num = 1) => http.get<API.PageResult<API.wordsProps[]>>("/dc/random", { num })

/** get单词列表 */ 
export const getDcList = (data = {}) => http.get("/dc/list", data)

/** 单词分类表 */ 
export const getCateList = (data = {}) => http.get("/dc/cate", data)

/** 随机一个题目 */ 
export const getRandomExam = (num = 1) => http.get(`/exam/rand/${ num }`)