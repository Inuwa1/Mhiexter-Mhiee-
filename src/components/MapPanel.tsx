import React, { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOptions({
      // @ts-ignore
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
    });

    async function initMap() {
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
              console.error('Error: The Geolocation service failed.');
            }
          );
        }
      }
    }
    initMap();
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}
