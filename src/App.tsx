import { useCallback, useEffect, useMemo, useState } from "react";
import { ColorWheel } from "./components/ColorWheel";
import { PigmentPanel } from "./components/PigmentPanel";
import { ColorSlots } from "./components/ColorSlots";
import { PolygonSwatch } from "./components/PolygonSwatch";
import { loadPigments, savePigments, type Pigment } from "./lib/pigments";
import "./App.css";

const DEFAULT_COLORS = ["#FEEC00", "#002185", "#FF2702", "#076D16", "#4E0042", "#7B4800"];

function App() {
  const [pigments, setPigments] = useState<Pigment[]>(() => loadPigments());
  const [count, setCount] = useState(3);
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightness, setLightness] = useState(0.7);

  useEffect(() => {
    savePigments(pigments);
  }, [pigments]);

  const handleCountChange = useCallback((next: number) => {
    setCount(next);
    setActiveIndex((prev) => Math.min(prev, next - 1));
  }, []);

  const activeColors = useMemo(() => colors.slice(0, count), [colors, count]);

  const wheelSelectedColors = useMemo(
    () => activeColors.map((hex, i) => ({ hex, label: String(i + 1) })),
    [activeColors],
  );

  const setColorAt = (index: number, hex: string) => {
    setColors((prev) => {
      const next = [...prev];
      next[index] = hex;
      return next;
    });
  };

  const handleWheelPick = (hex: string) => {
    setColorAt(activeIndex, hex);
  };

  const handlePigmentSelect = (hex: string) => {
    setColorAt(activeIndex, hex);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Mixbox Palette Blending</h1>
        <p>
          Pick 2–6 colors and see how they mix as real pigments, using{" "}
          <a href="https://github.com/scrtwpns/mixbox" target="_blank" rel="noreferrer">
            Mixbox
          </a>
          's pigment-based blending across a polygon swatch.
        </p>
      </header>

      <main className="app-grid">
        <section className="panel wheel-panel">
          <div className="panel-header">
            <h2>OKLAB Color Wheel</h2>
          </div>
          <ColorWheel
            size={320}
            lightness={lightness}
            pigments={pigments}
            selectedColors={wheelSelectedColors}
            activeIndex={activeIndex}
            onPick={handleWheelPick}
          />
          <div className="slider-row lightness-row">
            <label htmlFor="lightness-slider">Wheel lightness: {lightness.toFixed(2)}</label>
            <input
              id="lightness-slider"
              type="range"
              min={0.1}
              max={0.95}
              step={0.01}
              value={lightness}
              onChange={(e) => setLightness(Number(e.target.value))}
            />
          </div>
          <p className="hint-text">
            Click or drag on the wheel to set color <strong>#{activeIndex + 1}</strong>. Small dots are
            your pigment library; large rings are the colors being blended.
          </p>
        </section>

        <section className="middle-column">
          <ColorSlots
            colors={colors}
            count={count}
            activeIndex={activeIndex}
            pigments={pigments}
            onCountChange={handleCountChange}
            onActiveIndexChange={setActiveIndex}
            onColorChange={setColorAt}
          />

          <div className="panel swatch-panel">
            <div className="panel-header">
              <h2>Blended Swatch</h2>
            </div>
            <PolygonSwatch colors={activeColors} size={320} />
          </div>
        </section>

        <PigmentPanel pigments={pigments} onChange={setPigments} onSelect={handlePigmentSelect} />
      </main>
    </div>
  );
}

export default App;
