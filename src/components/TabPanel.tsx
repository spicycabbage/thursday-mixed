'use client';

import { ReactNode } from 'react';

interface TabPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}

export default function TabPanel({ title, subtitle, icon, toolbar, children }: TabPanelProps) {
  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="text-lg font-bold text-gray-900 truncate">{title}</h3>
        </div>
        {subtitle && (
          <span className="tab-meta shrink-0 ml-2">{subtitle}</span>
        )}
      </div>

      <div className="tab-panel-toolbar">
        {toolbar ?? <span className="tab-toolbar-hint">&nbsp;</span>}
      </div>

      <div className="tab-panel-body space-y-3">{children}</div>
    </div>
  );
}
