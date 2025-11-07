'use client';

import { ReactNode, useState } from 'react';

type TooltipProps = {
  content: string;
  children: ReactNode;
  delay?: number;
};

export function Tooltip({ content, children, delay = 300 }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setShow(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setShow(false);
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2
                     bg-gray-900 text-white text-xs rounded-lg shadow-lg border border-gray-700
                     whitespace-nowrap z-50 animate-in fade-in duration-200"
        >
          {content}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
                       border-4 border-transparent border-t-gray-900"
          />
        </span>
      )}
    </span>
  );
}
