#!/bin/bash

# 1. Get the current time (Format example: 2026.0522.0443)
# This includes the date, hour, and minute to ensure the version number increments every time you push.
NEW_VERSION=$(date +'%Y.%m%d.%H%M')

echo "🚀 Starting version update to: $NEW_VERSION"

# 2. Use jq to automatically modify the version field in package.json and write it back
jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json

# 2.5 Automatically scan all js files in the src directory and generate export statements for index.js
echo "🚀 Dynamically generating index.js exports..."
true > index.js
for file in src/*.js; do
    if [ -f "$file" ]; then
        echo "export * from './$file'" >> index.js
    fi
done

# 2.6 Automatically reset README.md and append the scanned public functions
echo "📝 Updating README.md..."

# 1. Write the default fixed content
cat << 'EOF' > README.md
# firefox-addon-framework-easy

[![License: AGPL v3](https://shields.io)](https://gnu.org)

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.


## Source Code Access

According to the terms of the AGPL-3.0, the source code for this network service must be made available to all users.

You can download, clone, or view the complete source code for this application here: [Insert your GitHub/GitLab URL].

## API Reference (Auto-Generated)

Below is a list of all public functions found inside the `src` directory:

EOF

# 2. Iterate through all js files, capture multi-line signatures, and append them to README
for file in src/*.js; do
    if [ -f "$file" ]; then
        echo "### 📄 File: \`$file\`" >> README.md
        echo "\`\`\`javascript" >> README.md

        # Reads multi-line signatures up to the opening brace or semicolon
        awk '/^export (async )?(function|const|let|var|class) / {
            line = $0
            # Keep reading lines if there is no opening brace or semicolon yet
            while (line !~ /\{/ && line !~ /;/ && (getline next_line) > 0) {
                line = line "\n" next_line
            }
            # Clean up the function body and replace it with standard closing
            sub(/\{.*/, "{  }", line)
            print line
            print ""
        }' "$file" >> README.md

        echo "\`\`\`" >> README.md
        echo "" >> README.md
    fi
done

# 3. Check if there are any code changes to commit
git add .

# 4. Automatically commit and log this release version
git commit -m "chore: bump version to $NEW_VERSION and publish"

# 5. Push to GitHub to trigger cloud-based automated publishing
echo "📤 Pushing to GitHub..."
git push origin main

echo "✅ Push complete! Please check the GitHub Actions page to view the deployment status."
