import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ActiveTool, Track } from './types';
import { loadAudioBuffer, bufferToWave, drawWaveform, createExampleAudioBuffer } from './utils/audioUtils';
import FileUpload from './components/FileUpload';
import Slider from './components/Slider';
import Loader from './components/Loader';
import { DownloadIcon, WavesIcon, GripVerticalIcon, TrashIcon, LoopIcon, InfoIcon } from './components/icons';

const Waveform = ({ buffer }: { buffer: AudioBuffer }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        // Defer the drawing to the next animation frame to break the ResizeObserver loop.
        window.requestAnimationFrame(() => {
          // Check if the canvas element is still part of the DOM.
          // The component could have been unmounted between the observer firing and the animation frame.
          if (canvasRef.current) {
            const { width, height } = entry.contentRect;
            drawWaveform(canvasRef.current, buffer, width, height, '#22d3ee');
          }
        });
      }
    });

    observer.observe(canvas);

    // Initial draw
    drawWaveform(canvas, buffer, canvas.clientWidth, canvas.clientHeight, '#22d3ee');

    return () => {
      observer.disconnect();
    };
  }, [buffer]);

  return <canvas ref={canvasRef} className="bg-slate-700/80 rounded w-[120px] sm:w-[150px] h-[40px]" />;
};


