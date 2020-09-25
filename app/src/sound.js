
class AudioLoopBunch{
    constructor(){
        this.audioLoops=[];
        this.recordingLoop = null;

        this.clickTrack = new ClickTrack(this.getAudioContext);
        this.quantized = true;

        this.recording = false;
        this.playing = false;

        this.mergeOutOfDate = true;
        this.mergeNode = null;
        this.gainNode = this.getAudioContext().createGain();
        this.gainNode.connect(this.getAudioContext().destination);

        this.inputMonitoring = false;
        this.inputMontiorSource = null;

        this.ondevicechange = null;
        this.refreshAvailableDevices();
        navigator.mediaDevices.ondevicechange = this.refreshAvailableDevices;

        // set by looper 
        this.updateProgressBar = null;
    }

    // we don't suspend audiocontext here because we're mostly using it in the app
    getAudioContext = () => {
        if (!this._audioContext){
            this._audioContext = new AudioContext({
                latencyHint: 'interactive', 
                sampleRate: 44100,
            });
        }
        return this._audioContext;
    };

    refreshAvailableDevices = async function() {
        let devices = await navigator.mediaDevices.enumerateDevices();
        this.availableDevices = devices.filter((d) => d.kind === 'audioinput');

        //toDo: fail gracefully here... catch in looper and display a message
        this.device = this.availableDevices[0].deviceId;

        if (this.ondevicechange){
            this.ondevicechange(this.availableDevices);
        }
    }

    getUserAudio(){
        let options = {
            video: false,
            audio: {
                deviceId: this.device, 
                echoCancellation: false, 
                noiseSuppression: false,
                autoGainControl: false
            } 
        };
        return navigator.mediaDevices.getUserMedia(options);
    }

    toggleInputMonitoring(){
        this.inputMonitoring = !this.inputMonitoring;

        if (this.inputMonitoring){
            this.getUserAudio()
            .then((stream) => {
                if (this.inputMonitoring){
                    this.inputMontiorSource = this.getAudioContext().createMediaStreamSource(stream);
                    this.inputMontiorSource.connect(this.getAudioContext().destination);
                }
            })
            .catch((error) => {
                console.log(error);
                alert("Error connecting to input audio: " + error.toString());
            });
        }else{
            if (this.inputMontiorSource){
                this.inputMontiorSource.disconnect();
                this.inputMontiorSource = null;
            }
        }
    }


    prepareToRecord(id){
        this.recordingLoop = new AudioLoop(id, this.getAudioContext);
        return this.recordingLoop;
    }

    unprepareToRecord(){
        this.recordingLoop = null;

        // if we started recording but pressed stop...
        this.recording = false;
    }

    record(onEarlyStop){
        if (!this.recordingLoop) 
            throw Error("Record has not been prepped...something is wrong");

        this.recording = true;

        // mediaPromise, playBunch, stopBunch, handleChunk, clickTrack, quantized, onEarlyStop, onSuccess
        this.recordingLoop.recordBuffer(
            this.getUserAudio(),
            (() => this.playLoops()),
            (() => this.stop()),
            this.handleChunk,
            this.clickTrack,
            this.quantized,
            () => {
                onEarlyStop();
                this.unprepareToRecord();
            },
            () => {
                this.audioLoops.push(this.recordingLoop);
                this.mergeOutOfDate = true;
            }
        );
    }

    handleChunk = (chunk) => {
        return;
    };

    stop(){
        if (this.recording){
            this.recordingLoop.stop();
            this.recording = false;
        }
        this.stopLoops();
        this.playing = false;
        this.updateProgressBar(0);
    }

    refreshMergeNode(){
        if (this.mergeOutOfDate){
            // number of loops + click track 
            if (this.mergeNode)
                this.mergeNode.disconnect();
            if (this.audioLoops.length > 0)
                this.mergeNode = this.getAudioContext().createChannelMerger(this.audioLoops.length * 2);
            for (let i = 0; i < this.audioLoops.length; i++){
                this.audioLoops[i].disconnect();
                this.audioLoops[i].connect(this.mergeNode, 0, 2 * i);
                this.audioLoops[i].connect(this.mergeNode, 1, 2 * i + 1);
            }
            if (this.mergeNode)
                this.mergeNode.connect(this.gainNode);
            this.mergeOutOfDate = false;
        }
    }


    startUpdatingProgressBar(playTime){
        if (this.playing){
            let totalTime = this.getAudioContext().currentTime - playTime;
            if (totalTime > 0)
                this.updateProgressBar(totalTime);                
            setTimeout(()=>{this.startUpdatingProgressBar(playTime)}, 500);
        }        
    }

