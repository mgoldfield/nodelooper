Usage:

local: 
0. run `npm install` in both the `app` and `api` directories
1. In the `api` directory, run `./startLocal.sh`
2. In the `app` directory, run `npm start`
3. navgate to the api url 'localhost:3001/newsesh' to start a loop, and copy the link you are redirected to to share the loop



To Do:
- more latency futzing - especially remove quant and see whats happening when I'm trimming stuff off of the back of the loop.  I think I'm probably trimming too much off the back?  
- snap to beat in main progress bar

- small box around stop/play/rec
- reps config (only available if click is on) meas. on, meas. off

- lambda deleting rabbit users and queues 
- figure out how to do rolling deploy with beanstalk?
- dockerize

- apogee element bug
- what happens when a device becomes unavailable mid-recording / while app is open?

- title page
- github readme

security:
- max length for a loop
- max loops
- max participants per loop
- max participants global
- ddos prevention with IP and user-agent fingerprinting
- prevent bots
- https!!! on rabbit in particular

- write out dynamo changes in cli
- testssssss / jest

instructions/faq:
- loops persist for 1 day
- how to convert wav to mp3
- how to use midi
- how is this project funded?



v2: 
- loops transmitted in chunks
- compressor
- distortion
- create waveform images while/after recording
- memcached...



Testers:
Dan Dickison - collaborator

--

pssible
mirah
micah 
alex
batya
lucy
aliza?
dani?
anna f
molly
jens
maeve
jenna moynihan
liz cook
noah weinberg
george guitar teacher
chloe




done:
- title bar
- instructions on left bar
- modularize jsx 
- max number of loop repeats
- allow manipulation of progress bar and recording at a certain spot
- allow loops to be uploaded
- download mixed loops and individal loops
- input picker
- listen-through/ input monitoring
- play button flashes when record is toggled
- playback balanced stereo with mono tracks
- way to track progess on each loop
- show loops being recording - maybe thin flashing bars with name of recorder ?

