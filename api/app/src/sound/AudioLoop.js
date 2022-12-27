import { bufferToWav, downloadBlob } from '../format_tools.ts';

export class AudioLoop {
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
        this.gain = 1;

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
        console.log("metadata gain: %s, gainval: %s", this.gain, this.gainNode.gain.value);
        return {
            maxRepeats: {N:this.maxRepeats.toString()},
            delayedStart: {N: this.delayedStart.toString()},
            muted: {BOOL:this.muted},
            looping: {BOOL: this.looping},
            name: {S: this.name},
            gain: {N: (this.muted ? this.formerGain : this.gain).toString()},
            length: {N: this.buffer.length.toString()},
            sampleRate: {N: this.buffer.sampleRate.toString()},
            numChannels: {N: this.buffer.numberOfChannels.toString()},            
        };
    }

    broadcastMetadata() {
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
    }

    setRedraw(f){
        this.redraw = f;
    }

    setBuffer(buff){
        this.buffer = buff;
        if (this.onNewBuffer) this.onNewBuffer(buff);
        if (this.redraw) this.redraw({'hasBuffer': true}); 
        console.log("buffer length %s seconds", this.length)               
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
            this.stopTimeout = setTimeout(() => this.stop(), (this.maxRepeats * this.length + this.delayedStart - offset) * 1000);
        }

        if (offset - this.delayedStart > 0){
            offset = offset - this.delayedStart;     
            offset = offset % this.length;
            this.source.start(contextTime, offset);
        }else{
            this.source.start(contextTime + this.delayedStart - offset, 0);            
        }
    }

    record(delay){
        this.delayedStart = delay;
        this.recording = true;
        this.redraw({'recording': true});
    }

    setProgress(totalTime){
        if (totalTime <= this.delayedStart){
            this.onProgress(0);
            return;
        }

        if (this.maxRepeats === 0 || this.maxRepeats > ((totalTime - this.delayedStart) / this.length)){
            this.onProgress((totalTime - this.delayedStart) % this.length / this.length);
        }else{
            this.onProgress(0);
        }
    }

    stop(pause=false){
        if (this.playing){
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
        }
        this.playing = false;
        this.recording = false;
        this.redraw({'playing':false, 'recording': false});
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
        this.gainNode.gain.setValueAtTime(2**g - 1, this.getAudioContext().currentTime);

        if (!this.muted)
            this.gain = g;
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