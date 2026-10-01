# Git Command Cheat Sheet

This guide covers the Git commands from the two tutorial handouts, plus the modern commands you will commonly need in real projects.

> Commands beginning with `$` in tutorials should be typed **without** the `$`.
>
> Replace placeholders such as `<file>`, `<branch>`, `<commit>`, and `<url>` with real values. Do not type the angle brackets.

## 1. Get help and check Git

```bash
git --version
git help <command>
git <command> --help
```

Examples:

```bash
git help commit
git status --help
```

## 2. Configure your identity

Set the name and email recorded in future commits:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Inspect configuration:

```bash
git config --list
git config user.name
git config user.email
```

Use repository-specific details by omitting `--global`:

```bash
git config user.email "work@example.com"
```

## 3. Create or copy a repository

Turn the current directory into a Git repository:

```bash
git init
```

Copy an existing remote repository:

```bash
git clone <url>
git clone <url> <directory-name>
```

SSH example:

```bash
git clone git@github.com:USERNAME/REPOSITORY.git
```

HTTPS example:

```bash
git clone https://github.com/USERNAME/REPOSITORY.git
```

## 4. Inspect the repository

```bash
git status
git status --short
git log
git log --oneline
git log --oneline --graph --decorate --all
git show <commit>
```

Useful special commit names:

- `HEAD`: the commit currently checked out.
- `HEAD~1`: the parent of the current commit.
- `HEAD~2`: two commits before the current commit.

## 5. Compare changes

Show unstaged changes:

```bash
git diff
git diff <file>
```

Show changes already staged for the next commit:

```bash
git diff --staged
git diff --staged <file>
```

Compare two commits or branches:

```bash
git diff <commit-1> <commit-2>
git diff <branch-1>..<branch-2>
```

## 6. Stage changes

Stage one file:

```bash
git add <file>
```

Stage selected files:

```bash
git add <file-1> <file-2>
```

Stage all changes under the current directory:

```bash
git add .
```

Interactively choose parts of files to stage:

```bash
git add -p
```

## 7. Commit changes

Commit staged changes with a message:

```bash
git commit -m "Describe the change"
```

Open the configured editor to write a longer message:

```bash
git commit
```

Modify the most recent **unpublished** commit:

```bash
git add <file>
git commit --amend
```

Change only the most recent commit message:

```bash
git commit --amend -m "Better message"
```

Avoid amending a commit that other people may already have pulled.

## 8. Rename and remove tracked files

```bash
git mv <old-name> <new-name>
git rm <file>
```

Keep a file locally but stop tracking it:

```bash
git rm --cached <file>
```

Normally add that file or pattern to `.gitignore` afterward.

## 9. Undo changes at every stage

### A. The file is untracked

An untracked file has never been staged or committed. Git cannot restore it if you delete it.

To keep it out of Git, leave it untracked or add its name to `.gitignore`.

### B. The file is edited but not staged

Inspect the edits first:

```bash
git diff <file>
```

Discard the edits:

```bash
git restore <file>
```

Discard all unstaged edits under the current directory:

```bash
git restore .
```

Older equivalent found in the handout:

```bash
git checkout -- <file>
```

**Warning:** these commands discard uncommitted work.

### C. The file is staged with `git add`

Unstage it but preserve the edits:

```bash
git restore --staged <file>
```

Unstage everything while preserving the edits:

```bash
git restore --staged .
```

Older equivalent found in the handout:

```bash
git reset <file>
```

### D. The change is committed locally but not pushed

Undo the most recent commit while keeping its changes staged:

```bash
git reset --soft HEAD~1
```

Undo the commit while keeping its changes unstaged:

```bash
git reset HEAD~1
```

Then edit, stage, and commit again:

```bash
git add <file>
git commit -m "Corrected change"
```

### E. The commit has been pushed or shared

Create a new commit that safely reverses it:

```bash
git revert <commit>
git push
```

Reverse the latest commit:

```bash
git revert HEAD
git push
```

To reapply a change that was reverted, revert the revert commit:

```bash
git log --oneline
git revert <revert-commit>
git push
```

Do not reset and force-push shared history unless your team has explicitly agreed to rewrite it.

## 10. Work with remotes

List remotes and their URLs:

```bash
git remote -v
```

Show detailed information about `origin`:

```bash
git remote show origin
```

Add, rename, or remove a remote:

```bash
git remote add <name> <url>
git remote rename <old-name> <new-name>
git remote remove <name>
```

Change a remote URL:

```bash
git remote set-url origin <url>
```

