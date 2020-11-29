import { Communication } from './communicate.js';
import { bufferToWav, wavToBuffer, downloadBlob } from './format_tools.js';
import config from './config-app.js'

// toDo: break up sound.js into more files
// toDo: make a parent class for loop and loop bunch which 

class AudioLoopBunch{
    constructor(){
        this.audioLoops=[];
        this.recordingLoop = null;

        this.clickTrack = new ClickTrack(this.getAudioContext);

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

        // toDo: is this working? 
        navigator.mediaDevices.ondevicechange = this.refreshAvailableDevices;

        this.recorder = new Recorder(this);

        // set by looper 
        this.updateProgressBar = null;
        this.getOffset = null;
    }

    initComms(project_id, looper) {
        return new Promise( (resolve, reject) => {
            this.comms = new Communication(project_id, looper);
            this.comms.initProject().then(d => resolve(d)).catch(e => reject(e));
        });
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
                autoGainControl: false,
            },
        };
        let to_return = navigator.mediaDevices.getUserMedia(options);
        this.refreshAvailableDevices();
        return to_return;
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
                this.inputMontiorSource.mediaStream.getTracks().forEach((track) => track.stop());
                this.inputMontiorSource.disconnect();
                this.inputMontiorSource = null;
            }
        }
    }


    prepareToRecord(){
        this.recordingLoop = new AudioLoop(this.getAudioContext, this.comms);
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
        this.recordingLoop.record(this.getOffset());

        // mediaPromise, quantUnit, onFailure, onSuccess
        this.recorder.recordBuffer(
            this.getUserAudio(),
            this.clickTrack.oneMeasureInSeconds,
            () => {
                onEarlyStop();
                this.unprepareToRecord();
            },
            (newBuff) => {
                this.recordingLoop.setBuffer(newBuff);
                this.addLoop(this.recordingLoop);
                //console.log(newBuff);
            }
        );
    }

    handleChunk = (chunk) => {
        return;
    };

    stop(){
        if (this.recording){
            this.recorder.stop();
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


    startUpdatingProgressBar(playTime, offset){
        if (this.playing){
            let totalTime = (this.getAudioContext().currentTime + offset);
            totalTime -= playTime;
            if (totalTime > 0)
                this.updateProgressBar(totalTime);                
            setTimeout(()=>{this.startUpdatingProgressBar(playTime, offset)}, 500);
        }        
    }

    playLoops(offset=0){
        this.refreshMergeNode();
        this.playing = true;

        let waitTime = 0.0001 + this.getAudioContext().baseLatency;
        let clickStartTime = this.getAudioContext().currentTime + waitTime;
        let playTime = clickStartTime;
        if (this.clickTrack.clicking && this.clickTrack.countIn && this.recording)
            playTime += this.clickTrack.oneMeasureInSeconds;

        this.clickTrack.start(clickStartTime);
        for (const l of this.audioLoops)
            l.play(playTime, offset);

        this.startUpdatingProgressBar(playTime, offset);
        return playTime;
    }

    stopLoops(){
        this.clickTrack.stop();

        for (const l of this.audioLoops)
            l.stop();
    }

    setGain(g){
        this.gainNode.setValueAtTime(g, this.getAudioContext().currentTime);
    }

    download = () => {
        // mix down all loops
        let maxLength = 0;
        for (const l of this.audioLoops){
            if (l.buffer.length > maxLength){
                maxLength = l.buffer.length;
            }
        }
        //assumes everything is stereo
        let mix = this.getAudioContext().createBuffer(2, maxLength, this.audioLoops[0].buffer.sampleRate);
        for (const channel of [0, 1]){
            let outputChannel = mix.getChannelData(channel);
            let channelData = []
            for (const loop of this.audioLoops){
                channelData.push(loop.buffer.getChannelData(channel));
            }
            for (let sample = 0; sample < maxLength; sample++){
                for (let l=0; l < this.audioLoops.length; l++){
                    if (!this.audioLoops[l].muted){
                        outputChannel[sample] += this.audioLoops[l].gain * channelData[l][sample % this.audioLoops[l].buffer.length];
                    }
                }
            }
        }
        downloadBlob('loop_mix.wav', bufferToWav(mix));
    }

    addBuff(buff, cb){
        let loop = new AudioLoop(this.getAudioContext, this.comms);
        loop.setBuffer(buff);
        this.addLoop(loop);
        cb(loop);
    }

    addLoop(loop, sendLoop=true){
        this.audioLoops.push(loop);
        this.mergeOutOfDate = true;
        if (sendLoop) this.comms.sendLoop(loop);
    }

    loadLoopFromDisk = (f, audioloop_cb) => {
        let reader = new FileReader();
        reader.onload = (event) => {
            let buff;
            try {
                buff = wavToBuffer(event.target.result, this.getAudioContext());
                this.addBuff(buff, audioloop_cb);
            }catch (e){
                alert(e.toString());
                return;
            }            
        }
        reader.readAsArrayBuffer(f);
    }

    loadLoopFromDynamoData = async (l, onLoad) => { 
        function b64toFloatArr(to_encode){
            let buf = Buffer.from(to_encode, 'base64');
            let f32a = new Float32Array(buf.buffer); 
            return f32a;
        }
        let audio = JSON.parse(l.audio),
            newloop = new AudioLoop(this.getAudioContext, this.comms),
            newbuff = this.getAudioContext().createBuffer(
                parseInt(l.metadata.M.numChannels.N),
                parseInt(l.metadata.M.length.N),
                parseInt(l.metadata.M.sampleRate.N));

        if (audio.format === 'raw'){
            newbuff.copyToChannel(b64toFloatArr(audio.L), 0);
            newbuff.copyToChannel(b64toFloatArr(audio.R), 1);          
        }else if (audio.format === 'mp3'){
            let tmpbuf = Buffer.from(audio.data, 'base64'),
                tmpAudioBuf = await this.getAudioContext().decodeAudioData(tmpbuf.buffer),
                len_diff = tmpAudioBuf.length - newbuff.length;
            newbuff.copyToChannel(tmpAudioBuf.getChannelData(0).slice(len_diff / 2), 0); // trims to correct length
            newbuff.copyToChannel(tmpAudioBuf.getChannelData(1).slice(len_diff / 2), 1);
        }else{
            throw Error('unknown audio type: ' + audio.format);
        }
        newloop.setBuffer(newbuff);
        newloop.updateMetadata(l.metadata.M);

        this.addLoop(newloop, false);
        onLoad(newloop);                  
    }

    deleteLoop(id, broadcast){
        this.audioLoops = this.audioLoops.filter(l => l.id !== id)
        if (broadcast) this.comms.deleteLoop(id);
    }

    updateMetadata(data){
        for (const l of this.audioLoops){
            if (l.id === data.LoopID){
                l.updateMetadata(data.metadata);
                break;
            }
        }
    }
}


class Recorder {
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
            let playTime = null; // audiocontext time when playing starts
            let audioChunks = [];
            let dataAvailable = (event) => {
                audioChunks.push(event.data);
            }            
            let onStop = async () => {
                try{
                    let stopTime = this.bunch.getAudioContext().currentTime;
                    this.bunch.stop();
                    stream.getTracks().forEach((track) => track.stop());
                    //console.log("stopTime: %s, playTime: %s, ol: %s, total: %s", stopTime, playTime, (this.bunch.getAudioContext().outputLatency), stopTime - playTime - (2 * this.bunch.getAudioContext().outputLatency))
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
                playTime = this.bunch.playLoops(this.bunch.getOffset());                
            });
            this.mediaRecorder.start();
        })
        .catch((error) => {
            console.log(error);
            alert("Error connecting to input audio: " + error.toString());
        });;
    }

    handleChunks = async function(audioChunks, targetLength, latency, quantUnit){
        const blob = new Blob(audioChunks, {'type' : 'audio/ogg; codecs=opus'});
        let buffer = await this.bunch.getAudioContext().decodeAudioData(await blob.arrayBuffer());
        if ((buffer.length / buffer.sampleRate) > config.limits.length){
            alert("You have exceeded the maximum length of " + config.limits.length + " seconds per buffer :(");
            throw Error("buffer too long");
        }
        return this.trimAndQuantizeAudio(buffer, targetLength, latency, quantUnit);
    };       

    trimAndQuantizeAudio(buffer, targetLength, latency, quantUnit){
        // first we trim to target length from the beginning
        // then we add or trim from the end to quantize if qantized is set to true

        targetLength = targetLength - (2 * latency);
        let samplesToTrim = buffer.length - Math.round(targetLength * buffer.sampleRate);
        let trimmedAudio = new Float32Array(buffer.length);
        let trimFromFront = 0;
        trimFromFront = 2 * latency * buffer.sampleRate;
        buffer.copyFromChannel(trimmedAudio, 0, trimFromFront);
        trimmedAudio = trimmedAudio.slice(samplesToTrim); // trim from back

        // linear fade in over .025 seconds
        let fade_len = .025 * buffer.sampleRate;
        for (let i = 0; i < fade_len; i ++){
            trimmedAudio[i] = trimmedAudio[i] * i * (1 / fade_len);
        }

        if (this.quantize && (quantUnit > 0)){
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
        let returnBuffer = this.bunch.getAudioContext().createBuffer(2, trimmedAudio.length, buffer.sampleRate);
        returnBuffer.copyToChannel(trimmedAudio, 0, 0);
        returnBuffer.copyToChannel(trimmedAudio, 1, 0); 
        return returnBuffer;
    }     
}



