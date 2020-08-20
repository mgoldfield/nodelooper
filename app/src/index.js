import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

class Looper extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            "recording": false,
            "playing": false,
        }
        this.loops = []
    }

    renderLoops(){
        // toDo: make this smarter
        let toReturn = []
        for (const e of this.loops){
            toReturn.push(<Loop />)
        }

        return toReturn;
    }

    render() {
        return (
            <div className="looper">
                <MasterLoop 
                    recording = {this.state.recording}
                    playing = {this.state.playing}
                    updateLooperState = {(u) => this.setState(u)}
                />
                {this.renderLoops()}

            </div>
        );
    }
}

class MasterLoop extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            "expanded": false,
            "recording": false,
            "playing": false,
            "clicking": false,
            "tempo": 60,
        }

        this.handleStop = () => null;
        this.handlePlay = () => {
            this.setState({'playing': !this.state.playing});
        }
        this.handleRec = () => {
            this.setState({'recording': !this.state.recording});
        }
    }

    handlePlay(){

    }

    render() {
        return (
            <div className="masterLoop">
                <div className="mainMasterLoop"> 
                    <Button name="stop" onClick={this.handleStop} />
                    <Button name="play" onClick={this.handlePlay} toggled={this.state.playing} />
                    <Button name="rec" onClick={this.handleRec} toggled={this.state.recording} />
                    <Button 
                        name={(this.state.expanded) ? "collapse" : "expand"}
                        onClick={() => this.setState({"expanded": !this.state.expanded})} 
                    />
                </div>
                <div className={"masterExtension ".concat((this.state.expanded) ? "visibleExtension" : "")}>
                    <Button name="turn click on" onClick={this.handleClick} toggled={this.state.clicking} />
                    <Slider 
                        name="tempo" min="30" max="200" 
                        value={this.state.tempo} 
                        onChange={(e) => this.setState({"tempo": e.target.value})}
                    />
                </div>
            </div>
        );
    }
}


class Loop extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            "name": "loop name",
            "muted": false,
        }
    }

    handleClick(){
        return;
    }

    render() {
        return (
            <div className="loop"> 
                <input type="text" value={this.state.name} />
                <Button name="mute" onClick={this.handleMute()} toggled={this.state.muted}/>
            </div>
        );
    }
}

class Button extends React.Component {

    classes(){
        let extraClasses = {
            "expand": ["downarrow"],
            "collapse": ["uparrow"],
        }

        let classList = ["button"].concat(extraClasses[this.props.name] || []);
        if (this.props.toggled) classList.push("toggled");

        return classList.join(' ');
    }

    hideText(name){
        let hide = {
            "expand": true,
            "collapse": true,
        }

        return hide[name] || false;
    }

    render() {
        return (
            <div className={this.classes()} onClick={this.props.onClick}>
                {(this.hideText(this.props.name)) ? "" : this.props.name}
            </div>
        );
    }
}

class Slider extends React.Component {
    constructor(props){
        super(props);
        this.state = {"value":this.props.value};
    }

    onChange(event){
        return;
    }

    render() {
        return (
            <div className="slider">
                <div className="sliderTitle">{this.props.name}</div>
                <input 
                    className="sliderInput"
                    type="range" 
                    min={this.props.min} 
                    max={this.props.max}
                    value={this.state.value}
                    onChange={this.props.onChange}
                    onInput={(e) => this.setState({"value":e.target.value})}
                />
                <span className="sliderValBox">
                    {this.state.value}
                </span>
            </div>

        );
    }
}

// ========================================

ReactDOM.render(
    <Looper />,
    document.getElementById('root')
);
