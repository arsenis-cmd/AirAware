-- File: backend/database/timescale_schema.sql
-- How to name: backend/database/timescale_schema.sql
-- TimescaleDB for time-series air quality data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Air Quality Readings Table (Hypertable)
CREATE TABLE air_quality_readings (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- Location
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location_name VARCHAR(255),
    
    -- Air Quality Metrics
    pm25 DECIMAL(10, 2), -- PM2.5 (µg/m³)
    pm10 DECIMAL(10, 2), -- PM10 (µg/m³)
    co2 INTEGER, -- CO2 (ppm)
    co DECIMAL(10, 2), -- Carbon Monoxide (ppm)
    no2 DECIMAL(10, 2), -- Nitrogen Dioxide (ppb)
    o3 DECIMAL(10, 2), -- Ozone (ppb)
    so2 DECIMAL(10, 2), -- Sulfur Dioxide (ppb)
    
    -- Environmental Metrics
    temperature DECIMAL(5, 2), -- Celsius
    humidity DECIMAL(5, 2), -- Percentage
    pressure DECIMAL(7, 2), -- hPa
    
    -- Air Quality Index
    aqi INTEGER, -- 0-500 scale
    aqi_category VARCHAR(50), -- Good, Moderate, Unhealthy, etc.
    
    -- Data Source
    source_type VARCHAR(50), -- 'sensor', 'api', 'user_device', 'community'
    device_id VARCHAR(100),
    user_id VARCHAR(100),
    
    -- Metadata
    is_outdoor BOOLEAN DEFAULT true,
    reliability_score DECIMAL(3, 2), -- 0-1 scale
    
    PRIMARY KEY (timestamp, latitude, longitude)
);

-- Convert to hypertable (time-series optimization)
SELECT create_hypertable('air_quality_readings', 'timestamp');

-- Create indexes for common queries
CREATE INDEX idx_location ON air_quality_readings (latitude, longitude, timestamp DESC);
CREATE INDEX idx_device ON air_quality_readings (device_id, timestamp DESC);
CREATE INDEX idx_user ON air_quality_readings (user_id, timestamp DESC);
CREATE INDEX idx_aqi ON air_quality_readings (aqi, timestamp DESC);

-- Continuous Aggregate: Hourly averages
CREATE MATERIALIZED VIEW air_quality_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS hour,
    latitude,
    longitude,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(co2) as avg_co2,
    AVG(temperature) as avg_temp,
    AVG(humidity) as avg_humidity,
    AVG(aqi) as avg_aqi,
    COUNT(*) as reading_count
FROM air_quality_readings
GROUP BY hour, latitude, longitude;

-- Continuous Aggregate: Daily averages
CREATE MATERIALIZED VIEW air_quality_daily
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', timestamp) AS day,
    latitude,
    longitude,
    AVG(pm25) as avg_pm25,
    MAX(pm25) as max_pm25,
    MIN(pm25) as min_pm25,
    AVG(aqi) as avg_aqi,
    MAX(aqi) as max_aqi,
    COUNT(*) as reading_count
FROM air_quality_readings
GROUP BY day, latitude, longitude;

-- User Exposure History Table
CREATE TABLE user_exposure_history (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    
    -- Exposure metrics (cumulative)
    pm25_exposure DECIMAL(12, 2), -- µg/m³ * hours
    aqi_weighted_avg DECIMAL(10, 2),
    hours_outdoor DECIMAL(5, 2),
    hours_in_poor_air DECIMAL(5, 2),
    
    -- Activity context
    activity_type VARCHAR(50), -- 'resting', 'walking', 'exercising'
    location_type VARCHAR(50), -- 'home', 'work', 'outdoor', 'transit'
    
    PRIMARY KEY (timestamp, user_id)
);

SELECT create_hypertable('user_exposure_history', 'timestamp');
CREATE INDEX idx_user_exposure ON user_exposure_history (user_id, timestamp DESC);

-- Health Events Table (when air quality triggers alerts)
CREATE TABLE health_events (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    
    event_type VARCHAR(50), -- 'high_pollution_alert', 'recommendation', 'warning'
    severity VARCHAR(20), -- 'info', 'warning', 'danger'
    
    trigger_metric VARCHAR(50), -- 'pm25', 'aqi', 'co2'
    trigger_value DECIMAL(10, 2),
    threshold_exceeded DECIMAL(10, 2),
    
    recommendation TEXT,
    was_viewed BOOLEAN DEFAULT false,
    
    PRIMARY KEY (timestamp, user_id, event_type)
);

SELECT create_hypertable('health_events', 'timestamp');

-- Data Retention Policies
-- Keep raw data for 90 days
SELECT add_retention_policy('air_quality_readings', INTERVAL '90 days');

-- Keep hourly aggregates for 1 year
SELECT add_retention_policy('air_quality_hourly', INTERVAL '1 year');

-- Keep daily aggregates forever (or set a longer period)
-- SELECT add_retention_policy('air_quality_daily', INTERVAL '5 years');

---
-- MongoDB Schemas (JavaScript/TypeScript)
---

/*
File: backend/models/mongodb_schemas.js
How to name: backend/models/mongodb_schemas.js
*/

const mongoose = require('mongoose');

