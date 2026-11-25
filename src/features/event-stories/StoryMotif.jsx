// A faint pattern behind each story card's title, drawn in the card's text colour.
// Keyed by the story's `motif` in eventStories.js.

const line = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" };

function Pin({ x, y, r = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-16" y="-12" width="32" height="26" {...line} />
      <circle cx="0" cy="-12" r="4" fill="currentColor" />
    </g>
  );
}

function Burst({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...line}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <path key={i} d={`M${Math.cos(a) * 6} ${Math.sin(a) * 6}L${Math.cos(a) * 18} ${Math.sin(a) * 18}`} />;
      })}
    </g>
  );
}

function Leaf({ x, y, r = 0 }) {
  return <path transform={`translate(${x} ${y}) rotate(${r})`} d="M0 0C10-14 26-14 34 0 26 14 10 14 0 0ZM0 0H34" {...line} />;
}

function Gear({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...line}>
      <circle r="14" />
      <circle r="5" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} transform={`rotate(${i * 45})`} d="M0-14V-21" />)}
    </g>
  );
}

const MOTIFS = {
  notes: () => <><Pin x={40} y={34} r={-8} /><Pin x={270} y={120} r={10} /><Pin x={300} y={30} r={-4} /><Pin x={30} y={130} r={6} /></>,
  sparkles: () => <><Burst x={44} y={36} /><Burst x={280} y={40} s={1.3} /><Burst x={60} y={128} s={0.8} /><Burst x={300} y={128} s={0.9} /><Burst x={170} y={20} s={0.6} /></>,
  sunrise: () => (
    <g {...line}>
      <path d="M110 160a60 60 0 0 1 120 0" />
      {Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI + (i * Math.PI) / 8;
        return <path key={i} d={`M${170 + Math.cos(a) * 72} ${160 + Math.sin(a) * 72}L${170 + Math.cos(a) * 96} ${160 + Math.sin(a) * 96}`} />;
      })}
    </g>
  ),
  gears: () => <><Gear x={40} y={40} s={1.4} /><Gear x={300} y={128} s={1.6} /><Gear x={300} y={32} s={0.9} /><Gear x={36} y={136} s={0.8} /></>,
  pixels: () => (
    <g fill="currentColor">
      {[[20, 20], [36, 20], [20, 36], [300, 130], [316, 130], [316, 114], [290, 24], [306, 24], [40, 132], [56, 132], [56, 116]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="12" />)}
    </g>
  ),
  leaves: () => <><Leaf x={20} y={30} r={-20} /><Leaf x={280} y={130} r={200} /><Leaf x={290} y={30} r={20} /><Leaf x={30} y={140} r={-150} /><path d="M170 160C170 140 150 136 150 120M170 160C170 140 192 138 196 122" {...line} /></>,
  flight: () => (
    <g {...line}>
      <path d="M10 140C80 120 150 70 250 40" strokeDasharray="2 10" />
      <path d="M258 36 300 20 286 58 276 46ZM276 46 300 20" />
    </g>
  ),
  sacks: () => (
    <g {...line}>
      {[[40, 40], [290, 120], [300, 36], [44, 128]].map(([x, y]) => <path key={`${x}`} transform={`translate(${x} ${y})`} d="M-10-14h20l-3 5c7 4 11 12 11 20 0 6-4 9-16 9s-16-3-16-9c0-8 4-16 11-20Z" />)}
    </g>
  ),
  road: () => (
    <g {...line}>
      <path d="M0 150H340" strokeDasharray="22 16" />
      <path d="M36 24h20l-3 30H39ZM32 24h28M42 18h8" />
      <path d="M290 28c6 0 10 4 10 10 0 10-10 18-10 18s-10-8-10-18c0-6 4-10 10-10Z" />
    </g>
  ),
  steam: () => (
    <g {...line}>
      {[40, 60, 280, 300].map((x, i) => <path key={x} d={`M${x} ${i % 2 ? 60 : 50}c-8-10 8-16 0-26s8-16 0-26`} />)}
      <path d="M140 150h60c0 10-14 16-30 16s-30-6-30-16Z" />
    </g>
  ),
  cutlery: () => (
    <g {...line}>
      <path d="M40 20v40M32 20v14a8 8 0 0 0 16 0V20M40 60v80" />
      <path d="M300 20c-10 10-10 40 0 46v74" />
      <circle cx="170" cy="150" r="18" />
    </g>
  ),
  olive: () => (
    <g {...line}>
      <path d="M10 150C80 130 120 110 150 70" />
      {[[40, 140, -30], [70, 128, 20], [96, 112, -40], [122, 92, 10]].map(([x, y, r]) => <ellipse key={x} cx={x} cy={y} rx="10" ry="4" transform={`rotate(${r} ${x} ${y})`} />)}
      <path d="M330 20C270 40 240 60 210 100" />
      {[[300, 30, 30], [270, 46, -20], [244, 66, 40]].map(([x, y, r]) => <ellipse key={x} cx={x} cy={y} rx="10" ry="4" transform={`rotate(${r} ${x} ${y})`} />)}
    </g>
  ),
};

export default function StoryMotif({ motif }) {
  const Motif = MOTIFS[motif];
  if (!Motif) return null;
  return (
    <svg className="story-motif" viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Motif />
    </svg>
  );
}

