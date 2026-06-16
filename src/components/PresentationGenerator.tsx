import { useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SlidePreview } from './SlidePreview';

export type Slide = {
  title: string;
  bullets: string[];
  speakerNote: string;
};

type AiResponse = {
  text?: string;
  error?: string;
};

const systemPrompt = [
  'Ты создаешь короткие учебные презентации на русском языке.',
  'Верни только валидный JSON без markdown.',
  'Формат: {"title":"...","subtitle":"...","slides":[{"title":"...","bullets":["..."],"speakerNote":"..."}]}',
  'Сделай 5-7 слайдов. На каждом слайде 3-4 коротких пункта.',
].join(' ');

function makeFallbackPresentation(topic: string) {
  const cleanTopic = topic || 'Новая тема';
  return {
    title: cleanTopic,
    subtitle: 'Черновик презентации',
    slides: [
      {
        title: 'Главная идея',
        bullets: [
          `Что такое ${cleanTopic}`,
          'Почему тема важна для аудитории',
          'Какую проблему помогает понять',
        ],
        speakerNote: 'Начни с простого объяснения темы и задай аудитории вопрос.',
      },
      {
        title: 'Контекст',
        bullets: [
          'Где эта тема встречается в жизни',
          'Какие есть примеры',
          'Кому это может быть полезно',
        ],
        speakerNote: 'Покажи связь темы с реальными ситуациями.',
      },
      {
        title: 'Ключевые факты',
        bullets: [
          'Факт 1: самый понятный тезис',
          'Факт 2: важная деталь',
          'Факт 3: вывод из примеров',
        ],
        speakerNote: 'Говори коротко и поясняй каждый факт одним примером.',
      },
      {
        title: 'План действий',
        bullets: [
          'Шаг 1: изучить основу',
          'Шаг 2: разобрать пример',
          'Шаг 3: сделать мини-проект',
        ],
        speakerNote: 'Предложи аудитории простой путь, что делать дальше.',
      },
      {
        title: 'Итог',
        bullets: [
          'Главный вывод презентации',
          'Что стоит запомнить',
          'Вопрос для обсуждения',
        ],
        speakerNote: 'Заверши презентацию сильным выводом и вопросом.',
      },
    ],
  };
}

function parsePresentation(text: string, topic: string) {
  const cleaned = text
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  const fallback = makeFallbackPresentation(topic);

  return {
    title: String(parsed.title || fallback.title),
    subtitle: String(parsed.subtitle || fallback.subtitle),
    slides: Array.isArray(parsed.slides) && parsed.slides.length > 0
      ? parsed.slides.map((slide: Partial<Slide>) => ({
          title: String(slide.title || 'Слайд'),
          bullets: Array.isArray(slide.bullets)
            ? slide.bullets.slice(0, 5).map(String)
            : ['Ключевая мысль', 'Пример', 'Вывод'],
          speakerNote: String(slide.speakerNote || 'Расскажи этот слайд своими словами.'),
        }))
      : fallback.slides,
  };
}

function buildHtml(title: string, subtitle: string, slides: Slide[]) {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(title)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #101828; color: #f8fafc; }
    section { min-height: 100vh; display: grid; align-content: center; gap: 22px; padding: 8vw; page-break-after: always; }
    h1 { font-size: clamp(44px, 8vw, 96px); margin: 0; }
    h2 { font-size: clamp(34px, 6vw, 72px); margin: 0; }
    p, li { font-size: clamp(22px, 3vw, 34px); line-height: 1.35; }
    ul { display: grid; gap: 16px; }
    .note { color: #98a2b3; font-size: 18px; margin-top: 28px; }
  </style>
</head>
<body>
  <section><h1>${escape(title)}</h1><p>${escape(subtitle)}</p></section>
  ${slides.map((slide) => `<section><h2>${escape(slide.title)}</h2><ul>${slide.bullets.map((bullet) => `<li>${escape(bullet)}</li>`).join('')}</ul><p class="note">${escape(slide.speakerNote)}</p></section>`).join('')}
</body>
</html>`;
}

export function PresentationGenerator() {
  const [topic, setTopic] = useState('Как искусственный интеллект помогает школьникам');
  const [audience, setAudience] = useState('школьники 12-15 лет');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [presentation, setPresentation] = useState(() => makeFallbackPresentation(topic));

  const currentSlide = presentation.slides[activeSlide] ?? presentation.slides[0];
  const totalSlides = presentation.slides.length;

  const prompt = useMemo(() => [
    `Тема: ${topic}`,
    `Аудитория: ${audience}`,
    'Стиль: современно, понятно, без слишком длинных предложений.',
    'Добавь практичные примеры и заметки для выступающего.',
  ].join('\n'), [audience, topic]);

  async function generatePresentation(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || busy) return;

    setBusy(true);
    setError('');

    if (!isSupabaseConfigured) {
      setPresentation(makeFallbackPresentation(topic.trim()));
      setActiveSlide(0);
      setError('Supabase ключи пока не настроены. Показан черновик без AI.');
      setBusy(false);
      return;
    }

    const { data, error: invokeError } = await supabase.functions.invoke<AiResponse>('ai', {
      body: { prompt, system: systemPrompt },
    });

    try {
      if (invokeError || data?.error || !data?.text) {
        throw new Error(invokeError?.message || data?.error || 'AI пока недоступен');
      }

      const nextPresentation = parsePresentation(data.text, topic.trim());
      setPresentation(nextPresentation);
      setActiveSlide(0);
    } catch (caughtError) {
      setPresentation(makeFallbackPresentation(topic.trim()));
      setActiveSlide(0);
      setError(`${caughtError instanceof Error ? caughtError.message : 'AI пока недоступен'}. Показан черновик без AI.`);
    } finally {
      setBusy(false);
    }
  }

  function downloadHtml() {
    const html = buildHtml(presentation.title, presentation.subtitle, presentation.slides);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${presentation.title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-') || 'presentation'}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <section className="builder-panel">
        <div className="brand">
          <span>AI Slides</span>
          <h1>Генератор презентаций</h1>
          <p>Напиши тему, выбери аудиторию и получи готовую структуру слайдов.</p>
        </div>

        <form className="prompt-form" onSubmit={generatePresentation}>
          <label>
            Тема презентации
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder="Например: история космоса, экология города, стартап для школы"
            />
          </label>

          <label>
            Для кого
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Например: ученики 7 класса"
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={busy || !topic.trim()}>
              {busy ? 'Генерирую...' : 'Создать презентацию'}
            </button>
            <button type="button" className="secondary" onClick={downloadHtml}>
              Скачать HTML
            </button>
          </div>
        </form>

        {error && <p className="message">{error}</p>}

        <div className="slide-list" aria-label="Список слайдов">
          {presentation.slides.map((slide, index) => (
            <button
              type="button"
              className={index === activeSlide ? 'slide-tab active' : 'slide-tab'}
              key={`${slide.title}-${index}`}
              onClick={() => setActiveSlide(index)}
            >
              <span>{index + 1}</span>
              {slide.title}
            </button>
          ))}
        </div>
      </section>

      <section className="preview-panel">
        <div className="preview-header">
          <div>
            <p>{presentation.title}</p>
            <strong>{presentation.subtitle}</strong>
          </div>
          <span>{activeSlide + 1} / {totalSlides}</span>
        </div>

        <SlidePreview slide={currentSlide} />
      </section>
    </main>
  );
}
