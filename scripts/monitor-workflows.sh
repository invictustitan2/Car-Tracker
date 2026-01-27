#!/bin/bash
# GitHub Workflow Monitoring Script
# Monitors CI/CD workflow execution in real-time

set -e

echo "🔍 UPS Tracker - GitHub Workflow Monitor"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO="invictustitan2/ups-tracker"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo "Repository: $REPO"
echo "Branch: $BRANCH"
echo "Latest Commit: $(git log -1 --oneline 2>/dev/null || echo 'N/A')"
echo ""

# Function to check workflow status
check_workflows() {
    echo -e "${BLUE}📊 Workflow Status Check${NC}"
    echo "=========================="
    echo ""
    
    # Check if gh CLI is available
    if command -v gh &> /dev/null; then
        echo "✓ GitHub CLI available"
        echo ""
        
        # List recent workflow runs
        echo -e "${YELLOW}Recent Workflow Runs:${NC}"
        gh run list --limit 5 --json databaseId,name,status,conclusion,createdAt,headBranch \
            --jq '.[] | "[\(.status | ascii_upcase)] \(.name) - \(.conclusion // "IN PROGRESS") (\(.headBranch))"' \
            2>/dev/null || echo "No workflows found or authentication required"
        echo ""
        
        # Watch for in-progress runs
        echo -e "${YELLOW}Checking for active workflows...${NC}"
        RUNNING=$(gh run list --status in_progress --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
        
        if [ -n "$RUNNING" ]; then
            echo -e "${GREEN}✓ Active workflow found (ID: $RUNNING)${NC}"
            echo ""
            echo "To watch in real-time, run:"
            echo "  gh run watch $RUNNING"
            echo ""
            echo "To view logs, run:"
            echo "  gh run view $RUNNING --log"
        else
            echo "No active workflows running"
        fi
    else
        echo -e "${YELLOW}⚠ GitHub CLI (gh) not installed${NC}"
        echo "Install with: sudo snap install gh"
        echo ""
        echo "Alternative: Check workflows at:"
        echo "  https://github.com/$REPO/actions"
    fi
    echo ""
}

# Function to check local test status
check_local_tests() {
    echo -e "${BLUE}🧪 Local Test Status${NC}"
    echo "====================="
    echo ""
    
    echo "Running unit tests..."
    if npm test -- --run --reporter=verbose 2>&1 | tee /tmp/test-output.log; then
        TESTS_PASSED=$(grep -o "✓.*tests" /tmp/test-output.log | tail -1 || echo "Tests completed")
        echo ""
        echo -e "${GREEN}✓ Unit tests passed: $TESTS_PASSED${NC}"
    else
        echo ""
        echo -e "${RED}✗ Unit tests failed${NC}"
        return 1
    fi
    echo ""
}

# Function to check build status
check_build() {
    echo -e "${BLUE}🏗️  Build Status${NC}"
    echo "================"
    echo ""
    
    echo "Building production bundle..."
    if npm run build 2>&1 | tee /tmp/build-output.log; then
        BUILD_SIZE=$(grep -o "dist/assets/index.*KB" /tmp/build-output.log | tail -1 || echo "Build completed")
        echo ""
        echo -e "${GREEN}✓ Build successful: $BUILD_SIZE${NC}"
        
        # Show bundle sizes
        if [ -d "dist" ]; then
            echo ""
            echo "Bundle breakdown:"
            ls -lh dist/assets/*.js dist/assets/*.css 2>/dev/null | awk '{print "  "$9" - "$5}' || echo "  (files not found)"
        fi
    else
        echo ""
        echo -e "${RED}✗ Build failed${NC}"
        return 1
    fi
    echo ""
}

# Function to check deployment status
check_deployment() {
    echo -e "${BLUE}🚀 Deployment Status${NC}"
    echo "===================="
    echo ""
    
    # Check production URLs
    echo "Checking production endpoints..."
    
    # Frontend
    if curl -sI "https://main.ups-tracker.pages.dev" | grep -q "200"; then
        echo -e "${GREEN}✓ Frontend: https://main.ups-tracker.pages.dev${NC}"
    else
        echo -e "${RED}✗ Frontend unreachable${NC}"
    fi
    
    # API
    if curl -sI "https://ups-tracker-api.invictustitan2.workers.dev/api/cars" | grep -q "401\|200"; then
        echo -e "${GREEN}✓ API: https://ups-tracker-api.invictustitan2.workers.dev${NC}"
    else
        echo -e "${RED}✗ API unreachable${NC}"
    fi
    echo ""
}

# Main monitoring loop
main() {
    case "${1:-status}" in
        watch)
            echo "🔄 Entering watch mode (press Ctrl+C to exit)"
            echo ""
            while true; do
                clear
                echo "🔍 UPS Tracker - GitHub Workflow Monitor [Watch Mode]"
                echo "=========================================="
                echo "Last update: $(date '+%Y-%m-%d %H:%M:%S')"
                echo ""
                check_workflows
                echo -e "${YELLOW}Refreshing in 10 seconds...${NC}"
                sleep 10
            done
            ;;
        test)
            check_local_tests
            ;;
        build)
            check_build
            ;;
        deploy)
            check_deployment
            ;;
        full)
            check_workflows
            check_local_tests
            check_build
            check_deployment
            ;;
        status|*)
            check_workflows
            ;;
    esac
}

# Parse arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 [watch|test|build|deploy|full|status]"
    echo ""
    echo "Commands:"
    echo "  watch   - Continuous monitoring of workflow status"
    echo "  test    - Run local unit tests"
    echo "  build   - Build production bundle"
    echo "  deploy  - Check deployment status"
    echo "  full    - Run all checks"
    echo "  status  - Check workflow status (default)"
    echo ""
    echo "Running default status check..."
    echo ""
fi

main "$@"
