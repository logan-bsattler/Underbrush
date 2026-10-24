import type { JSX } from 'preact';
import { content } from '../core';
import type { SpeciesArt, Stage, Substrate } from '../core';

const INK = '#1F2A1C';

/** One shared set of SVG filters; mounted once at the app root. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="wc" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.35" />
        </filter>
        <filter id="wash" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.6" />
        </filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="11" />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.16  0 0 0 0 0.1  0 0 0 0.09 0" />
        </filter>
      </defs>
    </svg>
  );
}

type G = JSX.Element;
const line = { stroke: INK, strokeOpacity: 0.55, strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function stem(a: SpeciesArt, x = 50, top = 58, w = 9, bottom = 90): G {
  return (
    <path
      d={`M${x - w / 2} ${top} Q${x - w / 2 - 2} ${bottom - 12} ${x - w / 2 - 3} ${bottom} L${x + w / 2 + 3} ${bottom} Q${x + w / 2 + 2} ${bottom - 12} ${x + w / 2} ${top} Z`}
      fill={a.stem}
      {...line}
    />
  );
}

function shapeFor(id: string, a: SpeciesArt): G {
  switch (a.shape) {
    case 'cap':
      return (
        <g>
          {stem(a, 50, 56, 11)}
          <path d="M16 60 Q18 26 50 24 Q82 26 84 60 Q50 67 16 60 Z" fill={a.cap} {...line} />
          <path d="M62 30 Q80 36 82 58 Q74 61 68 61 Q72 42 62 30 Z" fill={a.shade} opacity="0.55" />
          <path d="M20 60 Q50 70 80 60 Q50 64 20 60 Z" fill={a.gill} {...line} />
          {id === 'shiitake' &&
            [
              [34, 38],
              [48, 33],
              [60, 40],
              [40, 50],
              [70, 49],
              [27, 52],
            ].map(([x, y]) => <ellipse cx={x} cy={y} rx="3.2" ry="1.6" fill="#F1E6CC" opacity="0.85" />)}
          {a.gloss && <path d="M30 36 Q42 28 56 30" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />}
          {id === 'winecap' && <path d="M43 70 Q50 74 57 70" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.4" />}
        </g>
      );
    case 'bolete':
      return (
        <g>
          <path d="M38 56 Q30 76 36 90 L64 90 Q70 76 62 56 Z" fill={a.stem} {...line} />
          <path d="M40 66 L60 66 M39 74 L61 74 M38 82 L62 82" stroke={a.shade} strokeOpacity="0.25" strokeWidth="1" />
          <path d="M14 58 Q16 24 50 22 Q84 24 86 58 Q50 64 14 58 Z" fill={a.cap} {...line} />
          <path d="M18 58 Q50 66 82 58 Q50 61 18 58 Z" fill={a.gill} {...line} />
          <path d="M60 28 Q80 34 82 54 Q72 57 66 57 Q70 40 60 28 Z" fill={a.shade} opacity="0.5" />
        </g>
      );
    case 'shelf': {
      const fan = (dx: number, dy: number, s: number, k: number) => (
        <g transform={`translate(${dx} ${dy}) scale(${s})`} key={k}>
          <path d="M14 50 Q22 22 62 24 Q90 30 86 48 Q62 60 14 50 Z" fill={a.cap} {...line} />
          <path d="M60 26 Q86 32 84 47 Q74 51 66 52 Q72 38 60 26 Z" fill={a.shade} opacity="0.5" />
          {[28, 40, 52, 64, 74].map((x) => (
            <path d={`M16 50 Q${x - 6} 52 ${x} ${54 - (x > 60 ? 4 : 0)}`} fill="none" stroke={a.shade} strokeOpacity="0.5" strokeWidth="1" />
          ))}
          {a.fringe &&
            [30, 40, 50, 60, 70].map((x) => <path d={`M${x} 53 l1 6`} stroke={INK} strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />)}
        </g>
      );
      return (
        <g>
          <path d="M6 8 Q2 50 6 94 L18 94 Q14 50 17 8 Z" fill="#7A5A3C" {...line} />
          <path d="M9 16 l1 10 M12 40 l-1 12 M9 64 l1 12" stroke="#4F3A26" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
          {fan(4, 34, 0.95, 3)}
          {fan(6, 16, 0.85, 2)}
          {fan(8, 0, 0.72, 1)}
        </g>
      );
    }
    case 'ball':
      return (
        <g>
          <path d="M28 86 Q20 60 34 44 Q50 30 68 42 Q82 58 72 86 Q50 92 28 86 Z" fill={a.cap} {...line} />
          <path d="M60 42 Q78 54 72 84 Q66 86 60 87 Q72 62 60 42 Z" fill={a.shade} opacity="0.55" />
          {[
            [40, 52],
            [50, 46],
            [46, 62],
            [58, 56],
            [38, 70],
            [55, 72],
          ].map(([x, y]) => <circle cx={x} cy={y} r="1.3" fill={a.shade} opacity="0.7" />)}
          <path d="M30 86 Q50 92 70 86" fill="none" stroke="#6E8B4E" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case 'tooth':
      return (
        <g>
          <path d="M18 46 Q22 18 50 18 Q78 18 82 46 Q76 52 50 52 Q24 52 18 46 Z" fill={a.cap} {...line} />
          {Array.from({ length: 12 }, (_, i) => {
            const x = 22 + i * 5.2;
            const len = 22 + ((i * 7) % 5) * 5;
            return <path d={`M${x} 46 Q${x + 1} ${46 + len / 2} ${x - 0.5} ${46 + len}`} fill="none" stroke={a.shade} strokeWidth="3.2" strokeLinecap="round" />;
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const x = 22 + i * 5.2;
            const len = 22 + ((i * 7) % 5) * 5;
            return <path d={`M${x} 46 Q${x + 1} ${46 + len / 2} ${x - 0.5} ${46 + len}`} fill="none" stroke={a.cap} strokeWidth="2" strokeLinecap="round" />;
          })}
          <path d="M8 90 L92 90" stroke="#8C6A4A" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case 'kidney':
      return (
        <g>
          <path d="M44 66 Q42 80 40 90 L52 90 Q52 78 54 66 Z" fill={a.stem} {...line} />
          <path d="M12 54 Q14 22 52 20 Q88 22 88 50 Q80 68 52 68 Q24 70 12 54 Z" fill={a.cap} {...line} />
          <path d="M20 54 Q22 32 52 30 Q80 32 80 50 Q72 62 52 62 Q28 62 20 54 Z" fill="none" stroke={a.gill} strokeOpacity="0.55" strokeWidth="2" />
          <path d="M14 56 Q30 68 52 68 Q76 68 86 54" fill="none" stroke={a.gill} strokeWidth="3" strokeOpacity="0.9" />
          <path d="M30 32 Q44 25 60 27" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'cluster':
      return (
        <g>
          {[
            [32, 44, 0.8, -8],
            [52, 34, 1, 2],
            [68, 48, 0.85, 10],
            [44, 56, 0.7, -3],
          ].map(([x, y, s, r]) => (
            <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
              <path d={`M-3 6 Q-4 ${(90 - y) / s / 2} -5 ${(90 - y) / s} L5 ${(90 - y) / s} Q4 ${(90 - y) / s / 2} 3 6 Z`} fill={a.stem} {...line} />
              <path d="M-14 8 Q-13 -8 0 -9 Q13 -8 14 8 Q0 12 -14 8 Z" fill={a.cap} {...line} />
              <path d="M4 -7 Q13 -4 13 7 Q8 9 6 9 Q9 0 4 -7 Z" fill={a.shade} opacity="0.5" />
            </g>
          ))}
        </g>
      );
    case 'funnel':
      return (
        <g>
          <path d="M42 60 Q40 78 42 90 L58 90 Q60 78 58 60 Z" fill={a.stem} {...line} />
          <path d="M14 34 Q24 26 34 32 Q44 24 52 30 Q62 22 72 30 Q82 26 88 34 Q72 58 58 62 L42 62 Q26 58 14 34 Z" fill={a.cap} {...line} />
          {[30, 38, 46, 54, 62, 70].map((x) => (
            <path d={`M${x} ${38 + Math.abs(x - 50) / 4} Q${50 + (x - 50) * 0.4} 56 ${50 + (x - 50) * 0.18} 78`} fill="none" stroke={a.shade} strokeOpacity="0.6" strokeWidth="1.1" />
          ))}
          <path d="M18 35 Q50 44 84 35" fill="none" stroke={a.shade} strokeOpacity="0.6" strokeWidth="1.5" />
        </g>
      );
    case 'morel':
      return (
        <g>
          <path d="M40 62 Q36 78 38 90 L62 90 Q64 78 60 62 Z" fill={a.stem} {...line} />
          <path d="M50 10 Q70 20 70 44 Q70 60 62 66 L38 66 Q30 60 30 44 Q30 20 50 10 Z" fill={a.cap} {...line} />
          {[
            [42, 26],
            [56, 24],
            [38, 38],
            [50, 36],
            [62, 38],
            [42, 50],
            [56, 50],
            [48, 60],
            [36, 56],
            [63, 58],
          ].map(([x, y]) => (
            <ellipse cx={x} cy={y} rx="4" ry="5.5" fill={a.shade} opacity="0.75" />
          ))}
        </g>
      );
  }
}

export function Mushroom({ species, size = 64, title }: { species: string; size?: number; title?: string }) {
  const def = content.species[species];
  return (
    <svg class="mush" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? def.name}>
      <ellipse cx="50" cy="91" rx="34" ry="5" fill={def.art.shade} opacity="0.18" filter="url(#wash)" />
      <g filter="url(#wc)">{shapeFor(species, def.art)}</g>
    </svg>
  );
}

/** An unidentified specimen: a muted silhouette in its lookalike group's colors. A lookalike drops the "?" for a dull rust wash. */
export function Unknown({ species, size = 56, lookalike }: { species: string; size?: number; lookalike?: boolean }) {
  const def = content.species[species];
  const muted: SpeciesArt = lookalike
    ? { ...def.art, cap: '#B59A7E', shade: '#7E6650', gill: '#D9C8AE', stem: '#CDBBA0' }
    : { ...def.art, cap: '#CFC6B0', shade: '#A99F86', gill: '#E7DFCB', stem: '#DDD3BD' };
  return (
    <svg class="mush unknown" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={lookalike ? def.lookalike?.name : def.group}>
      <g filter="url(#wc)">{shapeFor('', muted)}</g>
      {!lookalike && (
        <text x="50" y="62" text-anchor="middle" font-family="Alegreya, serif" font-weight="800" font-size="34" fill={INK} opacity="0.7">
          ?
        </text>
      )}
    </svg>
  );
}

