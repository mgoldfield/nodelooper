To Do:
- set up db - maybe store audio files in dynamo?
- rabbitmq

loop communication
chat
security/no bots


....

- figure out how to do rolling deploy with beanstalk

- small box around stop/play/rec
- reps config (only available if click is on) meas. on, meas. off

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
- ddos prevention with IP and user-agen fingerprinting

- testssssss / jest
- snap to beat in main progress bar
- more latency futzing

instructions/faq:
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
mirah
micah 
alex
batya
lucy
aliza?
anna f
molly
jens


THINKING:...

potential dynamo schema

loop:
loop id
project id
metadata
file or location in s3 (start with whole file)




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

