import { Communication } from './communicate.js';

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
                this.inputMontiorSource.mediaStream.getTracks().forEach((track) => track.stop());
                this.inputMontiorSource.disconnect();
                this.inputMontiorSource = null;
            }
        }
    }


    prepareToRecord(){
        this.recordingLoop = new AudioLoop(this.getAudioContext);
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
                console.log(newBuff);
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
        let loop = new AudioLoop(this.getAudioContext);
        loop.buffer = buff;
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
                buff = wavToPCM(event.target.result, this.getAudioContext());
                this.addBuff(buff, audioloop_cb);
            }catch (e){
                alert(e.toString());
                return;
            }            
        }
        reader.readAsArrayBuffer(f);
    }

    loadLoopFromDynamoData = (l, onLoad) => {    
        function b64toFloatArr(to_encode){
            let buf = Buffer.from(to_encode, 'base64');
            let f32a = new Float32Array(buf.buffer); 
            return f32a;
        }
        let newloop = new AudioLoop(this.getAudioContext),
            newbuff = this.getAudioContext().createBuffer(
                parseInt(l.metadata.M.numChannels.N),
                parseInt(l.metadata.M.length.N),
                parseInt(l.metadata.M.sampleRate.N));

        console.log("l.audio:");
        console.log(l.audio);
        let audio = JSON.parse(l.audio)
        newbuff.copyToChannel(b64toFloatArr(audio.L), 0);
        newbuff.copyToChannel(b64toFloatArr(audio.R), 1);
        newloop.buffer = newbuff;
        newloop.name = l.LoopID.S;
        this.addLoop(newloop, false);
        onLoad(newloop);
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
                    //console.log("stopTime: %s, playTime: %s, 2xl: %s, total: %s", stopTime, playTime, (2 * this.bunch.getAudioContext().outputLatency), stopTime - playTime - (2 * this.bunch.getAudioContext().outputLatency))
                    let newBuff = await this.handleChunks(audioChunks, 
                        // toDo: examine assumptions about outputLatency
                        stopTime - playTime - (2 * this.bunch.getAudioContext().outputLatency),
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
            this.mediaRecorder.start(this.chunkSize);
        })
        .catch((error) => {
            console.log(error);
            alert("Error connecting to input audio: " + error.toString());
        });;
    }

    handleChunks = async function(audioChunks, targetLength, quantUnit){
        const blob = new Blob(audioChunks, {'type' : 'audio/ogg; codecs=opus'});
        let buffer = await this.bunch.getAudioContext().decodeAudioData(await blob.arrayBuffer());
        return this.trimAndQuantizeAudio(buffer, targetLength, quantUnit);
    };       

    trimAndQuantizeAudio(buffer, targetLength, quantUnit){
        // first we trim to target length from the beginning
        // then we add or trim from the end to quantize if qantized is set to true

        let samplesToTrim = buffer.length - Math.round(targetLength * buffer.sampleRate);
        let trimmedAudio = new Float32Array(buffer.length);
        let trimFromFront = 2 * this.bunch.getAudioContext().outputLatency * buffer.sampleRate;
        buffer.copyFromChannel(trimmedAudio, 0, trimFromFront);
        trimmedAudio = trimmedAudio.slice(samplesToTrim);

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
    constructor(getAudioContext){
        this.getAudioContext = getAudioContext;
        this.chunkSize = 5000
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

        this.gainNode = this.getAudioContext().createGain();
        this.updateProgress = null; // set in looper when creating loop progress bar

        this.redraw = () => null;
    }

    get length(){
        return this.buffer.length / this.buffer.sampleRate;
    }

    setName(name){
        // toDo: no dupe names!!
        this.name = name;
        //toDo: transmit this to other users
    }

    setRedraw(f){
        this.redraw = f;
    }

    setBuffer(buff){
        this.buffer = buff;
        this.redraw({'hasBuffer': true});                
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
            this.updateProgress(0);
            return;
        }

        let currPlayTime = this.getAudioContext().currentTime - startTime + offset;
        if (currPlayTime > 0){
            if (this.looping)
                this.updateProgress(currPlayTime % this.length / this.length);
            else
                this.updateProgress(Math.min(currPlayTime / this.length, 1));
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


//// helper methods ///// 

function debugWav(view){
    console.log("RIFF - dec:%s, hex:%s", view.getUint32(0, true).toString(), view.getUint32(0, true).toString(16));
    console.log("length - 8 - dec:%s, hex:%s", view.getUint32(4, true).toString(), view.getUint32(4, true).toString(16));
    console.log("WAVE - dec:%s, hex:%s", view.getUint32(8, true).toString(), view.getUint32(8, true).toString(16));
    console.log("fmt - dec:%s, hex:%s", view.getUint32(12, true).toString(), view.getUint32(12, true).toString(16));
    console.log("16 - dec:%s, hex:%s", view.getUint32(16, true).toString(), view.getUint32(16, true).toString(16));
    console.log("1 - dec:%s, hex:%s", view.getUint16(20, true).toString(), view.getUint16(20, true).toString(16));
    console.log("num channels - dec:%s, hex:%s", view.getUint16(22, true).toString(), view.getUint16(22, true).toString(16));
    console.log("sample rate - dec:%s, hex:%s", view.getUint32(24, true).toString(), view.getUint32(24, true).toString(16));
    console.log("bytes / sec - dec:%s, hex:%s", view.getUint32(28, true).toString(), view.getUint32(28, true).toString(16));
    console.log("block size - dec:%s, hex:%s", view.getUint16(32, true).toString(), view.getUint16(32, true).toString(16));
    console.log("bits per sample - dec:%s, hex:%s", view.getUint16(34, true).toString(), view.getUint16(34, true).toString(16));
    console.log("data - dec:%s, hex:%s", view.getUint32(36, true).toString(), view.getUint32(36, true).toString(16));
    console.log("data length - dec:%s, hex:%s", view.getUint32(40, true).toString(), view.getUint32(40, true).toString(16));
}

function wavToPCM(arraybuff, ac, debug=false){
    let view = new DataView(arraybuff),
        numChannels = view.getUint16(22, true),
        bytesPerSample = view.getUint16(34, true) / 8,
        sampleRate = view.getUint32(24, true),
        totalSamples = view.getUint32(40, true) / (bytesPerSample * 8),
        samplesPerChannel = totalSamples / numChannels;

    if (debug){
        console.log("data view length: %s bytes", view.byteLength);
        console.log("samplesPerChannel: %s", samplesPerChannel);
        console.log("bytesPerSample: %s", bytesPerSample);
        console.log("sampleRate: %s", sampleRate);
        console.log("totalSamples: %s", totalSamples);
        console.log("numChannels: %s", numChannels);
        debugWav(view);
    }

    if (numChannels > 2) throw Error("Audio must be mono or stereo, " + numChannels.toString() + " channels detected...");
    if (![1,2,4].includes(bytesPerSample)) throw Error("unexpected byte rate: " + bytesPerSample.toString());

    let getters = {
        1: (v) => view.getInt8(v, true),
        2: (v) => view.getInt16(v, true),
        4: (v) => view.getInt32(v, true)
    };
    
    let getSample = getters[bytesPerSample],
        pos = 44,
        channels = [],
        counter = 0,
        normalizeBy = Math.pow(2, bytesPerSample * 8 - 1);

    if (debug)
        console.log("normalizeBy: %s", normalizeBy )

    for (let i=0; i < numChannels; i++)
        channels.push(new Float32Array(samplesPerChannel));

    while (counter < samplesPerChannel){
        for (let i=0; i < numChannels; i++){
            channels[i][counter] = getSample(pos) / normalizeBy;
            pos += bytesPerSample;
        }
        counter++;
    }

    let newBuff = ac.createBuffer(numChannels, samplesPerChannel, sampleRate);
    for (let i=0; i < numChannels; i++){
        newBuff.copyToChannel(channels[i], i, 0);
    }
    console.log(newBuff);
    return newBuff;

}


// Convert a audio-buffer segment to a Blob using WAVE representation
// with help from https://stackoverflow.com/questions/29584420/how-to-manipulate-the-contents-of-an-audio-tag-and-create-derivative-audio-tags/30045041#30045041
function bufferToWav(buff, debug=false) {

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    };

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    };  

    function setInt16(data ){
        view.setInt16(pos, data, true);
        pos += 2;
    }

    let numOfChan = buff.numberOfChannels,                                          // 2 channels
        bytesPerSample = 2,                                 
        length = buff.length * bytesPerSample * numOfChan + 44,
        newBuff = new ArrayBuffer(length),
        view = new DataView(newBuff),
        channels = [], i,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                                                          // "RIFF"
    setUint32(length - 8);                                                          // file length - 8
    setUint32(0x45564157);                                                          // "WAVE"

    setUint32(0x20746d66);                                                          // "fmt " chunk
    setUint32(16);                                                                  // length = 16
    setUint16(1);                                                                   // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buff.sampleRate);
    setUint32(buff.sampleRate * bytesPerSample * numOfChan);                        // avg. bytes/sec
    setUint16(numOfChan * bytesPerSample);                                          // block-align
    setUint16(8 * bytesPerSample);                                                  // 16-bit 

    setUint32(0x61746164);                                                          // "data" - chunk
    setUint32(buff.length * numOfChan * bytesPerSample * 8);                        // chunk length

    // write interleaved data
    for(i = 0; i < buff.numberOfChannels; i++)
        channels.push(buff.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {                                            // interleave channels
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));            // clamp in [-1,1]
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;        // scale to 16-bit signed int
            setInt16(sample);                                                       // update data chunk
        }
        offset++                                                                    // next source sample
    }

    if (debug){
        debugWav(view);
        console.log("numberOfChannels: %s", buff.numberOfChannels);
        console.log("bytesPerSample: %s", bytesPerSample);
        console.log("buff length: %s", buff.length);
    }

    // create Blob
    return new Blob([newBuff], {type: "audio/wav"});
}

function downloadBlob(filename, blob){
    let tmp = document.createElement('a');
    tmp.style = "display: none";
    document.body.appendChild(tmp);
    let url = window.URL.createObjectURL(blob);
    tmp.href = url;
    tmp.download = filename;
    tmp.click();
    //document.body.removeChild(tmp);
    //setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}


export default AudioLoopBunch;




