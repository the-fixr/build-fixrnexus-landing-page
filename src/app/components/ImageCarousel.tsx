'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FixrImage {
  url: string;
  title?: string;
  created_at?: string;
}

interface ImageCarouselProps {
  images?: FixrImage[];
  interval?: number;
  className?: string;
}

export function ImageCarousel({
  images: propImages,
  interval = 2500,
  className = ''
}: ImageCarouselProps) {
  const [images, setImages] = useState<FixrImage[]>(propImages || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(!propImages);

  // Fetch images from worker API
  useEffect(() => {
    if (propImages) return;

    const fetchImages = async () => {
      try {
        // Fetch from worker which has Supabase access
        const res = await fetch('https://fixr-agent.see21289.workers.dev/api/fixr/images');
        const data = await res.json();
        if (data.success && data.images && data.images.length > 0) {
          setImages(data.images);
        }
      } catch (error) {
        console.error('Failed to fetch images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [propImages]);

  // Auto-advance carousel
  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);

    return () => clearInterval(timer);
  }, [images.length, interval]);

  // Calculate visible images (show 5 stacked cards)
  const visibleImages = useMemo(() => {
    if (images.length === 0) return [];

    const result = [];
    for (let i = 0; i < Math.min(5, images.length); i++) {
      const index = (currentIndex + i) % images.length;
      result.push({ ...images[index], stackIndex: i, originalIndex: index });
    }
    return result;
  }, [images, currentIndex]);

  if (loading) {
    return (
      <div className={`relative h-80 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={`relative h-80 bg-gray-900/30 rounded-2xl ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No images yet
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-80 ${className}`}>
      {/* Cascading cards */}
      <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
        <AnimatePresence mode="popLayout">
          {visibleImages.map((image, idx) => {
            const isActive = idx === 0;
            const depth = idx;

            // Calculate transforms based on stack position
            const scale = 1 - depth * 0.08;
            const translateY = depth * 12;
            const translateX = depth * 20;
            const rotateY = depth * -3;
            const opacity = 1 - depth * 0.2;
            const blur = depth * 1;
            const zIndex = 10 - depth;

            return (
              <motion.div
                key={`${image.originalIndex}-${currentIndex}`}
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
                initial={{
                  scale: 1.1,
                  x: -100,
                  opacity: 0,
                  rotateY: -15,
                }}
                animate={{
                  scale,
                  x: translateX,
                  y: translateY,
                  opacity,
                  rotateY,
                  filter: `blur(${blur}px)`,
                }}
                exit={{
                  scale: 0.8,
                  x: 200,
                  opacity: 0,
                  rotateY: 15,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
                style={{
                  zIndex,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Image */}
                <img
                  src={image.url}
                  alt={image.title || `Fixr creation`}
                  className="w-full h-full object-cover"
                />

                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10" />

                {/* Glow effect on active card */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      boxShadow: '0 0 60px rgba(168, 85, 247, 0.3), 0 0 100px rgba(236, 72, 153, 0.2)',
                    }}
                  />
                )}

                {/* Title on active card */}
                {isActive && image.title && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="absolute bottom-6 left-6 right-6"
                  >
                    <p className="text-white font-medium text-lg truncate drop-shadow-lg">
                      {image.title}
                    </p>
                  </motion.div>
                )}

                {/* Shine effect */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent"
                    initial={{ x: '-100%', opacity: 0 }}
                    animate={{ x: '100%', opacity: 1 }}
                    transition={{
                      duration: 1.5,
                      delay: 0.3,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: interval / 1000,
            ease: 'linear',
            repeat: Infinity,
          }}
          key={currentIndex}
        />
      </div>

      {/* Navigation dots */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {images.slice(0, Math.min(10, images.length)).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === currentIndex
                ? 'w-8 h-2 bg-gradient-to-r from-purple-500 to-pink-500'
                : 'w-2 h-2 bg-gray-600 hover:bg-gray-500'
            }`}
          />
        ))}
        {images.length > 10 && (
          <span className="text-xs text-gray-500 ml-2">+{images.length - 10}</span>
        )}
      </div>

      {/* Counter badge */}
      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
        <span className="text-sm font-medium text-white/80">
          {currentIndex + 1} / {images.length}
        </span>
      </div>
    </div>
  );
}
