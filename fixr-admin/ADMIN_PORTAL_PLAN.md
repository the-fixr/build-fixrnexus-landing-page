# Fixr Admin Portal - Implementation Plan

## Overview
A spectacular, feature-rich admin portal at `/admin` in the fixr-mini-app to manage and control the Fixr agent with smooth animations, real-time data, and comprehensive controls.

## Tech Stack
- **Framework**: Next.js 16 App Router (existing)
- **Styling**: Tailwind CSS dark theme (#0a0a0a base)
- **Animations**: Framer Motion for smooth transitions
- **Charts**: Recharts (already in hub page)
- **Auth**: Wallet-based tier guard (BUILDER/PRO/ELITE access)
- **State**: React hooks + SWR for data fetching
- **Notifications**: Sonner toast library

## Route Structure
```
/admin                    → Dashboard overview
/admin/tasks              → Task management
/admin/social             → Social media controls
/admin/video              → Video generation
/admin/analytics          → Detailed analytics
/admin/builders           → Builder management
/admin/config             → Agent configuration
/admin/wallet             → Wallet & staking
```

## 8 Admin Sections

### 1. Dashboard (Main Overview)
- Real-time agent status indicators
- Quick stats cards (tasks, posts, videos, builders)
- Recent activity feed
- System health metrics
- Quick action buttons

### 2. Tasks Management
- View all tasks with filters (status, chain, date)
- Create new tasks manually
- Approve/reject pending tasks
- Cancel running tasks
- Task history with execution logs
- Bulk operations

### 3. Social Media Controls
- **Farcaster**:
  - Post composer with preview
  - View recent casts with engagement stats
  - GM/GN toggle and schedule
  - Builder spotlight queue
  - Trending topics feed
- **X/Twitter**:
  - Post scheduler
  - Analytics view
- **Paragraph**:
  - Newsletter drafts
  - Publish controls

### 4. Video Generation
- Generate video from prompt (WaveSpeedAI)
- Generate stats images (Gemini)
- Upload to Livepeer
- Video gallery with status
- Post video to social (image+link workflow)
- Credit usage tracker

### 5. Analytics Dashboard
- Cast performance charts (likes, recasts, replies)
- Token scanner usage
- API call volumes
- Builder engagement trends
- Revenue/tier analytics
- Export data (CSV)

### 6. Builder Management
- Search builders by FID/username
- View builder profiles and scores
- Feature/spotlight builders
- Builder ID NFT minting controls
- Leaderboard management

### 7. Configuration
- Agent behavior toggles:
  - Auto-posting enabled/disabled
  - GM/GN times and messages
  - Response templates
  - Negative prompts for video
- API key management
- Rate limit settings
- Chain priorities

### 8. Wallet & Staking
- Connected wallet info
- FIXR token balance
- Staking controls (when live)
- Transaction history
- Tier upgrade prompts

## UI Components

### Layout
```tsx
AdminLayout
├── Sidebar (collapsible)
│   ├── Logo
│   ├── NavItems with icons
│   └── User/Wallet info
├── TopBar
│   ├── Breadcrumbs
│   ├── Search
│   └── Notifications bell
└── MainContent
    └── Page content with animations
```

### Shared Components
- `AdminCard` - Glassmorphism cards with hover effects
- `DataTable` - Sortable, filterable tables
- `StatCard` - Animated number counters
- `ActionButton` - Primary/secondary with loading states
- `StatusBadge` - Color-coded status indicators
- `ConfirmModal` - Confirmation dialogs
- `Toast` - Success/error notifications

### Animations
- Page transitions: Framer Motion fade + slide
- Card hover: Scale + glow effect
- Number changes: Animated counting
- Loading: Skeleton pulse
- Success: Confetti burst

## API Endpoints Used
Connecting to existing Workers API:
- `/api/status` - Agent status
- `/api/tasks` - Task CRUD
- `/api/social/*` - Social media
- `/api/farcaster/*` - Farcaster specific
- `/api/video/*` - Video generation
- `/api/analytics/*` - Cast analytics
- `/api/builders/*` - Builder data
- `/api/config/*` - Configuration
- `/api/livepeer/*` - Video hosting

## Auth Guard
```tsx
// Require BUILDER tier or higher
const AdminGuard = ({ children }) => {
  const { tier } = useWallet();
  if (!['BUILDER', 'PRO', 'ELITE'].includes(tier)) {
    return <AccessDenied />;
  }
  return children;
};
```

## Implementation Order

### Phase 1: Foundation
1. Create `/admin` route with layout
2. Build sidebar navigation
3. Implement auth guard
4. Create shared components (AdminCard, StatCard, etc.)

### Phase 2: Core Features
5. Dashboard with real-time stats
6. Tasks management page
7. Social media controls (Farcaster focus)

### Phase 3: Advanced Features
8. Video generation interface
9. Analytics dashboard with charts
10. Builder management

### Phase 4: Configuration
11. Agent config page
12. Wallet integration
13. Polish and animations

## File Structure
```
app/admin/
├── layout.tsx              # Admin layout with sidebar
├── page.tsx                # Dashboard
├── tasks/
│   └── page.tsx
├── social/
│   └── page.tsx
├── video/
│   └── page.tsx
├── analytics/
│   └── page.tsx
├── builders/
│   └── page.tsx
├── config/
│   └── page.tsx
└── wallet/
    └── page.tsx

components/admin/
├── AdminLayout.tsx
├── Sidebar.tsx
├── AdminCard.tsx
├── DataTable.tsx
├── StatCard.tsx
├── ActionButton.tsx
├── StatusBadge.tsx
├── ConfirmModal.tsx
└── charts/
    ├── EngagementChart.tsx
    └── UsageChart.tsx
```

## Design Specs
- Background: `#0a0a0a` (matches existing)
- Cards: `bg-gray-900/50 backdrop-blur border border-gray-800`
- Accent: Pink/Purple gradient (`from-pink-500 to-purple-500`)
- Text: White primary, `text-gray-400` secondary
- Success: `text-green-400`
- Warning: `text-yellow-400`
- Error: `text-red-400`
- Border radius: `rounded-xl` (12px)
- Shadows: Subtle glow on hover

## Dependencies to Add
```json
{
  "framer-motion": "^11.x",
  "sonner": "^1.x",
  "swr": "^2.x",
  "@heroicons/react": "^2.x"
}
```
