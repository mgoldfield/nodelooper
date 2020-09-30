import React from 'react';
import {Button, DropDown, Slider, ProgressBar, LoopProgress} from './controls.js';
import AudioLoopBunch from './sound.js';


class Looper extends React.Component {
    constructor(props){
        super(props);
        this.loopBunch = new AudioLoopBunch();
        this.counter = 0;
        this.loops = [];
        this.state = {
            'expanded': true,
            'recording': this.loopBunch.recording,
            'playing': this.loopBunch.playing,
            'clicking': this.loopBunch.clickTrack.clicking,
            'countIn': this.loopBunch.clickTrack.countIn,
            'quantized': this.loopBunch.quantized,
            'tempo': this.loopBunch.clickTrack.tempo,
            'bpm': this.loopBunch.clickTrack.bpm,
            'loopRecStatus': [],
            'gain': 1,
            'inputMonitoring': this.loopBunch.inputMonitoring,
            'numLoops': this.loops.length,
            'processing': false,
        }


        // functions passed up from children  
        this.finishRecording = () => null;  
    }

    handleStop = (event=null, err=false) => {
        this.loopBunch.stop();
        if (err === 'earlyStop'){
            this.loopBunch.unprepareToRecord();
            this.loops.pop();
        }else{
            if (this.state.recording){
                if (this.state.playing){
                    this.finishRecording();
                    this.setState({'numLoops': this.loops.length});
                }else{
                    this.loopBunch.unprepareToRecord();
                    this.loops.pop();
                }          
            }
        }
        this.setState({
            'playing': false,
            'recording': false,
        });
    };

    handlePlay = () => {
        if (this.state.playing){
            this.handleStop();
        }else{
            this.setState({'playing': !this.state.playing});
            if (this.state.recording){
                this.loopBunch.record(() => { // onEarlyStop
                    console.log("early stop called");
                    this.handleStop(null, "earlyStop");
                });
            }else{
                if (this.loops.length > 0){
                    this.loopBunch.playLoops(this.loopBunch.getOffset());
                }else{
                    this.handleStop();
                }
            }
        }
    };

    handleRec = () => {
        if (this.state.recording){
            if (this.state.playing) 
                this.pressStop(); 
            else{
                this.loopBunch.unprepareToRecord();
                this.loops.pop();
                this.finishRecording = null;
            }
        }else{
            let id = this.counter++;
            this.loops.push(<Loop
                key={id}
                id={id}
                name={'loop '.concat(id)}
                recording={true}
                audioLoop={this.loopBunch.prepareToRecord()}
                handleToggleRecording={(f) => this.finishRecording = f}
            />);

        }
        this.setState({'recording': !this.state.recording});
    };

    handleQuant = () => {
        this.setState({'quantized': !this.loopBunch.quantized});
        this.loopBunch.quantized = !this.loopBunch.quantized;
    };

    handleClick = () => {
        if (!this.state.playing){
            this.setState({'clicking': !this.loopBunch.clickTrack.clicking});
            this.loopBunch.clickTrack.clicking = !this.loopBunch.clickTrack.clicking;
        }
    };

    handleCountIn = () => {
        this.setState({'countIn': !this.loopBunch.clickTrack.countIn});
        this.loopBunch.clickTrack.countIn = !this.loopBunch.clickTrack.countIn;
    };

    handleTempo = (e) => {
        // toDo: don't allow tempo change during play if quantized
        this.setState({'tempo': e.target.value});
        this.loopBunch.clickTrack.setTempo(e.target.value);
    };

    handleMaster = (e) => {
        this.setState({'gain': e.target.value});
        this.loopBunch.gainNode.gain.setValueAtTime(e.target.value, this.loopBunch.getAudioContext().currentTime);
    };

    handleBpm = (e) => {
        this.setState({'bpm': e.target.value});
        this.loopBunch.clickTrack.bpm = this.state.bpm;
    };

    handleInputMonit = () => {
        this.setState({'inputMonitoring': !this.loopBunch.inputMonitoring});
        this.loopBunch.toggleInputMonitoring();
    };

    handleInputChange = (e) => {
        this.loopBunch.device = e.target.value;
    };

    loadLoop = () => {
        this.setState({'processing': true});
        let uploader = document.createElement('input');
        uploader.type = 'file';
        uploader.style = 'display:none';
        uploader.accept = "audio/wav";

        document.body.appendChild(uploader);
        uploader.addEventListener('change', (e) => {
            let id = this.counter++;
            let onLoad = (loop) =>{
                console.log("pushing loop...");
                this.loops.push(<Loop
                    key={id}
                    id={id}
                    name={uploader.files[0].name}
                    recording={false}
                    audioLoop={loop}
                    handleToggleRecording={()=>null}
                />);
                this.setState({'processing': false});
            };
            this.loopBunch.loadLoop(uploader.files[0], onLoad);
        });
        uploader.click();
    };

