const lamejs = require("lamejs");

function downloadBlob(filename, blob){
    let tmp = document.createElement('a');
    tmp.style = "display: none";
    document.body.appendChild(tmp);
    let url = window.URL.createObjectURL(blob);
    tmp.href = url;
    tmp.download = filename;
    tmp.click();
    //document.body.removeChild(tmp);
    //setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function float32_to_int16(f32){
    function convert(n, max) {
        let v = n < 0 ? n * 32768 : n * 32767;       // convert in range [-32768, 32767]
        return v / max; // scale
    }

    let retArr = new Int16Array(f32.length);

    let max = 1;
    for (let i=0; i < f32.length; i++)
        if (Math.abs(f32[i]) > max)
            max = Math.abs(f32[i]);

    for (let i=0; i < f32.length; i++)
        retArr[i] = convert(f32[i], max);
    return retArr;
}

let bufferToMp3 = (buff) => {
    return new Promise(async (resolve, reject) => {
        let mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
        let mp3Data = [];

        let left = float32_to_int16(buff.getChannelData(0)); 
        let right = float32_to_int16(buff.getChannelData(1));
        let sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier

        for (let i = 0; i < buff.length; i += sampleBlockSize) {
            let leftChunk = left.subarray(i, i + sampleBlockSize);
            let rightChunk = right.subarray(i, i + sampleBlockSize);
            let mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }
        let mp3buf = mp3encoder.flush();   //finish writing mp3

        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        let blob = new Blob(mp3Data),
            arrbuff = new Uint8Array(await blob.arrayBuffer());
            
        const base64 = arrbuff.map(byte => byte.toString(16)).join('')
       //downloadBlob('new.mp3', blob);

        resolve(base64);
    });
};

function debugWav(view){
    console.log("RIFF - dec:%s, hex:%s", view.getUint32(0, true).toString(), view.getUint32(0, true).toString(16));
    console.log("length - 8 - dec:%s, hex:%s", view.getUint32(4, true).toString(), view.getUint32(4, true).toString(16));
    console.log("WAVE - dec:%s, hex:%s", view.getUint32(8, true).toString(), view.getUint32(8, true).toString(16));
    console.log("fmt - dec:%s, hex:%s", view.getUint32(12, true).toString(), view.getUint32(12, true).toString(16));
    console.log("16 - dec:%s, hex:%s", view.getUint32(16, true).toString(), view.getUint32(16, true).toString(16));
    console.log("1 - dec:%s, hex:%s", view.getUint16(20, true).toString(), view.getUint16(20, true).toString(16));
    console.log("num channels - dec:%s, hex:%s", view.getUint16(22, true).toString(), view.getUint16(22, true).toString(16));
    console.log("sample rate - dec:%s, hex:%s", view.getUint32(24, true).toString(), view.getUint32(24, true).toString(16));
    console.log("bytes / sec - dec:%s, hex:%s", view.getUint32(28, true).toString(), view.getUint32(28, true).toString(16));
    console.log("block size - dec:%s, hex:%s", view.getUint16(32, true).toString(), view.getUint16(32, true).toString(16));
    console.log("bits per sample - dec:%s, hex:%s", view.getUint16(34, true).toString(), view.getUint16(34, true).toString(16));
    console.log("data - dec:%s, hex:%s", view.getUint32(36, true).toString(), view.getUint32(36, true).toString(16));
    console.log("data length - dec:%s, hex:%s", view.getUint32(40, true).toString(), view.getUint32(40, true).toString(16));
}

function wavToBuffer(arraybuff, ac, debug=false){
    let view = new DataView(arraybuff),
        numChannels = view.getUint16(22, true),
        bytesPerSample = view.getUint16(34, true) / 8,
        sampleRate = view.getUint32(24, true),
        totalSamples = view.getUint32(40, true) / (bytesPerSample * 8),
        samplesPerChannel = totalSamples / numChannels;

    if (debug){
        console.log("data view length: %s bytes", view.byteLength);
        console.log("samplesPerChannel: %s", samplesPerChannel);
        console.log("bytesPerSample: %s", bytesPerSample);
        console.log("sampleRate: %s", sampleRate);
        console.log("totalSamples: %s", totalSamples);
        console.log("numChannels: %s", numChannels);
        debugWav(view);
    }

    if (numChannels > 2) throw Error("Audio must be mono or stereo, " + numChannels.toString() + " channels detected...");
    if (![1,2,4].includes(bytesPerSample)) throw Error("unexpected byte rate: " + bytesPerSample.toString());

    let getters = {
        1: (v) => view.getInt8(v, true),
        2: (v) => view.getInt16(v, true),
        4: (v) => view.getInt32(v, true)
    };
    
    let getSample = getters[bytesPerSample],
        pos = 44,
        channels = [],
        counter = 0,
        normalizeBy = Math.pow(2, bytesPerSample * 8 - 1);

    if (debug)
        console.log("normalizeBy: %s", normalizeBy )

    for (let i=0; i < numChannels; i++)
        channels.push(new Float32Array(samplesPerChannel));

    while (counter < samplesPerChannel){
        for (let i=0; i < numChannels; i++){
            channels[i][counter] = getSample(pos) / normalizeBy;
            pos += bytesPerSample;
        }
        counter++;
    }

    let newBuff = ac.createBuffer(numChannels, samplesPerChannel, sampleRate);
    for (let i=0; i < numChannels; i++){
        newBuff.copyToChannel(channels[i], i, 0);
    }
    console.log(newBuff);
    return newBuff;

}


// Convert a audio-buffer segment to a Blob using WAVE representation
// with help from https://stackoverflow.com/questions/29584420/how-to-manipulate-the-contents-of-an-audio-tag-and-create-derivative-audio-tags/30045041#30045041
function bufferToWav(buff, debug=false) {

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    };

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    };  

    function setInt16(data ){
        view.setInt16(pos, data, true);
        pos += 2;
    }

    let numOfChan = buff.numberOfChannels,                                          // 2 channels
        bytesPerSample = 2,                                 
        length = buff.length * bytesPerSample * numOfChan + 44,
        newBuff = new ArrayBuffer(length),
        view = new DataView(newBuff),
        channels = [], i,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                                                          // "RIFF"
    setUint32(length - 8);                                                          // file length - 8
    setUint32(0x45564157);                                                          // "WAVE"

    setUint32(0x20746d66);                                                          // "fmt " chunk
    setUint32(16);                                                                  // length = 16
    setUint16(1);                                                                   // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buff.sampleRate);
    setUint32(buff.sampleRate * bytesPerSample * numOfChan);                        // avg. bytes/sec
    setUint16(numOfChan * bytesPerSample);                                          // block-align
    setUint16(8 * bytesPerSample);                                                  // 16-bit 

    setUint32(0x61746164);                                                          // "data" - chunk
    setUint32(buff.length * numOfChan * bytesPerSample * 8);                        // chunk length

    // write interleaved data
    for(i = 0; i < buff.numberOfChannels; i++)
        channels.push(buff.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {                                            // interleave channels
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));            // clamp in [-1,1]
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;        // scale to 16-bit signed int
            setInt16(sample);                                                       // update data chunk
        }
        offset++                                                                    // next source sample
    }

    if (debug){
        debugWav(view);
        console.log("numberOfChannels: %s", buff.numberOfChannels);
        console.log("bytesPerSample: %s", bytesPerSample);
        console.log("buff length: %s", buff.length);
    }

    // create Blob
    return new Blob([newBuff], {type: "audio/wav"});
}

export { bufferToWav, bufferToMp3, wavToBuffer, downloadBlob };
