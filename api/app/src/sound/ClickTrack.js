export class ClickTrack{ // metronome inspired by https://blog.paul.cx/post/metronome/
    constructor(getAudioContext){
        this.getAudioContext = getAudioContext;
        this.tempo = 80;
        this.bpm = 4; // beats per minute
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

    start(time, offset, recording){
        if (!this.clicking && !(this.countIn && recording))
            return;

        if (offset > 0){
            let clickOffset = offset % this.secondsPerBeat;
            if (clickOffset > 0)
                time += this.secondsPerBeat - clickOffset;
        }

        this.source = this.getAudioContext().createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.loopEnd = this.secondsPerBeat;
        this.source.connect(this.getAudioContext().destination);

        if (!this.clicking && this.countIn && recording){
            this.stopTimeout = setTimeout(
                this.stop, 
                // extra .01 to make sure we stop before the next beat
                1000 * (time - this.getAudioContext().currentTime + this.oneMeasureInSeconds - .01)); 
        }

        this.source.start(time);
    }           

    stop() {
        if (!this.source)
            return;

        this.source.stop();
        this.source.disconnect();
        if (this.stopTimeout)
            clearTimeout(this.stopTimeout);
    }
}
