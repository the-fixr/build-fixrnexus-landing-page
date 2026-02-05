'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  SunIcon,
  MoonIcon,
  EyeIcon,
  HeartIcon,
  ArrowPathRoundedSquareIcon,
  PhotoIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton, StatCard } from '../../components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://fixr-workers.jumpboxlabs.workers.dev';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface GMGNPreview {
  gm: string;
  gn: string;
  ships: Array<{
    name: string;
    url: string;
    description: string;
    type: string;
  }>;
}

export default function SocialPage() {
  const [postText, setPostText] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postingGM, setPostingGM] = useState(false);
  const [postingGN, setPostingGN] = useState(false);

  const { data: gmgnPreview, mutate: refreshGMGN } = useSWR<GMGNPreview>(
    `${API_BASE}/api/gmgn/preview`,
    fetcher
  );

  const { data: analyticsData } = useSWR(
    `${API_BASE}/api/analytics/casts?limit=10`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const handlePost = async () => {
    if (!postText.trim()) {
      toast.error('Please enter some text');
      return;
    }

    setIsPosting(true);
    try {
      const body: Record<string, string> = { text: postText };
      if (embedUrl.trim()) {
        body.embedUrl = embedUrl;
      }

      const res = await fetch(`${API_BASE}/api/farcaster/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (result.success) {
        toast.success('Posted to Farcaster!');
        setPostText('');
        setEmbedUrl('');
      } else {
        toast.error(result.error || 'Failed to post');
      }
    } catch {
      toast.error('Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostGM = async () => {
    setPostingGM(true);
    try {
      const res = await fetch(`${API_BASE}/api/gm`, { method: 'POST' });
      const result = await res.json();

      if (result.success) {
        toast.success('GM posted!');
        refreshGMGN();
      } else {
        toast.error(result.error || 'Failed to post GM');
      }
    } catch {
      toast.error('Failed to post GM');
    } finally {
      setPostingGM(false);
    }
  };

  const handlePostGN = async () => {
    setPostingGN(true);
    try {
      const res = await fetch(`${API_BASE}/api/gn`, { method: 'POST' });
      const result = await res.json();

      if (result.success) {
        toast.success('GN posted!');
        refreshGMGN();
      } else {
        toast.error(result.error || 'Failed to post GN');
      }
    } catch {
      toast.error('Failed to post GN');
    } finally {
      setPostingGN(false);
    }
  };

  const totalEngagement = analyticsData?.summary?.totalEngagement || 0;
  const totalCasts = analyticsData?.summary?.totalCasts || 0;
  const avgEngagement = analyticsData?.summary?.avgEngagement || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Social Media</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage Farcaster posts and engagement
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Casts"
          value={totalCasts}
          icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Total Engagement"
          value={totalEngagement}
          icon={<HeartIcon className="w-5 h-5" />}
          color="pink"
        />
        <StatCard
          label="Avg. Engagement"
          value={Math.round(avgEngagement)}
          icon={<ArrowPathRoundedSquareIcon className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Ships"
          value={gmgnPreview?.ships?.length || 0}
          icon={<LinkIcon className="w-5 h-5" />}
          color="green"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Compose Cast */}
        <AdminCard title="Compose Cast" subtitle="Post to Farcaster">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Message
              </label>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="What's happening in the builder world?"
                rows={4}
                maxLength={320}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {postText.length}/320 characters
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Embed URL (optional)
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <ActionButton
              onClick={handlePost}
              loading={isPosting}
              className="w-full"
              icon={<PaperAirplaneIcon className="w-4 h-4" />}
            >
              Post to Farcaster
            </ActionButton>
          </div>
        </AdminCard>

        {/* GM/GN Controls */}
        <AdminCard title="GM/GN Posts" subtitle="Daily builder motivation">
          <div className="space-y-4">
            {/* GM Preview */}
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <SunIcon className="w-5 h-5 text-yellow-400" />
                <span className="font-medium text-yellow-400">GM Preview</span>
              </div>
              <p className="text-sm text-gray-300 italic">
                "{gmgnPreview?.gm || 'Loading...'}"
              </p>
              <ActionButton
                variant="secondary"
                onClick={handlePostGM}
                loading={postingGM}
                className="w-full mt-3"
                icon={<SunIcon className="w-4 h-4" />}
              >
                Post GM Now
              </ActionButton>
            </div>

            {/* GN Preview */}
            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <MoonIcon className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-purple-400">GN Preview</span>
              </div>
              <p className="text-sm text-gray-300 italic">
                "{gmgnPreview?.gn || 'Loading...'}"
              </p>
              <ActionButton
                variant="secondary"
                onClick={handlePostGN}
                loading={postingGN}
                className="w-full mt-3"
                icon={<MoonIcon className="w-4 h-4" />}
              >
                Post GN Now
              </ActionButton>
            </div>

            <ActionButton
              variant="ghost"
              onClick={() => refreshGMGN()}
              className="w-full"
            >
              Shuffle Messages
            </ActionButton>
          </div>
        </AdminCard>
      </div>

      {/* Recent Casts */}
      <AdminCard title="Recent Casts" subtitle="Latest Farcaster activity">
        <div className="space-y-3">
          {analyticsData?.casts?.slice(0, 5).map((cast: {
            hash: string;
            text: string;
            likes: number;
            recasts: number;
            replies: number;
            timestamp: string;
          }) => (
            <motion.div
              key={cast.hash}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gray-800/30 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <p className="text-sm text-gray-300 line-clamp-2">{cast.text}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <HeartIcon className="w-3.5 h-3.5" />
                    {cast.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowPathRoundedSquareIcon className="w-3.5 h-3.5" />
                    {cast.recasts}
                  </span>
                  <span className="flex items-center gap-1">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                    {cast.replies}
                  </span>
                </div>
                <span className="text-xs text-gray-600">
                  {new Date(cast.timestamp).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          )) || (
            <p className="text-gray-500 text-sm text-center py-8">No recent casts</p>
          )}
        </div>
      </AdminCard>

      {/* Fixr Ships */}
      <AdminCard title="Fixr Ships" subtitle="Projects to promote">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gmgnPreview?.ships?.map((ship) => (
            <motion.a
              key={ship.name}
              href={ship.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-gray-800/30 rounded-xl border border-gray-800 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded uppercase">
                  {ship.type}
                </span>
              </div>
              <h4 className="font-bold text-white">{ship.name}</h4>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {ship.description}
              </p>
            </motion.a>
          )) || (
            <p className="text-gray-500 text-sm col-span-3 text-center py-4">
              Loading ships...
            </p>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
