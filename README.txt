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


./app/src/communicate.js:                        // toDo: fail more gracefully here if the loop doesn't exist
./app/src/looper.js:        // toDo: make a "loading" light
./app/src/looper.js:        // toDo: don't allow tempo change during play if quantized
./app/src/looper.js:                        {/* toDo: add user indicators here */}
./app/src/sound.js:// toDo: break up sound.js into more files
./app/src/sound.js:// toDo: make a parent class for loop and loop bunch which 
./app/src/sound.js:        // toDo: is this working? 
./app/src/sound.js:        //toDo: fail gracefully here... catch in looper and display a message
./app/src/sound.js:                        // toDo: examine assumptions about outputLatency
./app/src/sound.js:        // toDo: no dupe names!!
./app/src/sound.js:        //toDo: transmit this to other users
./app/src/sound.js:        //toDo: is this the right thing to do with outputLatency?
./app/src/sound.js:    initBuff(){ //toDo: make a higher pitched click for the count-in
./api/api.js:app.use(cors()); // toDo: is this needed
./api/db.js:// toDo: add exponential backoff to dynamo requests
./api/db.js:        //toDo: retreive from s3
./api/db.js:            let s3loc = uuidv4(); // toDo: change this

todo: msg in blank space under unused loops