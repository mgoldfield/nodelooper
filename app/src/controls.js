import React from 'react';

class Button extends React.Component {
    classes(){
        let extraClasses = {
            'expand': ['downarrow'],
            'collapse': ['uparrow'],
        }

        let classList = ['button'].concat(extraClasses[this.props.name] || []);
        if (this.props.toggled) classList.push('toggled');
        if (!this.props.avail) classList.push('unavail');
        if (this.props.flashing) classList.push('flashing');
        if (this.props.name.length > 5) classList.push('smallFont');

        return classList.join(' ');
    }

    hideText(name){
        let hide = {
            'expand': true,
            'collapse': true,
        }

        return hide[name] || false;
    }

    onClick = (e) => {
        if (this.props.avail){
            return this.props.onClick(e);
        }
    }

    render() {
        return (
            <div className={this.classes()} onClick={this.onClick}>
                {(this.hideText(this.props.name)) ? '' : this.props.name}
            </div>
        );
    }
}


class DropDown extends React.Component {

    constructor(props){
        super(props);
        this.state = {'options':props.options};
        props.updateOptions((options) => {
            this.setState({'options':options});
        });   
    }

    listify(){
        if (!this.state.options){
            return [];
        }
        let options = [];
        for (let i =0; i < this.state.options.length; i++ ){
            options.push(
            <option key={this.state.options[i].deviceId} value={this.state.options[i].deviceId}>
                {this.state.options[i].label}
            </option>);
        }
        return options;
    }

    render(){
        return (
            <div className="dropDownDiv">
                {this.props.name}
                <select className="dropDown" onChange={this.props.onChange}>
                    {this.listify()}
                </select>
            </div>
        );
    }
}

class Slider extends React.Component {
    constructor(props){
        super(props);
        this.state = {'value':this.props.value};
    }

    onChange(event){
        return;
    }

    render() {
        return (
            <div className='slider'>
                <div className='sliderTitle'>{this.props.name}</div>
                <input 
                    className='sliderInput'
                    type='range' 
                    min={this.props.min} 
                    max={this.props.max}
                    value={this.state.value}
                    step={(this.props.step) ? this.props.step : 1}
                    onChange={this.props.onChange}
                    onInput={(e) => this.setState({'value':e.target.value})}
                />
                <span className='sliderValBox'>
                    {this.state.value}
                </span>
            </div>

        );
    }
}

class ProgressBar extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            'value': 0,
            'max': this.props.max,
        };
        // make the bar as long as 4x the longest loop
        this.props.updater((v) => this.setState({'value':v, 'max':Math.max(this.state.max, 4 * v)}));
        this.props.getVal(() => parseFloat(this.state.value));
    }

    onChange(event){
        return;
    }

    toMinutes(t){
        let m = Math.floor(t / 60);
        return m.toString() + ":" + Math.floor(t - (m * 60)).toString().padStart(2, '0');
    }

    render() {
        return (
            <div className='progressBar'>
                <input 
                    className='progressBarSlider'
                    type='range' 
                    min='0' 
                    max={this.state.max}
                    value={this.state.value}
                    step='.01'
                    onChange={this.props.onChange}
                    onInput={(e) => this.setState({'value':e.target.value})}
                />
                <span className='progressBarVal'>
                    {this.toMinutes(this.state.value) + '/' + this.toMinutes(this.state.max)}
                </span>
            </div>

        );
    }
}



class LoopProgress extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            'progress': 0, // percent
        };

        this.props.update((p) => this.setState({'progress':p}));
    }

    render() {
        return (
            <div className="loopProgress">
                <span className="loopProgressBar" style={{flex:this.state.progress}} />
            </div>
        );
    }
}

class Instructions extends React.Component {
    render(){
        return (
            <div className="instrucText">
                <p><b>bpm</b>: beats per measure.  used with <i>click</i> and <i>quant</i></p> 
                <p><b>click</b>: metronome. when toggled, emits a click track while playing and recording according to <i>tempo</i> and <i>bpm</i></p>  
                <p><b>count in</b>: when recording, emit one measure of clicks before recording begins.</p>
                <p><b>download</b>: download current mix or given loop as <i>.wav</i>. track will be the length of the longest loop. </p>
                <p><b>input</b>: choose audio input. default is internal mic </p>
                <p><b>input mon</b>: when toggled, plays selected input through to output </p>
                <p><b>load .wav</b>: load a <i>.wav</i> file as a loop.  if you have a sound file of another format,
                    such as an <i>.mp3</i>, use a program like garageband to convert the file to <i>.wav</i>. </p>
                <p><b>loop</b>: when toggled, loop repeats.  when not toggled, loop plays just once. </p>                
                <p><b>master gain</b>: gain/volume for entire project. </p>
                <p><b>mute</b>: mute loop</p>            
                <p><b>quant</b>: quantizes loops to the nearest measure, as defined by <i>tempo</i> and <i>bmp</i></p>
                <p><b>rec</b>: creates a new loop.  press <i>play</i> after pressing <i>rec</i> to start recording a</p>
                <p><b>reps</b>: max repetitions of a loop. when blank, loop repeats infinitely. </p>
                <p><b>tempo</b>: beats per minute. used with <i>click</i> and <i>quant</i></p>
            </div>
        );
    }
}


class ChatWindow extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            'name':'your name',
            'value': '',
            'chat': [],
        };
        this.props.exposeUpdateChat(this.updateChat);
    }

    updateChat = (line) => {
        this.setState({'chat': this.state.chat.concat([<div key={this.state.chat.length}>{line}</div>])});
    }

    submitChat = (event) => {
        if(event.keyCode === 13) {
            let line = this.state.name + ':  ' + this.state.value;
            this.updateChat(line);
            this.props.sendChat(line);
            this.setState({'value': ''});
        }
    };

    typing = (event) => {this.setState({'value': event.target.value});};
    updateName = (event) => {this.setState({'name': event.target.value});};

    render() {
        return (
            <div className="chatbox">
                <div className="chatTitle">-- chat --</div>
                <div className="chatname">
                    <input type='text' className='inputFont'
                        value={this.state.name} onChange={this.updateName}
                    />
                </div>
                <div id="chat" className="chat inputFont">{this.state.chat}</div>
                <div className="chatInput">
                    <input type='text' id='chatInput' className=''
                        value={this.state.value} onChange={this.typing} 
                        onKeyDown={this.submitChat} size='25'/>
                </div>
            </div>
        );
    }
}

export {Button, DropDown, Slider, ProgressBar, LoopProgress, Instructions, ChatWindow};
