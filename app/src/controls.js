import React from 'react';

class Button extends React.Component {
    classes(){
        let extraClasses = {
            'expand': ['downarrow'],
            'collapse': ['uparrow'],
        }

        let classList = ['button'].concat(extraClasses[this.props.name] || []);
        if (this.props.toggled) classList.push('toggled');
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

    render() {
        return (
            <div className={this.classes()} onClick={this.props.onClick}>
                {(this.hideText(this.props.name)) ? '' : this.props.name}
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
        this.props.updater((v) => this.setState({'value':v, 'max':Math.max(this.state.max, v * 4)}));
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


export {Button, Slider, ProgressBar};
