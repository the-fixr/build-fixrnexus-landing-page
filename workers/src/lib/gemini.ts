// Fixr Agent Gemini Integration
// Generates images using Google's Gemini API (Imagen 3 & Gemini 2.0)

import { Env } from './types';

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
  traits?: AvatarTraits;
}

export interface AvatarTraits {
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  facialHair: string;
  glasses: string;
  headwear: string;
  expression: string;
  distinctiveFeature: string;
  vibe: string;
}

/**
 * Fetch an image from URL and convert to base64
 */
export async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ success: boolean; base64?: string; mimeType?: string; error?: string }> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { success: false, error: `Failed to fetch image: ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { success: true, base64, mimeType: contentType };
  } catch (error) {
    console.error('Error fetching image:', error);
    return { success: false, error: String(error) };
  }
}

// Base template URL for Builder ID NFTs
const BUILDER_ID_TEMPLATE_URL = 'https://shipyard.fixr.nexus/images/base.png';

/**
 * Generate a Builder ID image using trait-based avatar generation
 * Analyzes the PFP for traits, then generates a unique stylized character (like BAYC)
 */
export async function generateBuilderIDWithTemplate(
  env: Env,
  pfpUrl: string,
  username: string
): Promise<ImageGenerationResult> {
  if (!env.GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  try {
    // Step 1: Fetch the PFP
    console.log('Fetching PFP for trait analysis...');
    const pfpResult = await fetchImageAsBase64(pfpUrl);

    if (!pfpResult.success || !pfpResult.base64) {
      console.error('Failed to fetch PFP:', pfpResult.error);
      // Generate a random avatar if no PFP
      return generateRandomBuilderAvatar(env, username);
    }

    // Step 2: Analyze the PFP for traits using Gemini
    console.log('Analyzing PFP traits...');
    const traitsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: pfpResult.mimeType || 'image/jpeg',
                  data: pfpResult.base64,
                },
              },
              {
                text: `Analyze this profile picture and extract visual traits for generating a stylized NFT avatar.

Return ONLY a JSON object with these fields (no markdown, no explanation):
{
  "skinTone": "light/medium/dark/tan",
  "hairColor": "black/brown/blonde/red/gray/white/blue/pink/green/purple/none",
  "hairStyle": "short/long/curly/straight/wavy/bald/mohawk/afro/ponytail/braids",
  "facialHair": "none/beard/mustache/goatee/stubble",
  "glasses": "none/glasses/sunglasses",
  "headwear": "none/cap/beanie/headphones/crown/helmet",
  "expression": "neutral/happy/serious/confident/smirk",
  "distinctiveFeature": "none/earrings/tattoo/scar/freckles/piercing",
  "vibe": "tech/creative/professional/casual/punk/futuristic"
}`,
              },
            ],
          }],
        }),
      }
    );

    let traits = {
      skinTone: 'medium',
      hairColor: 'brown',
      hairStyle: 'short',
      facialHair: 'none',
      glasses: 'none',
      headwear: 'none',
      expression: 'confident',
      distinctiveFeature: 'none',
      vibe: 'tech',
    };

    if (traitsResponse.ok) {
      const traitsData = await traitsResponse.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const traitsText = traitsData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (traitsText) {
        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = traitsText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            traits = { ...traits, ...JSON.parse(jsonMatch[0]) };
          }
        } catch (e) {
          console.error('Failed to parse traits JSON:', e);
        }
      }
    }

    console.log('Extracted traits:', traits);

    // Step 3: Generate stylized avatar using Imagen with trait-based prompt
    const avatarPrompt = buildAvatarPrompt(traits, username);
    console.log('Generating avatar with prompt:', avatarPrompt);

    const imageResult = await generateImage(env, avatarPrompt);

    // Include traits in the result
    return {
      ...imageResult,
      traits: traits as AvatarTraits,
    };
  } catch (error) {
    console.error('Error generating trait-based avatar:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Build an avatar generation prompt from extracted traits
 */
function buildAvatarPrompt(traits: Record<string, string>, username: string): string {
  // Map skin tone to avatar colors
  const skinColors: Record<string, string> = {
    light: 'pale peach',
    medium: 'warm tan',
    dark: 'rich brown',
    tan: 'golden bronze',
  };

  // Map vibe to outfit/background style
  const vibeStyles: Record<string, string> = {
    tech: 'wearing a futuristic hoodie with glowing circuit patterns, holographic displays in background',
    creative: 'wearing an artist smock with paint splashes, creative studio background with floating shapes',
    professional: 'wearing a sleek blazer with digital pin, modern office with city skyline',
    casual: 'wearing a vintage band t-shirt, retro arcade background',
    punk: 'wearing a leather jacket with studs and patches, graffiti wall background',
    futuristic: 'wearing a cyber suit with neon trim, space station background with stars',
  };

  // Map hair to avatar style
  const hairDesc = traits.hairStyle === 'bald' || traits.hairStyle === 'none'
    ? 'bald head'
    : `${traits.hairColor} ${traits.hairStyle} hair`;

  // Build accessories list
  const accessories: string[] = [];
  if (traits.glasses !== 'none') accessories.push(traits.glasses);
  if (traits.headwear !== 'none') accessories.push(traits.headwear);
  if (traits.facialHair !== 'none') accessories.push(traits.facialHair);
  if (traits.distinctiveFeature !== 'none') accessories.push(traits.distinctiveFeature);

  const accessoryStr = accessories.length > 0
    ? `with ${accessories.join(', ')}`
    : '';

  const skinColor = skinColors[traits.skinTone] || 'warm tan';
  const vibeStyle = vibeStyles[traits.vibe] || vibeStyles.tech;

  return `NFT profile picture avatar in the style of Bored Ape Yacht Club or Doodles.

CHARACTER:
- Stylized cartoon character with ${skinColor} skin tone
- ${hairDesc}
- ${traits.expression} expression
- ${accessoryStr}
- ${vibeStyle}

STYLE:
- Bold flat colors with clean outlines
- Slightly exaggerated cartoon proportions
- Professional NFT collection quality
- Dark moody background with accent lighting
- Portrait/bust shot, facing slightly to the side
- No text, no watermarks, no logos

Make it look like a premium collectible NFT avatar that represents a builder/developer.`;
}

/**
 * Generate a random builder avatar when no PFP is available
 */
async function generateRandomBuilderAvatar(
  env: Env,
  username: string
): Promise<ImageGenerationResult> {
  // Use username hash to generate consistent random traits
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash = hash & hash;
  }

  const skinTones = ['light', 'medium', 'dark', 'tan'];
  const hairColors = ['black', 'brown', 'blonde', 'blue', 'purple', 'green'];
  const hairStyles = ['short', 'long', 'curly', 'mohawk', 'bald'];
  const vibes = ['tech', 'creative', 'punk', 'futuristic'];
  const accessories = ['glasses', 'sunglasses', 'headphones', 'beanie', 'none'];

  const traits = {
    skinTone: skinTones[Math.abs(hash) % skinTones.length],
    hairColor: hairColors[Math.abs(hash >> 4) % hairColors.length],
    hairStyle: hairStyles[Math.abs(hash >> 8) % hairStyles.length],
    facialHair: 'none',
    glasses: accessories[Math.abs(hash >> 12) % accessories.length],
    headwear: 'none',
    expression: 'confident',
    distinctiveFeature: 'none',
    vibe: vibes[Math.abs(hash >> 16) % vibes.length],
  };

  const prompt = buildAvatarPrompt(traits, username);
  return generateImage(env, prompt);
}

/**
 * Generate a stylized image using the PFP as base with Gemini 2.0 Flash
 * This creates a unique builder portrait based on the user's actual photo
 */
export async function generateStylizedImage(
  env: Env,
  pfpUrl: string,
  stylePrompt: string
): Promise<ImageGenerationResult> {
  if (!env.GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  try {
    // First, fetch the PFP and convert to base64
    console.log('Fetching PFP from:', pfpUrl);
    const pfpResult = await fetchImageAsBase64(pfpUrl);

    if (!pfpResult.success || !pfpResult.base64) {
      console.error('Failed to fetch PFP:', pfpResult.error);
      // Fall back to text-only generation
      return generateImage(env, stylePrompt);
    }

    // Use Gemini 2.0 Flash with image generation capability
    // This model can take image input and generate new images
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: pfpResult.mimeType,
                    data: pfpResult.base64,
                  },
                },
                {
                  text: `Based on this profile photo, create a stylized digital portrait with the following style:

${stylePrompt}

IMPORTANT:
- The generated image MUST be inspired by and resemble the person in the input photo
- Maintain the person's key facial features and general appearance
- Apply the artistic style while keeping the subject recognizable
- Output a single artistic portrait image

Generate the image now.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['image', 'text'],
            responseMimeType: 'image/png',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini stylized generation failed:', response.status, errorText);

      // If the model doesn't support image generation, fall back to Imagen
      if (response.status === 400 || errorText.includes('not supported')) {
        console.log('Falling back to Imagen for image generation');
        return generateImageWithReference(env, pfpUrl, stylePrompt);
      }

      return { success: false, error: `Gemini API error: ${response.status}` };
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inline_data?: {
              mime_type?: string;
              data?: string;
            };
            text?: string;
          }>;
        };
      }>;
    };

    // Extract the generated image from the response
    const parts = data.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inline_data?.data) {
          return {
            success: true,
            imageBase64: part.inline_data.data,
            mimeType: part.inline_data.mime_type || 'image/png',
          };
        }
      }
    }

    // If no image in response, fall back to Imagen with reference
    console.log('No image in Gemini response, falling back to Imagen');
    return generateImageWithReference(env, pfpUrl, stylePrompt);
  } catch (error) {
    console.error('Error generating stylized image:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate an image with Imagen using a reference description
 * This is a fallback when Gemini 2.0 can't generate images directly
 */
async function generateImageWithReference(
  env: Env,
  pfpUrl: string,
  stylePrompt: string
): Promise<ImageGenerationResult> {
  // Use Gemini to describe the PFP first
  const descriptionResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: (await fetchImageAsBase64(pfpUrl)).base64,
                },
              },
              {
                text: `Describe this person's appearance in detail for an artist to recreate as a stylized portrait. Include: hair color/style, skin tone, facial features, expression, and any distinctive characteristics. Be specific and concise (2-3 sentences). DO NOT include names or identifying information.`,
              },
            ],
          },
        ],
      }),
    }
  );

  let personDescription = 'a person';
  if (descriptionResponse.ok) {
    const descData = await descriptionResponse.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const descText = descData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (descText) {
      personDescription = descText;
    }
  }

  // Now generate with Imagen using the description
  const enhancedPrompt = `Portrait of ${personDescription}. ${stylePrompt}`;
  console.log('Generating with enhanced prompt:', enhancedPrompt);

  return generateImage(env, enhancedPrompt);
}

