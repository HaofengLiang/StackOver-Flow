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
## For send big entity, need to modify nginx config file: /etc/nginx/sites-available/default
sudo nano /etc/nginx/nginx.conf
# Add these two lines
client_max_body_size 200M;
client_body_buffer_size 16k;
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

## Install elasticsearch,pm2
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

# install pm2
sudo apt-get update
sudo npm install pm2 -g
```
---

##  Install  Go, Monstache
```sh
# Install GO
sudo apt-get install golang
mkdir ~/go; echo "export GOPATH=$HOME/go" >> ~/.bashrc
echo "export PATH=$PATH:$HOME/go/bin:/usr/local/go/bin" >> ~/.bashrc
# restart bashrc
source ~/.bashrc
# install monstache
echo "export PATH=$HOME/build/linux-amd64:$PATH" >> ~/.bashrc
# restart bashrc
source ~/.bashrc
```
---
## Basic commands
```sh
#  listening only for TCP connections
netstat -tulpn
sudo netstat -ntlp | grep LISTEN
## About Java
sudo update-alternatives --config java
sudo nano /etc/environment # --- JAVA_HOME="/usr/lib/jvm/java-8-oracle/jre/bin/"
source /etc/environment
# clean log memory
sync; sudo sh -c "echo 3 > /proc/sys/vm/drop_caches"
```
---
## Handle Errors
```sh
# Sub-process /usr/bin/dpkg returned an error code (1)
sudo dpkg --configure -a
#  if cqlsh localhost refuse
export CQLSH_NO_BUNDLED=true
```
---
## Configuration
### Mongo DB
1. Conf file:  /etc/mongod.conf
2.  Allow remote access: bingIP: 0.0.0.0

### Nginx reverse Proxy service
1. Con file /etc/nginx/sites-available/default
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
### Elasticsearch
```sh
#configure yml file and check if works: host_ip: 0.0.0.0
sudo nano /etc/elasticsearch/elasticsearch.yml
curl -X GET "localhost:9200"
```
### Monstache Config File
#### Commands to run config file with multi-workers
monstache -f mongo-elastic.toml -worker worker1 & monstache -f mongo-elastic.toml -worker worker2 &monstache -f mongo-elastic.toml -worker worker3
#### Toml File 
```toml
workers = ["worker1","worker2","worker3"]
mongo-url = "mongodb://localhost:27017"
elasticsearch-urls = ["http://localhost:9200"]
prune-invalid-json=true
index-as-update = true
change-stream-namespaces = ['firewall.questions']
dropped-collections = true
dropped-databases = true
replay = false
resume = true
resume-name = "default"
resume-write-unsafe = false
#verbose = true
exit-after-direct-reads = false

[[mapping]]
namespace = "firewall.questions"
index = "questions"
type = "questions_type"

[[script]]
namespace = "firewall.questions"
script = """
module.exports = function(doc){
   if(doc.user){
      doc.user = findId(doc.user, {
        database: "firewall",
        collection: "users",
        select:{
           _id: 0,
           username:1,
           reputation: 1
        }
     })
    }
    if(doc.accepted_answer_id == null){
        doc.accepted_answer_id = [];
}
    doc.score = (doc.upvote).length - (doc.downvote).length;
    doc.view_count = (doc.viewers).length;
    doc.answer_count = (doc.answers).length;
    return _.omit(doc,"viewers", "answers", "upvote", "downvote");
}
"""    
```
#### for Bulk Data -- Need to modify elasticsearch.yml file
```yml
http.compression: true
    thread_pool:
        bulk:
        queue_size: 500 
```