const App: React.FC = () => {
    const [activeTool, setActiveTool] = useState<ActiveTool>('fade');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const audioContextRef = useRef<AudioContext | null>(null);
    const [showInstructions, setShowInstructions] = useState(true);
    
    // Fade Tool State
    const [fadeFile, setFadeFile] = useState<File | null>(null);
    const [fadeInDuration, setFadeInDuration] = useState(2.0);
    const [fadeOutDuration, setFadeOutDuration] = useState(3.0);
    const [processedFadeUrl, setProcessedFadeUrl] = useState<string | null>(null);
    const [processedFadeBuffer, setProcessedFadeBuffer] = useState<AudioBuffer | null>(null);

    // Combine Tool State
    const [tracks, setTracks] = useState<Track[]>([]);
    const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
    const [combinedBuffer, setCombinedBuffer] = useState<AudioBuffer | null>(null);
    const draggedItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);


    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    useEffect(() => {
        const addExampleTrack = async () => {
            try {
                const audioContext = getAudioContext();
                const buffer = createExampleAudioBuffer(audioContext);
                const exampleFile = new File([""], "example-beat.wav", { type: "audio/wav" });
                const newTrack: Track = {
                    id: crypto.randomUUID(),
                    file: exampleFile,
                    buffer,
                    volume: 0.75,
                    loop: false,
                    fadeIn: 0,
                    fadeOut: 0,
                };
                setTracks([newTrack]);
            } catch (error) {
                console.error("Failed to create example audio track:", error);
            }
        };

        addExampleTrack();
    }, [getAudioContext]);

    const handleApplyFade = async () => {
        if (!fadeFile) {
            alert('Please upload an audio file first.');
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Applying fade effect...');
        try {
            const audioContext = getAudioContext();
            const originalBuffer = await loadAudioBuffer(fadeFile, audioContext);
            const duration = originalBuffer.duration;

            if (fadeInDuration + fadeOutDuration > duration) {
              alert('Total fade duration cannot exceed the audio length.');
              setIsLoading(false);
              return;
            }

            const offlineContext = new OfflineAudioContext(
                originalBuffer.numberOfChannels,
                originalBuffer.length,
                originalBuffer.sampleRate
            );

            const source = offlineContext.createBufferSource();
            source.buffer = originalBuffer;

            const gainNode = offlineContext.createGain();
            gainNode.gain.setValueAtTime(0, 0);
            gainNode.gain.linearRampToValueAtTime(1, fadeInDuration);
            gainNode.gain.setValueAtTime(1, duration - fadeOutDuration);
            gainNode.gain.linearRampToValueAtTime(0, duration);
            
            source.connect(gainNode);
            gainNode.connect(offlineContext.destination);
            source.start(0);

            const renderedBuffer = await offlineContext.startRendering();
            setProcessedFadeBuffer(renderedBuffer);

            const blob = bufferToWave(renderedBuffer);
            const url = URL.createObjectURL(blob);
            setProcessedFadeUrl(url);

        } catch (error) {
            console.error('Error applying fade:', error);
            alert('An error occurred while processing the audio.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTrackUpload = async (file: File | null) => {
        if (!file) return;
        setIsLoading(true);
        setLoadingMessage(`Loading track: ${file.name}...`);
        try {
            const audioContext = getAudioContext();
            const buffer = await loadAudioBuffer(file, audioContext);
            const newTrack: Track = {
                id: crypto.randomUUID(),
                file,
                buffer,
                volume: 0.75,
                loop: false,
                fadeIn: 0,
                fadeOut: 0,
            };
            setTracks(prev => [...prev, newTrack]);
        } catch (error) {
            console.error('Error loading audio track:', error);
            alert(`Failed to load and decode the audio file: ${file.name}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveTrack = (id: string) => {
        setTracks(prev => prev.filter(track => track.id !== id));
    };

    const handleVolumeChange = (id: string, volume: number) => {
        setTracks(prev => prev.map(track => track.id === id ? { ...track, volume } : track));
    };

    const handleFadeInChange = (id: string, fadeIn: number) => {
        setTracks(prev => prev.map(track => track.id === id ? { ...track, fadeIn } : track));
    };

    const handleFadeOutChange = (id: string, fadeOut: number) => {
        setTracks(prev => prev.map(track => track.id === id ? { ...track, fadeOut } : track));
    };

    const handleToggleLoop = (id: string) => {
        setTracks(prev => prev.map(track => track.id === id ? { ...track, loop: !track.loop } : track));
    };
    
    const handleCombineTracks = async () => {
        if (tracks.length < 1) {
            alert('Please add at least one track to process.');
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Combining audio tracks...');
        try {
            const audioContext = getAudioContext();
            const maxDuration = Math.max(...tracks.map(t => t.buffer.duration));
            
            for (const track of tracks) {
                const duration = track.loop ? maxDuration : track.buffer.duration;
                const fadeIn = Math.max(0, track.fadeIn);
                const fadeOut = Math.max(0, track.fadeOut);
                if (fadeIn + fadeOut > duration) {
                    alert(`For track "${track.file.name}", the combined fade-in and fade-out durations (${(fadeIn + fadeOut).toFixed(1)}s) exceed the track's effective duration (${duration.toFixed(1)}s). Please adjust the fade times.`);
                    setIsLoading(false);
                    return;
                }
            }

            const offlineContext = new OfflineAudioContext(2, Math.ceil(audioContext.sampleRate * maxDuration), audioContext.sampleRate);

            tracks.forEach(track => {
                const source = offlineContext.createBufferSource();
                source.buffer = track.buffer;
                if (track.loop) {
                    source.loop = true;
                }
                
                const gainNode = offlineContext.createGain();
                const duration = track.loop ? maxDuration : track.buffer.duration;
                const fadeIn = Math.max(0, track.fadeIn);
                const fadeOut = Math.max(0, track.fadeOut);
                const fadeOutStartTime = duration - fadeOut;

                gainNode.gain.setValueAtTime(0, 0);
                gainNode.gain.linearRampToValueAtTime(track.volume, fadeIn);
                gainNode.gain.setValueAtTime(track.volume, fadeOutStartTime);
                gainNode.gain.linearRampToValueAtTime(0, duration);

                source.connect(gainNode);
                gainNode.connect(offlineContext.destination);
                source.start(0);
            });
            
            const combined = await offlineContext.startRendering();
            setCombinedBuffer(combined);
            const blob = bufferToWave(combined);
            const url = URL.createObjectURL(blob);
            setCombinedUrl(url);

        } catch (error) {
            console.error('Error combining tracks:', error);
            alert('An error occurred while combining the audio tracks.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = useCallback((buffer: AudioBuffer | null, baseFileName: string) => {
        if (!buffer) return;
        const blob = bufferToWave(buffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${baseFileName}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const handleDragSort = () => {
        if (draggedItem.current === null || dragOverItem.current === null) return;
        const tracksCopy = [...tracks];
        const draggedItemContent = tracksCopy.splice(draggedItem.current, 1)[0];
        tracksCopy.splice(dragOverItem.current, 0, draggedItemContent);
        draggedItem.current = null;
        dragOverItem.current = null;
        setTracks(tracksCopy);
    };

    const renderFadeTool = () => (
        <div className="space-y-6">
            <FileUpload id="fade-file" label="Upload Audio" onFileSelect={setFadeFile} fileName={fadeFile?.name || null} />
            <Slider id="fade-in" label="Fade In Duration" min={0} max={10} step={0.1} value={fadeInDuration} onChange={setFadeInDuration} unit="s" />
            <Slider id="fade-out" label="Fade Out Duration" min={0} max={10} step={0.1} value={fadeOutDuration} onChange={setFadeOutDuration} unit="s" />
            <button onClick={handleApplyFade} disabled={isLoading || !fadeFile} className="w-full bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-fuchsia-500 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center active:scale-[0.98]">
                Apply Effects
            </button>
            {processedFadeUrl && (
                <div className="mt-6 p-4 bg-slate-800/70 rounded-lg [animation:fadeInUp_0.5s_ease-out]">
                    <h3 className="font-semibold mb-3 text-lg text-white">Result</h3>
                    <audio controls src={processedFadeUrl} className="w-full"></audio>
                    <button onClick={() => handleDownload(processedFadeBuffer, fadeFile?.name || 'audio')} className="w-full mt-3 bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                        <DownloadIcon className="w-5 h-5" />
                        Download WAV
                    </button>
                </div>
            )}
        </div>
    );
    
    const renderCombineTool = () => (
        <div className="space-y-6">
            <div className="space-y-4">
                {tracks.length > 0 ? (
                    tracks.map((track, index) => (
                        <div
                            key={track.id}
                            draggable
                            onDragStart={() => (draggedItem.current = index)}
                            onDragEnter={() => (dragOverItem.current = index)}
                            onDragEnd={handleDragSort}
                            onDragOver={(e) => e.preventDefault()}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-700/60 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:bg-slate-700 [animation:fadeInUp_0.5s_ease-out]"
                        >
                            <div className="flex items-center self-start sm:self-center shrink-0">
                                <GripVerticalIcon className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="flex items-center justify-start gap-3 w-full sm:w-auto">
                                <Waveform buffer={track.buffer} />
                                <p className="sm:hidden flex-1 font-medium text-slate-200 truncate" title={track.file.name}>{track.file.name}</p>
                            </div>

                            <div className="flex-grow w-full min-w-0">
                                <p className="hidden sm:block text-sm font-medium text-slate-200 truncate" title={track.file.name}>{track.file.name}</p>
                                <div className="space-y-3 mt-2">
                                    <Slider id={`vol-${track.id}`} label="Volume" min={0} max={1.5} step={0.05} value={track.volume} onChange={(v) => handleVolumeChange(track.id, v)} unit="x" />
                                    <div className="flex flex-col md:flex-row gap-x-4 gap-y-3">
                                        <Slider id={`fin-${track.id}`} label="Fade In" min={0} max={10} step={0.1} value={track.fadeIn} onChange={(v) => handleFadeInChange(track.id, v)} unit="s" />
                                        <Slider id={`fout-${track.id}`} label="Fade Out" min={0} max={10} step={0.1} value={track.fadeOut} onChange={(v) => handleFadeOutChange(track.id, v)} unit="s" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center self-end sm:self-center shrink-0">
                                <button 
                                    onClick={() => handleToggleLoop(track.id)} 
                                    className={`p-2 rounded-full hover:bg-slate-600/50 transition-colors ${track.loop ? 'text-cyan-400' : 'text-slate-400'}`}
                                    title={track.loop ? 'Disable loop' : 'Enable loop'}
                                >
                                    <LoopIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleRemoveTrack(track.id)} className="p-2 rounded-full hover:bg-slate-600/50 text-slate-400 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <p>Your tracklist is empty.</p>
                        <p className="text-sm">Add some audio files to get started.</p>
                    </div>
                )}
            </div>

            <FileUpload id="add-track" label="Add a Track" onFileSelect={handleTrackUpload} fileName={null} />
            
            <button onClick={handleCombineTracks} disabled={isLoading || tracks.length === 0} className="w-full bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-fuchsia-500 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed active:scale-[0.98]">
                Combine Tracks
            </button>
            {combinedUrl && (
                <div className="mt-6 p-4 bg-slate-800/70 rounded-lg [animation:fadeInUp_0.5s_ease-out]">
                    <h3 className="font-semibold mb-3 text-lg text-white">Result</h3>
                    <audio controls src={combinedUrl} className="w-full"></audio>
                    <button onClick={() => handleDownload(combinedBuffer, 'combined_track')} className="w-full mt-3 bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                        <DownloadIcon className="w-5 h-5" />
                        Download WAV
                    </button>
                </div>
            )}
        </div>
    );


    return (
        <div className="min-h-screen text-slate-200 flex flex-col items-center p-4 sm:p-6 lg:p-10">
            <div className="w-full max-w-4xl mx-auto [animation:fadeInUp_0.5s_ease-out]">
                <header className="text-center mb-10">
                    <div className="flex items-center justify-center gap-3">
                        <WavesIcon className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400"/>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Audio Editor Pro</h1>
                    </div>
                    <p className="mt-3 text-sm sm:text-base text-slate-400">Simple audio tools, right in your browser.</p>
                </header>

                <div className="mb-8 p-4 sm:p-6 bg-slate-800/50 rounded-xl border border-slate-700 [animation:fadeInUp_0.4s_ease-out]">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
                        <div className="flex items-center gap-3">
                            <InfoIcon className="w-6 h-6 text-cyan-400" />
                            <h2 className="font-bold text-xl text-white">How It Works</h2>
                        </div>
                        <button className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
                            {showInstructions ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    {showInstructions && (
                        <div className="mt-4 space-y-4 text-slate-400 text-sm [animation:fadeInUp_0.3s_ease-out]">
                            <p>Welcome, audio adventurer! Ready to craft your masterpiece? Here's your mission guide for our two powerful tools.</p>
                            <div className="grid md:grid-cols-2 gap-6 pt-2">
                                <div>
                                    <h3 className="font-semibold text-base text-slate-200 mb-2">Fade Tool</h3>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Upload a single audio file.</li>
                                        <li>Adjust the <span className="font-semibold text-fuchsia-400">Fade In</span> and <span className="font-semibold text-fuchsia-400">Fade Out</span> sliders.</li>
                                        <li>Hit 'Apply Effects' to process your audio.</li>
                                        <li>Preview the result and download your new WAV file.</li>
                                    </ol>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base text-slate-200 mb-2">Combine Tool</h3>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Add multiple audio tracks to the tracklist.</li>
                                        <li>Drag &amp; drop tracks to reorder them.</li>
                                        <li>Fine-tune each track's volume, fades, and loop settings.</li>
                                        <li>Click 'Combine Tracks' to merge everything.</li>
                                        <li>Listen to the final mix and download your creation.</li>
                                    </ol>
                                </div>
                            </div>
                            <p className="text-xs pt-2 text-slate-500">
                                <span className="font-semibold">Pro Tip:</span> We've pre-loaded an example beat in the 'Combine Tool' to get you started. Feel free to use it or delete it!
                            </p>
                        </div>
                    )}
                </div>

                <main>
                    <div className="mb-8">
                        <div className="flex border-b border-slate-700">
                            <button
                                onClick={() => setActiveTool('fade')}
                                className={`flex-1 sm:flex-initial px-4 sm:px-6 py-3 font-medium text-lg transition-colors ${activeTool === 'fade' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                Fade Tool
                            </button>
                            <button
                                onClick={() => setActiveTool('combine')}
                                className={`flex-1 sm:flex-initial px-4 sm:px-6 py-3 font-medium text-lg transition-colors ${activeTool === 'combine' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                Combine Tool
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 sm:p-6 lg:p-8 rounded-xl shadow-2xl shadow-black/30 relative border border-slate-700">
                        {isLoading && <Loader message={loadingMessage} />}
                        <div key={activeTool} className="[animation:fadeInUp_0.3s_ease-out]">
                            {activeTool === 'fade' ? renderFadeTool() : renderCombineTool()}
                        </div>
                    </div>
                </main>
                
                <footer className="text-center mt-10 text-slate-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Audio Editor Pro. All Rights Reserved.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
