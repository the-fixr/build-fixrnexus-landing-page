'use client';

import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  showCount?: number;
}

export default function StarRating({
  rating,
  onChange,
  size = 20,
  readonly = false,
  showCount,
}: StarRatingProps) {
  const handleClick = (value: number) => {
    if (!readonly && onChange) {
      onChange(value);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => {
        const isFilled = value <= Math.round(rating);
        const isHalf = !isFilled && value - 0.5 <= rating;

        return (
          <button
            key={value}
            type="button"
            onClick={() => handleClick(value)}
            disabled={readonly}
            className={`${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            } transition-transform`}
          >
            <Star
              size={size}
              className={`${
                isFilled
                  ? 'text-yellow-400 fill-current'
                  : isHalf
                  ? 'text-yellow-400 fill-current opacity-50'
                  : 'text-gray-600'
              }`}
            />
          </button>
        );
      })}
      {showCount !== undefined && (
        <span className="text-sm text-gray-500 ml-1">({showCount})</span>
      )}
    </div>
  );
}
