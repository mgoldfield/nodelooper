

class LoopBunch{

    constructor(chunkSize=5000){
        this.chunkSize = chunkSize; // milliseconds
        this.audioLoops=[];
        this.recordingLoop = null;
        this.loopTimeUnit = null;
    }

    audioContext = () => {
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

    record(){
        this.recordingLoop = new AudioLoop(this.audioContext);
        this.recordingLoop.recordBuffer(
            () => this.playLoops();,
            () => this.stop();,
            this.loopTimeUnit
        );
    }

    stop(){
        if (this.recording){
            if (!this.audioLoops.length) 
                this.loopTimeUnit = this.recordingLoop.length;
            this.audioLoops.push(this.recordingLoop);
            this.recordingLoop = null;
            this.recording = false;
        }
        stopLoops();
    }

    playLoops(){
        // should return context time when loops start
    }

    stopLoops(){

    }
}


class AudioLoop {
    constructor(getAudioContext){
        this.buffer = null;
        this.getAudioContext = getAudioContext;
        this.recording = false;
        this.playing = false;
        this.mediaRecorder = null;
    }

    get length(){
        return this.buffer.length;
    }

    trimAudio(buffer, lengthToTrim, side){
        let samplesToTrim = lengthToTrim * buffer.sampleRate;
        let trimmedAudio = new Float32Array(buffer.length);
        buffer.copyFromChannel(trimmedAudio, 0, 0);

        if (side == "begin"){
            trimmedAudio = trimmedAudio.slice(samplesToTrim);
        }else if (side == "end"){
           trimmedAudio = trimmedAudio.slice(0, buffer.length - samplesToTrim); 
        }

        returnBuffer = this.audioContext.createBuffer(1, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);        
        return returnBuffer;
    }    

    recordBuffer(playBunch, stopBunch, loopTimeUnit){
        if (this.recording){
            throw "already recording";
        }else{
            this.recording = true;
        }

        let stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false} 
        });
        
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
            let buffer = await this.audioContext.decodeAudioData(await blob.arrayBuffer());
            //toDo: determine if buffer needs baseLatency trimmed from the end
            //toDo: round buffer to multiple of initial loop
            this.buffer = this.trimAudio(buffer, playTime - startTime, 'begin');
        });

        this.mediaRecorder.addEventListener("start", () = {
            startTime = this.audioContext.currentTime;
            playTime = playBunch();  
        });
        this.mediaRecorder.start(this.audioContext.currentTime, length)                 
    }
}

class clickTrack(){
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




