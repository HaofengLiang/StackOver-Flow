# cse356
    Course Project: Build Mini-stackoverflow API
---
## Common commands to be used
```sh
# remove ssh host-key
ssh-keygen -R [ip]
# enter then instance using ssh
ssh -i [path ot ssh private key file] [ubuntu/root]@[ip]
```
## Terminal commands to install Nodejs(v11), MongoDB, Nginx  to one instance
### [Click here to get the instruction link install MongoDB](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)
```sh
# intstall curl
sudo apt-get install curl
# install Nodejs on Ubuntu 
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs
# install Nginx on Ubuntu
sudo apt-get install nginx
```
---

## install rabbitmq, sendmail for sending bulk email
# install RabbitMQ(https://www.rabbitmq.com/install-debian.html)
```sh
# remove postfix if you have
which postfix  --> check
sudo systemctl stop postfix
sudo apt-get remove postfix && apt-get purge postfix
sudo apt-get install sendmail
# configure sendmail service
sudo sendmailconfig
```

## Install elasticsearch, memcached, sendmail
```sh
#intall JDK for elasticsearch
## install it for using add-repository, /etc/apt/sources.list.d
sudo apt-get install software-properties-common
sudo add-apt-repository ppa:linuxuprising/java
apt-get install oracle-java11-installer
cd /etc/apt/sources.list.d
## install elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
sudo echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | sudo tee -a /etc/apt/sources.list.d/elastic-7.x.list
sudo apt-get install apt-transport-https
sudo apt-get install elasticsearch
 service elasticsearch start/status
## configure elasticsearch's yml file
sudo nano /etc/elasticsearch/elasticsearch.yml
## simple check elasticserach
curl -X GET "localhost:9200"

#install memcacehd on ubuntu
sudo apt-get install memcached -y
## config file
sudo nano /etc/memcached.conf
## check that Memcached is up and running,
apt-get install libmemcached-tools
memcstat --servers="127.0.0.1"

# install pm2
sudo apt-get update
sudo npm install pm2 -g
```
---

## Basic commands
```sh 
#  listening only for TCP connections
netstat -tulpn 
```
---
## Handle Errors
```sh
# Sub-process /usr/bin/dpkg returned an error code (1)
sudo dpkg --configure -a
#  cqlsh localshot refuse
export CQLSH_NO_BUNDLED=true

```
---
```sh
# commands for mongoDb , /etc/mongod.conf
service mongod  status

---

sudo netstat -ntlp | grep LISTEN
###

# Nginx + Elasticsearch + Nodejs
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

location /elasticsearch {
    proxy_pass http://localhost:9200;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}