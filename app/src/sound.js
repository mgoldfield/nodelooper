
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

        // set by looper 
        this.updateProgressBar = null;
    }

    // toDo: figure out when to suspend and resume audioContext
    getAudioContext = () => {
        if (!this._audioContext){
            this._audioContext = new AudioContext({
                latencyHint: 'interactive', 
                sampleRate: 44100,
            });
        }
        return this._audioContext;
    };

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

        // playBunch, stopBunch, handleChunk, clickTrack, quantized, onEarlyStop
        this.recordingLoop.recordBuffer(
            (() => this.playLoops()),
            (() => this.stop()),
            this.handleChunk,
            this.clickTrack,
            this.quantized,
            () => {
                onEarlyStop();
                this.unprepareToRecord();
            }
        );
    }

    handleChunk = (chunk) => {
        return;
    };

    stop(){
        if (this.recording){
            this.recordingLoop.stop();
            this.audioLoops.push(this.recordingLoop);
            this.recording = false;
            this.mergeOutOfDate = true;
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

            this.mergeNode = this.getAudioContext().createChannelMerger(this.audioLoops.length + 1);
            for (let i = 0; i < this.audioLoops.length; i++){
                this.audioLoops[i].disconnect();
                this.audioLoops[i].connect(this.mergeNode, i);
            }
            this.mergeNode.connect(this.gainNode);
            this.mergeOutOfDate = false;
        }
    }


    playLoops(){
        // toDo: only count in when recording
        this.refreshMergeNode();
        this.playing = true;

        // toDo: determine what waitTime should actually be
        let waitTime = 0.0001;
        let clickStartTime = this.getAudioContext().currentTime + waitTime;
        let playTime = clickStartTime;
        if (this.clickTrack.countIn)
            playTime += this.clickTrack.oneMeasureInSeconds;

        this.clickTrack.start(clickStartTime);
        for (const l of this.audioLoops)
            l.play(playTime);

        // toDo: delete this or make it a log before you're done
        if (this.getAudioContext().currentTime > clickStartTime)
            throw Error("Yikes - wait time is too short");
        else
            console.log('had %s leftover from waitTime', clickStartTime - this.getAudioContext().currentTime);

        let me = this; // boo to this hack
        function pbUpdate() {
            if (me.playing){
                let totalTime = me.getAudioContext().currentTime - playTime;
                me.updateProgressBar(totalTime);                
                setTimeout(pbUpdate, 1000);
            }
        }
        setTimeout(pbUpdate, (playTime - me.getAudioContext().currentTime + 1) * 1000);

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
        this.looping = false;

        this.gainNode = this.getAudioContext().createGain();
    }

    get length(){
        return this.buffer.length / this.buffer.sampleRate;
    }

    play(contextTime){
        if (this.playing) return;

        this.playing = true;
        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode, 0);
        this.source.loop = this.looping;
        //toDo: is this the right thing to do with outputLatency?
        this.source.start(contextTime - this.getAudioContext().outputLatency);
    }

    stop(){
        if (this.recording) {
            this.mediaRecorder.stop();
            this.recording = false;
        }

        if (this.playing){
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.playing = false;
    }

    toggleMute(){
        if (this.muted){
            this.setGain(this.formerGain);
        }else{
            this.formerGain = this.gainNode.gain;
            this.setGain(0);
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

            // toDo: maybe move quantize into record? probably not, but could allow for recording more sound instead of adding just silence
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

        // allow for a 0 lenghth / dead buffer
        let returnBuffer = this.getAudioContext().createBuffer(1, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);        
        return returnBuffer;
    }

    handleChunks = async function(audioChunks, targetLength, quantized, quantUnit){
        const blob = new Blob(audioChunks);
        let buffer = await this.getAudioContext().decodeAudioData(await blob.arrayBuffer());
        //toDo: determine if buffer needs baseLatency trimmed from the end
        //toDo: round buffer to multiple of initial loop
        this.buffer = this.trimAndQuantizeAudio(buffer, targetLength, quantized, quantUnit);
    };

    recordBuffer(playBunch, stopBunch, handleChunk, clickTrack, quantized, onEarlyStop){
        if (this.recording) throw Error("already recording"); else this.recording = true;

        navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false} 
        })
        .then((stream) => {
            this.mediaRecorder = new MediaRecorder(stream);
            let playTime = null; // audiocontext time when playing starts

            let audioChunks = [];
            this.mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
                handleChunk(event.data);
            });


            // toDo: examine assumptions about outputLatency
            // toDo: what's wrong with latency when no count-in click
            this.mediaRecorder.addEventListener("stop", async () => {
                try{
                    let stopTime = this.getAudioContext().currentTime;
                    await this.handleChunks(audioChunks, 
                        stopTime - playTime - (2 * this.getAudioContext().outputLatency),
                        quantized,
                        clickTrack.oneMeasureInSeconds);
                    stopBunch();
                }catch(e){
                    onEarlyStop();
                }
                 
            });

            this.mediaRecorder.addEventListener("start", () => {
                playTime = playBunch();
            });
            this.mediaRecorder.start(this.chunkSize);
        });
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

        // toDo: is this right - ?
        //this.source.start(time - this.getAudioContext().outputLatency);
        this.source.start(time); 
    }           

    stop(){
        if (!this.clicking || !this.source)
            return;
        this.source.stop();
        this.source.disconnect();
    }
}

export default AudioLoopBunch;




