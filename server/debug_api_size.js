const axios = require('axios');

async function checkSize() {
    try {
        console.log("Checking API size...");
        const response = await axios.get('https://www.teslaskin.de5.net/api/skins', {
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const data = response.data;
        console.log(`Status: ${response.status}`);
        console.log(`Data Type: ${typeof data}`);

        if (Array.isArray(data)) {
            console.log(`Item Count: ${data.length}`);
            if (data.length > 0) {
                console.log(`Sample Item:`, JSON.stringify(data[0], null, 2));
            }
        }

        // Estimate size in memory (rough JSON string length)
        const jsonStr = JSON.stringify(data);
        const sizeMB = jsonStr.length / (1024 * 1024);
        console.log(`Approx. JSON Size: ${sizeMB.toFixed(2)} MB`);

    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
        }
    }
}

checkSize();