export const substrateColors: Record<Substrate, string> = {
  log: '#8C6A4A',
  straw: '#D9B95B',
  woodchip: '#B97A45',
  compost: '#5E4632',
};

export function SubstrateArt({ substrate, size = 100 }: { substrate: Substrate | null; size?: number }) {
  return (
    <svg class="sub-art" width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {substrate === null && (
        <g opacity="0.8">
          {[
            [20, 30],
            [70, 22],
            [40, 70],
            [80, 76],
            [14, 82],
          ].map(([x, y]) => (
            <path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -9 M${x} ${y} l3 -7`} stroke="#7E9A5E" strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </g>
      )}
      {substrate === 'log' && (
        <g filter="url(#wc)">
          <rect x="8" y="58" width="80" height="26" rx="12" fill="#8C6A4A" {...line} />
          <path d="M14 64 Q40 60 80 66 M14 76 Q44 72 82 78" stroke="#5E4632" strokeOpacity="0.5" fill="none" strokeWidth="1.3" />
          <ellipse cx="86" cy="71" rx="8" ry="13" fill="#C9A77E" {...line} />
          <ellipse cx="86" cy="71" rx="4" ry="7" fill="none" stroke="#8C6A4A" strokeWidth="1.2" />
        </g>
      )}
      {substrate === 'straw' && (
        <g filter="url(#wc)">
          <rect x="10" y="56" width="80" height="30" rx="5" fill="#E2C46A" {...line} />
          {Array.from({ length: 14 }, (_, i) => (
            <path d={`M${14 + i * 5.5} 58 l${(i % 3) - 1} 26`} stroke="#A9862F" strokeOpacity="0.55" strokeWidth="1" />
          ))}
          <path d="M10 66 H90 M10 76 H90" stroke="#8E6A2A" strokeWidth="1.6" strokeOpacity="0.6" />
        </g>
      )}
      {substrate === 'woodchip' && (
        <g filter="url(#wc)">
          <path d="M6 88 Q20 58 50 56 Q80 58 94 88 Z" fill="#C98C55" {...line} />
          {[
            [24, 78, 20],
            [40, 68, -15],
            [58, 74, 35],
            [72, 82, -30],
            [48, 84, 10],
            [34, 86, 60],
            [64, 64, -50],
          ].map(([x, y, r]) => (
            <rect x={x - 5} y={y - 2} width="10" height="4" rx="1.5" fill="#8E5A2E" transform={`rotate(${r} ${x} ${y})`} />
          ))}
        </g>
      )}
      {substrate === 'compost' && (
        <g filter="url(#wc)">
          <path d="M6 88 Q22 54 50 52 Q78 54 94 88 Z" fill="#5E4632" {...line} />
          {[
            [30, 74],
            [46, 64],
            [62, 72],
            [52, 82],
            [74, 80],
            [22, 84],
          ].map(([x, y]) => (
            <circle cx={x} cy={y} r="2" fill="#A68A5B" opacity="0.8" />
          ))}
          <path d="M40 60 q4 -6 8 0" stroke="#7E9A5E" strokeWidth="1.6" fill="none" />
        </g>
      )}
    </svg>
  );
}

export function TreeArt() {
  return (
    <svg class="tree-art" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="92" rx="30" ry="5" fill="#3E6B35" opacity="0.2" filter="url(#wash)" />
      <g filter="url(#wc)">
        <path d="M44 92 L46 58 L54 58 L56 92 Z" fill="#7A5A3C" {...line} />
        <path d="M50 8 Q76 14 80 38 Q88 50 76 62 Q62 72 50 66 Q36 72 24 62 Q12 50 20 38 Q24 14 50 8 Z" fill="#6E8B4E" {...line} />
        <path d="M58 16 Q76 22 78 40 Q84 52 74 60 Q66 64 60 62 Q72 44 58 16 Z" fill="#3E6B35" opacity="0.45" />
      </g>
    </svg>
  );
}

/** How a bed looks at each growth stage, layered on its substrate. */
export function BedArt({ species, stage }: { species: string; stage: Stage }) {
  if (stage === 'S')
    return (
      <svg class="stage-art" viewBox="0 0 100 100" aria-hidden="true">
        {[
          [30, 62],
          [44, 58],
          [58, 64],
          [70, 60],
          [38, 70],
          [64, 70],
          [50, 66],
        ].map(([x, y]) => (
          <circle cx={x} cy={y} r="2.6" fill="#FFFDF6" stroke={INK} strokeOpacity="0.4" strokeWidth="0.8" />
        ))}
      </svg>
    );
  const threads = (
    <g opacity={stage === 'C' ? 0.95 : 0.6}>
      {['M14 66 Q30 58 46 66 T84 62', 'M18 74 Q36 68 52 76 T86 72', 'M24 60 Q40 70 60 60 T80 68'].map((d) => (
        <path d={d} fill="none" stroke="#FFFDF6" strokeWidth="2.2" strokeLinecap="round" />
      ))}
    </g>
  );
  return (
    <div class={`stage-wrap stage-${stage}`}>
      <svg class="stage-art" viewBox="0 0 100 100" aria-hidden="true">
        {threads}
      </svg>
      {stage !== 'C' && (
        <div class="stage-mush">
          <Mushroom species={species} size={100} />
        </div>
      )}
    </div>
  );
}

// ── Small icons ──────────────────────────────────────────────────────────

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, class: 'icon' };
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'coin':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" fill="#E2B64B" stroke="#8A6414" strokeWidth="1.6" />
          <path d="M12 7.5 Q15 10 12 16.5 Q9 10 12 7.5 Z" fill="#8A6414" opacity="0.7" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...p}>
          <path d="M5 19 Q4 6 19 5 Q20 18 5 19 Z" fill="currentColor" />
          <path d="M5 19 L13 11" stroke="#F6F1E4" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'clear':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4.5" fill="#E9B949" stroke="#9A6A14" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" {...s} stroke="#9A6A14" />
        </svg>
      );
    case 'rain':
      return (
        <svg {...p}>
          <path d="M6 14 Q3 14 3 11 Q3 8 6.5 8 Q8 4 12 4.5 Q16 5 16.5 8.5 Q21 8.5 21 11.5 Q21 14 18 14 Z" fill="#C7D6DE" stroke="#4A6878" strokeWidth="1.5" />
          <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" {...s} stroke="#3C6E8C" />
        </svg>
      );
    case 'dryspell':
      return (
        <svg {...p}>
          <circle cx="12" cy="9" r="4" fill="#E58E3A" stroke="#9A4E16" />
          <path d="M3 19h18M6 19l2-3M11 19l1-2.5 2 2.5M17 19l1.5-2.5" {...s} stroke="#9A4E16" />
        </svg>
      );
    case 'fog':
      return (
        <svg {...p}>
          <path d="M4 8h12M6 12h14M3 16h13M8 20h10" {...s} stroke="#7D8A86" />
        </svg>
      );
    case 'marketday':
      return (
        <svg {...p}>
          <path d="M4 10 L6 4 H18 L20 10 Z" fill="#E7A9A0" stroke="#9A4E16" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M5 10v9h14v-9M10 19v-5h4v5" {...s} stroke="#7A3D10" />
        </svg>
      );
    case 'windfall':
      return (
        <svg {...p}>
          <rect x="3" y="11" width="15" height="7" rx="3.5" fill="#B08A63" stroke="#5E4632" strokeWidth="1.5" />
          <ellipse cx="18" cy="14.5" rx="2.5" ry="3.5" fill="#E2C9A3" stroke="#5E4632" strokeWidth="1.3" />
          <path d="M9 4 Q12 7 9 9 M14 3 Q17 6 14 8" {...s} stroke="#6E8B4E" />
        </svg>
      );
    case 'coldsnap':
      return (
        <svg {...p}>
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" {...s} stroke="#4A7A98" />
        </svg>
      );
    case 'goodseason':
    case 'basket':
      return (
        <svg {...p}>
          <path d="M3.5 10h17l-2 9.5h-13Z" fill="#D9B95B" stroke="#7A5A2C" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 10 Q12 1 17 10M8 13v4M12 13v4M16 13v4" {...s} stroke="#7A5A2C" />
        </svg>
      );
    case 'hazard':
      return (
        <svg {...p}>
          <path d="M12 3 L22 20 H2 Z" fill="#E8B04A" stroke="#7A3D10" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 9v5M12 17v.5" {...s} stroke="#7A3D10" strokeWidth="2.2" />
        </svg>
      );
    case 'knife':
      return (
        <svg {...p}>
          <path d="M4 20 L11 13" {...s} stroke="#5E4632" strokeWidth="3" />
          <path d="M11 13 L20 4 Q21 9 14 16 Z" fill="#C9CFC4" stroke="#4A5446" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'water':
      return (
        <svg {...p}>
          <path d="M12 3 Q18 11 18 15 A6 6 0 0 1 6 15 Q6 11 12 3 Z" fill="#9CC0D4" stroke="#2F4A5C" strokeWidth="1.5" />
        </svg>
      );
    case 'dry':
      return (
        <svg {...p}>
          <path d="M12 3 Q18 11 18 15 A6 6 0 0 1 6 15 Q6 11 12 3 Z" fill="#F2D6B3" stroke="#9A4E16" strokeWidth="1.5" />
          <path d="M9 13l3 3 1.5-2" {...s} stroke="#9A4E16" strokeWidth="1.3" />
        </svg>
      );
    case 'blight':
      return (
        <svg {...p}>
          <circle cx="9" cy="10" r="4.5" fill="#8B9A7A" stroke="#4A5446" strokeWidth="1.3" />
          <circle cx="15.5" cy="14.5" r="3.5" fill="#A3AE8F" stroke="#4A5446" strokeWidth="1.3" />
          <circle cx="8" cy="17" r="2" fill="#6F7E62" />
        </svg>
      );
    case 'tent':
      return (
        <svg {...p}>
          <path d="M3 19 L12 5 L21 19 Z" fill="#E9D7B0" stroke="#7A5A2C" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 5 L12 19 M9.5 19 L12 13 L14.5 19" {...s} stroke="#7A5A2C" />
        </svg>
      );
    case 'harvest':
      return (
        <svg {...p}>
          <path d="M4 12h16l-1.5 8h-13Z" fill="#D9B95B" stroke="#7A5A2C" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 12 Q8 5 12 5 Q16 5 16 12" fill="#B9B4A6" stroke="#4A5446" strokeWidth="1.4" />
        </svg>
      );
    case 'forage':
      return (
        <svg {...p}>
          <path d="M12 2 L19 12 H15 L18 17 H6 L9 12 H5 Z" fill="#6E8B4E" stroke="#2B4C25" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M12 17v5" {...s} stroke="#5E4632" strokeWidth="2" />
        </svg>
      );
    case 'market':
      return (
        <svg {...p}>
          <path d="M3 9 L5 4 H19 L21 9 Z" fill="#E7A9A0" stroke="#7A3D10" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3 9 Q5.25 12 7.5 9 Q9.75 12 12 9 Q14.25 12 16.5 9 Q18.75 12 21 9" fill="#F6E6D8" stroke="#7A3D10" strokeWidth="1.3" />
          <path d="M5 11v9h14v-9" {...s} stroke="#7A3D10" />
        </svg>
      );
    case 'tend':
      return (
        <svg {...p}>
          <path d="M4 13 h11 v6 a2 2 0 0 1 -2 2 h-7 a2 2 0 0 1 -2 -2 Z" fill="#9CC0D4" stroke="#2F4A5C" strokeWidth="1.5" />
          <path d="M15 15 L21 9 M4 13 Q4 8 9 8 Q14 8 15 13" {...s} stroke="#2F4A5C" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...p}>
          <path d="M15 3 A9 9 0 1 0 21 15 A7 7 0 1 1 15 3 Z" fill="#F3E3B0" stroke="#C9A64B" strokeWidth="1.3" />
        </svg>
      );
    case 'book':
      return (
        <svg {...p}>
          <path d="M4 5 Q8 3 12 5.5 Q16 3 20 5 V19 Q16 17 12 19.5 Q8 17 4 19 Z" fill="#F6F1E4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 5.5 V19.5" {...s} />
        </svg>
      );
    case 'menu':
      return (
        <svg {...p}>
          <path d="M4 7h16M4 12h16M4 17h16" {...s} />
        </svg>
      );
    case 'close':
      return (
        <svg {...p}>
          <path d="M6 6l12 12M18 6 6 18" {...s} />
        </svg>
      );
    case 'spark':
      return (
        <svg {...p}>
          <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" fill="#E9B949" stroke="#9A6A14" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'shed':
      return (
        <svg {...p}>
          <path d="M3 11 L12 4 L21 11 V20 H3 Z" fill="#C9A77E" stroke="#5E4632" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 20v-6h6v6" {...s} stroke="#5E4632" />
        </svg>
      );
    default:
      return <svg {...p} />;
  }
}
