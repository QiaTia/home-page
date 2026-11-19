import classNames from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { books, getCachedBook, loadBook, type WordItem } from './books';
import './index.less';

/** 每章单词数 */
const WORDS_PER_CHAPTER = 20;

/** 判断是否为需要参与输入的字符键（字母、空格、连字符、撇号、句点，兼容短语） */
function isTypingKey(e: KeyboardEvent) {
  return /^[a-zA-Z .'\-]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/** 朗读单词（美音） */
function speak(word: string) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** 秒数格式化为 mm:ss */
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** 按固定数量切分章节 */
function chunkWords<T>(list: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size));
  return result;
}

/** 按教材自然章节切分；没有章节信息时按固定词数切分 */
function buildChapters(list: WordItem[]) {
  if (!list.some((item) => item.c)) return chunkWords(list, WORDS_PER_CHAPTER);
  const result: WordItem[][] = [];
  let current: WordItem[] = [];
  let name: string | undefined;
  for (const item of list) {
    const unit = item.c ?? '其他';
    if (current.length > 0 && unit !== name) {
      result.push(current);
      current = [];
    }
    name = unit;
    current.push(item);
  }
  if (current.length > 0) result.push(current);
  return result;
}

/** 章节数量，按索引中的词数推算，无需加载词表 */
function chapterCountOf(book: { count: number; chapters?: number }) {
  return book.chapters ?? Math.ceil(book.count / WORDS_PER_CHAPTER);
}

/** 指定章节的词数 */
function chapterSizeOf(book: { count: number }, chapterIndex: number) {
  return Math.min(WORDS_PER_CHAPTER, book.count - chapterIndex * WORDS_PER_CHAPTER);
}

/** 词库分类 */
type BookGroup = 'cet' | 'gz';

interface PickerProps {
  bookIndex: number;
  chapterIndex: number;
  onConfirm: (book: number, chapter: number) => void;
  onClose: () => void;
}

