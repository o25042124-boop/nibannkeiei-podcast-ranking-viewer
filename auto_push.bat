@echo off
cd /d "C:\Users\User\Documents\nibannkeiei-podcast-ranking-viewer"
python rank_log.py

git pull --rebase origin main
git add data.json
git commit -m "自動更新 %date% %time%"
git push origin main