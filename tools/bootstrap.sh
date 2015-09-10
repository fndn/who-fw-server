#!/bin/sh

# curl http://128.199.38.137:3000/api/version

## Stack

echo "Configuring apt-get..."
add-apt-repository -y ppa:chris-lea/node.js
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list

# Update the apt-get
echo "Updating apt-get..."
apt-get -q -y update

# Install
echo "Installing binary stack..."
apt-get -q -y install build-essential nodejs mongodb-10gen git pkg-config

echo "Installing javascript stack..."
npm install forever -g
npm install pm2 -g
pm2 updatePM2
pm2 startup ubuntu

echo "Installing sharp (image resizer)"
curl -s https://raw.githubusercontent.com/lovell/sharp/master/preinstall.sh | bash -


# Setup Server Application
mkdir -p /var/www/whofw
cd /var/www/whofw

echo "Configuring git in `pwd`"
git init
git config --global user.email "whofw@fndn.dk"
git config --global user.name "whofw server"
git remote add origin https://github.com/fndn/who-fw-server.git

# Install
echo "Installing application to `pwd`"
git pull origin master

# Post install
echo "Bootstrapping application..."
sleep 1
npm install


echo ""
