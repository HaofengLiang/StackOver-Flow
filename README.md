# cse356
    Course Project: Build Mini-stackoverflow API
---
## Terminal commands to install Nodejs(v11), MongoDB to one instance
```sh
# install Nodejs on Ubuntu 
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt-get install -y nodejs

# install Nginx on Ubuntu
sudo apt-get update
sudo apt-get install nginx

# install MongoDB on Ubuntu
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```
### [Click here to get the instruction link install MongoDB](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)

---
