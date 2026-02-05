#!/bin/bash
#
# Deploy Admin Portal to GitHub via Fixr API
#
# Usage: ./scripts/deploy-admin.sh [owner] [repo]
# Example: ./scripts/deploy-admin.sh jumpboxlabs fixr-nexus
#

OWNER="${1:-the-fixr}"
REPO="${2:-build-fixrnexus-landing-page}"
BRANCH="main"
API_BASE="https://agent.fixr.nexus"

echo "🚀 Deploying Admin Portal to GitHub..."
echo "📍 Target: https://github.com/$OWNER/$REPO"
echo ""

# Build the files array in JSON format
FILES='['

# Function to add a file (local_path -> remote_path)
add_file() {
    local local_path="$1"
    local remote_path="${2:-$1}"
    local fullpath="/Users/chadneal/Desktop/fixr-agent/$local_path"

    if [ -f "$fullpath" ]; then
        # Read file content and escape for JSON
        content=$(cat "$fullpath" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

        if [ "$FILES" != "[" ]; then
            FILES="$FILES,"
        fi
        FILES="$FILES{\"path\":\"$remote_path\",\"content\":$content}"
        echo "  ✓ $remote_path"
    fi
}

echo "📁 Collecting files..."

# Admin pages (local src/app -> remote app)
add_file "src/app/admin/layout.tsx" "app/admin/layout.tsx"
add_file "src/app/admin/page.tsx" "app/admin/page.tsx"
add_file "src/app/admin/tasks/page.tsx" "app/admin/tasks/page.tsx"
add_file "src/app/admin/social/page.tsx" "app/admin/social/page.tsx"
add_file "src/app/admin/video/page.tsx" "app/admin/video/page.tsx"
add_file "src/app/admin/analytics/page.tsx" "app/admin/analytics/page.tsx"
add_file "src/app/admin/builders/page.tsx" "app/admin/builders/page.tsx"
add_file "src/app/admin/config/page.tsx" "app/admin/config/page.tsx"
add_file "src/app/admin/wallet/page.tsx" "app/admin/wallet/page.tsx"

# Main page with carousel and video
add_file "src/app/page.tsx" "app/page.tsx"

# Shared components (carousel, video player)
add_file "src/app/components/index.ts" "app/components/index.ts"
add_file "src/app/components/ImageCarousel.tsx" "app/components/ImageCarousel.tsx"
add_file "src/app/components/LivepeerPlayer.tsx" "app/components/LivepeerPlayer.tsx"

# API routes for media (images from Supabase fixr-images bucket)
add_file "src/app/api/images/route.ts" "app/api/images/route.ts"
add_file "src/app/api/videos/route.ts" "app/api/videos/route.ts"

# Admin components (local src/app/components -> remote components)
add_file "src/app/components/admin/index.ts" "components/admin/index.ts"
add_file "src/app/components/admin/AdminCard.tsx" "components/admin/AdminCard.tsx"
add_file "src/app/components/admin/ActionButton.tsx" "components/admin/ActionButton.tsx"
add_file "src/app/components/admin/AuthGuard.tsx" "components/admin/AuthGuard.tsx"
add_file "src/app/components/admin/ConfirmModal.tsx" "components/admin/ConfirmModal.tsx"
add_file "src/app/components/admin/DataTable.tsx" "components/admin/DataTable.tsx"
add_file "src/app/components/admin/StatCard.tsx" "components/admin/StatCard.tsx"
add_file "src/app/components/admin/StatusBadge.tsx" "components/admin/StatusBadge.tsx"

# Package.json for dependencies
add_file "package.json"

# Next.js config (ESM format)
add_file "next.config.js"

FILES="$FILES]"

echo ""
echo "⏳ Pushing to GitHub via Fixr API..."

# Create the request body
BODY=$(cat <<EOF
{
  "owner": "$OWNER",
  "repo": "$REPO",
  "branch": "$BRANCH",
  "files": $FILES,
  "message": "Fix images - fetch from worker API\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
}
EOF
)

# Make the API call
RESPONSE=$(curl -s -X POST "$API_BASE/api/github/push" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Check the response
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ Successfully deployed to GitHub!"
    echo "📍 Repository: https://github.com/$OWNER/$REPO"
    echo "🔗 View at: https://fixr.nexus/admin"
else
    echo ""
    echo "❌ Failed to deploy:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi
