
import React from 'react';

const Loader = ({ message }: { message: string }) => (
  <div className="absolute inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-50 rounded-lg">
    <div className="flex items-center justify-center space-x-1.5 h-12">
        <div className="w-1.5 h-8 bg-fuchsia-500 rounded-full [animation:equalizer-bar_1s_ease-in-out_infinite] [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-8 bg-fuchsia-500 rounded-full [animation:equalizer-bar_1s_ease-in-out_infinite] [animation-delay:-0.2s]"></div>
        <div className="w-1.5 h-8 bg-fuchsia-500 rounded-full [animation:equalizer-bar_1s_ease-in-out_infinite] [animation-delay:-0.1s]"></div>
        <div className="w-1.5 h-8 bg-fuchsia-500 rounded-full [animation:equalizer-bar_1s_ease-in-out_infinite]"></div>
    </div>
    <p className="mt-4 text-slate-300 font-medium">{message}</p>
  </div>
);

export default Loader;