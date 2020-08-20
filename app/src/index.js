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
                    updateLooperState = {(u) => {this.setState(u)}}
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
        }
    }

    handleStop(){
        return;
    }

    handlePlay(){
        return;
    }

    handleRec(){
        return;
    }

    handleSlider(){
        return;
    }

    handleExpand(){
        return () => {
            this.setState({
                "expanded": !this.state.expanded,
            });
        };
    }

    render() {
        return (
            <div className="masterLoop">
                <div className="mainMasterLoop"> 
                    <Button name="stop" onClick={this.handleStop} />
                    <Button name="play" onClick={this.handlePlay} />
                    <Button name="rec" onClick={this.handleRec} />
                    <Button 
                        name={(this.state.expanded) ? "collapse" : "expand"}
                        onClick={this.handleExpand()} 
                    />
                </div>
                <div className={"masterExtension ".concat((this.state.expanded) ? "visibleExtension" : "")}>
                    <Button name="turn click on" onClick={this.handleClick} />
                    <Slider name="tempo" min="30" max="200" value="60" onChange={this.handleSlider} />
                </div>
            </div>
        );
    }
}


class Loop extends React.Component {
    handlePlay(){
        return;
    }

    handleStop(){
        return;
    }

    render() {
        return (
            <div className="loop"> 
                <Button name="stop" onClick={this.handleStop} />
                <Button name="play" onClick={this.handlePlay} />
            </div>
        );
    }
}

class Button extends React.Component {

    classes(name){
        let extraClasses = {
            "expand": ["downarrow"],
            "collapse": ["uparrow"],
        }

        let classList = ["button"].concat(extraClasses[name] || []);
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
            <div className={this.classes(this.props.name)} onClick={this.props.onClick}>
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
                    onInput={(e) => {this.setState({"value":e.target.value})}}
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
