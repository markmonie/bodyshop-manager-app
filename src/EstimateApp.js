const lookupReg = async () => {
    if (!reg || reg.length < 3) return alert("Enter Reg");
    setIsLookingUp(true);
    
    const apiKey = HARDCODED_DVLA_KEY;
    const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
    
    // corsproxy.io is generally the most reliable for POST requests
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json', // REQUIRED by DVLA
                'x-api-key': apiKey
            },
            body: JSON.stringify({ registrationNumber: reg })
        });

        if (response.ok) {
            const data = await response.json();
            // DVLA returns make and colour in the data object
            setMakeModel(`${data.make} ${data.colour}`);
            setVehicleInfo(data);
            alert("✅ Vehicle Found!");
        } else {
            const errorData = await response.json();
            console.error("DVLA Error:", errorData);
            alert(`❌ DVLA Error: ${errorData.errors[0].detail || "Not found"}`);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
        alert("❌ Connection blocked. Please enter details manually.");
        setMakeModel("Manual Entry Required");
    } finally {
        setIsLookingUp(false);
    }
};
