interface LoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loader({ message = 'Lade...', size = 'md' }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div
          className={`animate-spin border-primary border-t-transparent rounded-full mx-auto mb-4 ${sizeClasses[size]}`}
        />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}



