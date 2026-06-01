# Synaps Git Cheat Sheet

Here are the commands you need to push changes from your local computer and pull them onto your NAS.

## 1. On your LOCAL computer (Mac)
Run these commands in your terminal whenever you want to save and upload your changes to GitHub:

```bash
# 1. Add all the modified files to be saved
git add .

# 2. Commit (save) the changes with a message describing what you did
git commit -m "Added content-based duplicate detection"

# 3. Push the changes to GitHub
git push origin main
```

*(Tip: You can change the `"Added content-based duplicate detection"` message to whatever describes your most recent work!)*

---

## 2. On your NAS
Once the changes are pushed to GitHub, log into your NAS and run the `update.sh` script we previously created. This script will automatically pull the changes and rebuild the app!

```bash
# Make sure you are in the nas_dashboard directory, then run:
./update.sh
```

### Alternatively, if you just want to pull manually on the NAS:
```bash
git pull origin main
```
