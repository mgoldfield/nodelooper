import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

class Looper extends React.Component {
    constructor(props){
        super(props);
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
                <MasterLoop />
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

    handleExpand(){
        let me = this;

        return () => {
            console.log("Expand was pressed");

            me.setState({
                "expanded": !me.state.expanded,
            });
        };
    }

    getExtensionClasses(){
        let classes = "masterExtension ";
        if (this.state.expanded){
            classes +=  "visibleExtension";
        }

        return classes;
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
                <div className={this.getExtensionClasses()}>
                    <Button name="click" onClick={this.handleClick} />
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
        this.state = {"value":null};
    }

    onInput(event){
        this.setState({value:event.target.value})
    }

    onChange(event){
        return;
    }

    render() {
        return (
            <div className="slider">
                <input 
                    type="range" 
                    min={this.props.min} 
                    max={this.props.max}
                    value={this.props.value}
                    onChange={this.props.onChange}
                    onInput={this.onInput}
                />
                <span name="sliderValBox">
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
