// Talent Protocol Builder Score API Integration
// Documentation: https://docs.talentprotocol.com/docs/developers/talent-api
// Provides builder reputation scores, credentials, and skills verification

import { Env } from './types';

const TALENT_API_BASE = 'https://api.talentprotocol.com/api/v2';

// Builder Score breakdown by category
export interface BuilderScoreBreakdown {
  activity_score: number;
  identity_score: number;
  skills_score: number;
}

// Talent Protocol Passport/Profile
export interface TalentPassport {
  passport_id: number;
  main_wallet: string;
  passport_socials: PassportSocial[];
  verified_wallets: string[];
  human_checkmark: boolean;
  activity_score: number;
  identity_score: number;
  skills_score: number;
  score: number; // Overall Builder Score
  calculating_score: boolean;
  last_calculated_at: string;
  nominations_received_count: number;
  passport_profile?: PassportProfile;
  credentials?: Credential[];
}

export interface PassportSocial {
  follower_count: number;
  following_count: number;
  profile_bio?: string;
  profile_display_name?: string;
  profile_image_url?: string;
  profile_name: string;
  profile_url: string;
  source: string; // 'twitter', 'farcaster', 'github', 'linkedin', etc.
}

export interface PassportProfile {
  bio?: string;
  display_name?: string;
  image_url?: string;
  location?: string;
  tags?: string[];
}

export interface Credential {
  category: string;
  earned_at: string;
  id: string;
  last_calculated_at: string;
  max_score: number;
  name: string;
  onchain_at?: string;
  score: number;
  type: string;
  value?: string;
}

// Analysis result
export interface TalentAnalysis {
  walletAddress: string;
  passport: TalentPassport | null;
  isBuilder: boolean;
  builderScore: number;
  scoreBreakdown: BuilderScoreBreakdown | null;
  credentials: Credential[];
  socials: PassportSocial[];
  insights: string[];
  reputation: 'UNKNOWN' | 'NEW' | 'EMERGING' | 'ESTABLISHED' | 'RENOWNED';
  timestamp: string;
}

// Get passport by wallet address
export async function getPassportByWallet(
  env: Env,
  walletAddress: string
): Promise<TalentPassport | null> {
  if (!env.TALENT_PROTOCOL_API_KEY) {
    console.log('Talent Protocol: No API key configured');
    return null;
  }

  try {
    const url = `${TALENT_API_BASE}/passports/${walletAddress.toLowerCase()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': env.TALENT_PROTOCOL_API_KEY,
      },
    });

    if (response.status === 404) {
      // No passport found for this wallet
      return null;
    }

    if (!response.ok) {
      console.error(`Talent Protocol API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as { passport: TalentPassport };
    return data.passport;
  } catch (error) {
    console.error('Talent Protocol API error:', error);
    return null;
  }
}

// Get credentials for a passport
export async function getPassportCredentials(
  env: Env,
  passportId: number
): Promise<Credential[]> {
  if (!env.TALENT_PROTOCOL_API_KEY) {
    return [];
  }

  try {
    const url = `${TALENT_API_BASE}/passports/${passportId}/credentials`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': env.TALENT_PROTOCOL_API_KEY,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { passport_credentials: Credential[] };
    return data.passport_credentials || [];
  } catch (error) {
    console.error('Talent Protocol credentials error:', error);
    return [];
  }
}

// Search for builders by various criteria
export async function searchBuilders(
  env: Env,
  options: {
    query?: string;
    minScore?: number;
    verified?: boolean;
    limit?: number;
  } = {}
): Promise<TalentPassport[]> {
  if (!env.TALENT_PROTOCOL_API_KEY) {
    return [];
  }

  try {
    const params = new URLSearchParams();
    if (options.query) params.set('keyword', options.query);
    if (options.minScore) params.set('score_gte', options.minScore.toString());
    if (options.verified) params.set('verified', 'true');
    params.set('per_page', (options.limit || 20).toString());

    const url = `${TALENT_API_BASE}/passports?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': env.TALENT_PROTOCOL_API_KEY,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { passports: TalentPassport[] };
    return data.passports || [];
  } catch (error) {
    console.error('Talent Protocol search error:', error);
    return [];
  }
}

// Get top builders by score
export async function getTopBuilders(
  env: Env,
  limit: number = 50
): Promise<TalentPassport[]> {
  if (!env.TALENT_PROTOCOL_API_KEY) {
    return [];
  }

  try {
    const url = `${TALENT_API_BASE}/passports?sort=score&order=desc&per_page=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': env.TALENT_PROTOCOL_API_KEY,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { passports: TalentPassport[] };
    return data.passports || [];
  } catch (error) {
    console.error('Talent Protocol top builders error:', error);
    return [];
  }
}

