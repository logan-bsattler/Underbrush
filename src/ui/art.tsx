import type { JSX } from 'preact';
import { content } from '../core';
import type { Season, SpeciesArt, Stage, Substrate } from '../core';

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
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
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
          {a.star && <path d="M4 90 L30 80 L18 64 L40 74 L50 58 L60 74 L82 64 L70 80 L96 90 L50 95 Z" fill={a.gill} {...line} />}
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
          {a.drops &&
            id &&
            [
              [32, 32],
              [48, 26],
              [63, 33],
              [41, 42],
              [57, 43],
            ].map(([x, y]) => (
              <g>
                <circle cx={x} cy={y} r="3.4" fill="#B3121B" />
                <circle cx={x - 1} cy={y - 1.2} r="0.9" fill="#F6E1DF" />
              </g>
            ))}
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
      {def.art.glow && <circle cx="50" cy="52" r="40" fill={def.art.gill} opacity="0.75" filter="url(#glow)" />}
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

/** Grass on empty ground through the year: fresh with flowers in spring, gold in fall, under snow in winter. */
const grass: Record<Season, string> = { spring: '#7EA35A', summer: '#6E8B4E', fall: '#B08A3E', winter: '#9AA79A' };

export function SubstrateArt({ substrate, size = 100, season }: { substrate: Substrate | null; size?: number; season?: Season }) {
  const tufts = [
    [20, 30],
    [70, 22],
    [40, 70],
    [80, 76],
    [14, 82],
  ];
  return (
    <svg class="sub-art" width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {substrate === null && (
        <g opacity="0.8">
          {tufts.map(([x, y]) => (
            <path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -9 M${x} ${y} l3 -7`} stroke={grass[season ?? 'summer']} strokeWidth="1.6" strokeLinecap="round" />
          ))}
          {season === 'spring' &&
            [
              [30, 46],
              [62, 52],
              [52, 30],
            ].map(([x, y]) => <circle cx={x} cy={y} r="2.4" fill="#F4F0E2" stroke="#E2B8C4" strokeWidth="1.2" />)}
          {season === 'fall' &&
            [
              [32, 48, 20],
              [60, 56, -35],
              [50, 34, 60],
            ].map(([x, y, r]) => <ellipse cx={x} cy={y} rx="4" ry="2" fill="#C2662E" opacity="0.8" transform={`rotate(${r} ${x} ${y})`} />)}
          {season === 'winter' && <path d="M8 92 Q30 80 52 88 T96 86 L96 100 L4 100 Z" fill="#FBFCFA" opacity="0.9" />}
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

/** Canopy and shadow colors for the tree through the year. */
const canopy: Record<Season, { leaf: string; shade: string }> = {
  spring: { leaf: '#8FB866', shade: '#5E8A3E' },
  summer: { leaf: '#6E8B4E', shade: '#3E6B35' },
  fall: { leaf: '#D08A3A', shade: '#A2542A' },
  winter: { leaf: '#E9EEF0', shade: '#B9C6CC' },
};

/** Undergrowth on the forest floor through the year: fresh, full, gone gold, then dry under snow. */
const floorGreen: Record<Season, { fill: string; stroke: string }> = {
  spring: { fill: '#8FB866', stroke: '#4E6E30' },
  summer: { fill: '#7E9A55', stroke: '#3E5228' },
  fall: { fill: '#C59A48', stroke: '#7A5A2A' },
  winter: { fill: '#B7BFAE', stroke: '#6E7B6A' },
};

export function TreeArt({ season = 'summer' }: { season?: Season }) {
  const c = canopy[season];
  return (
    <svg class="tree-art" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="92" rx="30" ry="5" fill="#3E6B35" opacity="0.2" filter="url(#wash)" />
      <g filter="url(#wc)">
        <path d="M44 92 L46 58 L54 58 L56 92 Z" fill="#7A5A3C" {...line} />
        {season === 'winter' ? (
          <>
            {/* Bare branches with snow along the tops. */}
            <path d="M50 60 L50 20 M50 44 L30 26 M50 36 L70 20 M50 52 L72 40 M50 50 L26 44 M38 34 L34 18 M62 28 L66 12" {...line} stroke="#5E4632" strokeOpacity="0.9" strokeWidth="3" />
            <path d="M30 24 Q40 28 48 40 M70 18 Q60 26 52 34 M24 42 Q36 44 48 48" fill="none" stroke="#FBFCFA" strokeWidth="2.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M50 8 Q76 14 80 38 Q88 50 76 62 Q62 72 50 66 Q36 72 24 62 Q12 50 20 38 Q24 14 50 8 Z" fill={c.leaf} {...line} />
            <path d="M58 16 Q76 22 78 40 Q84 52 74 60 Q66 64 60 62 Q72 44 58 16 Z" fill={c.shade} opacity="0.45" />
          </>
        )}
        {season === 'spring' &&
          [
            [34, 30],
            [52, 20],
            [64, 40],
            [40, 52],
            [70, 28],
            [28, 46],
          ].map(([x, y]) => <circle cx={x} cy={y} r="3.2" fill="#F6D6DE" stroke="#D99AAE" strokeWidth="0.8" />)}
        {season === 'fall' && <ellipse cx="72" cy="90" rx="10" ry="3" fill="#C2662E" opacity="0.7" />}
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

/** `season` dresses the forest-floor icons (ground, brush, tree) for the time of year; left out, they show summer. */
export function Icon({ name, size = 20, season }: { name: string; size?: number; season?: Season }) {
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
    case 'cap':
      // The mycelium's sign: a pale cap showing through the leaves.
      return (
        <svg {...p} class="icon cap-sign">
          <path d="M10.6 13 L10 19 Q12 20 14 19 L13.4 13 Z" fill="#F3EBD6" stroke="#8C7A5A" strokeWidth="1.1" />
          <path d="M4 13.5 Q4 6 12 6 Q20 6 20 13.5 Z" fill="#F6F0E0" stroke="#8C7A5A" strokeWidth="1.2" />
        </svg>
      );
    case 'hazard':
      return (
        <svg {...p}>
          <path d="M12 3 L22 20 H2 Z" fill="#E8B04A" stroke="#7A3D10" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 9v5M12 17v.5" {...s} stroke="#7A3D10" strokeWidth="2.2" />
        </svg>
      );
    case 'spade':
      return (
        <svg {...p}>
          <path d="M12 2 V11 M9 2.5 H15" {...s} stroke="#5E4632" strokeWidth="2.4" />
          <path d="M7 11 H17 V15 Q17 21 12 22 Q7 21 7 15 Z" fill="#C9CFC4" stroke="#4A5446" strokeWidth="1.4" strokeLinejoin="round" />
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
    case 'ground':
      return (
        <svg {...p}>
          <path d="M2 17 Q7 13 12 15 T22 15 V20 H2 Z" fill={season === 'winter' ? '#A89A88' : '#9C7C58'} stroke="#5E4632" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="8" cy="18" r="0.9" fill="#5E4632" />
          <circle cx="15" cy="17.5" r="1.1" fill="#5E4632" />
          {season === 'spring' && <path d="M12 15 V11 M12 12.5 Q9.5 12 9 9.5 M12 11.5 Q14.5 11 15 8.5" {...s} stroke={floorGreen.spring.stroke} strokeWidth="1.3" />}
          {season === 'fall' && <ellipse cx="17" cy="14.6" rx="2.6" ry="1.2" fill="#C2662E" transform="rotate(-18 17 14.6)" />}
          {season === 'winter' && <path d="M2 17 Q7 13 12 15 T22 15 V16.4 Q17 15 12 16.6 T2 18.2 Z" fill="#FBFCFA" stroke="#B9C6CC" strokeWidth="0.8" />}
        </svg>
      );
    case 'brush': {
      const b = floorGreen[season ?? 'summer'];
      return (
        <svg {...p}>
          <path d="M3 20 Q12 14 21 20 Z" fill={b.fill} stroke={b.stroke} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6 19 Q5 10 8 5 M10 18 Q11 9 12 3 M14 18 Q14 10 17 5 M18 19 Q19 13 20 9" {...s} stroke={b.stroke} />
          {season === 'spring' && <circle cx="12" cy="3.4" r="1.5" fill="#F6D6DE" stroke="#D99AAE" strokeWidth="0.8" />}
          {season === 'winter' && <path d="M4 19.6 Q12 14.6 20 19.6" fill="none" stroke="#FBFCFA" strokeWidth="1.6" strokeLinecap="round" />}
        </svg>
      );
    }
    case 'tree': {
      const c = canopy[season ?? 'summer'];
      return (
        <svg {...p}>
          <path d="M11 21 V14 M13 21 V14" {...s} stroke="#5E4632" strokeWidth="2.2" />
          {season === 'winter' ? (
            <>
              {/* Bare branches with snow along them, as on the farm. */}
              <path d="M12 15 V4 M12 10 L7 6 M12 8 L17 4 M12 12 L17 9" {...s} stroke="#5E4632" strokeWidth="1.5" />
              <path d="M7 5.6 Q9.4 6.6 11.4 9 M17 3.6 Q15 5.4 12.6 7.6" fill="none" stroke="#FBFCFA" strokeWidth="1.3" strokeLinecap="round" />
            </>
          ) : (
            <path d="M12 2 Q20 6 18 12 Q19 16 12 15 Q5 16 6 12 Q4 6 12 2 Z" fill={c.leaf} stroke={season === 'fall' ? '#8A4422' : '#3E5228'} strokeWidth="1.4" />
          )}
          {season === 'spring' && [[9, 7], [14, 5], [15, 10], [9, 11.5]].map(([x, y]) => <circle cx={x} cy={y} r="1.1" fill="#F6D6DE" stroke="#D99AAE" strokeWidth="0.5" />)}
          {season === 'fall' && <ellipse cx="18.5" cy="20.4" rx="2.2" ry="0.9" fill="#C2662E" />}
        </svg>
      );
    }
    case 'way':
      return (
        <svg {...p}>
          <path d="M3 21 V12 Q12 1 21 12 V21 Z" fill="#5E4632" stroke="#2F261E" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7 21 V13 Q12 6 17 13 V21 Z" fill="#17110C" />
          <path d="M8.5 17.5 H15.5 M9.5 19.5 H14.5" {...s} stroke="#C9A24B" strokeWidth="1.3" />
        </svg>
      );
    case 'relic':
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="4.6" fill="#C9A24B" stroke="#6A4E14" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="1.7" fill="#F6F1E4" />
          <path d="M11.2 11.2 L20 20 M15.5 15.5 l2.4 -2.4 M18.2 18.2 l2.4 -2.4" stroke="#6A4E14" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...p}>
          <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" fill="#E9B949" stroke="#9A6A14" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'pile':
      return (
        <svg {...p}>
          <path d="M3 19 Q6 10 12 9 Q18 10 21 19 Z" fill="#6E5236" stroke="#3E2C1C" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 14 l1 -1 M13 12 l1 1 M15 16 l1 -1 M10 17 l1 0" {...s} stroke="#C9A77E" strokeWidth="1.4" />
          <path d="M11 9 Q10 5 13 4" {...s} stroke="#6E8B4E" strokeWidth="1.6" />
        </svg>
      );
    case 'pantry':
      return (
        <svg {...p}>
          <path d="M7 4 H17 V7 H7 Z" fill="#8C6A4A" stroke="#4F3A26" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6 8 Q6 7 7 7 H17 Q18 7 18 8 V19 Q18 21 16 21 H8 Q6 21 6 19 Z" fill="#E7DCC2" stroke="#4F3A26" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 15 Q9 11 12 11 Q15 11 15 15 Z" fill="#C27A1C" stroke="#4F3A26" strokeWidth="1.1" />
          <path d="M11.4 15 L11.2 18 H12.8 L12.6 15" fill="#F2E6CC" stroke="#4F3A26" strokeWidth="1" />
        </svg>
      );
    case 'bowl':
      return (
        <svg {...p}>
          <path d="M3 11 H21 Q20 19 12 19 Q4 19 3 11 Z" fill="#D9C7A0" stroke="#5E4632" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 8 Q8 6 10 4 M13 8 Q12 6 14 4" {...s} stroke="#8A9385" />
        </svg>
      );
    case 'share':
      return (
        <svg {...p}>
          <path d="M12 3 V15 M7 8 L12 3 L17 8" {...s} />
          <path d="M5 12 V19 Q5 21 7 21 H17 Q19 21 19 19 V12" {...s} />
        </svg>
      );
    case 'shed':
      return (
        <svg {...p}>
          <path d="M3 11 L12 4 L21 11 V20 H3 Z" fill="#C9A77E" stroke="#5E4632" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 20v-6h6v6" {...s} stroke="#5E4632" />
        </svg>
      );
    case 'lantern':
      return (
        <svg {...p}>
          <path d="M9.5 5 Q12 1.5 14.5 5" {...s} stroke="#2F261E" strokeWidth="1.4" />
          <path d="M8 5 H16 L15 7.5 H9 Z" fill="#5E4632" stroke="#2F261E" strokeWidth="1.3" strokeLinejoin="round" />
          <rect x="8.5" y="7.5" width="7" height="10.5" rx="1.5" fill="#F3C86A" stroke="#2F261E" strokeWidth="1.4" />
          <path d="M12 10.5 Q14 13 12 15.5 Q10 13 12 10.5 Z" fill="#D9792A" />
          <path d="M7.5 18 H16.5 V20.5 H7.5 Z" fill="#5E4632" stroke="#2F261E" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'trailmap':
      return (
        <svg {...p}>
          <path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z" fill="#EAD9B0" stroke="#7A5A2C" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 4 V18 M15 6 V20" {...s} stroke="#7A5A2C" strokeWidth="1.1" />
          <path d="M5 16 Q8 11 11 13 T17 9" {...s} stroke="#9A4E16" strokeWidth="1.4" strokeDasharray="1.6 1.8" />
          <path d="M17.5 6.5 l2 2 M19.5 6.5 l-2 2" stroke="#9A4E16" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'waders':
      return (
        <svg {...p}>
          <path d="M8 2.5 L9 8 M16 2.5 L15 8" {...s} stroke="#2F3A2A" strokeWidth="1.3" />
          <path d="M8 8 H16 V12 L15.5 19 H12.8 L12 13.5 L11.2 19 H8.5 L8 12 Z" fill="#5F7A55" stroke="#2F3A2A" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8.5 19 H11.2 L11.4 21.5 H6 Q6 19.5 8.5 19 Z M12.8 19 H15.5 Q18 19.5 18 21.5 H12.6 Z" fill="#2F3A2A" stroke="#2F3A2A" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      );
    case 'compass':
      return (
        <svg {...p}>
          <circle cx="12" cy="3.6" r="1.5" fill="none" stroke="#6A4E14" strokeWidth="1.3" />
          <circle cx="12" cy="13" r="8" fill="#C9A24B" stroke="#6A4E14" strokeWidth="1.5" />
          <circle cx="12" cy="13" r="5.8" fill="#F6F1E4" stroke="#6A4E14" strokeWidth="1" />
          <path d="M12 8.2 L13.6 13 H10.4 Z" fill="#9A4E16" />
          <path d="M12 17.8 L10.4 13 H13.6 Z" fill="#4A5446" />
        </svg>
      );
    case 'fieldguide':
      return (
        <svg {...p}>
          <path d="M6.5 3 H18.5 Q19.5 3 19.5 4 V20 Q19.5 21 18.5 21 H6.5 Z" fill="#6E8B4E" stroke="#3E5228" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6.5 3 Q4.5 3 4.5 5 V19 Q4.5 21 6.5 21" fill="#E7DCC2" stroke="#3E5228" strokeWidth="1.4" />
          <path d="M9 11.5 Q9 7.5 13 7.5 Q17 7.5 17 11.5 Z" fill="#F6F1E4" />
          <path d="M12.2 11.5 L12 15.5 H14 L13.8 11.5 Z" fill="#F6F1E4" />
        </svg>
      );
    case 'blightspray':
      return (
        <svg {...p}>
          <path d="M10 9 V6 H14 V9" fill="#5E4632" stroke="#2F261E" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M10 6.5 H6.5 L5.5 8" {...s} stroke="#2F261E" strokeWidth="1.4" />
          <path d="M9 9 H15 V19 Q15 21 13 21 H11 Q9 21 9 19 Z" fill="#9CB89A" stroke="#3E5228" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 13 H15" stroke="#3E5228" strokeWidth="1" />
          <circle cx="3.2" cy="7" r="0.9" fill="#4A7A98" />
          <circle cx="3.6" cy="10" r="0.9" fill="#4A7A98" />
          <circle cx="2.4" cy="4.4" r="0.9" fill="#4A7A98" />
        </svg>
      );
    case 'dehydrator':
      return (
        <svg {...p}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" fill="#E7DCC2" stroke="#5E4632" strokeWidth="1.5" />
          <path d="M4 9 H20 M4 15 H20" {...s} stroke="#5E4632" strokeWidth="1.3" />
          <ellipse cx="8.5" cy="7" rx="2" ry="1" fill="#8C5A2E" />
          <ellipse cx="14" cy="7" rx="2" ry="1" fill="#C27A1C" />
          <ellipse cx="10" cy="13" rx="2" ry="1" fill="#C27A1C" />
          <ellipse cx="15.5" cy="13" rx="2" ry="1" fill="#8C5A2E" />
          <ellipse cx="8" cy="19" rx="2" ry="1" fill="#8C5A2E" />
          <ellipse cx="13.5" cy="19" rx="2" ry="1" fill="#C27A1C" />
        </svg>
      );
    default:
      return <svg {...p} />;
  }
}
