
import React from 'react';

interface SliderProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}

const Slider: React.FC<SliderProps> = ({ id, label, min, max, step, value, onChange, unit }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="flex justify-between items-center text-sm font-medium text-slate-400 mb-2">
        <span>{label}</span>
        <span className="font-semibold text-white bg-slate-700 px-2 py-1 rounded-md text-xs">
          {value.toFixed(1)} {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
      />
    </div>
  );
};

export default Slider;