class AudioLoop {
    constructor(getAudioContext, comms){
        this.getAudioContext = getAudioContext;
        this.comms = comms;
        this.buffer = null;
        this.source = null;
        this.mediaRecorder = null;
        this.maxRepeats = 0;
        // may get set during record
        this.delayedStart = 0; 

        this.recording = false;
        this.playing = false;
        this.muted = false;
        this.looping = true;

        this.name = null;
        this.id = null;

        this.gainNode = this.getAudioContext().createGain();

        this.onProgress = null;     // set by LoopProgress component
        this.onNewBuffer = null;    // ditto
        this.redraw = null;
        this.updateGain = null;     // set by React Loop

    }

    get length(){
        if (this.buffer)
            return this.buffer.length / this.buffer.sampleRate;
        return 0;
    }

    getMetadata() {
        return {
            maxRepeats: {N:this.maxRepeats.toString()},
            delayedStart: {N: this.delayedStart.toString()},
            muted: {BOOL:this.muted},
            looping: {BOOL: this.looping},
            name: {S: this.name},
            gain: {N: (this.muted ? this.formerGain : this.gainNode.gain.value).toString()},
            length: {N: this.buffer.length.toString()},
            sampleRate: {N: this.buffer.sampleRate.toString()},
            numChannels: {N: this.buffer.numberOfChannels.toString()},            
        };
    }

