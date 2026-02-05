/**
 * Deploy Admin Portal to GitHub
 *
 * This script reads all admin portal files and pushes them to the
 * fixr-nexus GitHub repository using Fixr's API.
 *
 * Usage: npx tsx scripts/deploy-admin.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://agent.fixr.nexus';
const GITHUB_OWNER = 'jumpboxlabs'; // Update if different
const GITHUB_REPO = 'fixr-nexus';
const BRANCH = 'main';

interface FileToUpload {
  path: string;
  content: string;
}

// Directories and files to upload
const UPLOAD_PATHS = [
  'src/app/admin',
  'src/app/components/admin',
];

// Additional files that need to be updated
const ADDITIONAL_FILES = [
  'package.json',
];

function getAllFiles(dirPath: string, basePath: string = ''): FileToUpload[] {
  const files: FileToUpload[] = [];

  if (!fs.existsSync(dirPath)) {
    console.log(`Directory not found: ${dirPath}`);
    return files;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relativePath = path.join(basePath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else if (stat.isFile()) {
      // Skip non-source files
      if (item.endsWith('.tsx') || item.endsWith('.ts') || item.endsWith('.css') || item.endsWith('.json')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          content,
        });
      }
    }
  }

  return files;
}

async function deployToGitHub() {
  console.log('🚀 Deploying Admin Portal to GitHub...\n');

  const projectRoot = path.resolve(__dirname, '..');
  const filesToUpload: FileToUpload[] = [];

  // Collect all admin files
  for (const uploadPath of UPLOAD_PATHS) {
    const fullPath = path.join(projectRoot, uploadPath);
    const files = getAllFiles(fullPath, uploadPath);
    filesToUpload.push(...files);
    console.log(`📁 Found ${files.length} files in ${uploadPath}`);
  }

  // Add package.json (for dependencies)
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    filesToUpload.push({
      path: 'package.json',
      content: fs.readFileSync(packageJsonPath, 'utf-8'),
    });
    console.log('📦 Added package.json');
  }

  console.log(`\n📄 Total files to upload: ${filesToUpload.length}`);
  console.log('\nFiles:');
  filesToUpload.forEach(f => console.log(`  - ${f.path}`));

  // Push to GitHub via Fixr API
  console.log('\n⏳ Pushing to GitHub...');

  try {
    const response = await fetch(`${API_BASE}/api/github/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        branch: BRANCH,
        files: filesToUpload,
        message: `Add admin portal with wallet authentication

- Dashboard with real-time agent status
- Tasks management (create, approve, execute)
- Social media controls (Farcaster posting, GM/GN)
- Video generation (WaveSpeedAI, Livepeer)
- Analytics dashboard with charts
- Builders management
- Configuration controls
- Wallet integration

Access restricted to: 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('\n✅ Successfully deployed to GitHub!');
      console.log(`📍 Repository: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`);
      console.log(`🌿 Branch: ${BRANCH}`);
      if (result.sha) {
        console.log(`🔗 Commit: ${result.sha}`);
      }
    } else {
      console.error('\n❌ Failed to deploy:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error deploying:', error);
    process.exit(1);
  }
}

// Run the deployment
deployToGitHub();
