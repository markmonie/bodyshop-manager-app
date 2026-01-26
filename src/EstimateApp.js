import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 DVLA API KEY (Hardcoded)
// ==========================================
const HARDCODED_DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc"; 
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

// --- INTERNAL AXIOS ENGINE (Restores Axios Functionality) ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }
        return { data: await response.json() };
    }
};

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
  measurementId: "G-NRDPCR0SR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- STYLES ---
const theme = {
    primary: '#ea580c', // Orange
    green: '#16a34a',   // Green
    red: '#dc2626',     // Red
    light: '#fff7ed',
    dark: '#9a3412',
    border: '#fdba74',
    grey: '#f8fafc',
    text: '#334155',
    disabled: '#9ca3af'
};

const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em', boxSizing: 'border-box' };
const headerStyle = { borderBottom: `2px solid ${theme.primary}`, paddingBottom: '5px', marginBottom: '15px', color: theme.primary, fontSize: '0.9em', fontWeight: 'bold', letterSpacing: '1px' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 0' };

// Buttons
const btnBase = { padding: '12px 20px', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontSize: '0.9em' };
const primaryBtn = { ...btnBase, background: theme.primary, color: 'white' }; 
const greenBtn = { ...btnBase, background: theme.green, color: 'white' }; 
const secondaryBtn = { ...btnBase, background: '#334155', color: 'white' };
const dangerBtn = { ...btnBase, background: theme.red, color: 'white', padding: '8px 15px' }; 
const successBtn = { ...greenBtn, border: '2px solid #14532d' };

const EstimateApp = ({ userId }) => {
    // --- STATE ---
    const [mode, setMode] = useState('ESTIMATE');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [invoiceType, setInvoiceType] = useState('MAIN');

    // Settings
    const [settings, setSettings] = useState({
        laborRate: '50',
        markup: '20',
        companyName: 'TRIPLE MMM',
        address: '20A New Street, Stonehouse, ML9 3LT',
        phone: '07501 728319',
        email: 'markmonie72@gmail.com',
        dvlaKey: HARDCODED_DVLA_KEY,
        terms: 'Payment Terms: 30 Days. Title of goods remains with Triple MMM until paid in full.'
    });

    // Data
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    
    // Insurance
    const [claimNum, setClaimNum] = useState('');
    const [networkCode, setNetworkCode] = useState('');
    const [insuranceCo, setInsuranceCo] = useState('');
    const [insuranceAddr, setInsuranceAddr] = useState('');
    const [insuranceEmail, setInsuranceEmail] = useState('');
    
    // Vehicle & Stats
    const [reg, setReg] = useState('');
    const [mileage, setMileage] = useState('');
    const [makeModel, setMakeModel] = useState('');
    const [vin, setVin] = useState(''); 
    const [paintCode, setPaintCode] = useState('');
    const [vehicleInfo, setVehicleInfo] = useState(null); 
    const [bookingDate, setBookingDate] = useState(''); 
    const [bookingTime, setBookingTime] = useState('09:00'); 
    const [foundHistory, setFoundHistory] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    
    // Items & Costs
    const [itemDesc, setItemDesc] = useState('');
    const [itemCostPrice, setItemCostPrice] = useState(''); 
    const [items, setItems] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [paintAllocated, setPaintAllocated] = useState(''); 
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expCategory, setExpCategory] = useState('Stock');
    const [laborHours, setLaborHours] = useState('');
    const [laborRate, setLaborRate] = useState('50');
    const [vatRate, setVatRate] = useState('0');
    const [excess, setExcess] = useState('');
    
    // System
    const [savedEstimates, setSavedEstimates] = useState([]);
    const [generalExpenses, setGeneralExpenses] = useState([]);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [logoError, setLogoError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null); 
    const [methodsRequired, setMethodsRequired] = useState(false);

    const activeJob = useMemo(() => savedEstimates.find(j => j.id === currentJobId), [savedEstimates, currentJobId]);

    const isDealFileReady = useMemo(() => {
        if (!activeJob?.dealFile) return false;
        return activeJob.dealFile.auth && activeJob.dealFile.terms && activeJob.dealFile.satisfaction;
    }, [activeJob]);

    // --- LOGIC ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => {
            if(snap.exists()) {
                const s = snap.data();
                setSettings(prev => ({...prev, ...s, dvlaKey: HARDCODED_DVLA_KEY}));
                setLaborRate(s.laborRate || '50');
                setVatRate(s.vatRate || '0');
            }
        });
        const qEst = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        const unsubEst = onSnapshot(qEst, (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const qExp = query(collection(db, 'expenses'), orderBy('date', 'desc'));
        const unsubExp = onSnapshot(qExp, (snap) => setGeneralExpenses(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubEst(); unsubExp(); };
    }, []);

    useEffect(() => {
        if(mode === 'SETTINGS' || mode === 'DASHBOARD' || mode === 'DEAL_FILE') return;
        const draft = { name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, insuranceEmail, mode };
        localStorage.setItem('triple_mmm_draft', JSON.stringify(draft));
    }, [name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, insuranceEmail, mode]);

    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); 
        setName(est.customer); setAddress(est.address || ''); setPhone(est.phone || ''); setEmail(est.email || ''); 
        setReg(est.reg); setMileage(est.mileage || ''); setMakeModel(est.makeModel || ''); setVin(est.vin || ''); setPaintCode(est.paintCode || ''); 
        setClaimNum(est.claimNum || ''); setNetworkCode(est.networkCode || ''); setInsuranceCo(est.insuranceCo || ''); setInsuranceAddr(est.insuranceAddr || ''); setInsuranceEmail(est.insuranceEmail || '');
        setItems(est.items || []); setLaborHours(est.laborHours || ''); setLaborRate(est.laborRate || settings.laborRate); setVatRate(est.vatRate || settings.vatRate);
        setExcess(est.excess || ''); setPhotos(est.photos || []); setBookingDate(est.bookingDate || ''); setBookingTime(est.bookingTime || '09:00'); 
        setPaintAllocated(est.paintAllocated || ''); setInvoiceNum(est.invoiceNumber || '');
        setVehicleInfo(est.vehicleInfo || null);
        setMethodsRequired(est.dealFile?.methodsRequired || false); 
        setMode('DEAL_FILE'); window.scrollTo(0, 0);
    };

    // --- RESTORED HELPER FUNCTIONS ---
    const handleRegChange = (e) => {
        const val = e.target.value.toUpperCase();
        setReg(val);
        setFoundHistory(false);
    };

    const checkHistory = async (regInput) => {
        if(regInput.length < 3) return;
        const q = query(collection(db, 'estimates'), where("reg", "==", regInput), orderBy('createdAt', 'desc'));
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const prev = querySnapshot.docs[0].data();
                setMakeModel(prev.makeModel || ''); setName(prev.customer || ''); setPhone(prev.phone || ''); setEmail(prev.email || '');
                setAddress(prev.address || ''); setVin(prev.vin || ''); setPaintCode(prev.paintCode || '');
                setVehicleInfo(prev.vehicleInfo || null);
                if(prev.insuranceCo) setInsuranceCo(prev.insuranceCo);
                if(prev.insuranceEmail) setInsuranceEmail(prev.insuranceEmail);
                setFoundHistory(true);
            }
        } catch(e) { }
    };

    const addToGoogleCalendar = () => {
        if(!bookingDate) return alert("Select Booking Date.");
        const start = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00';
        const end = bookingDate.replace(/-/g, '') + 'T' + (parseInt(bookingTime.split(':')[0]) + 1).toString().padStart(2, '0') + bookingTime.split(':')[1] + '00';
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Repair: ${name} (${reg})`)}&dates=${start}/${end}&details=${encodeURIComponent(makeModel)}&location=${encodeURIComponent(settings.address)}`;
        window.open(url, '_blank');
    };

    const handlePrint = () => {
        if (mode === 'DEAL_FILE' || mode === 'DASHBOARD' || mode === 'SETTINGS') setMode('INVOICE');
        setTimeout(() => window.print(), 1000);
    };

    const saveSettings = async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Saved!"); setMode('ESTIMATE'); };
    
    const addGeneralExpense = async () => { if(!expDesc || !expAmount) return; await addDoc(collection(db, 'expenses'), { desc: expDesc, amount: parseFloat(expAmount), category: expCategory, date: serverTimestamp() }); setExpDesc(''); setExpAmount(''); };
    
    const downloadAccountingCSV = () => {
        let csv = "Date,Type,Invoice,Customer,Reg,Total,Status\n";
        savedEstimates.filter(est => est.type && est.type.includes('INVOICE')).forEach(inv => {
            csv += `${new Date(inv.createdAt?.seconds * 1000).toLocaleDateString()},${inv.type},${inv.invoiceNumber},${inv.customer},${inv.reg},${inv.totals?.finalDue.toFixed(2)},${inv.status}\n`;
        });
        const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); link.download = "TripleMMM_Sales.csv"; link.click();
    };

    const downloadExpensesCSV = () => {
        let csv = "Date,Category,Description,Amount\n";
        generalExpenses.forEach(ex => { csv += `${new Date(ex.date?.seconds * 1000).toLocaleDateString()},${ex.category},${ex.desc},${ex.amount.toFixed(2)}\n`; });
        const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); link.download = "TripleMMM_Expenses.csv"; link.click();
    };
    
    // --- SMART DVLA LOOKUP (Silent Fail / No Popup) ---
    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Reg");
        setIsLookingUp(true);
        
        const apiKey = HARDCODED_DVLA_KEY.length > 5 ? HARDCODED_DVLA_KEY : settings.dvlaKey;
        
        // Use 'thingproxy' instead of 'corsproxy' (More permissive)
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        const proxyUrl = 'https://thingproxy.freeboard.io/fetch/' + targetUrl;
        
        try {
            const response = await axios.post(proxyUrl, { registrationNumber: reg }, {
                headers: { 'x-api-key': apiKey }
            });

            const data = response.data;
            setMakeModel(`${data.make} ${data.colour}`);
            setVehicleInfo(data); 
            if(data.vin) setVin(data.vin); 
            alert("✅ Vehicle Found!");

        } catch (e) { 
            console.error("Lookup failed silently:", e);
            // FAIL SAFE: Do NOT show error popup. Just unlock manual entry.
            setMakeModel("Manual Entry Required");
            setVehicleInfo({
                make: "Connection Blocked",
                colour: "",
                yearOfManufacture: "N/A",
                fuelType: "Manual Entry Needed",
                taxStatus: "Unknown",
                motStatus: "Unknown"
            });
        } finally {
            setIsLookingUp(false);
        }
    };

    const decodeVin = () => { 
        if (!vin && !makeModel) return alert("Enter VIN or Find Vehicle First");
        if (vin && vin.length > 2) {
            const wmi = vin.toUpperCase().substring(0, 3);
            if (wmi.startsWith('WBA') || wmi.startsWith('WMW') || wmi.startsWith('WBS')) { window.open(`https://www.mdecoder.com/decode/${vin}`, '_blank'); return; }
            if (wmi.startsWith('WDD') || wmi.startsWith('WDB')) { window.open(`https://www.lastvin.com/vin/${vin}`, '_blank'); return; }
        }
        const searchTeam = makeModel ? makeModel.split(' ')[0] : 'Car';
        window.open(`https://www.paintcode.co.uk/search/${searchTeam}`, '_blank'); 
    };

    const decodeParts = () => { if (!vin || vin.length < 3) return alert("Enter VIN"); window.open(`https://partsouq.com/en/catalog/genuine/locate?c=${vin}`, '_blank'); };

    const addItem = () => {
        if (!itemDesc) return;
        const cost = parseFloat(itemCostPrice) || 0;
        const markupPercent = parseFloat(settings.markup) || 0;
        const price = cost * (1 + (markupPercent / 100)); 
        setItems([...items, { desc: itemDesc, costPrice: cost, price: price }]);
        setItemDesc(''); setItemCostPrice('');
    };

    const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

    const calculateJobFinancials = () => {
        const partsPrice = items.reduce((acc, i) => acc + i.price, 0); 
        const partsCost = items.reduce((acc, i) => acc + i.costPrice, 0); 
        const labor = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
        const paintCost = parseFloat(paintAllocated) || 0;
        const invoiceTotal = partsPrice + labor;
        const totalJobCost = partsCost + paintCost;
        const jobProfit = invoiceTotal - totalJobCost;
        const excessAmount = parseFloat(excess) || 0;
        const finalDue = invoiceTotal - excessAmount;
        return { partsPrice, partsCost, labor, paintCost, invoiceTotal, totalJobCost, jobProfit, excessAmount, finalDue };
    };

    const totals = calculateJobFinancials();

    const deleteJob = async (id) => { if(window.confirm("Delete permanently?")) try { await deleteDoc(doc(db, 'estimates', id)); } catch (e) { alert("Error: " + e.message); } };
    const deleteExpense = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'expenses', id)); };

    const updatePaintCost = async (id, newCost) => {
        if(!id) return;
        const cost = parseFloat(newCost) || 0;
        await updateDoc(doc(db, 'estimates', id), { paintAllocated: cost });
        const updated = savedEstimates.map(j => {
            if(j.id === id) {
                const newTotalCost = (j.totals?.partsCost || 0) + cost;
                const newProfit = (j.totals?.invoiceTotal || 0) - newTotalCost;
                return { ...j, paintAllocated: cost, totals: { ...j.totals, totalJobCost: newTotalCost, jobProfit: newProfit } };
            }
            return j;
        });
        setSavedEstimates(updated);
    };

    const saveToCloud = async (targetType) => {
        if (!name || !reg) return alert("Enter Customer & Reg");
        setSaveStatus('SAVING');
        try {
            let finalInvNum = invoiceNum;
            let displayType = targetType;
            if((targetType.includes('INVOICE')) && !finalInvNum) {
                finalInvNum = `INV-${1000 + savedEstimates.length + 1}`;
                setInvoiceNum(finalInvNum); setInvoiceDate(new Date().toLocaleDateString());
            }
            if(targetType === 'INVOICE_MAIN') { setMode('INVOICE'); setInvoiceType('MAIN'); displayType = 'INVOICE'; } 
            else if (targetType === 'INVOICE_EXCESS') { setMode('INVOICE'); setInvoiceType('EXCESS'); displayType = 'INVOICE (EXCESS)'; } 
            else { setMode(targetType); }

            const docRef = await addDoc(collection(db, 'estimates'), {
                type: displayType, status: 'UNPAID', invoiceNumber: finalInvNum || '',
                customer: name, address, phone, email, 
                claimNum, networkCode, insuranceCo, insuranceAddr, insuranceEmail,
                reg, mileage, makeModel, vin, paintCode, items, laborHours, laborRate, vatRate, excess, photos,
                bookingDate, bookingTime, paintAllocated,
                vehicleInfo: vehicleInfo || {}, 
                totals: calculateJobFinancials(), createdAt: serverTimestamp(), createdBy: userId,
                dealFile: { methodsRequired: false }
            });
            setCurrentJobId(docRef.id);
            setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 3000); 
        } catch (error) { alert("Error: " + error.message); setSaveStatus('IDLE'); }
    };

    const clearForm = () => {
        if(window.confirm("Start fresh?")) {
            setMode('ESTIMATE'); setInvoiceNum(''); setName(''); setReg(''); setItems([]); setPhotos([]); setPaintAllocated(''); 
            setClaimNum(''); setNetworkCode(''); setInsuranceCo(''); setInsuranceAddr(''); setInsuranceEmail('');
            setSaveStatus('IDLE'); localStorage.removeItem('triple_mmm_draft'); setCurrentJobId(null); setVehicleInfo(null);
        }
    };

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files); if (!files.length) return;
        setUploading(true);
        try {
            const urls = await Promise.all(files.map(async (file) => {
                const r = ref(storage, `damage_photos/${Date.now()}_${Math.random()}_${file.name}`);
                await uploadBytes(r, file); return getDownloadURL(r);
            }));
            setPhotos(prev => [...prev, ...urls]);
        } catch (error) { alert("Upload failed"); }
        setUploading(false);
    };

    const removePhoto = (index) => setPhotos(photos.filter((_, i) => i !== index));
    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCoordinates(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCoordinates(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { const ctx = canvasRef.current.getContext('2d'); ctx.closePath(); setIsDrawing(false); };
    const getCoordinates = (event) => { if (event.touches && event.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: event.touches[0].clientX - rect.left, offsetY: event.touches[0].clientY - rect.top }; } return { offsetX: event.offsetX, offsetY: event.offsetY }; };
    const clearSignature = () => { if(canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); } };
    useEffect(() => { clearSignature(); }, [mode]);

    const uploadFile = async (type, file) => { if(!currentJobId) return alert("Save First"); const r = ref(storage, `deal_docs/${currentJobId}/${type}_${file.name}`); await uploadBytes(r, file); const u = await getDownloadURL(r); await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${type}`]: { name: file.name, url: u } }); alert("Uploaded"); };

    const togglePaid = async (id, currentStatus) => { await updateDoc(doc(db, 'estimates', id), { status: currentStatus === 'PAID' ? 'UNPAID' : 'PAID' }); };
    const filteredEstimates = savedEstimates.filter(est => (est.customer?.toLowerCase().includes(searchTerm.toLowerCase()) || est.reg?.toLowerCase().includes(searchTerm.toLowerCase()) || est.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())));

    const emailSubject = `Repair Docs: ${reg} (Claim: ${claimNum})`;
    const emailBody = `Attached documents for vehicle ${reg}.%0D%0A%0D%0A1. Authority: Attached%0D%0A2. Invoice: ${invoiceNum}%0D%0A3. Signed T&Cs: ${activeJob?.dealFile?.terms ? 'Attached' : 'Pending'}%0D%0A4. Satisfaction Note: ${activeJob?.dealFile?.satisfaction ? 'Attached' : 'Pending'}`;
    const emailLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;

    // --- VIEWS ---
    if(mode === 'SETTINGS') return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial' }}>
            <button onClick={() => setMode('ESTIMATE')} style={secondaryBtn}>← Back</button>
            <h2 style={{color: theme.primary, borderBottom: `2px solid ${theme.primary}`}}>⚙️ Settings</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <label>Labor Rate (£/hr): <input value={settings.laborRate} onChange={e => setSettings({...settings, laborRate: e.target.value})} style={inputStyle} /></label>
                <label>Parts Markup (%): <input value={settings.markup} onChange={e => setSettings({...settings, markup: e.target.value})} style={inputStyle} /></label>
                
                {/* KEY VISUALIZER */}
                <div style={{background: (settings.dvlaKey || HARDCODED_DVLA_KEY) ? '#f0fdf4' : '#fef2f2', padding:'10px', borderRadius:'6px', border: `1px solid ${(settings.dvlaKey || HARDCODED_DVLA_KEY) ? 'green' : 'red'}`}}>
                    <label style={{color: (settings.dvlaKey || HARDCODED_DVLA_KEY) ? 'green' : 'red', fontWeight:'bold'}}>DVLA API Key ({(settings.dvlaKey || HARDCODED_DVLA_KEY).length > 5 ? 'ACTIVE' : 'MISSING'})</label>
                    <input value={settings.dvlaKey} onChange={e => setSettings({...settings, dvlaKey: e.target.value})} style={{...inputStyle, borderColor: (settings.dvlaKey || HARDCODED_DVLA_KEY) ? 'green' : 'red'}} placeholder="Paste DVLA Key Here" />
                </div>

                <label>Address: <textarea value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} style={{...inputStyle, height:'60px'}} /></label>
                <label>Invoice Terms & Bank Details:</label>
                <textarea value={settings.terms} onChange={e => setSettings({...settings, terms: e.target.value})} style={{...inputStyle, height:'120px'}} />
                <button onClick={saveSettings} style={greenBtn}>SAVE SETTINGS</button>
            </div>
        </div>
    );

    if(mode === 'DASHBOARD') return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial' }}>
            <button onClick={() => setMode('ESTIMATE')} style={secondaryBtn}>← Back</button>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2 style={{color: theme.primary}}>📊 Financial Dashboard</h2>
                <button onClick={downloadAccountingCSV} style={{...primaryBtn, fontSize:'0.8em'}}>📥 Export Sales CSV</button>
            </div>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'30px'}}>
                <div style={{padding:'20px', background: theme.light, borderRadius:'8px', border: `1px solid ${theme.border}`}}><h3>Total Sales</h3><div style={{fontSize:'2em', fontWeight:'bold', color: theme.dark}}>£{savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.totals?.finalDue || 0), 0).toFixed(2)}</div></div>
                <div style={{padding:'20px', background: '#ecfccb', borderRadius:'8px'}}><h3>Net Profit</h3><div style={{fontSize:'2em', fontWeight:'bold', color: '#166534'}}>£{(savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.totals?.finalDue || 0), 0) - savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.totals?.totalJobCost || 0), 0) - generalExpenses.reduce((acc, curr) => acc + curr.amount, 0)).toFixed(2)}</div></div>
            </div>
            
            <h3 style={{color:theme.dark}}>Job Costing & Profit</h3>
            <div style={{marginBottom:'30px', maxHeight:'400px', overflowY:'auto', border:`1px solid ${theme.border}`, borderRadius:'8px'}}>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead style={{position:'sticky', top:0, background:theme.light}}><tr style={{textAlign:'left', color:theme.dark}}>
                        <th style={{padding:'10px'}}>Reg</th>
                        <th style={{padding:'10px'}}>Total Inv</th>
                        <th style={{padding:'10px'}}>Paint/Mat Cost</th>
                        <th style={{padding:'10px'}}>Net Profit</th>
                    </tr></thead>
                    <tbody>
                    {savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).map(job => (
                        <tr key={job.id} style={{borderBottom:'1px solid #eee', background:'white'}}>
                            <td style={{padding:'10px', fontWeight:'bold'}}>{job.reg}</td>
                            <td style={{padding:'10px'}}>£{job.totals?.finalDue.toFixed(0)}</td>
                            <td style={{padding:'10px'}}>
                                <div style={{display:'flex', alignItems:'center'}}>
                                    £<input 
                                        type="number" 
                                        defaultValue={job.paintAllocated} 
                                        onBlur={(e) => updatePaintCost(job.id, e.target.value)}
                                        style={{width:'60px', padding:'5px', marginLeft:'5px', border:`1px solid ${theme.border}`, borderRadius:'4px'}} 
                                    />
                                </div>
                            </td>
                            <td style={{padding:'10px', fontWeight:'bold', color: job.totals?.jobProfit > 0 ? 'green' : 'red'}}>£{job.totals?.jobProfit.toFixed(0)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <h3>Shop Expenses</h3>
            <div style={{display:'flex', gap:'10px', marginBottom:'30px'}}>
                <input placeholder="Desc" value={expDesc} onChange={e => setExpDesc(e.target.value)} style={{flex:1, ...inputStyle}} />
                <input type="number" placeholder="£" value={expAmount} onChange={e => setExpAmount(e.target.value)} style={{width:'80px', ...inputStyle}} />
                <button onClick={addGeneralExpense} style={greenBtn}>Add</button>
            </div>
            <button onClick={downloadExpensesCSV} style={secondaryBtn}>📥 Export Expenses</button>
            {generalExpenses.map(ex => (<div key={ex.id} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'10px'}}><span>{ex.desc}</span><strong>£{ex.amount.toFixed(2)}</strong></div>))}
        </div>
    );

    return (
        <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif', background: 'white', paddingBottom: '100px' }}>
            {mode !== 'ESTIMATE' && <button onClick={() => setMode('ESTIMATE')} className="no-print" style={{...secondaryBtn, marginBottom:'20px'}}>← BACK</button>}
            
            {/* LOGO HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${theme.primary}`, paddingBottom: '20px', marginBottom: '30px' }}>
                <div>{!logoError ? <img src={process.env.PUBLIC_URL + "/1768838821897.png"} alt="TRIPLE MMM" style={{ maxHeight: '120px' }} onError={() => setLogoError(true)} /> : <h1 style={{color: theme.primary, fontSize: '3em', margin:0}}>TRIPLE MMM</h1>}</div>
                <div style={{ textAlign: 'right', fontSize: '0.9em', color: theme.text }}><strong>{settings.address}</strong><br/>{settings.phone}<br/>{settings.email}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '2em', color: theme.text }}>{mode === 'DEAL_FILE' ? '📂 DEAL FILE' : (invoiceType === 'EXCESS' ? 'INVOICE (EXCESS)' : mode)}</h2>
                {mode !== 'ESTIMATE' && <div style={{ textAlign: 'right' }}><strong>{invoiceNum}</strong><br/>{invoiceDate || new Date().toLocaleDateString()}</div>}
            </div>

            {/* MAIN FORM */}
            {mode !== 'DEAL_FILE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px', border: `1px solid ${theme.grey}`, padding: '20px', borderRadius: '12px' }}>
                <div>
                    <h4 style={headerStyle}>CLIENT</h4>
                    <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                    <textarea placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={{...inputStyle, height: '60px', fontFamily: 'inherit'}} />
                    <div style={{display:'flex', gap:'5px'}}><input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /><input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} /></div>
                    
                    {/* UPGRADED INSURANCE BOX */}
                    {excess > 0 && (
                        <div className="no-print" style={{marginTop:'20px', background:'white', padding:'20px', borderRadius:'12px', borderLeft:`6px solid ${theme.primary}`, boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}>
                            <div style={{display:'flex', alignItems:'center', marginBottom:'10px'}}>
                                <span style={{fontSize:'1.5em', marginRight:'10px'}}>🛡️</span>
                                <h4 style={{margin:0, color:theme.text}}>Insurance & Network</h4>
                            </div>
                            <label style={{display:'block', fontSize:'0.8em', color:'#888', marginBottom:'2px'}}>Insurer Name</label>
                            <input placeholder="e.g. Admiral, Direct Line..." value={insuranceCo} onChange={e => setInsuranceCo(e.target.value)} style={{...inputStyle, marginBottom:'10px'}} />
                            
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                                <div><label style={{fontSize:'0.8em', color:'#888'}}>Claim No.</label><input value={claimNum} onChange={e => setClaimNum(e.target.value)} style={inputStyle} /></div>
                                <div><label style={{fontSize:'0.8em', color:'#888'}}>Network Code</label><input value={networkCode} onChange={e => setNetworkCode(e.target.value)} style={inputStyle} /></div>
                            </div>

                            <label style={{display:'block', fontSize:'0.8em', color:'#888', marginBottom:'2px'}}>Insurer Email (For Deal File)</label>
                            <input placeholder="engineering@insurer.com" value={insuranceEmail} onChange={e => setInsuranceEmail(e.target.value)} style={{...inputStyle, borderColor: theme.primary}} />

                            <label style={{display:'block', fontSize:'0.8em', color:'#888', marginBottom:'2px'}}>Address / Notes</label>
                            <textarea placeholder="Billing address..." value={insuranceAddr} onChange={e => setInsuranceAddr(e.target.value)} style={{...inputStyle, height:'50px', marginBottom:0}} />
                        </div>
                    )}
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE</h4>
                    <div style={{display:'flex', gap:'10px'}}><input placeholder="REG" value={reg} onChange={handleRegChange} onBlur={() => checkHistory(reg)} style={{...inputStyle, fontWeight:'bold', textTransform:'uppercase', background: theme.light}} /><button onClick={lookupReg} className="no-print" style={secondaryBtn}>{isLookingUp ? '...' : '🔎'}</button></div>
                    {foundHistory && <div style={{color:'green', fontSize:'0.8em'}}>✓ Customer Found</div>}
                    
                    {/* DEDICATED VEHICLE INFO BOX */}
                    {vehicleInfo && (
                        <div style={{background: theme.light, padding:'15px', borderRadius:'8px', border: `1px dashed ${theme.primary}`, marginBottom:'15px'}}>
                            <h5 style={{margin:'0 0 10px 0', color: theme.dark}}>🚗 Vehicle Report</h5>
                            <div style={{fontSize:'0.9em', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                                <div><strong>Make:</strong> {vehicleInfo.make}</div>
                                <div><strong>Colour:</strong> {vehicleInfo.colour}</div>
                                <div><strong>Year:</strong> {vehicleInfo.yearOfManufacture}</div>
                                <div><strong>Fuel:</strong> {vehicleInfo.fuelType}</div>
                                {vehicleInfo.revenueWeight && <div><strong>Weight:</strong> {vehicleInfo.revenueWeight}kg</div>}
                                {vehicleInfo.taxStatus && <div><strong>Tax:</strong> {vehicleInfo.taxStatus}</div>}
                                {vehicleInfo.motStatus && <div><strong>MOT:</strong> {vehicleInfo.motStatus}</div>}
                            </div>
                        </div>
                    )}

                    <input placeholder="Make / Model" value={makeModel} onChange={e => setMakeModel(e.target.value)} style={inputStyle} />
                    <div style={{display:'flex', gap:'5px'}}><input placeholder="VIN" value={vin} onChange={e => setVin(e.target.value)} style={inputStyle} /><button onClick={decodeVin} className="no-print" style={secondaryBtn} title="Paint">🎨</button><button onClick={decodeParts} className="no-print" style={{...secondaryBtn, background: theme.primary}} title="Parts">🔧</button></div>
                    <input placeholder="Paint Code" value={paintCode} onChange={e => setPaintCode(e.target.value)} style={inputStyle} />
                    <div style={{marginTop:'15px', borderTop:'1px dashed #ccc', paddingTop:'10px'}}><h4 style={{fontSize:'0.8em', color:'#888'}}>BOOKING</h4><div style={{display:'flex', gap:'5px'}}><input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={inputStyle} /><button onClick={addToGoogleCalendar} className="no-print" style={secondaryBtn}>📅</button></div></div>
                    <div className="no-print" style={{marginTop:'10px', background: theme.light, padding:'10px', borderRadius:'6px', border: `1px dashed ${theme.primary}`}}><label style={{fontWeight:'bold', color: theme.dark, display:'block', marginBottom:'5px'}}>📸 Upload Photos (Multi)</label><input type="file" multiple accept="image/*" onChange={handlePhotoUpload} disabled={uploading} /></div>
                </div>
            </div>
            )}

            {/* PHOTOS */}
            {photos.length > 0 && mode !== 'DEAL_FILE' && <div style={{marginBottom:'20px', display:'flex', gap:'10px', overflowX:'auto', padding:'5px'}}>{photos.map((url, i) => (<div key={i} style={{position:'relative', minWidth:'100px', height:'100px'}}><img src={url} alt="Damage" style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'6px'}} /><button className="no-print" onClick={() => removePhoto(i)} style={{position:'absolute', top:0, right:0, background:'red', color:'white', border:'none', width:'20px', height:'20px'}}>x</button></div>))}</div>}

            {mode !== 'SATISFACTION' && mode !== 'DEAL_FILE' && (
                <>
                    {invoiceType !== 'EXCESS' && (
                        <>
                            <div className="no-print" style={{ background: theme.grey, padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}><input placeholder="Item Description" value={itemDesc} onChange={e => setItemDesc(e.target.value)} style={{ flexGrow: 1, ...inputStyle, marginBottom:0 }} /><input type="number" placeholder="Cost £" value={itemCostPrice} onChange={e => setItemCostPrice(e.target.value)} style={{ width: '80px', ...inputStyle, marginBottom:0 }} /><button onClick={addItem} style={greenBtn}>Add Item</button></div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}><thead><tr style={{textAlign:'left', borderBottom:`2px solid ${theme.text}`}}><th style={{padding:'10px'}}>DESCRIPTION</th>{mode !== 'JOBCARD' && <th style={{textAlign:'right'}}>PRICE</th>}</tr></thead><tbody>{items.map((item, i) => (<tr key={i} style={{ borderBottom: '1px solid #eee' }}><td style={{padding:'10px'}}>{item.desc}</td>{mode !== 'JOBCARD' && <td style={{textAlign:'right'}}>£{item.price.toFixed(2)}</td>}<td className="no-print"><button onClick={() => removeItem(i)} style={{color:'red', border:'none', background:'none'}}>x</button></td></tr>))}</tbody></table>
                        </>
                    )}

                    {mode !== 'JOBCARD' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '350px', textAlign: 'right' }}>
                                {invoiceType !== 'EXCESS' && (
                                    <>
                                    <div className="no-print" style={{marginBottom:'10px'}}>Labor: <input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} style={{width:'50px', textAlign:'center'}} /> hrs @ £{settings.laborRate}</div>
                                    <div style={rowStyle}><span>Labor Total:</span> <strong>£{totals.labor.toFixed(2)}</strong></div>
                                    <div style={rowStyle}><span>Parts Total:</span> <strong>£{totals.partsPrice.toFixed(2)}</strong></div>
                                    <div style={{...rowStyle, fontSize:'1.2em', borderTop:'2px solid black', marginTop:'10px'}}><span>TOTAL:</span> <strong>£{totals.invoiceTotal.toFixed(2)}</strong></div>
                                    <div style={{...rowStyle, color:'red'}}><span>Less Excess:</span><span className="no-print"><input type="number" value={excess} onChange={e => setExcess(e.target.value)} style={{width:'60px'}} /></span><span>-£{totals.excessAmount.toFixed(2)}</span></div>
                                    </>
                                )}
                                <div style={{...rowStyle, fontSize:'1.4em', background: theme.grey, padding:'10px', borderRadius:'6px', marginTop:'10px'}}><span>DUE:</span> <strong>£{invoiceType === 'EXCESS' ? parseFloat(excess).toFixed(2) : totals.finalDue.toFixed(2)}</strong></div>
                                
                                {/* PAINT COST INPUT - NOW ON INVOICE SCREEN TOO */}
                                <div className="no-print" style={{marginTop:'15px', padding:'10px', border:`1px dashed ${theme.primary}`, borderRadius:'6px', background:theme.light}}>
                                    <label style={{fontSize:'0.8em', fontWeight:'bold', color:theme.primary}}>🎨 Internal Paint Cost</label>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        £<input type="number" value={paintAllocated} onChange={e => setPaintAllocated(e.target.value)} style={{width:'100%', marginLeft:'5px', border:'none', background:'transparent', fontWeight:'bold', fontSize:'1.1em'}} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* INVOICE FOOTER (Payment Only) */}
                    {mode === 'INVOICE' && (
                        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ccc', paddingTop:'20px' }}>
                            <div style={{width:'60%'}}>
                                <h4>PAYMENT DETAILS</h4>
                                <p>Bank: <strong>BANK OF SCOTLAND</strong><br/>Account: <strong>06163462</strong><br/>Sort: <strong>80-22-60</strong><br/>Name: <strong>{settings.companyName} BODY REPAIRS</strong></p>
                            </div>
                            <div style={{textAlign:'center', width:'30%'}}>
                                <div style={{marginBottom:'10px'}}><img src={process.env.PUBLIC_URL + "/qrcode.png"} alt="QR" style={{width:'80px', height:'80px', opacity:0.5}} /><div style={{fontSize:'0.7em'}}>SCAN TO PAY</div></div>
                                <div className="no-print" style={{border: '1px dashed #ccc', height: '60px', backgroundColor: '#fff', marginBottom:'5px'}}><canvas ref={canvasRef} width={200} height={60} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} /></div>
                                <div style={{ borderBottom: '1px solid #333' }}></div>
                                <div style={{fontSize:'0.8em'}}>SIGNED</div>
                            </div>
                        </div>
                    )}

                    {/* JOB CARD FOOTER (T&Cs MOVED HERE) */}
                    {mode === 'JOBCARD' && (
                        <div style={{ marginTop: '50px', borderTop: '2px solid #ccc', paddingTop:'20px' }}>
                            <h4>AUTHORITY & TERMS</h4>
                            <div style={{fontSize:'0.8em', color:'#333', whiteSpace: 'pre-wrap', marginBottom:'30px'}}>{settings.terms}</div>
                            
                            <div style={{display:'flex', justifyContent:'space-between', marginTop:'40px'}}>
                                <div style={{textAlign:'center', width:'40%'}}><div style={{borderBottom:'1px solid #333', height:'40px'}}></div><div>CUSTOMER SIGNATURE</div></div>
                                <div style={{textAlign:'center', width:'40%'}}><div style={{borderBottom:'1px solid #333', height:'40px'}}></div><div>TECHNICIAN SIGNATURE</div></div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* DEAL FILE */}
            {mode === 'DEAL_FILE' && (
                <div style={{ marginTop: '20px', padding: '20px', border: `1px solid ${theme.border}`, borderRadius: '12px', background: theme.light }}>
                    <h2 style={{borderBottom:`2px solid ${theme.primary}`, paddingBottom:'10px', color: theme.dark}}>📂 Digital Deal File</h2>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                        <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                            <h4 style={{color: theme.primary}}>1. Checklist</h4>
                            {['terms', 'auth', 'satisfaction', 'methods'].map(type => (
                                <div key={type} style={{marginBottom:'10px', borderBottom:'1px solid #eee', paddingBottom:'5px'}}>
                                    <div style={{display:'flex', justifyContent:'space-between'}}><strong>{type.toUpperCase()}</strong><span>{activeJob?.dealFile?.[type] ? '✅' : '❌'}</span></div>
                                    <input type="file" onChange={(e) => uploadDoc(type, e.target.files[0])} style={{fontSize:'0.8em'}} />
                                    {activeJob?.dealFile?.[type] && <a href={activeJob.dealFile[type].url} target="_blank" rel="noreferrer" style={{color: theme.primary, fontSize:'0.8em'}}>View</a>}
                                </div>
                            ))}
                        </div>
                        <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                            <h4 style={{color: theme.primary}}>2. Actions</h4>
                            <div>📸 Photos: {photos.length}</div>
                            <div>💰 Invoice: {invoiceNum || 'Pending'}</div>
                            
                            <div style={{marginTop:'20px', paddingTop:'10px', borderTop:'1px dashed #ccc'}}>
                                <div style={{fontSize:'0.8em', color:'#666', marginBottom:'5px'}}>SEND TO: <strong>{insuranceEmail || 'No Email Set'}</strong></div>
                                <button 
                                    onClick={() => window.location.href = emailLink} 
                                    disabled={!isDealFileReady}
                                    style={{
                                        ...primaryBtn, 
                                        width:'100%', 
                                        background: isDealFileReady ? theme.green : theme.disabled,
                                        cursor: isDealFileReady ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    {isDealFileReady ? '📧 SEND EMAIL PACK' : '⚠️ COMPLETE CHECKLIST FIRST'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SLIDING BOTTOM BAR */}
            <div className="no-print" style={{ 
                position: 'fixed', bottom: 0, left: 0, right: 0, 
                background: 'white', borderTop: '1px solid #ddd', 
                padding: '15px', display: 'flex', gap: '12px', 
                overflowX: 'auto', whiteSpace: 'nowrap', 
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', 
                zIndex: 1000 
            }}>
                <button onClick={() => saveToCloud('ESTIMATE')} style={saveStatus === 'SUCCESS' ? successBtn : greenBtn}>{saveStatus === 'SAVING' ? '⏳' : 'SAVE'}</button>
                {mode === 'ESTIMATE' && (
                    <>
                        <button onClick={() => saveToCloud('INVOICE_MAIN')} style={{...secondaryBtn, background: '#4f46e5'}}>Inv Insurer</button>
                        <button onClick={() => saveToCloud('INVOICE_EXCESS')} style={{...secondaryBtn, background: '#be123c'}}>Inv Customer</button>
                    </>
                )}
                <button onClick={() => setMode('JOBCARD')} style={secondaryBtn}>Job Card</button>
                <button onClick={() => setMode('DEAL_FILE')} style={{...secondaryBtn, background: theme.primary}}>Deal File</button>
                <button onClick={handlePrint} style={secondaryBtn}>Print</button>
                <button onClick={clearForm} style={{...secondaryBtn, background: '#ef4444'}}>New</button>
                <button onClick={() => setMode('SETTINGS')} style={secondaryBtn}>⚙️</button>
                <button onClick={() => setMode('DASHBOARD')} style={secondaryBtn}>📊</button>
            </div>

            <div className="no-print" style={{marginTop:'50px'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd', paddingBottom:'10px'}}><h3>Recent Jobs</h3><input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}} /></div>
                {filteredEstimates.map(est => (
                    <div key={est.id} style={{padding:'12px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', background: est.status === 'PAID' ? '#f0fdf4' : 'white'}}>
                        <div onClick={() => loadJobIntoState(est)} style={{cursor:'pointer'}}><strong>{est.reg}</strong> - {est.customer} <span style={{color:'#888', fontSize:'0.8em'}}>({est.invoiceNumber || 'Est'})</span></div>
                        <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                            <button onClick={() => deleteJob(est.id)} style={{...dangerBtn, fontSize:'0.8em', padding:'5px 10px'}}>X</button>
                            <button onClick={() => togglePaid(est.id, est.status)} style={{border:'1px solid #ccc', background: est.status === 'PAID' ? theme.green : 'white', color: est.status === 'PAID' ? 'white' : '#333', borderRadius:'4px', padding:'5px 10px'}}>{est.status === 'PAID' ? 'PAID' : 'PAY'}</button>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; } input, textarea { border: none !important; resize: none; font-family: inherit; color: black; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []);
    if (!u) return <div style={{padding:'20px', color:'#ea580c'}}>Loading Triple MMM...</div>;
    return <EstimateApp userId={u} />;
};

export default App;
