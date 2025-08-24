// Simple API test using curl
console.log('🧪 Testing API with authenticated request...');

// Note: This won't work from Node.js without proper authentication
// but shows what the test would look like

fetch('http://localhost:3000/api/accounts', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // In a real app, you'd need the Authorization header with a valid JWT
  }
})
.then(res => res.json())
.then(data => {
  console.log('📊 API Response:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('❌ Error:', err.message);
});
