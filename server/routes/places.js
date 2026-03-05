const router = require('express').Router();
const https = require('https');

// ── GET /api/places/autocomplete ─────────────────────────────────────────────
// Proxies to Google Places Autocomplete so the API key stays server-side.
// Query params: input (required), sessiontoken (optional)

router.get('/autocomplete', (req, res) => {
  const { input, sessiontoken } = req.query;

  if (!input || !input.trim()) {
    return res.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: 'Geocoding not configured' });
  }

  const params = new URLSearchParams({
    input: input.trim(),
    key: apiKey,
    // Return both addresses and establishments (game stores, etc.)
    types: 'geocode|establishment',
    ...(sessiontoken ? { sessiontoken } : {}),
  });

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;

  https.get(url, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => (data += chunk));
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        // Return only what the frontend needs
        const predictions = (json.predictions || []).map((p) => ({
          placeId:     p.place_id,
          description: p.description,
          mainText:    p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || '',
        }));
        res.json({ predictions });
      } catch (err) {
        console.error('[places/autocomplete] parse error:', err.message);
        res.status(500).json({ predictions: [] });
      }
    });
  }).on('error', (err) => {
    console.error('[places/autocomplete] request error:', err.message);
    res.status(500).json({ predictions: [] });
  });
});

module.exports = router;
