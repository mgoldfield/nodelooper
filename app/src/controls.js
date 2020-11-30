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
        if (this.props.updateVal)
            this.props.updateVal((v) => this.setState({'value':v}));
    }

    onChange = (e) => {
        this.setState({'value':e.target.value});
        this.props.onChange(e)
    }

    showVal = () => {
        if (this.props.showVal) 
            return Math.round(this.state.value * 100) / 100
        else 
            return " "
    }

    handleChange = (e) => {
        let onSliderEnd = () => { // this is so it doesn't fire a bazillion change events per slide
            if (this.changingVal == this.state.value){
                if (this.props.broadcast)
                    this.props.broadcast();
                this.changingVal = null;
            }else{
                this.changingVal = this.state.value;
                setTimeout(() => onSliderEnd(), 200);
            }
        }

        this.setState({'value': e.target.value});
        this.props.onChange(e.target.value);
        if (!this.changingVal){
            onSliderEnd();
        }
    }

    render() {
        return (
            <div className='slider'>
                <div className='sliderTitle'>{this.props.name} {this.showVal()}</div>
                <input 
                    className='sliderInput'
                    type='range' 
                    min={this.props.min} 
                    max={this.props.max}
                    value={this.state.value}
                    step={(this.props.step) ? this.props.step : 1}
                    onChange={this.handleChange}
                    onInput={(e) => this.setState({'value':e.target.value})}
                />
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
        this.props.updater((v) => {
            this.setState({'value':v, 'max':Math.max(this.state.max, 4 * v)});
            this.props.coordinateBars(v);
        });
        this.props.getVal(() => parseFloat(this.state.value));
        this.props.setMax((v) => this.setState({'max':Math.max(this.state.max, 4 * v)}))
    }

    onChange(event){
        return;
    }

    toMinutes(t){
        let m = Math.floor(t / 60);
        return m.toString() + ":" + Math.floor(t - (m * 60)).toString().padStart(2, '0');
    }

    setValue(v) {
        if (this.props.quantize){
            v = Math.round(v / this.props.secondsPerBeat) * this.props.secondsPerBeat;
        }
        this.props.coordinateBars(v);
        this.setState({'value':v});
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
                    onInput={(e) => {
                        this.setValue(e.target.value); 
                    }}
                />
                <span className='progressBarVal'>
                    {this.toMinutes(this.state.value) + '/' + this.toMinutes(this.state.max)}
                </span>
            </div>

        );
    }
}

class LoopProgress extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            'progress': 0, // percent
            'buffer': this.props.audioLoop.buffer,
        };
        this.canvasRef = React.createRef(null);
    }

    render() {
        return (
            <div className="loopProgress">
                <canvas className="loopProgressWaveform" ref={this.canvasRef}></canvas>
                <span className="loopProgressBar" style={{width: 100*this.state.progress + '%'}} />
            </div>
        );
    }

    componentDidMount() {
        const canvas = this.canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        this.drawWaveform();
        this.props.audioLoop.onProgress = p => this.setState({progress: p});
        this.props.audioLoop.onNewBuffer = b => this.setState({buffer: b});
    }

    componentWillUnmount() {
        this.props.audioLoop.onProgress = null;
        this.props.audioLoop.onNewBuffer = null;
    }

    componentDidUpdate() {
        this.drawWaveform();
    }

    drawWaveform() {
        const buffer = this.state.buffer;
        if (!buffer) return;
        if (buffer === this.renderedBuffer) return;

        this.renderedBuffer = buffer;

        const canvas = this.canvasRef.current;
        const context = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const mid = height / 2;
        const samples = buffer.getChannelData(0); // TODO stereo
        const framesPerPoint = Math.max(samples.length / width, 1);
        const pixelStride = Math.max(width / samples.length, 1);
        context.clearRect(0, 0, width, height);
        context.beginPath();
        context.moveTo(0, mid);
        let prevY = 0;
        for (   let x = pixelStride / 2, frame = 0;
                x < width;
                x += pixelStride, frame += framesPerPoint) {
            let min = null, max = null;
            for (let i = 0; i < framesPerPoint; i++) {
                const val = samples[Math.round(frame + i)];
                if (min === null || val < min) min = val;
                if (max === null || val > max) max = val;
            }
            let y;
            if (min === null) y = max;
            else if (max === null) y = min;
            else if (prevY < 0) y = max;
            else y = min;
            context.lineTo(x, y*mid + mid);
            prevY = y;
        }
        context.strokeStyle = 'blue';
        context.lineWidth = 2;
        context.stroke();
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
                <p><b>quant</b>: quantizes loops to the nearest measure, as defined by <i>tempo</i> and <i>bmp</i>. if quant is selected, main progress bar snaps to the beat</p>
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
        // this is kinda gross...
        this.setState({'chat': [<div key={this.state.chat.length}><b>{line.split(':::')[0]}:</b>{line.split(':::')[1]}</div>].concat(this.state.chat)});
    }

    submitChat = (event) => {
        if(event.keyCode === 13) {
            let line = this.state.name + '::: ' + this.state.value;
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
