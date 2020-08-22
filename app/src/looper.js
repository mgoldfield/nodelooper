import React from 'react';
import {Button, Slider} from './controls.js';
import AudioLoopBunch from './sound.js';


class Looper extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            'expanded': false,
            'recording': false,
            'playing': false,
            'clicking': false,
            'countIn': false,
            'tempo': 60,
        }
        this.counter = 0;
        this.loops = [];
        this.loopBunch = new AudioLoopBunch();
    }

    handleStop = () => {
        this.loopBunch.stop();
        if (this.state.recording && !this.state.playing){
            this.loopBunch.unprepareToRecord();
            this.loops.pop();            
        }
        this.setState({
            'playing': false,
            'recording': false,
        });
    }

    handlePlay = () => {
        this.setState({'playing': !this.state.playing});
        if (this.state.recording){
            this.loopBunch.record();
        }
    }

    handleRec = () => {
        if (this.state.recording){
            if (this.state.playing) 
                this.pressStop(); 
            else{
                this.loopBunch.unprepareToRecord();
                this.loops.pop();
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
            />);
        }
        this.setState({'recording': !this.state.recording});
    } 

    handleQuant = () => {
        this.setState({'quantized': !this.state.quantized});
    }

    handleClick = () => {
        this.setState({'clicking': !this.state.clicking});
        this.AudioLoopBunch.clickTrack.clicking = this.state.clicking;
    }

    handleCountIn = () => {
        this.setState({'countIn': !this.state.countIn});
        this.AudioLoopBunch.clickTrack.countIn = this.state.countIn;
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
                                <input type='text' value='4' size='2' maxsize='2' onChange={()=>null}/>
                            </span>
                            <Slider 
                                name='tempo' min='30' max='200' 
                                value={this.state.tempo} 
                                onChange={(e) => this.setState({'tempo': e.target.value})}
                            />
                            <Slider 
                                name='master' min='0' max='2' 
                                value='1' step='0.01'
                                onChange={(e) => this.setState({'tempo': e.target.value})}
                            />
                        </div>
                        <div className='progressBar'>
                            progressBar                       
                        </div>                        
                    </div>
                </div>


                <div className="fade-in">
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
        }
        this.audioLoop = props.audioLoop;
    }

    handleMute = () => {
        this.setState({'muted': !this.state.muted});
        this.audioLoop.toggleMute();
    }

    handleLoop = () => {
        this.setState({'looping': !this.state.looping});
        this.audioLoop.toggleLoop();
    }

    render() {
        return (
            <li className="loopItem">
                <div className={(this.props.recording) ? 'recordingDot' : 'dot'} />
                <input type='text' value={this.state.name} onChange={this.props.onChange}/>
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

