#!/bin/bash

# Base URL for the model assets
BASE_URL="https://teslawrapgallery.com/tesla_3d_models"

# Target directory
TARGET_DIR="public/models"
TEXTURE_DIR="$TARGET_DIR/textures"

# Create directories
mkdir -p "$TEXTURE_DIR"

echo "Downloading binary file..."
curl -s -L "$BASE_URL/Poppyseed0.bin" -o "$TARGET_DIR/Poppyseed0.bin"

echo "Checking if we need to rename bin file references in gltf..."
# The user's gltf likely references "Poppyseed0.bin" or just "Poppyseed.bin". 
# The browser check showed "Poppyseed0.bin" on the network.
# IMPORTANT: The local .gltf file might expect a specific name. 
# I will download it as is, and we can check the .gltf content if it fails.

echo "Downloading 63 textures..."
for i in {0..62}; do
    # Format number with 3 digits (e.g., 001, 010)
    NUM=$(printf "%03d" $i)
    FILENAME="$NUM.png"
    
    echo "Downloading $FILENAME..."
    curl -s -L "$BASE_URL/textures/$FILENAME" -o "$TEXTURE_DIR/$FILENAME"
done

echo "Download complete."
