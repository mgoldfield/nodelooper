import { AudioLoopBunch } from '.';
import config from '../config-app.js';

export class Recorder {
    private bunch: AudioLoopBunch;
    quantize: boolean;
    mediaRecorder?: MediaRecorder;
    
    private recordTime = 0;
    private playTime = 0;
    private stopTime = 0;
    private _extraLatencyMS = 20;
    
    constructor(bunch: AudioLoopBunch){
        this.bunch = bunch;
        this.quantize = true;
        this.mediaRecorder = null;
        const extraLatencyMS = localStorage.getItem('extraLatencyMS');
        if (extraLatencyMS) {
            this._extraLatencyMS = parseInt(extraLatencyMS);
        }
    }
    
    get outputLatency (): number {
        return this.bunch.getAudioContext().outputLatency || this.bunch.getAudioContext().baseLatency;
    }
    get extraLatency (): number {
        return this._extraLatencyMS / 1000;
    }
    set extraLatency (sec: number) {
        this._extraLatencyMS = Math.round(sec * 1000);
        localStorage.setItem('extraLatencyMS', this._extraLatencyMS.toFixed());
    }

    stop(){
        this.mediaRecorder.stop();
    }

    async recordBuffer(mediaPromise, quantUnit): Promise<AudioBuffer> {
        const stream = await mediaPromise;
        console.log(
            'outputLatency:', this.bunch.getAudioContext().outputLatency,
            'baseLatency:', this.bunch.getAudioContext().baseLatency);
        return new Promise((resolve, reject) => {            
            const audioChunks: Blob[] = [];
            const dataAvailable = (event: BlobEvent) => {
                if (event.data.size === 0) return;
                console.log("pushing %d recorded bytes...", event.data.size)
                audioChunks.push(event.data);
            };           
            const onStop = async () => {
                console.log("stopping...")
                this.stopTime = this.bunch.getAudioContext().currentTime;
                this.bunch.stop();
                stream.getTracks().forEach((track) => track.stop());
                console.log("record start: %0.3f; play start: %0.3f; stop: %0.3f; start offset: %0.3f; target length: %0.3f", this.recordTime, this.playTime, this.stopTime, this.playTime - this.recordTime, this.stopTime - this.playTime);
                try {
                    const newBuff = await this.handleChunks(
                            audioChunks, 
                            quantUnit);
                    resolve(newBuff);
                } catch (e) {
                    reject(e);
                }
            };
    
            stream.addEventListener('inactive', (e) => alert("lost audio stream"));
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.addEventListener("dataavailable", dataAvailable);
            this.mediaRecorder.addEventListener("stop", onStop);
            this.mediaRecorder.addEventListener("start", () => {
                this.recordTime = this.bunch.getAudioContext().currentTime;
                this.playTime = this.bunch.playLoops();                
            });
            this.mediaRecorder.addEventListener("error", (e: MediaRecorderErrorEvent) => {
                alert("incompatible device, check f.a.q. for support: " + e.error);
                console.log(e);
                reject(e.error);
            });
    
            console.log("recording...")
            this.mediaRecorder.start(50);
        });
    }

    async handleChunks(audioChunks: Blob[], quantUnit: number){
        const blob = new Blob(audioChunks);
        const blobbuff = await blob.arrayBuffer();
        console.log(blobbuff);
        let buffer = await this.bunch.getAudioContext().decodeAudioData(blobbuff);
        if ((buffer.length / buffer.sampleRate) > config.limits.length){
            alert("You have exceeded the maximum length of " + config.limits.length + " seconds per buffer :(");
            throw Error("buffer too long");
        }
        return this.trimAndQuantizeAudio(buffer, quantUnit);
    };       

    trimAndQuantizeAudio(buffer: AudioBuffer, quantUnit: number): AudioBuffer {
        // first we trim to target length from the beginning
        // then we add or trim from the end to quantize if qantized is set to true
        
        /*
           |       |   startOffset  |    quantized length   | trimFromEnd |
           |-------|-------------- -|-----------------------|-------------|        
        record recordTime        playTime               quantEnd      stopTime
        */

        // 
        const startOffset = this.playTime - this.recordTime + 2 * this.outputLatency + this.extraLatency;
        const trimFromFront = Math.round(buffer.sampleRate * startOffset);
        
        let trimFromEnd = 0;
        if (this.quantize && (quantUnit > 0)) {
            const remainder = (buffer.duration - startOffset) % quantUnit;
        
            // threshold of over 1/2ish of a measure, assume user is intentonally 
            // creating a new measure
            if ((remainder / quantUnit) > 0.45){ 
                trimFromEnd = -Math.round((quantUnit - remainder) * buffer.sampleRate);
            } else {
                trimFromEnd = Math.round(remainder * buffer.sampleRate);
            }
        }
        
        const trimmedAudio = new Float32Array(buffer.length - trimFromFront - trimFromEnd);
        buffer.copyFromChannel(trimmedAudio, 0, trimFromFront);
        
        console.log("sampleRate %d; initial buffer length %0.3fs; startOffset %0.3fs; trimFromFront %d, trimFromEnd %d", buffer.sampleRate, buffer.length / buffer.sampleRate, startOffset, trimFromFront, trimFromEnd);

        // linear fade in over .025 seconds
        const fade_len = .025 * buffer.sampleRate;
        for (let i = 0; i < fade_len; i ++){
            trimmedAudio[i] = trimmedAudio[i] * i * (1 / fade_len);
        }

        if (trimmedAudio.length === 0){
            throw Error("No audio received")
        }

        // make final buffer, mono -> stereo
        let returnBuffer = this.bunch.getAudioContext().createBuffer(2, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);
        returnBuffer.copyToChannel(trimmedAudio, 1, 0); 
        return returnBuffer;
    }     
}
