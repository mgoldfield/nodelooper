import React from 'react';
import {Button, 
    DropDown, 
    Slider, 
    ProgressBar, 
    LoopProgress, 
    Instructions, 
    ChatWindow} from './controls.js';
import AudioLoopBunch from './sound.js';
import config from './config-app.js';
import { v4 as uuidv4 } from 'uuid';


class Looper extends React.Component {
    constructor(props){
        super(props);
        this.loopBunch = new AudioLoopBunch();

        let qs = new URLSearchParams(window.location.search);
        this.project_id = qs.get('ProjectID');
        this.counter = 0;
        this.loops = [];
        this.state = {
            'expanded': true,
            'recording': this.loopBunch.recording,
            'playing': this.loopBunch.playing,
            'clicking': this.loopBunch.clickTrack.clicking,
            'countIn': this.loopBunch.clickTrack.countIn,
            'quantize': this.loopBunch.recorder.quantize,
            'tempo': this.loopBunch.clickTrack.tempo,
            'bpm': this.loopBunch.clickTrack.bpm,
            'loopRecStatus': [],
            'gain': 1,
            'inputMonitoring': this.loopBunch.inputMonitoring,
            'numLoops': this.loops.length,
            'processing': true,
        }
        this.loopBunch.initComms(this.project_id, this)
        .then(this.handleInitLoops)
        .catch(e => {throw e});      
        this.finishRecording = () => null;  
    }

    handleInitLoops = (loops) => {
        this.counter += loops.length - 1;
        if (this.counter === 0) this.setState({'processing': false});
        for (const l of loops){
            this.loadLoopFromDynamoData(l);
        }       
    };

    addNewLoop(key, id, name, recording, audioloop, handleToggleRecording){
        let newloop = (<Loop
            key={key}
            id={id}
            name={name}
            recording={recording}
            audioLoop={audioloop}
            handleToggleRecording={handleToggleRecording}
            handleDelete={this.deleteLoop}
        />);
        this.setProgressBarMax(audioloop.length);
        this.loops.push(newloop);        
    }

    loadLoopFromDynamoData = (l) => {
        // toDo: make a "loading" light
        let onLoad = (loop) =>{
            this.addNewLoop(
                l.LoopID.S,
                l.LoopID.S,
                l.metadata.M.name.S,
                false,
                loop,
                () => null);
            if (this.loops.length <= this.counter){
                this.setState({'processing': false});
            }
        };
        if (l.LoopID.S === config.newLoopIdentifier){
            this.updateMetadata({
                LoopID: l.LoopID.S,
                metadata: l.metadata.M,
            });
        }else{
            this.loopBunch.loadLoopFromDynamoData(l, onLoad);
        }
    };

