import base64 from 'base64-js';
import { AudioLoop, ClickTrack, Recorder } from '.';
import { Communication } from '../communicate.ts';
import { bufferToWav, downloadBlob } from '../format_tools.ts';

export class AudioLoopBunch{
    constructor(){
        this.getAudioContext = () => {
            // we don't suspend audiocontext here because we're mostly using it in the app
            if (!this._audioContext){
                this._audioContext = new AudioContext({
                    latencyHint: 'interactive', 
                    sampleRate: 44100,
                });
            }
            return this._audioContext;
        };
        
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
        navigator.mediaDevices.ondevicechange = this.refreshAvailableDevices.bind(this);

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

    async refreshAvailableDevices() {
        let tmpstream = await this.getUserAudio();
        tmpstream.getTracks().forEach((track) => track.stop());

        let devices = await navigator.mediaDevices.enumerateDevices();
        this.availableDevices = devices.filter(d => d.kind === 'audioinput');
        console.log(this.availableDevices);

        //toDo: fail gracefully here... catch in looper and display a message
        this.device = this.availableDevices[0].deviceId;

        if (this.ondevicechange){
            this.ondevicechange(this.availableDevices);
        }
    }

    getUserAudio() {
        let options = {
            video: false,
            audio: {
                deviceId: this.device, 
                echoCancellation: false, 
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 1,
            },
        };
        let to_return = navigator.mediaDevices.getUserMedia(options);
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

    async record(onEarlyStop){
        if (!this.recordingLoop) 
            throw Error("Record has not been prepped...something is wrong");

        this.recording = true;
        this.recordingLoop.record(this.getOffset());

        try {
            const newBuff = await this.recorder.recordBuffer(
                this.getUserAudio(),
                this.clickTrack.oneMeasureInSeconds
                );
            this.recordingLoop.setBuffer(newBuff);
            this.addLoop(this.recordingLoop);
        } catch (e) {
            onEarlyStop();
            this.unprepareToRecord();
        }
    }

    stop(toggledByPlay=false){
        if (this.recording){
            this.recorder.stop();
            this.recordingLoop.stop();
            this.recording = false;
        }
        this.stopLoops();
        this.playing = false;
        if (!toggledByPlay)
            this.updateProgressBar(0);
    }

    updateLoopsProgressBars(t) {
        for (const l of this.audioLoops){
            l.setProgress(t);
        }
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
            setTimeout(()=>{this.startUpdatingProgressBar(playTime, offset)}, 100);
        }        
    }

    playLoops(){
        let offset = this.getOffset();
        this.refreshMergeNode();
        this.playing = true;

        let waitTime = 0.5 + this.getAudioContext().baseLatency;
        let clickStartTime = this.getAudioContext().currentTime + waitTime;
        let playTime = clickStartTime;
        if (this.clickTrack.countIn && this.recording)
            playTime += this.clickTrack.oneMeasureInSeconds;

        this.clickTrack.start(clickStartTime, offset, this.recording);
        for (const l of this.audioLoops)
            l.play(playTime, offset);

        this.startUpdatingProgressBar(playTime, offset);
        return playTime;
    }

    stopLoops(pause=false){
        this.clickTrack.stop();

        for (const l of this.audioLoops)
            l.stop(pause);
    }

    setGain(g){
        this.gainNode.setValueAtTime(2 ** g - 1, this.getAudioContext().currentTime);
    }

    download() {
        // mix down all loops
        let maxLength = 0;
        for (const l of this.audioLoops){
            if (l.buffer.length + (l.delayedStart * this.audioLoops[0].buffer.sampleRate) > maxLength){
                maxLength = l.buffer.length + (l.delayedStart * this.audioLoops[0].buffer.sampleRate);
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
                    if (!this.audioLoops[l].muted && this.audioLoops[l].delayedStart <= (sample / mix.sampleRate)){
                        outputChannel[sample] += (2**this.audioLoops[l].gain - 1) * channelData[l][(sample - (this.audioLoops[l].delayedStart * this.audioLoops[0].buffer.sampleRate)) % this.audioLoops[l].buffer.length];
                    }
                }
            }
        }
        downloadBlob('loop_mix.wav', bufferToWav(mix));
    }

    addLoop(loop, sendLoop=true){
        this.audioLoops.push(loop);
        this.mergeOutOfDate = true;
        if (sendLoop) {
            this.comms.sendLoop(loop);
        }
    }

    loadLoopFromDisk(id, f, cb_success, cb_fail) {
        let reader = new FileReader();
        reader.onload = async (event) => {
            this.getAudioContext().decodeAudioData(event.target.result)
            .then(buff => {
                if (buff.numberOfChannels > 2)
                    throw Error("Too many channels... only mono or stereo tracks are loadable");

                if (buff.numberOfChannels < 2){
                    let newbuff = this.getAudioContext().createBuffer(2, buff.length, buff.sampleRate);
                    newbuff.copyToChannel(buff.getChannelData(0), 0);
                    newbuff.copyToChannel(buff.getChannelData(0), 1);
                    buff = newbuff;
                }

                let loop = new AudioLoop(this.getAudioContext, this.comms);
                loop.id = id;
                loop.name = f.name;
                loop.delayedStart = this.getOffset();
                loop.setBuffer(buff);
                this.addLoop(loop);
                cb_success(loop);                
            }).catch(err => {
                cb_fail(err)
            });     
        }
        reader.readAsArrayBuffer(f);
    }

    async loadLoopFromDynamoData(l, onLoad) {
        function b64toFloatArr(to_encode){
            return Float32Array.from(atob(to_encode), c => c.charCodeAt(0))
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
            const tmpbuf = base64.toByteArray(audio.data)
            let tmpAudioBuf = await this.getAudioContext().decodeAudioData(tmpbuf.buffer),
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
        this.audioLoops = this.audioLoops.filter(l => {
            if (l.id === id) {
                l.stop();
                l.deleted = true;
                return false;
            } else return true;
        });
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
