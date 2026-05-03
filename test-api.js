#!/usr/bin/env node

/**
 * Test script to verify that the API returns all incidents including closed ones
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testGetAllIncidents() {
  try {
    console.log('🔍 Testing GET /api/incidents (all incidents)...');
    const response = await axios.get(`${API_BASE}/incidents`);
    const incidents = response.data.data;

    console.log(`✅ Found ${incidents.length} total incidents`);

    // Count by status
    const statusCounts = incidents.reduce((acc, incident) => {
      acc[incident.status] = (acc[incident.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Status breakdown:', statusCounts);

    // Show sample incidents
    if (incidents.length > 0) {
      console.log('\n📋 Sample incidents:');
      incidents.slice(0, 3).forEach(incident => {
        console.log(`  - ${incident.id}: ${incident.title} (${incident.status})`);
      });
    }

    return incidents;
  } catch (error) {
    console.error('❌ Failed to fetch incidents:', error.message);
    return [];
  }
}

async function testGetClosedIncidents() {
  try {
    console.log('\n🔍 Testing GET /api/incidents?status=CLOSED (closed incidents only)...');
    const response = await axios.get(`${API_BASE}/incidents?status=CLOSED`);
    const incidents = response.data.data;

    console.log(`✅ Found ${incidents.length} closed incidents`);

    if (incidents.length > 0) {
      console.log('📋 Closed incidents:');
      incidents.forEach(incident => {
        console.log(`  - ${incident.id}: ${incident.title}`);
      });
    }

    return incidents;
  } catch (error) {
    console.error('❌ Failed to fetch closed incidents:', error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 Testing Incident Management System API\n');

  // Test getting all incidents
  const allIncidents = await testGetAllIncidents();

  // Test getting closed incidents specifically
  const closedIncidents = await testGetClosedIncidents();

  console.log('\n✨ Test completed!');
  console.log(`📈 Total incidents: ${allIncidents.length}`);
  console.log(`🔒 Closed incidents: ${closedIncidents.length}`);
}

main().catch(console.error);