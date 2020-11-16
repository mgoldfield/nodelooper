Usage:

local: 
0. install aws cli and add creds
1. install docker
2. if running locally, drop these in your environment variables
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY    
3. run `docker-compose up --build`


ec2:
launch instance with correct ami role
edit app/config-app.js and api/config-api.js and change "localhost" to the ip of the server (will make this automated eventually...)
follow this to install docker: https://gist.github.com/npearce/6f3c7826c7499587f00957fee62f8ee9
run `sudo docker-compose up --build -d`
