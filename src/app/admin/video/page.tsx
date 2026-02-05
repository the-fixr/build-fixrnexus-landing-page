'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  VideoCameraIcon,
  PhotoIcon,
  SparklesIcon,
  PlayIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton, StatusBadge, StatCard } from '@/components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://agent.fixr.nexus';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface VideoTask {
  taskId: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  prompt: string;
  createdAt: Date;
}

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
];

const DURATIONS = [
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
];

export default function VideoPage() {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [withSound, setWithSound] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState<VideoTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Weekly recap state
  const [isPostingRecap, setIsPostingRecap] = useState(false);
  const [recapVideoUrl, setRecapVideoUrl] = useState<string | null>(null);

  const { data: modelsData } = useSWR(`${API_BASE}/api/video/models`, fetcher);

  // Poll for video status
  useEffect(() => {
    if (!activeTask || activeTask.status === 'completed' || activeTask.status === 'failed') {
      return;
    }

    const pollStatus = async () => {
      setIsPolling(true);
      try {
        const res = await fetch(`${API_BASE}/api/video/status/${activeTask.taskId}`);
        const data = await res.json();

        if (data.success) {
          setActiveTask((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.status,
                  videoUrl: data.videoUrl,
                }
              : null
          );

          if (data.status === 'completed') {
            toast.success('Video generation complete!');
          } else if (data.status === 'failed') {
            toast.error('Video generation failed');
          }
        }
      } catch {
        console.error('Failed to poll status');
      } finally {
        setIsPolling(false);
      }
    };

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [activeTask]);

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration,
          aspectRatio,
          sound: withSound,
        }),
      });
      const data = await res.json();

      if (data.success && data.taskId) {
        setActiveTask({
          taskId: data.taskId,
          status: data.status || 'created',
          prompt,
          createdAt: new Date(),
        });
        toast.success('Video generation started');
      } else {
        toast.error(data.error || 'Failed to start generation');
      }
    } catch {
      toast.error('Failed to start generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const res = await fetch(`${API_BASE}/api/video/stats-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippedCount: 42,
          topBuilder: 'builder',
          topTopic: 'DeFi',
          period: 'This Week',
        }),
      });
      const data = await res.json();

      if (data.success && data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        toast.success('Image generated!');
      } else {
        toast.error(data.error || 'Failed to generate image');
      }
    } catch {
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handlePostWeeklyRecap = async () => {
    setIsPostingRecap(true);
    try {
      const res = await fetch(`${API_BASE}/api/video/post-recap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats: {
            shippedCount: 42,
            topBuilder: 'vitalik',
            topTopic: 'DeFi',
          },
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Weekly recap posted!');
        if (data.videoUrl) {
          setRecapVideoUrl(data.videoUrl);
        }
      } else {
        toast.error(data.error || 'Failed to post recap');
      }
    } catch {
      toast.error('Failed to post recap');
    } finally {
      setIsPostingRecap(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Video Generation</h1>
        <p className="text-gray-400 text-sm mt-1">
          Generate AI videos with WaveSpeedAI and host on Livepeer
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Models Available"
          value={modelsData?.models?.length || 3}
          icon={<SparklesIcon className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Max Duration"
          value={10}
          suffix="s"
          icon={<ClockIcon className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Active Task"
          value={activeTask && !['completed', 'failed'].includes(activeTask.status) ? 1 : 0}
          icon={<ArrowPathIcon className="w-5 h-5" />}
          color={activeTask && !['completed', 'failed'].includes(activeTask.status) ? 'yellow' : 'default'}
        />
        <StatCard
          label="Livepeer"
          value={1}
          icon={<CloudArrowUpIcon className="w-5 h-5" />}
          color="green"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Video Generation */}
        <AdminCard title="Generate Video" subtitle="AI video from text prompt">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video you want to generate..."
                rows={4}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  {ASPECT_RATIOS.map((ar) => (
                    <option key={ar.value} value={ar.value}>
                      {ar.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={withSound}
                onChange={(e) => setWithSound(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-300">Include audio</span>
            </label>

            <ActionButton
              onClick={handleGenerateVideo}
              loading={isGenerating}
              className="w-full"
              icon={<VideoCameraIcon className="w-4 h-4" />}
            >
              Generate Video
            </ActionButton>
          </div>
        </AdminCard>

        {/* Active Task / Preview */}
        <AdminCard title="Generation Status" subtitle="Current video task">
          {activeTask ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <StatusBadge
                  status={activeTask.status}
                  pulse={activeTask.status === 'processing'}
                />
                {isPolling && (
                  <ArrowPathIcon className="w-4 h-4 text-gray-500 animate-spin" />
                )}
              </div>

              <div className="p-3 bg-gray-800/30 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Prompt:</p>
                <p className="text-sm text-gray-300 line-clamp-3">{activeTask.prompt}</p>
              </div>

              {activeTask.videoUrl && (
                <div className="space-y-3">
                  <video
                    src={activeTask.videoUrl}
                    controls
                    className="w-full rounded-lg"
                  />
                  <div className="flex gap-2">
                    <a
                      href={activeTask.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <ActionButton variant="secondary" className="w-full">
                        Open Video
                      </ActionButton>
                    </a>
                    <ActionButton
                      variant="primary"
                      className="flex-1"
                      icon={<CloudArrowUpIcon className="w-4 h-4" />}
                    >
                      Upload to Livepeer
                    </ActionButton>
                  </div>
                </div>
              )}

              {activeTask.status === 'processing' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Generating video...</p>
                  <p className="text-xs text-gray-600 mt-1">This may take a few minutes</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <VideoCameraIcon className="w-12 h-12 mx-auto text-gray-700 mb-3" />
              <p className="text-gray-500">No active generation</p>
              <p className="text-xs text-gray-600 mt-1">
                Start a new video generation to see status here
              </p>
            </div>
          )}
        </AdminCard>
      </div>

      {/* Quick Actions */}
      <AdminCard title="Quick Actions" subtitle="Pre-configured video workflows">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <SparklesIcon className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="font-bold text-white">Weekly Recap</h4>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Generate and post the weekly builder stats recap with video
            </p>
            <ActionButton
              onClick={handlePostWeeklyRecap}
              loading={isPostingRecap}
              className="w-full"
              icon={<PaperAirplaneIcon className="w-4 h-4" />}
            >
              Post Weekly Recap
            </ActionButton>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <PhotoIcon className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="font-bold text-white">Stats Image</h4>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Generate a stats infographic with Gemini Imagen
            </p>
            <ActionButton
              variant="secondary"
              onClick={handleGenerateImage}
              loading={isGeneratingImage}
              className="w-full"
              icon={<PhotoIcon className="w-4 h-4" />}
            >
              Generate Image
            </ActionButton>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CloudArrowUpIcon className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="font-bold text-white">Livepeer Upload</h4>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Upload an existing video URL to Livepeer for hosting
            </p>
            <ActionButton variant="secondary" className="w-full" disabled>
              Coming Soon
            </ActionButton>
          </motion.div>
        </div>
      </AdminCard>

      {/* Generated Content */}
      {(generatedImageUrl || recapVideoUrl) && (
        <AdminCard title="Generated Content" subtitle="Recent outputs">
          <div className="grid sm:grid-cols-2 gap-4">
            {generatedImageUrl && (
              <div className="p-4 bg-gray-800/30 rounded-xl">
                <p className="text-sm font-medium text-gray-400 mb-2">Stats Image</p>
                <img
                  src={generatedImageUrl}
                  alt="Generated stats"
                  className="w-full rounded-lg"
                />
              </div>
            )}
            {recapVideoUrl && (
              <div className="p-4 bg-gray-800/30 rounded-xl">
                <p className="text-sm font-medium text-gray-400 mb-2">Recap Video</p>
                <video
                  src={recapVideoUrl}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
