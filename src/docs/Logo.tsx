import React from "react";

export const Logo = () => {
  return (
    <svg
      width='118'
      height='50'
      viewBox='0 0 294 124'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      { /* Frame and Stripes */ }
      <rect width="100%" height="100%" fill="#000" />
      <rect x={12} y={12} width={14} height={100} fill="#007acc" />
      <rect width="100%" height="100%" stroke="black" strokeWidth={4} />

      <path d="M 293 103 l -21 21 l -21 0 l 42 -42" fill="#0ff" />
      <path d="M 293 82 l -42 42 l -21 0 l 63 -63" fill="#0f0" />
      <path d="M 293 61 l -63 63 l -21 0 l 84 -84" fill="#ff0" />
      <path d="M 293 40 l -84 84 l -21 0 l 105 -105" fill="#f00" />

      { /* KLIVE ide */ }
      <path d="M 41 12 l 0 42 l 7 0 l 0 -42 M 48 26 l 14 0 l 0 7 l -14 0 M 62 19 l 7 0 l 0 7 l -7 0 M 69 12 l 7 0 l 0 7 l -7 0 M 62 33 l 7 0 l 0 7 l -7 0 M 69 40 l 7 0 l 0 7 l -7 0 M 76 47 l 7 0 l 0 7 l -7 0" fill="#e0e0e0" />
      <path d="M 90 12 l 0 42 l 35 0 l 0 -7 l -28 0 l 0 -35" fill="#e0e0e0" />
      <path d="M 139 12 l 35 0 l 0 7 l -14 0 l 0 28 l 14 0 l 0 7 l -35 0 l 0 -7 l 14 0 l 0 -28 l -14 0" fill="#e0e0e0" />
      <path d="M 190 12 l 0 28 l 7 0 l 0 -28 M 195 40 l 7 0 l 0 7 l -7 0 M 202 47 l 14 0 l 0 7 l -14 0 M 216 40 l 7 0 l 0 7 l -7 0 M 223 12 l 0 28 l 7 0 l 0 -28" fill="#e0e0e0" />
      <path d="M 237 12 l 0 42 l 42 0 l 0 -7 l -35 0 l 0 -14 l 28 0 l 0 -7 l -28 0 l 0 -7 l 35 0 l 0 -7" fill="#e0e0e0" />
      <path d="M 56 68 l 7 0 l 0 7 l -7 0 M 49 82 l 14 0 l 0 21 l 7 0 l 0 7 l -21 0 l 0 -7 l 7 0 l 0 -14 l -7 0" fill="#e0e0e0" />
      <path d="M 119 68 l 7 0 l 0 42 l -28 0 l 0 -7 l 21 0 M 119 82 l -21 0 l 0 7 l 21 0 M 98 89 l 0 14 l -7 0 l 0 -14" fill="#e0e0e0" />
      <path d="M 147 75 l 21 0 l 0 7 l -21 0 M 140 82 l 0 21 l 7 0 l 0 -21 M 147 103 l 28 0 l 0 7 l -28 0 M 168 82 l 7 0 l 0 7 l -7 0 M 147 89 l 21 0 l 0 7 l -21 0" fill="#e0e0e0" />
      
      <defs>
        <linearGradient
          id='paint0_linear_2790_21058'
          x1='11.9663'
          y1='6.54545'
          x2='22.5351'
          y2='22.5385'
          gradientUnits='userSpaceOnUse'
        >
          <stop stopColor='#D62400' />
          <stop offset='1' stopColor='#A02020' />
        </linearGradient>
      </defs>
    </svg>
  );
};