    playLoops(){
        this.refreshMergeNode();
        this.playing = true;

        let waitTime = 0.0001 + this.getAudioContext().baseLatency;
        let clickStartTime = this.getAudioContext().currentTime + waitTime;
        let playTime = clickStartTime;
        if (this.clickTrack.clicking && this.clickTrack.countIn && this.recording)
            playTime += this.clickTrack.oneMeasureInSeconds;

        this.clickTrack.start(clickStartTime);
        for (const l of this.audioLoops)
            l.play(playTime);

        this.startUpdatingProgressBar(playTime);
        return playTime;
    }

    stopLoops(){
        this.clickTrack.stop();

        for (const l of this.audioLoops)
            l.stop()
    }

    setGain(g){
        this.gainNode.setValueAtTime(g, this.getAudioContext().currentTime);
    }
}


class AudioLoop {
    constructor(id, getAudioContext, chunkSize=5000){
        this.buffer = null;
        this.source = null;
        this.mediaRecorder = null;
        this.getAudioContext = getAudioContext;
        this.chunkSize = chunkSize;        

        this.recording = false;
        this.playing = false;
        this.muted = false;
        this.looping = true;

        this.name = null;

        this.gainNode = this.getAudioContext().createGain();
        this.updateProgress = null; // set in looper when creating loop progress bar

        this.redraw = () => null;
    }

    get length(){
        return this.buffer.length / this.buffer.sampleRate;
    }

    setName(name){
        this.name = name;
        //toDo: transmit this to other users
    }

    setRedraw(f){
        this.redraw = f;
    }

    play(contextTime){
        if (this.playing) return;

        this.playing = true;
        this.redraw({'playing':true});

        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode, 0);
        this.source.loop = this.looping;
        //toDo: is this the right thing to do with outputLatency?
        let startTime = contextTime - this.getAudioContext().outputLatency;
        this.source.start(startTime);
        this.startLoopProgressBar(startTime);
    }

    startLoopProgressBar(startTime){
        if (!this.playing){
            this.updateProgress(0);
            return;
        }

        let currPlayTime = this.getAudioContext().currentTime - startTime;
        if (currPlayTime > 0){
            if (this.looping)
                this.updateProgress(currPlayTime % this.length / this.length);
            else
                this.updateProgress(Math.min(currPlayTime / this.length, 1));
        }
        
        setTimeout(() =>{this.startLoopProgressBar(startTime)}, 250);
    }

    stop(){
        if (this.recording) {
            this.mediaRecorder.stop();
            this.recording = false;
            this.redraw({'recording': true});
        }

        if (this.playing){
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.playing = false;
        this.redraw({'playing':false});
    }

    toggleMute(){
        if (this.muted){
            this.setGain(this.formerGain);
        }else{
            this.formerGain = this.gainNode.gain.value;
            this.setGain(0.0);
        }
        this.muted = !this.muted;
    }

    toggleLoop(){
        if (this.playing){
            if (this.looping){
                this.stop();
            }
        }
        this.looping = !this.looping;
    }

    setGain(g){
        this.gainNode.gain.setValueAtTime(g, this.getAudioContext().currentTime);
    }

    connect(dest, index){
        this.gainNode.connect(dest, 0, index);
    }

    disconnect(){
        this.gainNode.disconnect();
    }

    trimAndQuantizeAudio(buffer, targetLength, quantized, quantUnit){
        // first we trim to target length from the beginning
        // then we add or trim from the end to quantize if qantized is set to true

        let samplesToTrim = buffer.length - Math.round(targetLength * buffer.sampleRate);
        let trimmedAudio = new Float32Array(buffer.length);
        buffer.copyFromChannel(trimmedAudio, 0, 0);
        trimmedAudio = trimmedAudio.slice(samplesToTrim);

        if (quantized && (quantUnit > 0)){
            let remainder = targetLength % quantUnit;

            // threshold of over 3/10 of a measure, assume user is intentonally 
            // creating a new measure
            if ((remainder / quantUnit) > .3){ 
                let toAdd = Math.round((quantUnit - remainder) * buffer.sampleRate);
                let quantizedAudio = new Float32Array(trimmedAudio.length + toAdd);
                quantizedAudio.set(trimmedAudio);
                trimmedAudio = quantizedAudio;
            }else{
                let toTrim = Math.round(remainder * buffer.sampleRate);
                trimmedAudio = trimmedAudio.slice(0, trimmedAudio.length - toTrim);
            }           
        }

        if (trimmedAudio.length === 0){
            throw Error("No audio received")
        }

        // make final buffer, mono -> stereo
        let returnBuffer = this.getAudioContext().createBuffer(2, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);
        returnBuffer.copyToChannel(trimmedAudio, 1, 0); 
        return returnBuffer;
    }

    handleChunks = async function(audioChunks, targetLength, quantized, quantUnit){
        const blob = new Blob(audioChunks, {'type' : 'audio/ogg; codecs=opus'});
        let buffer = await this.getAudioContext().decodeAudioData(await blob.arrayBuffer());
        this.buffer = this.trimAndQuantizeAudio(buffer, targetLength, quantized, quantUnit);
    };

    recordBuffer(mediaPromise, playBunch, stopBunch, handleChunk, clickTrack, quantized, onFailure, onSuccess){
        let playTime = null; // audiocontext time when playing starts
        let audioChunks = [];
        let onStop = async () => {
            try{
                // console.log("stop called...");
                // console.log("stream active after stop: %s", stream.active);
                // console.log("media recorder state: %s", this.mediaRecorder.state);
                let stopTime = this.getAudioContext().currentTime;
                await this.handleChunks(audioChunks, 
                    // toDo: examine assumptions about outputLatency
                    stopTime - playTime - (2 * this.getAudioContext().outputLatency),
                    quantized,
                    clickTrack.oneMeasureInSeconds);
                stopBunch();
                this.redraw({'hasBuffer': true});                
                //stream.getTracks().forEach((track) => track.stop());
            }catch(e){
                console.log(e);
                onFailure();
                return;
            }
            onSuccess();
        };
        let dataAvailable = (event) => {
            audioChunks.push(event.data);
            handleChunk(event.data);
            console.log(audioChunks);
        }

        if (this.recording) 
            throw Error("already recording"); 
        else {
            this.recording = true;
            this.redraw({'recording': true});
        }

        mediaPromise.then((stream) => {
            stream.addEventListener('inactive', (e) => alert("lost audio stream"));
            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.addEventListener("dataavailable", dataAvailable);

            this.mediaRecorder.addEventListener("stop", onStop);

            this.mediaRecorder.addEventListener("start", () => {
                playTime = playBunch();
            });
            this.mediaRecorder.start(this.chunkSize);
        })
        .catch((error) => {
            console.log(error);
            alert("Error connecting to input audio: " + error.toString());
        });;
    }
}


