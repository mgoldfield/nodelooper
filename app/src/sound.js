
class AudioLoopBunch{
    constructor(){
        this.audioLoops=[];
        this.recordingLoop = null;
        this.loopTimeUnit = null;

        this.playing = false;
        this.clicking = false;

        this.mergeOutOfDate = false;
        this.mergeNode = null;
    }

    getAudioContext = () => {
        if (!this._audioContext){
            this._audioContext = new AudioContext({
                latencyHint: 'interactive', 
                sampleRate: 44100,
            });
        }else{
            this._audioContext.resume();
        }
        return this._audioContext;
    }

    prepareToRecord(){
        this.recordingLoop = new AudioLoop(this.getAudioContext;
        return this.recordingLoop;
    }

    unprepareToRecord(){
        this.recordingLoop = null;
    }

    record(){
        if (!this.recordingLoop) 
            throw Error("Record has not been prepped...something is wrong");

        this.recordingLoop.recordBuffer(
            (() => this.playLoops()),
            (() => this.stop()),
            this.loopTimeUnit
        );
    }

    stop(){
        if (this.recording){
            this.recordingLoop.stop();
            if (!this.audioLoops.length) 
                this.loopTimeUnit = this.recordingLoop.length;
            this.audioLoops.push(this.recordingLoop);
            this.recordingLoop = null;
            this.recording = false;
            this.mergeOutOfDate = true;
        }
        this.stopLoops();
        this.playing = false;
    }

    playLoops(){
        // assumes 500 ms is an acceptable and adaquate wait time
        let waitTime = .5;

        if (this.mergeNode && !this.mergeOutOfDate){
            // build new merge node
        }

        let playTime = this.getAudioContext.currentTime + waitTime;

        for (const l of this.audioLoops)
            l.play(playTime);

        return playTime;
    }

    stopLoops(){

    }
}


class AudioLoop {
    constructor(getAudioContext, chunkSize=5000){
        this.buffer = null;
        this.mediaRecorder = null;
        this.getAudioContext = getAudioContext;
        this.chunkSize = chunkSize;        

        this.recording = false;
        this.playing = false;
        this.muted = false;

        this.gainNode = null
    }

    get length(){
        return this.buffer.length;
    }

    play(contextTime){
        this.buffer.start(contextTime);
    }

    stop(){
        if (this.recording) this.mediaRecorder.stop();
        if (this.playing) this.buffer.stop();
    }

    mute(){
        return;
    }

    setGain(g){
        return;
    }

    initBuffer(buffer){
        this.buffer = buffer;
        this.gainNode = this.getAudioContext().createGain();
        this.buffer.connect(this.gainNode, 0);
    }

    connect(dest, index){
        this.gainNode.connect(dest, 0, index);
    }

    trimAudio(buffer, lengthToTrim, side){
        let samplesToTrim = lengthToTrim * buffer.sampleRate;
        let trimmedAudio = new Float32Array(buffer.length);
        buffer.copyFromChannel(trimmedAudio, 0, 0);

        if (side === "begin"){
            trimmedAudio = trimmedAudio.slice(samplesToTrim);
        }else if (side === "end"){
           trimmedAudio = trimmedAudio.slice(0, buffer.length - samplesToTrim); 
        }

        let returnBuffer = this.audioContext.createBuffer(1, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);        
        return returnBuffer;
    }    

    recordBuffer(playBunch, stopBunch, loopTimeUnit, handleChunk){
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
                stopBunch();
                const blob = new Blob(audioChunks);
                let buffer = await this.getAudioContext.decodeAudioData(await blob.arrayBuffer());
                //toDo: determine if buffer needs baseLatency trimmed from the end
                //toDo: round buffer to multiple of initial loop
                this.initBuffer(this.trimAudio(buffer, playTime - startTime, 'begin'));
            });

            this.mediaRecorder.addEventListener("start", () => {
                startTime = this.getAudioContext.currentTime;
                playTime = playBunch();
            });
            this.mediaRecorder.start(this.chunkSize);
        });
    }
}

class clickTrack{
    constructor(tempo){
        this.setTempo(tempo);
    }

    setTempo(tempo){
        this.tempo = tempo;
    }

    start(){
        return;
    }

    stop(){
        return;
    }
}


export {AudioLoopBunch, AudioLoop};




