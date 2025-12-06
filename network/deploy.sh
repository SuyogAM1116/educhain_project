#!/bin/bash
# EduChain Deployment Script
# 
# Usage: 
#   chmod +x deploy.sh
#   ./deploy.sh

# Exit on first error
set -e

echo "🎓 EduChain Network Deployment Starting..."

# --- CONFIGURATION ---
# Path to your fabric-samples/test-network folder
# (Adjust this if your folder structure is different)
TEST_NETWORK_DIR="$HOME/fabric-samples/test-network"

# Path to YOUR chaincode inside this repo
CHAINCODE_SRC_DIR="$(pwd)/../chaincode/educhain"

CHANNEL_NAME="mychannel"
CC_NAME="educhain"
# ---------------------

# 1. Check if fabric-samples exists
if [ ! -d "$TEST_NETWORK_DIR" ]; then
    echo "❌ Error: Could not find fabric-samples at $TEST_NETWORK_DIR"
    echo "Please edit this script to point to your correct fabric-samples location."
    exit 1
fi

# 2. Navigate to Test Network
echo "📂 Navigating to Test Network..."
cd "$TEST_NETWORK_DIR"

# 3. Clean up previous network
echo "🧹 Cleaning up previous network..."
./network.sh down

# 4. Start Network with Certificate Authority (CA)
# CA is CRITICAL for your Node.js backend to register students/faculty!
echo "🚀 Starting Network & Creating Channel..."
./network.sh up createChannel -c $CHANNEL_NAME -ca

# 5. Deploy Chaincode
echo "📜 Deploying EduChain Smart Contract..."
echo "   Source: $CHAINCODE_SRC_DIR"

./network.sh deployCC \
    -c $CHANNEL_NAME \
    -ccn $CC_NAME \
    -ccp "$CHAINCODE_SRC_DIR" \
    -ccl go

echo "✅ Network & Chaincode Deployed Successfully!"
echo "--------------------------------------------------------"
echo "NEXT STEPS:"
echo "1. Go to your 'backend' folder: cd ../EduChain-Project/backend"
echo "2. Run 'npm install'"
echo "3. Copy the connection profile: 'cp $TEST_NETWORK_DIR/organizations/peerOrganizations/org1.example.com/connection-org1.json ./connection.json'"
echo "4. Start the app: 'node app.js'"
echo "--------------------------------------------------------"
