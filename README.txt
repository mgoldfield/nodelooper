To Do:
- set up db - maybe store audio files in dynamo?
- rabbitmq

loop communication
chat
security/no bots
- latency fixup


....

- small box around stop/play/rec
- reps on / reps(or measures) off for a loop instead of max reps? 

- memcached -- do I not even need a database???????? -- ans: need a DB if you want to scale to multiple servers...
- dockerize

- show loops being recording - maybe thin flashing bars with name of recorder ?
- apogee element bug
- what happens when a device becomes unavailable mid-recording / while app is open?

- title page
- github readme
- max length for a loop

- testssssss

- more latency futzing


v2: 
- loops transmitted in chunks
- compressor
- distortion
- create waveform images while/after recording


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


Testers:
mirah
micah 
alex
batya
lucy
aliza?


THINKING:...

potential dynamo schema

loop:
loop id
project id
metadata
file or location in s3 (start with whole file)




