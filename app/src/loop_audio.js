

class LoopBunch{

    constructor(chunkSize=5000){
        this.chunkSize = chunkSize; // milliseconds
    }

    get audioContext(){
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

    record(playLoops, handleChunk, onComplete){
        let stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });
        
        this.media_recorder = new MediaRecorder(stream);

        let startTime = null; // audiocontext time at recording start
        let playTime = null; // audiocontext time when playing starts

        let audioChunks = [];
        this.media_recorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
            handleChunk(event.data);
        });

        this.media_recorder.addEventListener("stop", async () => {
            const blob = new Blob(audioChunks);
            let buffer = await this.audioContext.decodeAudioData(await blob.arrayBuffer());

            //toDo: determine if buffer needs baseLatency trimmed from the end
            onComplete(this.trimAudio(buffer, playTime - startTime, 'begin'));
        });

        this.media_recorder.addEventListener("start", () = {
            startTime = this.audioContext.currentTime;
            //toDo: playLoops returns playTime.
            playTime = playLoops;  
        });
        this.media_recorder.start(this.audioContext.currentTime, length)                 
    }
}

class AudioLoop {

}


export {AudioLoopBunch, AudioLoop};




