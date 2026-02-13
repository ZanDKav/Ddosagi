#!/bin/bash

echo "╔══════════════════════════════════════════════════╗"
echo "║     STARTING ULTIMATE DDOS BOT - 50K RPS        ║"
echo "╚══════════════════════════════════════════════════╝"

# Install dependencies
echo "[*] Installing Node.js dependencies..."
npm install

# Create proxy files if not exist
touch proxies.txt
touch my_ips.txt
touch referers.txt

# Start bot
echo "[*] Starting bot with 50K RPS capability..."
npm start