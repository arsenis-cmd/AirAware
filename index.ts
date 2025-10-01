// File: backend/src/index.ts
// How to name: backend/src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB error:', err));

// MQTT Client for IoT Sensors
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', {
  clientId: `airaware_server_${Math.random().toString(16).substr(2, 8)}`,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
});

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('airaware/sensors/+/data');
  mqttClient.subscribe('airaware/sensors/+/status');
});

// Routes
import sensorRoutes from './routes/sensors';
import userRoutes from './routes/users';
import locationRoutes from './routes/locations';
import alertRoutes from './routes/alerts';
import analyticsRoutes from './routes/analytics';

app.use('/api/sensors', sensorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);

httpServer.listen(PORT, () => {
  console.log(`AirAware API running on port ${PORT}`);
});

// Export for use in routes
export { mqttClient, io };

// File: backend/src/routes/sensors.ts
// How to name: backend/src/routes/sensors.ts

import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import { Device } from '../models/mongodb_schemas';
import { mqttClient } from '../index';
import axios from 'axios';

const router = Router();

// TimescaleDB connection
const pgPool = new Pool({
  connectionString: process.env.TIMESCALE_URI
});

// Get current air quality readings
router.get('/readings/current', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location required' });
    }

    // Get latest reading within radius (km)
    const query = `
      SELECT *
      FROM air_quality_readings
      WHERE timestamp > NOW() - INTERVAL '1 hour'
      AND (
        6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
        )
      ) < $3
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const result = await pgPool.query(query, [latitude, longitude, radius]);

    if (result.rows.length === 0) {
      // No local data, fetch from external API
      const externalData = await fetchExternalAirQuality(
        Number(latitude),
        Number(longitude)
      );
      return res.json(externalData);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Current readings error:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

// Get historical air quality data
router.get('/readings/history', authenticate, async (req: any, res) => {
  try {
    const { device_id, start_date, end_date, interval = '1 hour' } = req.query;

    let query;
    let params;

    if (device_id) {
      query = `
        SELECT 
          time_bucket($1, timestamp) AS time,
          AVG(pm25) as avg_pm25,
          AVG(co2) as avg_co2,
          AVG(temperature) as avg_temp,
          AVG(humidity) as avg_humidity,
          AVG(aqi) as avg_aqi
        FROM air_quality_readings
        WHERE device_id = $2
        AND timestamp BETWEEN $3 AND $4
        GROUP BY time
        ORDER BY time DESC
      `;
      params = [interval, device_id, start_date, end_date];
    } else {
      query = `
        SELECT 
          time_bucket($1, timestamp) AS time,
          AVG(pm25) as avg_pm25,
          AVG(co2) as avg_co2,
          AVG(temperature) as avg_temp,
          AVG(humidity) as avg_humidity,
          AVG(aqi) as avg_aqi
        FROM air_quality_readings
        WHERE user_id = $2
        AND timestamp BETWEEN $3 AND $4
        GROUP BY time
        ORDER BY time DESC
      `;
      params = [interval, req.userId, start_date, end_date];
    }

    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Submit sensor reading (from IoT device or mobile app)
router.post('/readings', authenticate, async (req: any, res) => {
  try {
    const {
      pm25,
      pm10,
      co2,
      o3,
      no2,
      temperature,
      humidity,
      pressure,
      latitude,
      longitude,
      location_name,
      device_id,
      is_outdoor
    } = req.body;

    // Calculate AQI from PM2.5
    const aqi = calculateAQI(pm25);
    const aqi_category = getAQICategory(aqi);

    // Insert into TimescaleDB
    const query = `
      INSERT INTO air_quality_readings (
        timestamp, latitude, longitude, location_name,
        pm25, pm10, co2, o3, no2,
        temperature, humidity, pressure,
        aqi, aqi_category,
        source_type, device_id, user_id, is_outdoor, reliability_score
      ) VALUES (
        NOW(), $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, $15, $16, $17, $18
      ) RETURNING *
    `;

    const values = [
      latitude, longitude, location_name,
      pm25, pm10, co2, o3, no2,
      temperature, humidity, pressure,
      aqi, aqi_category,
      device_id ? 'sensor' : 'user_device',
      device_id || 'mobile_app',
      req.userId,
      is_outdoor,
      0.85 // Default reliability score
    ];

    const result = await pgPool.query(query, values);

    // Publish to MQTT for real-time updates
    mqttClient.publish('airaware/readings/new', JSON.stringify(result.rows[0]));

    // Check if alert needed
    await checkAndSendAlert(req.userId, aqi, pm25, latitude, longitude);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Submit reading error:', error);
    res.status(500).json({ error: 'Failed to submit reading' });
  }
});

// Register IoT device
router.post('/devices/register', authenticate, async (req: any, res) => {
  try {
    const {
      device_id,
      device_name,
      device_type,
      location,
      sensors,
      is_public
    } = req.body;

    const device = new Device({
      device_id,
      device_name,
      device_type,
      owner_id: req.userId,
      location,
      sensors,
      is_public,
      is_active: true,
      reliability_score: 0.5
    });

    await device.save();

    res.status(201).json(device);
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Get nearby sensors/stations
router.get('/devices/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    const devices = await Device.find({
      is_active: true,
      is_public: true,
      'location.latitude': {
        $gte: Number(latitude) - Number(radius) / 111,
        $lte: Number(latitude) + Number(radius) / 111
      },
      'location.longitude': {
        $gte: Number(longitude) - Number(radius) / 111,
        $lte: Number(longitude) + Number(radius) / 111
      }
    }).limit(20);

    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch nearby devices' });
  }
});

// Get air quality map data (for heatmap)
router.get('/map/data', async (req, res) => {
  try {
    const { bounds, resolution = 'high' } = req.query;
    // bounds: "lat1,lng1,lat2,lng2"

    const [lat1, lng1, lat2, lng2] = (bounds as string).split(',').map(Number);

    const query = `
      SELECT 
        latitude,
        longitude,
        AVG(aqi) as avg_aqi,
        AVG(pm25) as avg_pm25,
        MAX(timestamp) as last_update
      FROM air_quality_readings
      WHERE timestamp > NOW() - INTERVAL '1 hour'
      AND latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
      GROUP BY latitude, longitude
    `;

    const result = await pgPool.query(query, [lat1, lat2, lng1, lng2]);

    res.json({
      points: result.rows,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// Helper Functions

function calculateAQI(pm25: number): number {
  // EPA AQI breakpoints for PM2.5
  const breakpoints = [
    { cLow: 0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 }
  ];

  for (const bp of breakpoints) {
    if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
      const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * 
                   (pm25 - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }

  return 500; // Hazardous
}

function getAQICategory(aqi: number): string {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very_unhealthy';
  return 'hazardous';
}

async function fetchExternalAirQuality(lat: number, lng: number) {
  try {
    // Example: OpenWeatherMap Air Pollution API
    const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}`
    );

    const data = response.data.list[0];
    
    return {
      pm25: data.components.pm2_5,
      pm10: data.components.pm10,
      co: data.components.co,
      no2: data.components.no2,
      o3: data.components.o3,
      aqi: data.main.aqi * 50, // OpenWeather uses 1-5 scale, convert to 0-250
      source: 'openweathermap',
      timestamp: new Date()
    };
  } catch (error) {
    console.error('External API error:', error);
    return null;
  }
}

