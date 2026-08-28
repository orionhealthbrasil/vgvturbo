import logoVgvTurbo from '@/assets/Logo-VGVTurbo.png';

interface VGVTurboLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon' | 'text';
}

export function VGVTurboLogo({ size = 'md' }: VGVTurboLogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-28',
  };

  return (
    <img
      src={logoVgvTurbo}
      alt="VGV Turbo"
      className={`${sizeClasses[size]} w-auto object-contain`}
    />
  );
}

export function VGVTurboIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <img
      src={logoVgvTurbo}
      alt="VGV Turbo"
      className={`${className} object-contain`}
    />
  );
}
