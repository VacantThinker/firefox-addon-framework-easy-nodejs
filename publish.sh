#!/bin/bash

# 1. 获取当前时间（格式例如：2026.0522.0443）
# 这样不仅带日期，还精确到时分，绝对保证每次 push 时的版本号都是递增的，永远不会重复
NEW_VERSION=$(date +'%Y.%m%d.%H%M')

#CURRENT_YEAR=$(date +'%Y')
#CURRENT_MONTH=$(date +'%m' | sed 's/^0//')
#CURRENT_DAY=$(date +'%d' | sed 's/^0//')
#CURRENT_TIME=$(date +'%H%M')
#NEW_VERSION="${CURRENT_YEAR}.${CURRENT_MONTH}.${CURRENT_DAY}${CURRENT_TIME}"


echo "🚀 开始更新版本号至: $NEW_VERSION"

# 2. 使用 jq 自动修改 package.json 中的 version 字段，并写回原文件
jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json

# 3. 检查是否有需要提交的代码变化
git add .

# 4. 自动提交并记录本次发布的版本
git commit -m "chore: bump version to $NEW_VERSION and publish"

# 5. 一键推送到 GitHub，触发云端免密发布
echo "📤 正在推送至 GitHub..."
git push origin main

echo "✅ 推送完成！请前往 GitHub Actions 页面查看发布状态。"
