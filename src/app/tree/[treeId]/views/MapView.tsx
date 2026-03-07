'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Person } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Loader2 } from 'lucide-react';

type LocatedPerson = {
  person: Person;
  coords: [number, number];
  locationString: string;
};

const CustomMapPin = ({ person }: { person: Person }) => (
  <div className="relative">
    <Avatar className="h-10 w-10 border-2 border-primary bg-card p-0.5 shadow-lg">
      <AvatarImage src={person.photoURL || ''} />
      <AvatarFallback>
        <img src={getPlaceholderImage(person.gender)} alt={`${person.firstName} ${person.lastName}`} />
      </AvatarFallback>
    </Avatar>
  </div>
);

type MapViewProps = {
  people: Person[];
  onEditPerson: (personId: string) => void;
};

export function MapView({ people, onEditPerson }: MapViewProps) {
  const [locatedPeople, setLocatedPeople] = useState<LocatedPerson[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const geocodingCache = useRef(new Map<string, [number, number] | null>());

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const markersLayerRef = useRef<any | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        // Dynamically import libraries only on the client
        const [L, ReactDOMServer] = await Promise.all([
          import('leaflet'),
          import('react-dom/server')
        ]);

        if (!isMounted || !mapContainerRef.current) return;

        // --- Geocoding (sequentially to avoid rate-limiting) ---
        const geocodeLocation = async (location: string): Promise<[number, number] | null> => {
          if (geocodingCache.current.has(location)) {
            return geocodingCache.current.get(location) || null;
          }
          try {
            // Nominatim's Usage Policy requires a valid User-Agent.
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`, {
              headers: {
                'User-Agent': 'FamilyTreeApp/1.0 (for support, contact your administrator)'
              }
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Network response was not ok. Status: ${response.status}. Body: ${errorText}`);
            }

            const data = await response.json();
            if (data && data.length > 0) {
              const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
              if (isNaN(coords[0]) || isNaN(coords[1])) throw new Error("Invalid coordinates received");
              geocodingCache.current.set(location, coords);
              return coords;
            }
            throw new Error('No results found');
          } catch (error) {
            console.error(`Geocoding failed for "${location}":`, error);
            geocodingCache.current.set(location, null);
            return null;
          }
        };

        const located: LocatedPerson[] = [];
        let excluded = 0;
        
        for (const person of people) {
          let locationString = '';
          if (person.cityOfResidence && person.countryOfResidence) {
            locationString = `${person.cityOfResidence}, ${person.countryOfResidence}`;
          } else if (person.countryOfResidence) {
            locationString = person.countryOfResidence;
          } else if (person.birthPlace) {
            locationString = person.birthPlace;
          }

          if (locationString) {
            const coords = await geocodeLocation(locationString);
            if (isMounted && coords) {
              located.push({ person, coords, locationString });
            } else {
              excluded++;
            }
          } else {
            excluded++;
          }
        }
        
        if (!isMounted) return;

        // --- Offset overlapping pins ---
        const locationsMap = new Map<string, LocatedPerson[]>();
        located.forEach(p => {
          const key = p.coords.join(',');
          if (!locationsMap.has(key)) locationsMap.set(key, []);
          locationsMap.get(key)!.push(p);
        });
  
        const finalLocatedPeople: LocatedPerson[] = [];
        locationsMap.forEach((peopleAtLocation) => {
          const count = peopleAtLocation.length;
          if (count === 1) {
            finalLocatedPeople.push(peopleAtLocation[0]);
          } else {
            const [lat, lon] = peopleAtLocation[0].coords;
            const radius = 0.00018 * Math.min(Math.sqrt(count), 5);
            const angleStep = (2 * Math.PI) / count;
            peopleAtLocation.forEach((p, index) => {
              const angle = index * angleStep;
              const newLat = lat + radius * Math.sin(angle);
              const newLon = lon + radius * Math.cos(angle);
              finalLocatedPeople.push({ ...p, coords: [newLat, newLon] });
            });
          }
        });
        
        setLocatedPeople(finalLocatedPeople);
        setExcludedCount(excluded);
        
        // --- Initialize Map and add markers ---
        if (finalLocatedPeople.length > 0 && !mapInstanceRef.current) {
          const newMap = L.map(mapContainerRef.current).setView([20, 0], 2);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(newMap);
          mapInstanceRef.current = newMap;
          markersLayerRef.current = L.layerGroup().addTo(newMap);
        }

        const map = mapInstanceRef.current;
        if (!map) return;
        
        markersLayerRef.current?.clearLayers();
        
        finalLocatedPeople.forEach(({ person, coords }) => {
          const iconHtml = ReactDOMServer.renderToStaticMarkup(<CustomMapPin person={person} />);
          const icon = L.divIcon({
            html: iconHtml,
            className: 'map-pin',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
          });
          const marker = L.marker(coords, { icon });
          
          const popupContainer = L.DomUtil.create('div');
          popupContainer.innerHTML = `
            <div class="p-2" dir="rtl" style="font-family: Rubik, sans-serif;">
              <h3 class="font-bold text-base">${person.firstName} ${person.lastName}</h3>
              ${person.birthDate ? `<p class="text-sm text-muted-foreground">נולד/ה ב-${format(new Date(person.birthDate), 'dd/MM/yyyy')}</p>` : ''}
              <button id="edit-btn-${person.id}" class="p-0 h-auto mt-2 text-sm text-primary underline-offset-4 hover:underline">
                פתח פרופיל
              </button>
            </div>
          `;
          L.DomEvent.on(popupContainer.querySelector(`#edit-btn-${person.id}`), 'click', () => onEditPerson(person.id));
          marker.bindPopup(popupContainer);
          markersLayerRef.current?.addLayer(marker);
        });

        if (finalLocatedPeople.length > 0) {
          const bounds = L.latLngBounds(finalLocatedPeople.map(p => p.coords));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }

      } catch (error) {
        console.error("Failed to initialize map:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [people, onEditPerson]);

  if (isLoading) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-muted/20">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span className="text-lg">טוען את המפה ומיקומי האנשים...</span>
            </div>
        </div>
    )
  }
  
  if (locatedPeople.length === 0) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-muted/20">
            <div className="text-center text-muted-foreground">
                <MapPin className="mx-auto h-16 w-16" />
                <h2 className="mt-4 text-2xl font-bold">לא נמצאו אנשים עם נתוני מיקום</h2>
                <p>הוסף ארץ מגורים, עיר מגורים, או מקום לידה בפרופיל של אדם כדי להציג אותו על המפה.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="h-full w-full relative">
       {excludedCount > 0 && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-auto">
            <Alert variant="default" className="shadow-lg bg-background/90 backdrop-blur-sm">
                <MapPin className="h-4 w-4" />
                <AlertTitle>הערה</AlertTitle>
                <AlertDescription>
                  {excludedCount} אנשים אינם מוצגים במפה עקב היעדר מידע על מיקום.
                </AlertDescription>
            </Alert>
         </div>
       )}
      <div ref={mapContainerRef} className="h-full w-full bg-muted" />
    </div>
  );
}
