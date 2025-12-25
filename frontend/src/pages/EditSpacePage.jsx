import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSpaceManager } from '../contexts/SpaceManagerContext';
import { useToast } from '../contexts/ToastContext';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from '../styles/EditSpacePage.module.css';

const EditSpacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isStatsAdmin = location.pathname.startsWith('/admin');
  const returnPath = isStatsAdmin ? '/admin/space-management' : '/space-manager';

  const { addToast } = useToast();
  const { spaces, meta, actions } = useSpaceManager();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [newFeatureInput, setNewFeatureInput] = useState("");
  const [availableFeatures, setAvailableFeatures] = useState([
    "WiFi", "Power Outlets", "Whiteboard", "Projector", "TV", "Air Conditioning"
  ]);

  useEffect(() => {
    if (!meta.campuses.length) {
      actions.fetchMeta();
    }
  }, [meta.campuses.length, actions]);

  const mapSpaceToForm = (space) => ({
    name: space.spaceName,
    capacity: space.capacity,
    status: space.status,
    noiseLevel: space.noiseLevel,
    description: space.description || '',
    features: space.amenities || [],
    schedule: {
      weekdays: { start: "08:00", end: "22:00", closed: false },
      weekends: { start: "09:00", end: "20:00", closed: false }
    },
    buildingId: space.building?.buildingId || '',
    campusId: space.building?.campus?.campusId || '',
    roomNumber: space.roomNumber,
    floor: space.floor,
    roomType: space.roomType,
    accessibilityFeatures: space.accessibilityFeatures || []
  });

  const [formData, setFormData] = useState(() => {
    const cached = spaces.find(s => String(s.spaceId) === id);
    if (cached) return mapSpaceToForm(cached);

    return {
      name: '',
      capacity: '',
      status: 'Available',
      noiseLevel: 'Moderate',
      description: '',
      features: [],
      schedule: {
        weekdays: { start: "08:00", end: "22:00", closed: false },
        weekends: { start: "09:00", end: "20:00", closed: false }
      },
      buildingId: '',
      campusId: '',
      roomNumber: '',
      floor: 0,
      roomType: 'Group_Study',
      accessibilityFeatures: []
    };
  });

  useEffect(() => {
    const cached = spaces.find(s => String(s.spaceId) === id);
    if (!cached) {
      const loadSpace = async () => {
        try {
          const result = await actions.getSpaceById(id);
          if (result.success) {
            setFormData(mapSpaceToForm(result.data));
          } else {
            addToast("Failed to load space: " + result.error, "error");
          }
        } catch (err) {
          console.error("Load Space Error:", err);
        }
      };
      loadSpace();
    }
  }, [id, spaces, actions]);

  const handleToggleChip = (field, item) => {
    setFormData(prev => {
      const currentList = prev[field] || [];
      const newList = currentList.includes(item)
        ? currentList.filter(i => i !== item)
        : [...currentList, item];
      return { ...prev, [field]: newList };
    });
  };

  const handleAddFeature = (e) => {
    e.preventDefault();
    if (newFeatureInput.trim() && !availableFeatures.includes(newFeatureInput)) {
      setAvailableFeatures([...availableFeatures, newFeatureInput]);
      handleToggleChip('features', newFeatureInput);
      setNewFeatureInput("");
    }
  };

  const handleScheduleChange = (type, field, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [type]: {
          ...prev.schedule[type],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        spaceName: formData.name,
        capacity: parseInt(formData.capacity),
        status: formData.status,
        noiseLevel: formData.noiseLevel,
        description: formData.description,
        amenities: formData.features,
        buildingId: formData.buildingId,
        roomNumber: formData.roomNumber,
        floor: formData.floor,
        roomType: formData.roomType,
        accessibilityFeatures: formData.accessibilityFeatures
      };

      const result = await actions.updateSpace(id, payload);

      if (result.success) {
        addToast("Changes saved successfully!", "success");
        navigate(returnPath);
      } else {
        const error = result.error;
        if (error?.code === 'DUPLICATE_ROOM') {
          setErrors({ roomNumber: true });
          addToast(error.message, "error");
        } else if (error?.code === 'VALIDATION_ERROR' && error.message.includes('Capacity')) {
          setErrors({ capacity: true });
          addToast(error.message, "error");
        } else {
          addToast("Failed to update space: " + (error?.message || error || "Unknown error"), "error");
        }
      }
    } catch (err) {
      console.error("Update Error:", err);
      addToast("Failed to update space.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles['edit-container']} ${styles['dark']}`}>
      <Header />

      <main className={`${styles['edit-main']}`}>
        <div className={`${styles['edit-card']}`}>
          <div className={`${styles['card-header-row']}`}>
            <h1 className={`${styles['card-title']}`}>Edit Space #{id}</h1>
            <button
              className={`${styles['icon-close-btn']} material-symbols-outlined`}
              onClick={() => navigate(returnPath)}
              title="Close"
            >
              close
            </button>
          </div>

          <form onSubmit={handleSubmit} className={`${styles['edit-form']}`}>

            <div className={`${styles['form-group']}`}>
              <label className={`${styles['form-label']}`}>Space Name</label>
              <input
                type="text"
                className={`${styles['form-input']}`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className={`${styles['form-row']}`}>
              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Campus</label>
                <select
                  className={`${styles['form-select']}`}
                  value={formData.campusId}
                  onChange={(e) => {
                    const newCampusId = parseInt(e.target.value);
                    setFormData({
                      ...formData,
                      campusId: newCampusId,
                      buildingId: '' // Reset building when campus changes
                    });
                  }}
                  required
                >
                  <option value="">Select a Campus</option>
                  {meta.campuses.map(c => (
                    <option key={c.campus_id} value={c.campus_id}>
                      {c.campus_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Building</label>
                <select
                  className={`${styles['form-select']}`}
                  value={formData.buildingId}
                  onChange={(e) => setFormData({ ...formData, buildingId: parseInt(e.target.value) })}
                  required
                  disabled={!formData.campusId}
                >
                  <option value="">
                    {!formData.campusId ? "Select a campus first" : "Select a Building"}
                  </option>
                  {meta.buildings
                    .filter(b => b.campus_id === formData.campusId)
                    .map(b => (
                      <option key={b.building_id} value={b.building_id}>
                        {b.building_name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className={`${styles['form-row']}`} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Room Number</label>
                <input
                  type="text"
                  className={`${styles['form-input']} ${errors.roomNumber ? styles.error : ''}`}
                  value={formData.roomNumber}
                  onChange={(e) => {
                    setFormData({ ...formData, roomNumber: e.target.value });
                    if (errors.roomNumber) setErrors(prev => ({ ...prev, roomNumber: false }));
                  }}
                  required
                />
                {errors.roomNumber && <span className={`${styles['error-text']}`}>Already in use</span>}
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Floor</label>
                <input
                  type="number"
                  className={`${styles['form-input']}`}
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  required
                />
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Capacity</label>
                <input
                  type="number"
                  className={`${styles['form-input']} ${errors.capacity ? styles.error : ''}`}
                  value={formData.capacity}
                  onChange={(e) => {
                    setFormData({ ...formData, capacity: e.target.value });
                    if (errors.capacity) setErrors(prev => ({ ...prev, capacity: false }));
                  }}
                  required
                />
                {errors.capacity && <span className={`${styles['error-text']}`}>Should be between 1-100</span>}
              </div>
            </div>

            <div className={`${styles['form-row']}`} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Status</label>
                <select
                  className={`${styles['form-select']}`}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Available">Available</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Noise Level</label>
                <select
                  className={`${styles['form-select']}`}
                  value={formData.noiseLevel}
                  onChange={(e) => setFormData({ ...formData, noiseLevel: e.target.value })}
                >
                  {meta.noiseLevels.length > 0 ? (
                    meta.noiseLevels.map(nl => <option key={nl} value={nl}>{nl}</option>)
                  ) : (
                    <>
                      <option value="Silent">Silent</option>
                      <option value="Quiet">Quiet</option>
                      <option value="Moderate">Moderate</option>
                    </>
                  )}
                </select>
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Room Type</label>
                <select
                  className={`${styles['form-select']}`}
                  value={formData.roomType}
                  onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                  required
                >
                  {meta.roomTypes.length > 0 ? (
                    meta.roomTypes.map(rt => (
                      <option key={rt} value={rt}>
                        {rt.replace(/_/g, ' ')}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Quiet_Study">Quiet Study</option>
                      <option value="Group_Study">Group Study</option>
                      <option value="Meeting_Room">Meeting Room</option>
                      <option value="Lab">Lab</option>
                      <option value="Seminar_Room">Seminar Room</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className={`${styles['form-group']}`}>
              <label className={`${styles['form-label']}`}>Amenities</label>
              <div className={`${styles['features-grid']}`}>
                {availableFeatures.map(feature => (
                  <button
                    type="button"
                    key={feature}
                    className={`${styles['feature-chip']} ${formData.features.includes(feature) ? styles.active : ''}`}
                    onClick={() => handleToggleChip('features', feature)}
                  >
                    {feature}
                  </button>
                ))}
              </div>

              <div className={`${styles['add-feature-row']}`}>
                <input
                  type="text"
                  className={`${styles['form-input']}`}
                  placeholder="Add custom feature..."
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                  style={{ maxWidth: '200px', fontSize: '0.85rem' }}
                />
                <button type="button" className={`${styles['add-feature-btn']}`} onClick={handleAddFeature}>
                  + Add
                </button>
              </div>
            </div>

            <div className={`${styles['form-group']}`}>
              <label className={`${styles['form-label']}`}>Accessibility Features</label>
              <div className={`${styles['features-grid']}`}>
                {["Wheelchair Accessible", "Elevator Nearby", "Adjustable Desks", "Braille Signage", "Hearing Loop"].map(acc => (
                  <button
                    type="button"
                    key={acc}
                    className={`${styles['feature-chip']} ${formData.accessibilityFeatures.includes(acc) ? styles.active : ''}`}
                    onClick={() => handleToggleChip('accessibilityFeatures', acc)}
                  >
                    {acc}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${styles['form-group']}`}>
              <label className={`${styles['form-label']}`} style={{ marginBottom: '12px' }}>Weekly Schedule</label>
              <div className={`${styles['schedule-container']}`}>

                {['weekdays', 'weekends'].map((type) => (
                  <div className={`${styles['schedule-row']}`} key={type}>

                    {/* Left Side: Title, Subtitle, Inputs */}
                    <div className={`${styles['schedule-left']}`}>
                      <div className={`${styles['schedule-meta']}`}>
                        <span className={`${styles['schedule-type-title']}`}>
                          {type === 'weekdays' ? 'Weekdays' : 'Weekends'}
                        </span>
                        <span className={`${styles['schedule-subtitle']}`}>
                          {type === 'weekdays' ? 'Monday - Friday' : 'Saturday - Sunday'}
                        </span>
                      </div>

                      {/* Time Inputs */}
                      {!formData.schedule[type].closed && (
                        <div className={`${styles['time-inputs-container']} ${styles['animation-fade-in']}`}>
                          <input
                            type="time"
                            className={`${styles['time-input']}`}
                            value={formData.schedule[type].start}
                            onChange={(e) => handleScheduleChange(type, 'start', e.target.value)}
                          />
                          <span className={`${styles['time-separator']}`}>-</span>
                          <input
                            type="time"
                            className={`${styles['time-input']}`}
                            value={formData.schedule[type].end}
                            onChange={(e) => handleScheduleChange(type, 'end', e.target.value)}
                          />
                        </div>
                      )}

                      {formData.schedule[type].closed && (
                        <span className={`${styles['closed-text']}`}>Closed</span>
                      )}
                    </div>

                    {/* Right Side: Toggle */}
                    <div
                      className={`${styles['toggle-wrapper']}`}
                      onClick={() => handleScheduleChange(type, 'closed', !formData.schedule[type].closed)}
                      title="Toggle schedule status"
                    >
                      <div className={`${styles['custom-toggle']} ${!formData.schedule[type].closed ? styles.active : ''}`}>
                        <div className={`${styles['toggle-circle']}`} />
                      </div>
                    </div>

                  </div>
                ))}

              </div>
            </div>

            <div className={`${styles['form-group']}`}>
              <label className={`${styles['form-label']}`}>Description</label>
              <textarea
                className={`${styles['form-textarea']}`}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className={`${styles['form-actions']}`}>
              <button
                type="button"
                className={`${styles['btn-cancel']}`}
                onClick={() => navigate(returnPath)}
              >
                Discard
              </button>
              <button
                type="submit"
                className={`${styles['btn-save']}`}
                disabled={submitting}
              >
                {submitting ? <LoadingSpinner size="sm" color="white" /> : 'Save'}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
};

export default EditSpacePage;