// Users Collection
const userSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  full_name: String,
  avatar_url: String,
  
  // Health Profile
  health_profile: {
    age: Number,
    has_asthma: Boolean,
    has_copd: Boolean,
    has_heart_condition: Boolean,
    is_pregnant: Boolean,
    is_child: Boolean,
    is_elderly: Boolean,
    sensitivity_level: {
      type: String,
      enum: ['low', 'moderate', 'high', 'very_high'],
      default: 'moderate'
    }
  },
  
  // Location
  home_location: {
    latitude: Number,
    longitude: Number,
    address: String,
    city: String,
    country: String
  },
  work_location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  // Devices
  registered_devices: [{
    device_id: String,
    device_name: String,
    device_type: String, // 'phone', 'external_sensor', 'smart_home'
    is_active: Boolean,
    last_seen: Date
  }],
  
  // Preferences
  preferences: {
    units: {
      temperature: {
        type: String,
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius'
      },
      distance: {
        type: String,
        enum: ['km', 'miles'],
        default: 'km'
      }
    },
    
    notifications: {
      enabled: Boolean,
      air_quality_alerts: Boolean,
      daily_summary: Boolean,
      activity_suggestions: Boolean,
      alert_threshold_aqi: Number // Only alert if AQI exceeds this
    },
    
    data_sharing: {
      share_anonymous_data: Boolean,
      contribute_to_community_map: Boolean
    }
  },
  
  // Statistics
  stats: {
    total_readings: Number,
    days_tracked: Number,
    avg_exposure_aqi: Number,
    best_air_day: Date,
    worst_air_day: Date
  },
  
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: Date
});

// Devices Collection (IoT Sensors)
const deviceSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    unique: true
  },
  device_name: String,
  device_type: {
    type: String,
    enum: ['personal_sensor', 'community_sensor', 'smart_home', 'mobile_app'],
    required: true
  },
  
  // Owner
  owner_id: String, // user_id
  
  // Location
  location: {
    latitude: Number,
    longitude: Number,
    altitude: Number,
    address: String,
    is_indoor: Boolean
  },
  
  // Capabilities
  sensors: [{
    type: String, // 'pm25', 'co2', 'temperature', etc.
    calibrated: Boolean,
    last_calibration: Date
  }],
  
  // Status
  is_active: Boolean,
  is_public: Boolean, // Contribute to community map
  battery_level: Number,
  firmware_version: String,
  last_reading: Date,
  last_online: Date,
  
  // Data Quality
  reliability_score: Number, // 0-1
  total_readings: Number,
  
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Locations Collection (Saved places)
const locationSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true
  },
  
  name: String, // "Home", "Office", "Gym"
  location_type: {
    type: String,
    enum: ['home', 'work', 'gym', 'school', 'favorite', 'other']
  },
  
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  address: String,
  
  // Air quality stats for this location
  stats: {
    avg_aqi: Number,
    typical_pm25: Number,
    best_time_of_day: String, // "morning", "afternoon", "evening"
    worst_time_of_day: String
  },
  
  // Alerts
  monitor: Boolean, // Get alerts for this location
  
  created_at: Date
});

// Air Quality Alerts Configuration
const alertConfigSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  
  thresholds: {
    aqi_warning: Number, // Default 101 (Unhealthy for Sensitive Groups)
    aqi_danger: Number, // Default 151 (Unhealthy)
    pm25_warning: Number,
    co2_warning: Number
  },
  
  alert_types: {
    immediate: Boolean, // Real-time push notifications
    daily_summary: Boolean,
    weekly_report: Boolean,
    activity_recommendations: Boolean
  },
  
  quiet_hours: {
    enabled: Boolean,
    start_time: String, // "22:00"
    end_time: String // "08:00"
  }
});

// Activity Recommendations Cache
const recommendationSchema = new mongoose.Schema({
  user_id: String,
  timestamp: Date,
  
  current_aqi: Number,
  location: {
    latitude: Number,
    longitude: Number
  },
  
  recommendations: [{
    activity: String, // "outdoor_exercise", "indoor_exercise", "mask", "delay_outdoor"
    reason: String,
    confidence: Number, // 0-1
    priority: String // "low", "medium", "high"
  }],
  
  best_times_today: [{
    time: String,
    aqi_forecast: Number
  }],
  
  valid_until: Date
});

// Community Reports (User-submitted observations)
const communityReportSchema = new mongoose.Schema({
  user_id: String,
  timestamp: Date,
  
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  report_type: {
    type: String,
    enum: ['smoke', 'dust', 'odor', 'industrial_pollution', 'traffic', 'wildfire', 'other']
  },
  
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe']
  },
  
  description: String,
  photos: [String], // URLs
  
  // Validation
  verified: Boolean,
  verification_count: Number, // How many users confirmed
  
  created_at: Date
});

// Indexes
deviceSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
deviceSchema.index({ owner_id: 1 });
locationSchema.index({ user_id: 1 });
communityReportSchema.index({ 'location.latitude': 1, 'location.longitude': 1, timestamp: -1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  Device: mongoose.model('Device', deviceSchema),
  Location: mongoose.model('Location', locationSchema),
  AlertConfig: mongoose.model('AlertConfig', alertConfigSchema),
  Recommendation: mongoose.model('Recommendation', recommendationSchema),
  CommunityReport: mongoose.model('CommunityReport', communityReportSchema)
};
