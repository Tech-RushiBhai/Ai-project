export type ActiveTool = 'fade' | 'combine';

export interface Track {
    id: string;
    file: File;
    buffer: AudioBuffer;
    volume: number;
    loop: boolean;
    fadeIn: number;
    fadeOut: number;
}
