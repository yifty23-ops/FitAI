Implement the latest changes proposed by the fitai-knowledge-update scheduled agent. This agent runs weekly and creates PRs on GitHub with sports science research updates to `backend/tiers.py` and `backend/services/claude_client.py`.

## How this works

The scheduled agent researches sports science literature and opens a PR with:
- Updates to SPORT_DEMANDS in `backend/tiers.py`
- Updates to research prompts, adaptation thresholds, and citations in `backend/services/claude_client.py`
- A research log in `backend/knowledge_updates/YYYY-MM-DD.md`

Your job is to review that PR, understand the changes, and implement them safely.

## Steps — CRITICAL: Focus ALL attention on ONE step at a time. Do NOT think about other steps.

### Step 0: Enter Plan Mode
Enter plan mode FIRST. Read the PR diff, understand every change, and plan how you will implement them. Your plan must include:
- Which files are affected
- What each change does and why
- The order of implementation
- Potential risks or conflicts with existing code

After completing the plan, SCAN THE ENTIRE PLAN for potential bugs:
- Could any change break string formatting (f-strings, .format(), template placeholders)?
- Could any change break dict structure (missing keys, wrong types)?
- Could any change conflict with existing code patterns?
- Could any change introduce inconsistencies between tiers?

Fix any issues in the plan BEFORE exiting plan mode.

### Step 1: Find the latest PR
Run: `gh pr list --repo yifty23-ops/FitAI --search "Knowledge Update" --state open --json number,title,url,createdAt --limit 5`
If no open PRs, check merged: `gh pr list --repo yifty23-ops/FitAI --search "Knowledge Update" --state merged --json number,title,url,mergedAt --limit 1`
Pick the most recent one.

### Step 2: Read the PR diff
Run: `gh pr diff <number> --repo yifty23-ops/FitAI`
Read the full diff carefully. Identify every change: what text was removed, what text was added, and the citation justifying it.

### Step 3: Read the research log
The PR will include a file like `backend/knowledge_updates/YYYY-MM-DD.md`. Read it from the PR branch:
`gh pr view <number> --repo yifty23-ops/FitAI --json headRefName` then fetch and read the file.
This tells you the evidence quality and confidence level for each change.

### Step 4: Read current local files
Read `backend/tiers.py` and `backend/services/claude_client.py` in your local working tree. Compare with the PR diff — there may be local changes that conflict.

### Step 5: Apply changes one at a time
For each change in the PR:
1. Apply it using the Edit tool
2. Verify the edit preserved all formatting (f-strings, placeholders, indentation)
3. Move to the next change

### Step 6: Verify
1. Run: `cd backend && python -c "import tiers; import services.claude_client; print('imports OK')"` to verify no syntax errors
2. Read both modified files end-to-end to confirm consistency
3. Check that all 10 sports still exist in SPORT_DEMANDS
4. Check that no template placeholders were accidentally removed

### Step 7: Notify
After all changes are applied and verified:
1. Create a GitHub issue on yifty23-ops/FitAI summarizing what was implemented:
   `gh issue create --repo yifty23-ops/FitAI --title "Knowledge Update Implemented: [date]" --body "[summary of changes applied]"`
2. Comment on the original PR that changes were implemented locally

Do NOT commit or push — the user will review and commit when ready.
