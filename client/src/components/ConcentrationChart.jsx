const COLORS = [
  '#0072CE', // Mid Blue
  '#001E60', // Dark Blue
  '#00966C', // Green
  '#ED8B00', // Amber
  '#8DD0EF', // Light Blue
  '#7A99AC', // Grey
  '#D32E1A', // Red
  '#5B2C6F', // Purple
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  // If nearly a full circle, split into two arcs
  if (endAngle - startAngle >= 359.99) {
    const mid = startAngle + 180;
    return describeArc(cx, cy, r, startAngle, mid) + ' ' + describeArc(cx, cy, r, mid, endAngle);
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function ConcentrationChart({ assetClasses, grossAssets }) {
  const cx = 80;
  const cy = 80;
  const outerR = 70;
  const innerR = 42;
  const size = 160;

  if (!assetClasses || assetClasses.length === 0 || !grossAssets) {
    return null;
  }

  // Build slices
  let startAngle = 0;
  const slices = assetClasses.map((group, i) => {
    const pct = (group.totalValue / grossAssets) * 100;
    const sweep = (pct / 100) * 360;
    const slice = { ...group, pct, startAngle, endAngle: startAngle + sweep, color: COLORS[i % COLORS.length] };
    startAngle += sweep;
    return slice;
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => {
          if (s.pct < 0.1) return null;
          // Draw donut segment
          const outerStart = polarToCartesian(cx, cy, outerR, s.startAngle);
          const outerEnd = polarToCartesian(cx, cy, outerR, s.endAngle);
          const innerStart = polarToCartesian(cx, cy, innerR, s.endAngle);
          const innerEnd = polarToCartesian(cx, cy, innerR, s.startAngle);
          const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0;

          const d = [
            `M ${outerStart.x} ${outerStart.y}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
            `L ${innerStart.x} ${innerStart.y}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
            'Z',
          ].join(' ');

          return <path key={i} d={d} fill={s.color} />;
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 w-full space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-ig-dark">{s.name}</span>
            </div>
            <span className="text-ig-grey font-medium">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
