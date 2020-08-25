
class AudioLoopBunch{
    constructor(){
        this.audioLoops=[];
        this.recordingLoop = null;
        this.loopTimeUnit = null;

        this.playing = false;
        this.clickTrack = new ClickTrack(this.getAudioContext);
        this.quantized = false;

        this.mergeOutOfDate = true;
        this.mergeNode = null;
        this.gainNode = null;
    }

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
    }

    record(){
        if (!this.recordingLoop) 
            throw Error("Record has not been prepped...something is wrong");

        this.recording = true;

        //(playBunch, stopBunch, handleChunk, clickTrack)
        this.recordingLoop.recordBuffer(
            (() => this.playLoops()),
            (() => {
                this.stop()
                if (!this.loopTimeUnit) 
                    this.loopTimeUnit = this.recordingLoop.length;
            }),
            this.handleChunk,
            this.clickTrack,
            this.quantized,
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
    }

    refreshMergeNode(){
        if (this.mergeOutOfDate){
            // number of loops + click track 
            this.mergeNode = this.getAudioContext().createChannelMerger(this.audioLoops.length + 1);
            for (let i = 0; i < this.audioLoops.length; i++){
                this.audioLoops[i].disconnect();
                this.audioLoops[i].connect(this.mergeNode, i);
            }
            this.gainNode = this.getAudioContext().createGain();
            this.mergeNode.connect(this.gainNode);
            this.gainNode.connect(this.getAudioContext().destination)
            this.mergeOutOfDate = false;
        }
    }

    playLoops(){
        // assumes 500 ms is an acceptable and adaquate wait time
        // toDo: only count in when recording
        let waitTime = 0.5;
        let clickStartTime = this.getAudioContext().currentTime + waitTime;
        let playTime = clickStartTime + this.clickTrack.oneMeasureInSeconds;

        this.refreshMergeNode();
        this.clickTrack.start(clickStartTime);
        for (const l of this.audioLoops)
            l.play(playTime);

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
        return this.buffer.length;
    }

    play(contextTime){
        this.playing = true;
        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode, 0);
        this.source.loop = this.looping;
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
        let samplesToTrim = buffer.length - Math.round(targetLength * buffer.sampleRate);
        let trimmedAudio = new Float32Array(buffer.length);
        buffer.copyFromChannel(trimmedAudio, 0, 0);
        trimmedAudio = trimmedAudio.slice(samplesToTrim);

        if (quantized){
            // toDo: instead of adding, delete samples if it is a small enough amount
            let remainder = targetLength % quantUnit;

            // threshold of 3/10 of a measure to be intentonally creating a new measure
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

    recordBuffer(playBunch, stopBunch, handleChunk, clickTrack, quantized){
        if (this.recording) throw Error("already recording"); else this.recording = true;

        navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false} 
        })
        .then((stream) => {
            this.mediaRecorder = new MediaRecorder(stream);
            let startTime = null; // audiocontext time at recording start
            let playTime = null; // audiocontext time when playing starts

            let audioChunks = [];
            this.mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
                handleChunk(event.data);
            });

            this.mediaRecorder.addEventListener("stop", async () => {
                let stopTime = this.getAudioContext().currentTime;
                await this.handleChunks(audioChunks, 
                    stopTime - playTime - this.getAudioContext().outputLatency,
                    quantized,
                    clickTrack.oneMeasureInSeconds);
                stopBunch();
                 
            });

            this.mediaRecorder.addEventListener("start", () => {
                startTime = this.getAudioContext().currentTime;
                playTime = playBunch();
            });
            this.mediaRecorder.start(this.chunkSize);
        });
    }
}

class ClickTrack{
    // metronome inspired by https://blog.paul.cx/post/metronome/

    constructor(getAudioContext){
        this.getAudioContext = getAudioContext;
        this.tempo = 60;
        this.bpm = 4;
        this.countIn = false;
        this.clicking = false;

        this.initBuff();
    }

    initBuff(){
        this.buffer = this.getAudioContext().createBuffer(1, this.getAudioContext().sampleRate * 2, this.getAudioContext().sampleRate);

        let channel = this.buffer.getChannelData(0);
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

    setTempo(tempo){
        this.tempo = tempo;
        if (this.clicking)
            this.source.loopEnd = this.secondsPerBeat;
    }

    get secondsPerBeat(){
        return 1 / (this.tempo / 60);
    }

    get oneMeasureInSeconds(){
        if (this.countIn)
            return this.bpm * this.secondsPerBeat;
        else 
            return 0;
    }

    start(time){
        if (!this.clicking)
            return;

        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.loopEnd = this.secondsPerBeat;
        this.source.connect(this.getAudioContext().destination);
        this.source.start(time - this.getAudioContext().outputLatency); 
    }           

    stop(){
        if (!this.clicking)
            return;
        this.source.stop();
        this.source.disconnect();
    }
}

export default AudioLoopBunch;