/**
 * Generate an image using Gemini's Imagen 3 model
 * Returns base64 image data that can be uploaded to hosting
 */
export async function generateImage(
  env: Env,
  prompt: string
): Promise<ImageGenerationResult> {
  if (!env.GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  try {
    // Use Gemini's image generation endpoint (Imagen 4.0 fast)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9', // Good for social media
            safetyFilterLevel: 'block_few',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini image generation failed:', response.status, errorText);
      return { success: false, error: `Gemini API error: ${response.status}` };
    }

    const data = await response.json() as {
      predictions?: Array<{
        bytesBase64Encoded?: string;
        mimeType?: string;
      }>;
    };

    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      return { success: false, error: 'No image data in response' };
    }

    return {
      success: true,
      imageBase64: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType || 'image/png',
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate a visualization prompt for a completed task
 * Creates prompts that produce engaging, tech-aesthetic images
 */
export function generateImagePrompt(
  task: { title: string; description: string },
  outputs: Array<{ type: string; url?: string }>,
  postText: string
): string {
  // Determine what was built
  const hasDeployment = outputs.some((o) => o.type === 'deployment');
  const hasContract = outputs.some((o) => o.type === 'contract');
  const hasRepo = outputs.some((o) => o.type === 'repo');

  // Extract key concepts from the task
  const keywords = task.title.toLowerCase();

  // Build a visual prompt based on what was accomplished
  let visualConcept = '';

  if (hasContract || keywords.includes('contract') || keywords.includes('blockchain') || keywords.includes('token')) {
    visualConcept = 'blockchain nodes connected by glowing lines, smart contract code floating in space, ethereum/base network visualization';
  } else if (keywords.includes('security') || keywords.includes('audit') || keywords.includes('fix') || keywords.includes('bug')) {
    visualConcept = 'digital shield protecting code, security scanning visualization, firewall with binary streams';
  } else if (keywords.includes('api') || keywords.includes('endpoint') || keywords.includes('integration')) {
    visualConcept = 'API connections flowing between systems, data streams, interconnected nodes';
  } else if (keywords.includes('landing') || keywords.includes('page') || keywords.includes('ui') || keywords.includes('design')) {
    visualConcept = 'sleek web interface floating in dark space, modern UI elements, gradient accents';
  } else if (hasDeployment) {
    visualConcept = 'rocket launching from laptop screen, deployment pipeline visualization, cloud infrastructure';
  } else if (hasRepo) {
    visualConcept = 'code repository with branching visualization, git workflow, collaborative coding';
  } else {
    visualConcept = 'autonomous AI agent at work, digital workspace, code and creativity merging';
  }

  // Create the full prompt with Fixr's aesthetic
  return `Professional tech illustration, dark mode aesthetic with cyan and purple accent colors. ${visualConcept}. Minimalist, modern, slightly futuristic. No text or logos. Clean composition suitable for social media. High quality digital art style.`;
}

/**
 * Upload image to Supabase Storage
 * Returns a public URL that can be used in embeds
 */
export async function uploadImageToSupabase(
  env: Env,
  imageBase64: string,
  filename: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const bucket = 'fixr-images';

  try {
    // Convert base64 to binary
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true', // Overwrite if exists
        },
        body: bytes,
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Supabase upload failed:', response.status, errorData);

      // If bucket doesn't exist, try to create it
      if (response.status === 404) {
        console.log('Bucket not found, attempting to create...');
        const createBucketResp = await fetch(
          `${env.SUPABASE_URL}/storage/v1/bucket`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: bucket,
              name: bucket,
              public: true,
            }),
          }
        );

        if (createBucketResp.ok) {
          // Retry upload
          const retryResp = await fetch(
            `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'image/png',
                'x-upsert': 'true',
              },
              body: bytes,
            }
          );

          if (!retryResp.ok) {
            return { success: false, error: `Upload retry failed: ${retryResp.status}` };
          }
        } else {
          return { success: false, error: `Failed to create bucket: ${createBucketResp.status}` };
        }
      } else {
        return { success: false, error: `Supabase upload failed: ${response.status}` };
      }
    }

    // Return the public URL
    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate and prepare an image for social posting
 * Full pipeline: prompt -> generate -> upload -> return URL
 */
export async function generatePostImage(
  env: Env,
  task: { title: string; description: string },
  outputs: Array<{ type: string; url?: string }>,
  postText: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  // Generate the image prompt
  const imagePrompt = generateImagePrompt(task, outputs, postText);
  console.log('Generating image with prompt:', imagePrompt);

  // Generate the image
  const result = await generateImage(env, imagePrompt);

  if (!result.success || !result.imageBase64) {
    console.log('Image generation failed:', result.error);
    return { success: false, error: result.error };
  }

  // Generate a unique filename
  const timestamp = Date.now();
  const taskSlug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const filename = `${taskSlug}-${timestamp}.png`;

  // Upload to Supabase for hosting
  const uploadResult = await uploadImageToSupabase(env, result.imageBase64, filename);

  if (!uploadResult.success) {
    console.log('Image upload failed:', uploadResult.error);
    return { success: false, error: uploadResult.error };
  }

  console.log('Image uploaded successfully:', uploadResult.url);
  return { success: true, imageUrl: uploadResult.url };
}

/**
 * Generate a stats image for video recaps
 * Creates a clean, professional image with stats that can be used as starting frame for video
 */
export async function generateStatsImage(
  env: Env,
  stats: {
    shippedCount: number;
    topBuilder?: string;
    topTopic?: string;
    period?: string;
  }
): Promise<ImageGenerationResult> {
  // Build a prompt that creates a visually striking stats graphic
  // Note: AI image models struggle with exact text, so we focus on visual atmosphere
  const prompt = `Professional tech infographic design, dark mode with purple and cyan gradient accents.
Futuristic dashboard aesthetic showing abstract data visualization.
Glowing metrics and charts floating in dark space.
Hexagonal grid pattern in background.
Central glowing orb with radiating data streams.
No text, no numbers, no letters - pure visual design.
Blockchain/Web3 aesthetic.
High contrast, neon accents on dark background.
16:9 aspect ratio, suitable for video thumbnail.
Clean, modern, minimalist tech art style.`;

  console.log('Generating stats image for video recap');
  return generateImage(env, prompt);
}

/**
 * Generate stats image and upload to Supabase for use in video generation
 */
export async function generateAndUploadStatsImage(
  env: Env,
  stats: {
    shippedCount: number;
    topBuilder?: string;
    topTopic?: string;
  }
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const result = await generateStatsImage(env, stats);

  if (!result.success || !result.imageBase64) {
    return { success: false, error: result.error || 'Failed to generate image' };
  }

  // Upload to Supabase
  const filename = `stats-recap-${Date.now()}.png`;
  const uploadResult = await uploadImageToSupabase(env, result.imageBase64, filename);

  return uploadResult;
}
