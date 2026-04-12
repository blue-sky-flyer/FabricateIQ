import { DURATION_OPTIONS } from '../config/constants.js';

export default function BoothForm({ form, fileUpload }) {
  const { location, setLocation, width, setWidth, length, setLength, indoor, setIndoor, duration, setDuration, groundLevel, setGroundLevel } = form;
  const pdfDisabled = fileUpload.hasPdfText;

  return (
    <div className="card">
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <optgroup label="Canada">
              <option value="toronto">Toronto, ON</option>
              <option value="montreal">Montreal, QC</option>
              <option value="vancouver">Vancouver, BC</option>
            </optgroup>
            <optgroup label="USA — Northeast">
              <option value="new_york">New York / New Jersey</option>
              <option value="boston">Boston / Foxborough</option>
              <option value="philadelphia">Philadelphia</option>
            </optgroup>
            <optgroup label="USA — Midwest">
              <option value="chicago">Chicago</option>
              <option value="kansas_city">Kansas City</option>
            </optgroup>
            <optgroup label="USA — South">
              <option value="dallas">Dallas</option>
              <option value="houston">Houston</option>
              <option value="austin">Austin</option>
              <option value="miami">Miami</option>
              <option value="atlanta">Atlanta</option>
            </optgroup>
            <optgroup label="USA — West">
              <option value="los_angeles">Los Angeles</option>
              <option value="seattle">Seattle</option>
              <option value="san_francisco">San Francisco Bay Area</option>
            </optgroup>
            <optgroup label="USA — Other">
              <option value="usa">USA (Other)</option>
            </optgroup>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Environment</label>
          <div className="segment-control">
            <button className={`segment-btn ${indoor ? 'active' : ''}`} onClick={() => setIndoor(true)} disabled={pdfDisabled}>Indoor</button>
            <button className={`segment-btn ${!indoor ? 'active' : ''}`} onClick={() => setIndoor(false)} disabled={pdfDisabled}>Outdoor</button>
          </div>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 24 }}>
        <label className="form-label">Booth Dimensions (feet)</label>
        <div className="dimensions-grid">
          <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} min="1" step="0.5" placeholder="Width" disabled={pdfDisabled} />
          <span className="dimensions-x">&times;</span>
          <input type="number" value={length} onChange={(e) => setLength(e.target.value)} min="1" step="0.5" placeholder="Length" disabled={pdfDisabled} />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 24 }}>
        <label className="form-label">Duration</label>
        <div className="duration-pills">
          {DURATION_OPTIONS.map((day) => (
            <button key={day} className={`pill-btn ${duration === day ? 'active' : ''}`} onClick={() => setDuration(day)}>
              {day} day{day !== 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 24 }}>
        <label className="form-label">Ground Level</label>
        <div className="segment-control">
          <button className={`segment-btn ${groundLevel === 'yes' ? 'active' : ''}`} onClick={() => setGroundLevel('yes')}>Yes</button>
          <button className={`segment-btn ${groundLevel === 'not-sure' ? 'active' : ''}`} onClick={() => setGroundLevel('not-sure')}>Not Sure</button>
          <button className={`segment-btn ${groundLevel === 'no' ? 'active' : ''}`} onClick={() => setGroundLevel('no')}>No</button>
        </div>
      </div>
    </div>
  );
}
