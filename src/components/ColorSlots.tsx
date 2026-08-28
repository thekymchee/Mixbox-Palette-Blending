import { useEffect, useRef, useState } from "react";
import type { Pigment } from "../lib/pigments";
import { isValidHex, normalizeHex } from "../lib/color";

interface ColorSlotsProps {
  colors: string[];
  count: number;
  activeIndex: number;
  pigments: Pigment[];
  onCountChange: (count: number) => void;
  onActiveIndexChange: (index: number) => void;
  onColorChange: (index: number, hex: string) => void;
}

const POLYGON_NAMES: Record<number, string> = {
  2: "Line",
  3: "Triangle",
  4: "Diamond",
  5: "Pentagon",
  6: "Hexagon",
};

export function ColorSlots({
  colors,
  count,
  activeIndex,
  pigments,
  onCountChange,
  onActiveIndexChange,
  onColorChange,
}: ColorSlotsProps) {
  return (
    <div className="panel color-slots-panel">
      <div className="slider-row">
        <label htmlFor="color-count">
          Colors to blend: <strong>{count}</strong> ({POLYGON_NAMES[count]})
        </label>
        <input
          id="color-count"
          type="range"
          min={2}
          max={6}
          step={1}
          value={count}
          onChange={(e) => onCountChange(Number(e.target.value))}
        />
      </div>

      <ul className="color-slot-list">
        {colors.slice(0, count).map((hex, i) => (
          <ColorSlotRow
            key={i}
            index={i}
            hex={hex}
            isActive={i === activeIndex}
            pigments={pigments}
            onFocus={() => onActiveIndexChange(i)}
            onColorChange={(newHex) => onColorChange(i, newHex)}
          />
        ))}
      </ul>
    </div>
  );
}

interface ColorSlotRowProps {
  index: number;
  hex: string;
  isActive: boolean;
  pigments: Pigment[];
  onFocus: () => void;
  onColorChange: (hex: string) => void;
}

function ColorSlotRow({ index, hex, isActive, pigments, onFocus, onColorChange }: ColorSlotRowProps) {
  const [draft, setDraft] = useState(hex);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Keep the text field in sync when the color changes from elsewhere
    // (the wheel, a pigment pick) while this input isn't being typed in.
    if (document.activeElement !== inputRef.current) setDraft(hex);
  }, [hex]);

  const commitDraft = () => {
    if (isValidHex(draft)) onColorChange(normalizeHex(draft));
    else setDraft(hex);
  };

  return (
    <li className={`color-slot-row${isActive ? " active" : ""}`} onClick={onFocus}>
      <span className="color-slot-index">{index + 1}</span>
      <span className="color-slot-swatch" style={{ backgroundColor: hex }} />
      <input
        ref={inputRef}
        type="text"
        className="hex-input"
        value={draft}
        onFocus={onFocus}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <select
        className="pigment-select"
        value=""
        onFocus={onFocus}
        onChange={(e) => {
          if (e.target.value) onColorChange(e.target.value);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          Pigment…
        </option>
        {pigments.map((p) => (
          <option key={p.id} value={p.hex}>
            {p.name}
          </option>
        ))}
      </select>
    </li>
  );
}
