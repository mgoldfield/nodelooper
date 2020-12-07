Usage:

local: 
0. install aws cli and add creds
1. install docker
2. if running locally, drop these in your environment variables
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY    
3. run `docker-compose up --build`


ec2:
launch instance with correct ami role (currently using m5.large)
open ports 80 and 443 in aws security
copy in correct configs (will automate eventually)
copy s3://looper-config/ssl to /etc/letsencrypt
install docker and docker compose (use instructions on docker website)
run `sudo docker-compose -f docker-compose.prod.yml up --build -d`


for updating certs:
    install nginx locally and run certbot steps
    copy everything in /etc/letsencrypt to s3://looper-config/ssl/



input mon delay...

inputs blank when audio not enabled

faq: using w zoom, length of projects (future plans)

count-in but no click

1:08 on molly - out of sync

if device has no label, fail over to device type or other message

bpm -> meter/beats?

default tempo 100

gain - logarithmic growth

click starts incorrectly when starting off set from the beginning

sound.js 422 - loading hang

space bar play (other keyboard shortcuts?)

length = longest loop or longest play

delete right after create loop causes error

fix file loader (allow mp3s?)

default device label or maybe device id when no device label