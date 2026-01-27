#!/bin/bash
# Floor Test Validation Script
# Tests the items from the 2-Minute Floor Test checklist

set -e

PROJECT_ROOT="/home/dreamboat/projects/ups-tracker"
cd "$PROJECT_ROOT"

echo "🧪 UPS Tracker - Floor Test Validation"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if dev server is running
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${RED}❌ Dev server not running on http://localhost:5173${NC}"
    echo "   Start it with: npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ Dev server is running${NC}"
echo ""

# Build check
echo "📦 Testing production build..."
if npm run build > /tmp/build.log 2>&1; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    echo -e "${GREEN}✅ Production build successful (${BUILD_SIZE})${NC}"
else
    echo -e "${RED}❌ Production build failed${NC}"
    cat /tmp/build.log | tail -20
    exit 1
fi
echo ""

# Check dist bundle
if [ -f "dist/index.html" ]; then
    echo -e "${GREEN}✅ Bundle created: dist/index.html${NC}"
    echo "   Assets:"
    ls -lh dist/assets/*.{css,js} 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}'
else
    echo -e "${RED}❌ No dist/index.html found${NC}"
    exit 1
fi
echo ""

# Check for critical features in the build
echo "🔍 Checking for critical features in build..."

FEATURES_FOUND=0
FEATURES_TOTAL=0

check_feature() {
    local feature=$1
    local pattern=$2
    FEATURES_TOTAL=$((FEATURES_TOTAL + 1))
    
    if grep -q "$pattern" dist/assets/*.js 2>/dev/null; then
        echo -e "${GREEN}   ✅ ${feature}${NC}"
        FEATURES_FOUND=$((FEATURES_FOUND + 1))
    else
        echo -e "${YELLOW}   ⚠️  ${feature} (not found in bundle)${NC}"
    fi
}

check_feature "Dark mode support" "darkMode\|dark-mode"
check_feature "Filter functionality" "filter\|Filter"
check_feature "Location tracking" "location\|Location"
check_feature "Car status management" "arrived\|empty\|late"
check_feature "Board view" "board\|Board"

echo ""
echo "Features found: ${FEATURES_FOUND}/${FEATURES_TOTAL}"
echo ""

# UI/UX Validation Checklist
echo "📋 Manual Validation Checklist:"
echo "========================================"
echo ""
echo "To complete the floor test, verify the following manually:"
echo ""
echo "🤳 iPhone (one-hand thumb):"
echo "   [ ] Filter chips tap accuracy (48px min touch targets)"
echo "   [ ] Arrive / Empty / Late taps work reliably"
echo "   [ ] Board horizontal flick vs vertical scroll (touch-pan-x)"
echo "   [ ] Dark mode toggle accessibility"
echo ""
echo "📱 TC57 / handheld (gloves + glare):"
echo "   [ ] Filter chips tap accuracy (enlarged for gloves)"
echo "   [ ] Arrive / Empty / Late taps (48px min height)"
echo "   [ ] Board horizontal flick (snap-scroll)"
echo "   [ ] Dark mode visibility in warehouse lighting"
echo ""
echo "To test on device:"
echo "1. Build: npm run build"
echo "2. Preview: npm run preview"
echo "3. Open http://localhost:4173 on your device"
echo "   (Or deploy and test on actual URL)"
echo ""
echo "Or run E2E tests:"
echo "  cd e2e && npx playwright test accessibility.spec.js"
echo ""

# Summary
echo "========================================"
if [ $FEATURES_FOUND -eq $FEATURES_TOTAL ]; then
    echo -e "${GREEN}✅ All automated checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Complete manual floor test validation"
    echo "2. Test on actual TC57 or iPhone in warehouse conditions"
    echo "3. Update TODO.md with test results"
else
    echo -e "${YELLOW}⚠️  Some features not detected in bundle${NC}"
    echo "   This might be due to minification/tree-shaking"
    echo "   Manual testing recommended"
fi
echo ""