async function checkAndSendAlert(
  userId: string,
  aqi: number,
  pm25: number,
  lat: number,
  lng: number
) {
  // Check user's alert thresholds and send notification if exceeded
  // This would integrate with push notification service
  if (aqi > 150) {
    // Send alert logic here
    console.log(`Alert: High AQI (${aqi}) for user ${userId}`);
  }
}

export default router;

// File: backend/src/routes/analytics.ts
// How to name: backend/src/routes/analytics.ts

import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();
const pgPool = new Pool({
  connectionString: process.env.TIMESCALE_URI
});

// Get user's air quality summary
router.get('/summary', authenticate, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { period = '7d' } = req.query;

    const interval = period === '24h' ? '1 day' : period === '7d' ? '7 days' : '30 days';

    const query = `
      SELECT 
        AVG(aqi) as avg_aqi,
        MAX(aqi) as max_aqi,
        MIN(aqi) as min_aqi,
        AVG(pm25) as avg_pm25,
        AVG(temperature) as avg_temp,
        AVG(humidity) as avg_humidity,
        COUNT(*) as reading_count
      FROM air_quality_readings
      WHERE user_id = $1
      AND timestamp > NOW() - INTERVAL '${interval}'
    `;

    const result = await pgPool.query(query, [userId]);

    // Calculate exposure score
    const exposureScore = calculateExposureScore(result.rows[0]);

    res.json({
      ...result.rows[0],
      exposure_score: exposureScore,
      period: period
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get AI health recommendations
router.post('/recommendations', authenticate, async (req: any, res) => {
  try {
    const { air_quality, health_profile, intended_activity, duration_minutes } = req.body;

    // Call AI service
    const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/analyze-health-risk`, {
      air_quality,
      health_profile,
      intended_activity,
      duration_minutes,
      location_type: 'outdoor'
    });

    res.json(aiResponse.data);
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

function calculateExposureScore(data: any): number {
  if (!data.avg_aqi) return 0;
  
  // Simple exposure score based on average AQI
  const avgAQI = parseFloat(data.avg_aqi);
  if (avgAQI < 50) return 20; // Low exposure
  if (avgAQI < 100) return 50; // Moderate
  if (avgAQI < 150) return 75; // High
  return 95; // Very high
}

export default router;
