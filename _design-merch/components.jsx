// components.jsx — shared UI components

const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// Placeholder product art — declarative CSS-art per `art` kind.
// Это намеренно НЕ настоящие иллюстрации: полоски + формы +
// monospace-подпись, чтобы было понятно что сюда дропнуть фото.
// ─────────────────────────────────────────────────────────────────
function ProductArt({ product, size = 'md', tone = 'soft' }) {
  const { art, bg } = product;

  const stripeBg = `repeating-linear-gradient(135deg, rgba(0,0,0,.04) 0 2px, transparent 2px 14px)`;

  const shapes = {
    hoodie: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M50 70 L70 50 L100 60 L130 50 L150 70 L160 110 L150 115 L150 170 L50 170 L50 115 L40 110 Z" fill="currentColor" opacity=".82"/>
        <path d="M82 55 Q100 78 118 55 L130 50 L100 60 L70 50 Z" fill="currentColor" opacity=".55"/>
        <line x1="100" y1="78" x2="100" y2="130" stroke="rgba(255,255,255,.35)" strokeWidth="1.2"/>
      </svg>
    ),
    zip: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M50 70 L70 50 L100 60 L130 50 L150 70 L160 110 L150 115 L150 170 L50 170 L50 115 L40 110 Z" fill="currentColor" opacity=".82"/>
        <line x1="100" y1="60" x2="100" y2="170" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeDasharray="3 3"/>
      </svg>
    ),
    crew: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M50 70 L75 50 L100 62 L125 50 L150 70 L160 110 L150 115 L150 170 L50 170 L50 115 L40 110 Z" fill="currentColor" opacity=".82"/>
        <path d="M82 58 Q100 72 118 58" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2"/>
      </svg>
    ),
    tee: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M55 70 L80 50 L100 62 L120 50 L145 70 L155 95 L140 105 L140 170 L60 170 L60 105 L45 95 Z" fill="currentColor" opacity=".82"/>
      </svg>
    ),
    'tee-print': (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M55 70 L80 50 L100 62 L120 50 L145 70 L155 95 L140 105 L140 170 L60 170 L60 105 L45 95 Z" fill="currentColor" opacity=".82"/>
        <text x="100" y="135" textAnchor="middle" fill="rgba(255,255,255,.8)" fontFamily="Geist Mono, ui-monospace" fontSize="18" fontWeight="600">2026</text>
      </svg>
    ),
    long: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M50 70 L75 50 L100 62 L125 50 L150 70 L165 165 L145 175 L140 105 L140 170 L60 170 L60 105 L55 175 L35 165 Z" fill="currentColor" opacity=".82"/>
      </svg>
    ),
    backpack: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M70 55 Q100 35 130 55" fill="none" stroke="currentColor" strokeWidth="6" opacity=".7"/>
        <rect x="55" y="55" width="90" height="110" rx="14" fill="currentColor" opacity=".82"/>
        <rect x="70" y="90" width="60" height="36" rx="6" fill="rgba(255,255,255,.18)"/>
        <line x1="100" y1="90" x2="100" y2="126" stroke="rgba(255,255,255,.4)" strokeWidth="1"/>
      </svg>
    ),
    tote: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <path d="M68 50 Q68 30 88 30 M132 50 Q132 30 112 30" fill="none" stroke="currentColor" strokeWidth="4" opacity=".7"/>
        <path d="M55 60 L145 60 L155 170 L45 170 Z" fill="currentColor" opacity=".82"/>
      </svg>
    ),
    waist: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <rect x="20" y="100" width="160" height="6" fill="currentColor" opacity=".5"/>
        <rect x="55" y="80" width="90" height="50" rx="14" fill="currentColor" opacity=".85"/>
        <line x1="85" y1="92" x2="115" y2="92" stroke="rgba(255,255,255,.4)" strokeWidth="1.5"/>
      </svg>
    ),
    stickers: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <circle cx="70" cy="80" r="26" fill="currentColor" opacity=".7"/>
        <rect x="105" y="55" width="55" height="55" rx="8" fill="currentColor" opacity=".82" transform="rotate(8 132 82)"/>
        <path d="M60 130 L100 120 L130 145 L90 165 Z" fill="currentColor" opacity=".6"/>
      </svg>
    ),
    notebook: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <rect x="55" y="35" width="90" height="130" rx="3" fill="currentColor" opacity=".82"/>
        <rect x="55" y="35" width="10" height="130" fill="rgba(0,0,0,.18)"/>
        <line x1="80" y1="80"  x2="130" y2="80"  stroke="rgba(255,255,255,.35)" strokeWidth="1"/>
        <line x1="80" y1="100" x2="130" y2="100" stroke="rgba(255,255,255,.35)" strokeWidth="1"/>
        <line x1="80" y1="120" x2="120" y2="120" stroke="rgba(255,255,255,.35)" strokeWidth="1"/>
      </svg>
    ),
    pen: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <rect x="92" y="30" width="16" height="140" rx="3" fill="currentColor" opacity=".85" transform="rotate(18 100 100)"/>
        <polygon points="92,30 108,30 100,18" fill="currentColor" opacity=".85" transform="rotate(18 100 100)"/>
      </svg>
    ),
    welcome: (
      <svg viewBox="0 0 200 200" className="art-shape">
        <rect x="40" y="60" width="120" height="100" rx="4" fill="currentColor" opacity=".82"/>
        <rect x="40" y="60" width="120" height="14" fill="rgba(0,0,0,.18)"/>
        <rect x="92" y="55" width="16" height="110" fill="rgba(255,255,255,.4)"/>
        <path d="M85 55 Q100 30 115 55" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="3"/>
      </svg>
    ),
  };

  return (
    <div className={`art art-${size} art-${tone}`} style={{ background: bg, color: product.fg }}>
      <div className="art-bg" style={{ backgroundImage: stripeBg }} />
      <div className="art-shape-wrap">{shapes[art]}</div>
      <div className="art-caption" style={product.fg ? { color: 'color-mix(in oklab, currentColor 70%, transparent)' } : null}>{product.kind.toUpperCase()} · {product.id}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
function Pill({ tone = 'default', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Button({ variant = 'primary', size = 'md', onClick, children, disabled, type = 'button', as = 'button', ...rest }) {
  const Comp = as;
  return (
    <Comp type={as === 'button' ? type : undefined}
          className={`btn btn-${variant} btn-${size}`}
          onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </Comp>
  );
}

function Stepper({ value, onChange, min = 1, max = 9 }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−">−</button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+">+</button>
    </div>
  );
}

// Quota bar — показывает использование лимита
function QuotaBar({ used, total, label, accent }) {
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div className="quota">
      <div className="quota-head">
        <span className="quota-label">{label}</span>
        <span className="quota-val"><b>{used}</b> из {total}</span>
      </div>
      <div className="quota-track">
        <div className="quota-fill" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

function ColorSwatch({ color, selected, onClick }) {
  return (
    <button className={`swatch ${selected ? 'is-on' : ''}`} onClick={onClick} aria-label={color.label}>
      <span className="swatch-dot" style={{ background: color.swatch }} />
      <span className="swatch-lbl">{color.label}</span>
    </button>
  );
}

function SizePicker({ sizes, value, onChange }) {
  return (
    <div className="size-picker">
      {sizes.map(s => (
        <button key={s} className={`size-chip ${value === s ? 'is-on' : ''}`} onClick={() => onChange(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

// Toast / inline message
function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

Object.assign(window, {
  ProductArt, Pill, Button, Stepper, QuotaBar, ColorSwatch, SizePicker, Toast,
  UzumMark, UzumTilePattern,
});

// ─────────────────────────────────────────────────────────────────
// UzumMark — the U-in-circle. Based on the brand horizontal-logo SVG.
// ─────────────────────────────────────────────────────────────────
function UzumMark({ size = 32, color = 'var(--accent)' }) {
  return (
    <span className="brand-mark" aria-hidden>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="50" fill={color}/>
        {/* U arch — outer body */}
        <path
          d="M26 36 V52 c0 14 10 23 24 23 s24 -9 24 -23 V36 H64 V51 c0 8 -6 13 -14 13 s-14 -5 -14 -13 V36 Z"
          fill="#fff"
        />
        {/* indicator tab on top-left of U */}
        <rect x="46" y="25" width="8" height="14" rx="1.5" fill="#fff"/>
      </svg>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// UzumTilePattern — orientalist tile composition from the brandbook.
// 8-symmetry around a central rosette. Used as decorative artwork.
// ─────────────────────────────────────────────────────────────────
function UzumTilePattern({ size = 240, dense = false }) {
  // tile = stacked shape (back shadow + front fill)
  const Tile = ({ shape, x, y, rot = 0, scale = 1 }) => (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      {shape === 'square' && <>
        <rect x="-13" y="-13" width="26" height="26" rx="5" fill="var(--accent)" opacity=".75"/>
        <rect x="-15" y="-15" width="26" height="26" rx="5" fill="#a87aff"/>
      </>}
      {shape === 'diamond' && <>
        <rect x="-12" y="-12" width="24" height="24" rx="3" fill="var(--accent)" transform="rotate(45)" opacity=".75"/>
        <rect x="-14" y="-14" width="24" height="24" rx="3" fill="#a87aff" transform="rotate(45)"/>
      </>}
      {shape === 'drop' && <>
        <path d="M0 -14 Q11 -10 11 0 Q11 10 0 14 Q-11 10 -11 0 Q-11 -10 0 -14 Z" fill="var(--accent)" opacity=".35"/>
        <path d="M0 -12 Q9 -8 9 0 Q9 8 0 12 Q-9 8 -9 0 Q-9 -8 0 -12 Z" fill="none" stroke="var(--accent)" strokeWidth="3.5"/>
      </>}
      {shape === 'star' && (
        <path d="M0 -22 L8 -8 L22 0 L8 8 L0 22 L-8 8 L-22 0 L-8 -8 Z" fill="var(--accent-3, var(--accent))"/>
      )}
    </g>
  );

  // Position rings
  const ringInner = [
    { s: 'square',  a: 45  },
    { s: 'square',  a: 135 },
    { s: 'square',  a: 225 },
    { s: 'square',  a: 315 },
    { s: 'diamond', a: 0   },
    { s: 'diamond', a: 90  },
    { s: 'diamond', a: 180 },
    { s: 'diamond', a: 270 },
  ];
  const ringOuter = [0, 45, 90, 135, 180, 225, 270, 315];

  const r1 = 60;
  const r2 = 100;
  const toXY = (deg, r) => [Math.cos(deg * Math.PI / 180) * r, Math.sin(deg * Math.PI / 180) * r];

  return (
    <svg viewBox="-130 -130 260 260" width={size} height={size} className="uzum-pattern">
      <Tile shape="star" x={0} y={0} scale={1}/>
      {ringInner.map((t, i) => {
        const [x, y] = toXY(t.a, r1);
        return <Tile key={i} shape={t.s} x={x} y={y} rot={t.s === 'diamond' ? 0 : 0}/>;
      })}
      {dense && ringOuter.map((a, i) => {
        const [x, y] = toXY(a, r2);
        return <Tile key={i} shape="drop" x={x} y={y} rot={a + 90}/>;
      })}
    </svg>
  );
}
