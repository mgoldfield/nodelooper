Loopmagic is a web application for collaboratively recording and editing music with only a browser!  
Relies on the somewhat newly supported AudioContext features supported across major browsers, which continues to change and evolve. 


local: 
0. install aws cli and add creds
1. install docker
2. if running locally, drop these in your environment variables
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY    
3.5 run tools/setConfig.sh <env> where <env> is in "prod", "dev", or "local" to put the configs in the right place
3. run `docker-compose up --build`


ec2:
launch instance with correct ami role (currently using t2.medium) running ubuntu 20
open ports 80 and 443 in aws security
run ./tools/setConfig.sh
copy s3://looper-config/ssl-latest to /etc/letsencrypt
install docker with snap 
run tools/setConfig.sh <env> where <env> is in "prod",
run `sudo docker compose -f docker-compose.prod.yml up --build -d`


for updating certs:
    install nginx locally and run certbot steps
    copy everything in /etc/letsencrypt to s3://looper-config/ssl/

