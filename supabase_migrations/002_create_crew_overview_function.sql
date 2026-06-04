### Step 1: Apply database migration
cd lib/db
pnpm push

# Step 2: Go back and generate API client code
cd ..
cd api-spec
pnpm codegen

# Step 3: Done! You can verify by checking if files were generated
cd ../../lib/api-client-react/src/generated