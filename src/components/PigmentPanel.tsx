import { useState } from "react";
import { DEFAULT_PIGMENTS, makePigmentId, type Pigment } from "../lib/pigments";
import { WINSOR_NEWTON_DISCLAIMER, WINSOR_NEWTON_PIGMENTS } from "../lib/winsorNewtonPigments";
import { hexLightnessPercent, isValidHex, normalizeHex } from "../lib/color";

export type PigmentTab = "mine" | "winsorNewton";

interface PigmentPanelProps {
  pigments: Pigment[];
  onChange: (pigments: Pigment[]) => void;
  onSelect: (hex: string) => void;
  activeTab: PigmentTab;
  onTabChange: (tab: PigmentTab) => void;
}

export function PigmentPanel({ pigments, onChange, onSelect, activeTab, onTabChange }: PigmentPanelProps) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#");
  const [error, setError] = useState<string | null>(null);

  const addPigment = () => {
    if (!name.trim()) {
      setError("Give the pigment a name.");
      return;
    }
    if (!isValidHex(hex)) {
      setError("Hex code must look like #RRGGBB.");
      return;
    }
    const pigment: Pigment = { id: makePigmentId(name), name: name.trim(), hex: normalizeHex(hex) };
    onChange([...pigments, pigment]);
    setName("");
    setHex("#");
    setError(null);
  };

  const removePigment = (id: string) => {
    onChange(pigments.filter((p) => p.id !== id));
  };

  const resetDefaults = () => {
    onChange(DEFAULT_PIGMENTS);
  };

  const isMine = activeTab === "mine";
  const visiblePigments = isMine ? pigments : WINSOR_NEWTON_PIGMENTS;

  return (
    <div className="panel pigment-panel">
      <div className="panel-header">
        <h2>Pigments</h2>
        {isMine && (
          <button type="button" className="link-button" onClick={resetDefaults}>
            Reset to defaults
          </button>
        )}
      </div>

      <div className="view-toggle pigment-tabs">
        <button type="button" className={isMine ? "active" : ""} onClick={() => onTabChange("mine")}>
          My Pigments
        </button>
        <button type="button" className={!isMine ? "active" : ""} onClick={() => onTabChange("winsorNewton")}>
          Winsor & Newton
        </button>
      </div>

      {!isMine && <p className="pigment-disclaimer">{WINSOR_NEWTON_DISCLAIMER}</p>}

      <ul className="pigment-list">
        {visiblePigments.map((pigment) => (
          <li key={pigment.id} className="pigment-row">
            <button
              type="button"
              className="pigment-swatch-button"
              onClick={() => onSelect(pigment.hex)}
              title={`Use ${pigment.name}`}
            >
              <span className="pigment-swatch" style={{ backgroundColor: pigment.hex }} />
              <span className="pigment-name">{pigment.name}</span>
              <span className="pigment-lightness">L {hexLightnessPercent(pigment.hex) ?? "–"}%</span>
              <span className="pigment-hex">{pigment.hex}</span>
            </button>
            {isMine && (
              <button
                type="button"
                className="icon-button"
                onClick={() => removePigment(pigment.id)}
                aria-label={`Remove ${pigment.name}`}
                title="Remove"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {isMine && (
        <form
          className="pigment-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            addPigment();
          }}
        >
          <input
            type="text"
            placeholder="Pigment name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="#RRGGBB"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="hex-input"
          />
          <button type="submit">Add</button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
