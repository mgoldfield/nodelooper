import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';


class Looper extends React.Component {
    render() {
        return (
            <div className="looper">
                <MasterLoop />
            </div>
        );
    }
}

class MasterLoop extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            "extensionVisible":false,
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
                "extensionVisible": !me.state.extensionVisible,
            });

            // me.setState({
            //     
            // });
        };
    }

    getExtensionClasses(){
        let classes = "masterExtension ";
        if (this.state.extensionVisible){
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
                    <Button name="expand" onClick={this.handleExpand()} />
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

function Button(props) {
    return (
        <div className="button" onClick={props.onClick}>
            {props.name}
        </div>
    );
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