`origin` is the conventional name of the repository from which you cloned.

## 11. Download and publish changes

Download remote information without modifying your current branch:

```bash
git fetch
git fetch origin
```

Download and integrate changes:

```bash
git pull
git pull --rebase
```

Publish the current branch:

```bash
git push
```

Publish a new branch and remember its upstream branch:

```bash
git push -u origin <branch>
```

Later pushes from that branch can normally use:

```bash
git push
```

## 12. Work with branches

List local branches:

```bash
git branch
```

List local and remote-tracking branches:

```bash
git branch -a
```

Create and switch to a new branch:

```bash
git switch -c <branch>
```

Switch to an existing branch:

```bash
git switch <branch>
```

Older equivalents:

```bash
git checkout -b <branch>
git checkout <branch>
```

Rename the current branch:

```bash
git branch -m <new-name>
```

Delete a fully merged local branch:

```bash
git branch -d <branch>
```

Merge another branch into the current branch:

```bash
git switch main
git merge <branch>
```

## 13. Resolve merge conflicts

When a merge or pull reports conflicts:

```bash
git status
```

Open each conflicted file and resolve markers resembling:

```text
<<<<<<< HEAD
your version
=======
incoming version
>>>>>>> other-commit
```

Remove the markers, retain the correct final content, test it, then run:

```bash
git add <resolved-file>
git commit
```

If the conflict came from `git pull --rebase`, continue with:

```bash
git add <resolved-file>
git rebase --continue
```

Cancel an unfinished merge or rebase:

```bash
git merge --abort
git rebase --abort
```

## 14. Temporarily store unfinished work

Stash tracked changes:

```bash
git stash
git stash push -m "Description of unfinished work"
```

Include untracked files:

```bash
git stash -u
```

List saved stashes:

```bash
git stash list
```

Restore the newest stash and remove it from the stash list:

```bash
git stash pop
```

Restore it while retaining the saved stash:

```bash
git stash apply
```

## 15. Tags and releases

Create an annotated tag:

```bash
git tag -a v1.0 -m "Release version 1.0"
```

List tags:

```bash
git tag
```

Show a tag:

```bash
git show v1.0
```

Publish one tag or all tags:

```bash
git push origin v1.0
git push --tags
```

## 16. Find who changed a line

```bash
git blame <file>
```

Show the history of one file, including renames:

```bash
git log --follow -- <file>
```

## 17. Ignore files

Patterns placed in `.gitignore` tell Git which untracked files to ignore. Typical entries:

```gitignore
.env
node_modules/
dist/
*.log
.DS_Store
```

Check why a path is ignored:

```bash
git check-ignore -v <file>
```

`.gitignore` does not automatically stop tracking a file that is already committed. Use `git rm --cached <file>` for that situation.

## 18. Copy one commit to another branch

Apply the changes from one existing commit to the current branch:

```bash
git cherry-pick <commit>
```

If there is a conflict, resolve and stage it, then run:

```bash
git cherry-pick --continue
```

Cancel the operation:

```bash
git cherry-pick --abort
```

## 19. Useful daily workflow

```bash
git status
git pull --rebase

# Edit and test your files.

git diff
git add <relevant-files>
git diff --staged
git commit -m "Describe one logical change"
git push
```

## 20. Quick undo table

| Situation | Safe command | Result |
|---|---|---|
| Edited tracked file, not staged | `git restore <file>` | Discards the edits |
| Staged a file by mistake | `git restore --staged <file>` | Keeps edits, removes them from staging |
| Latest commit is local | `git reset --soft HEAD~1` | Removes commit, keeps changes staged |
| Commit is already shared | `git revert <commit>` | Adds a new commit that reverses it |
| Reverted something and want it back | `git revert <revert-commit>` | Reapplies the original change |
| Merge is going wrong | `git merge --abort` | Returns to the pre-merge state |
| Rebase is going wrong | `git rebase --abort` | Returns to the pre-rebase state |

## 21. Commands requiring special care

These commands can discard work or rewrite history:

```bash
git restore <file>
git reset --hard <commit>
git clean -fd
git push --force
```

Before using them, inspect your repository:

```bash
git status
git diff
git diff --staged
git log --oneline --graph --decorate -10
```

For shared branches, prefer `git revert` over resetting and force-pushing.

## 22. The smallest set to memorize first

```bash
git status
git diff
git add <file>
git diff --staged
git commit -m "Message"
git log --oneline
git pull --rebase
git push
git switch -c <branch>
git restore <file>
git restore --staged <file>
git revert <commit>
```

