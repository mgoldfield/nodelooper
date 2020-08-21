import React from 'react';

import {Button, Slider} from './controls.js';


class Looper extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            'expanded': false,
            'recording': false,
            'playing': false,
            'clicking': false,
            'tempo': 60,
        }
        this.loops = []  
    }

    handleStop = () => null;

    handlePlay = () => {
        if (this.state.recording){

        }

        this.setState({'playing': !this.state.playing});
    }

    handleRec = () => {
        if (this.state.recording){
            if (this.state.playing) this.pressStop(); else this.loops.pop();
        }else{
            // toDo: check recording lock when it exists
            let name = "Loop " + this.loops.length.toString();
            this.loops.push(<Loop 
                key={name}
                name={name}
                recording={true}
                onChange={() => 2}
            />);
        }

        this.setState({'recording': !this.state.recording});
    } 

    render() {
        return (
            <div className='looper'>
                <div className='masterLoop'>
                    <div className='mainMasterLoop'> 
                        <Button name='stop' onClick={this.handleStop} />
                        <Button name='play' onClick={this.handlePlay} toggled={this.state.playing} />
                        <Button name='rec' onClick={this.handleRec} toggled={this.state.recording} />
                        <Button 
                            name={(this.state.expanded) ? 'collapse' : 'expand'}
                            onClick={() => this.setState({'expanded': !this.state.expanded})} 
                        />
                    </div>
                    <div className={'masterExtension '.concat((this.state.expanded) ? 'visibleExtension' : '')}>
                        <Button name='click on' onClick={this.handleClick} toggled={this.state.clicking} />
                        <Slider 
                            name='tempo' min='30' max='200' 
                            value={this.state.tempo} 
                            onChange={(e) => this.setState({'tempo': e.target.value})}
                        />
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
        }
    }

    handleMute = () => this.setState({'muted': !this.state.muted})    

    render() {
        return (
            <li className="loopItem">
                <div className={(this.props.recording) ? 'recordingDot' : 'dot'} />
                <input type='text' value={this.state.name} onChange={this.props.onChange}/>
                <Button name='mute' onClick={this.handleMute} toggled={this.state.muted}/>
                <Slider 
                    name='gain' min='0' max='2' 
                    value={this.state.gain} 
                    onChange={(e) => this.setState({'gain': e.target.value})}
                    step="0.01"
                />              
            </li>
        );
    }
}

export default Looper;

