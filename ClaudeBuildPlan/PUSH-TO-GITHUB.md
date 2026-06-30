# Pushing ClaudeBuildPlan to your GitHub repo

I (Claude) cannot push directly to your repo — I have no auth or
network access to GitHub. Here are the commands you run from your
own machine.

## Option A: ClaudeBuildPlan as a subfolder in the existing Cappy repo

This matches what you asked for: the build lands under
`Cappy/ClaudeBuildPlan/`.

```bash
# 1. Clone the existing repo
git clone https://github.com/nsm0101/Cappy.git
cd Cappy

# 2. Copy the ClaudeBuildPlan folder from the downloaded zip
#    (assuming you unzipped to ~/Downloads/ClaudeBuildPlan/)
cp -R ~/Downloads/ClaudeBuildPlan ./ClaudeBuildPlan

# 3. Create a feature branch
git checkout -b feat/claude-build-plan

# 4. Commit and push
git add ClaudeBuildPlan
git commit -m "Add Claude-generated Cappy build foundation

- React Native (Expo SDK 51) app scaffold with NFC support
- Supabase backend with schema, RLS policies, triggers, Edge Functions
- Design system ported to React Native components
- Posture C compliance (consumer health app, not HIPAA-covered)
- See ClaudeBuildPlan/BUILD-STATUS.md for what's done
- See ClaudeBuildPlan/HOW-TO-FINISH.md for what's remaining"
git push -u origin feat/claude-build-plan
```

Then on GitHub, open a Pull Request from `feat/claude-build-plan`
into `main`. Review the diff, then merge.

## Option B: Make ClaudeBuildPlan the repo root

If you want the React Native app to be the repo itself (not under a
subfolder), do this instead. This is what I'd actually recommend for
day-to-day work since it makes `pnpm install`, `expo start`, etc.
run from the repo root.

```bash
git clone https://github.com/nsm0101/Cappy.git
cd Cappy

# Move the existing content (likely just README, .git config) into
# a subfolder so it's preserved
mkdir -p docs/previous-readme
git mv README.md docs/previous-readme/README.md 2>/dev/null || true

# Copy the contents of ClaudeBuildPlan to the repo root
cp -R ~/Downloads/ClaudeBuildPlan/. .

git checkout -b feat/claude-build-plan
git add -A
git commit -m "Initialize Cappy React Native app foundation"
git push -u origin feat/claude-build-plan
```

## After pushing

1. On your dev machine, get the app running:
   ```bash
   cd ClaudeBuildPlan  # or cd to repo root if you chose Option B
   cp .env.example .env
   # Edit .env — fill in Supabase URL + anon key after creating a project
   pnpm install
   ```

2. Read `BUILD-STATUS.md` to understand what's working
3. Read `HOW-TO-FINISH.md` for the remaining tickets
4. Hand the first ticket (TICKET-NAV) to a coding agent or do it
   yourself

## If you want to share this with another contributor or agent

Push to a branch, share the branch URL, and they can clone with:
```bash
git clone -b feat/claude-build-plan https://github.com/nsm0101/Cappy.git
```

That's it. No special tooling required.
