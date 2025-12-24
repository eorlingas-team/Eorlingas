import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import styles from './BuildingsMap.module.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ISTANBUL_BOUNDS = L.latLngBounds(
    [41.00, 28.90], // Southwest
    [41.15, 29.10]  // Northeast
);

// Center of İTÜ campuses
const DEFAULT_CENTER = [41.07, 29.01];

// Component to set up map bounds and constraints
const MapBoundsController = () => {
    const map = useMap();

    React.useEffect(() => {
        map.setMaxBounds(ISTANBUL_BOUNDS);
        map.setMinZoom(11);
        map.setMaxZoom(18);
    }, [map]);

    return null;
};

const BuildingsMap = ({ spaces = [], onSpaceClick }) => {
    const navigate = useNavigate();

    // Group spaces by building to get unique building markers
    const buildings = useMemo(() => {
        const buildingMap = new Map();

        spaces.forEach(space => {
            const building = space.building;
            if (!building || !building.latitude || !building.longitude) return;

            const key = building.buildingId || building.buildingName;

            if (!buildingMap.has(key)) {
                buildingMap.set(key, {
                    buildingId: building.buildingId,
                    buildingName: building.buildingName,
                    campusName: building.campus?.campusName,
                    latitude: building.latitude,
                    longitude: building.longitude,
                    spaces: []
                });
            }

            buildingMap.get(key).spaces.push(space);
        });

        return Array.from(buildingMap.values());
    }, [spaces]);

    const handleViewSpace = (space) => {
        navigate(`/spaces/${space.spaceId}`, {
            state: { spaceData: space }
        });
    };

    if (buildings.length === 0) {
        return (
            <div className={styles.emptyMap}>
                <span className="material-symbols-outlined">location_off</span>
                <p>No buildings with location data found</p>
                <span className={styles.subtext}>Try adjusting your filters</span>
            </div>
        );
    }

    return (
        <div className={styles.mapContainer}>
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={12}
                className={styles.leafletContainer}
                zoomControl={true}
                attributionControl={false}
                scrollWheelZoom={true}
                dragging={true}
                touchZoom={true}
                doubleClickZoom={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBoundsController />

                {buildings.map(building => (
                    <Marker
                        key={building.buildingId || building.buildingName}
                        position={[building.latitude, building.longitude]}
                    >
                        <Popup className={styles.customPopup} maxWidth={300}>
                            <div className={styles.popupContent}>
                                <h4 className={styles.popupTitle}>{building.buildingName}</h4>
                                {building.campusName && (
                                    <p className={styles.popupCampus}>{building.campusName}</p>
                                )}
                                <p className={styles.popupSpaceCount}>
                                    {building.spaces.length} space{building.spaces.length !== 1 ? 's' : ''}
                                </p>
                                <div className={styles.popupSpaces}>
                                    {building.spaces.map(space => (
                                        <button
                                            key={space.spaceId}
                                            className={styles.popupSpaceBtn}
                                            onClick={() => handleViewSpace(space)}
                                        >
                                            <span className={styles.spaceName}>{space.spaceName}</span>
                                            <span className={styles.spaceCapacity}>
                                                <span className="material-symbols-outlined">groups</span>
                                                {space.capacity}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default BuildingsMap;