/** 词库与章节选择面板 */
function BookPicker({ bookIndex, chapterIndex, onConfirm, onClose }: PickerProps) {
  const [activeBook, setActiveBook] = useState(bookIndex);
  const [activeChapter, setActiveChapter] = useState(chapterIndex);
  const [group, setGroup] = useState<BookGroup>(books[bookIndex].group);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const book = books[activeBook];
  const chapterCount = chapterCountOf(book);
  /** 当前分类下的书目，索引仍指向全局数组，便于回传 */
  const visibleBooks = books
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.group === group);

  /** 切换分类时自动选中该分类的第一本书 */
  function switchGroup(next: BookGroup) {
    if (next === group) return;
    setGroup(next);
    const first = books.findIndex((item) => item.group === next);
    if (first >= 0) {
      setActiveBook(first);
      setActiveChapter(0);
    }
  }

  /** 选中书籍后滚动到底部的章节区域，省去手动下滑 */
  function scrollToChapters() {
    requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (body) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
    });
  }

  /** 打开后把焦点移入弹窗，便于键盘与读屏操作 */
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  /** 将 Tab 焦点限制在弹窗内 */
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button');
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div class="wt-picker-mask" onClick={onClose}>
      <div
        class="wt-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wt-picker-title"
        tabIndex={-1}
        ref={panelRef}
        onKeyDown={trapFocus}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="wt-picker-head">
          <div>
            <h3 id="wt-picker-title">选择词库</h3>
            <p>选择考试词库与章节，开始本轮练习</p>
          </div>
          <button class="wt-icon-btn muted" title="关闭" aria-label="关闭" onClick={onClose}>
            <svg viewBox="0 0 24 24">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" />
            </svg>
          </button>
        </header>

        <div class="wt-picker-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={group === 'cet'}
            class={classNames(group === 'cet' && 'active')}
            onClick={() => switchGroup('cet')}
          >
            大学英语
          </button>
          <button
            role="tab"
            aria-selected={group === 'gz'}
            class={classNames(group === 'gz' && 'active')}
            onClick={() => switchGroup('gz')}
          >
            高中英语（人教版）
          </button>
        </div>

        <div class="wt-picker-body" ref={bodyRef}>
        <div class="wt-books">
          {visibleBooks.map(({ item, index }) => {
            const active = index === activeBook;
            return (
              <button
                key={item.key}
                class={classNames('wt-book', active && 'active')}
                aria-pressed={active}
                onClick={() => {
                  setActiveBook(index);
                  setActiveChapter(0);
                  scrollToChapters();
                }}
              >
                <div class="wt-book-top">
                  <strong>{item.short}</strong>
                  <span class="wt-book-check">
                    {active && (
                      <svg viewBox="0 0 24 24">
                        <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z" />
                      </svg>
                    )}
                  </span>
                </div>
                <p class="wt-book-title">{item.title}</p>
                <div class="wt-book-bottom">
                  <span>{item.count} 词</span>
                  <svg class="wt-book-icon" viewBox="0 0 48 40">
                    <rect x="4" y="12" width="7" height="24" rx="2" fill="#c9c8f5" />
                    <rect x="15" y="6" width="7" height="30" rx="2" fill="#f2c9b8" />
                    <rect x="26" y="16" width="7" height="20" rx="2" fill="#bfe3cd" />
                    <rect x="37" y="9" width="7" height="27" rx="2" fill="#d8d4ef" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        <div class="wt-chapters-head">
          <span>选择章节</span>
          <span>
            共 {chapterCount} 章
            {book.chapters ? '' : ` · 每章 ${WORDS_PER_CHAPTER} 词`}
          </span>
        </div>

        <div class="wt-chapter-grid">
          {Array.from({ length: chapterCount }, (_, index) => (
            <button
              key={index}
              class={classNames('wt-chapter-item', index === activeChapter && 'active')}
              aria-pressed={index === activeChapter}
              onClick={() => setActiveChapter(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
        </div>

        <footer class="wt-picker-foot">
          <button class="wt-btn ghost" onClick={onClose}>
            取消
          </button>
          <button class="wt-btn" onClick={() => onConfirm(activeBook, activeChapter)}>
            开始练习
          </button>
        </footer>
      </div>
    </div>
  );
}

/** 进度本地存储的键名 */
const STORAGE_KEY = 'word-typing-progress';

interface SavedProgress {
  book: number;
  chapter: number;
  word: number;
  correct: number;
  total: number;
  elapsed: number;
}

/** 数值限制在 [min, max] 区间 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** 读取本地保存的练习进度 */
function readProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedProgress>;
    if (!data || typeof data !== 'object') return null;
    const fields = ['book', 'chapter', 'word', 'correct', 'total', 'elapsed'] as const;
    if (fields.some((key) => !Number.isFinite(data[key]))) return null;
    /** 统计值统一取整并保证非负，避免脏数据渲染出异常时间 */
    const toCount = (value: number | undefined) => Math.max(0, Math.floor(value ?? 0));
    const correct = toCount(data.correct);
    return {
      book: toCount(data.book),
      chapter: toCount(data.chapter),
      word: toCount(data.word),
      correct,
      total: Math.max(correct, toCount(data.total)),
      elapsed: toCount(data.elapsed),
    };
  } catch {
    return null;
  }
}

export default function WordTyping() {
  /** 首次渲染时读取本地进度，并校正到词库/章节的有效范围 */
  const [initial] = useState(() => {
    const saved = readProgress();
    const book = clamp(saved?.book ?? 0, 0, books.length - 1);
    const chapter = clamp(saved?.chapter ?? 0, 0, chapterCountOf(books[book]) - 1);
    const word = clamp(saved?.word ?? 0, 0, chapterSizeOf(books[book], chapter) - 1);
    return { saved, book, chapter, word };
  });
  const [bookIndex, setBookIndex] = useState(initial.book);
  const [chapterIndex, setChapterIndex] = useState(initial.chapter);
  const [wordIndex, setWordIndex] = useState(initial.word);
  /** 当前单词已正确输入的字符 */
  const [input, setInput] = useState('');
  /** 输错时对应的单词字母下标，短暂标红后恢复 */
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  /** 自增触发抖动动画重放 */
  const [shakeKey, setShakeKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(initial.saved?.elapsed ?? 0);
  const [stats, setStats] = useState({
    correct: initial.saved?.correct ?? 0,
    total: initial.saved?.total ?? 0,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  /** 已加载的词表及其所属词库，未加载完成时为 null */
  const [wordBook, setWordBook] = useState<{ key: string; list: WordItem[] } | null>(() => {
    const key = books[initial.book].key;
    const cached = getCachedBook(key);
    return cached ? { key, list: cached } : null;
  });
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    wordBook ? 'ready' : 'loading'
  );
  const [reloadKey, setReloadKey] = useState(0);

  const errorTimer = useRef<number | undefined>(undefined);
  const book = books[bookIndex];
  /** 只有词表与当前词库一致时才视为可用，切换词库瞬间不会闪现旧词 */
  const words = wordBook?.key === book.key ? wordBook.list : null;
  const chapters = useMemo(() => (words ? buildChapters(words) : []), [words]);
  const chapter = chapters[chapterIndex] ?? chapters[0];
  const word = chapter?.[wordIndex];
  const prevWord = chapter ? chapter[(wordIndex - 1 + chapter.length) % chapter.length] : undefined;
  const nextWord = chapter ? chapter[(wordIndex + 1) % chapter.length] : undefined;

  /** 暂停、打开词库弹窗时停止计时 */
  useEffect(() => {
    if (!started || paused || pickerOpen) return;
    const timer = window.setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, paused, pickerOpen]);

  useEffect(() => () => window.clearTimeout(errorTimer.current), []);

  /** 练习进度变化时自动保存到本地 */
  useEffect(() => {
    try {
      const progress: SavedProgress = {
        book: bookIndex,
        chapter: chapterIndex,
        word: wordIndex,
        correct: stats.correct,
        total: stats.total,
        elapsed,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      // 隐私模式等场景写入失败时忽略
    }
  }, [bookIndex, chapterIndex, wordIndex, stats.correct, stats.total, elapsed]);

  /** 按需加载当前词库的词表 */
  useEffect(() => {
    const key = books[bookIndex].key;
    const cached = getCachedBook(key);
    if (cached) {
      setWordBook({ key, list: cached });
      setLoadState('ready');
      return;
    }

    let alive = true;
    setWordBook(null);
    setLoadState('loading');
    loadBook(key)
      .then((list) => {
        if (!alive) return;
        setWordBook({ key, list });
        setLoadState('ready');
      })
      .catch(() => {
        if (alive) setLoadState('error');
      });

    return () => {
      alive = false;
    };
  }, [bookIndex, reloadKey]);

  /** 词表加载后校正章节与单词下标，避免存档超出实际范围 */
  useEffect(() => {
    if (chapters.length === 0) return;
    const safeChapter = Math.min(chapterIndex, chapters.length - 1);
    const safeWord = Math.min(wordIndex, chapters[safeChapter].length - 1);
    if (safeChapter !== chapterIndex || safeWord !== wordIndex) {
      setChapterIndex(safeChapter);
      setWordIndex(safeWord);
      // 下标被校正后, 旧的输入进度已不对应当前单词, 一并清空
      setInput('');
      setErrorIndex(null);
    }
  }, [chapters, chapterIndex, wordIndex]);

  /** 切换到相邻单词，清空当前进度；越过章节边界时自动切换章节 */
  function moveWord(offset: number) {
    if (!chapter) return;
    const nextIndex = wordIndex + offset;
    if (nextIndex >= 0 && nextIndex < chapter.length) {
      setWordIndex(nextIndex);
    } else if (chapters.length <= 1) {
      // 只有一章时在章内循环
      setWordIndex((nextIndex + chapter.length) % chapter.length);
    } else {
      const targetChapter =
        (chapterIndex + (offset > 0 ? 1 : -1) + chapters.length) % chapters.length;
      setChapterIndex(targetChapter);
      setWordIndex(offset > 0 ? 0 : chapters[targetChapter].length - 1);
    }
    setInput('');
    setErrorIndex(null);
  }

  /** 重置本轮练习数据 */
  function resetSession() {
    setWordIndex(0);
    setInput('');
    setErrorIndex(null);
    setStats({ correct: 0, total: 0 });
    setElapsed(0);
    setStarted(false);
    setPaused(false);
  }

  /** 应用词库与章节选择 */
  function applySelection(nextBook: number, nextChapter: number) {
    setBookIndex(nextBook);
    setChapterIndex(nextChapter);
    setPickerOpen(false);
    resetSession();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (pickerOpen) {
        if (e.key === 'Escape') setPickerOpen(false);
        return;
      }
      if (!word) return;
      if (!isTypingKey(e)) return;
      e.preventDefault();
      if (!started) setStarted(true);
      if (paused) return;

      const key = e.key.toLowerCase();
      const expected = word.w[input.length];
      const isCorrect = key === expected;

      setStats((s) => ({
        total: s.total + 1,
        correct: s.correct + (isCorrect ? 1 : 0),
      }));

      if (isCorrect) {
        // 正确键入时清除上一次的报错标记，避免红字盖住已输入正确的字母
        setErrorIndex(null);
        window.clearTimeout(errorTimer.current);
        const next = input + key;
        if (next.length === word.w.length) moveWord(1);
        else setInput(next);
        return;
      }

      // 输错：清空单词进度，标红出错位置的字母并左右抖动（单词本身不变）
      setErrorIndex(input.length);
      setInput('');
      setShakeKey((k) => k + 1);
      window.clearTimeout(errorTimer.current);
      errorTimer.current = window.setTimeout(() => setErrorIndex(null), 450);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [word, input, started, paused, pickerOpen]);

  const minutes = elapsed / 60;
  const wpm = minutes > 0 ? Math.round(stats.correct / 5 / minutes) : 0;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const progress = word ? Math.round((input.length / word.w.length) * 100) : 0;

  return (
    <div class="wt-page">
      <div class="wt-shell">
        <header class="wt-topbar">
          <button class="wt-chapter" onClick={() => setPickerOpen(true)}>
            {book.short} · {chapter?.[0]?.c ?? `第 ${chapterIndex + 1} 章`}
            <svg class="wt-chevron" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          <span class="wt-accent">美音</span>
          <button
            class="wt-icon-btn"
            title="朗读单词"
            disabled={!word}
            onClick={() => word && speak(word.w)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
            </svg>
          </button>

          <div class="wt-actions">
            <button
              class={classNames('wt-btn', (started || paused) && 'ghost')}
              disabled={!word}
              onClick={() => {
                if (!started) {
                  setStarted(true);
                  setPaused(false);
                } else {
                  setPaused((p) => !p);
                }
              }}
            >
              {!started ? 'Start' : paused ? '继续' : 'Pause'}
            </button>
            <button class="wt-btn skip" disabled={!word} onClick={() => moveWord(1)}>
              Skip
            </button>
          </div>
        </header>

        <main class="wt-stage">
          {word ? (
            <>
              <aside class="wt-side prev">
                <span class="arrow">←</span>
                <div class="wt-side-body">
                  <div class="wt-side-word">{prevWord?.w ?? ''}</div>
                  <div class="wt-side-trans">{prevWord?.t ?? ''}</div>
                </div>
              </aside>

              <section class="wt-center">
                <div class={classNames('wt-word', errorIndex !== null && 'is-error')} key={shakeKey}>
                  {word.w.split('').map((char, index) => (
                    <span
                      key={index}
                      class={classNames(
                        'wt-char',
                        char === ' ' && 'space',
                        index < input.length && 'done',
                        index === errorIndex && 'wrong'
                      )}
                    >
                      {char}
                    </span>
                  ))}
                  <button class="wt-icon-btn" title="朗读" onClick={() => speak(word.w)}>
                    <svg viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
                    </svg>
                  </button>
                </div>
                {word.p && <div class="wt-phonetic">AmE: [{word.p}]</div>}
                <div class="wt-trans">{word.t}</div>
                <div class="wt-tools">
                  <button class="wt-icon-btn" title="重新朗读" onClick={() => speak(word.w)}>
                    <svg viewBox="0 0 24 24">
                      <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
                    </svg>
                  </button>
                  <button class="wt-icon-btn" title="换一个" onClick={() => moveWord(1)}>
                    <svg viewBox="0 0 24 24">
                      <path d="M7.5 5.6 3 12l4.5 6.4 1.6-1.1L5.5 12l3.6-5.3-1.6-1.1zm9 0-1.6 1.1L18.5 12l-3.6 5.3 1.6 1.1L21 12l-4.5-6.4zM12 3h-2l3 18h2l-3-18z" />
                    </svg>
                  </button>
                </div>
                <div class="wt-progress">
                  <i style={{ width: `${progress}%` }} />
                </div>

                {!started && (
                  <div class="wt-mask" onClick={() => setStarted(true)}>
                    按任意键继续
                  </div>
                )}
              </section>

              <aside class="wt-side next">
                <div class="wt-side-body">
                  <div class="wt-side-word">{nextWord?.w ?? ''}</div>
                  <div class="wt-side-trans">{nextWord?.t ?? ''}</div>
                </div>
                <span class="arrow">→</span>
              </aside>
            </>
          ) : (
            <section class="wt-center wt-loading" aria-busy={loadState === 'loading'}>
              {loadState === 'error' ? (
                <div class="wt-load-error" role="alert">
                  <p>词库加载失败，请检查网络后重试</p>
                  <button class="wt-btn" onClick={() => setReloadKey((key) => key + 1)}>
                    重试
                  </button>
                </div>
              ) : (
                <div class="wt-loading-box">
                  <span class="wt-loading-text">词库加载中…</span>
                  <span class="wt-loading-bar" />
                </div>
              )}
            </section>
          )}
        </main>

        <footer class="wt-stats">
          <div class="wt-stat">
            <strong>{formatTime(elapsed)}</strong>
            <span>时间</span>
          </div>
          <div class="wt-stat">
            <strong>{stats.total}</strong>
            <span>输入数</span>
          </div>
          <div class="wt-stat">
            <strong>{wpm}</strong>
            <span>WPM</span>
          </div>
          <div class="wt-stat">
            <strong>{stats.correct}</strong>
            <span>正确数</span>
          </div>
          <div class="wt-stat">
            <strong>{accuracy}</strong>
            <span>正确率</span>
          </div>
        </footer>
      </div>

      {pickerOpen && (
        <BookPicker
          bookIndex={bookIndex}
          chapterIndex={chapterIndex}
          onConfirm={applySelection}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
