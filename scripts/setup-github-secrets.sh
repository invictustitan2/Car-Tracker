#!/bin/bash
# Setup GitHub Secrets for Cloudflare Deployment

echo "🔐 GitHub Secrets Setup for Cloudflare Deployment"
echo "=================================================="
echo ""
echo "You need to add the following secrets to your GitHub repository:"
echo ""
echo "1. Go to: https://github.com/invictustitan2/ups-tracker/settings/secrets/actions"
echo ""
echo "2. Click 'New repository secret' and add these:"
echo ""

# Get Cloudflare Account ID
echo "📋 CLOUDFLARE_ACCOUNT_ID"
echo "   Value: 21ec8cd9b9edec29288dceeaca6d7374"
echo "   (Your Cloudflare Account ID)"
echo ""

echo "📋 CLOUDFLARE_API_TOKEN"
echo "   Value: <Your Cloudflare API Token>"
echo "   How to get it:"
echo "   - Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "   - Click 'Create Token'"
echo "   - Use 'Edit Cloudflare Workers' template"
echo "   - Add permissions:"
echo "     * Account > Cloudflare Pages: Edit"
echo "     * Account > Workers Scripts: Edit"
echo "   - Account Resources: Include > Select your account"
echo "   - Zone Resources: Include > All zones"
echo "   - Click 'Continue to summary' → 'Create Token'"
echo "   - Copy the token and add it to GitHub secrets"
echo ""

echo "✅ Once added, the deploy workflow will run automatically on push to main!"
echo ""
echo "🔍 To verify secrets are set:"
echo "   Visit: https://github.com/invictustitan2/ups-tracker/settings/secrets/actions"
echo ""
