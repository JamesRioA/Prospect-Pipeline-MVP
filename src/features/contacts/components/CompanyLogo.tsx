'use client';

import { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';

interface CompanyLogoProps {
  logoUrl?: string | null;
  name?: string;
  className?: string;
}

export default function CompanyLogo({ logoUrl, name, className = 'h-5 w-5' }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  if (logoUrl && !hasError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name ? `${name} logo` : 'Company logo'}
        className={`${className} rounded object-contain`}
        onError={() => setHasError(true)}
      />
    );
  }

  return <Briefcase className={`${className} text-foreground/45 flex-shrink-0`} />;
}
