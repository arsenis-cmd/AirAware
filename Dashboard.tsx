// File: mobile/src/screens/Dashboard.tsx
// How to name: mobile/src/screens/Dashboard.tsx

import React, { useState, useEffect } from 'react';
import { Wind, Droplets, ThermometerSun, Activity, MapPin, AlertTriangle, Heart, TrendingUp } from 'lucide-react';

const AirAwareDashboard = () => {
  const [currentAQI, setCurrentAQI] = useState(78);
  const [aqiCategory, setAQICategory] = useState('Moderate');
  const [location, setLocation] = useState('San Francisco, CA');

  const [airMetrics, setAirMetrics] = useState({
    pm25: 32.5,
    pm10: 45.2,
    co2: 420,
    temperature: 22,
    humidity: 65,
    o3: 45
  });

  const [healthRisk, setHealthRisk] = useState({
    score: 45,
    level: 'moderate',
    message: 'Air quality is acceptable for most people'
  });

  const [recommendations, setRecommendations] = useState([
    { icon: '🏃', action: 'Light outdoor activity is safe', priority: 'info' },
    { icon: '😷', action: 'Consider wearing a mask if sensitive', priority: 'low' },
    { icon: '🪟', action: 'Keep windows open for ventilation', priority: 'low' }
  ]);

  const [hourlyForecast, setHourlyForecast] = useState([
    { time: 'Now', aqi: 78, temp: 22 },
    { time: '1PM', aqi: 82, temp: 24 },
    { time: '2PM', aqi: 75, temp: 25 },
    { time: '3PM', aqi: 68, temp: 24 },
    { time: '4PM', aqi: 65, temp: 23 },
    { time: '5PM', aqi: 72, temp: 22 }
  ]);

  const [weeklyTrend, setWeeklyTrend] = useState([
    { day: 'Mon', aqi: 65, exposure: 35 },
    { day: 'Tue', aqi: 72, exposure: 42 },
    { day: 'Wed', aqi: 88, exposure: 58 },
    { day: 'Thu', aqi: 78, exposure: 48 },
    { day: 'Fri', aqi: 82, exposure: 52 },
    { day: 'Sat', aqi: 70, exposure: 40 },
    { day: 'Sun', aqi: 75, exposure: 45 }
  ]);

  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-500' };
    if (aqi <= 100) return { bg: 'bg-yellow-100', text: 'text-yellow-700', ring: 'ring-yellow-500' };
    if (aqi <= 150) return { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-500' };
    if (aqi <= 200) return { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-500' };
    return { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-500' };
  };

  const aqiColors = getAQIColor(currentAQI);
  const maxTrendAQI = Math.max(...weeklyTrend.map(d => d.aqi));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 p-4 pb-20">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-800">AirAware</h1>
            <button className="p-2 bg-white rounded-full shadow-md">
              <MapPin className="w-5 h-5 text-blue-600" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{location}</span>
          </div>
        </div>

        {/* Current AQI Card */}
        <div className={`${aqiColors.bg} rounded-3xl shadow-xl p-8 mb-6 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full -mr-20 -mt-20"></div>
          <div className="relative">
            <div className="text-sm font-medium text-gray-700 mb-2">Air Quality Index</div>
            <div className={`text-6xl font-bold ${aqiColors.text} mb-2`}>{currentAQI}</div>
            <div className={`inline-block px-4 py-2 ${aqiColors.text} bg-white rounded-full text-sm font-semibold`}>
              {aqiCategory}
            </div>
            <div className="mt-4 text-sm text-gray-700">
              {healthRisk.message}
            </div>
