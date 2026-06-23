#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# 1. Get the current time (Format example: 2026.0522.0443)
NEW_VERSION=$(date +'%Y.%m%d.%H%M')

echo "🚀 Starting version update to: $NEW_VERSION"

# 2. Use jq to automatically modify the version field in package.json and write it back
jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json

# 4. Automatically generate src/index.ts
echo "⚙️ Generating src/index.ts..."
# Clear the file first if it exists, or create an empty one
true > src/index.ts

# Loop through all .ts files in the src directory
for file in src/*.ts; do
  # Extract just the filename without the path
  filename=$(basename -- "$file")

  # Skip generating an export for index.ts itself to avoid circular dependency
  if [ "$filename" != "index.ts" ]; then
    # Remove the .ts extension
    module_name="${filename%.ts}"
    # Append the export statement to src/index.ts
    echo "export * from './$module_name';" >> src/index.ts
  fi
done

echo "✅ src/index.ts generated successfully."

# 5. Stage source files and configuration changes only
# Note: Ensure 'dist/' is added to your .gitignore so it isn't tracked.
git add . # add all file

# 6. Automatically commit and log this release version
git commit -m "chore: bump version to $NEW_VERSION and push to CI"

# 7. Push to GitHub to trigger the Actions workflow
echo "☁️ Pushing to GitHub..."
git push origin main

echo "🎉 Push complete! The GitHub Action will now compile TypeScript and publish to npm."