class ClickTrack{ // metronome inspired by https://blog.paul.cx/post/metronome/
    constructor(getAudioContext){
        this.getAudioContext = getAudioContext;
        this.tempo = 60;
        this.bpm = 4;
        this.countIn = true;
        this.clicking = true;

        this.initBuff();
    }

    initBuff(){ //toDo: make a higher pitched click for the count-in
        this.buffer = this.getAudioContext().createBuffer(1, this.getAudioContext().sampleRate * 2, this.getAudioContext().sampleRate);
        let channel = this.buffer.getChannelData(0);

        //make a boop
        let phase = 0;
        let amp = 1;
        let duration_frames = this.getAudioContext().sampleRate / 50;        
        const f = 330;
        for (var i = 0; i < duration_frames; i++) {
            channel[i] = Math.sin(phase) * amp;
            phase += 2 * Math.PI * f / this.getAudioContext().sampleRate;
            if (phase > 2 * Math.PI) {
                phase -= 2 * Math.PI;
            }
            amp -= 1 / duration_frames;
        }   
    }    

    setTempo(tempo){ // set in bpm
        this.tempo = tempo;
        if (this.clicking && this.source)
            this.source.loopEnd = this.secondsPerBeat;
    }

    get secondsPerBeat(){
        return 60 / this.tempo;
    }

    get oneMeasureInSeconds(){
        return this.bpm * this.secondsPerBeat;
    }

    start(time){
        if (!this.clicking)
            return;

        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.loopEnd = this.secondsPerBeat;
        this.source.connect(this.getAudioContext().destination);
        this.source.start(time); 
    }           

    stop(){
        if (!this.clicking || !this.source)
            return;
        this.source.stop();
        this.source.disconnect();
    }
}


// Convert a audio-buffer segment to a Blob using WAVE representation
// https://stackoverflow.com/questions/29584420/how-to-manipulate-the-contents-of-an-audio-tag-and-create-derivative-audio-tags/30045041#30045041
function bufferToWav(buff) {

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    };

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    };    

    let numOfChan = buff.numberOfChannels,
      length = buff.length * 2 + 44,
      newBuff = new ArrayBuffer(length),
      view = new DataView(newBuff),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buff.sampleRate);
    setUint32(buff.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this demo)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < buff.numberOfChannels; i++)
        channels.push(buff.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {             // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);          // update data chunk
            pos += 2;
        }
        offset++                                     // next source sample
    }

    // create Blob
    return new Blob([newBuff], {type: "audio/wav"});
}

function download(filename, blob){
    let tmp = document.createElement('a');
    tmp.style = "display: none";
    document.body.appendChild(tmp);
    let url = window.URL.createObjectURL(blob);
    tmp.href = url;
    tmp.download = filename;
    tmp.click();
    document.removeChild(tmp);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}


export default AudioLoopBunch;




