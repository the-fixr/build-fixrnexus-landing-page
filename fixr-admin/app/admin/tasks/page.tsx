'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import {
  AdminCard,
  ActionButton,
  StatusBadge,
  DataTable,
  ConfirmModal,
} from '../../components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://fixr-workers.jumpboxlabs.workers.dev';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  chain?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  'all',
  'pending',
  'planning',
  'awaiting_approval',
  'approved',
  'executing',
  'completed',
  'failed',
];

const CHAIN_OPTIONS = ['all', 'base', 'ethereum', 'solana', 'monad'];

export default function TasksPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chainFilter, setChainFilter] = useState('all');
  const [newTask, setNewTask] = useState({ title: '', description: '', chain: 'base' });
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, mutate, isLoading } = useSWR<{ tasks: Task[] }>(
    `${API_BASE}/api/tasks`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const tasks = data?.tasks || [];

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesChain = chainFilter === 'all' || task.chain === chainFilter;
    return matchesSearch && matchesStatus && matchesChain;
  });

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const result = await res.json();

      if (result.success) {
        toast.success('Task created successfully');
        setShowCreateModal(false);
        setNewTask({ title: '', description: '', chain: 'base' });
        mutate();
      } else {
        toast.error(result.error || 'Failed to create task');
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(`Task ${newStatus}`);
        mutate();
      } else {
        toast.error(result.error || 'Failed to update task');
      }
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTask.id, status: 'deleted' }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success('Task deleted');
        setShowDeleteModal(false);
        setSelectedTask(null);
        mutate();
      } else {
        toast.error(result.error || 'Failed to delete task');
      }
    } catch {
      toast.error('Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      render: (task: Task) => (
        <div>
          <p className="font-medium text-white">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
              {task.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (task: Task) => <StatusBadge status={task.status} pulse={task.status === 'executing'} />,
    },
    {
      key: 'chain',
      header: 'Chain',
      sortable: true,
      render: (task: Task) => (
        <span className="text-gray-400 text-sm capitalize">{task.chain || '-'}</span>
      ),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      render: (task: Task) => (
        <span className="text-gray-500 text-sm">
          {new Date(task.updated_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (task: Task) => (
        <div className="flex items-center gap-1">
          {task.status === 'pending' && (
            <ActionButton
              variant="success"
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                handleUpdateStatus(task.id, 'approved');
              }}
              icon={<CheckIcon className="w-3 h-3" />}
            >
              Approve
            </ActionButton>
          )}
          {task.status === 'approved' && (
            <ActionButton
              variant="primary"
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                handleUpdateStatus(task.id, 'executing');
              }}
              icon={<PlayIcon className="w-3 h-3" />}
            >
              Execute
            </ActionButton>
          )}
          {task.status === 'executing' && (
            <ActionButton
              variant="danger"
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                handleUpdateStatus(task.id, 'failed');
              }}
              icon={<StopIcon className="w-3 h-3" />}
            >
              Stop
            </ActionButton>
          )}
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e?.stopPropagation();
              setSelectedTask(task);
              setShowDeleteModal(true);
            }}
            icon={<TrashIcon className="w-3 h-3" />}
          />
        </div>
      ),
    },
  ];

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    executing: tasks.filter((t) => t.status === 'executing').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-gray-400 text-sm mt-1">Manage agent tasks and workflows</p>
        </div>
        <ActionButton
          onClick={() => setShowCreateModal(true)}
          icon={<PlusIcon className="w-4 h-4" />}
        >
          New Task
        </ActionButton>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.executing}</p>
          <p className="text-xs text-gray-500">Executing</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <AdminCard>
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <XMarkIcon className="w-4 h-4 text-gray-500 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>

          {/* Chain Filter */}
          <select
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            {CHAIN_OPTIONS.map((chain) => (
              <option key={chain} value={chain}>
                {chain === 'all' ? 'All Chains' : chain}
              </option>
            ))}
          </select>
        </div>
      </AdminCard>

      {/* Tasks Table */}
      <AdminCard noPadding>
        <DataTable
          data={filteredTasks}
          columns={columns}
          keyExtractor={(task) => task.id}
          loading={isLoading}
          emptyMessage="No tasks found"
          pageSize={10}
        />
      </AdminCard>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-800">
                  <h3 className="text-lg font-bold text-white">Create New Task</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g., Deploy token scanner to Base"
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Detailed task description..."
                      rows={3}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Chain
                    </label>
                    <select
                      value={newTask.chain}
                      onChange={(e) => setNewTask({ ...newTask, chain: e.target.value })}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="base">Base</option>
                      <option value="ethereum">Ethereum</option>
                      <option value="solana">Solana</option>
                      <option value="monad">Monad</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800">
                  <ActionButton variant="ghost" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </ActionButton>
                  <ActionButton onClick={handleCreateTask} loading={isCreating}>
                    Create Task
                  </ActionButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTask(null);
        }}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${selectedTask?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
