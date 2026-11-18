import classNames from 'classnames';
import { useEffect, useRef, useState } from 'preact/hooks';
import { chapters } from './word_bank';
import './index.less';

/** 判断是否为需要参与输入的字母键 */
function isLetterKey(e: KeyboardEvent) {
  return /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey;
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

export default function WordTyping() {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  /** 当前单词已正确输入的字符 */
  const [input, setInput] = useState('');
  /** 输错时对应的单词字母下标，短暂标红后恢复 */
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  /** 自增触发抖动动画重放 */
  const [shakeKey, setShakeKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const errorTimer = useRef<number | undefined>(undefined);
  const chapter = chapters[chapterIndex];
  const word = chapter.words[wordIndex];
  const prevWord = chapter.words[wordIndex - 1];
  const nextWord = chapter.words[(wordIndex + 1) % chapter.words.length];

  /** 暂停或切换章节时停止计时 */
  useEffect(() => {
    if (!started || paused) return;
    const timer = window.setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, paused]);

  useEffect(() => () => window.clearTimeout(errorTimer.current), []);

  /** 切换到相邻单词，清空当前进度 */
  function moveWord(offset: number) {
    setWordIndex((i) => (i + offset + chapter.words.length) % chapter.words.length);
    setInput('');
    setErrorIndex(null);
  }

  /** 切换章节，重置本次练习数据 */
  function changeChapter(index: number) {
    setChapterIndex(index);
    setWordIndex(0);
    setInput('');
    setErrorIndex(null);
    setStats({ correct: 0, total: 0 });
    setElapsed(0);
    setStarted(false);
    setPaused(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isLetterKey(e)) return;
      if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
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
  }, [word, input, started, paused, chapterIndex]);

  const minutes = elapsed / 60;
  const wpm = minutes > 0 ? Math.round(stats.correct / 5 / minutes) : 0;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const progress = Math.round((input.length / word.w.length) * 100);

  return (
    <div class="wt-page">
      <div class="wt-shell">
        <header class="wt-topbar">
          <select
            class="wt-chapter"
            value={chapterIndex}
            onChange={(e) => changeChapter(Number((e.target as HTMLSelectElement).value))}
          >
            {chapters.map((item, index) => (
              <option key={index} value={index}>
                {item.level} {item.name}
              </option>
            ))}
          </select>
          <span class="wt-accent">美音</span>
          <button class="wt-icon-btn" title="朗读单词" onClick={() => speak(word.w)}>
            <svg viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
            </svg>
          </button>

          <div class="wt-actions">
            <button
              class={classNames('wt-btn', (started || paused) && 'ghost')}
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
            <button class="wt-btn skip" onClick={() => moveWord(1)}>
              Skip
            </button>
          </div>
        </header>

        <main class="wt-stage">
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
            <div class="wt-phonetic">AmE: [{word.p}]</div>
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
              <div class="wt-side-word">{nextWord.w}</div>
              <div class="wt-side-trans">{nextWord.t}</div>
            </div>
            <span class="arrow">→</span>
          </aside>
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
    </div>
  );
}
