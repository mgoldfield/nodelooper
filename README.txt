To Do:
- playback balanced stereo with mono tracks
- way to track progess on each loop
- create waveform images while/after recording
- listen-through/ input monitoring
- download mixed loops and individal loops
- input picker
- allow loops to be uploaded
- play button flashes when record is toggled
- show loops being recording - maybe thin flashing bars with name of recorder ?


./src/looper.js:        // toDo: don't allow record if progress bar isn't at the beginning
./src/looper.js:            // toDo: check recording lock when it exists
./src/looper.js:            //toDo: gray out click when playing
./src/looper.js:        // toDo: don't allow countIn if click isnt selected, grey out button
./src/looper.js:            // toDo: what to do with names
./src/looper.js:        // toDo: make font on loop name the same as rest of app
./src/sound.js:    // toDo: figure out when to suspend and resume audioContext
./src/sound.js:        // toDo: only count in when recording
./src/sound.js:        // toDo: determine what waitTime should actually be
./src/sound.js:        // toDo: delete this or make it a log before you're done
./src/sound.js:        //toDo: is this the right thing to do with outputLatency?
./src/sound.js:            // toDo: maybe move quantize into record? probably not, but could allow for recording more sound instead of adding just silence
./src/sound.js:        //toDo: determine if buffer needs baseLatency trimmed from the end
./src/sound.js:        //toDo: round buffer to multiple of initial loop
./src/sound.js:            // toDo: examine assumptions about outputLatency
./src/sound.js:            // toDo: what's wrong with latency when no count-in click
./src/sound.js:    initBuff(){ //toDo: make a higher pitched click for the count-in
./src/sound.js:        // toDo: is this right - ?



v2: 
- compressor
- distortion



done:
./src/looper.js:        // toDo: handle stop correctly if stopped within countIn 
./src/looper.js:        // toDo: don't allow play if no loops have been recorded
