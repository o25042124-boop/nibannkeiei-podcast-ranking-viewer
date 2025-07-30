@echo off
cd /d "C:\Users\User\Documents\nibannkeiei-podcast-ranking-viewer"
python rank_log.py

git pull --rebase origin main
git add .
git commit -m "Daily auto-update"
git push