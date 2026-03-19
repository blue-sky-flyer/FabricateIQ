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
            <option value="toronto">Toronto</option>
            <option value="montreal">Montreal</option>
            <option value="usa">USA</option>
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
