import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 DVLA API KEY (Hardcoded)
// ==========================================
const HARDCODED_DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc";
// ==========================================

// --- INTERNAL AXIOS ENGINE ---
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
            const txt = await response.text();
            throw new Error(`Status ${response.status}`);
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
    primary: '#ea580c', green: '#16a34a', red: '#dc2626', light: '#fff7ed', dark: '#9a3412',
    border: '#fdba74', grey: '#f8fafc', text: '#334155', disabled: '#9ca3af'
};
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em', boxSizing: 'border-box' };
const headerStyle = { borderBottom: `2px solid ${theme.primary}`, paddingBottom: '5px', marginBottom: '15px', color: theme.primary, fontSize: '0.9em', fontWeight: 'bold', letterSpacing: '1px' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 0' };
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
    const [settings, setSettings] = useState({
        laborRate: '50', markup: '20', companyName: 'TRIPLE MMM',
        address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', email: 'markmonie72@gmail.com',
        dvlaKey: HARDCODED_DVLA_KEY, terms: 'Payment Terms: 30 Days. Title of goods remains with Triple MMM until paid in full.'
    });

    const [name, setName] = useState(''); const [address, setAddress] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState(''); const [networkCode, setNetworkCode] = useState(''); const [insuranceCo, setInsuranceCo] = useState(''); const [insuranceAddr, setInsuranceAddr] = useState(''); const [insuranceEmail, setInsuranceEmail] = useState('');
    const [reg, setReg] = useState(''); const [mileage, setMileage] = useState(''); const [makeModel, setMakeModel] = useState(''); const [vin, setVin] = useState(''); const [paintCode, setPaintCode] = useState('');
    const [vehicleInfo, setVehicleInfo] = useState(null); const [bookingDate, setBookingDate] = useState(''); const [bookingTime, setBookingTime] = useState('09:00');
    const [foundHistory, setFoundHistory] = useState(false); const [isLookingUp, setIsLookingUp] = useState(false);

    const [itemDesc, setItemDesc] = useState(''); const [itemCostPrice, setItemCostPrice] = useState(''); const [items, setItems] = useState([]);
    const [photos, setPhotos] = useState([]); const [uploading, setUploading] = useState(false); const [paintAllocated, setPaintAllocated] = useState('');
    const [expDesc, setExpDesc] = useState(''); const [expAmount, setExpAmount] = useState(''); const [expCategory, setExpCategory] = useState('Stock');
    const [laborHours, setLaborHours] = useState(''); const [laborRate, setLaborRate] = useState('50'); const [vatRate, setVatRate] = useState('0'); const [excess, setExcess] = useState('');

    const [savedEstimates, setSavedEstimates] = useState([]); const [generalExpenses, setGeneralExpenses] = useState([]);
    const [saveStatus, setSaveStatus] = useState('IDLE'); const [logoError, setLogoError] = useState(false); const [searchTerm, setSearchTerm] = useState('');
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false); const [currentJobId, setCurrentJobId] = useState(null);
    const [methodsRequired, setMethodsRequired] = useState(false);

    const activeJob = useMemo(() => savedEstimates.find(j => j.id === currentJobId), [savedEstimates, currentJobId]);
    const isDealFileReady = useMemo(() => activeJob?.dealFile?.auth && activeJob?.dealFile?.terms && activeJob?.dealFile?.satisfaction, [activeJob]);

    // --- EFFECTS ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => { if(snap.exists()) { const s = snap.data(); setSettings(prev => ({...prev, ...s, dvlaKey: HARDCODED_DVLA_KEY})); setLaborRate(s.laborRate || '50'); }});
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

    // --- HELPER FUNCTIONS ---
    const handleRegChange = (e) => { const val = e.target.value.toUpperCase(); setReg(val); setFoundHistory(false); };
    
    const checkHistory = async (regInput) => {
        if(regInput.length < 3) return;
        const q = query(collection(db, 'estimates'), where("reg", "==", regInput), orderBy('createdAt', 'desc'));
        try { const snap = await getDocs(q); if (!snap.empty) { const prev = snap.docs[0].data(); setMakeModel(prev.makeModel||''); setName(prev.customer||''); setPhone(prev.phone||''); setEmail(prev.email||''); setAddress(prev.address||''); setVin(prev.vin||''); setPaintCode(prev.paintCode||''); if(prev.insuranceCo) setInsuranceCo(prev.insuranceCo); setFoundHistory(true); } } catch(e) {}
    };

    const addToGoogleCalendar = () => {
        if(!bookingDate) return alert("Select Booking Date.");
        const start = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00';
        const end = bookingDate.replace(/-/g, '') + 'T' + (parseInt(bookingTime.split(':')[0]) + 1).toString().padStart(2, '0') + bookingTime.split(':')[1] + '00';
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Repair: ${name} (${reg})`)}&dates=${start}/${end}&details=${encodeURIComponent(makeModel)}&location=${encodeURIComponent(settings.address)}`, '_blank');
    };

    const handlePrint = () => { if (mode === 'DEAL_FILE' || mode === 'DASHBOARD' || mode === 'SETTINGS') setMode('INVOICE'); setTimeout(() => window.print(), 1000); };
    
    const uploadDoc = async (docType, file) => {
        if (!currentJobId) return alert("Save job first.");
        const storageRef = ref(storage, `deal_docs/${currentJobId}/${docType}_${file.name}`);
        try { setSaveStatus('SAVING'); const snap = await uploadBytes(storageRef, file); const url = await getDownloadURL(snap.ref); await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${docType}`]: { name: file.name, url: url, date: new Date().toLocaleDateString() } }); setSaveStatus('IDLE'); alert("Uploaded!"); } catch (e) { alert("Upload failed: " + e.message); setSaveStatus('IDLE'); }
    };

    const toggleMethods = async () => {
        if (!currentJobId) return alert("Save job first.");
        const newVal = !methodsRequired;
        setMethodsRequired(newVal);
        await updateDoc(doc(db, 'estimates', currentJobId), { 'dealFile.methodsRequired': newVal });
    };

    const saveSettings = async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Saved!"); setMode('ESTIMATE'); };
    const addGeneralExpense = async () => { if(!expDesc || !expAmount) return; await addDoc(collection(db, 'expenses'), { desc: expDesc, amount: parseFloat(expAmount), category: expCategory, date: serverTimestamp() }); setExpDesc(''); setExpAmount(''); };
    const deleteExpense = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'expenses', id)); };
    const deleteJob = async (id) => { if(window.confirm("WARNING: Delete this job permanently?")) { try { await deleteDoc(doc(db, 'estimates', id)); } catch (e) { alert("Error deleting: " + e.message); } } };
    const togglePaid = async (id, currentStatus) => { await updateDoc(doc(db, 'estimates', id), { status: currentStatus === 'PAID' ? 'UNPAID' : 'PAID' }); };

    const downloadAccountingCSV = () => { let csv = "Date,Type,Invoice,Customer,Reg,Total,Status\n"; savedEstimates.filter(est => est.type && est.type.includes('INVOICE')).forEach(inv => { csv += `${new Date(inv.createdAt?.seconds * 1000).toLocaleDateString()},${inv.type},${inv.invoiceNumber},${inv.customer},${inv.reg},${inv.totals?.finalDue.toFixed(2)},${inv.status}\n`; }); const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); link.download = "TripleMMM_Sales.csv"; link.click(); };
    const downloadExpensesCSV = () => { let csv = "Date,Category,Description,Amount\n"; generalExpenses.forEach(ex => { csv += `${new Date(ex.date?.seconds * 1000).toLocaleDateString()},${ex.category},${ex.desc},${ex.amount.toFixed(2)}\n`; }); const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); link.download = "TripleMMM_Expenses.csv"; link.click(); };

    // --- DVLA LOOKUP (FIXED) ---
    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Reg");
        setIsLookingUp(true);
        const apiKey = HARDCODED_DVLA_KEY;
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
        
        try {
            const response = await axios.post(proxyUrl, { registrationNumber: reg }, {
                headers: { 'x-api-key': apiKey }
            });
            const data = response.data;
            if(data.errors) throw new Error("Not Found");
            setMakeModel(`${data.make} ${data.colour}`);
            setVehicleInfo(data);
            if(data.vin) setVin(data.vin);
            alert(`✅ Found: ${data.make} ${data.colour}`);
        } catch (error) {
            console.error(error);
            alert("⚠️ Connection Blocked. Manual Entry Enabled.");
            setMakeModel("Manual Entry Required");
            setVehicleInfo({ make: "Manual", colour: "Manual", yearOfManufacture: "Manual", fuelType: "Manual" });
        } finally {
            setIsLookingUp(false);
        }
    };

    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); setName(est.customer); setAddress(est.address||''); setPhone(est.phone||''); setEmail(est.email||''); setReg(est.reg); setMileage(est.mileage||''); setMakeModel(est.makeModel||''); setVin(est.vin||''); setPaintCode(est.paintCode||''); setClaimNum(est.claimNum||''); setNetworkCode(est.networkCode||''); setInsuranceCo(est.insuranceCo||''); setInsuranceAddr(est.insuranceAddr||''); setInsuranceEmail(est.insuranceEmail||''); setItems(est.items||[]); setLaborHours(est.laborHours||''); setLaborRate(est.laborRate||settings.laborRate); setVatRate(est.vatRate||settings.vatRate); setExcess(est.excess||''); setPhotos(est.photos||[]); setBookingDate(est.bookingDate||''); setBookingTime(est.bookingTime||'09:00'); setPaintAllocated(est.paintAllocated||''); setInvoiceNum(est.invoiceNumber||''); setVehicleInfo(est.vehicleInfo||null); setMethodsRequired(est.dealFile?.methodsRequired||false); setMode('DEAL_FILE'); window.scrollTo(0, 0);
    };

    const decodeVin = () => { if (!vin && !makeModel) return alert("Enter VIN"); const wmi = vin.substring(0, 3).toUpperCase(); let url = `https://www.google.com/search?q=${makeModel}+paint+code+location`; if (wmi.startsWith('WBA') || wmi.startsWith('WMW')) url = `https://www.mdecoder.com/decode/${vin}`; else if (wmi.startsWith('WDD') || wmi.startsWith('WDB')) url = `https://www.lastvin.com/vin/${vin}`; else if (wmi.startsWith('WVW') || wmi.startsWith('WAU')) url = `https://7zap.com/en/search/?q=${vin}`; window.open(url, '_blank'); };
    const decodeParts = () => { if (!vin || vin.length < 3) return alert("Enter VIN"); const wmi = vin.substring(0, 3).toUpperCase(); let url = `https://partsouq.com/en/catalog/genuine/locate?c=${vin}`; if (wmi.startsWith('WBA') || wmi.startsWith('WMW')) url = `https://www.realoem.com/bmw/enUS/select?vin=${vin}`; else if (wmi.startsWith('WVW') || wmi.startsWith('WAU')) url = `https://7zap.com/en/search/?q=${vin}`; window.open(url, '_blank'); };

    const addItem = () => { if (!itemDesc) return; const cost = parseFloat(itemCostPrice) || 0; const price = cost * (1 + (parseFloat(settings.markup) / 100)); setItems([...items, { desc: itemDesc, costPrice: cost, price }]); setItemDesc(''); setItemCostPrice(''); };
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

    const saveToCloud = async (targetType) => {
        if (!name || !reg) return alert("Enter Name & Reg");
        setSaveStatus('SAVING');
        try {
            let finalInvNum = invoiceNum;
            let displayType = targetType;
            if((targetType === 'INVOICE_MAIN' || targetType === 'INVOICE_EXCESS') && !finalInvNum) {
                finalInvNum = `INV-${1000 + savedEstimates.length + 1}`;
                setInvoiceNum(finalInvNum);
                setInvoiceDate(new Date().toLocaleDateString());
            }
            if(targetType === 'INVOICE_MAIN') { setMode('INVOICE'); setInvoiceType('MAIN'); displayType = 'INVOICE'; } 
            else if (targetType === 'INVOICE_EXCESS') { setMode('INVOICE'); setInvoiceType('EXCESS'); displayType = 'INVOICE (EXCESS)'; } 
            else { setMode(targetType); }

            const docRef = await addDoc(collection(db, 'estimates'), {
                type: displayType, status: 'UNPAID', invoiceNumber: finalInvNum || '',
                customer: name, address, phone, email, claimNum, networkCode, insuranceCo, insuranceAddr,
                reg, mileage, makeModel, vin, paintCode,
                items, laborHours, laborRate, vatRate, excess, photos,
                bookingDate, bookingTime, paintAllocated,
                vehicleInfo: vehicleInfo || {}, 
                totals: calculateJobFinancials(), createdAt: serverTimestamp(), createdBy: userId,
                dealFile: { methodsRequired: false }
            });
            setCurrentJobId(docRef.id);
            setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 3000); 
        } catch (error) { alert("Error: " + error.message); setSaveStatus('IDLE'); }
    };

    const clearForm = () => { if(window.confirm("Start fresh?")) { setMode('ESTIMATE'); setInvoiceNum(''); setInvoiceDate(''); setName(''); setAddress(''); setPhone(''); setEmail(''); setReg(''); setMileage(''); setMakeModel(''); setClaimNum(''); setNetworkCode(''); setVin(''); setPaintCode(''); setItems([]); setLaborHours(''); setExcess(''); setPhotos([]); setPaintAllocated(''); setInsuranceCo(''); setInsuranceAddr(''); setBookingDate(''); setBookingTime('09:00'); setFoundHistory(false); setSaveStatus('IDLE'); setCurrentJobId(null); setMethodsRequired(false); if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0, 0, 350, 100); } };
    
    const handlePhotoUpload = async (e) => { const files = Array.from(e.target.files); if (!files.length) return; setUploading(true); try { const promises = files.map(async (file) => { const r = ref(storage, `damage_photos/${Date.now()}_${Math.random()}_${file.name}`); await uploadBytes(r, file); return getDownloadURL(r); }); const urls = await Promise.all(promises); setPhotos([...photos, ...urls]); } catch (e) { alert("Upload failed"); } setUploading(false); };
    const removePhoto = (i) => setPhotos(photos.filter((_, x) => x !== i));

    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCo(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCo(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { const ctx = canvasRef.current.getContext('2d'); ctx.closePath(); setIsDrawing(false); };
    const getCo = (e) => { if (e.touches && e.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: e.touches[0].clientX - rect.left, offsetY: e.touches[0].clientY - rect.top }; } return { offsetX: e.offsetX, offsetY: e.offsetY }; };
    const clearSignature = () => { if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0, 0, 350, 100); };
    useEffect(() => { clearSignature(); }, [mode]);

    const emailLink = `mailto:?subject=Repair Docs: ${reg}&body=Attached documents for ${reg}. Invoice: ${invoiceNum}`;

    // --- VIEWS ---
    if(mode === 'SETTINGS') return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <button onClick={() => setMode('ESTIMATE')} style={{marginBottom:'20px', padding:'10px', background:'#eee', border:'none', borderRadius:'4px'}}>← Back</button>
            <h2 style={headerStyle}>⚙️ Settings</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <label>Labor Rate (£/hr): <input value={settings.laborRate} onChange={e => setSettings({...settings, laborRate: e.target.value})} style={inputStyle} /></label>
                <label>Parts Markup (%): <input value={settings.markup} onChange={e => setSettings({...settings, markup: e.target.value})} style={inputStyle} /></label>
                <label>DVLA API Key: <input value={settings.dvlaKey} onChange={e => setSettings({...settings, dvlaKey: e.target.value})} style={inputStyle} /></label>
                <label>Address: <textarea value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} style={{...inputStyle, height:'60px'}} /></label>
                <button onClick={saveSettings} style={primaryBtn}>SAVE SETTINGS</button>
            </div>
        </div>
    );

    if(mode === 'DASHBOARD') {
        const totalSales = savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.type.includes('EXCESS') ? parseFloat(curr.excess) : curr.totals?.finalDue || 0), 0);
        const totalOverheads = generalExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        return (
            <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
                <button onClick={() => setMode('ESTIMATE')} style={{marginBottom:'20px', padding:'10px'}}>← Back</button>
                <h2>📊 Financial Dashboard</h2>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'30px'}}>
                    <div style={{padding:'20px', background:'#f0fdf4', borderRadius:'8px'}}><h3>Total Sales</h3><div style={{fontSize:'2em', fontWeight:'bold', color:'#166534'}}>£{totalSales.toFixed(2)}</div></div>
                    <div style={{padding:'20px', background:'#fffbeb', borderRadius:'8px'}}><h3>Total Expenses</h3><div style={{fontSize:'2em', fontWeight:'bold', color:'#b45309'}}>£{totalOverheads.toFixed(2)}</div></div>
                </div>
                <h3>Log Expense</h3>
                <div style={{display:'flex', gap:'10px', marginBottom:'30px'}}>
                    <input placeholder="Desc" value={expDesc} onChange={e => setExpDesc(e.target.value)} style={{flex:1, padding:'10px'}} />
                    <input type="number" placeholder="£" value={expAmount} onChange={e => setExpAmount(e.target.value)} style={{width:'80px', padding:'10px'}} />
                    <button onClick={addGeneralExpense} style={primaryBtn}>Add</button>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={downloadAccountingCSV} style={secondaryBtn}>📥 Sales CSV</button>
                    <button onClick={downloadExpensesCSV} style={secondaryBtn}>📥 Expenses CSV</button>
                </div>
                <div style={{marginTop:'20px'}}>{generalExpenses.map(ex => (<div key={ex.id} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'10px'}}><span>{ex.desc}</span><strong>£{ex.amount.toFixed(2)}</strong></div>))}</div>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif', background: 'white' }}>
            {mode !== 'ESTIMATE' && <button onClick={() => setMode('ESTIMATE')} className="no-print" style={{marginBottom:'20px', padding:'10px', background:'#eee', border:'none', borderRadius:'4px'}}>← BACK</button>}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #cc0000', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>{!logoError ? <img src={process.env.PUBLIC_URL + "/1768838821897.png"} alt="TRIPLE MMM" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} onError={() => setLogoError(true)} /> : <div style={{ fontSize: '3em', fontWeight: '900', letterSpacing: '-2px', lineHeight:'0.9' }}><span style={{color: 'black'}}>TRIPLE</span><br/><span style={{color: '#cc0000'}}>MMM</span></div>}</div>
                <div style={{ textAlign: 'right', fontSize: '0.9em', color: '#333' }}><div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>{settings.address}</div><div>Tel: <strong>{settings.phone}</strong></div><div>Email: {settings.email}</div></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '2em', color: '#333' }}>{mode === 'SATISFACTION' ? 'SATISFACTION NOTE' : (mode === 'JOBCARD' ? 'WORKSHOP JOB CARD' : (mode === 'DEAL_FILE' ? 'DIGITAL DEAL FILE' : (invoiceType === 'EXCESS' ? 'INVOICE (EXCESS)' : mode)))}</h2>
                {mode !== 'ESTIMATE' && <div style={{ textAlign: 'right' }}><strong>{invoiceNum}</strong><br/>{invoiceDate || new Date().toLocaleDateString()}</div>}
            </div>

            {mode !== 'DEAL_FILE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px', border: '1px solid #ddd', padding: '20px', borderRadius: '12px' }}>
                <div>
                    <h4 style={headerStyle}>CLIENT DETAILS</h4>
                    <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                    <textarea placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={{...inputStyle, height: '60px', fontFamily: 'inherit'}} />
                    <div style={{display:'flex', gap:'5px'}}><input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /><input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} /></div>
                    
                    {/* INSURANCE CARD */}
                    {excess > 0 && <div className="no-print" style={{marginTop:'15px', background:'#f8f9fa', padding:'15px', borderLeft:'4px solid #cc0000'}}>
                        <h5 style={{marginTop:0}}>INSURANCE INFO</h5>
                        <input placeholder="Insurer Name" value={insuranceCo} onChange={e => setInsuranceCo(e.target.value)} style={inputStyle} />
                        <div style={{display:'flex', gap:'5px'}}>
                            <input placeholder="Claim #" value={claimNum} onChange={e => setClaimNum(e.target.value)} style={inputStyle} />
                            <input placeholder="Network Code" value={networkCode} onChange={e => setNetworkCode(e.target.value)} style={inputStyle} />
                        </div>
                        <input placeholder="Insurer Email" value={insuranceEmail} onChange={e => setInsuranceEmail(e.target.value)} style={inputStyle} />
                    </div>}
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE DETAILS</h4>
                    <div style={{display:'flex', gap:'10px'}}><input placeholder="ENTER REG" value={reg} onChange={handleRegChange} onBlur={() => checkHistory(reg)} style={{...inputStyle, fontWeight:'bold', fontSize:'1.1em', textTransform:'uppercase', background:'#fffbeb'}} /><button onClick={lookupReg} className="no-print" style={secondaryBtn}>{isLookingUp ? '...' : '🔎'}</button></div>
                    {foundHistory && <div style={{color:'green', fontSize:'0.8em', marginBottom:'5px'}}>✓ Customer Found in History</div>}
                    
                    {vehicleInfo && (
                        <div style={{background:'#f3f4f6', padding:'10px', borderRadius:'6px', marginBottom:'10px', border:'1px dashed #ccc', fontSize:'0.9em'}}>
                            <strong>{vehicleInfo.make} {vehicleInfo.colour}</strong><br/>
                            Year: {vehicleInfo.yearOfManufacture} | Fuel: {vehicleInfo.fuelType}<br/>
                            Tax: {vehicleInfo.taxStatus} | MOT: {vehicleInfo.motStatus}
                        </div>
                    )}

                    <input placeholder="Make / Model" value={makeModel} onChange={e => setMakeModel(e.target.value)} style={inputStyle} />
                    <div style={{display:'flex', gap:'5px'}}><input placeholder="VIN (Chassis No.)" value={vin} onChange={e => setVin(e.target.value)} style={inputStyle} /><button onClick={decodeVin} className="no-print" style={secondaryBtn} title="Paint">🎨</button><button onClick={decodeParts} className="no-print" style={{...secondaryBtn, background:'#cc0000'}} title="Parts">🔧</button></div>
                    <input placeholder="Paint Code" value={paintCode} onChange={e => setPaintCode(e.target.value)} style={inputStyle} />
                    <div className="no-print" style={{marginTop:'15px', borderTop:'1px dashed #ccc', paddingTop:'10px'}}><div style={{display:'flex', gap:'5px'}}><input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={inputStyle} /><button onClick={addToGoogleCalendar} style={secondaryBtn}>📅 Cal</button></div></div>
                    <div className="no-print" style={{marginTop:'10px', background:'#eee', padding:'10px', borderRadius:'6px'}}><label style={{fontWeight:'bold', display:'block', marginBottom:'5px'}}>📸 Upload Photos</label><input type="file" multiple accept="image/*" onChange={handlePhotoUpload} disabled={uploading} /></div>
                </div>
            </div>
            )}

            {photos.length > 0 && mode !== 'DEAL_FILE' && <div style={{marginBottom:'20px', display:'flex', gap:'10px', overflowX:'auto', padding:'5px'}}>{photos.map((url, i) => (<div key={i} style={{position:'relative', minWidth:'100px', height:'100px'}}><img src={url} alt="Damage" style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'6px'}} /><button className="no-print" onClick={() => removePhoto(i)} style={{position:'absolute', top:0, right:0, background:'red', color:'white', border:'none', width:'20px', height:'20px'}}>x</button></div>))}</div>}

            {mode !== 'SATISFACTION' && mode !== 'DEAL_FILE' && (
                <>
                    {invoiceType !== 'EXCESS' && (
                        <>
                            <div className="no-print" style={{ background: theme.grey, padding: '15px', marginBottom: '15px', borderRadius: '8px', display:'flex', gap:'10px' }}>
                                <input placeholder="Item Description" value={itemDesc} onChange={e => setItemDesc(e.target.value)} style={{...inputStyle, flexGrow:1, marginBottom:0}} />
                                <input type="number" placeholder="Cost" value={itemCostPrice} onChange={e => setItemCostPrice(e.target.value)} style={{...inputStyle, width:'80px', marginBottom:0}} />
                                <button onClick={addItem} style={successBtn}>+</button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}><thead><tr style={{textAlign:'left', borderBottom:'2px solid #333'}}><th style={{padding:'10px'}}>DESCRIPTION</th>{mode !== 'JOBCARD' && <th style={{textAlign:'right'}}>PRICE</th>}</tr></thead><tbody>{items.map((item, i) => (<tr key={i} style={{ borderBottom: '1px solid #eee' }}><td style={{padding:'10px'}}>{item.desc}</td>{mode !== 'JOBCARD' && <td style={{textAlign:'right'}}>£{item.price.toFixed(2)}</td>}<td className="no-print"><button onClick={() => removeItem(i)} style={{color:'red', border:'none', background:'none'}}>x</button></td></tr>))}</tbody></table>
                        </>
                    )}

                    {mode !== 'JOBCARD' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '350px', textAlign: 'right' }}>
                                {invoiceType !== 'EXCESS' && (
                                    <>
                                    <div className="no-print" style={{marginBottom:'10px'}}>Labor: <input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} style={{width:'50px', textAlign:'center'}} /> hrs</div>
                                    <div style={rowStyle}><span>Labor Total:</span> <strong>£{totals.labor.toFixed(2)}</strong></div>
                                    <div style={rowStyle}><span>Parts Total:</span> <strong>£{totals.partsPrice.toFixed(2)}</strong></div>
                                    <div style={{...rowStyle, fontSize:'1.2em', borderTop:'2px solid black', marginTop:'10px'}}><span>TOTAL:</span> <strong>£{totals.invoiceTotal.toFixed(2)}</strong></div>
                                    <div style={{...rowStyle, color:'red'}}><span>Less Excess:</span><span className="no-print"><input type="number" value={excess} onChange={e => setExcess(e.target.value)} style={{width:'60px'}} /></span><span>-£{totals.excessAmount.toFixed(2)}</span></div>
                                    </>
                                )}
                                <div style={{...rowStyle, fontSize:'1.4em', background:'#eee', padding:'10px', borderRadius:'6px', marginTop:'10px'}}><span>DUE:</span> <strong>£{invoiceType === 'EXCESS' ? parseFloat(excess).toFixed(2) : totals.finalDue.toFixed(2)}</strong></div>
                                
                                <div className="no-print" style={{marginTop:'15px', padding:'10px', border:'1px dashed #ccc', borderRadius:'6px'}}>
                                    <label style={{fontSize:'0.8em', fontWeight:'bold'}}>🎨 Internal Paint Cost</label>
                                    <div style={{display:'flex', alignItems:'center'}}>£<input type="number" value={paintAllocated} onChange={e => setPaintAllocated(e.target.value)} style={{width:'100%', marginLeft:'5px', border:'none', background:'transparent', fontWeight:'bold'}} placeholder="0.00" /></div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {mode === 'INVOICE' && (
                        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ccc', paddingTop:'20px' }}>
                            <div style={{width:'60%'}}><h4>PAYMENT DETAILS</h4><p>Bank: <strong>BANK OF SCOTLAND</strong><br/>Account: <strong>06163462</strong><br/>Sort: <strong>80-22-60</strong><br/>Name: <strong>{settings.companyName}</strong></p></div>
                            <div style={{textAlign:'center', width:'30%'}}>
                                <div className="no-print" style={{border: '1px dashed #ccc', height: '60px', backgroundColor: '#fff', marginBottom:'5px'}}><canvas ref={canvasRef} width={200} height={60} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} /></div>
                                <div style={{ borderBottom: '1px solid #333' }}></div><div style={{fontSize:'0.8em'}}>SIGNED</div>
                            </div>
                        </div>
                    )}

                    {mode === 'JOBCARD' && (
                        <div style={{ marginTop: '50px', borderTop: '2px solid #ccc', paddingTop:'20px' }}>
                            <h4>AUTHORITY & TERMS</h4><div style={{fontSize:'0.8em', color:'#333', whiteSpace: 'pre-wrap', marginBottom:'30px'}}>{settings.terms}</div>
                            <div style={{display:'flex', justifyContent:'space-between', marginTop:'40px'}}><div style={{textAlign:'center', width:'40%'}}><div style={{borderBottom:'1px solid #333', height:'40px'}}></div><div>CUSTOMER</div></div><div style={{textAlign:'center', width:'40%'}}><div style={{borderBottom:'1px solid #333', height:'40px'}}></div><div>TECHNICIAN</div></div></div>
                        </div>
                    )}
                </>
            )}

            {mode === 'DEAL_FILE' && (
                <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '12px', background: '#fafafa' }}>
                    <h2 style={{borderBottom:'2px solid #cc0000', paddingBottom:'10px'}}>📂 Digital Deal File</h2>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                        <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                            <h4>Checklist</h4>
                            {['terms', 'auth', 'satisfaction', 'methods'].map(type => (
                                <div key={type} style={{marginBottom:'10px', borderBottom:'1px solid #eee', paddingBottom:'5px', display:'flex', justifyContent:'space-between'}}>
                                    <strong>{type.toUpperCase()}</strong>
                                    <div>{activeJob?.dealFile?.[type] ? '✅' : '❌'}<input type="file" onChange={(e) => uploadDoc(type, e.target.files[0])} style={{fontSize:'0.8em', width:'180px', marginLeft:'10px'}} />{activeJob?.dealFile?.[type] && <a href={activeJob.dealFile[type].url} target="_blank" style={{marginLeft:'5px'}}>View</a>}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                            <h4>Actions</h4>
                            <div>Photos: {photos.length} | Invoice: {invoiceNum || 'Pending'}</div>
                            <div style={{marginTop:'20px', paddingTop:'10px', borderTop:'1px dashed #ccc'}}>
                                Send to: <strong>{insuranceEmail || 'No Email Set'}</strong>
                                <button onClick={() => window.location.href = `mailto:${insuranceEmail||email}?subject=${encodeURIComponent(`Repair Docs: ${reg}`)}&body=${encodeURIComponent(`Please find attached documents for ${reg}. Invoice: ${invoiceNum}`)}`} disabled={!isDealFileReady} style={{...primaryBtn, width:'100%', marginTop:'10px', background: isDealFileReady ? theme.green : theme.disabled, cursor: isDealFileReady ? 'pointer' : 'not-allowed'}}>{isDealFileReady ? '📧 SEND EMAIL PACK' : '⚠️ COMPLETE CHECKLIST'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #ddd', padding: '15px', display: 'flex', gap: '12px', overflowX: 'auto', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 1000 }}>
                <button onClick={() => saveToCloud('ESTIMATE')} style={saveStatus === 'SUCCESS' ? successBtn : greenBtn}>{saveStatus === 'SAVING' ? '⏳' : 'SAVE'}</button>
                {mode === 'ESTIMATE' && <><button onClick={() => saveToCloud('INVOICE_MAIN')} style={{...secondaryBtn, background: '#4f46e5'}}>Inv Insurer</button><button onClick={() => saveToCloud('INVOICE_EXCESS')} style={{...secondaryBtn, background: '#be123c'}}>Inv Customer</button></>}
                <button onClick={() => setMode('JOBCARD')} style={secondaryBtn}>Job Card</button>
                <button onClick={() => setMode('DEAL_FILE')} style={{...secondaryBtn, background: theme.primary}}>Deal File</button>
                <button onClick={handlePrint} style={secondaryBtn}>Print</button>
                <button onClick={clearForm} style={{...secondaryBtn, background: '#ef4444'}}>New</button>
                <button onClick={() => setMode('SETTINGS')} style={secondaryBtn}>⚙️</button>
                <button onClick={() => setMode('DASHBOARD')} style={secondaryBtn}>📊</button>
            </div>

            <div className="no-print" style={{marginTop:'50px'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd', paddingBottom:'10px'}}><h3>Recent Jobs</h3><input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{padding:'5px'}} /></div>
                {savedEstimates.filter(est => (est.customer?.toLowerCase().includes(searchTerm.toLowerCase()) || est.reg?.toLowerCase().includes(searchTerm.toLowerCase()))).map(est => (
                    <div key={est.id} style={{padding:'12px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', background: est.status === 'PAID' ? '#f0fdf4' : 'white'}}>
                        <div onClick={() => loadJobIntoState(est)} style={{cursor:'pointer'}}><strong>{est.reg}</strong> - {est.customer} <span style={{color:'#888', fontSize:'0.8em'}}>({est.invoiceNumber || 'Est'})</span></div>
                        <div style={{display:'flex', alignItems:'center', gap:'5px'}}><button onClick={() => deleteJob(est.id)} style={{...dangerBtn, fontSize:'0.8em', padding:'5px 10px'}}>X</button><button onClick={() => togglePaid(est.id, est.status)} style={{border:'1px solid #ccc', background: est.status === 'PAID' ? theme.green : 'white', color: est.status === 'PAID' ? 'white' : '#333', borderRadius:'4px', padding:'5px 10px'}}>{est.status === 'PAID' ? 'PAID' : 'PAY'}</button></div>
                    </div>
                ))}
            </div>
            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; } input, textarea { border: none !important; resize: none; font-family: inherit; color: black; } }`}</style>
        </div>
    );
};

const App = () => { const [u, sU] = useState(null); useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []); if (!u) return <div style={{padding:'20px', color:'#ea580c'}}>Loading Triple MMM...</div>; return <EstimateApp userId={u} />; };
export default App;
