import React from "react";

export const Logo = () => {
  return (
    <svg
      width='140'
      height='52'
      viewBox='0 0 280 104'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      { /* Frame and Stripes */ }
      <rect width="100%" height="100%" fill="#000" />
      <rect x={8} y={2} width={5} height={100} fill="#f00" stroke="#f00" />
      <rect x={13} y={2} width={5} height={100} fill="#ff0" stroke="#ff0" />
      <rect x={18} y={2} width={5} height={100} fill="#0f0" stroke="#0f0" />
      <rect x={23} y={2} width={5} height={100} fill="#0ff" stroke="#0ff" />
      <rect width="100%" height="100%" stroke="black" strokeWidth={4} />

      { /* K */ }
      <path d="M 41 12 l 0 42 l 7 0 l 0 -42 M 48 26 l 14 0 l 0 7 l -14 0 M 62 19 l 7 0 l 0 7 l -7 0 M 69 12 l 7 0 l 0 7 l -7 0 M 62 33 l 7 0 l 0 7 l -7 0 M 69 40 l 7 0 l 0 7 l -7 0 M 76 47 l 7 0 l 0 7 l -7 0" fill="#e0e0e0" />
      <path d="M 83 5 l 0 42 l 35 0 l 0 -7 l -28 0 l 0 -35" fill="#e0e0e0" />
      <path d="M 132 5 l 35 0 l 0 7 l -14 0 l 0 28 l 14 0 l 0 7 l -35 0 l 0 -7 l 14 0 l 0 -28 l -14 0" fill="#e0e0e0" />
      <path d="M 181 5 l 0 28 l 7 0 l 0 -28 M 188 33 l 7 0 l 0 7 l -7 0 M 195 40 l 14 0 l 0 7 l -14 0 M 209 33 l 7 0 l 0 7 l -7 0 M 216 5 l 0 28 l 7 0 l 0 -28" fill="#e0e0e0" />
      <path d="M 230 5 l 0 42 l 42 0 l 0 -7 l -35 0 l 0 -14 l 28 0 l 0 -7 l -28 0 l 0 -7 l 35 0 l 0 -7" fill="#e0e0e0" />
      
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
