import React from 'react';

class Button extends React.Component {
    classes(){
        let extraClasses = {
            'expand': ['downarrow'],
            'collapse': ['uparrow'],
        }

        let classList = ['button'].concat(extraClasses[this.props.name] || []);
        if (this.props.toggled) classList.push('toggled');

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


export {Button, Slider};
