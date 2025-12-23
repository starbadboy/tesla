#!/bin/bash

BASE_URL="https://teslawrapgallery.com/tesla_3d_models"
TARGET_ROOT="public/models"

# Function to download a model
download_model() {
    local folder_name=$1
    local gltf_name=$2
    local bin_name=$3
    local texture_count=$4

    echo "------------------------------------------------"
    echo "Processing $folder_name..."
    
    local model_dir="$TARGET_ROOT/$folder_name"
    local texture_dir="$model_dir/textures"

    mkdir -p "$texture_dir"

    # Download GLTF
    echo "Downloading $gltf_name..."
    curl -s -L "$BASE_URL/$gltf_name" -o "$model_dir/$gltf_name"

    # Download BIN
    echo "Downloading $bin_name..."
    curl -s -L "$BASE_URL/$bin_name" -o "$model_dir/$bin_name"

    # Download Textures
    echo "Downloading $texture_count textures..."
    for ((i=0; i<=texture_count; i++)); do
        NUM=$(printf "%03d" $i)
        FILENAME="$NUM.png"
        # echo "Downloading $FILENAME..." # Reduce noise
        curl -s -L "$BASE_URL/textures/$FILENAME" -o "$texture_dir/$FILENAME"
    done
    echo "Completed $folder_name"
}

# 1. Model 3 2024 (Poppyseed) - Moving to subfolder
download_model "model3_2024" "Poppyseed.gltf" "Poppyseed0.bin" 62

# 2. Cybertruck
download_model "cybertruck" "Cybertruck.gltf" "Cybertruck0.bin" 87

# 3. Model 3 (Pre-2024 / Highland? No, High is Pre-2024)
download_model "model3_classic" "Model3_High.gltf" "Model3_High0.bin" 62

# 4. Model Y (Pre-2025)
download_model "modely_classic" "ModelY_High.gltf" "ModelY_High0.bin" 55

# 5. Model Y 2025 Premium (Bayberry)
download_model "modely_2025_premium" "Bayberry.gltf" "Bayberry0.bin" 15

# 6. Model Y 2025 Standard (BayberryE41)
download_model "modely_2025_standard" "BayberryE41.gltf" "BayberryE410.bin" 22

echo "All downloads complete."
