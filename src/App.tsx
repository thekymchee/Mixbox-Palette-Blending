import { useCallback, useEffect, useMemo, useState } from "react";
import { ColorWheel } from "./components/ColorWheel";
import { ColorPlane } from "./components/ColorPlane";
import { PigmentPanel, type PigmentTab } from "./components/PigmentPanel";
import { ColorSlots } from "./components/ColorSlots";
import { PolygonSwatch, type GridMode } from "./components/PolygonSwatch";
import { tintRangeForColors } from "./lib/tint";
import { loadPigments, savePigments, type Pigment } from "./lib/pigments";
import { WINSOR_NEWTON_PIGMENTS } from "./lib/winsorNewtonPigments";
import { colorsCentroidAB } from "./lib/color";
import "./App.css";

const DEFAULT_COLORS = ["#FEEC00", "#002185", "#FF2702", "#076D16", "#4E0042", "#7B4800"];
type WheelView = "circle" | "plane";

function App() {
  const [pigments, setPigments] = useState<Pigment[]>(() => loadPigments());
  const [count, setCount] = useState(3);
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightness, setLightness] = useState(0.75);
  const [steps, setSteps] = useState(5);
  const [gridMode, setGridMode] = useState<GridMode>("squares");
  const [rawTint, setRawTint] = useState(() => tintRangeForColors(colors.slice(0, count)).pure);
  const [wheelView, setWheelView] = useState<WheelView>("circle");
  const [pigmentTab, setPigmentTab] = useState<PigmentTab>("mine");

  const visiblePigments = pigmentTab === "mine" ? pigments : WINSOR_NEWTON_PIGMENTS;

  useEffect(() => {
    savePigments(pigments);
  }, [pigments]);

  const handleCountChange = useCallback((next: number) => {
    setCount(next);
    setActiveIndex((prev) => Math.min(prev, next - 1));
  }, []);

  const activeColors = useMemo(() => colors.slice(0, count), [colors, count]);

  // How many Tints steps it actually takes the slowest-converging selected
  // pigment to round to solid black, and separately to white - recomputed
  // whenever the palette changes, instead of a fixed step count for every
  // palette.
  const tintRange = useMemo(() => tintRangeForColors(activeColors), [activeColors]);
  // Clamped at read time rather than written back into state, so a range
  // that later grows again (e.g. switching palettes back and forth) can
  // restore the original position instead of it having been lost.
  const tint = Math.min(rawTint, tintRange.max);

  const wheelSelectedColors = useMemo(
    () => activeColors.map((hex, i) => ({ hex, label: String(i + 1) })),
    [activeColors],
  );

  // Same geometric-center point the OKLab plane plots (a plain average of
  // the selected colors' OKLab a/b) - independent of which wheel view is
  // currently shown - so the swatch's "+" can point at whichever real
  // pigment mix comes closest to it.
  const centroidAB = useMemo(() => colorsCentroidAB(activeColors), [activeColors]);

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
            <h2>{wheelView === "circle" ? "Okhsl Color Circle" : "OKLab Color Plane"}</h2>
            <div className="view-toggle">
              <button
                type="button"
                className={wheelView === "circle" ? "active" : ""}
                onClick={() => setWheelView("circle")}
              >
                Circle
              </button>
              <button
                type="button"
                className={wheelView === "plane" ? "active" : ""}
                onClick={() => setWheelView("plane")}
              >
                Plane
              </button>
            </div>
          </div>
          {wheelView === "circle" ? (
            <ColorWheel
              size={320}
              lightness={lightness}
              pigments={visiblePigments}
              selectedColors={wheelSelectedColors}
              activeIndex={activeIndex}
              onPick={handleWheelPick}
            />
          ) : (
            <ColorPlane
              size={320}
              lightness={lightness}
              pigments={visiblePigments}
              selectedColors={wheelSelectedColors}
              activeIndex={activeIndex}
              onPick={handleWheelPick}
            />
          )}
          <div className="slider-row lightness-row">
            <label htmlFor="lightness-slider">
              {wheelView === "circle" ? "Wheel" : "Plane"} lightness: {lightness.toFixed(2)}
            </label>
            <input
              id="lightness-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={lightness}
              onChange={(e) => setLightness(Number(e.target.value))}
            />
          </div>
          {wheelView === "circle" ? (
            <p className="hint-text">
              Click or drag on the circle to set color <strong>#{activeIndex + 1}</strong>. Small dots are
              your pigment library; large rings are the colors being blended; the <strong>+</strong> marks
              the geometric center of the polygon their points form (its color at the current lightness).
              Saturation is normalized to the gamut edge, so vivid pigments cluster near the rim.
            </p>
          ) : (
            <p className="hint-text">
              Click or drag on the plane to set color <strong>#{activeIndex + 1}</strong>. Unlike the
              circle, position reflects each color's true OKLab chroma (à la{" "}
              <a href="https://artistpigments.org" target="_blank" rel="noreferrer">
                artistpigments.org
              </a>
              's color planes), so pigments spread out by real perceptual distance instead of bunching at
              an edge.
            </p>
          )}
        </section>

        <section className="middle-column">
          <ColorSlots
            colors={colors}
            count={count}
            activeIndex={activeIndex}
            pigments={visiblePigments}
            onCountChange={handleCountChange}
            onActiveIndexChange={setActiveIndex}
            onColorChange={setColorAt}
          />

          <div className="panel swatch-panel">
            <div className="panel-header">
              <h2>Blended Swatch</h2>
              {count >= 3 && (
                <div className="view-toggle">
                  <button
                    type="button"
                    className={gridMode === "squares" ? "active" : ""}
                    onClick={() => setGridMode("squares")}
                  >
                    Squares
                  </button>
                  <button type="button" className={gridMode === "fan" ? "active" : ""} onClick={() => setGridMode("fan")}>
                    Fan
                  </button>
                </div>
              )}
            </div>
            <PolygonSwatch
              colors={activeColors}
              steps={steps}
              tint={tint}
              size={460}
              targetAB={centroidAB}
              gridMode={gridMode}
            />
            <div className="slider-row steps-row">
              <label htmlFor="steps-slider">Steps: {steps}</label>
              <input
                id="steps-slider"
                type="range"
                min={2}
                max={60}
                step={1}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
              />
            </div>
            <div className="slider-row tint-row">
              <label htmlFor="tint-slider">
                Tints: {tint} (
                {tint === 0
                  ? "black"
                  : tint === tintRange.max
                    ? "white"
                    : tint === tintRange.pure
                      ? "pure mix"
                      : tint < tintRange.pure
                        ? "shade"
                        : "tint"}
                )
              </label>
              <input
                id="tint-slider"
                type="range"
                min={0}
                max={tintRange.max}
                step={1}
                value={tint}
                onChange={(e) => setRawTint(Number(e.target.value))}
              />
            </div>
            <p className="hint-text">
              The <strong>+</strong> marks whichever swatch's real pigment mix comes closest to the OKLab
              plane's geometric center (same point regardless of which view is shown) - not necessarily
              the swatch at the polygon's own spatial center, since real pigment mixing rarely lands on a
              clean average. Each Tints step moves black (0) or white ({tintRange.max}) by an even slice of
              perceptual lightness, the way Munsell's Value axis and the CIELAB-based HLC Colour Atlas step
              their tint scales - so darker swatches need fewer steps to reach solid black than pale ones
              (less lightness left to travel), while every step looks like an equal amount of change. The
              range is recalculated for the current palette: {tintRange.pure} is the pure mix, and the
              darkest/lightest selected pigment sets each side's length.
            </p>
          </div>
        </section>

        <PigmentPanel
          pigments={pigments}
          onChange={setPigments}
          onSelect={handlePigmentSelect}
          activeTab={pigmentTab}
          onTabChange={setPigmentTab}
        />
      </main>
    </div>
  );
}

export default App;
