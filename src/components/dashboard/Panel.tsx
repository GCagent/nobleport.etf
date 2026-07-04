import React from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}

export function Panel({ title, subtitle, actions, children, padded = true, className }: PanelProps) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <header className="panel-h">
        <div className="flex items-baseline gap-3">
          <h2 className="panel-title">{title}</h2>
          {subtitle && <span className="panel-subtitle">{subtitle}</span>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className={padded ? 'panel-pad' : ''}>{children}</div>
    </section>
  );
}
