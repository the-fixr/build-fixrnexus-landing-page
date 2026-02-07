# Sign-Up Wizard & Enhanced Navigation

## Overview

A multi-step sign-up wizard has been added to FEEDS to provide a smooth onboarding experience for new users. The landing page navigation has also been enhanced with direct access to pricing and status pages.

---

## New Components

### SignupWizard Component

**Location:** [components/SignupWizard.tsx](components/SignupWizard.tsx)

**Features:**
- 4-step guided onboarding process
- Visual progress indicator
- Email verification flow
- Wallet connection integration
- Completion celebration screen

**Steps:**

#### Step 1: Email Signup
- Email address input
- Password creation (min. 6 characters)
- Account creation via Supabase Auth
- Terms of Service acknowledgment

#### Step 2: Email Verification
- Confirmation screen with email address
- Clear instructions for verification process
- Options to continue or defer

#### Step 3: Wallet Connection
- MetaMask/Web3 wallet integration
- Explanation of wallet benefits:
  - Deploy custom oracles on Base
  - Pay for subscriptions with USDC/ETH/$FEEDS
  - Manage oracle configurations
- Option to skip wallet connection

#### Step 4: Completion
- Success confirmation
- Next steps guidance:
  - Create first oracle
  - Explore pricing options
  - View network status
- Quick actions:
  - Go to Dashboard
  - View Pricing

---

## Enhanced Landing Page Navigation

**Location:** [app/page.tsx](app/page.tsx)

### Navigation Updates

**New Navigation Items:**
- PRICING - Direct link to `/pricing` page
- STATUS - Direct link to `/health` validator status

**Authentication Buttons:**

**For Guests:**
- **SIGN IN** - Opens existing AuthModal for returning users
- **GET STARTED** - Opens new SignupWizard for new users

**For Authenticated Users:**
- User email display with indicator
- **DASHBOARD** - Direct access to user dashboard

### Call-to-Action Updates

**Main CTA Button:**
- Non-authenticated: Opens SignupWizard (not AuthModal)
- Authenticated: Navigates to oracle creation

This encourages new users to go through the complete onboarding flow.

---

## User Flow

### New User Journey

```
Landing Page
    ↓
Click "GET STARTED"
    ↓
SignupWizard Opens
    ↓
Step 1: Email Signup
    ↓
Step 2: Email Verification
    ↓
Step 3: Wallet Connection (optional)
    ↓
Step 4: Completion
    ↓
Choice:
    - Go to Dashboard → Create Oracle
    - View Pricing → Choose Plan
```

### Returning User Journey

```
Landing Page
    ↓
Click "SIGN IN"
    ↓
AuthModal Opens
    ↓
Email/Password Login
    ↓
Dashboard
```

---

## Technical Implementation

### State Management

**New State Variables:**
```typescript
const [authModalOpen, setAuthModalOpen] = useState(false);      // For sign-in
const [signupWizardOpen, setSignupWizardOpen] = useState(false); // For signup
```

### Wallet Integration

**Window.ethereum TypeScript Support:**

Created [types/window.d.ts](types/window.d.ts) for Web3 wallet types:

```typescript
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on?: (event: string, callback: (...args: any[]) => void) => void;
    removeListener?: (event: string, callback: (...args: any[]) => void) => void;
    isMetaMask?: boolean;
  };
}
```

**Wallet Connection Logic:**
```typescript
const handleWalletConnect = async () => {
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  // Proceed to completion step
};
```

---

## Styling & UX

### Visual Design

**Color Scheme:**
- Primary: `rgb(255, 0, 110)` (FEEDS pink)
- Background: Black with transparency
- Borders: Gray-800
- Text: White/Gray hierarchy

**Progress Indicator:**
- Visual step circles with checkmarks
- Connecting lines show progress
- Active step highlighted in primary color
- Completed steps show green checkmarks

**Animations:**
- Smooth step transitions
- Hover effects on buttons
- Progress bar fill animations

### Responsive Design

- Mobile-friendly modal sizing
- Adaptive button layouts
- Touch-friendly tap targets
- Max width constraint (max-w-md)

---

## Integration Points

### Supabase Auth

