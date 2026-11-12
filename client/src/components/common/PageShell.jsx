// Standard page wrappers: reading lane (720px) vs editorial feed grid (feed + right sidebar).
export const Reading = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-[calc(720px+2.5rem)] px-5 py-8 md:max-w-[calc(720px+6rem)] md:px-12 md:py-10 ${className}`}>
    {children}
  </div>
);

export const Wide = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-10 ${className}`}>
    {children}
  </div>
);

export const PageTitle = ({ children, sub, action }) => (
  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="font-display text-[28px] font-bold leading-[1.2] text-pine md:text-[32px]">{children}</h1>
      {sub && <p className="mt-2 text-on-surface-variant">{sub}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
