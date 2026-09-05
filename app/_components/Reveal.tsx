'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Grafted scroll-reveal (portfolio signature): adds .is-visible on intersect.
// Purely visual; wraps content without altering it.
export function Reveal({ children, className = '', stagger = false }: { children: ReactNode; className?: string; stagger?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`${stagger ? 'kc-stagger' : 'kc-reveal'} ${className}`}>{children}</div>;
}