    handleStop = (err=false, toggledByPlay=false) => {
        this.loopBunch.stop(toggledByPlay);
        if (err === 'earlyStop'){
            this.loopBunch.unprepareToRecord();
            this.loops.pop();
            this.setState({'processing': false})
        }else{
            if (this.state.recording){
                if (this.state.playing){
                    this.setState({'processing': true});
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
            this.handleStop(null, true);
        }else{
            this.setState({'playing': !this.state.playing});
            if (this.state.recording){
                this.loopBunch.record(() => { // onEarlyStop
                    this.handleStop("earlyStop");
                });
            }else{
                this.loopBunch.playLoops();
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
            if (this.counter >= config.limits.loops){
                alert("You have exceeded maximum loops per project :(");
                return;
            }
            let id = this.counter++;
            let lid = uuidv4();
            this.addNewLoop(
                lid,
                lid,
                'loop '.concat(id),
                true, 
                this.loopBunch.prepareToRecord(),
                (f) => this.finishRecording = f);
        }
        this.setState({'recording': !this.state.recording});
    };

    handleQuant = () => {
        this.setState({'quantize': !this.loopBunch.recorder.quantize});
        this.loopBunch.recorder.quantize = !this.loopBunch.recorder.quantize;
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

    handleTempo = (v) => {
        this.setState({'tempo': v});
        this.loopBunch.clickTrack.setTempo(v);
    };


    handleMaster = (v) => {
        this.setState({'gain': v});
        this.loopBunch.gainNode.gain.setValueAtTime(v, this.loopBunch.getAudioContext().currentTime);
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

    updateMetadata = (data) => {
        if (data.LoopID === config.newLoopIdentifier){
            if (data.metadata.tempo){ // backwards compatability
                let tempo = parseInt(data.metadata.tempo.N);
                this.setState({'tempo': tempo});
                this.loopBunch.clickTrack.setTempo(tempo);
                this.updateTempoSlider(tempo);
            }
        }else{
            this.loopBunch.updateMetadata(data);
        }
    }

    broadcastMetadata = () => {
        let metadata = {tempo: {N: this.state.tempo.toString()}};
        this.loopBunch.comms.broadcastMetadata(config.newLoopIdentifier, metadata);
    }    

    loadLoop = () => {
        if (this.counter >= config.limits.loops){
            alert("You have exceeded maximum loops per project :(");
            return;
        }

        this.setState({'processing': true});
        let uploader = document.createElement('input');
        uploader.type = 'file';
        uploader.style = 'display:none';

        document.body.appendChild(uploader);
        uploader.addEventListener('change', (e) => {
            this.counter++;
            let lid = uuidv4()
            let onLoad = (loop) =>{
                this.addNewLoop(
                    lid,
                    lid,
                    uploader.files[0].name,
                    false,
                    loop,
                    () => null);
                this.setState({'processing': false});
            };
            let onLoadFail = (err) => {
                alert("error reading file - probably unsupported filetype");
                console.log("error reading audio file: %s", err);
                this.setState({'processing': false});
            };

            this.loopBunch.loadLoopFromDisk(lid, uploader.files[0], onLoad, onLoadFail);
        });
        uploader.click();
    };

    deleteLoop = (id, broadcast=true) => {
        this.setState({'processing': true});
        this.loops = this.loops.filter(l => l.key !== id);
        this.loopBunch.deleteLoop(id, broadcast);
        this.setState({'processing': false});
    }

    getLoadingClasses = () => {
        return 'loading ' + (this.state.processing ? 'loadingon' : 'loadingoff');
    }

    renderMainBar(){
        return (
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
                    toggled={this.state.quantize} avail={!this.state.playing}/>  
                <Button name='input mon' onClick={this.handleInputMonit} 
                    toggled={this.state.inputMonitoring} avail={!this.state.playing}/>
                <Button name="load file" onClick={this.loadLoop}
                    toggled={false} avail={!this.state.playing && !this.state.recording}/>
                <Button name='down load' onClick={this.loopBunch.download} 
                    toggled={false} avail={this.state.numLoops > 0}/>                              
                <Button 
                    name={(this.state.expanded) ? 'collapse' : 'expand'}
                    onClick={() => this.setState({'expanded': !this.state.expanded})} 
                    avail={true}
                />
            </div>
        );
    }

    renderExtension(){
        return(
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
                        beats
                        <input type='text' className='bpmInput' value={this.loopBunch.clickTrack.bpm} size='2' maxsize='2' onChange={this.handleBpm}/>
                    </span>
                    <Slider
                        name='tempo' min='30' max='250' 
                        value={this.state.tempo} 
                        onChange={this.handleTempo}
                        showVal={true}
                        updateVal={f => this.updateTempoSlider = f}
                        broadcast={this.broadcastMetadata}
                    />
                    <Slider 
                        name='master gain' min='0' max='5' 
                        value='1' step='0.01'
                        onChange={this.handleMaster}
                    />
                </div>
                <div className='progressBar'>
                    <ProgressBar
                        max={60}
                        updater = {(f) => this.loopBunch.updateProgressBar = f}
                        getVal = {(f) => this.loopBunch.getOffset = f}
                        onChange = {() => null}
                        secondsPerBeat = {this.loopBunch.clickTrack.secondsPerBeat}
                        quantize = {this.state.quantize}
                        setMax = {(f) => this.setProgressBarMax = f}
                        coordinateBars = {this.loopBunch.updateLoopsProgressBars}
                    />
                </div>                        
            </div>
        );
    }

    render() {
        return (
            <div className='pageContainer'>
                <div className='headerContainer'>
                    <span className='backHome'><a href={config.full_api_url}>home</a></span>
                    <div className='mainHeader'>
                        <span className='title'>loopmagic!</span>
                        <span className='subtitle'>requires <a href="https://www.mozilla.org/firefox/download/thanks/">firefox v80+</a></span>
                    </div>
                    <span className='support'><a href="https://www.patreon.com/mgoldfield">support this project</a></span>
                </div>
                <div className='bodyContainer'>
                    <div className='instructions'>
                        <Instructions/>
                    </div>
                    <div className='looper'>
                        <div className='masterLoop'>
                            {this.renderMainBar()}
                            {this.renderExtension()}
                        </div>

                        <div className='loops'>
                            <ul className='loopList'>{this.loops}</ul>
                        </div>

                        <div className="loadingBox">
                            <div className={this.getLoadingClasses()}>...loading...</div>
                        </div>

                        <div className='initText'>
                            <div className='initTextLine'>press "rec" and then "play" to record your first loop</div>
                            <div className='initTextLine'>share the url of this project with anyone you want to collaborate with, or use it to come back to this project another day.</div>
                            <div className='initTextLine'>projects persist for 5 days - don't forget to download yours before then!</div>
                        </div>
                    </div>
                    <div className='userStatusBar'>
                        {/* toDo: add user indicators here */}
                        <ChatWindow sendChat={(line) => {this.loopBunch.comms.sendChat(line)}}
                            exposeUpdateChat={(f => this.updateChat = f)}/>
                    </div>
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
            'maxRepeats': this.audioLoop.maxRepeats,
            'id': props.id,
        }

        this.audioLoop.setName(props.name);
        this.audioLoop.id = props.id;
        this.props.handleToggleRecording(() => this.setState({'recording': false}));
        this.deleteLoop = () => this.props.handleDelete(props.id);
    }

    handleMute = () => {
        this.audioLoop.toggleMute();
        this.setState({
            'muted': this.audioLoop.muted,
            'gain': this.audioLoop.gainNode.gain.value,
        });
        this.audioLoop.broadcastMetadata();
    };

    handleLoop = () => {
        this.audioLoop.toggleLoop();
        this.setState({'looping': this.audioLoop.looping});
        this.audioLoop.broadcastMetadata();
    };

    handleGain = (v) => {
        this.setState({'gain': v});
        this.audioLoop.setGain(v);
    }

    download = () => {
        this.audioLoop.download();
    }

    setName = (e) => {
        this.setState({'name': e.target.value});
        this.audioLoop.setName(e.target.value);
    }

    handleMaxRepeats = (e) => {
        let v = e.target.value;
        if (e.target.value === ''){
            v = '0';
        }
        this.setState({'maxRepeats': ((v === '0') ? '' : v)});
        this.audioLoop.maxRepeats = parseInt(v);
    }

    render() {
        return (
            <li className="loopItem">
            <div className="loopControls">
                <div className={(this.state.recording) ? 'recordingDot' : 'dot'} />
                <input type='text' className='inputFont loopName maxRepsInput'
                    value={this.state.name} onChange={this.setName} onBlur={this.audioLoop.broadcastMetadata}
                />
                <Slider 
                    name='gain' min='0' max='3' 
                    value={this.state.gain} 
                    onChange={this.handleGain}
                    step="0.01"
                    updateVal={f => this.audioLoop.updateGain = f}
                    broadcast={this.audioLoop.broadcastMetadata}
                />  
                <Button name='mute' onClick={this.handleMute} 
                    toggled={this.state.muted} avail={this.state.hasBuffer}/>
                <Button name='loop' onClick={this.handleLoop} 
                    toggled={this.state.looping} avail={this.state.hasBuffer && !this.state.playing}/>

                <Button name='delete' onClick={this.deleteLoop} 
                    toggled={false} avail={!this.state.recording && !this.state.playing}/>                    

                <Button name="down load" onClick={this.download}
                    toggled={false} avail={this.state.hasBuffer} />
                <span className='maxReps'>
                    reps
                    <input type='text' className='maxRepsInput' 
                        value={this.state.maxRepeats === 0 ? "" : this.state.maxRepeats} 
                        size='3' maxsize='3' onChange={this.handleMaxRepeats}
                        onBlur={this.audioLoop.broadcastMetadata}/>
                </span>
            </div>
            <LoopProgress audioLoop={this.audioLoop}/>
            </li>
        );
    }
}


export default Looper;

