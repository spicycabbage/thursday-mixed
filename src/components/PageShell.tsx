'use client';

import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  centered?: boolean;
  /** Landing page only — keeps the narrow phone layout even on large screens */
  mobileOnly?: boolean;
  className?: string;
}

export function PageShell({
  children,
  centered = false,
  mobileOnly = false,
  className = '',
}: PageShellProps) {
  return (
    <div
      className={`page-shell ${centered ? 'page-shell-centered' : ''} ${
        mobileOnly ? 'page-shell-home' : ''
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}

interface PageCardProps {
  children: ReactNode;
  className?: string;
}

export function PageCard({ children, className = '' }: PageCardProps) {
  return <div className={`page-card ${className}`.trim()}>{children}</div>;
}

interface PageHeaderProps {
  href?: string;
  icon?: ReactNode;
  title: string;
  right?: ReactNode;
  className?: string;
}

export function PageHeader({ href = '/', icon, title, right, className = '' }: PageHeaderProps) {
  return (
    <div className={`page-header-bar ${className}`.trim()}>
      <Link href={href} className="page-back-link">
        <ChevronLeftIcon className="w-5 h-5 mr-1 shrink-0" />
        {icon && <span className="mr-2 shrink-0">{icon}</span>}
        <span className="truncate">{title}</span>
      </Link>
      {right}
    </div>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export function PageContent({ children, className = '' }: PageContentProps) {
  return <div className={`page-content ${className}`.trim()}>{children}</div>;
}

interface PageTitleBlockProps {
  title: string;
  subtitle?: string;
}

export function PageTitleBlock({ title, subtitle }: PageTitleBlockProps) {
  return (
    <div className="page-title-block">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <PageShell centered>
      <div className="text-white text-xl">{message}</div>
    </PageShell>
  );
}

type AppLinkButtonVariant = 'primary' | 'action' | 'success';

interface AppLinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: AppLinkButtonVariant;
  className?: string;
}

const linkButtonClass: Record<AppLinkButtonVariant, string> = {
  primary: 'app-btn-primary',
  action: 'app-btn-action',
  success: 'app-btn-success',
};

export function AppLinkButton({
  href,
  children,
  variant = 'action',
  className = '',
}: AppLinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${linkButtonClass[variant]} block text-center no-underline ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
