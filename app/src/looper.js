import React from 'react';
import {Button, Slider} from './controls.js';
import AudioLoopBunch from './sound.js';


class Looper extends React.Component {
    constructor(props){
        super(props);
        this.loopBunch = new AudioLoopBunch();
        this.state = {
            'expanded': false,
            'recording': false,
            'playing': false,
            'clicking': false,
            'countIn': false,
            'tempo': this.loopBunch.clickTrack.tempo,
            'bpm': this.loopBunch.clickTrack.bpm,
            'loopRecStatus': [],
            'gain': 1,
        }
        this.counter = 0;
        this.loops = [];
        
    }

    handleStop = () => {
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
        this.setState({'quantized': !this.state.quantized});
    };

    handleClick = () => {
        this.setState({'clicking': !this.loopBunch.clickTrack.clicking});
        this.loopBunch.clickTrack.clicking = !this.loopBunch.clickTrack.clicking;
    };

    handleCountIn = () => {
        this.setState({'countIn': !this.loopBunch.clickTrack.countIn});
        this.loopBunch.clickTrack.countIn = !this.loopBunch.clickTrack.countIn;
    };

    handleTempo = (e) => {
        this.setState({'tempo': e.target.value});
        this.loopBunch.clickTrack.setTempo(this.state.tempo);
    };

    handleMaster = (e) => {
        this.setState({'gain': e.target.value});
        this.loopBunch.gainNode.setValueAtTime(this.state.gain, this.loopBunch.getAudioContext().currentTime);
    };

    handleBpm = (e) => {
        this.setState({'bpm': e.target.value});
        this.loopBunch.clickTrack.bpm = this.state.bpm;
    };

    render() {
        return (
            <div className='looper'>
                <div className='masterLoop'>
                    <div className='mainMasterLoop'> 
                        <Button name='stop' onClick={this.handleStop} />
                        <Button name='play' onClick={this.handlePlay} toggled={this.state.playing} />
                        <Button name='rec' onClick={this.handleRec} toggled={this.state.recording} />
                        <Button name='quant' onClick={this.handleQuant} toggled={this.state.quantized} />
                        <Button 
                            name={(this.state.expanded) ? 'collapse' : 'expand'}
                            onClick={() => this.setState({'expanded': !this.state.expanded})} 
                        />
                    </div>
                    <div className={'masterExtension '.concat((this.state.expanded) ? 'visibleExtension' : '')}>
                        <div className='extensionControls'>
                            <Button name='click' onClick={this.handleClick} toggled={this.state.clicking} />
                            <Button name='count-in' onClick={this.handleCountIn} toggled={this.state.countIn} />
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
                                name='master' min='0' max='2' 
                                value='1' step='0.01'
                                onChange={this.handleMaster}
                            />
                        </div>
                        <div className='progressBar'>
                            progressBar                       
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
        this.state = {
            'name': props.name,
            'muted': false,
            'gain': 1,
            'looping':false,
            'recording': props.recording,
        }
        this.audioLoop = props.audioLoop;
        this.props.handleToggleRecording(() => this.setState({'recording': false}));
    }

    handleMute = () => {
        this.setState({'muted': !this.state.muted});
        this.audioLoop.toggleMute();
    };

    handleLoop = () => {
        this.setState({'looping': !this.state.looping});
        this.audioLoop.toggleLoop();
    };

    render() {
        return (
            <li className="loopItem">
                <div className={(this.state.recording) ? 'recordingDot' : 'dot'} />
                <input type='text' 
                    value={this.state.name} 
                    onChange={(e) => this.setState({'name': e.target.value})}
                />
                <Slider 
                    name='gain' min='0' max='2' 
                    value={this.state.gain} 
                    onChange={(e) => this.setState({'gain': e.target.value})}
                    step="0.01"
                />  
                <Button name='mute' onClick={this.handleMute} toggled={this.state.muted}/>
                <Button name='loop' onClick={this.handleLoop} toggled={this.state.looping}/>                            
            </li>
        );
    }
}


export default Looper;

