git fetch origin
git reset --hard origin/master
npm i -f
npm run build
pm2 restart 2
