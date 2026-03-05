const https = require('https');

/**
 * Geocodes a location string (address, city, zip code) to [longitude, latitude].
 * Returns null if the address cannot be resolved.
 */
function geocode(address) {
  return new Promise((resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('[geocode] GOOGLE_MAPS_API_KEY not set — skipping geocoding');
      return resolve(null);
    }

    const query = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'OK' && json.results.length > 0) {
            const { lat, lng } = json.results[0].geometry.location;
            // GeoJSON: [longitude, latitude]
            resolve([lng, lat]);
          } else {
            console.warn(`[geocode] No results for "${address}": ${json.status}`);
            resolve(null);
          }
        } catch (err) {
          console.error('[geocode] Parse error:', err.message);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error('[geocode] Request error:', err.message);
      resolve(null);
    });
  });
}

module.exports = { geocode };
