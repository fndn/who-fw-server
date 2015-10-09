#!/bin/sh

# todo: add section to provision a DO machine

#set -e

DIR=`pwd`
SERVER="46.101.177.65"
APIDOMAIN="whofw.fndn.dk:8080"
REMOTE_DIR="/var/www/whofw"


git add --all .
git commit -a -m "$(node -pe 'require("./package.json").version') auto"
git push origin master


echo ""
echo 'Working @ remote '$SERVER
ssh root@$SERVER 'cd '$REMOTE_DIR'; git pull origin master; pm2 reload all;'


echo ""
echo "restarting (1)"
sleep 1 # give the app time to (re)start


echo "updated server, now running version: curl https://$APIDOMAIN/version"
curl https://$APIDOMAIN/version
echo ""
