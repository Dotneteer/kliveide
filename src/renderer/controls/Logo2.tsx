import React from "react";

type Props = {
  width?: number | string;
  height?: number | string;
};
export const Logo2 = ({ width = 118, height = 50 }: Props) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox='0 0 200 200'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      {/* Frame and Stripes */}
      <rect width='100%' height='100%' fill='#000' />

      <path d='M 200 149 l 0 -20 l -80 80 l 20 0' fill='#0ff' />
      <path d='M 200 129 l 0 -20 l -100 100 l 20 0' fill='#0f0' />
      <path d='M 200 109 l 0 -20 l -120 120 l 20 0' fill='#ff0' />
      <path d='M 200 89 l 0 -20 l -140 140 l 20 0' fill='#f00' />

      <path d='M 0 0 l 200 0 l 0 8 l -200 0' fill='#00B4CC' />
      <path d='M 0 199 l 200 0 l 0 -8 l -200 0' fill='#00B4CC' />
      <path d='M 0 0 l 0 200 l 8 0 l 0 -200' fill='#00B4CC' />
      <path d='M 199 0 l 0 200 l 8 0 l 0 -200' fill='#00B4CC' />


      {/* K */}
      <path d='M 40 40 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 40 60 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 40 80 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 40 100 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 40 120 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 40 140 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 60 80 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 80 80 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 100 100 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 120 120 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 140 140 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 100 60 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      <path d='M 120 40 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
    </svg>
  );
};