    broadcastMetadata = () => {
        if (this.buffer)
            this.comms.broadcastMetadata(this.id, this.getMetadata());
    }

    updateMetadata(metadata){
        this.maxRepeats = parseInt(metadata.maxRepeats.N);
        this.delayedStart = parseFloat(metadata.delayedStart.N);
        this.muted = metadata.muted.BOOL;
        this.looping = metadata.looping.BOOL;
        this.name = metadata.name.S;
        let gainval = Math.round(parseFloat(metadata.gain.N) * 100) / 100; 

        if (this.muted){
            this.formerGain = gainval;
            this.setGain(0.0);
        }else{
            this.setGain(gainval)
        }

        if (this.redraw) {
            this.redraw({
                'maxRepeats': this.maxRepeats,
                'muted': this.muted,
                'looping': this.looping,
                'name': this.name,
                'gain': gainval,
            });

            this.updateGain(gainval);
        }
    }

    setName(name){
        this.name = name;
        //toDo: transmit this to other users
    }

    setRedraw(f){
        this.redraw = f;
    }

    setBuffer(buff){
        this.buffer = buff;
        if (this.onNewBuffer) this.onNewBuffer(buff);
        if (this.redraw) this.redraw({'hasBuffer': true});                
    }

    play(contextTime, offset=0){
        if (this.playing) return;

        this.playing = true;
        this.redraw({'playing':true});

        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode, 0);
        this.source.loop = this.looping;

        if (this.looping && this.maxRepeats > 0){
            this.source.loopEnd = this.maxRepeats * this.length;
            setTimeout(() => this.stop(), (this.maxRepeats * this.length + this.delayedStart) * 1000);
        }

        //toDo: is this the right thing to do with outputLatency?
        let startTime = contextTime; // - this.getAudioContext().outputLatency;
        if (offset - this.delayedStart > 0){
            offset = offset - this.delayedStart;
        }else if (offset !== this.delayedStart){
            startTime += this.delayedStart - offset;
        }
        this.source.start(startTime, offset);
        this.startLoopProgressBar(startTime, offset);
    }

    record(delay){
        this.delayedStart = delay;
        this.recording = true;
        this.redraw({'recording': true});
    }

    startLoopProgressBar(startTime, offset){
        if (!this.playing){
            this.onProgress(0);
            return;
        }

        let currPlayTime = this.getAudioContext().currentTime - startTime + offset + 0.25;
        if (currPlayTime > 0){
            if (this.looping)
                this.onProgress(currPlayTime % this.length / this.length);
            else
                this.onProgress(Math.min(currPlayTime / this.length, 1));
        }
        
        setTimeout(() => {this.startLoopProgressBar(startTime, offset)}, 250);
    }

    stop(){
        if (this.playing){
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.playing = false;
        this.recording = false;
        this.redraw({'playing':false, 'recording': false});
    }

    get gain(){
        return this.gainNode.gain.value;
    }

    toggleMute(){
        if (this.muted){
            this.setGain(this.formerGain);
        }else{
            this.formerGain = this.gain;
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

    download(){
        downloadBlob(this.name + '.wav', bufferToWav(this.buffer));
    }
}


class ClickTrack{ // metronome inspired by https://blog.paul.cx/post/metronome/
    constructor(getAudioContext){
        this.getAudioContext = getAudioContext;
        this.tempo = 60;
        this.bpm = 4;
        this.countIn = false;
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


export default AudioLoopBunch;




