export const loadAudioBuffer = (file: File, audioContext: AudioContext): Promise<AudioBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        audioContext.decodeAudioData(
          event.target.result,
          (buffer) => resolve(buffer),
          (error) => reject(new Error('Error decoding audio data: ' + error.message))
        );
      } else {
        reject(new Error('Failed to read file as ArrayBuffer.'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file.'));
    reader.readAsArrayBuffer(file);
  });
};

export const drawWaveform = (
    canvas: HTMLCanvasElement,
    buffer: AudioBuffer,
    width: number,
    height: number,
    color: string
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) {
                min = datum;
            }
            if (datum > max) {
                max = datum;
            }
        }
        
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
};


const writeString = (view: DataView, offset: number, string: string): void => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array): void => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

export const bufferToWave = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    result = new Float32Array(left.length + right.length);
    for (let i = 0, j = 0; i < left.length; i++) {
      result[j++] = left[i];
      result[j++] = right[i];
    }
  } else {
    result = buffer.getChannelData(0);
  }

  const dataLength = result.length * (bitDepth / 8);
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  
  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);

  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write the PCM data
  floatTo16BitPCM(view, 44, result);

  return new Blob([view], { type: 'audio/wav' });
};

export const createExampleAudioBuffer = (audioContext: AudioContext): AudioBuffer => {
    const sampleRate = audioContext.sampleRate;
    const duration = 2; // 2 seconds
    const frameCount = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    const createKick = (startFrame: number) => {
        const kickFrequency = 150;
        const frequencyDrop = 100;
        const kickLength = sampleRate * 0.1;

        for (let i = 0; i < kickLength; i++) {
            if (startFrame + i < frameCount) {
                const progress = i / kickLength;
                const currentFrequency = kickFrequency - (frequencyDrop * progress * progress);
                const amplitude = (1 - progress) * 0.9;
                data[startFrame + i] += Math.sin(i / sampleRate * 2 * Math.PI * currentFrequency) * amplitude;
            }
        }
    };

    createKick(0);
    createKick(Math.floor(sampleRate * 0.5));
    createKick(Math.floor(sampleRate * 1.0));
    createKick(Math.floor(sampleRate * 1.5));

    return buffer;
};