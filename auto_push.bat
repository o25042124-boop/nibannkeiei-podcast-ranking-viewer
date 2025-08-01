@echo off
cd /d "C:\Users\User\Documents\nibannkeiei-podcast-ranking-viewer"
python rank_log.py

git pull --rebase origin main
git add .
git commit -m "Daily auto-update and Updated apple json and excel files"
git push origin main
