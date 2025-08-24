// Test Accounts API - No Authentication Required
const testAccountsAPI = async () => {
  console.log('🔍 Testing /api/accounts endpoint...');
  
  try {
    const response = await fetch('http://localhost:3001/api/accounts');
    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📄 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('🔐 Authentication required - this is expected for unauthenticated requests');
    } else if (response.status === 500) {
      console.log('❌ Server error - there might be an issue with the secure view');
    } else {
      console.log('✅ API responding successfully');
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
};

testAccountsAPI();
