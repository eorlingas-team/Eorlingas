import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './LocationMap.module.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to set up map bounds and constraints
const MapBoundsController = ({ center, bounds }) => {
    const map = useMap();

    useEffect(() => {
        // Set max bounds to restrict panning within campus area
        map.setMaxBounds(bounds);
        map.setMinZoom(15);
        map.setMaxZoom(19);

        // Invalidate size to ensure proper rendering
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map, bounds]);

    return null;
};

const LocationMap = ({
    latitude,
    longitude,
    buildingName,
    campusName,
    roomNumber,
    floor
}) => {
    const campusBounds = useMemo(() => {
        if (!latitude || !longitude) return null;
        const offset = 0.005;
        return L.latLngBounds(
            [latitude - offset, longitude - offset],
            [latitude + offset, longitude + offset]
        );
    }, [latitude, longitude]);

    // Open Google Maps with directions
    const openGoogleMaps = () => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // If no coordinates, show fallback
    if (!latitude || !longitude) {
        return (
            <div className={styles.mapCard}>
                <div className={styles.mapHeader}>
                    <span className="material-symbols-outlined">location_on</span>
                    <span className={styles.headerTitle}>Location</span>
                </div>
                <div className={styles.noCoordinates}>
                    <span className="material-symbols-outlined">map</span>
                    <p>Map not available</p>
                    <span className={styles.locationText}>
                        {buildingName}{campusName && `, ${campusName}`}
                    </span>
                </div>
            </div>
        );
    }

    const position = [latitude, longitude];

    return (
        <div className={styles.mapCard}>
            <div className={styles.mapHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined">location_on</span>
                    <span className={styles.headerTitle}>Location</span>
                </div>
                <button
                    className={styles.googleMapsBtnSmall}
                    onClick={openGoogleMaps}
                    aria-label="Open in Google Maps"
                    title="Open in Google Maps"
                >
                    <span className="material-symbols-outlined">open_in_new</span>
                </button>
            </div>

            <div className={styles.mapPreviewInteractive}>
                <MapContainer
                    center={position}
                    zoom={17}
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
                    <Marker position={position}>
                        <Popup>
                            <strong>{buildingName}</strong>
                            {roomNumber && <br />}
                            {roomNumber && `Room ${roomNumber}`}
                        </Popup>
                    </Marker>
                    <MapBoundsController center={position} bounds={campusBounds} />
                </MapContainer>
            </div>
        </div>
    );
};

export default LocationMap;
