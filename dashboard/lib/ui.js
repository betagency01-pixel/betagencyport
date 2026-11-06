import { num } from './fmt';

export function BarList({ rows, color = '#ECE9FF', empty = 'Nothing yet' }) {
  if (!rows?.length) return <p className="empty">{empty}</p>;
  const max = Math.max(...rows.map(r => Number(r.n)), 1);
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar" key={i} style={{ '--c': color }}>
          <i className="fill" style={{ width: `${(Number(r.n) / max) * 100}%` }} />
          <span title={r.label}>{r.label || 'Unknown'}</span><b>{num(r.n)}</b>
        </div>
      ))}
    </div>
  );
}

// Daily visitors (area) + enquiries (bars), plain SVG.
export function TrafficChart({ days }) {
  const W = 720, H = 220, P = { l: 34, r: 8, t: 10, b: 26 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = Math.max(4, ...days.map(d => Number(d.visitors)), ...days.map(d => Number(d.enquiries)));
  const step = Math.ceil(max / 4); const top = step * 4;
  const x = i => P.l + (days.length === 1 ? iw / 2 : (i / (days.length - 1)) * iw);
  const y = v => P.t + ih - (v / top) * ih;
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.visitors).toFixed(1)}`).join('');
  const area = `${line}L${x(days.length - 1).toFixed(1)},${P.t + ih}L${x(0).toFixed(1)},${P.t + ih}Z`;
  const bw = Math.max(3, Math.min(14, iw / days.length / 2.5));
  const every = Math.ceil(days.length / 8);
  return (
    <div className="chart">
      <div className="legend"><span><i style={{ background: '#3B2BFF' }} />Visitors</span><span><i style={{ background: '#FF3D8B' }} />Enquiries</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily visitors and enquiries">
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B2BFF" stopOpacity=".28" /><stop offset="1" stopColor="#3B2BFF" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(k => (
          <g key={k}>
            <line x1={P.l} x2={W - P.r} y1={y(k * step)} y2={y(k * step)} stroke="#EEEBF7" />
            <text x={P.l - 8} y={y(k * step) + 4} textAnchor="end" fontSize="11" fill="#8F89A6">{k * step}</text>
          </g>
        ))}
        {days.map((d, i) => Number(d.enquiries) > 0 && (
          <rect key={'e' + i} x={x(i) - bw / 2} y={y(d.enquiries)} width={bw} height={P.t + ih - y(d.enquiries)} rx="2" fill="#FF3D8B">
            <title>{`${d.label}: ${d.enquiries} enquiries`}</title>
          </rect>
        ))}
        <path d={area} fill="url(#ga)" />
        <path d={line} fill="none" stroke="#3B2BFF" strokeWidth="2.5" strokeLinejoin="round" />
        {days.map((d, i) => (
          <g key={'p' + i}>
            <circle cx={x(i)} cy={y(d.visitors)} r={days.length > 40 ? 0 : 3} fill="#fff" stroke="#3B2BFF" strokeWidth="2"><title>{`${d.label}: ${d.visitors} visitors`}</title></circle>
            {i % every === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#8F89A6">{d.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Delta({ now, before }) {
  now = Number(now); before = Number(before);
  if (!before) return <p className="d">{now ? 'New this period' : 'No data yet'}</p>;
  const ch = Math.round(((now - before) / before) * 100);
  return <p className={`d ${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}`}>{ch > 0 ? '▲' : ch < 0 ? '▼' : '•'} {Math.abs(ch)}% vs previous period</p>;
}
