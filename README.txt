To Do:
- playback balanced stereo with mono tracks
- way to track progess on each loop
- create waveform images while/after recording
- listen-through/ input monitoring
- download mixed loops and individal loops
- input picker
- allow loops to be uploaded
- allow manipulation of progress bar and recording at a certain spot

With api:
- can two people record at the same time?  I think yes...
- show loops being recording - maybe thin flashing bars with name of recorder ?



v2: 
- compressor
- distortion



done:
- play button flashes when record is toggled

./src/looper.js:            // toDo: what to do with names
./src/looper.js:        // toDo: handle stop correctly if stopped within countIn 
./src/looper.js:        // toDo: don't allow play if no loops have been recorded
./src/looper.js:            //toDo: gray out click when playing
./src/looper.js:        // toDo: don't allow countIn if click isnt selected, grey out button
./src/looper.js:        // toDo: make font on loop name the same as rest of app
./src/sound.js:        // toDo: only count in when recording
./src/sound.js:    // toDo: figure out when to suspend and resume audioContext
./src/sound.js:        // toDo: determine what waitTime should actually be
./src/sound.js:        //toDo: determine if buffer needs baseLatency trimmed from the end
./src/sound.js:        //toDo: round buffer to multiple of initial loop
./src/sound.js:            // toDo: what's wrong with latency when no count-in click

