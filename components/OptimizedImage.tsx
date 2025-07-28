import { useState, useCallback, useRef, useEffect } from 'react';
import { Skeleton } from './ui/skeleton';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  lazy?: boolean;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder,
  lazy = true,
  quality = 80,
  onLoad,
  onError
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, isInView]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsError(true);
    onError?.();
  }, [onError]);

  // Generate optimized src with quality parameter if supported
  const optimizedSrc = useCallback((originalSrc: string) => {
    // For external images, we can't optimize them directly
    // But we can add quality parameters for supported services
    if (originalSrc.includes('unsplash.com')) {
      return `${originalSrc}&q=${quality}&auto=format`;
    }
    if (originalSrc.includes('cloudinary.com')) {
      return originalSrc.replace('/upload/', `/upload/q_${quality},f_auto/`);
    }
    return originalSrc;
  }, [quality]);

  // Generate responsive srcSet for better performance
  const generateSrcSet = useCallback((originalSrc: string) => {
    if (!width) return undefined;
    
    const sizes = [1, 1.5, 2, 3];
    return sizes
      .map(scale => {
        const scaledWidth = Math.round(width * scale);
        let scaledSrc = originalSrc;
        
        // Add width parameter for supported services
        if (originalSrc.includes('unsplash.com')) {
          scaledSrc = `${originalSrc}&w=${scaledWidth}`;
        } else if (originalSrc.includes('cloudinary.com')) {
          scaledSrc = originalSrc.replace('/upload/', `/upload/w_${scaledWidth}/`);
        }
        
        return `${scaledSrc} ${scale}x`;
      })
      .join(', ');
  }, [width]);

  if (!isInView) {
    return (
      <div
        ref={imgRef}
        className={`${className} bg-muted`}
        style={{ width, height }}
      >
        {placeholder ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {placeholder}
          </div>
        ) : (
          <Skeleton className="w-full h-full" />
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={`${className} bg-muted border border-border flex items-center justify-center`}
        style={{ width, height }}
      >
        <div className="text-muted-foreground text-sm text-center p-4">
          <div className="mb-2">⚠️</div>
          <div>Failed to load image</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {!isLoaded && (
        <div className="absolute inset-0">
          {placeholder ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm bg-muted">
              {placeholder}
            </div>
          ) : (
            <Skeleton className="w-full h-full" />
          )}
        </div>
      )}
      <img
        ref={imgRef}
        src={optimizedSrc(src)}
        srcSet={generateSrcSet(src)}
        alt={alt}
        width={width}
        height={height}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        onLoad={handleLoad}
        onError={handleError}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        style={{
          maxWidth: '100%',
          height: 'auto',
          ...(!isLoaded && { position: 'absolute', top: 0, left: 0 })
        }}
      />
    </div>
  );
}

// Hook for preloading images
export function useImagePreloader() {
  const preloadedImages = useRef<Set<string>>(new Set());

  const preloadImage = useCallback((src: string): Promise<void> => {
    if (preloadedImages.current.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        preloadedImages.current.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const preloadImages = useCallback(async (srcs: string[]): Promise<void> => {
    const promises = srcs.map(src => preloadImage(src));
    await Promise.allSettled(promises);
  }, [preloadImage]);

  return { preloadImage, preloadImages };
}

// Component for critical images that should load immediately
export function CriticalImage(props: OptimizedImageProps) {
  return <OptimizedImage {...props} lazy={false} />;
}

// Component for background images with better performance
interface OptimizedBackgroundImageProps {
  src: string;
  children: React.ReactNode;
  className?: string;
  lazy?: boolean;
  quality?: number;
}

export function OptimizedBackgroundImage({
  src,
  children,
  className = '',
  lazy = true,
  quality = 80
}: OptimizedBackgroundImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isInView]);

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.src = src;
  }, [src, isInView]);

  return (
    <div
      ref={containerRef}
      className={`${className} transition-all duration-300`}
      style={{
        backgroundImage: isLoaded ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {children}
    </div>
  );
}