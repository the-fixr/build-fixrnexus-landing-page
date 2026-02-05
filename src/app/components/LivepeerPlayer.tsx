'use client';

import { useState, useEffect } from 'react';

interface Video {
  playbackId: string;
  title?: string;
  thumbnail?: string;
}

interface LivepeerPlayerProps {
  playbackId?: string;
  videos?: Video[];
  className?: string;
}

export function LivepeerPlayer({
  playbackId: initialPlaybackId,
  videos: propVideos,
  className = ''
}: LivepeerPlayerProps) {
  const [videos, setVideos] = useState<Video[]>(propVideos || []);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(
    initialPlaybackId ? { playbackId: initialPlaybackId } : null
  );
  const [loading, setLoading] = useState(!propVideos && !initialPlaybackId);
  const [error, setError] = useState<string | null>(null);

  // Fetch videos from API if not provided
  useEffect(() => {
    if (propVideos || initialPlaybackId) return;

    const fetchVideos = async () => {
      try {
        const res = await fetch('/api/videos');
        const data = await res.json();
        if (data.success && data.videos?.length > 0) {
          setVideos(data.videos);
          setCurrentVideo(data.videos[0]);
        } else {
          setError('No videos configured');
        }
      } catch (err) {
        console.error('Failed to fetch videos:', err);
        setError('Failed to load videos');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [propVideos, initialPlaybackId]);

  if (loading) {
    return (
      <div className={`relative aspect-video bg-gray-900/50 rounded-xl overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || (!currentVideo && videos.length === 0)) {
    return (
      <div className={`relative aspect-video bg-gray-900/50 rounded-xl overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4">
          <span className="text-2xl mb-2">🎬</span>
          <span className="text-sm text-center">{error || 'No videos available'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Player - Using Livepeer iframe embed */}
      <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${className}`}>
        {currentVideo && (
          <iframe
            src={`https://lvpr.tv/?v=${currentVideo.playbackId}`}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>

      {/* Title */}
      {currentVideo?.title && (
        <p className="text-sm text-gray-400 truncate">{currentVideo.title}</p>
      )}

      {/* Video selector (if multiple) */}
      {videos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {videos.map((video) => (
            <button
              key={video.playbackId}
              onClick={() => setCurrentVideo(video)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-all ${
                currentVideo?.playbackId === video.playbackId
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {video.title || video.playbackId.slice(0, 8)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
