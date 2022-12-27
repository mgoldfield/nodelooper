import { AudioLoopBunch } from '.';
import config from '../config-app.js';

export class Recorder {
    private bunch: AudioLoopBunch;
    quantize: boolean;
    mediaRecorder?: MediaRecorder;
    
    constructor(bunch){
        this.bunch = bunch;
        this.quantize = true;
        this.mediaRecorder = null;
    }

    stop(){
        this.mediaRecorder.stop();
    }

    recordBuffer(mediaPromise, quantUnit, onFailure, onSuccess){
        mediaPromise.then((stream) => {
            console.log(this.bunch.getAudioContext().outputLatency, 
                this.bunch.getAudioContext().baseLatency)            
            let playTime = null; // audiocontext time when playing starts
            const audioChunks = [];
            const dataAvailable = (event) => {
                console.log("pushing recorded data...")
                audioChunks.push(event.data);
            };           
            const onStop = async () => {
                try{
                    console.log("stopping...")
                    let stopTime = this.bunch.getAudioContext().currentTime;
                    this.bunch.stop();
                    stream.getTracks().forEach((track) => track.stop());
                    console.log(this.bunch.getAudioContext().outputLatency, 
                        this.bunch.getAudioContext().baseLatency)
                    let newBuff = await this.handleChunks(audioChunks, 
                        // toDo: examine assumptions about outputLatency
                        stopTime - playTime,
                        this.bunch.getAudioContext().outputLatency, // something fishy is happening - gotta record this here.
                        quantUnit);
                    onSuccess(newBuff);
                }catch(e){
                    console.log(e);
                    onFailure();
                    return;
                }
            };

            stream.addEventListener('inactive', (e) => alert("lost audio stream"));
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.addEventListener("dataavailable", dataAvailable);
            this.mediaRecorder.addEventListener("stop", onStop);
            this.mediaRecorder.addEventListener("start", () => {
                playTime = this.bunch.playLoops();                
            });
            this.mediaRecorder.addEventListener("error", (e: MediaRecorderErrorEvent) => {
                alert("incompatible device, check f.a.q. for support: " + e.error);
                console.log(e);
            });

            console.log("recording...")
            this.mediaRecorder.start(50);
        })
        .catch((error) => {
            console.log(error);
            alert("Error connecting to input audio: " + error.toString());
        });;
    }

    async handleChunks(audioChunks, targetLength, latency, quantUnit){
        const blob = new Blob(audioChunks, {'type' : 'audio/ogg; codecs=opus'});
        let blobbuff = await blob.arrayBuffer();
        console.log(blobbuff);
        let buffer = await this.bunch.getAudioContext().decodeAudioData(blobbuff);
        if ((buffer.length / buffer.sampleRate) > config.limits.length){
            alert("You have exceeded the maximum length of " + config.limits.length + " seconds per buffer :(");
            throw Error("buffer too long");
        }
        return this.trimAndQuantizeAudio(buffer, targetLength, latency, quantUnit);
    };       

    trimAndQuantizeAudio(buffer, targetLength, latency, quantUnit){
        // first we trim to target length from the beginning
        // then we add or trim from the end to quantize if qantized is set to true

        console.log("initial buffer length %s", buffer.length / buffer.sampleRate)

        targetLength = targetLength - (2 * latency);
        let samplesToTrim = buffer.length - Math.round(targetLength * buffer.sampleRate);
        let trimmedAudio = new Float32Array(buffer.length);
        let trimFromFront = 0;
        trimFromFront = 4 * latency * buffer.sampleRate;
        buffer.copyFromChannel(trimmedAudio, 0, trimFromFront);
        trimmedAudio = trimmedAudio.slice(samplesToTrim); // trim from back

        // linear fade in over .025 seconds
        let fade_len = .025 * buffer.sampleRate;
        for (let i = 0; i < fade_len; i ++){
            trimmedAudio[i] = trimmedAudio[i] * i * (1 / fade_len);
        }

        if (this.quantize && (quantUnit > 0)){
            let remainder = targetLength % quantUnit;

            // threshold of over 1/2ish of a measure, assume user is intentonally 
            // creating a new measure
            if ((remainder / quantUnit) > 0.45){ 
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
        let returnBuffer = this.bunch.getAudioContext().createBuffer(2, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);
        returnBuffer.copyToChannel(trimmedAudio, 1, 0); 
        return returnBuffer;
    }     
}
