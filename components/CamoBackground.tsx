'use client';

export default function CamoBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#030303]">
      {/* SVG camo blobs */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gray camo layer 1 */}
          <filter id="camo-1">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves={4}
              seed={1}
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="gray"
            />
            <feComponentTransfer in="gray" result="threshold">
              <feFuncA type="discrete" tableValues="0 0 0 0 1 1 0 0" />
            </feComponentTransfer>
          </filter>

          {/* Gray camo layer 2 */}
          <filter id="camo-2">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008"
              numOctaves={3}
              seed={42}
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="gray"
            />
            <feComponentTransfer in="gray" result="threshold">
              <feFuncA type="discrete" tableValues="0 0 0 1 1 0 0 0" />
            </feComponentTransfer>
          </filter>

          {/* Red camo layer — NO desaturation */}
          <filter id="camo-red">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006"
              numOctaves={3}
              seed={77}
              result="noise"
            />
            <feComponentTransfer in="noise" result="threshold">
              <feFuncR type="discrete" tableValues="0 0 0 1 1 0 0 0" />
              <feFuncG type="discrete" tableValues="0 0 0 0 0 0 0 0" />
              <feFuncB type="discrete" tableValues="0 0 0 0 0 0 0 0" />
              <feFuncA type="discrete" tableValues="0 0 0 1 1 0 0 0" />
            </feComponentTransfer>
          </filter>

          {/* Second red layer, different pattern */}
          <filter id="camo-red-2">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.01"
              numOctaves={2}
              seed={123}
              result="noise"
            />
            <feComponentTransfer in="noise" result="threshold">
              <feFuncR type="discrete" tableValues="0 0 1 1 0 0 0 0" />
              <feFuncG type="discrete" tableValues="0 0 0 0 0 0 0 0" />
              <feFuncB type="discrete" tableValues="0 0 0 0 0 0 0 0" />
              <feFuncA type="discrete" tableValues="0 0 1 1 0 0 0 0" />
            </feComponentTransfer>
          </filter>
        </defs>

        {/* Dark gray blobs */}
        <rect
          width="100%"
          height="100%"
          fill="#111"
          filter="url(#camo-1)"
          opacity={0.25}
        />

        {/* Medium gray blobs */}
        <rect
          width="100%"
          height="100%"
          fill="#161616"
          filter="url(#camo-2)"
          opacity={0.15}
        />

        {/* Deep red blobs — large patches */}
        <rect
          width="100%"
          height="100%"
          fill="#990000"
          filter="url(#camo-red)"
          opacity={0.1}
        />

        {/* Deep red blobs — smaller patches */}
        <rect
          width="100%"
          height="100%"
          fill="#800000"
          filter="url(#camo-red-2)"
          opacity={0.07}
        />
      </svg>

      {/* Grain overlay */}
      <div className="grain-overlay absolute inset-0" />

      {/* Heavy vignette to keep edges very dark */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }}
      />
    </div>
  );
}