// Comprehensive analysis for a wallet
export async function getTalentAnalysis(
  env: Env,
  walletAddress: string
): Promise<TalentAnalysis> {
  const passport = await getPassportByWallet(env, walletAddress);

  if (!passport) {
    return {
      walletAddress,
      passport: null,
      isBuilder: false,
      builderScore: 0,
      scoreBreakdown: null,
      credentials: [],
      socials: [],
      insights: ['No Talent Protocol passport found for this wallet'],
      reputation: 'UNKNOWN',
      timestamp: new Date().toISOString(),
    };
  }

  // Get credentials if passport exists
  const credentials = passport.credentials || await getPassportCredentials(env, passport.passport_id);

  // Determine reputation level based on score
  const reputation = getReputationLevel(passport.score);

  // Generate insights
  const insights = generateBuilderInsights(passport, credentials);

  return {
    walletAddress,
    passport,
    isBuilder: true,
    builderScore: passport.score,
    scoreBreakdown: {
      activity_score: passport.activity_score,
      identity_score: passport.identity_score,
      skills_score: passport.skills_score,
    },
    credentials,
    socials: passport.passport_socials || [],
    insights,
    reputation,
    timestamp: new Date().toISOString(),
  };
}

// Get reputation level from score
function getReputationLevel(score: number): 'UNKNOWN' | 'NEW' | 'EMERGING' | 'ESTABLISHED' | 'RENOWNED' {
  if (score >= 80) return 'RENOWNED';
  if (score >= 60) return 'ESTABLISHED';
  if (score >= 40) return 'EMERGING';
  if (score > 0) return 'NEW';
  return 'UNKNOWN';
}

// Generate insights from passport data
function generateBuilderInsights(passport: TalentPassport, credentials: Credential[]): string[] {
  const insights: string[] = [];

  // Overall score insight
  if (passport.score >= 80) {
    insights.push(`Top-tier builder with score of ${passport.score}/100`);
  } else if (passport.score >= 60) {
    insights.push(`Established builder with score of ${passport.score}/100`);
  } else if (passport.score >= 40) {
    insights.push(`Emerging builder with score of ${passport.score}/100`);
  } else if (passport.score > 0) {
    insights.push(`New builder profile with score of ${passport.score}/100`);
  }

  // Human verification
  if (passport.human_checkmark) {
    insights.push('Human-verified identity');
  }

  // Score breakdown insights
  if (passport.activity_score >= 70) {
    insights.push(`High on-chain activity score (${passport.activity_score})`);
  }
  if (passport.identity_score >= 70) {
    insights.push(`Strong identity verification (${passport.identity_score})`);
  }
  if (passport.skills_score >= 70) {
    insights.push(`Verified technical skills (${passport.skills_score})`);
  }

  // Social presence
  const socials = passport.passport_socials || [];
  if (socials.length > 0) {
    const platforms = socials.map(s => s.source).join(', ');
    insights.push(`Connected on: ${platforms}`);

    // Check for significant following
    const totalFollowers = socials.reduce((sum, s) => sum + (s.follower_count || 0), 0);
    if (totalFollowers >= 10000) {
      insights.push(`Notable social presence (${totalFollowers.toLocaleString()} followers)`);
    }
  }

  // Nominations
  if (passport.nominations_received_count > 0) {
    insights.push(`Received ${passport.nominations_received_count} nomination(s) from other builders`);
  }

  // Wallet verification
  if (passport.verified_wallets && passport.verified_wallets.length > 1) {
    insights.push(`${passport.verified_wallets.length} verified wallets linked`);
  }

  // Credential insights
  if (credentials.length > 0) {
    const highValueCredentials = credentials.filter(c => c.score >= c.max_score * 0.7);
    if (highValueCredentials.length > 0) {
      const credNames = highValueCredentials.slice(0, 3).map(c => c.name).join(', ');
      insights.push(`Strong credentials: ${credNames}`);
    }

    // Check for specific valuable credentials
    const hasGithub = credentials.some(c => c.category.toLowerCase().includes('github') || c.name.toLowerCase().includes('github'));
    if (hasGithub) {
      insights.push('GitHub activity verified');
    }

    const hasENS = credentials.some(c => c.name.toLowerCase().includes('ens'));
    if (hasENS) {
      insights.push('ENS domain holder');
    }
  }

  return insights;
}

