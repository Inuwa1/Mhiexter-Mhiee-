import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptions({
      // @ts-ignore
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
    });

    async function initMap() {
      try {
        const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
        const { Marker } = await importLibrary('marker') as google.maps.MarkerLibrary;

        if (mapRef.current) {
          const map = new Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            mapTypeId: 'satellite',
          });

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const pos = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                };
                map.setCenter(pos);
                map.setZoom(15);
                new Marker({
                  position: pos,
                  map: map,
                  title: 'Your Location',
                });
              },
              () => {
                setError('Geolocation service failed.');
              }
            );
          }
        }
      } catch (err) {
        console.error('Map initialization error:', err);
        setError('Failed to load map. Please check your API key and billing settings.');
      }
    }
    initMap();
  }, []);

  if (error) {
    return <div className="w-full h-full flex items-center justify-center text-red-500 p-4">{error}</div>;
  }

  return <div ref={mapRef} className="w-full h-full" />;
}
