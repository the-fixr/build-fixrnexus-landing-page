/**
 * Paragraph Publishing Client for Fixr
 * Publishes long-form content to Paragraph.xyz
 *
 * Uses the Paragraph API for authenticated operations
 * @see https://paragraph.com/docs
 */

import { Env } from './types';
import { generateImage, uploadImageToSupabase } from './gemini';

export interface ParagraphPost {
  id?: string;
  title: string;
  markdown: string;
  slug?: string;
  publishedAt?: string;
  url?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  url?: string;
  slug?: string;
  error?: string;
}

// Paragraph API base URL
const PARAGRAPH_API_BASE = 'https://public.api.paragraph.com/api';

/**
 * Check if Paragraph publishing is configured
 */
export function isParagraphConfigured(env: Env): boolean {
  return !!env.PARAGRAPH_API_KEY;
}

/**
 * Generate a banner image for a Paragraph post
 * Creates a visually engaging header image based on the post content
 */
export async function generateParagraphBanner(
  env: Env,
  title: string,
  context?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  // Create a banner-specific prompt - visually appealing, relevant to content
  const prompt = `Create a visually striking blog banner image for an article titled "${title}". ${context ? `The article is about: ${context}.` : ''} Style: Professional, modern, visually interesting. Should clearly relate to the topic and be immediately recognizable. Wide 16:9 aspect ratio, high quality, suitable as a blog header. Make it eye-catching and relevant to the subject matter.`;

  console.log('Generating Paragraph banner with prompt:', prompt.slice(0, 100) + '...');

  const result = await generateImage(env, prompt);

  if (!result.success || !result.imageBase64) {
    console.log('Banner generation failed:', result.error);
    return { success: false, error: result.error };
  }

  // Generate filename
  const timestamp = Date.now();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const filename = `paragraph-${slug}-${timestamp}.png`;

  // Upload to Supabase
  const uploadResult = await uploadImageToSupabase(env, result.imageBase64, filename);

  if (!uploadResult.success) {
    console.log('Banner upload failed:', uploadResult.error);
    return { success: false, error: uploadResult.error };
  }

  console.log('Paragraph banner uploaded:', uploadResult.url);
  return { success: true, imageUrl: uploadResult.url };
}

/**
 * Publish a new post to Paragraph
 * Creates a new post with the given title and markdown content
 * Optionally includes a cover image URL
 */
export async function publishToParagraph(
  env: Env,
  post: { title: string; markdown: string; slug?: string }
): Promise<PublishResult> {
  if (!env.PARAGRAPH_API_KEY) {
    return { success: false, error: 'Paragraph API key not configured' };
  }

  try {
    console.log(`Publishing to Paragraph: "${post.title}"`);

    const response = await fetch(`${PARAGRAPH_API_BASE}/v1/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.PARAGRAPH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: post.title,
        markdown: post.markdown,
        ...(post.slug && { slug: post.slug }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Paragraph API error:', response.status, errorText);

      // Try to parse error for better messaging
      try {
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          error: `${response.status}: ${errorJson.message || errorJson.error || errorText}`,
        };
      } catch {
        return {
          success: false,
          error: `${response.status}: ${errorText}`,
        };
      }
    }

    const data = await response.json() as {
      id?: string;
      slug?: string;
      url?: string;
      publication?: { slug?: string };
    };

    // Construct URL if not provided
    const postUrl = data.url ||
      (data.publication?.slug && data.slug
        ? `https://paragraph.com/@${data.publication.slug}/${data.slug}`
        : undefined);

    console.log('Published to Paragraph:', postUrl || data.id);

    return {
      success: true,
      postId: data.id,
      url: postUrl,
      slug: data.slug,
    };
  } catch (error) {
    console.error('Paragraph publish error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Fetch recent posts from Paragraph
 */
export async function fetchParagraphPosts(
  env: Env,
  limit: number = 10
): Promise<{ success: boolean; posts?: ParagraphPost[]; error?: string }> {
  if (!env.PARAGRAPH_API_KEY) {
    return { success: false, error: 'Paragraph API key not configured' };
  }

  try {
    const response = await fetch(`${PARAGRAPH_API_BASE}/v1/posts?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${env.PARAGRAPH_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json() as {
      posts?: Array<{
        id?: string;
        title?: string;
        markdown?: string;
        slug?: string;
        published_at?: string;
        url?: string;
      }>;
    };

    const posts: ParagraphPost[] = (data.posts || []).map((p) => ({
      id: p.id,
      title: p.title || '',
      markdown: p.markdown || '',
      slug: p.slug,
      publishedAt: p.published_at,
      url: p.url,
    }));

    return { success: true, posts };
  } catch (error) {
    console.error('Paragraph fetch error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate a long-form post from task completion data
 * Converts Fixr's work into a blog-style article
 * Also generates a banner image for the post
 */
export async function generateLongformPost(
  env: Env,
  task: { title: string; description: string },
  outputs: Array<{ type: string; url?: string; data?: Record<string, unknown> }>,
  additionalContext?: string,
  _includeBanner: boolean = false // Banner generation disabled - user adds images manually
): Promise<{ title: string; markdown: string }> {
  const urls = {
    repo: outputs.find((o) => o.type === 'repo')?.url,
    deployment: outputs.find((o) => o.type === 'deployment')?.url,
    contract: outputs.find((o) => o.type === 'contract')?.url,
  };

  const prompt = `You are Fixr, an autonomous AI agent writing a technical blog post about work you completed.

TASK: ${task.title}
DESCRIPTION: ${task.description}
${urls.deployment ? `LIVE URL: ${urls.deployment}` : ''}
${urls.repo ? `REPO: ${urls.repo}` : ''}
${urls.contract ? `CONTRACT: ${urls.contract}` : ''}
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

Write a blog post in markdown format. Include:
1. An engaging introduction explaining the problem/opportunity
2. Technical details about the approach
3. Code snippets if relevant
4. Lessons learned or insights
5. Links to the live project/code

YOUR VOICE:
- Security researcher vibes, technical but accessible
- Share genuine insights and learnings
- Be specific about technical decisions
- Show personality - you're an AI that ships real work

Format: Return ONLY valid JSON with "title" and "markdown" fields. No other text.`;

  try {
    // Generate content and banner image in parallel
    const contentPromise = fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await contentPromise;

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return {
        title: task.title,
        markdown: `# ${task.title}\n\n${task.description}\n\n${urls.deployment ? `[Live Demo](${urls.deployment})` : ''}`,
      };
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const text = data.content[0]?.text?.trim();

    if (text) {
      try {
        // Strip code blocks if Claude wrapped the response
        let jsonText = text;
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(jsonText);
        return {
          title: parsed.title || task.title,
          markdown: parsed.markdown || text,
        };
      } catch {
        // If not valid JSON, use the text as markdown
        return {
          title: task.title,
          markdown: text,
        };
      }
    }

    return {
      title: task.title,
      markdown: `# ${task.title}\n\n${task.description}`,
    };
  } catch (error) {
    console.error('Error generating longform post:', error);
    return {
      title: task.title,
      markdown: `# ${task.title}\n\n${task.description}`,
    };
  }
}
