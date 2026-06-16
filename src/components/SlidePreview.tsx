import type { Slide } from './PresentationGenerator';

export function SlidePreview({ slide }: { slide: Slide }) {
  return (
    <article className="slide-preview">
      <div className="slide-number">slide</div>
      <h2>{slide.title}</h2>
      <ul>
        {slide.bullets.map((bullet, index) => (
          <li key={`${bullet}-${index}`}>{bullet}</li>
        ))}
      </ul>
      <aside>
        <span>Заметка</span>
        <p>{slide.speakerNote}</p>
      </aside>
    </article>
  );
}
