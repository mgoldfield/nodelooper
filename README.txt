Usage:

currently hosted at: https://loopmagic.live

local: 
0. install aws cli and add creds
1. install docker
2. if running locally, drop these in your environment variables
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY    
3.5 run tools/setConfig.sh <env> where <env> is in "prod", "dev", or "local" to put the configs in the right place
3. run `docker-compose up --build`


ec2:
launch instance with correct ami role (currently using m5.large)
open ports 80 and 443 in aws security
copy in correct configs (will automate eventually)
copy s3://looper-config/ssl to /etc/letsencrypt
install docker and docker compose (use instructions on docker website)
run tools/setConfig.sh <env> where <env> is in "prod",
run `sudo docker-compose -f docker-compose.prod.yml up --build -d`


for updating certs:
    install nginx locally and run certbot steps
    copy everything in /etc/letsencrypt to s3://looper-config/ssl/

