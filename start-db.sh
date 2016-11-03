export NODE_ENV=aws
rm -f nohup-db.out
#nohup node server-db.js >nohup-db.out
pm2 start --merge-logs -l logs/server-db.log server-db.js 
#tail -f nohup-db.out

