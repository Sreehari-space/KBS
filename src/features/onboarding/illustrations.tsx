import React from 'react';

/**
 * Hand-drawn ink illustrations, first run only.
 *
 * Every stroke is `currentColor` and every fill is `currentColor`, so the
 * whole drawing flips to cream on the dark grounds without a second copy.
 * Nothing here is a knocked-out white — a white hole would sit on a pastel
 * ground and show as a white hole. The one solid mass per drawing uses
 * `fill-rule="evenodd"` instead, letting the ground itself show through.
 *
 * They are deliberately wobbly. Coordinates are off-grid and edges are drawn
 * with beziers that do not quite close symmetrically, because a perfectly
 * regular path reads as an icon, and the icon set already exists two screens
 * away. This is the one place in KBS that is allowed to look drawn by hand.
 */

const Ink: React.FC<{ children: React.ReactNode; className?: string; viewBox: string }> = ({
  children,
  className = '',
  viewBox,
}) => (
  <svg
    viewBox={viewBox}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    role="presentation"
    aria-hidden
  >
    {children}
  </svg>
);

/** Short radiating ticks — the reference's "this matters" marks. */
const Sparkle: React.FC<{ x: number; y: number; scale?: number }> = ({ x, y, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} strokeWidth={2.6}>
    <path d="M0 -11 L0 -3" />
    <path d="M9 -7 L4 -1.5" />
    <path d="M-9 -7 L-4 -1.5" />
  </g>
);

/** Step 1 — the shop's own board, because the question is what to call it. */
export const ShopSign: React.FC<{ className?: string }> = ({ className }) => (
  <Ink className={className} viewBox="18 8 124 108">
    {/* the rail it hangs from, not quite level */}
    <path d="M24 22 C58 17, 104 18, 136 21" />
    {/* two straps, each with its own droop */}
    <path d="M52 21 C48 28, 49 34, 54 40" />
    <path d="M112 22 C117 29, 115 35, 110 41" />
    {/* the board: no two corners alike */}
    <path d="M36 40 C35 60, 34 82, 33 100 C63 106, 103 107, 130 101 C131 80, 132 58, 130 42 C99 37, 64 36, 36 40 Z" />
    {/* the nameplate — the one solid mass, with two lines of "writing" cut
        out of it so the ground shows through rather than a white fill */}
    <path
      fillRule="evenodd"
      fill="currentColor"
      stroke="none"
      d="M46 50 C72 47, 102 47, 120 50 C121 63, 121 79, 120 91 C98 95, 66 95, 46 91 C45 78, 45 63, 46 50 Z
         M56 60 C74 57, 100 57, 112 60 C112 65, 112 67, 112 70 C95 67, 72 67, 56 70 C56 67, 56 63, 56 60 Z
         M56 77 C68 74, 84 74, 94 77 C94 82, 94 84, 94 87 C80 84, 67 84, 56 87 C56 84, 56 80, 56 77 Z"
    />
    <Sparkle x={27} y={46} />
    <Sparkle x={138} y={54} scale={0.8} />
  </Ink>
);

/** Step 2 — a bill with a stamp on it, which is what registration means here. */
export const StampedBill: React.FC<{ className?: string }> = ({ className }) => (
  <Ink className={className} viewBox="14 16 138 110">
    {/* the slip, torn along the bottom the way thermal paper tears */}
    <path
      d="M33 26 C52 22, 76 22, 98 26 C99 50, 99 78, 98 100
         L91 94 L84 101 L77 94 L70 101 L63 94 L56 101 L49 94 L42 101 L34 95
         C33 72, 32 48, 33 26 Z"
    />
    {/* three lines of a bill, each a little shorter */}
    <path d="M45 42 C58 40, 76 40, 87 42" strokeWidth={2.6} />
    <path d="M45 54 C57 52, 72 52, 81 54" strokeWidth={2.6} />
    <path d="M45 66 C54 64, 63 64, 69 66" strokeWidth={2.6} />
    {/* the stamp: one solid disc with a per-cent sign cut out of it, so what
        reads as white is actually the pastel ground behind */}
    <path
      fillRule="evenodd"
      fill="currentColor"
      stroke="none"
      d="M111 61 C130 59, 145 73, 144 90 C143 108, 127 118, 110 116 C93 114, 82 100, 84 84 C86 69, 97 62, 111 61 Z
         M100 76 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z
         M116 100 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z
         M122 71 L129 75 L108 108 L101 104 Z"
    />
    {/* the stamp is coming down, so it gets motion, not sparkle */}
    <path d="M136 50 C139 46, 141 43, 142 40" strokeWidth={2.4} />
    <path d="M124 46 C125 42, 125 39, 125 36" strokeWidth={2.4} />
    <Sparkle x={26} y={104} scale={0.85} />
  </Ink>
);

/** Step 3 — a provision-store sack, because that is what gets sold most. */
export const RiceSack: React.FC<{ className?: string }> = ({ className }) => (
  <Ink className={className} viewBox="24 16 120 110">
    {/* the gathered top, cinched and flopping over */}
    <path d="M62 46 C56 38, 57 29, 66 26 C72 32, 72 39, 70 46" />
    <path d="M92 46 C99 38, 100 30, 107 28 C110 35, 104 42, 100 47" />
    {/* the tie */}
    <path d="M57 46 C71 42, 92 42, 104 46 C103 51, 103 55, 104 59 C90 55, 71 55, 57 59 C58 55, 58 50, 57 46 Z" />
    {/* the sack itself, fuller on one side than the other */}
    <path
      d="M58 59 C44 70, 35 88, 36 104 C36 114, 43 120, 54 121
         C74 123, 96 123, 111 120 C122 118, 128 112, 127 102
         C126 86, 117 70, 104 59"
    />
    {/* the label patch — the solid mass, with the price scrawl cut out */}
    <path
      fillRule="evenodd"
      fill="currentColor"
      stroke="none"
      d="M60 82 C79 79, 101 79, 115 82 C116 92, 116 101, 115 110 C97 113, 77 113, 60 110 C59 101, 59 91, 60 82 Z
         M70 92 C84 89, 100 89, 106 92 C106 97, 106 99, 106 102 C93 99, 81 99, 70 102 C70 99, 70 95, 70 92 Z"
    />
    {/* hatching down the shaded side */}
    <path d="M44 88 L51 81" strokeWidth={2.2} />
    <path d="M43 99 L50 92" strokeWidth={2.2} />
    <path d="M45 110 L52 103" strokeWidth={2.2} />
    {/* a few grains that got away */}
    <path d="M134 108 L138 104" strokeWidth={2.4} />
    <path d="M137 118 L141 114" strokeWidth={2.4} />
    <Sparkle x={31} y={56} scale={0.9} />
    <Sparkle x={136} y={66} scale={0.8} />
  </Ink>
);
