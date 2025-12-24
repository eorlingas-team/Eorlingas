import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { spacesApi } from '../api/spaces';
import { useToast } from '../contexts/ToastContext';
import Header from '../components/Header';
import styles from '../styles/CreateSpacePage.module.css';

const CreateSpacePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const isStatsAdmin = location.pathname.startsWith('/admin');
  const returnPath = isStatsAdmin ? '/admin/space-management' : '/space-manager';

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});

  const [filterOptions, setFilterOptions] = useState({
    campuses: [],
    buildings: [],
    roomTypes: [],
    noiseLevels: []
  });

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const response = await spacesApi.getFilterOptions();
        if (response.data.success) {
          setFilterOptions(response.data.data);
        }
      } catch (err) {
        console.error("Failed to load options", err);
      }
    };
    loadMetadata();
  }, []);

  const [availableFeatures, setAvailableFeatures] = useState([
    "WiFi", "Power Outlets", "Whiteboard", "Projector", "TV", "Air Conditioning"
  ]);
  const [newFeatureInput, setNewFeatureInput] = useState("");

  const [formData, setFormData] = useState({
    campusId: '',
    buildingId: '',
    floor: 0,
    spaceName: '',
    roomNumber: '',
    capacity: '',
    roomType: 'Group_Study',
    noiseLevel: 'Moderate',
    description: '',
    features: [],
    accessibilityFeatures: [],
    weekdayStart: '08:00',
    weekdayEnd: '22:00',
    weekdayClosed: false,
    weekendStart: '09:00',
    weekendEnd: '20:00',
    weekendClosed: false
  });

  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1) {
      if (!formData.campusId) newErrors.campusId = true;
      if (!formData.buildingId) newErrors.buildingId = true;
      if (formData.floor === undefined || formData.floor === '') newErrors.floor = true;
    }
    if (step === 2) {
      if (!formData.spaceName?.trim()) newErrors.spaceName = true;
      if (!formData.roomNumber?.trim()) newErrors.roomNumber = true;
      if (!formData.capacity || parseInt(formData.capacity) <= 0 || parseInt(formData.capacity) > 100) newErrors.capacity = true;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isStepValid = (step) => {
    if (step === 1) {
      return formData.campusId && formData.buildingId && (formData.floor !== '' && formData.floor !== undefined);
    }
    if (step === 2) {
      return formData.spaceName?.trim() && formData.roomNumber?.trim() && formData.capacity > 0 && formData.capacity <= 100;
    }
    return true;
  };

  const canNavigateTo = (targetStep) => {
    if (targetStep <= currentStep) return true;
    for (let i = 1; i < targetStep; i++) {
      if (!isStepValid(i)) return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep < 4) setCurrentStep(currentStep + 1);
    else {
      try {
        const payload = {
          spaceName: formData.spaceName,
          buildingId: parseInt(formData.buildingId),
          roomNumber: formData.roomNumber,
          floor: parseInt(formData.floor),
          capacity: parseInt(formData.capacity),
          roomType: formData.roomType,
          noiseLevel: formData.noiseLevel,
          description: formData.description,
          amenities: formData.features,
          accessibilityFeatures: formData.accessibilityFeatures,
          status: 'Available',
          operatingHours: {
            weekday: {
              start: formData.weekdayClosed ? null : formData.weekdayStart,
              end: formData.weekdayClosed ? null : formData.weekdayEnd
            },
            weekend: {
              start: formData.weekendClosed ? null : formData.weekendStart,
              end: formData.weekendClosed ? null : formData.weekendEnd
            }
          }
        };

        const response = await spacesApi.create(payload);
        if (response.data.success) {
          addToast("Space Created Successfully!", "success");
          navigate(returnPath);
        } else {
          const error = response.data.error;
          if (error?.code === 'DUPLICATE_ROOM') {
            setCurrentStep(2); // Go back to Basic Info
            setErrors({ roomNumber: true });
            addToast(error.message, "error");
          } else if (error?.code === 'VALIDATION_ERROR' && error.message.includes('Capacity')) {
            setCurrentStep(2);
            setErrors({ capacity: true });
            addToast(error.message, "error");
          } else {
            addToast("Failed to create space: " + (error?.message || "Unknown error"), "error");
          }
        }
      } catch (err) {
        console.error("Create Space Error:", err);
        addToast("Failed to create space.", "error");
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
  };

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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className={`${styles['form-fields']}`}>
            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`}>Campus</label>
              <select
                name="campusId"
                className={`${styles['form-select']} ${errors.campusId ? styles.error : ''}`}
                value={formData.campusId}
                onChange={(e) => {
                  handleChange(e);
                  setFormData(prev => ({ ...prev, buildingId: '' }));
                }}
                required
              >
                <option value="">Select a campus</option>
                {filterOptions.campuses.map(c => (
                  <option key={c.campus_id} value={c.campus_id}>{c.campus_name}</option>
                ))}
              </select>
              {errors.campusId && <span className={`${styles['error-text']}`}>Please select a campus</span>}
            </div>
            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`}>Building</label>
              <select
                name="buildingId"
                className={`${styles['form-select']} ${errors.buildingId ? styles.error : ''}`}
                value={formData.buildingId}
                onChange={handleChange}
                disabled={!formData.campusId}
                required
              >
                <option value="">{!formData.campusId ? "Select a campus first" : "Select a building"}</option>
                {filterOptions.buildings
                  .filter(b => String(b.campus_id) === String(formData.campusId))
                  .map(b => (
                    <option key={b.building_id} value={b.building_id}>{b.building_name}</option>
                  ))}
              </select>
              {errors.buildingId && <span className={`${styles['error-text']}`}>Please select a building</span>}
            </div>
            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`}>Floor</label>
              <input
                type="number"
                name="floor"
                className={`${styles['form-input']} ${errors.floor ? styles.error : ''}`}
                placeholder="0 for Entrance, 1 for 1st floor..."
                value={formData.floor}
                onChange={handleChange}
                required
              />
              {errors.floor && <span className={`${styles['error-text']}`}>Please enter floor number</span>}
            </div>
          </div>
        );
      case 2:
        return (
          <div className={`${styles['form-fields']}`}>
            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`}>Space Name</label>
              <input
                type="text"
                name="spaceName"
                className={`${styles['form-input']} ${errors.spaceName ? styles.error : ''}`}
                placeholder="e.g. Group Study Room 1"
                value={formData.spaceName}
                onChange={handleChange}
                required
              />
              {errors.spaceName && <span className={`${styles['error-text']}`}>Please enter space name</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={`${styles['input-group']}`}>
                <label className={`${styles['input-label']}`}>Room Number</label>
                <input
                  type="text"
                  name="roomNumber"
                  className={`${styles['form-input']} ${errors.roomNumber ? styles.error : ''}`}
                  placeholder="e.g. D101"
                  value={formData.roomNumber}
                  onChange={handleChange}
                  required
                />
                {errors.roomNumber && <span className={`${styles['error-text']}`}>Enter room number</span>}
              </div>
              <div className={`${styles['input-group']}`}>
                <label className={`${styles['input-label']}`}>Capacity</label>
                <input
                  type="number"
                  name="capacity"
                  className={`${styles['form-input']} ${errors.capacity ? styles.error : ''}`}
                  placeholder="e.g. 10"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                />
                {errors.capacity && <span className={`${styles['error-text']}`}>Invalid capacity</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={`${styles['input-group']}`}>
                <label className={`${styles['input-label']}`}>Room Type</label>
                <select name="roomType" className={`${styles['form-select']}`} value={formData.roomType} onChange={handleChange}>
                  {filterOptions.roomTypes.map(rt => (
                    <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className={`${styles['input-group']}`}>
                <label className={`${styles['input-label']}`}>Noise Level</label>
                <select name="noiseLevel" className={`${styles['form-select']}`} value={formData.noiseLevel} onChange={handleChange}>
                  {filterOptions.noiseLevels.map(nl => (
                    <option key={nl} value={nl}>{nl}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className={`${styles['form-fields']}`}>
            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`}>Amenities</label>
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
              <div className={`${styles['add-feature-row']}`} style={{ marginTop: '12px' }}>
                <input
                  type="text"
                  className={`${styles['form-input']}`}
                  placeholder="e.g. Soundproof"
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                />
                <button type="button" className={`${styles['add-feature-btn']}`} onClick={handleAddFeature}>
                  + Add
                </button>
              </div>
            </div>

            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`}>Accessibility Features</label>
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
          </div>
        );
      case 4:
        return (
          <div className={`${styles['form-fields']}`}>
            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`} style={{ color: 'var(--primary-color)', fontWeight: 700 }}>Description</label>
              <textarea
                name="description"
                className={`${styles['form-input']}`}
                placeholder="Briefly describe the study space..."
                value={formData.description}
                onChange={handleChange}
                style={{ minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            <div className={`${styles['input-group']}`}>
              <label className={`${styles['input-label']}`} style={{ color: 'var(--primary-color)', fontWeight: 700 }}>Operating Hours</label>

              <div className={`${styles['schedule-container']}`}>
                <div className={`${styles['schedule-row']}`}>
                  <div className={`${styles['schedule-left']}`}>
                    <div className={`${styles['schedule-meta']}`}>
                      <span className={`${styles['schedule-type-title']}`}>Weekdays</span>
                      <span className={`${styles['schedule-subtitle']}`}>Monday - Friday</span>
                    </div>

                    {!formData.weekdayClosed ? (
                      <div className={`${styles['time-inputs-container']} ${styles['animation-fade-in']}`}>
                        <input
                          type="time"
                          name="weekdayStart"
                          className={`${styles['time-input']}`}
                          value={formData.weekdayStart}
                          onChange={handleChange}
                        />
                        <span className={`${styles['time-separator']}`}>-</span>
                        <input
                          type="time"
                          name="weekdayEnd"
                          className={`${styles['time-input']}`}
                          value={formData.weekdayEnd}
                          onChange={handleChange}
                        />
                      </div>
                    ) : (
                      <span className={`${styles['closed-text']}`}>Closed</span>
                    )}
                  </div>

                  <div
                    className={`${styles['toggle-wrapper']}`}
                    onClick={() => setFormData({ ...formData, weekdayClosed: !formData.weekdayClosed })}
                  >
                    <div className={`${styles['custom-toggle']} ${!formData.weekdayClosed ? styles.active : ''}`}>
                      <div className={`${styles['toggle-circle']}`} />
                    </div>
                  </div>
                </div>

                <div className={`${styles['schedule-row']}`}>
                  <div className={`${styles['schedule-left']}`}>
                    <div className={`${styles['schedule-meta']}`}>
                      <span className={`${styles['schedule-type-title']}`}>Weekends</span>
                      <span className={`${styles['schedule-subtitle']}`}>Saturday - Sunday</span>
                    </div>

                    {!formData.weekendClosed ? (
                      <div className={`${styles['time-inputs-container']} ${styles['animation-fade-in']}`}>
                        <input
                          type="time"
                          name="weekendStart"
                          className={`${styles['time-input']}`}
                          value={formData.weekendStart}
                          onChange={handleChange}
                        />
                        <span className={`${styles['time-separator']}`}>-</span>
                        <input
                          type="time"
                          name="weekendEnd"
                          className={`${styles['time-input']}`}
                          value={formData.weekendEnd}
                          onChange={handleChange}
                        />
                      </div>
                    ) : (
                      <span className={`${styles['closed-text']}`}>Closed</span>
                    )}
                  </div>

                  <div
                    className={`${styles['toggle-wrapper']}`}
                    onClick={() => setFormData({ ...formData, weekendClosed: !formData.weekendClosed })}
                  >
                    <div className={`${styles['custom-toggle']} ${!formData.weekendClosed ? styles.active : ''}`}>
                      <div className={`${styles['toggle-circle']}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${styles['create-container']} ${styles['dark']}`}>
      <Header />

      <main className={`${styles['create-main']}`}>
        <div className={`${styles['content-wrapper']}`}>

          <h1 className={`${styles['page-title']}`}>Create a New Study Space</h1>

          <div className={`${styles['create-grid']}`}>

            <div className={`${styles['stepper-nav']}`}>
              {[
                { id: 1, title: 'Location', desc: 'Campus and building.' },
                { id: 2, title: 'Basic Information', desc: 'Details about the space.' },
                { id: 3, title: 'Features', desc: 'Amenities and accessibility.' },
                { id: 4, title: 'Operating Hours', desc: 'Weekday and weekend times.' }
              ].map((step) => (
                <button
                  key={step.id}
                  className={`${styles['step-item']} ${currentStep === step.id ? styles.active : ''}`}
                  onClick={() => canNavigateTo(step.id) && setCurrentStep(step.id)}
                  style={{ opacity: canNavigateTo(step.id) ? 1 : 0.5, cursor: canNavigateTo(step.id) ? 'pointer' : 'not-allowed' }}
                >
                  <div className={`${styles['step-icon']}`}>{step.id}</div>
                  <div>
                    <div className={`${styles['step-title']}`}>{step.title}</div>
                    <div className={`${styles['step-desc']}`}>{step.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className={`${styles['form-card']}`}>
              <div className={`${styles['form-body']}`}>
                <div className={`${styles['step-header']}`}>
                  <h3>Step {currentStep}: {
                    currentStep === 1 ? 'Location' :
                      currentStep === 2 ? 'Basic Information' :
                        currentStep === 3 ? 'Features' : 'Operating Hours'
                  }</h3>
                </div>

                {renderStepContent()}
              </div>

              <div className={`${styles['form-footer']}`} style={{ justifyContent: 'flex-end' }}>
                <button className={`${styles['btn-next']}`} onClick={handleNext}>
                  <span>{currentStep === 4 ? 'Create Space' : 'Next Step'}</span>
                  <span className={`material-symbols-outlined`}>arrow_forward</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateSpacePage;