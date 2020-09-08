import React from 'react';
import {Button, Slider, ProgressBar} from './controls.js';
import AudioLoopBunch from './sound.js';


class Looper extends React.Component {
    constructor(props){
        super(props);
        this.loopBunch = new AudioLoopBunch();
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
            'inputMonitoring': false,
        }
        console.log(this.state);
        this.counter = 0;
        this.loops = [];

        // functions passed up from children  
        this.finishRecording = () => null;  
    }

    handleStop = () => {
        // toDo: handle stop correctly if stopped within countIn 
        this.loopBunch.stop();
        if (this.state.recording){
            if (this.state.playing){
                this.finishRecording();
            }else{
                this.loopBunch.unprepareToRecord();
                this.loops.pop();
            }          
        }
        this.setState({
            'playing': false,
            'recording': false,
        });
    };

    handlePlay = () => {
        // toDo: don't allow play if no loops have been recorded
        if (this.state.playing){
            this.handleStop();
        }else{
            this.setState({'playing': !this.state.playing});
            if (this.state.recording){
                this.loopBunch.record();
            }else{
                this.loopBunch.playLoops();
            }
        }
    };

    handleRec = () => {
        // toDo: don't allow record if progress bar isn't at the beginning
        if (this.state.recording){
            if (this.state.playing) 
                this.pressStop(); 
            else{
                this.loopBunch.unprepareToRecord();
                this.loops.pop();
                this.finishRecording = null;
            }
        }else{
            // toDo: check recording lock when it exists
            let id = this.counter++;
            this.loops.push(<Loop
                key={id}
                id={id}
                name={'loop '.concat(id)}
                recording={true}
                audioLoop={this.loopBunch.prepareToRecord(id)}
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
            //toDo: gray out click when playing
            this.setState({'clicking': !this.loopBunch.clickTrack.clicking});
            this.loopBunch.clickTrack.clicking = !this.loopBunch.clickTrack.clicking;
        }
    };

    handleCountIn = () => {
        // toDo: don't allow countIn if click isnt selected, grey out button
        this.setState({'countIn': !this.loopBunch.clickTrack.countIn});
        this.loopBunch.clickTrack.countIn = !this.loopBunch.clickTrack.countIn;
    };

    handleTempo = (e) => {
        // don't allow tempo change during play if quantized
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
        return;
    }

    render() {
        return (
            <div className='looper'>
                <div className='masterLoop'>
                    <div className='mainMasterLoop'> 
                        <Button name='stop' onClick={this.handleStop} />
                        <Button name='play' onClick={this.handlePlay} toggled={this.state.playing} />
                        <Button name='rec' onClick={this.handleRec} toggled={this.state.recording} />
                        <Button name='quant' onClick={this.handleQuant} toggled={this.state.quantized} />
                        <Button name='input mon' onClick={this.handleInputMonit} toggled={this.state.inputMonitoring} />
                        <Button 
                            name={(this.state.expanded) ? 'collapse' : 'expand'}
                            onClick={() => this.setState({'expanded': !this.state.expanded})} 
                        />
                    </div>
                    <div className={'masterExtension '.concat((this.state.expanded) ? 'visibleExtension' : '')}>
                        <div className='extensionControls'>
                            <Button name='click' onClick={this.handleClick} toggled={this.state.clicking} />
                            <Button name='count in' onClick={this.handleCountIn} toggled={this.state.countIn} />
                            <span className='bpm'>
                                bpm
                                <input type='text' value='4' size='2' maxsize='2' onChange={this.handleBpm}/>
                            </span>
                            <Slider 
                                name='tempo' min='30' max='200' 
                                value={this.state.tempo} 
                                onChange={this.handleTempo}
                            />
                            <Slider 
                                name='master' min='0' max='10' 
                                value='1' step='0.01'
                                onChange={this.handleMaster}
                            />
                        </div>
                        <div className='progressBar'>
                            <ProgressBar
                                max={0}
                                updater = {(f) => this.loopBunch.updateProgressBar = f}
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
        this.state = {
            // toDo: what to do with names
            'name': props.name,
            'muted': this.audioLoop.muted,
            'gain': this.audioLoop.gainNode.gain.value,
            'looping': this.audioLoop.looping,
            'recording': props.recording,
        }
        
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

    render() {
        return (
            <li className="loopItem">
                <div className={(this.state.recording) ? 'recordingDot' : 'dot'} />
                <input type='text' 
                    value={this.state.name} 
                    onChange={(e) => this.setState({'name': e.target.value})}
                />
                <Slider 
                    name='gain' min='0' max='10' 
                    value={this.state.gain} 
                    onChange={this.handleGain}
                    step="0.01"
                />  
                <Button name='mute' onClick={this.handleMute} toggled={this.state.muted}/>
                <Button name='loop' onClick={this.handleLoop} toggled={this.state.looping}/>
            </li>
        );
    }
}


export default Looper;