**Email Signup:**
```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

**Email Verification:**
- Automatic verification email sent
- Callback URL configured for redirect
- User guided through verification process

### Web3 Wallet

**Supported Wallets:**
- MetaMask
- WalletConnect-compatible wallets
- Any injected Web3 provider

**Network Configuration:**
- Base network (Chain ID: 8453)
- Automatic network switching (future)
- Wallet address association with account

---

## User Benefits

### For New Users

**Guided Experience:**
- Clear step-by-step process
- No overwhelming choices
- Explanation of each requirement
- Option to defer non-critical steps

**Education:**
- Why email verification matters
- Benefits of wallet connection
- What they can do next
- Pricing transparency

**Flexibility:**
- Skip wallet connection initially
- Complete verification later
- Choose their own pace

### For Returning Users

**Quick Access:**
- Separate sign-in flow
- Familiar login process
- No unnecessary steps
- Direct to dashboard

---

## Future Enhancements

### Potential Additions

**Social Login:**
- Google OAuth
- GitHub OAuth
- Twitter/X OAuth

**Progressive Onboarding:**
- Tutorial overlays in dashboard
- Interactive oracle creation guide
- Sample oracle templates

**Wallet Features:**
- Multi-wallet support
- ENS name display
- Wallet balance showing
- Base network auto-switch

**Email Verification:**
- Magic link authentication
- Passwordless login option
- Email OTP codes

**Analytics:**
- Track signup completion rates
- Identify drop-off points
- A/B test wizard variations
- Optimize conversion funnel

---

## Testing Checklist

### Signup Wizard Flow

- [ ] Email signup creates account successfully
- [ ] Validation errors show for invalid email
- [ ] Password requirement (6+ chars) enforced
- [ ] Verification email received
- [ ] Email verification link works
- [ ] Wallet connection prompts MetaMask
- [ ] Skip wallet option works
- [ ] Completion screen displays correctly
- [ ] "Go to Dashboard" navigates properly
- [ ] "View Pricing" navigates properly

### Navigation

- [ ] PRICING link works from landing
- [ ] STATUS link works from landing
- [ ] SIGN IN opens AuthModal
- [ ] GET STARTED opens SignupWizard
- [ ] User indicator shows when logged in
- [ ] DASHBOARD button works when authenticated
- [ ] CREATE ORACLE prompts signup for guests

### Responsive Design

- [ ] Mobile view displays correctly
- [ ] Tablet view displays correctly
- [ ] Desktop view displays correctly
- [ ] Modal scrolls on small screens
- [ ] Buttons are touch-friendly
- [ ] Text is readable on all devices

---

## Error Handling

### Common Scenarios

**Email Already Exists:**
```
Error: User already registered
→ Show error message
→ Suggest using sign-in instead
```

**Weak Password:**
```
Error: Password should be at least 6 characters
→ Show validation message
→ Highlight password field
```

**No Wallet Detected:**
```
Error: No wallet detected
→ Show helpful error
→ Link to MetaMask installation
```

**Network Error:**
```
Error: Failed to sign up
→ Show generic error
→ Suggest trying again
```

---

## Analytics Events (Future)

### Recommended Tracking

**Signup Funnel:**
- `wizard_opened` - User clicked "GET STARTED"
- `email_submitted` - Step 1 completed
- `email_verified` - Step 2 completed
- `wallet_connected` - Step 3 completed (or skipped)
- `signup_completed` - Step 4 reached
- `dashboard_accessed` - First dashboard visit

**Conversion Metrics:**
- Email → Verification rate
- Verification → Wallet connection rate
- Wallet connection → First oracle rate
- Time to first oracle creation
- Signup to paid conversion

---

## Accessibility

### WCAG Compliance

**Keyboard Navigation:**
- Tab through form fields
- Enter to submit forms
- Escape to close modal

**Screen Reader Support:**
- Semantic HTML structure
- ARIA labels on buttons
- Form field labels
- Error announcements

**Visual Accessibility:**
- High contrast text/background
- Clear focus indicators
- Readable font sizes
- Color-blind friendly colors

---

## Security Considerations

### Best Practices Implemented

**Password Security:**
- Minimum 6 characters enforced
- Client-side validation
- Server-side hashing (Supabase)
- No password storage in browser

**Email Verification:**
- Required for account activation
- Prevents spam registrations
- Validates email ownership
- Secure callback URLs

**Wallet Connection:**
- User-initiated only
- No private key requests
- Read-only address access
- MetaMask security features

**Session Management:**
- Supabase Auth tokens
- Secure cookie storage
- Automatic expiration
- Refresh token rotation

---

## Troubleshooting

### Common Issues

**Verification Email Not Received:**
1. Check spam folder
2. Verify email address spelling
3. Resend verification email
4. Contact support

**Wallet Won't Connect:**
1. Install MetaMask extension
2. Unlock wallet
3. Approve connection request
4. Check browser console for errors

**Signup Button Disabled:**
1. Fill all required fields
2. Meet password requirements
3. Accept terms of service
4. Check internet connection

---

## Resources

**Supabase Auth:**
- [Auth Documentation](https://supabase.com/docs/guides/auth)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

**Web3 Wallets:**
- [MetaMask Documentation](https://docs.metamask.io/)
- [WalletConnect](https://walletconnect.com/)

**Next.js:**
- [Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## Summary

The new sign-up wizard provides a professional, guided onboarding experience that:
- Reduces friction for new users
- Educates users on FEEDS features
- Optionally connects Web3 wallets
- Drives users to key actions (create oracle, view pricing)
- Maintains simplicity for returning users

This enhancement aligns with the overall FEEDS vision of making decentralized oracles accessible while maintaining the technical depth power users expect.
