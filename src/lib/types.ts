// Fixr Agent Types

export type TaskStatus = 'pending' | 'planning' | 'awaiting_approval' | 'approved' | 'executing' | 'completed' | 'failed';

export type Chain = 'ethereum' | 'base' | 'monad' | 'solana';

export interface Task {
  id: string;
  title: string;
  description: string;
  chain?: Chain;
  status: TaskStatus;
  plan?: Plan;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  taskId: string;
  summary: string;
  steps: PlanStep[];
  estimatedTime: string;
  risks: string[];
  createdAt: string;
  approvedAt?: string;
}

export interface PlanStep {
  order: number;
  action: 'code' | 'deploy' | 'contract' | 'post' | 'other';
  description: string;
  details: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  outputs: TaskOutput[];
  error?: string;
  completedAt: string;
  // For resumable execution - tracks which steps are done
  executionProgress?: {
    lastCompletedStep: number;
    totalSteps: number;
    startedAt: string;
  };
}

export interface TaskOutput {
  type: 'repo' | 'deployment' | 'contract' | 'post' | 'file';
  url?: string;
  data?: Record<string, unknown>;
}

export interface AgentMemory {
  identity: {
    name: string;
    tagline: string;
    email: string;
    socials: {
      x: string;
      farcaster: string;
      website: string;
    };
  };
  goals: string[];
  tasks: Task[];
  completedProjects: CompletedProject[];
  wallets: {
    ethereum: string;
    solana: string;
  };
}

export interface CompletedProject {
  id: string;
  name: string;
  description: string;
  chain: Chain;
  urls: {
    repo?: string;
    deployment?: string;
    contract?: string;
    post?: string;
  };
  completedAt: string;
}

export interface ApprovalRequest {
  id: string;
  planId: string;
  taskId: string;
  sentAt: string;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt?: string;
}

// Email types
export interface PlanEmail {
  to: string;
  subject: string;
  plan: Plan;
  task: Task;
  approvalLink: string;
  rejectLink: string;
}