// Format analysis for display
export function formatTalentAnalysis(analysis: TalentAnalysis): string {
  const lines: string[] = [];

  lines.push(`## Talent Protocol Builder Analysis`);
  lines.push('');

  if (!analysis.passport) {
    lines.push('No Talent Protocol passport found for this wallet.');
    lines.push('This could mean the wallet belongs to a new or anonymous builder.');
    return lines.join('\n');
  }

  // Reputation badge
  const reputationEmoji = {
    UNKNOWN: '',
    NEW: '',
    EMERGING: '',
    ESTABLISHED: '',
    RENOWNED: '',
  }[analysis.reputation];

  lines.push(`**Builder Score:** ${analysis.builderScore}/100 ${reputationEmoji}`);
  lines.push(`**Reputation:** ${analysis.reputation}`);

  if (analysis.passport.human_checkmark) {
    lines.push(`**Verified:** Human-verified identity`);
  }

  lines.push('');

  // Score breakdown
  if (analysis.scoreBreakdown) {
    lines.push('### Score Breakdown');
    lines.push(`- Activity: ${analysis.scoreBreakdown.activity_score}`);
    lines.push(`- Identity: ${analysis.scoreBreakdown.identity_score}`);
    lines.push(`- Skills: ${analysis.scoreBreakdown.skills_score}`);
    lines.push('');
  }

  // Profile info
  if (analysis.passport.passport_profile) {
    const profile = analysis.passport.passport_profile;
    if (profile.display_name) {
      lines.push(`**Name:** ${profile.display_name}`);
    }
    if (profile.bio) {
      lines.push(`**Bio:** ${profile.bio}`);
    }
    if (profile.tags && profile.tags.length > 0) {
      lines.push(`**Tags:** ${profile.tags.join(', ')}`);
    }
    lines.push('');
  }

  // Social links
  if (analysis.socials.length > 0) {
    lines.push('### Connected Accounts');
    for (const social of analysis.socials.slice(0, 5)) {
      const name = social.profile_display_name || social.profile_name;
      const followers = social.follower_count ? ` (${social.follower_count.toLocaleString()} followers)` : '';
      lines.push(`- **${social.source}:** ${name}${followers}`);
    }
    lines.push('');
  }

  // Top credentials
  if (analysis.credentials.length > 0) {
    lines.push('### Verified Credentials');
    const topCreds = analysis.credentials
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    for (const cred of topCreds) {
      const scorePercent = Math.round((cred.score / cred.max_score) * 100);
      lines.push(`- **${cred.name}** (${cred.category}): ${scorePercent}%`);
    }
    lines.push('');
  }

  // Insights
  if (analysis.insights.length > 0) {
    lines.push('### Insights');
    for (const insight of analysis.insights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Check if wallet belongs to a known builder (quick check)
export async function isKnownBuilder(
  env: Env,
  walletAddress: string,
  minScore: number = 30
): Promise<{ isBuilder: boolean; score: number; reputation: string }> {
  const passport = await getPassportByWallet(env, walletAddress);

  if (!passport) {
    return { isBuilder: false, score: 0, reputation: 'UNKNOWN' };
  }

  return {
    isBuilder: passport.score >= minScore,
    score: passport.score,
    reputation: getReputationLevel(passport.score),
  };
}
