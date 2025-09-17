#!/bin/bash
# build-fix.sh - ビルド通過のための一括修正スクリプト（macOS/BSD sed 前提）
set -euo pipefail

echo "🔧 Starting build fixes..."

# ===== helpers =====
lowercase_mv() {
  # 大文字→小文字のリネーム（case-insensitive FSに対応するため一旦一時名へ）
  local src="$1"
  local dst="$2"
  if [ -f "$src" ] && [ ! -f "$dst" ]; then
    local tmp="${src}.tmp__rename__"
    mv "$src" "$tmp"
    mv "$tmp" "$dst"
    echo "  renamed: $src -> $dst"
  fi
}

replace_import() {
  # $1: before, $2: after
  local before="$1"
  local after="$2"
  echo "  - $before -> $after"
  # BSD find/sed: null区切りで安全に置換
  find src -type f \( -name "*.tsx" -o -name "*.ts" \) -print0 \
    | xargs -0 sed -i '' "s|$before|$after|g" || true
}

echo "📦 Fixing UI imports to lowercase..."

# Button → button
replace_import "from '@/components/ui/Button'" "from '@/components/ui/button'"
replace_import "from '@/components/UI/Button'" "from '@/components/ui/button'"
replace_import "from '../ui/Button'" "from '../ui/button'"
replace_import "from '../../components/ui/Button'" "from '../../components/ui/button'"
replace_import "from './ui/Button'" "from './ui/button'"
replace_import "from '../components/ui/Button'" "from '../components/ui/button'"

# Card → card
replace_import "from '@/components/ui/Card'" "from '@/components/ui/card'"
replace_import "from '../ui/Card'" "from '../ui/card'"
replace_import "from '../../components/ui/Card'" "from '../../components/ui/card'"
replace_import "from './ui/Card'" "from './ui/card'"
replace_import "from '../components/ui/Card'" "from '../components/ui/card'"

# Badge → badge
replace_import "from '@/components/ui/Badge'" "from '@/components/ui/badge'"
replace_import "from '../ui/Badge'" "from '../ui/badge'"
replace_import "from '../../components/ui/Badge'" "from '../../components/ui/badge'"
replace_import "from './ui/Badge'" "from './ui/badge'"
replace_import "from '../components/ui/Badge'" "from '../components/ui/badge'"

# Input → input
replace_import "from '@/components/ui/Input'" "from '@/components/ui/input'"
replace_import "from '../ui/Input'" "from '../ui/input'"
replace_import "from '../../components/ui/Input'" "from '../../components/ui/input'"
replace_import "from './ui/Input'" "from './ui/input'"
replace_import "from '../components/ui/Input'" "from '../components/ui/input'"

# Table → table
replace_import "from '@/components/ui/Table'" "from '@/components/ui/table'"
replace_import "from '../ui/Table'" "from '../ui/table'"
replace_import "from '../../components/ui/Table'" "from '../../components/ui/table'"
replace_import "from './ui/Table'" "from './ui/table'"
replace_import "from '../components/ui/Table'" "from '../components/ui/table'"

# Tabs → tabs
replace_import "from '@/components/ui/Tabs'" "from '@/components/ui/tabs'"
replace_import "from '../ui/Tabs'" "from '../ui/tabs'"
replace_import "from '../../components/ui/Tabs'" "from '../../components/ui/tabs'"
replace_import "from './ui/Tabs'" "from './ui/tabs'"
replace_import "from '../components/ui/Tabs'" "from '../components/ui/tabs'"

echo "📝 Renaming UI component files to lowercase..."
lowercase_mv "src/components/ui/Button.tsx" "src/components/ui/button.tsx"
lowercase_mv "src/components/ui/Card.tsx" "src/components/ui/card.tsx"
lowercase_mv "src/components/ui/Badge.tsx" "src/components/ui/badge.tsx"
lowercase_mv "src/components/ui/Input.tsx" "src/components/ui/input.tsx"
lowercase_mv "src/components/ui/Table.tsx" "src/components/ui/table.tsx"
lowercase_mv "src/components/ui/Tabs.tsx" "src/components/ui/tabs.tsx"

echo "🎨 Replacing outline variant with secondary/ghost..."
# Button/Badge の outline を安全に secondary に置換（用途に応じ ghost に微修正推奨）
find src -type f -name "*.tsx" -print0 | xargs -0 sed -i '' 's/variant="outline"/variant="secondary"/g' || true
find src -type f -name "*.tsx" -print0 | xargs -0 sed -i '' "s/variant={'outline'}/variant={'secondary'}/g" || true
find src -type f -name "*.tsx" -print0 | xargs -0 sed -i '' "s/variant: 'outline'/variant: 'secondary'/g" || true

echo "📝 Fixing textarea dependencies..."
if [ -f "src/components/ui/textarea.tsx" ]; then
  sed -i '' "s|from '../../lib/utils'|from '../../lib/cn'|g" src/components/ui/textarea.tsx || true
  sed -i '' "s|import { cn } from '../../lib/utils'|import { cn } from '../../lib/cn'|g" src/components/ui/textarea.tsx || true
fi

echo "🔧 Fixing Select component type issues (onValueChange -> onChange placeholder)..."
# 最低限の自動置換（複雑なJSXは手修正推奨）
find src -type f -name "*.tsx" -print0 | xargs -0 sed -i '' \
  's/onValueChange={(\w\+) =>/onChange={(e) => { const \1 = (e.target as HTMLSelectElement).value; /g' || true

echo "✅ Build fixes completed!"
echo "\n⚠️  Please verify manually if any Select components still use onValueChange."

