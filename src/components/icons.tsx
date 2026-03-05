import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 5v2" />
      <path d="M12 17v2" />
      <path d="M12 11v2" />
      <path d="m7 12-2-2-2 2" />
      <path d="m19 12-2-2-2 2" />
      <path d="M5 10v4" />
      <path d="M19 10v4" />
      <path d="M12 7h0" />
      <path d="M12 15h0" />
      <path d="M9 12h6" />
    </svg>
  );
}
