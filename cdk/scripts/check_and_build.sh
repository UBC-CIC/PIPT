#!/bin/bash
set -e

# Determines whether a Docker build is needed based on changed files.
# Expects environment variables: REPO_NAME, PATH_FILTER, CODEBUILD_SRC_DIR
# Exit 0 = build needed, Exit 1 = skip build

cd "$CODEBUILD_SRC_DIR"

# Check if image exists in ECR
if ! aws ecr describe-images --repository-name "$REPO_NAME" --image-ids imageTag=latest &>/dev/null; then
  echo "First deployment or image doesn't exist - building without path check"
  exit 0
fi

# Initialize git if needed (CodePipeline source may not have .git)
if [ ! -d .git ]; then
  echo "No git history available - building to be safe"
  exit 0
fi

PREV_COMMIT=$(git rev-parse HEAD~1 || echo "")
if [ -z "$PREV_COMMIT" ]; then
  echo "First commit - building"
  exit 0
fi

CHANGED_FILES=$(git diff --name-only "$PREV_COMMIT" HEAD)
echo "Changed files:"
echo "$CHANGED_FILES"

if ! echo "$CHANGED_FILES" | grep -q "^$PATH_FILTER/"; then
  echo "No changes in $PATH_FILTER — skipping build."
  exit 1
fi

exit 0
