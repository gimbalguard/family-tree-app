'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { LatLngBoundsExpression, DivIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Import leaflet CSS
import { Person } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin } from 'lucide-react';
import { Loader2 } from 'lucide-react';

type MapViewProps = {
  people: Person[];
  onEditPerson: (personId: string) => void;
};

type LocatedPerson = {
  person: Person;
  coords: [number, number];
  locationString: string;
};

// This component is rendered to a string to be used as a DivIcon.
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


export function MapView({ people, onEditPerson }: MapViewProps) {
  const [locatedPeople, setLocatedPeople] = useState<LocatedPerson[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const geocodingCache = useRef(new Map<string, [number, number] | null>());

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const processPeople = async () => {
      setIsLoading(true);
      const located: LocatedPerson[] = [];
      let excluded = 0;
      const geocodePromises: Promise<void>[] = [];

      const geocodeLocation = async (location: string): Promise<[number, number] | null> => {
        if (geocodingCache.current.has(location)) {
          return geocodingCache.current.get(location) || null;
        }
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`);
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();
          if (data && data.length > 0) {
            const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
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
          geocodePromises.push(
            geocodeLocation(locationString).then(coords => {
              if (coords) {
                located.push({ person, coords, locationString });
              } else {
                excluded++;
              }
            })
          );
        } else {
          excluded++;
        }
      }

      await Promise.all(geocodePromises);
      
      const locationsMap = new Map<string, LocatedPerson[]>();
      located.forEach(p => {
        const key = p.coords.join(',');
        if (!locationsMap.has(key)) {
          locationsMap.set(key, []);
        }
        locationsMap.get(key)!.push(p);
      });

      const finalLocatedPeople: LocatedPerson[] = [];
      locationsMap.forEach((peopleAtLocation) => {
          const count = peopleAtLocation.length;
          if (count === 1) {
              finalLocatedPeople.push(peopleAtLocation[0]);
          } else {
              const [lat, lon] = peopleAtLocation[0].coords;
              const radius = 0.00018 * Math.min(Math.sqrt(count), 5); // Offset radius
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
      setIsLoading(false);
    };

    processPeople();
  }, [people]);

  const mapBounds = useMemo((): LatLngBoundsExpression | null => {
    if (locatedPeople.length === 0) return null;
    const lats = locatedPeople.map(p => p.coords[0]);
    const lons = locatedPeople.map(p => p.coords[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [locatedPeople]);

  const iconsCache = useMemo(() => {
    const cache = new Map<string, DivIcon>();
    people.forEach(person => {
      const iconHtml = renderToStaticMarkup(<CustomMapPin person={person} />);
      cache.set(person.id, L.divIcon({
        html: iconHtml,
        className: 'map-pin',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      }));
    });
    return cache;
  }, [people]);

  // Effect for initializing and cleaning up the map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current && locatedPeople.length > 0) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
          center: [20, 0],
          zoom: 2,
          scrollWheelZoom: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current);
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locatedPeople.length > 0]); // Initialize only when there's data

  // Effect for updating markers and bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!markersLayerRef.current) {
        markersLayerRef.current = L.layerGroup().addTo(map);
    }
    markersLayerRef.current.clearLayers();

    locatedPeople.forEach(({ person, coords }) => {
        const icon = iconsCache.get(person.id);
        if (!icon) return;
        
        const marker = L.marker(coords, { icon });

        const createPopup = () => {
          const container = L.DomUtil.create('div');
          const popupHtml = `
             <div class="p-2" dir="rtl" style="font-family: Rubik, sans-serif;">
               <h3 class="font-bold text-base">${person.firstName} ${person.lastName}</h3>
               ${person.birthDate ? `<p class="text-sm text-muted-foreground">נולד/ה ב-${format(new Date(person.birthDate), 'dd/MM/yyyy')}</p>` : ''}
               <button id="edit-btn-${person.id}" class="p-0 h-auto mt-2 text-sm text-primary underline-offset-4 hover:underline">
                 פתח פרופיל
               </button>
             </div>
          `;
          container.innerHTML = popupHtml;
          const button = container.querySelector(`#edit-btn-${person.id}`);
          if (button) {
            L.DomEvent.on(button, 'click', () => {
              onEditPerson(person.id);
            });
          }
          return container;
        };

        marker.bindPopup(createPopup);
        markersLayerRef.current?.addLayer(marker);
    });

    if (mapBounds) {
        map.fitBounds(mapBounds, { padding: [50, 50] });
    }
  }, [locatedPeople, iconsCache, mapBounds, onEditPerson]);

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
  
  if (locatedPeople.length === 0 && !isLoading) {
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
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
