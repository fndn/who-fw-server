#!/bin/sh

#set -e

DIR=`pwd`
SERVER="46.101.177.65"
APIDOMAIN="whofw.fndn.dk:8080"



git add --all .
git commit -a -m "$(node -pe 'require("./package.json").version') auto"
git push origin master
cd $DIR


echo ""
echo 'Working @ remote '$SERVER
ssh root@$SERVER 'cd /var/www/whofw/; git pull origin master; pm2 reload all;'


# -- back to local again --
echo ""
echo "restarting (10)"
sleep 10 # give the app time to (re)start


echo "updated server, now running version: curl http://$APIDOMAIN/api/version"
curl http://$APIDOMAIN/version
echo ""
