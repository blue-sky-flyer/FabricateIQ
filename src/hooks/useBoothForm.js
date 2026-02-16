import { useState, useEffect, useCallback } from 'react';
import { calculateBoothSpecs, calculateEstimates } from '../config/calculations.js';

export function useBoothForm() {
  const [location, setLocation] = useState('toronto');
  const [width, setWidth] = useState(10);
  const [length, setLength] = useState(10);
  const [indoor, setIndoor] = useState(true);
  const [duration, setDuration] = useState(3);
  const [groundLevel, setGroundLevel] = useState('not-sure');
  const [components, setComponents] = useState(null);
  const [estimates, setEstimates] = useState(null);

  const updateEstimates = useCallback((overrideComps = null) => {
    const specs = overrideComps || calculateBoothSpecs(width, length);
    setComponents(specs);
    const calcs = calculateEstimates(
      specs,
      location,
      duration,
      indoor ? 'indoor' : 'outdoor',
      groundLevel
    );
    setEstimates(calcs);
  }, [width, length, location, duration, indoor, groundLevel]);

  useEffect(() => {
    updateEstimates();
  }, [updateEstimates]);

  const getCurrency = useCallback(() => location === 'usa' ? 'USD' : 'CAD', [location]);

  return {
    location, setLocation,
    width, setWidth,
    length, setLength,
    indoor, setIndoor,
    duration, setDuration,
    groundLevel, setGroundLevel,
    components,
    estimates,
    updateEstimates,
    getCurrency
  };
}