    render() {
        return (
            <div className='looper'>
                <div className='masterLoop'>
                    <div className='mainMasterLoop'> 
                        <Button name='stop' onClick={this.handleStop} avail={true}/>
                        <Button name='play' onClick={this.handlePlay} 
                            toggled={this.state.playing} 
                            flashing={this.state.recording && !this.state.playing}
                            avail={!this.state.processing}/>
                        <Button name='rec' onClick={this.handleRec} 
                            toggled={this.state.recording} 
                            avail={(!this.state.playing || this.state.recording) && !this.state.processing}/>
                        <Button name='quant' onClick={this.handleQuant} 
                            toggled={this.state.quantized} avail={!this.state.playing}/>  
                        <Button name='input mon' onClick={this.handleInputMonit} 
                            toggled={this.state.inputMonitoring} avail={!this.state.playing}/>
                        <Button name="load .wav" onClick={this.loadLoop}
                            toggled={false} avail={!this.state.playing && !this.state.recording}/>
                        <Button name='down load' onClick={this.loopBunch.download} 
                            toggled={false} avail={this.state.numLoops > 0}/>                              
                        <Button 
                            name={(this.state.expanded) ? 'collapse' : 'expand'}
                            onClick={() => this.setState({'expanded': !this.state.expanded})} 
                            avail={true}
                        />
                    </div>
                    <div className={'masterExtension '.concat((this.state.expanded) ? 'visibleExtension' : '')}>
                        <div className='extensionControls'>
                            <Button name='click' onClick={this.handleClick} 
                            toggled={this.state.clicking} avail={!this.state.playing} />
                            <Button name='count in' onClick={this.handleCountIn} 
                                toggled={this.state.clicking && this.state.countIn} 
                                avail={this.state.clicking && !this.state.playing}/>
                            <DropDown name="input" onChange={this.handleInputChange} 
                                options={this.loopBunch.availableDevices} 
                                updateOptions={(f) => {this.loopBunch.ondevicechange = f; this.loopBunch.refreshAvailableDevices()}}/>                                
                            <span className='bpm'>
                                bpm
                                <input type='text' className='bpmInput' value={this.loopBunch.clickTrack.bpm} size='2' maxsize='2' onChange={this.handleBpm}/>
                            </span>
                            <Slider 
                                name='tempo' min='30' max='200' 
                                value={this.state.tempo} 
                                onChange={this.handleTempo}
                            />
                            <Slider 
                                name='master gain' min='0' max='10' 
                                value='1' step='0.01'
                                onChange={this.handleMaster}
                            />
                        </div>
                        <div className='progressBar'>
                            <ProgressBar
                                max={0}
                                updater = {(f) => this.loopBunch.updateProgressBar = f}
                                getVal = {(f) => this.loopBunch.getOffset = f}
                                onChange = {() => null}
                            />
                        </div>                        
                    </div>
                </div>


                <div className='loops'>
                    <ul className='loopList'>{this.loops}</ul>
                </div>
            </div>
        );
    }
}

class Loop extends React.Component {
    constructor(props){
        super(props);
        this.audioLoop = props.audioLoop;
        this.audioLoop.setRedraw((e)=>this.setState(e));
        this.state = {
            'name': props.name,
            'muted': this.audioLoop.muted,
            'gain': this.audioLoop.gainNode.gain.value,
            'looping': this.audioLoop.looping,
            'playing': this.audioLoop.playing,
            'recording': props.recording,
            'hasBuffer': !!this.audioLoop.buffer,
        }

        this.audioLoop.setName(props.name);
        
        this.props.handleToggleRecording(() => this.setState({'recording': false}));
    }

    handleMute = () => {
        this.audioLoop.toggleMute();
        this.setState({
            'muted': this.audioLoop.muted,
            'gain': this.audioLoop.gainNode.gain.value,
        });
        
    };

    handleLoop = () => {
        this.audioLoop.toggleLoop();
        this.setState({'looping': this.audioLoop.looping});
    };

    handleGain = (e) => {
        this.setState({'gain': e.target.value});
        this.audioLoop.setGain(e.target.value);
    }

    download = () => {
        this.audioLoop.download();
    }

    setName = (e) => {
        this.setState({'name': e.target.value});
        this.audioLoop.setName(e.target.value);
    }

    render() {
        return (
            <li className="loopItem">
            <div className="loopControls">
                <div className={(this.state.recording) ? 'recordingDot' : 'dot'} />
                <input type='text' className='inputFont loopName'
                    value={this.state.name} onChange={this.setName}
                />
                <Slider 
                    name='gain' min='0' max='10' 
                    value={this.state.gain} 
                    onChange={this.handleGain}
                    step="0.01"
                />  
                <Button name='mute' onClick={this.handleMute} 
                    toggled={this.state.muted} avail={this.state.hasBuffer}/>
                <Button name='loop' onClick={this.download} 
                    toggled={this.state.looping} avail={this.state.hasBuffer && !this.state.playing}/>
                <Button name="down load" onClick={this.download}
                    toggled={false} avail={this.state.hasBuffer} />
            </div>
            <LoopProgress update={(f) => this.audioLoop.updateProgress = f} />
            </li>
        );
    }
}


export default Looper;

